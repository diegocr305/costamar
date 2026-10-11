import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { AuthenticatedUser } from '../../auth/auth.types';

/**
 * Interceptor que registra cada solicitud como log JSON estructurado.
 * Registra solo metadatos: método, ruta, estado, duración, usuario y rol.
 * NUNCA registra cuerpos, cabeceras, tokens ni contraseñas.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: AuthenticatedUser }>();
    const response = http.getResponse<Response>();
    const start = Date.now();

    const { method, url } = request;

    return next.handle().pipe(
      tap({
        next: () => this.write('info', method, url, response, request, start),
        error: () =>
          this.write('error', method, url, response, request, start),
      }),
    );
  }

  private write(
    level: 'info' | 'error',
    method: string,
    path: string,
    response: Response,
    request: Request & { user?: AuthenticatedUser },
    start: number,
  ): void {
    const entry = {
      level,
      method,
      path,
      statusCode: response.statusCode,
      durationMs: Date.now() - start,
      userId: request.user?.userId ?? null,
      role: request.user?.role ?? null,
      timestamp: new Date().toISOString(),
    };
    this.logger.log(JSON.stringify(entry));
  }
}
