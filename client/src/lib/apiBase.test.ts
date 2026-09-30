import { describe, expect, it } from 'vitest';
import { SERVIDOR_POR_DEFECTO, baseDelServidor, conServidor } from './apiBase';

describe('a qué servidor llama la app', () => {
  it('en la web, al mismo que sirvió la página', () => {
    expect(baseDelServidor(false, 'https://otro.com')).toBe('');
    expect(conServidor('/api/hts/buscar?q=cafe', '')).toBe('/api/hts/buscar?q=cafe');
  });

  it('en la app nativa, al de producción (o al configurado)', () => {
    expect(baseDelServidor(true)).toBe(SERVIDOR_POR_DEFECTO);
    expect(baseDelServidor(true, 'https://app.easycomex.com/')).toBe('https://app.easycomex.com');
    // Una dirección sin https no se acepta: la app no habla en claro.
    expect(baseDelServidor(true, 'http://inseguro.com')).toBe(SERVIDOR_POR_DEFECTO);
    expect(conServidor('/api/hts/buscar?q=cafe', 'https://app.easycomex.com')).toBe('https://app.easycomex.com/api/hts/buscar?q=cafe');
  });

  it('sólo se toca /api: lo demás (Supabase, imágenes) sigue igual', () => {
    const base = 'https://app.easycomex.com';
    expect(conServidor('https://abc.supabase.co/auth/v1/token', base)).toBe('https://abc.supabase.co/auth/v1/token');
    expect(conServidor('/assets/logo.png', base)).toBe('/assets/logo.png');
  });
});
