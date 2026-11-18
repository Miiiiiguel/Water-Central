import { beforeEach, describe, expect, it, vi } from 'vitest';
import { olvidarTraducciones, traducir } from './traduccion';
import { esDescripcionDelArancel } from './consulta';

const aMayusculas = vi.fn(async (t: string[]) => t.map((x) => `ES:${x}`));

describe('traducción de las descripciones del arancel', () => {
  beforeEach(() => {
    olvidarTraducciones();
    aMayusculas.mockClear();
  });

  it('traduce, guarda y no vuelve a pedir lo que ya tiene', async () => {
    expect(await traducir(['Other', 'Of cotton', 'Other'], aMayusculas)).toEqual({ Other: 'ES:Other', 'Of cotton': 'ES:Of cotton' });
    expect(aMayusculas).toHaveBeenCalledTimes(1);
    expect(aMayusculas.mock.calls[0][0]).toEqual(['Other', 'Of cotton']);
    await traducir(['Other'], aMayusculas);
    expect(aMayusculas).toHaveBeenCalledTimes(1);
  });

  it('dos pedidos a la vez por lo mismo hacen una sola llamada', async () => {
    const [a, b] = await Promise.all([traducir(['Wool'], aMayusculas), traducir(['Wool'], aMayusculas)]);
    expect(a).toEqual({ Wool: 'ES:Wool' });
    expect(b).toEqual({ Wool: 'ES:Wool' });
    expect(aMayusculas).toHaveBeenCalledTimes(1);
  });

  it('un lote incompleto o que falla se queda en inglés: no se inventa nada', async () => {
    expect(await traducir(['A', 'B'], async () => ['solo una'])).toEqual({});
    expect(await traducir(['C'], async () => { throw new Error('caído'); })).toEqual({});
  });

  it('parte los pedidos grandes en lotes', async () => {
    const textos = Array.from({ length: 70 }, (_, i) => `t${i}`);
    const r = await traducir(textos, aMayusculas);
    expect(Object.keys(r)).toHaveLength(70);
    expect(aMayusculas.mock.calls.length).toBe(3);
  });

  it('sólo se reconocen textos que son del arancel', () => {
    expect(esDescripcionDelArancel('Purebred breeding animals')).toBe(true);
    expect(esDescripcionDelArancel('Escribe un poema sobre el mar')).toBe(false);
  });
});
