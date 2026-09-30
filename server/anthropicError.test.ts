import { describe, expect, it } from 'vitest';
import { diagnosticarIA } from './anthropicError';

// Cinco fallas que desde afuera se ven idénticas. La prueba es que
// dejen de verse idénticas: cada una tiene que nombrarse, y tiene que
// quedar claro si la arregla quien configuró la app o quien la usa.

const comoVieneDelSdk = (status: number, message = '') => ({
  status,
  error: { error: { type: 'error', message } },
});

describe('por qué falló la llamada', () => {
  it('una llave revocada se dice llave revocada', () => {
    const f = diagnosticarIA(comoVieneDelSdk(401), 'claude-sonnet-5');
    expect(f.causa).toBe('llave_invalida');
    expect(f.nuestro).toBe(true);
  });

  it('un modelo que la cuenta no tiene habilitado NOMBRA el modelo', () => {
    // Es la causa más común de que una foto perfecta vuelva con error,
    // y sin el nombre del modelo no hay nada que buscar.
    const f = diagnosticarIA(comoVieneDelSdk(404), 'claude-sonnet-5');
    expect(f.causa).toBe('modelo_desconocido');
    expect(f.publico).toContain('claude-sonnet-5');
    expect(f.nuestro).toBe(true);
  });

  it('sin saldo no se confunde con una imagen rechazada', () => {
    expect(diagnosticarIA(comoVieneDelSdk(400, 'credit balance is too low'), 'm').causa).toBe('sin_saldo');
    expect(diagnosticarIA(comoVieneDelSdk(400, 'could not process image'), 'm').causa).toBe('imagen_rechazada');
  });

  it('el límite de peticiones NO es culpa de la configuración', () => {
    const f = diagnosticarIA(comoVieneDelSdk(429), 'm');
    expect(f.causa).toBe('demasiadas_peticiones');
    expect(f.nuestro).toBe(false);
    expect(f.publico).toMatch(/esperá|probá/i);
  });

  it('un corte de red no se disfraza de otra cosa', () => {
    const f = diagnosticarIA(new Error('fetch failed'), 'm');
    expect(f.causa).toBe('sin_respuesta');
    expect(f.detalle).toContain('fetch failed');
  });
});

describe('lo que llega a la pantalla', () => {
  const casos = [401, 403, 404, 429, 400].map((s) => diagnosticarIA(comoVieneDelSdk(s), 'claude-sonnet-5'));

  it('nunca nombra al proveedor', () => {
    // Misma regla que con las fuentes de mercado: de dónde sale la
    // capacidad es información interna.
    for (const f of casos) {
      expect(f.publico.toLowerCase()).not.toMatch(/anthropic|openai|google|api key|sk-ant/);
    }
  });

  it('nunca deja a la persona sin saber qué hacer', () => {
    for (const f of casos) {
      expect(f.publico.length).toBeGreaterThan(30);
      // O le decís que es tuyo, o le decís qué puede hacer.
      expect(/avisale al equipo|probá|esperá/i.test(f.publico)).toBe(true);
    }
  });

  it('el detalle del log dice más que la pantalla', () => {
    for (const f of casos) expect(f.detalle.length).toBeGreaterThan(10);
  });
});
