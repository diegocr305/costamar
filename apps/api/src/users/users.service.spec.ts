import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { CreateUserDto } from './dto/create-user.dto';

describe('UsersService', () => {
  // Rol inválido debe rechazarse con 400 antes de tocar Supabase.
  it('rechaza la creación con un rol inválido (400)', async () => {
    const supabase = { client: {} } as unknown as SupabaseService;
    const service = new UsersService(supabase);

    const dto = {
      email: 'nuevo@costamar.cl',
      password: 'password123',
      fullName: 'Nuevo Usuario',
      role: 'hacker' as unknown as CreateUserDto['role'],
    } as CreateUserDto;

    await expect(service.create(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  // Crear con rol válido: resuelve role_id, crea en auth y asigna rol.
  it('crea un usuario con rol válido', async () => {
    const createUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'uuid-123' } },
      error: null,
    });

    const supabase = {
      client: {
        from: (table: string) => {
          if (table === 'roles') {
            return {
              select: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({ data: { id: 2 }, error: null }),
                }),
              }),
            };
          }
          // user_roles / profiles
          return {
            upsert: () => Promise.resolve({ error: null }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
        },
        auth: { admin: { createUser } },
      },
    } as unknown as SupabaseService;

    const service = new UsersService(supabase);
    const result = await service.create({
      email: 'admin@costamar.cl',
      password: 'password123',
      fullName: 'Admin Costa Mar',
      role: 'admin',
    });

    expect(createUser).toHaveBeenCalled();
    expect(result.id).toBe('uuid-123');
    expect(result.role).toBe('admin');
  });
});
