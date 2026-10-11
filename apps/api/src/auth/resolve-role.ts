import { ROLES, type UserRole } from '@costamar/shared';
import type { SupabaseJwtPayload } from './auth.types';

/**
 * Resuelve el rol de aplicación desde los claims del JWT, sin consultar la BD.
 * Nunca escala privilegios: un rol ausente o inválido cae a 'customer'.
 */
export function resolveRoleFromClaims(payload: SupabaseJwtPayload): UserRole {
  const role = payload.app_metadata?.role;
  return role && ROLES.includes(role) ? role : 'customer';
}
