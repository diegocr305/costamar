import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CampaignAdmin } from '@costamar/shared';
import type { CampaignCouponsQueryDto, CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

@Injectable()
export class ClubAdminService {
  constructor(private readonly supabase: SupabaseService) {}
  private fail(error: { message: string; code?: string }): never {
    const messages: Record<string, string> = {
      CAMPAIGN_NOT_FOUND: 'Campaña no encontrada.', CAMPAIGN_ADMIN_REQUIRED: 'Tu cuenta no puede modificar campañas.',
      CAMPAIGN_DATES_INVALID: 'La fecha de término debe ser posterior al inicio.',
      CAMPAIGN_LIMIT_TOO_LOW: 'El límite no puede ser menor que los cupones ya emitidos.',
      BIRTHDAY_UNLIMITED: 'Cumpleaños es un beneficio general: no admite límite de cupos ni vigencia por días.',
      PROMOTION_NEEDS_LIMIT_AND_END: 'Para activar una promoción, define sus cupos y fecha de término.',
      CAMPAIGN_PRODUCTS_INVALID: 'Revisa los productos seleccionados: deben existir y no repetirse para la misma función.',
      CAMPAIGN_BENEFIT_REQUIRED: 'Describe el regalo que recibirá el socio.',
    };
    if (error.message === 'CAMPAIGN_NOT_FOUND') throw new NotFoundException(messages[error.message]);
    if (error.message === 'CAMPAIGN_ADMIN_REQUIRED') throw new ForbiddenException(messages[error.message]);
    if (error.code === '23505') throw new ConflictException('Ya existe una campaña con ese identificador.');
    throw new BadRequestException(messages[error.message] ?? 'No pudimos guardar la campaña. Revisa los campos e inténtalo de nuevo.');
  }
  async listCampaigns(): Promise<CampaignAdmin[]> {
    const { data, error } = await this.supabase.client.rpc('club_admin_campaigns');
    if (error) throw new BadRequestException('No pudimos cargar las campañas. Inténtalo de nuevo.');
    return data ?? [];
  }
  async products(id: string) {
    const campaign = (await this.listCampaigns()).find(c => c.id === id);
    if (!campaign) throw new NotFoundException('Campaña no encontrada.');
    return campaign.products;
  }
  async saveCampaign(actor: string, id: string | null, dto: CreateCampaignDto | UpdateCampaignDto) {
    const { data, error } = await this.supabase.client.rpc('club_admin_save_campaign', { p_actor: actor, p_id: id, p_input: dto });
    if (error) this.fail(error);
    return data;
  }
  async coupons(id: string, filters: CampaignCouponsQueryDto) {
    const { data, error } = await this.supabase.client.rpc('club_admin_campaign_coupons', {
      p_campaign_id: id, p_status: filters.status ?? null, p_query: filters.q?.trim() || null, p_page: filters.page, p_page_size: filters.pageSize,
    });
    if (error) this.fail(error);
    return data;
  }
}
