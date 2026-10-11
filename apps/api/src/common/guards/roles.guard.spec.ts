import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { UserRole } from '@costamar/shared';

function mockContext(user?: { role: UserRole }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function mockReflector(opts: {
  isPublic?: boolean;
  requiredRoles?: UserRole[];
}): Reflector {
  return {
    getAllAndOverride: (key: string) => {
      if (key === 'isPublicRoute') return opts.isPublic ?? false;
      if (key === 'requiredRoles') return opts.requiredRoles;
      return undefined;
    },
  } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it('permite rutas públicas sin verificar rol', () => {
    const guard = new RolesGuard(mockReflector({ isPublic: true }));
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('permite cuando no hay roles requeridos (basta autenticación)', () => {
    const guard = new RolesGuard(mockReflector({ requiredRoles: [] }));
    expect(guard.canActivate(mockContext({ role: 'customer' }))).toBe(true);
  });

  it('permite cuando el rol del usuario está entre los requeridos', () => {
    const guard = new RolesGuard(
      mockReflector({ requiredRoles: ['superadmin', 'admin'] }),
    );
    expect(guard.canActivate(mockContext({ role: 'admin' }))).toBe(true);
  });

  it('rechaza con 403 cuando el rol es insuficiente', () => {
    const guard = new RolesGuard(
      mockReflector({ requiredRoles: ['superadmin', 'admin'] }),
    );
    expect(() => guard.canActivate(mockContext({ role: 'kitchen' }))).toThrow(
      ForbiddenException,
    );
  });

  it('rechaza con 403 cuando no hay usuario pero se requieren roles', () => {
    const guard = new RolesGuard(
      mockReflector({ requiredRoles: ['admin'] }),
    );
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
