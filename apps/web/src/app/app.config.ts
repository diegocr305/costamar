import {
  ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { routes } from './app.routes';
import { httpErrorInterceptor } from './core/http-error.interceptor';

/**
 * Config base compartida por cliente y servidor.
 * La hidratación se agrega SOLO en el config del cliente para evitar que
 * su factory toque `document` durante el render del servidor.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([httpErrorInterceptor])),
  ],
};
