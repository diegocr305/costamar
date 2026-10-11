import * as fc from 'fast-check';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import type { SupabaseService } from '../supabase/supabase.service';

function buildService(connectionUp: boolean): HealthService {
  const supabase = {
    checkConnection: () => Promise.resolve(connectionUp),
  } as unknown as SupabaseService;
  const config = {
    get: (key: string) => (key === 'APP_VERSION' ? '1.0.0' : undefined),
  } as unknown as ConfigService;
  return new HealthService(supabase, config);
}

describe('HealthService', () => {
  // Feature: costamar-platform, Propiedad 11: Health refleja estado real de Supabase
  // Para cualquier estado de conexión, el status global debe ser coherente:
  // conexión up => 'ok'; conexión down => 'degraded'. Nunca inconsistente.
  it('refleja fielmente el estado de la conexión a Supabase', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (connectionUp) => {
        const service = buildService(connectionUp);
        const result = await service.check();

        if (connectionUp) {
          expect(result.status).toBe('ok');
          expect(result.components.supabase.status).toBe('up');
        } else {
          expect(result.status).toBe('degraded');
          expect(result.components.supabase.status).toBe('down');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('incluye timestamp y version en la respuesta', async () => {
    const service = buildService(true);
    const result = await service.check();
    expect(result.version).toBe('1.0.0');
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});
