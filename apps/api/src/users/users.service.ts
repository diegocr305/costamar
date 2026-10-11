import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isValidRole, type UserRole } from '@costamar/shared';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

export interface UserView {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole | null;
  isActive: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Resuelve el role_id a partir del nombre del rol */
  private async getRoleId(role: UserRole): Promise<number> {
    const { data, error } = await this.supabase.client
      .from('roles')
      .select('id')
      .eq('name', role)
      .single();

    if (error || !data) {
      throw new BadRequestException(`Rol no encontrado: ${role}`);
    }
    return data.id;
  }

  /** Lista todos los perfiles con su rol asignado */
  async findAll(): Promise<UserView[]> {
    const { data: profiles, error } = await this.supabase.client
      .from('profiles')
      .select('id, full_name, phone');

    if (error) {
      throw new BadRequestException(error.message);
    }

    const result: UserView[] = [];
    for (const p of profiles ?? []) {
      const role = await this.getUserRole(p.id);
      result.push({
        id: p.id,
        email: '',
        fullName: p.full_name,
        phone: p.phone,
        role,
        isActive: true,
      });
    }
    return result;
  }

  /** Obtiene el rol actual de un usuario (de user_roles) */
  private async getUserRole(userId: string): Promise<UserRole | null> {
    const { data } = await this.supabase.client
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', userId)
      .maybeSingle();

    const name = (data as { roles?: { name?: string } } | null)?.roles?.name;
    return name && isValidRole(name) ? name : null;
  }

  /**
   * Crea un usuario interno: lo registra en Supabase Auth, el trigger crea
   * el perfil, y asigna el rol en user_roles.
   */
  async create(dto: CreateUserDto): Promise<UserView> {
    if (!isValidRole(dto.role)) {
      throw new BadRequestException(`Rol inválido: ${dto.role}`);
    }

    const roleId = await this.getRoleId(dto.role);

    const { data: created, error: authError } =
      await this.supabase.client.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
        user_metadata: { full_name: dto.fullName },
        app_metadata: { role: dto.role },
      });

    if (authError || !created.user) {
      throw new BadRequestException(
        authError?.message ?? 'No se pudo crear el usuario',
      );
    }

    const userId = created.user.id;

    // El perfil lo crea el trigger; aseguramos phone si vino.
    if (dto.phone) {
      await this.supabase.client
        .from('profiles')
        .update({ phone: dto.phone })
        .eq('id', userId);
    }

    await this.supabase.client
      .from('user_roles')
      .upsert({ user_id: userId, role_id: roleId });

    return {
      id: userId,
      email: dto.email,
      fullName: dto.fullName,
      phone: dto.phone ?? null,
      role: dto.role,
      isActive: true,
    };
  }

  /** Actualiza perfil y/o rol de un usuario */
  async update(id: string, dto: UpdateUserDto): Promise<UserView> {
    const { data: profile, error } = await this.supabase.client
      .from('profiles')
      .select('id, full_name, phone')
      .eq('id', id)
      .maybeSingle();

    if (error || !profile) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (dto.fullName !== undefined || dto.phone !== undefined) {
      await this.supabase.client
        .from('profiles')
        .update({
          ...(dto.fullName !== undefined ? { full_name: dto.fullName } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    }

    if (dto.role) {
      if (!isValidRole(dto.role)) {
        throw new BadRequestException(`Rol inválido: ${dto.role}`);
      }
      const roleId = await this.getRoleId(dto.role);
      await this.supabase.client
        .from('user_roles')
        .delete()
        .eq('user_id', id);
      await this.supabase.client
        .from('user_roles')
        .insert({ user_id: id, role_id: roleId });

      // Sincroniza el rol en los claims JWT (app_metadata)
      await this.supabase.client.auth.admin.updateUserById(id, {
        app_metadata: { role: dto.role },
      });
    }

    const role = await this.getUserRole(id);
    return {
      id,
      email: '',
      fullName: dto.fullName ?? profile.full_name,
      phone: dto.phone ?? profile.phone,
      role,
      isActive: true,
    };
  }

  /** Desactiva un usuario (ban en Supabase Auth, no se elimina) */
  async deactivate(id: string): Promise<{ id: string; deactivated: true }> {
    const { error } = await this.supabase.client.auth.admin.updateUserById(id, {
      ban_duration: '876000h', // ~100 años = desactivado
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { id, deactivated: true };
  }
}
