import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { SCOPES, appShopify, cambiarCodigo, crearEstado, faltanPermisos, leerEstado, rutaDeVuelta, urlAutorizar, urlRetorno, verificarHmacConsulta } from './shopifyOAuth';

const SECRETO = 'hush';
// La firma que Shopify calcula: HMAC-SHA256 (hex) del texto «k=v&k=v» con los parámetros ordenados, sin hmac.
const firmarComoShopify = (q: Record<string, string>) =>
  createHmac('sha256', SECRETO).update(Object.keys(q).sort().map((k) => `${k}=${q[k]}`).join('&')).digest('hex');
const consulta = { code: '0907a61c0c8d55e99db179b68161bc00', shop: 'some-shop.myshopify.com', state: 'abc.def', timestamp: '1337178173' };

describe('firma de la consulta de Shopify', () => {
  it('acepta una consulta bien firmada, en cualquier orden de parámetros', () => {
    const hmac = firmarComoShopify(consulta);
    expect(verificarHmacConsulta({ ...consulta, hmac }, SECRETO)).toBe(true);
    expect(verificarHmacConsulta({ timestamp: consulta.timestamp, hmac, state: consulta.state, shop: consulta.shop, code: consulta.code }, SECRETO)).toBe(true);
    expect(verificarHmacConsulta({ ...consulta, hmac: hmac.toUpperCase() }, SECRETO)).toBe(true);
  });
  it('rechaza cualquier cambio, otra clave, una firma ausente o parámetros raros', () => {
    const hmac = firmarComoShopify(consulta);
    expect(verificarHmacConsulta({ ...consulta, shop: 'otra.myshopify.com', hmac }, SECRETO)).toBe(false);
    expect(verificarHmacConsulta({ ...consulta, code: 'otro', hmac }, SECRETO)).toBe(false);
    expect(verificarHmacConsulta({ ...consulta, extra: '1', hmac }, SECRETO)).toBe(false);
    expect(verificarHmacConsulta({ ...consulta, hmac }, 'otra-clave')).toBe(false);
    expect(verificarHmacConsulta(consulta, SECRETO)).toBe(false);
    expect(verificarHmacConsulta({ ...consulta, hmac: '' }, SECRETO)).toBe(false);
    expect(verificarHmacConsulta({ ...consulta, hmac, shop: ['a', 'b'] as unknown as string }, SECRETO)).toBe(false);
    expect(verificarHmacConsulta({ ...consulta, hmac, objeto: { a: 'b' } as unknown as string }, SECRETO)).toBe(false);
  });
  it('escapa & % = como pide Shopify antes de firmar', () => {
    const q = { 'a&b': 'x%y', shop: 's.myshopify.com' };
    const hmac = createHmac('sha256', SECRETO).update('a%26b=x%25y&shop=s.myshopify.com').digest('hex');
    expect(verificarHmacConsulta({ ...q, hmac }, SECRETO)).toBe(true);
  });
  it('ignora signature (campo antiguo) al calcular', () => {
    const hmac = firmarComoShopify(consulta);
    expect(verificarHmacConsulta({ ...consulta, signature: 'viejo', hmac }, SECRETO)).toBe(true);
  });
});

describe('state firmado', () => {
  const T = 1_800_000_000_000;
  it('lleva quién lo pidió y para qué tienda, y se lee con la misma clave', () => {
    const s = crearEstado('user-1', 'mi-tienda.myshopify.com', 'clave', T);
    expect(leerEstado(s, 'clave', T + 1000)).toEqual({ ok: true, userId: 'user-1', dominio: 'mi-tienda.myshopify.com' });
  });
  it('cada uno es distinto (no se puede adivinar ni reutilizar uno ajeno)', () => {
    expect(crearEstado('u', 'a.myshopify.com', 'k', T)).not.toBe(crearEstado('u', 'a.myshopify.com', 'k', T));
  });
  it('vence a los 10 minutos', () => {
    const s = crearEstado('u', 'a.myshopify.com', 'k', T);
    expect(leerEstado(s, 'k', T + 9 * 60_000).ok).toBe(true);
    expect(leerEstado(s, 'k', T + 10 * 60_000 + 1000)).toEqual({ ok: false, motivo: 'vencido' });
  });
  it('rechaza uno alterado, de otra clave o mal formado', () => {
    const s = crearEstado('u', 'a.myshopify.com', 'k', T);
    const [cuerpo, firma] = s.split('.');
    const otro = Buffer.from(JSON.stringify({ u: 'admin', s: 'a.myshopify.com', n: 'x', e: 9_999_999_999 })).toString('base64url');
    expect(leerEstado(`${otro}.${firma}`, 'k', T)).toEqual({ ok: false, motivo: 'estado' });
    expect(leerEstado(`${cuerpo}.${firma}x`, 'k', T)).toEqual({ ok: false, motivo: 'estado' });
    expect(leerEstado(s, 'otra', T)).toEqual({ ok: false, motivo: 'estado' });
    for (const raro of ['', 'sin-punto', 'a.b.c', '.', 'a.', '.b']) expect(leerEstado(raro, 'k', T)).toEqual({ ok: false, motivo: 'estado' });
    expect(leerEstado(undefined as unknown as string, 'k', T).ok).toBe(false);
  });
});

