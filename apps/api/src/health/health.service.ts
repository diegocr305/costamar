import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { HealthResponse } from './health.types';

@Injectable()
export class HealthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Construye el estado de salud verificando la conectividad real con
   * Supabase. El estado global refleja fielmente la conexión:
   * - 'ok' cuando Supabase responde.
   * - 'degraded' cuando Supabase no está disponible.
   */
  async check(): Promise<HealthResponse> {
    const supabaseUp = await this.supabase.checkConnection();

    return {
      status: supabaseUp ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: this.config.get<string>('APP_VERSION') ?? '1.0.0',
      components: {
        supabase: supabaseUp
          ? { status: 'up' }
          : { status: 'down', detail: 'No se pudo conectar con Supabase' },
      },
    };
  }
}
