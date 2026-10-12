import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  ClubConsent,
  ClubMember,
  ClubMeResponse,
  ClubMemberPreferences,
} from '@costamar/shared';
import {
  CLUB_MIN_AGE,
  CLUB_PRIVACY_VERSION,
  CLUB_TERMS_VERSION,
  isAdult,
  parseIsoDate,
} from '@costamar/shared';
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

  /** Normaliza el teléfono: deja un '+' inicial opcional y solo dígitos. */
  private normalizePhone(phone: string): string {
    const trimmed = phone.trim();
    const plus = trimmed.startsWith('+') ? '+' : '';
    return plus + trimmed.replace(/[^0-9]/g, '');
  }

  private mapMember(row: Record<string, unknown>): ClubMember {
    return {
      userId: row['user_id'] as string,
      memberCode: row['member_code'] as string,
      fullName: row['full_name'] as string,
      phone: (row['phone'] as string | null) ?? undefined,
      birthDate: (row['birth_date'] as string | null) ?? undefined,
      phoneVerified: Boolean(row['phone_verified']),
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

    // Validación de fecha de nacimiento y mayoría de edad (backend, TZ Chile).
    if (!parseIsoDate(dto.birthDate)) {
      throw new BadRequestException('Fecha de nacimiento inválida.');
    }
    if (!isAdult(dto.birthDate)) {
      throw new BadRequestException(
        `Debes tener al menos ${CLUB_MIN_AGE} años para unirte al Club.`,
      );
    }

    const phone = this.normalizePhone(dto.phone);
    const now = new Date().toISOString();

    // 1) Upsert idempotente del socio (clave: user_id).
    // NO se toca enrolled_at en update: preserva la antigüedad histórica.
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
          phone,
          birth_date: dto.birthDate,
          updated_at: now,
        })
        .eq('user_id', userId);
      if (error) throw new BadRequestException(error.message.includes('BIRTH_DATE_LOCKED')
        ? 'Tu fecha de nacimiento ya está asociada a un beneficio. Contacta al restaurante para corregirla.'
        : error.message);
    } else {
      isNew = true;
      const { error } = await this.supabase.client
        .from('club_members')
        .insert({
          user_id: userId,
          member_code: this.generateMemberCode(),
          full_name: dto.fullName,
          phone,
          birth_date: dto.birthDate,
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

  // ---------- Campañas (lectura pública de activas) ----------

  /** Lista las campañas activas para mostrar en la PWA. */
  async listActiveCampaigns() {
    const { data, error } = await this.supabase.client
      .from('club_campaigns')
      .select('id, slug, name, description, image_path, type, status, starts_at, ends_at, max_coupons, rules')
      .eq('status', 'active')
      .order('created_at', { ascending: true });
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description ?? undefined,
      imagePath: c.image_path ?? undefined,
      type: c.type,
      status: c.status,
      startsAt: c.starts_at ?? undefined,
      endsAt: c.ends_at ?? undefined,
      maxCoupons: c.max_coupons ?? null,
      rules: c.rules ?? {},
    }));
  }

  /**
   * Reclama el cupón de fundador para el socio autenticado.
   * Valida elegibilidad (socio activo, perfil completo, mayor de edad) y
   * delega la emisión a la función transaccional issue_founder_coupon,
   * que respeta el tope de cupos y es idempotente.
   */
  async claimFounderCoupon(userId: string) {
    const { data: member, error } = await this.supabase.client
      .from('club_members')
      .select('status, full_name, phone, birth_date')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!member) {
      throw new BadRequestException('Debes completar tu perfil primero.');
    }
    if (member.status !== 'active') {
      throw new BadRequestException('Tu membresía no está activa.');
    }
    if (!member.full_name || !member.phone || !member.birth_date) {
      throw new BadRequestException('Completa tu perfil para reclamar el beneficio.');
    }
    if (!isAdult(member.birth_date as string)) {
      throw new BadRequestException(
        `Debes tener al menos ${CLUB_MIN_AGE} años.`,
      );
    }

    const { data, error: rpcError } = await this.supabase.client.rpc(
      'issue_founder_coupon',
      { p_user_id: userId },
    );
    if (rpcError) {
      const map: Record<string, string> = {
        CAMPAIGN_NOT_FOUND: 'La campaña no existe.',
        CAMPAIGN_NOT_ACTIVE: 'La campaña no está activa en este momento.',
        NO_COUPONS_LEFT: 'Se agotaron los cupos de fundadores.',
      };
      const msg = map[rpcError.message] ?? rpcError.message;
      throw new BadRequestException(msg);
    }
    return data;
  }

  // ---------- Cupones del socio (solo lectura en Fase 1) ----------

  /** Cupones del socio autenticado, con datos de su campaña. */
  async getMyCoupons(userId: string) {
    // Recupera beneficios elegibles sin un paso manual para el socio.
    // La BD controla cupos, fechas, perfil y unicidad; el cron cubre a quienes no abren la app.
    const { error: benefitError } = await this.supabase.client.rpc('assign_club_benefits', { p_user_id: userId });
    if (benefitError) throw new BadRequestException('No pudimos actualizar tus beneficios. Inténtalo de nuevo.');
    const { data, error } = await this.supabase.client
      .from('club_coupons')
      .select(
        'id, code, campaign_id, status, issued_at, expires_at, redeemed_at, club_campaigns(name, description, image_path, type, slug)',
      )
      .eq('user_id', userId)
      .order('issued_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((c) => {
      const camp = (c as Record<string, unknown>)['club_campaigns'] as
        | Record<string, unknown>
        | null;
      return {
        id: c.id,
        code: c.code,
        campaignId: c.campaign_id,
        status: c.status === 'issued' && c.expires_at && new Date(c.expires_at).getTime() <= Date.now() ? 'expired' : c.status,
        issuedAt: c.issued_at,
        expiresAt: c.expires_at ?? null,
        redeemedAt: c.redeemed_at ?? null,
        campaign: {
          name: (camp?.['name'] as string) ?? '',
          description: (camp?.['description'] as string | null) ?? undefined,
          imagePath: (camp?.['image_path'] as string | null) ?? undefined,
          type: camp?.['type'] as string,
          slug: camp?.['slug'] as string,
        },
      };
    });
  }
}
