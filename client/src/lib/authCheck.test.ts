import { describe, expect, it } from 'vitest';
import { explainProviders, explainSettings, explainSources, explainTable, keyKind } from './authCheck';

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

describe('si la base de datos está preparada', () => {
  // Este es el fallo que dejó a la app contestando "no sé quién sos" a
  // alguien que acababa de entrar con Google: proyecto nuevo, sesión
  // perfecta, y ni una tabla donde guardar la cuenta.
  it('una tabla protegida por permisos SÍ existe', () => {
    expect(explainTable(200, null).state).toBe('ok');
    expect(explainTable(401, null).state).toBe('ok');
    expect(explainTable(403, null).state).toBe('ok');
  });

  it('cuando la tabla no está, dice qué hay que correr y dónde', () => {
    const r = explainTable(404, { code: 'PGRST205', message: "Could not find the table 'public.profiles' in the schema cache" });
    expect(r.state).toBe('fail');
    expect(r.detail).toMatch(/schema\.sql/);
    expect(r.detail).toMatch(/SQL Editor/);
  });

  it('reconoce también el código de Postgres', () => {
    expect(explainTable(400, { code: '42P01', message: 'relation "public.profiles" does not exist' }).state).toBe('fail');
  });

  it('sin respuesta no afirma nada', () => {
    expect(explainTable(null, null).state).toBe('warn');
  });
});

describe('si las fuentes de datos están conectadas', () => {
  it('dice cuál falta, sin nombrar al proveedor', () => {
    const lines = explainSources({ tiktok: true, aduanas: false });
    expect(lines.find((l) => l.label.includes('TikTok'))!.state).toBe('ok');
    const aduanas = lines.find((l) => l.label.includes('comercio exterior'))!;
    expect(aduanas.state).toBe('fail');
    expect(aduanas.detail).toMatch(/NO conectada/);
    // El nombre del proveedor no sale de la app.
    expect(lines.map((l) => `${l.label} ${l.detail}`).join(' ')).not.toMatch(/kalodata|sicex/i);
  });

  it('si el servidor no contesta, no afirma que estén conectadas', () => {
    expect(explainSources(null)[0].state).toBe('warn');
  });
});
