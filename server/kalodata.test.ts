import { describe, expect, it } from 'vitest';
import { MARKETS, NAMED_RANGES, baseFrom, buildRequest, dateRangeFor, endpointFor, envelopeError, languageFor, marketFor, pickRecords, toResult, wasCached } from './kalodata';

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

describe('baseFrom', () => {
  it('acepta la base tal cual', () => {
    expect(baseFrom('https://www.kalodata.com/openapi/v1/tiktok')).toBe('https://www.kalodata.com/openapi/v1/tiktok');
    expect(baseFrom('https://www.kalodata.com/openapi/v1/tiktok/')).toBe('https://www.kalodata.com/openapi/v1/tiktok');
  });

  it('recorta un endpoint completo en vez de doblar la ruta', () => {
    // Pegar la URL de la documentación es lo natural; si no la
    // recortáramos saldría .../product/rank/product/rank → 404.
    expect(baseFrom('https://www.kalodata.com/openapi/v1/tiktok/product/rank')).toBe('https://www.kalodata.com/openapi/v1/tiktok');
    expect(baseFrom('https://www.kalodata.com/openapi/v1/tiktok/video/detail')).toBe('https://www.kalodata.com/openapi/v1/tiktok');
  });

  it('usa el valor por defecto cuando está vacío', () => {
    expect(baseFrom()).toContain('kalodata.com/openapi/v1/tiktok');
    expect(baseFrom('   ')).toContain('kalodata.com/openapi/v1/tiktok');
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

describe('dateRangeFor', () => {
  it('acepta los rangos con nombre de Kalodata', () => {
    for (const r of NAMED_RANGES) expect(dateRangeFor(r)).toBe(r);
  });

  it('acepta un rango natural y un mes natural', () => {
    expect(dateRangeFor('2026-08-16~2026-09-15')).toBe('2026-08-16~2026-09-15');
    expect(dateRangeFor('2026-08')).toBe('2026-08');
  });

  it('cae al rango por defecto en vez de gastar un crédito en algo inválido', () => {
    expect(dateRangeFor()).toBe('last30Day');
    expect(dateRangeFor('últimos 30 días')).toBe('last30Day');
    // El formato que usaríamos por intuición NO es el suyo.
    expect(dateRangeFor('2026-08-16,2026-09-15')).toBe('last30Day');
  });
});

describe('languageFor', () => {
  it('traduce los idiomas de la app a los locales que pide Kalodata', () => {
    // Mandar 'es' o 'en' a secas es un error garantizado.
    expect(languageFor('es')).toBe('es-ES');
    expect(languageFor('en')).toBe('en-US');
    expect(languageFor(undefined)).toBe('en-US');
  });
});

describe('buildRequest', () => {
  it('manda los cuatro campos obligatorios con los códigos de Kalodata', () => {
    const body = buildRequest({ query: 'jeans', country: 'MX', language: 'es' });
    expect(body).toEqual({
      region: 'MX',
      language: 'es-ES',
      currency: 'MXN',
      date_range: 'last30Day',
      keyword: 'jeans',
      page: 1,
      page_size: 50,
    });
  });

  it('usa la moneda de cada mercado, de su lista admitida', () => {
    expect(buildRequest({ country: 'ES' }).currency).toBe('EUR');
    expect(buildRequest({ country: 'BR' }).currency).toBe('BRL');
    expect(buildRequest({ country: 'JP' }).currency).toBe('JPY');
    expect(buildRequest({ country: 'GB' }).currency).toBe('GBP');
  });

  it('manda date_range como string, nunca como objeto', () => {
    expect(typeof buildRequest({}).date_range).toBe('string');
    expect(buildRequest({ range: 'last7Day' }).date_range).toBe('last7Day');
  });

  it('omite keyword cuando no hay búsqueda, en vez de mandar vacío', () => {
    expect(buildRequest({})).not.toHaveProperty('keyword');
    expect(buildRequest({ query: '   ' })).not.toHaveProperty('keyword');
  });

  it('pide un bloque entero: hasta 100 filas cuestan lo mismo que una', () => {
    // El cobro es 0.1 × techo(filas/100). Pedir 20 en vez de 100 no
    // ahorra nada y pierde datos; pedir 101 cuesta el doble.
    expect(buildRequest({}).page_size).toBe(50);
    expect(buildRequest({ pageSize: 100 }).page_size).toBe(100);
    expect(buildRequest({ pageSize: 500 }).page_size).toBe(100);
    expect(buildRequest({ pageSize: 0 }).page_size).toBe(1);
  });
});

describe('envelopeError', () => {
  it('detecta un fallo disfrazado de HTTP 200', () => {
    // Kalodata contesta 200 con success:false. Si no lo miramos,
    // mostraríamos una respuesta vacía como si fuera un resultado.
    expect(envelopeError({ success: false, message: 'invalid region' })).toBe('invalid region');
    expect(envelopeError({ success: false, code: 'E_PARAM' })).toBe('E_PARAM');
    expect(envelopeError({ success: false })).toContain('success: false');
  });

  it('deja pasar una respuesta buena', () => {
    expect(envelopeError({ success: true, data: {} })).toBeNull();
    expect(envelopeError(null)).toBeNull();
  });
});

describe('wasCached', () => {
  it('reconoce cuándo vino de su caché', () => {
    expect(wasCached({ cached: true })).toBe(true);
    expect(wasCached({ cached: false })).toBe(false);
    expect(wasCached({})).toBe(false);
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

  it('trata un endpoint detail (un objeto) como una lista de uno', () => {
    const one = { video_id: '7627814494370057503', video_title: 'Product Review' };
    expect(pickRecords({ success: true, data: one })).toEqual([one]);
  });

  it('devuelve vacío en vez de romperse con basura', () => {
    expect(pickRecords(null)).toEqual([]);
    expect(pickRecords('nope')).toEqual([]);
    expect(pickRecords({ data: {} })).toEqual([]);
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

  it('resume la respuesta real de /video/detail con los campos que importan', () => {
    // Ejemplo tomado de su documentación.
    const payload = {
      success: true,
      cached: false,
      data: {
        video_id: '7627814494370057503',
        video_title: 'Product Review: Best Tech of 2024',
        belonged_creator_handle: 'techreviewer',
        revenue: 2500.75,
        sales_volumn: 45,
        views: 150000,
        video_gpm: 16.67,
        revenue_trend: [50000, 62000],
      },
    };
    const r = toResult('tech', 'US', payload, url, 'USD');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].label).toBe('Product Review: Best Tech of 2024');
    // Los números salen legibles y con moneda donde corresponde.
    expect(r.rows[0].value).toContain('ingresos: 2.5K USD');
    expect(r.rows[0].value).toContain('ventas: 45');
    expect(r.rows[0].value).toContain('vistas: 150.0K');
    // Ids y series diarias no le sirven a nadie en una respuesta de chat.
    expect(r.rows[0].value).not.toContain('video_id');
    expect(r.rows[0].value).not.toContain('trend');
  });

  it('resume un ranking y nombra el mercado', () => {
    const payload = {
      success: true,
      data: {
        total: 812,
        list: [
          { product_name: 'Jeans mom fit', revenue: 12400, sales_volumn: 830, image: 'https://…' },
          { product_name: 'Wide leg denim', revenue: 9100, sales_volumn: 610 },
        ],
      },
    };
    const r = toResult('jeans', 'MX', payload, url, 'MXN');
    expect(r.total).toBe(812);
    expect(r.summary).toContain('TikTok Shop MX');
    expect(r.summary).toContain('812');
    expect(r.rows[0].label).toBe('Jeans mom fit');
    expect(r.rows[0].value).toContain('12.4K MXN');
    expect(r.rows[0].value).not.toContain('image');
    expect(r.sourceUrl).toBe(url);
  });

  it('nunca devuelve más de cinco filas a la conversación', () => {
    const list = Array.from({ length: 40 }, (_, i) => ({ product_name: `p${i}`, revenue: i }));
    expect(toResult('jeans', 'US', { data: { list } }, url).rows).toHaveLength(5);
  });
});
