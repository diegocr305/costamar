import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublicRoute';

/**
 * Marca una ruta como pública: omite la autenticación JWT.
 * Usar en endpoints como el health check o la carta pública.
 */
export const PublicRoute = () => SetMetadata(IS_PUBLIC_KEY, true);
