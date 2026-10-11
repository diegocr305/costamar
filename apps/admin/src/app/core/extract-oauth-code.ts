/**
 * Extrae el valor del parámetro `code` de una URL de callback OAuth.
 * exchangeCodeForSession() espera SOLO este valor, nunca la URL completa
 * (pasar la URL entera provoca 404 flow_state_not_found).
 */
export function extractOAuthCode(url: string): string | null {
  try {
    return new URL(url).searchParams.get('code');
  } catch {
    const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : url;
    return new URLSearchParams(q).get('code');
  }
}
