import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  ClubConsent,
  ClubMember,
  ClubMeResponse,
  ClubMemberPreferences,
} from '@costamar/shared';
import { CLUB_PRIVACY_VERSION, CLUB_TERMS_VERSION } from '@costamar/shared';
import { SupabaseService } from '../supabase/supabase.service';
import type { EnrollDto } from './dto/enroll.dto';
import type { UpdatePreferencesDto } from './dto/preferences.dto';

@Injectable()
export class ClubService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Genera un código público de socio, p. ej. "CM-7F3A2B". No es credencial. */
  private generateMemberCode(): string {
    const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `CM-${rnd}`;
  }

  private mapMember(row: Record<string, unknown>): ClubMember {
    return {
      userId: row['user_id'] as string,
      memberCode: row['member_code'] as string,
      fullName: row['full_name'] as string,
      phone: (row['phone'] as string | null) ?? undefined,
      status: row['status'] as ClubMember['status'],
      level: row['level'] as ClubMember['level'],
      enrolledAt: row['enrolled_at'] as string,
      updatedAt: row['updated_at'] as string,
    };
  }

  private mapPreferences(
    row: Record<string, unknown> | null,
  ): ClubMemberPreferences | null {
    if (!row) return null;
    return {
      marketingEmail: Boolean(row['marketing_email']),
      marketingWhatsapp: Boolean(row['marketing_whatsapp']),
    };
  }

  /** Membresía del usuario autenticado (null si aún no es socio). */
  async getMe(userId: string): Promise<ClubMeResponse> {
    const { data: member, error } = await this.supabase.client
      .from('club_members')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);

    if (!member) {
      return { member: null, preferences: null };
    }

    const { data: prefs } = await this.supabase.client
      .from('club_member_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    return {
      member: this.mapMember(member),
      preferences: this.mapPreferences(prefs),
    };
  }

  /**
   * Alta idempotente del socio. Si ya existe, actualiza nombre/teléfono y
   * devuelve la membresía existente (no duplica, no cambia el member_code).
   * Registra consentimientos versionados y evento de auditoría.
   */
  async enroll(
    userId: string,
    email: string,
    dto: EnrollDto,
  ): Promise<ClubMeResponse> {
    if (!dto.acceptTerms || !dto.acceptPrivacy) {
      throw new BadRequestException(
        'Debes aceptar los términos y la política de privacidad.',
      );
    }

    const now = new Date().toISOString();

    // 1) Upsert idempotente del socio (clave: user_id).
    const { data: existing } = await this.supabase.client
      .from('club_members')
      .select('user_id, member_code')
      .eq('user_id', userId)
      .maybeSingle();

    let isNew = false;
    if (existing) {
      const { error } = await this.supabase.client
        .from('club_members')
        .update({
          full_name: dto.fullName,
          phone: dto.phone ?? null,
          updated_at: now,
        })
        .eq('user_id', userId);
      if (error) throw new BadRequestException(error.message);
    } else {
      isNew = true;
      const { error } = await this.supabase.client
        .from('club_members')
        .insert({
          user_id: userId,
          member_code: this.generateMemberCode(),
          full_name: dto.fullName,
          phone: dto.phone ?? null,
        });
      if (error) throw new BadRequestException(error.message);
    }

    // 2) Preferencias (marketing opcional e independiente).
    await this.supabase.client.from('club_member_preferences').upsert(
      {
        user_id: userId,
        marketing_email: dto.marketingEmail ?? false,
        marketing_whatsapp: dto.marketingWhatsapp ?? false,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    );

    // 3) Consentimientos versionados (idempotentes por user+type+version).
    const consents = [
      { type: 'terms', version: CLUB_TERMS_VERSION, granted: true },
      { type: 'privacy', version: CLUB_PRIVACY_VERSION, granted: true },
      {
        type: 'marketing',
        version: CLUB_TERMS_VERSION,
        granted: Boolean(dto.marketingEmail || dto.marketingWhatsapp),
      },
    ];
    for (const c of consents) {
      await this.supabase.client.from('club_consents').upsert(
        {
          user_id: userId,
          type: c.type,
          version: c.version,
          granted: c.granted,
          granted_at: now,
        },
        { onConflict: 'user_id,type,version' },
      );
    }

    // 4) Auditoría.
    await this.supabase.client.from('club_auth_events').insert({
      user_id: userId,
      event: isNew ? 'enroll' : 'profile_update',
      meta: { email },
    });

    return this.getMe(userId);
  }

  /** Actualiza preferencias de comunicaciones del socio. */
  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<ClubMemberPreferences> {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updated_at: now, user_id: userId };
    if (dto.marketingEmail !== undefined) patch['marketing_email'] = dto.marketingEmail;
    if (dto.marketingWhatsapp !== undefined)
      patch['marketing_whatsapp'] = dto.marketingWhatsapp;

    const { data, error } = await this.supabase.client
      .from('club_member_preferences')
      .upsert(patch, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);

    return this.mapPreferences(data) as ClubMemberPreferences;
  }

  /** Consentimientos del socio (auditoría visible para el propio usuario). */
  async getConsents(userId: string): Promise<ClubConsent[]> {
    const { data, error } = await this.supabase.client
      .from('club_consents')
      .select('type, version, granted, granted_at')
      .eq('user_id', userId)
      .order('granted_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((c) => ({
      type: c.type,
      version: c.version,
      granted: c.granted,
      grantedAt: c.granted_at,
    }));
  }

  /** Registra un evento de login para auditoría (llamado tras autenticarse). */
  async recordLogin(userId: string): Promise<void> {
    await this.supabase.client
      .from('club_auth_events')
      .insert({ user_id: userId, event: 'login' });
  }
}
