import { describe, expect, it } from 'vitest';
import { classifyProbe, hostOf, probeMessage } from './accountsProbe';

// El navegador dice "Failed to fetch" para tres cosas distintas: que el
// host no existe, que no hay red, y que la política de seguridad de
// nuestra propia página bloqueó la petición. Se arreglan de tres formas
// distintas, y una de ellas es culpa nuestra.

describe('distinguir las tres causas de "Failed to fetch"', () => {
  it('si el host contestó, la red llega — aunque conteste con un error', () => {
    expect(classifyProbe(true, false)).toBe('ok');
  });

  it('si no contestó y hubo violación de política, lo bloqueamos nosotros', () => {
    expect(classifyProbe(false, true)).toBe('bloqueado_por_politica');
  });

  it('si no contestó y no hubo violación, no hay nadie en esa dirección', () => {
    expect(classifyProbe(false, false)).toBe('host_no_responde');
  });
});

describe('el host que se nombra', () => {
  it('sale limpio, sin la ruta ni nada más', () => {
    expect(hostOf('https://abcdefghijklm.supabase.co')).toBe('abcdefghijklm.supabase.co');
    expect(hostOf('https://abcdefghijklm.supabase.co/auth/v1')).toBe('abcdefghijklm.supabase.co');
  });

  it('no revienta con un valor que no es una URL', () => {
    expect(hostOf('abcdefghijklm.supabase.co')).toBeNull();
    expect(hostOf(undefined)).toBeNull();
    expect(hostOf('')).toBeNull();
  });
});

describe('lo que lee la persona', () => {
  it('cuando el bloqueo es nuestro, lo decimos', () => {
    const msg = probeMessage('bloqueado_por_politica', 'abc.supabase.co', true);
    expect(msg).toMatch(/error nuestro|no tuyo/i);
    expect(msg).toContain('abc.supabase.co');
  });

  it('cuando el host no contesta, no le echamos la culpa a su internet', () => {
    const msg = probeMessage('host_no_responde', 'abc.supabase.co', true);
    expect(msg).toMatch(/no es tu conexión/i);
    expect(msg).toMatch(/no se creó ninguna cuenta/i);
  });

  it('funciona sin host, sin dejar un paréntesis vacío', () => {
    for (const r of ['bloqueado_por_politica', 'host_no_responde', 'ok', 'sin_url'] as const) {
      const msg = probeMessage(r, null, true);
      expect(msg, r).not.toContain('()');
      expect(msg.length, r).toBeGreaterThan(30);
    }
  });
});
