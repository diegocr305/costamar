import * as fc from 'fast-check';
import { isValidRole, ROLES, type UserRole } from '@costamar/shared';

describe('Validación de roles', () => {
  // Feature: costamar-platform, Propiedad 1: Validación de roles
  // Para cualquier string que NO esté en el conjunto exacto de roles,
  // isValidRole debe devolver false (la asignación se rechazaría con 400).
  it('rechaza cualquier string que no sea un rol válido', () => {
    const validRoles = new Set<string>(ROLES);
    fc.assert(
      fc.property(fc.string(), (candidate) => {
        if (validRoles.has(candidate)) {
          // Es un rol válido por casualidad: debe aceptarse.
          expect(isValidRole(candidate)).toBe(true);
        } else {
          // No pertenece al conjunto: debe rechazarse.
          expect(isValidRole(candidate)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Para cualquier rol válido del sistema, isValidRole siempre acepta.
  it('acepta todos los roles válidos definidos', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ROLES), (role: UserRole) => {
        expect(isValidRole(role)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Valores no-string nunca son roles válidos.
  it('rechaza valores que no son string', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.object()),
        (value) => {
          expect(isValidRole(value)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
