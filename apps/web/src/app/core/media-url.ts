import { environment } from '../../environments/environment';

/**
 * Construye la URL pública de un objeto del Storage de Supabase.
 *
 * Acepta:
 *  - Una ruta relativa dentro del bucket `media`, p.ej.
 *    "carta/products/<id>/0.webp" → URL pública completa.
 *  - Una URL absoluta (http/https) o un data URI → se devuelve tal cual.
 *  - Un path que ya incluye el prefijo de Storage → se devuelve tal cual.
 *
 * SSR-safe: no accede a window/document; solo usa environment.
 */
const PUBLIC_PREFIX = '/storage/v1/object/public/';
const DEFAULT_BUCKET = 'media';

export function mediaUrl(
  path: string | null | undefined,
  bucket: string = DEFAULT_BUCKET,
): string {
  if (!path) {
    return '';
  }

  const trimmed = path.trim();

  // Ya es absoluta o un data URI: no tocar.
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Ya trae el prefijo público de Storage.
  if (trimmed.includes(PUBLIC_PREFIX)) {
    return `${environment.supabaseUrl.replace(/\/$/, '')}${
      trimmed.startsWith('/') ? '' : '/'
    }${trimmed.replace(/^\//, '')}`;
  }

  const cleanPath = trimmed.replace(/^\//, '');
  const base = environment.supabaseUrl.replace(/\/$/, '');
  return `${base}${PUBLIC_PREFIX}${bucket}/${cleanPath}`;
}
