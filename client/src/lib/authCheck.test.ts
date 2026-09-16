import { describe, expect, it } from 'vitest';
import { explainProviders, explainSettings, keyKind } from './authCheck';

// La página /estado existe para cerrar la discusión, así que lo que dice
// tiene que ser exacto. Y hay una cosa que no puede fallar nunca: la
// llave no sale de ahí.

describe('qué llave hay puesta', () => {
  it('reconoce cada formato sin repetir el valor', () => {
    expect(keyKind('sb_publishable_abc123')).toBe('pública (formato nuevo)');
    expect(keyKind(undefined)).toBe('no hay ninguna');
    expect(keyKind('lo-que-sea')).toBe('formato desconocido');
  });

  it('avisa cuando la que hay es la privada del servidor', () => {
    expect(keyKind('sb_secret_abc123')).toMatch(/no debe estar acá/);
  });

  it('nunca devuelve la llave', () => {
    const llave = 'sb_publishable_ESTONODEBESALIR';
    expect(keyKind(llave)).not.toContain('ESTONODEBESALIR');
  });
});

describe('qué contestó el proyecto', () => {
  it('traduce cada respuesta a algo accionable', () => {
    expect(explainSettings(200).state).toBe('ok');
    expect(explainSettings(401).detail).toMatch(/llave no es válida/i);
    expect(explainSettings(404).detail).toMatch(/no es un proyecto/i);
    expect(explainSettings(null).state).toBe('fail');
  });
});

describe('qué formas de entrar están encendidas', () => {
  it('dice exactamente dónde encender Google cuando está apagado', () => {
    // Es la causa más probable de "entrar con Google no funciona": el
    // proveedor apagado en el proyecto. La app no puede arreglarlo, pero
    // sí puede decir dónde está el interruptor.
    const lines = explainProviders({ external: { google: false, email: true } });
    const google = lines.find((l) => l.label.includes('Google'))!;
    expect(google.state).toBe('fail');
    expect(google.detail).toMatch(/Authentication -> Providers -> Google/);
    expect(lines.find((l) => l.label.includes('correo'))!.state).toBe('ok');
  });

  it('los dos encendidos salen en verde', () => {
    const lines = explainProviders({ external: { google: true, email: true } });
    expect(lines.every((l) => l.state === 'ok')).toBe(true);
  });

  it('no inventa nada si no pudo leer la respuesta', () => {
    expect(explainProviders(null)[0].state).toBe('warn');
    expect(explainProviders({})[0].state).toBe('warn');
  });
});
