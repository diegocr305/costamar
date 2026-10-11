import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { SUPABASE_CLIENT } from './supabase.constants';
import { SupabaseService } from './supabase.service';

/**
 * Módulo global que provee un cliente Supabase con la clave service_role.
 *
 * IMPORTANTE: la clave service_role bypasea RLS y tiene acceso total.
 * Se lee EXCLUSIVAMENTE desde variables de entorno y NUNCA debe exponerse
 * a ningún cliente frontend. Este cliente vive solo en el backend.
 */
@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SupabaseClient => {
        const url = config.get<string>('SUPABASE_URL');
        const serviceRoleKey = config.get<string>(
          'SUPABASE_SERVICE_ROLE_KEY',
        );

        if (!url || !serviceRoleKey) {
          throw new Error(
            'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno',
          );
        }

        return createClient(url, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
          realtime: {
            // Node 20 no trae WebSocket nativo (llegó en Node 22).
            // El backend no usa Realtime, pero supabase-js inicializa el
            // cliente igual; proveemos 'ws' para evitar el fallo de arranque.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            transport: WebSocket as any,
          },
        });
      },
    },
    SupabaseService,
  ],
  exports: [SUPABASE_CLIENT, SupabaseService],
})
export class SupabaseModule {}
