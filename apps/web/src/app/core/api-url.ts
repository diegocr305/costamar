import { isPlatformServer } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Resuelve la URL base de la API según el contexto de ejecución.
 *
 * - En el navegador (cliente): usa la URL pública (environment.apiUrl),
 *   accesible desde Internet a través de Nginx/Cloudflare.
 * - En el servidor SSR: usa la URL interna de la red Docker si está definida
 *   en SSR_API_URL (process.env), evitando salir a Internet para hablar con
 *   la API que vive en el mismo host.
 */
export function resolveApiUrl(): string {
  const platformId = inject(PLATFORM_ID);

  if (isPlatformServer(platformId)) {
    // En SSR, Node expone process.env. Preferir la URL interna si existe.
    const internal =
      typeof process !== 'undefined' ? process.env['SSR_API_URL'] : undefined;
    if (internal) {
      return internal.replace(/\/$/, '');
    }
  }
  return environment.apiUrl;
}
