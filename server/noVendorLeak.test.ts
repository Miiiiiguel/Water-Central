import { describe, expect, it } from 'vitest';
import { toResult } from './kalodata';

// La regla otra vez, pero en el sitio donde de verdad se rompía.
//
// La prueba de client/src sólo mira el navegador. El resumen de una
// consulta lo escribe el SERVIDOR y viaja al chat, y ahí decía
// literalmente "Kalodata · TikTok Shop US: 40 resultado(s)". Es el peor
// lugar posible: el resumen es lo único de toda la respuesta que el
// cliente lee entero, y estaba nombrando al proveedor en cada consulta
// que funcionaba.

const PROHIBIDOS = [/kalodata/i, /sicex/i];

const payload = {
  total: 40,
  data: {
    list: [
      { product_name: 'Jeans wide leg', revenue: 128000, sales_volumn: 3400, price: 38 },
      { product_name: 'Jeans cargo', revenue: 96000, sales_volumn: 2100, price: 42 },
    ],
  },
};

describe('lo que el cliente lee de una consulta', () => {
  it('no nombra al proveedor cuando hay resultados', () => {
    const result = toResult('jeans', 'US', payload, 'https://interno/', 'USD');
    const texto = [result.summary, ...result.rows.map((r) => `${r.label} ${r.value}`)].join(' ');
    for (const prohibido of PROHIBIDOS) expect(texto).not.toMatch(prohibido);
  });

  it('tampoco cuando no hay resultados', () => {
    const result = toResult('algo que no existe', 'MX', { data: { list: [] } }, 'https://interno/');
    for (const prohibido of PROHIBIDOS) expect(result.summary).not.toMatch(prohibido);
    expect(result.summary).toContain('TikTok Shop MX');
  });

  it('sigue diciendo lo que hace falta: mercado, cuántos y qué se buscó', () => {
    const result = toResult('jeans', 'US', payload, 'https://interno/', 'USD');
    expect(result.summary).toContain('TikTok Shop US');
    expect(result.summary).toContain('40');
    expect(result.summary).toContain('jeans');
    expect(result.rows[0].label).toBe('Jeans wide leg');
  });

  it('la URL del proveedor no viaja dentro de las filas', () => {
    const result = toResult('jeans', 'US', payload, 'https://www.kalodata.com/openapi/v1/tiktok/product/rank', 'USD');
    const visible = [result.summary, ...result.rows.map((r) => `${r.label} ${r.value}`)].join(' ');
    expect(visible).not.toMatch(/kalodata/i);
    // `sourceUrl` sí la lleva, pero server/research.ts lo quita antes de
    // responder — y hay una prueba de eso en el propio router.
    expect(result.sourceUrl).toContain('kalodata');
  });
});
