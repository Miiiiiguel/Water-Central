import { describe, expect, it } from 'vitest';
import { leerProductos, palabraClave, porMarca, runJungleScout, toResult } from './junglescout';

// Respuestas armadas con la forma que documenta la API de Jungle Scout
// (JSON:API: data[].attributes). Desde este entorno la API no es
// alcanzable; la primera prueba real es una consulta en producción.

const producto = (asin: string, marca: string, ingresos: number | null, unidades: number | null, precio = 19.99) => ({
  id: `us/${asin}`,
  type: 'product_database_result',
  attributes: {
    title: `Coffee ${asin}`,
    brand: marca,
    price: precio,
    approximate_30_day_revenue: ingresos,
    approximate_30_day_units_sold: unidades,
    reviews: 1200,
  },
});

const cuerpo = {
  data: [
    producto('B01', 'Juan Valdez', 120000, 6000),
    producto('B02', 'Lavazza', 90000, 5000),
    producto('B03', 'juan valdez', 30000, 1500),
    producto('B04', '', 5000, 250),
    producto('B05', 'Lavazza', null, null),
  ],
  meta: { total_items: 1840 },
};

describe('leer productos', () => {
  it('saca el ASIN del id y marca vacía como "Sin marca"', () => {
    const { productos, total } = leerProductos(cuerpo);
    expect(productos[0].asin).toBe('B01');
    expect(productos[3].marca).toBe('Sin marca');
    expect(total).toBe(1840);
  });

  it('un número que falta queda como desconocido, no como cero', () => {
    expect(leerProductos(cuerpo).productos[4].ingresos30).toBeNull();
  });

  it('una respuesta sin data no rompe', () => {
    expect(leerProductos({}).productos).toEqual([]);
    expect(leerProductos(null).productos).toEqual([]);
  });
});

describe('ventas por marca', () => {
  it('suma por marca sin importar mayúsculas y ordena por ingresos', () => {
    const marcas = porMarca(leerProductos(cuerpo).productos);
    expect(marcas[0]).toEqual({ marca: 'Juan Valdez', ingresos30: 150000, unidades30: 7500, productos: 2 });
    expect(marcas[1]).toMatchObject({ marca: 'Lavazza', ingresos30: 90000, productos: 2 });
  });

  it('el resumen dice que son estimaciones, y no nombra al proveedor', () => {
    const r = toResult('café', 'US', cuerpo);
    expect(r.summary).toContain('ESTIMADAS');
    expect(r.summary).toContain('Amazon US');
    expect(r.rows[0].label).toBe('Juan Valdez');
    expect(r.rows[0].value).toContain('USD 150,000/mes');
    expect(r.rows[0].value).toContain('61 %'); // 150.000 de 245.000
    const visible = [r.summary, ...r.rows.map((x) => `${x.label} ${x.value}`)].join(' ');
    expect(visible).not.toMatch(/jungle ?scout/i);
  });

  it('en otro mercado usa su moneda', () => {
    expect(toResult('café', 'MX', cuerpo).rows[0].value).toContain('MXN');
  });

  it('sin productos lo dice', () => {
    expect(toResult('nada', 'US', { data: [] }).summary).toContain('Sin productos');
  });
});

describe('la palabra clave', () => {
  it('en amazon.com va en inglés', () => {
    expect(palabraClave('café tostado', true)).toBe('roasted coffee');
  });
  it('en México se deja en español', () => {
    expect(palabraClave('café tostado', false)).toBe('café tostado');
  });
  it('una palabra ya en inglés queda igual', () => {
    expect(palabraClave('yoga mat', true)).toBe('yoga mat');
  });
});

