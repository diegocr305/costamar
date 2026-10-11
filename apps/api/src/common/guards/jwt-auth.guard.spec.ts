import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

function mockContext(): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({}),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('permite rutas @PublicRoute() sin validar token', () => {
    const reflector = {
      getAllAndOverride: () => true, // isPublic = true
    } as unknown as Reflector;

    const guard = new JwtAuthGuard(reflector);
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('consulta el metadata isPublicRoute en handler y clase', () => {
    const keysChecked: string[] = [];
    const reflector = {
      getAllAndOverride: (key: string) => {
        keysChecked.push(key);
        return true; // tratamos como pública para no invocar Passport
      },
    } as unknown as Reflector;

    const guard = new JwtAuthGuard(reflector);
    guard.canActivate(mockContext());
    expect(keysChecked).toContain('isPublicRoute');
  });
});
