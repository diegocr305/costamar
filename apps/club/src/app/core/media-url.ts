import { environment } from '../../environments/environment';

/**
 * Construye la URL pública de un objeto del Storage de Supabase (bucket media).
 * Acepta ruta relativa ("club/jugo.png"), URL absoluta o data URI.
 */
const PUBLIC_PREFIX = '/storage/v1/object/public/';
const DEFAULT_BUCKET = 'media';

export function mediaUrl(
  path: string | null | undefined,
  bucket: string = DEFAULT_BUCKET,
): string {
  if (!path) return '';
  const trimmed = path.trim();
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const cleanPath = trimmed.replace(/^\//, '');
  const base = environment.supabaseUrl.replace(/\/$/, '');
  return `${base}${PUBLIC_PREFIX}${bucket}/${cleanPath}`;
}
