import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClubAdminService } from './admin.service';
import { ClubAdminController } from './admin.controller';
import { RolesGuard } from '../common/guards/roles.guard';
import type { SupabaseService } from '../supabase/supabase.service';
import { CampaignProductsDto, CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { chileLocalDateTime, chileLocalToIso } from '@costamar/shared';

describe('administración de campañas', () => {
  function setup(error: { message: string; code?: string } | null = null) {
    const rpc = jest.fn().mockResolvedValue({ data: { id: 'campaign' }, error });
    return { rpc, service: new ClubAdminService({ client: { rpc } } as unknown as SupabaseService) };
  }
  it('envía el actor del JWT y la edición a una operación atómica', async () => {
    const { rpc, service } = setup();
    await service.saveCampaign('actor-del-token', 'campaign-id', { maxCoupons: 50 });
    expect(rpc).toHaveBeenCalledWith('club_admin_save_campaign', { p_actor: 'actor-del-token', p_id: 'campaign-id', p_input: { maxCoupons: 50 } });
  });
  it.each([
    ['CAMPAIGN_NOT_FOUND', NotFoundException], ['CAMPAIGN_ADMIN_REQUIRED', ForbiddenException], ['BIRTHDAY_UNLIMITED', BadRequestException],
  ])('mapea %s sin exponer detalles de la BD', async (message, exception) => {
    const { service } = setup({ message });
    await expect(service.saveCampaign('actor', 'campaign', {})).rejects.toBeInstanceOf(exception);
  });
  it('explica el conflicto de identificadores', async () => {
    const { service } = setup({ message: 'raw database details', code: '23505' });
    await expect(service.saveCampaign('actor', null, { name: 'Promo', slug: 'promo-1' })).rejects.toBeInstanceOf(ConflictException);
  });
  it('rechaza nombres vacíos, cupos negativos, horarios sin zona y productos inválidos', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
    const create = { type: 'body' as const, metatype: CreateCampaignDto };
    const update = { type: 'body' as const, metatype: UpdateCampaignDto };
    await expect(pipe.transform({ slug: 'promo-1', benefit: 'Regalo' }, create)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ name: '  ', slug: 'promo-1' }, create)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ maxCoupons: -1 }, update)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ endsAt: '2026-10-31T23:59' }, update)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ products: [{ productId: 'invalid', role: 'drink' }] }, update)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({}, { type: 'body', metatype: CampaignProductsDto })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ products: [] }, update)).resolves.toMatchObject({ products: [] });
  });
  it('cajero y socio no pasan el guard de administración de campañas', () => {
    const guard = new RolesGuard(new Reflector());
    const context = (role: string) => ({ getHandler: () => ClubAdminController.prototype.campaigns, getClass: () => ClubAdminController, switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }) });
    for (const role of ['cashier', 'customer']) expect(() => guard.canActivate(context(role) as never)).toThrow(ForbiddenException);
    for (const role of ['manager', 'admin', 'superadmin']) expect(guard.canActivate(context(role) as never)).toBe(true);
  });
});

describe('horarios chilenos de campañas', () => {
  it('convierte verano e invierno sin depender de la zona del navegador', () => {
    expect(chileLocalToIso('2026-10-31T23:59')).toBe('2026-11-01T02:59:00.000Z');
    expect(chileLocalToIso('2026-06-01T12:00')).toBe('2026-06-01T16:00:00.000Z');
    expect(chileLocalDateTime('2026-11-01T02:59:00Z')).toBe('2026-10-31T23:59');
  });
  it('rechaza fechas inexistentes y horas saltadas por cambio de horario', () => {
    expect(chileLocalToIso('2026-02-31T12:00')).toBeNull();
    expect(chileLocalToIso('2026-09-06T00:30')).toBeNull();
  });
});

describe('historial de recordatorios', () => {
  it('pasa los filtros a la RPC de solo lectura y oculta errores de BD', async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: { items: [], total: 0 }, error: null }).mockResolvedValueOnce({ data: null, error: { message: 'raw' } });
    const service = new ClubAdminService({ client: { rpc } } as unknown as SupabaseService);
    await service.reminderHistory({ channel: 'email', status: 'failed', q: ' ana ', page: 2, pageSize: 20 });
    expect(rpc).toHaveBeenCalledWith('club_admin_reminder_history', { p_channel: 'email', p_status: 'failed', p_query: 'ana', p_page: 2, p_page_size: 20 });
    await expect(service.reminderHistory({ page: 1, pageSize: 20 })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('historial de correos de cumpleaños y bienvenida', () => {
  it('pasa los filtros a la RPC y oculta errores de BD', async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: { items: [], total: 0 }, error: null }).mockResolvedValueOnce({ data: null, error: { message: 'raw' } });
    const service = new ClubAdminService({ client: { rpc } } as unknown as SupabaseService);
    await service.memberEmailHistory({ kind: 'welcome', status: 'sent', q: '  cm-  ', page: 1, pageSize: 20 });
    expect(rpc).toHaveBeenCalledWith('club_admin_member_email_history', { p_kind: 'welcome', p_status: 'sent', p_query: 'cm-', p_page: 1, p_page_size: 20 });
    await expect(service.memberEmailHistory({ page: 1, pageSize: 20 })).rejects.toBeInstanceOf(BadRequestException);
  });
});
