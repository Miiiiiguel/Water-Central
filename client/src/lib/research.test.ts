import { afterEach, describe, expect, it, vi } from 'vitest';
import { runResearch } from './research';

// Lo que el navegador hace con cada respuesta del servidor. Acá se
// decide si a alguien se le dice "creá tu cuenta" —y decírselo a quien
// acaba de entrar con Google fue, literalmente, el error que dejó la
// app inservible durante días.

function responde(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ status, ok: status >= 200 && status < 300, json: async () => body }) as unknown as Response)
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('qué entiende el chat de cada respuesta', () => {
  it('sin token ni pregunta al servidor: no hay a quién identificar', async () => {
    const llamadas = vi.fn();
    vi.stubGlobal('fetch', llamadas);
    expect(await runResearch(null, 'tiktok', 'jeans')).toEqual({ kind: 'unauthenticated' });
    expect(llamadas).not.toHaveBeenCalled();
  });

  it('una sesión rechazada NO manda a crear cuenta', async () => {
    responde(401, { error: 'sesion_vencida', reason: 'token_invalido', message: 'Tu sesión ya no vale.' });
    const out = await runResearch('jwt', 'tiktok', 'shampoo');
    expect(out.kind).toBe('session_expired');
  });

  it('un 401 sin motivo sigue siendo "no has entrado"', async () => {
    responde(401, { error: 'sin_sesion', reason: 'sin_token' });
    expect((await runResearch('jwt', 'tiktok', 'shampoo')).kind).toBe('unauthenticated');
  });

  it('la base sin preparar es problema nuestro, no de la cuenta', async () => {
    responde(503, { error: 'base_sin_preparar', message: 'La base de datos todavía no está preparada.' });
    const out = await runResearch('jwt', 'tiktok', 'shampoo');
    expect(out.kind).toBe('app_misconfigured');
    if (out.kind === 'app_misconfigured') expect(out.message).toMatch(/base de datos/i);
  });

  it('la fuente sin conectar se distingue de la app mal puesta', async () => {
    responde(503, { error: 'source_not_connected', message: 'Todavía no está disponible.' });
    expect((await runResearch('jwt', 'tiktok', 'shampoo')).kind).toBe('not_connected');
  });

  it('sin consultas se ofrece comprar, no entrar', async () => {
    responde(402, { error: 'quota_exhausted', message: 'Se te acabaron.' });
    expect((await runResearch('jwt', 'tiktok', 'shampoo')).kind).toBe('quota_exhausted');
  });

  it('una respuesta buena trae el dato y la cuota', async () => {
    responde(200, {
      source: 'tiktok',
      billed: 'free',
      result: { summary: 'Top 3', rows: [{ label: 'Shampoo sólido', value: '12k' }] },
      quota: { plan: 'free', dailyLimit: 2, usedToday: 1, freeRemaining: 1, credits: 0, canQuery: true, sources: { tiktok: true, aduanas: true } },
    });
    const out = await runResearch('jwt', 'tiktok', 'shampoo');
    expect(out.kind).toBe('ok');
    if (out.kind === 'ok') expect(out.rows).toHaveLength(1);
  });

  it('sin conexión no inventa nada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const out = await runResearch('jwt', 'tiktok', 'shampoo');
    expect(out.kind).toBe('failed');
  });
});
