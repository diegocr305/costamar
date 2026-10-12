import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ClubStaffService } from './staff.service';
import { RedemptionHistoryDto } from './dto/redemption-history.dto';
import type { SupabaseService } from '../supabase/supabase.service';

describe('canjes del personal', () => {
  function setup() {
    const rpc = jest.fn().mockResolvedValue({ data: { items: [], total: 0 }, error: null });
    return { rpc, staff: new ClubStaffService({ client: { rpc } } as unknown as SupabaseService) };
  }
  it('no confirma un canje sin referencia de consumo', async () => {
    const { rpc, staff } = setup();
    await expect(staff.redeem('staff-del-token', { code: 'FND-TEST', consumptionRef: '  ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('registra la referencia y al funcionario autenticado', async () => {
    const { rpc, staff } = setup();
    await staff.redeem('staff-del-token', { code: 'FND-TEST', consumptionRef: ' Mesa 5 ' });
    expect(rpc).toHaveBeenCalledWith('redeem_coupon', expect.objectContaining({ p_staff_user_id: 'staff-del-token', p_consumption_ref: 'Mesa 5' }));
  });
  it('registra solo mesa cuando no se agregan referencias opcionales', async () => {
    const { rpc, staff } = setup();
    await staff.redeem('staff-del-token', { code: 'FND-TEST', tableLabel: ' 5 ' });
    expect(rpc).toHaveBeenCalledWith('redeem_coupon_at_table', expect.objectContaining({ p_staff_user_id: 'staff-del-token', p_table_label: 'Mesa 5', p_order_ref: null, p_note: null }));
  });
  it('rechaza mesa vacía aunque exista boleta u observación', async () => {
    const { rpc, staff } = setup();
    await expect(staff.redeem('staff', { code: 'FND-TEST', tableLabel: ' ', orderRef: 'Boleta 123' })).rejects.toBeInstanceOf(BadRequestException);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('guarda pedido y observación por separado', async () => {
    const { rpc, staff } = setup();
    await staff.redeem('staff', { code: 'FND-TEST', tableLabel: 'Mesa 5', orderRef: ' Boleta 123 ', note: ' Entregado ' });
    expect(rpc).toHaveBeenCalledWith('redeem_coupon_at_table', expect.objectContaining({ p_order_ref: 'Boleta 123', p_note: 'Entregado' }));
  });
  it('buscar mesa 5 no envía una búsqueda genérica que coincida con mesa 50', async () => {
    const { rpc, staff } = setup();
    await staff.recentRedemptions('5');
    expect(rpc).toHaveBeenCalledWith('club_recent_redemptions', { p_table_label: 'Mesa 5' });
  });
  it('envía filtros y paginación al historial sin exponer errores internos', async () => {
    const { rpc, staff } = setup();
    await staff.redemptionHistory({ date: '2026-10-12', q: ' Mesa 5 ', page: 2, pageSize: 20 });
    expect(rpc).toHaveBeenCalledWith('club_staff_redemption_history', { p_date: '2026-10-12', p_query: 'Mesa 5', p_page: 2, p_page_size: 20 });
    rpc.mockResolvedValueOnce({ error: { message: 'internal schema details' } });
    await expect(staff.redemptionHistory({ page: 1, pageSize: 20 })).rejects.toThrow('No pudimos cargar el historial');
  });
  it('rechaza fechas inválidas y tamaños de página sin límite', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
    const metadata = { type: 'query' as const, metatype: RedemptionHistoryDto };
    await expect(pipe.transform({ date: '2026-02-31' }, metadata)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ pageSize: '99999' }, metadata)).rejects.toBeInstanceOf(BadRequestException);
    const valid = await pipe.transform({ page: '2', date: '2026-10-12' }, metadata);
    expect(valid.page).toBe(2); expect(valid.pageSize).toBe(20);
  });
});
