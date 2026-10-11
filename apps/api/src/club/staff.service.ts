import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { RedeemDto } from './dto/redeem.dto';

@Injectable()
export class ClubStaffService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Datos mínimos del socio para validación presencial + sus cupones
   * reclamables. No expone información personal innecesaria.
   */
  async lookupByMemberCode(memberCode: string) {
    const { data: member, error } = await this.supabase.client
      .from('club_members')
      .select('user_id, member_code, full_name, status, level')
      .eq('member_code', memberCode)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!member) throw new NotFoundException('Socio no encontrado');

    const { data: coupons } = await this.supabase.client
      .from('club_coupons')
      .select(
        'code, status, expires_at, club_campaigns(name, type)',
      )
      .eq('user_id', member.user_id)
      .order('issued_at', { ascending: false });

    return {
      member: {
        memberCode: member.member_code,
        fullName: member.full_name,
        status: member.status,
        level: member.level,
      },
      coupons: (coupons ?? []).map((c) => {
        const camp = (c as Record<string, unknown>)['club_campaigns'] as
          | Record<string, unknown>
          | null;
        return {
          code: c.code,
          status: c.status,
          expiresAt: c.expires_at ?? null,
          campaignName: (camp?.['name'] as string) ?? '',
          campaignType: camp?.['type'] as string,
        };
      }),
    };
  }

  /** Canje transaccional (evita doble canje). Registra al funcionario. */
  async redeem(staffUserId: string, dto: RedeemDto) {
    const { data, error } = await this.supabase.client.rpc('redeem_coupon', {
      p_code: dto.code,
      p_staff_user_id: staffUserId,
      p_products: dto.products ?? [],
      p_consumption_ref: dto.consumptionRef ?? null,
    });
    if (error) {
      const map: Record<string, string> = {
        COUPON_NOT_FOUND: 'Cupón no encontrado.',
        ALREADY_REDEEMED: 'Este cupón ya fue canjeado.',
        COUPON_NOT_REDEEMABLE: 'El cupón no está disponible para canje.',
        COUPON_EXPIRED: 'El cupón está vencido.',
      };
      throw new BadRequestException(map[error.message] ?? error.message);
    }
    return { redeemed: true, redemption: data };
  }
}
