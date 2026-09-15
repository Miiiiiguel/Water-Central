import { describe, expect, it } from 'vitest';
import { MARKETS, buildRequest, dateRange, endpointFor, marketFor, pickRecords, toResult } from './kalodata';

// Kalodata cobra por llamada (1 crédito ≈ 0.1 USD), así que el cuerpo de
// la petición tiene que salir bien a la primera. Estas pruebas fijan lo
// que su soporte confirmó: POST + JSON con region / language / currency /
// date_range, y la ruta /openapi/v1/tiktok/{módulo}/{acción}.

describe('endpointFor', () => {
  it('arma la ruta con el patrón de Kalodata', () => {
    expect(endpointFor('product', 'rank')).toBe('https://www.kalodata.com/openapi/v1/tiktok/product/rank');
    expect(endpointFor('video', 'detail')).toBe('https://www.kalodata.com/openapi/v1/tiktok/video/detail');
    expect(endpointFor('shop')).toMatch(/\/shop\/rank$/); // rank por defecto
  });
});

describe('marketFor', () => {
  it('acepta los quince mercados que cubre Kalodata', () => {
    expect(MARKETS).toHaveLength(15);
    for (const m of MARKETS) expect(marketFor(m)).toBe(m);
    expect(marketFor('mx')).toBe('MX'); // sin importar la caja
  });

  it('cae a US en vez de mandar una consulta que va a fallar', () => {
    // Colombia no es mercado de TikTok Shop: gastar un crédito en eso
    // sería tirar plata.
    expect(marketFor('CO')).toBe('US');
    expect(marketFor(undefined)).toBe('US');
    expect(marketFor('')).toBe('US');
  });
});

describe('dateRange', () => {
  it('devuelve los últimos N días en ISO', () => {
    const r = dateRange(30, new Date('2026-09-15T12:00:00Z'));
    expect(r).toEqual({ start_date: '2026-08-16', end_date: '2026-09-15' });
  });

  it('cruza el cambio de mes y de año sin romperse', () => {
    expect(dateRange(7, new Date('2026-01-03T00:00:00Z')).start_date).toBe('2025-12-27');
  });
});

describe('buildRequest', () => {
  const today = new Date('2026-09-15T00:00:00Z');

  it('manda los campos comunes que pide Kalodata', () => {
    const body = buildRequest({ query: 'jeans', country: 'MX', today });
    expect(body).toMatchObject({
      region: 'MX',
      currency: 'MXN',
      language: 'en',
      keyword: 'jeans',
      page: 1,
      page_size: 10,
    });
    expect(body.date_range).toEqual({ start_date: '2026-08-16', end_date: '2026-09-15' });
  });

  it('usa la moneda de cada mercado', () => {
    expect(buildRequest({ country: 'ES', today }).currency).toBe('EUR');
    expect(buildRequest({ country: 'BR', today }).currency).toBe('BRL');
    expect(buildRequest({ country: 'JP', today }).currency).toBe('JPY');
  });

  it('omite keyword cuando no hay búsqueda, en vez de mandar vacío', () => {
    expect(buildRequest({ today })).not.toHaveProperty('keyword');
    expect(buildRequest({ query: '   ', today })).not.toHaveProperty('keyword');
  });

  it('limita el tamaño de página: cada resultado de más cuesta', () => {
    expect(buildRequest({ pageSize: 500, today }).page_size).toBe(20);
    expect(buildRequest({ pageSize: 0, today }).page_size).toBe(1);
  });

  it('solo habla en los dos idiomas de la app', () => {
    expect(buildRequest({ language: 'es', today }).language).toBe('es');
    expect(buildRequest({ language: 'pt', today }).language).toBe('en');
  });
});

describe('pickRecords', () => {
  it('encuentra la lista venga como venga envuelta', () => {
    const rows = [{ title: 'a' }, { title: 'b' }];
    expect(pickRecords(rows)).toEqual(rows);
    expect(pickRecords({ data: rows })).toEqual(rows);
    expect(pickRecords({ data: { list: rows } })).toEqual(rows);
    expect(pickRecords({ result: { items: rows } })).toEqual(rows);
  });

  it('devuelve vacío en vez de romperse con basura', () => {
    expect(pickRecords(null)).toEqual([]);
    expect(pickRecords('nope')).toEqual([]);
    expect(pickRecords({ data: { nothing: true } })).toEqual([]);
  });
});

describe('toResult', () => {
  const url = 'https://www.kalodata.com/openapi/v1/tiktok/product/rank';

  it('dice claramente cuando no hubo resultados, sin inventar', () => {
    const r = toResult('jeans', 'US', { data: { list: [] } }, url);
    expect(r.rows).toEqual([]);
    expect(r.summary).toContain('no devolvió resultados');
    expect(r.summary).toContain('US');
  });

  it('resume los registros reales y nombra el mercado', () => {
    const payload = {
      data: {
        total: 812,
        list: [
          { product_id: 'x1', title: 'Jeans mom fit', revenue: '$12,400', units_sold: 830, image: 'https://…' },
          { product_id: 'x2', title: 'Wide leg denim', revenue: '$9,100', units_sold: 610 },
        ],
      },
    };
    const r = toResult('jeans', 'MX', payload, url);
    expect(r.total).toBe(812);
    expect(r.summary).toContain('TikTok Shop MX');
    expect(r.summary).toContain('812');
    expect(r.rows[0].label).toBe('Jeans mom fit');
    expect(r.rows[0].value).toContain('revenue');
    // Ids e imágenes no le sirven a nadie en una respuesta de chat.
    expect(r.rows[0].value).not.toContain('product_id');
    expect(r.rows[0].value).not.toContain('image');
    expect(r.sourceUrl).toBe(url);
  });

  it('nunca devuelve más de cinco filas a la conversación', () => {
    const list = Array.from({ length: 40 }, (_, i) => ({ title: `p${i}`, revenue: i }));
    expect(toResult('jeans', 'US', { data: { list } }, url).rows).toHaveLength(5);
  });
});
