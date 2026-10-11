import type { UserRole } from '@costamar/shared';

/**
 * Usuario autenticado que la JwtStrategy adjunta a request.user.
 * El rol se extrae de los claims del JWT, sin consultar la base de datos.
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Payload del JWT emitido por Supabase Auth.
 * El rol de la aplicación se guarda en app_metadata.role.
 */
export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  role?: string; // rol de Supabase (authenticated), no el rol de la app
  app_metadata?: {
    role?: UserRole;
  };
  user_metadata?: Record<string, unknown>;
  aud?: string;
  exp: number;
  iat: number;
}
