import { BadRequestException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';

/** Servicio cuyo RPC siempre falla con el código indicado. */
const failing = (message: string) =>
  new ReservationsService({ client: { rpc: async () => ({ data: null, error: { message } }) } } as never);

const booking = { requestId: 'r', accessToken: 'a'.repeat(64), customerName: 'Ana' } as never;

describe('Mensajes de error de reservas', () => {
  it('al equipo le dice qué hacer cuando la solicitud tiene fecha pasada', async () => {
    const error = await failing('RESERVATION_ADVANCE').update('staff', 'id', { status: 'confirmed' } as never).catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toMatch(/ya pasó/);
    expect(error.message).toMatch(/cancélala/);
  });

  it('al cliente le mantiene el mensaje público de anticipación', async () => {
    const error = await failing('RESERVATION_ADVANCE').create(null, false, booking).catch((e) => e);
    expect(error.message).toMatch(/anticipación mínima/);
    expect(error.message).not.toMatch(/ya pasó/);
  });

  it('la carga manual del equipo también recibe el mensaje del equipo', async () => {
    const error = await failing('RESERVATION_HOURS').create('staff', true, booking).catch((e) => e);
    expect(error.message).toMatch(/horario de atención configurado/);
  });

  it('el cliente no ve el texto del equipo para horarios', async () => {
    const error = await failing('RESERVATION_HOURS').create(null, false, booking).catch((e) => e);
    expect(error.message).toMatch(/Elige una hora dentro del horario/);
  });
});
