import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Protege rutas que requieren sesión. Si no hay usuario autenticado,
 * redirige a /ingresar. Espera a que la sesión se restaure.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Esperar a que termine la restauración de sesión inicial.
  if (!auth.ready()) {
    await new Promise<void>((resolve) => {
      const check = () => {
        if (auth.ready()) resolve();
        else setTimeout(check, 30);
      };
      check();
    });
  }

  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/ingresar']);
};