describe('dirección de autorización y permisos', () => {
  it('apunta a la tienda con la app, los permisos, el retorno y el state', () => {
    const u = new URL(urlAutorizar({ dominio: 'mi-tienda.myshopify.com', clientId: 'cid', redirectUri: urlRetorno('https://x.co/'), estado: 'e.s' }));
    expect(u.origin + u.pathname).toBe('https://mi-tienda.myshopify.com/admin/oauth/authorize');
    expect(u.searchParams.get('client_id')).toBe('cid');
    expect(u.searchParams.get('scope')).toBe(SCOPES.join(','));
    expect(u.searchParams.get('redirect_uri')).toBe('https://x.co/api/inventario/shopify/callback');
    expect(u.searchParams.get('state')).toBe('e.s');
  });
  it('pide solo lo que usa: productos, pedidos, ubicaciones e inventario con escritura', () => {
    expect([...SCOPES]).toEqual(['read_products', 'read_orders', 'read_inventory', 'write_inventory', 'read_locations']);
  });
  it('un permiso de escritura cuenta como el de lectura; lo que falta se nombra', () => {
    expect(faltanPermisos(['read_products', 'read_orders', 'read_inventory', 'write_inventory', 'read_locations'])).toEqual([]);
    expect(faltanPermisos(['write_products', 'write_orders', 'write_inventory', 'write_locations'])).toEqual([]);
    expect(faltanPermisos(['read_products', 'read_orders', 'read_inventory'])).toEqual(['write_inventory', 'read_locations']);
    expect(faltanPermisos(['read_products', 'read_orders', 'read_inventory', 'write_inventory'])).toEqual(['read_locations']); // justo lo que faltaba antes
    expect(faltanPermisos([])).toEqual([...SCOPES]);
  });
  it('la app solo existe si están las dos claves', () => {
    expect(appShopify({ SHOPIFY_CLIENT_ID: 'a', SHOPIFY_CLIENT_SECRET: 'b' } as NodeJS.ProcessEnv)).toEqual({ clientId: 'a', clientSecret: 'b' });
    expect(appShopify({ SHOPIFY_CLIENT_ID: 'a' } as NodeJS.ProcessEnv)).toBeNull();
    expect(appShopify({ SHOPIFY_CLIENT_ID: ' ', SHOPIFY_CLIENT_SECRET: 'b' } as NodeJS.ProcessEnv)).toBeNull();
    expect(appShopify({} as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe('cambiar el código por el token', () => {
  const app = { clientId: 'cid', clientSecret: 'sec' };
  const resp = (status: number, cuerpo: unknown) => (async () => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
  it('manda el código con las claves de la app y devuelve token y permisos', async () => {
    let visto: { url: string; cuerpo: Record<string, string> } | null = null;
    const f = (async (url: string, init: RequestInit) => { visto = { url, cuerpo: JSON.parse(String(init.body)) }; return new Response(JSON.stringify({ access_token: 'shpat_1', scope: 'read_products, write_inventory' }), { status: 200 }); }) as unknown as typeof fetch;
    expect(await cambiarCodigo(f, app, 'mi-tienda.myshopify.com', 'codigo123')).toEqual({ token: 'shpat_1', permisos: ['read_products', 'write_inventory'] });
    expect(visto).toEqual({ url: 'https://mi-tienda.myshopify.com/admin/oauth/access_token', cuerpo: { client_id: 'cid', client_secret: 'sec', code: 'codigo123' } });
  });
  it('si Shopify lo rechaza o no manda token, falla con un mensaje claro', async () => {
    await expect(cambiarCodigo(resp(400, { error: 'invalid_request' }), app, 'a.myshopify.com', 'c')).rejects.toThrow(/venció o ya se usó/);
    await expect(cambiarCodigo(resp(200, {}), app, 'a.myshopify.com', 'c')).rejects.toThrow(/venció o ya se usó/);
    await expect(cambiarCodigo((async () => new Response('no es json', { status: 200 })) as unknown as typeof fetch, app, 'a.myshopify.com', 'c')).rejects.toThrow();
  });
});

describe('vuelta al portal', () => {
  it('solo lleva códigos, nunca texto de Shopify', () => {
    expect(rutaDeVuelta({ ok: true, id: 'abc', reconectada: false })).toBe('/casillero/integraciones?shopify=ok&id=abc');
    expect(rutaDeVuelta({ ok: true, id: 'abc', reconectada: true })).toBe('/casillero/integraciones?shopify=ok&id=abc&reconectada=1');
    expect(rutaDeVuelta({ ok: false, motivo: 'hmac' })).toBe('/casillero/integraciones?shopify=error&motivo=hmac');
  });
});
