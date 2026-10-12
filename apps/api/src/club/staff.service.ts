import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { RedeemDto } from './dto/redeem.dto';
import type { RedemptionHistoryDto } from './dto/redemption-history.dto';

@Injectable()
export class ClubStaffService {
  constructor(private readonly supabase: SupabaseService) {}

  async recentRedemptions(tableLabel?: string) {
    const raw = tableLabel?.trim().replace(/\s+/g, ' ');
    const table = raw && /^\d+$/.test(raw) ? `Mesa ${raw}` : raw;
    const { data, error } = await this.supabase.client.rpc('club_recent_redemptions', { p_table_label: table || null });
    if (error) throw new BadRequestException('No pudimos cargar los últimos canjes. Inténtalo de nuevo.');
    return data;
  }

  async redemptionHistory(filters: RedemptionHistoryDto) {
    const { data, error } = await this.supabase.client.rpc(filters.campaignId ? 'club_staff_redemption_history_filtered' : 'club_staff_redemption_history', {
      p_date: filters.date ?? null,
      p_query: filters.q?.trim() || null,
      p_page: filters.page,
      p_page_size: filters.pageSize,
      ...(filters.campaignId ? { p_campaign_id: filters.campaignId } : {}),
    });
    if (error) throw new BadRequestException('No pudimos cargar el historial de canjes. Inténtalo de nuevo.');
    return data;
  }

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

    const { data: coupons, error: couponError } = await this.supabase.client
      .from('club_coupons')
      .select(
        'code, status, expires_at, club_campaigns(name, type, club_campaign_products(product_id, role, products(name, is_available)))',
      )
      .eq('user_id', member.user_id)
      .order('issued_at', { ascending: false });
    if (couponError) throw new BadRequestException('No pudimos consultar los cupones del socio. Inténtalo de nuevo.');

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
          status: c.status === 'issued' && c.expires_at && new Date(c.expires_at).getTime() <= Date.now() ? 'expired' : c.status,
          expiresAt: c.expires_at ?? null,
          campaignName: (camp?.['name'] as string) ?? '',
          campaignType: camp?.['type'] as string,
          allowedProducts: ((camp?.['club_campaign_products'] ?? []) as { product_id: string; role: string; products: { name: string; is_available: boolean } | null }[]).map(p => ({
            productId: p.product_id, role: p.role, name: p.products?.name ?? '', isAvailable: p.products?.is_available ?? false,
          })),
        };
      }),
    };
  }

  /** Canje transaccional (evita doble canje). Registra al funcionario. */
  async redeem(staffUserId: string, dto: RedeemDto) {
    const structured = dto.tableLabel !== undefined || dto.orderRef !== undefined || dto.note !== undefined;
    let table = dto.tableLabel?.trim().replace(/\s+/g, ' ');
    if (table && /^\d+$/.test(table)) table = `Mesa ${table}`;
    if (structured && (!table || table.length > 40)) throw new BadRequestException('Indica la mesa (hasta 40 caracteres) para registrar el canje.');
    if (!structured && !dto.consumptionRef?.trim()) {
      throw new BadRequestException('Indica la mesa, pedido o boleta para dejar registro del canje.');
    }
    const { data, error } = await this.supabase.client.rpc(structured ? 'redeem_coupon_at_table' : 'redeem_coupon', {
      p_code: dto.code,
      p_staff_user_id: staffUserId,
      p_products: dto.products ?? [],
      ...(structured ? { p_table_label: table, p_order_ref: dto.orderRef?.trim() || null, p_note: dto.note?.trim() || null }
        : { p_consumption_ref: dto.consumptionRef!.trim() }),
    });
    if (error) {
      const map: Record<string, string> = {
        COUPON_NOT_FOUND: 'Cupón no encontrado.',
        ALREADY_REDEEMED: 'Este cupón ya fue canjeado.',
        COUPON_NOT_REDEEMABLE: 'El cupón no está disponible para canje.',
        COUPON_EXPIRED: 'El cupón está vencido.',
        MEMBER_NOT_ACTIVE: 'La membresía del socio no está activa.',
        STAFF_NOT_AUTHORIZED: 'Tu cuenta no está autorizada para confirmar canjes.',
        CONSUMPTION_REQUIRED: 'Indica la mesa, pedido o boleta para registrar el canje.',
        TABLE_REQUIRED: 'Indica la mesa para registrar el canje.',
        REDEMPTION_DETAILS_INVALID: 'Revisa la mesa y las referencias: alguno de los campos es demasiado largo.',
        CAMPAIGN_PRODUCTS_INVALID: 'Selecciona un producto permitido y disponible para cada parte del regalo.',
      };
      throw new BadRequestException(map[error.message] ?? error.message);
    }
    return { redeemed: true, redemption: data };
  }
}
