import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, retry, throwError, timer } from 'rxjs';

/**
 * Interceptor HTTP de la web pública.
 *
 * - Reintenta SOLO lecturas (GET) hasta 2 veces con backoff, para tolerar
 *   fallos de red transitorios sin ocultar errores reales.
 * - Nunca convierte un fallo en respuesta vacía silenciosa: propaga el error
 *   con su código para que el componente muestre un mensaje adecuado.
 * - No expone detalles técnicos internos al usuario (eso lo decide la vista).
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const isRead = req.method === 'GET';

  return next(req).pipe(
    retry({
      count: isRead ? 2 : 0,
      delay: (error: HttpErrorResponse, retryCount: number) => {
        // Reintentar solo ante fallos de red o 5xx; nunca ante 4xx.
        const retriable = error.status === 0 || error.status >= 500;
        if (!retriable) {
          return throwError(() => error);
        }
        return timer(retryCount * 400);
      },
    }),
    catchError((error: HttpErrorResponse) => throwError(() => error)),
  );
};
