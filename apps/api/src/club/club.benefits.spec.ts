import { BadRequestException } from '@nestjs/common';
import { ClubService } from './club.service';
import type { SupabaseService } from '../supabase/supabase.service';

describe('beneficios automáticos del socio', () => {
  function setup(error: unknown = null) {
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    const from = jest.fn(() => ({ select: () => ({ eq: () => ({ order }) }) }));
    const rpc = jest.fn().mockResolvedValue({ error });
    return { club: new ClubService({ client: { rpc, from } } as unknown as SupabaseService), rpc, from };
  }
  it('usa la identidad del socio para asignar antes de devolver sus cupones', async () => {
    const { club, rpc, from } = setup();
    await expect(club.getMyCoupons('socio-autenticado')).resolves.toEqual([]);
    expect(rpc).toHaveBeenCalledWith('assign_club_benefits', { p_user_id: 'socio-autenticado' });
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(from.mock.invocationCallOrder[0]);
  });
  it('no presenta una lista vacía como éxito si falla la asignación', async () => {
    const { club, from } = setup({ message: 'database unavailable' });
    await expect(club.getMyCoupons('socio')).rejects.toBeInstanceOf(BadRequestException);
    expect(from).not.toHaveBeenCalled();
  });
});
