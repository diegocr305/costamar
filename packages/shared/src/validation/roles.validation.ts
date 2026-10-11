import { ROLES, type UserRole } from '../constants/roles';

/**
 * Verifica si un valor arbitrario corresponde a un rol válido del sistema.
 * Usado al asignar roles a usuarios: un rol fuera del conjunto definido
 * debe rechazarse.
 */
export function isValidRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
