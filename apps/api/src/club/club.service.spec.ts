import { BadRequestException } from '@nestjs/common';
import { ClubService } from './club.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { EnrollDto } from './dto/enroll.dto';

/**
 * Mock mínimo de Supabase para el ClubService.
 * `existingMember` controla si club_members ya tiene fila para el usuario.
 * Registra los insert para verificar idempotencia.
 */
function buildSupabaseMock(existingMember: boolean) {
  const inserts: Record<string, unknown[]> = {};

  const client = {
    from(table: string) {
      const record = (row: unknown) => {
        inserts[table] = inserts[table] ?? [];
        inserts[table].push(row);
      };

      return {
        select: () => ({
          eq: () => ({
            // getMe / lookups con maybeSingle
            maybeSingle: () =>
              Promise.resolve({
                data:
                  table === 'club_members' && existingMember
                    ? {
                        user_id: 'u1',
                        member_code: 'CM-EXIST',
                        full_name: 'Previo',
                        phone: null,
                        status: 'active',
                        level: 'bronce',
                        enrolled_at: 'now',
                        updated_at: 'now',
                      }
                    : null,
                error: null,
              }),
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        insert: (row: unknown) => {
          record(row);
          return Promise.resolve({ error: null });
        },
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
        upsert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: { marketing_email: false, marketing_whatsapp: false },
                error: null,
              }),
          }),
        }),
      };
    },
  };

  return {
    service: { client } as unknown as SupabaseService,
    inserts,
  };
}

const validDto: EnrollDto = {
  fullName: 'Juan Pérez',
  phone: '+56 9 1234 5678',
  birthDate: '1990-05-20',
  acceptTerms: true,
  acceptPrivacy: true,
};

describe('ClubService.enroll', () => {
  it('rechaza el alta si no se aceptan términos y privacidad', async () => {
    const { service } = buildSupabaseMock(false);
    const club = new ClubService(service);

    await expect(
      club.enroll('u1', 'u1@mail.com', {
        ...validDto,
        acceptTerms: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza el alta de un menor de 18 años', async () => {
    const { service } = buildSupabaseMock(false);
    const club = new ClubService(service);
    const minorYear = new Date().getFullYear() - 15;

    await expect(
      club.enroll('u1', 'u1@mail.com', {
        ...validDto,
        birthDate: `${minorYear}-01-01`,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza una fecha de nacimiento inválida', async () => {
    const { service } = buildSupabaseMock(false);
    const club = new ClubService(service);

    await expect(
      club.enroll('u1', 'u1@mail.com', {
        ...validDto,
        birthDate: 'no-es-fecha',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crea el socio una sola vez cuando no existe (alta nueva)', async () => {
    const { service, inserts } = buildSupabaseMock(false);
    const club = new ClubService(service);

    await club.enroll('u1', 'u1@mail.com', validDto);

    // Debe insertar exactamente una fila en club_members.
    expect((inserts['club_members'] ?? []).length).toBe(1);
  });

  it('es idempotente: si el socio ya existe no inserta otra fila', async () => {
    const { service, inserts } = buildSupabaseMock(true);
    const club = new ClubService(service);

    await club.enroll('u1', 'u1@mail.com', validDto);

    // No debe haber inserts en club_members (solo update).
    expect(inserts['club_members']).toBeUndefined();
  });
});
