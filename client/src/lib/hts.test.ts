import { afterEach, describe, expect, it, vi } from 'vitest';
import { buscarPartidasConCausa } from './hts';

const respuesta = (status: number, cuerpo: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo }) as Response;

describe('buscarPartidasConCausa', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('a server hiccup is retried once, and the second answer counts', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(respuesta(502))
      .mockResolvedValueOnce(respuesta(200, { resultados: [{ codigo: '6212.20.00' }] }));
    vi.stubGlobal('fetch', fetch);
    const r = await buscarPartidasConCausa('fajas');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ ok: true, datos: [{ codigo: '6212.20.00' }] });
  });

  it('too many searches is said as such, without retrying', async () => {
    const fetch = vi.fn().mockResolvedValue(respuesta(429));
    vi.stubGlobal('fetch', fetch);
    expect(await buscarPartidasConCausa('fajas')).toEqual({ ok: false, fallo: 'limite' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('a server that never answers is a server failure, not "no results"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await buscarPartidasConCausa('fajas')).toEqual({ ok: false, fallo: 'servidor' });
  });
});
