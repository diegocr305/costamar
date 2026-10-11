import * as fc from 'fast-check';
import { ROLES, type UserRole } from '@costamar/shared';
import { resolveRoleFromClaims } from './resolve-role';
import type { SupabaseJwtPayload } from './auth.types';

function basePayload(role?: string): SupabaseJwtPayload {
  return {
    sub: 'user-uuid',
    email: 'user@example.com',
    aud: 'authenticated',
    app_metadata: role ? { role: role as UserRole } : {},
    iat: 1000,
    exp: 2000,
  };
}

describe('resolveRoleFromClaims (extracción de rol desde JWT)', () => {
  // Feature: costamar-platform, Propiedad 2: Extracción de rol sin consulta a BD
  // Para cualquier payload JWT, el rol se deriva ÚNICAMENTE de los claims,
  // sin tocar la base de datos (la función es pura y síncrona).
  it('extrae el rol de app_metadata para cualquier rol válido', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ROLES), (role: UserRole) => {
        expect(resolveRoleFromClaims(basePayload(role))).toBe(role);
      }),
      { numRuns: 100 },
    );
  });

  // Un rol ausente o no reconocido nunca escala privilegios: cae a 'customer'.
  it('usa customer cuando el rol es inválido o ausente', () => {
    const validRoles = new Set<string>(ROLES);
    fc.assert(
      fc.property(fc.option(fc.string(), { nil: undefined }), (maybeRole) => {
        const result = resolveRoleFromClaims(basePayload(maybeRole ?? undefined));
        if (maybeRole && validRoles.has(maybeRole)) {
          expect(result).toBe(maybeRole);
        } else {
          expect(result).toBe('customer');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('es una función pura sin dependencia de base de datos', () => {
    expect(resolveRoleFromClaims(basePayload('admin'))).toBe('admin');
    expect(resolveRoleFromClaims(basePayload('superadmin'))).toBe('superadmin');
  });
});
