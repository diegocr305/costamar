import { extractOAuthCode } from './extract-oauth-code';

describe('extractOAuthCode', () => {
  it('extrae solo el valor de `code` de la URL completa del callback', () => {
    const url = 'https://club.restaurantecostamar.cl/auth/callback?code=abc123';
    expect(extractOAuthCode(url)).toBe('abc123');
  });

  it('NUNCA devuelve la URL completa como código', () => {
    const url =
      'https://club.restaurantecostamar.cl/auth/callback?code=xyz789&state=s';
    const code = extractOAuthCode(url);
    expect(code).toBe('xyz789');
    // Garantía anti-regresión: el código no debe contener la URL ni el host.
    expect(code).not.toContain('http');
    expect(code).not.toContain('/auth/callback');
    expect(code).not.toContain('restaurantecostamar.cl');
  });

  it('devuelve null si no hay parámetro code', () => {
    const url = 'https://club.restaurantecostamar.cl/auth/callback';
    expect(extractOAuthCode(url)).toBeNull();
  });

  it('funciona cuando se pasa solo la query string', () => {
    expect(extractOAuthCode('?code=soloquery')).toBe('soloquery');
  });

  it('maneja múltiples parámetros y preserva el code exacto', () => {
    const url =
      'https://club.restaurantecostamar.cl/auth/callback?foo=1&code=C-ODE_123&bar=2';
    expect(extractOAuthCode(url)).toBe('C-ODE_123');
  });
});
