import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from './supabase.constants';

/**
 * Servicio de acceso al cliente Supabase (service_role).
 * Encapsula el cliente para facilitar su uso e inyección en otros módulos.
 */
@Injectable()
export class SupabaseService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /** Devuelve el cliente Supabase con privilegios service_role */
  get client(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Verifica la conectividad con Supabase ejecutando una consulta mínima.
   * Usado por el health endpoint.
   */
  async checkConnection(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('roles')
        .select('id')
        .limit(1);
      // Un error de "relación no existe" aún indica que la conexión funciona.
      // Solo fallos de red/credenciales se consideran desconexión.
      if (error && error.code === 'PGRST301') {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}
