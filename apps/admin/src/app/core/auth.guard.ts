import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Protege rutas del panel: si no hay usuario autenticado, redirige a /login
 * sin exponer el contenido de la ruta protegida.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.ready()) {
    await new Promise<void>(resolve => {
      const check = () => auth.ready() ? resolve() : setTimeout(check, 30);
      check();
    });
  }

  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};
