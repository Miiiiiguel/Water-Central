import { describe, expect, it } from 'vitest';
import { CATALOG } from '../../../server/catalog';
import { PORTAFOLIO, enlaceReferido } from './revendedores';

describe('enlace del revendedor', () => {
  it('adds ?ref= before the #anchor, and & when the path already has a query', () => {
    expect(enlaceReferido('https://x.co', '/tokens', 'ab12cd34')).toBe('https://x.co/tokens?ref=ab12cd34');
    expect(enlaceReferido('https://x.co', '/#planes', 'ab12cd34')).toBe('https://x.co/?ref=ab12cd34#planes');
    expect(enlaceReferido('https://x.co', '/plantillas?doc=factura', 'ab12cd34')).toBe('https://x.co/plantillas?doc=factura&ref=ab12cd34');
  });

  it('is the plain link when the reseller has no code yet', () => {
    expect(enlaceReferido('https://x.co', '/roi', null)).toBe('https://x.co/roi');
  });
});

describe('portafolio', () => {
  it('offers every plan in the catalog, once, and nothing that is not in it', () => {
    const planes = PORTAFOLIO.map((p) => p.plan);
    expect(new Set(planes).size).toBe(planes.length);
    expect([...planes].sort()).toEqual(Object.keys(CATALOG).sort());
  });

  it('falls back to the catalog price when the server does not answer', () => {
    for (const item of PORTAFOLIO) {
      const usdCents = CATALOG[item.plan as keyof typeof CATALOG].usdCents;
      if (usdCents === null) expect(item.respaldo).toBe('A medida');
      else expect(item.respaldo.replace(/(\.\d)$/, '$10')).toBe(`USD ${(usdCents / 100).toFixed(2).replace(/\.00$/, '')}`);
    }
  });
});
