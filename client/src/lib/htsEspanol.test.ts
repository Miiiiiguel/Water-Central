import { afterEach, describe, expect, it, vi } from 'vitest';
import { enEspanol, olvidarEspanol, traducirDescripciones } from './hts';

describe('descripciones en español en el navegador', () => {
  afterEach(() => {
    olvidarEspanol();
    vi.unstubAllGlobals();
  });

  it('pide cada parte una vez y arma la descripción traducida', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ traducciones: { 'Of cotton': 'De algodón', Other: 'Los demás' } })));
    vi.stubGlobal('fetch', fetchMock);
    expect(enEspanol('Of cotton › Other')).toBe('Of cotton › Other');
    expect(await traducirDescripciones(['Of cotton › Other', 'Other'])).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).textos).toEqual(['Of cotton', 'Other']);
    expect(enEspanol('Of cotton › Other')).toBe('De algodón › Los demás');
    expect(await traducirDescripciones(['Other'])).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('si el servidor no responde, queda en inglés', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('sin red'); }));
    expect(await traducirDescripciones(['Wool'])).toBe(false);
    expect(enEspanol('Wool')).toBe('Wool');
  });
});