describe('la llamada', () => {
  const env = { JUNGLESCOUT_API_KEY_NAME: 'easycomex', JUNGLESCOUT_API_KEY: 'secreto' } as NodeJS.ProcessEnv;

  it('va al mercado pedido, con la autenticación de Jungle Scout y la palabra en inglés', async () => {
    let visto: { url: string; init: RequestInit } | null = null;
    const hacer = (async (url: string, init: RequestInit) => {
      visto = { url, init };
      return new Response(JSON.stringify(cuerpo), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await runJungleScout('café', 'US', hacer, env);
    expect(r.rows[0].label).toBe('Juan Valdez');
    expect(visto!.url).toContain('marketplace=us');
    const h = visto!.init.headers as Record<string, string>;
    expect(h.Authorization).toBe('easycomex:secreto');
    expect(h['X-API-Type']).toBe('junglescout');
    expect(h['X_API_Type']).toBeUndefined();
    expect(JSON.parse(visto!.init.body as string).data.attributes.include_keywords).toEqual(['coffee']);
  });

  it('Reino Unido va como "uk"', async () => {
    let url = '';
    const hacer = (async (u: string) => {
      url = u;
      return new Response(JSON.stringify(cuerpo), { status: 200 });
    }) as unknown as typeof fetch;
    await runJungleScout('coffee', 'GB', hacer, env);
    expect(url).toContain('marketplace=uk');
  });

  it('un error de la API falla con su detalle para el log, sin la llave', async () => {
    const hacer = (async () =>
      new Response(JSON.stringify({ errors: [{ title: 'Unauthorized', detail: 'Invalid API key' }] }), { status: 401 })) as unknown as typeof fetch;
    const err = (await runJungleScout('coffee', 'US', hacer, env).catch((e) => e)) as Error;
    expect(err.message).toContain('401');
    expect(err.message).toContain('Invalid API key');
    expect(err.message).not.toContain('secreto');
  });

  it('sin llaves no llama a nadie', async () => {
    let llamadas = 0;
    const hacer = (async () => {
      llamadas++;
      return new Response('{}');
    }) as unknown as typeof fetch;
    await expect(runJungleScout('coffee', 'US', hacer, {} as NodeJS.ProcessEnv)).rejects.toThrow('JUNGLESCOUT_API_KEY');
    expect(llamadas).toBe(0);
  });
});

describe('tipo de API y diagnóstico', async () => {
  const { runJungleScout, probarAmazon, olvidarTipo } = await import('./junglescout');
  const ENV = { JUNGLESCOUT_API_KEY_NAME: 'nombre', JUNGLESCOUT_API_KEY: 'llave' } as NodeJS.ProcessEnv;
  const ok = { data: [{ id: 'us/B01', attributes: { title: 'Coffee', brand: 'Marca', price: 10, approximate_30_day_revenue: 1000, approximate_30_day_units_sold: 100 } }], meta: { total_items: 1 } };
  const respuesta = (status: number, cuerpo: unknown) => ({ status, ok: status < 400, json: async () => cuerpo }) as unknown as Response;

  it('retries as an Enterprise (cobalt) account when the regular type is not authorized, and remembers it', async () => {
    olvidarTipo();
    const tipos: string[] = [];
    const hacer = (async (_u: string, init: RequestInit) => {
      const t = (init.headers as Record<string, string>)['X-API-Type'];
      tipos.push(t);
      return t === 'cobalt' ? respuesta(200, ok) : respuesta(401, { errors: [{ title: 'Unauthorized' }] });
    }) as unknown as typeof fetch;
    const r = await runJungleScout('coffee', 'US', hacer, ENV);
    expect(r.rows.length).toBeGreaterThan(0);
    expect(tipos).toEqual(['junglescout', 'cobalt']);
    await runJungleScout('coffee', 'US', hacer, ENV);
    expect(tipos.slice(2)).toEqual(['cobalt']);
    olvidarTipo();
  });

  it('respects a fixed JUNGLESCOUT_API_TYPE and says why it failed', async () => {
    olvidarTipo();
    const tipos: string[] = [];
    const hacer = (async (_u: string, init: RequestInit) => {
      tipos.push((init.headers as Record<string, string>)['X-API-Type']);
      return respuesta(403, { errors: [{ detail: 'API access not enabled' }] });
    }) as unknown as typeof fetch;
    await expect(runJungleScout('coffee', 'US', hacer, { ...ENV, JUNGLESCOUT_API_TYPE: 'junglescout' })).rejects.toThrow(/403 \(API access not enabled\).*plan con API/);
    expect(tipos).toEqual(['junglescout']);
  });

  it('probarAmazon reports missing variables, a working key, and a rejected one', async () => {
    olvidarTipo();
    expect(await probarAmazon(fetch, {} as NodeJS.ProcessEnv)).toMatchObject({ ok: false, status: null, detalle: 'faltan JUNGLESCOUT_API_KEY_NAME y JUNGLESCOUT_API_KEY' });
    expect(await probarAmazon((async () => respuesta(200, ok)) as unknown as typeof fetch, ENV)).toMatchObject({ ok: true, status: 200, tipo: 'junglescout', productos: 1 });
    olvidarTipo();
    const rechazo = await probarAmazon((async () => respuesta(401, { errors: [{ title: 'Unauthorized' }] })) as unknown as typeof fetch, ENV);
    expect(rechazo).toMatchObject({ ok: false, status: 401, detalle: 'Unauthorized' });
    expect(rechazo.explicacion).toMatch(/JUNGLESCOUT_API_KEY_NAME/);
    olvidarTipo();
  });
});
