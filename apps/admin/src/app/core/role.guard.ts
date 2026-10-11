import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { UserRole } from '@costamar/shared';
import { AuthService } from './auth.service';

/**
 * Protege una ruta exigiendo que el usuario tenga uno de los roles indicados.
 * Uso: canActivate: [authGuard, roleGuard(['superadmin', 'admin'])]
 */
export function roleGuard(allowed: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = auth.user();

    if (user && allowed.includes(user.role)) {
      return true;
    }
    return router.createUrlTree(['/dashboard']);
  };
}
