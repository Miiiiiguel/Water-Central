import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { randomBytes } from 'node:crypto';

// Las rutas de verdad (webhooks firmados, lote, API con llave, conexión de
// tiendas) contra una base en memoria y tiendas de mentira: lo que no se
// puede probar sin una tienda real es solo que Shopify/Woo respondan como
// dice su documentación.

vi.mock('../auth', () => ({
  requireUser: () => (req: any, res: any, next: any) => {
    const quien = req.header('x-test-user');
    if (!quien) return res.status(401).json({ error: 'sin_sesion' });
    res.locals.auth = { user: { id: quien, email: `${quien}@x.co` }, profile: { id: quien, role: quien === 'staff' ? 'vendedor' : 'cliente' } };
    next();
  },
  requireRole: () => (req: any, res: any, next: any) => {
    if (req.header('x-test-user') !== 'staff') return res.status(403).json({ error: 'Forbidden' });
    res.locals.auth = { user: { id: 'staff', email: 's@x.co' }, profile: { id: 'staff', role: 'vendedor' } };
    next();
  },
}));
vi.mock('../monitoring', () => ({ captureException: () => undefined, captureSecurityEvent: () => undefined, initMonitoring: () => undefined, attachErrorMonitoring: () => undefined, isMonitoringEnabled: () => false }));

import { crearInventarioRouter } from './route';
import { dbFalsa } from './testing';
import { cifrar, descifrar, hashLlave } from './crypto';
import { crearEstado, leerEstado } from './shopifyOAuth';
import { createHmac } from 'node:crypto';
import * as shopify from './shopify';
import * as woo from './woocommerce';

const CLAVE = randomBytes(32).toString('base64');
const U = 'user-1';
const SHOP_ID = '11111111-1111-4111-8111-111111111111';
const WOO_ID = '22222222-2222-4222-8222-222222222222';
const BASE = 'https://casillero.test';
const publica = async () => ['93.184.216.34'];

type Llamada = { url: string; metodo: string; cuerpo?: any };
let llamadas: Llamada[];
let respuestas: (url: string, init: RequestInit) => Response | undefined;
const tienda = (async (url: string, init: RequestInit = {}) => {
  llamadas.push({ url, metodo: init.method ?? 'GET', cuerpo: init.body ? JSON.parse(String(init.body)) : undefined });
  return respuestas(url, init) ?? new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
}) as unknown as typeof fetch;
const ok = (c: unknown, h: Record<string, string> = {}) => new Response(JSON.stringify(c), { status: 200, headers: { 'content-type': 'application/json', ...h } });

let servidor: Server;
let url: string;
let g: ReturnType<typeof dbFalsa>;

function sembrar() {
  g = dbFalsa({
    profiles: [{ id: U, casillero_codigo: 'DM1001' }, { id: 'staff', casillero_codigo: 'DM1000' }],
    casillero_productos: [{ id: 'p-cam', user_id: U, sku: 'CAM-01', nombre: 'Camiseta' }, { id: 'p-gor', user_id: U, sku: 'GOR-02', nombre: 'Gorra' }],
    casillero_inv_mov: [{ id: 'm0', producto_id: 'p-cam', user_id: U, tipo: 'ingreso', cantidad: 100, ref_externa: null }, { id: 'm1', producto_id: 'p-gor', user_id: U, tipo: 'ingreso', cantidad: 50, ref_externa: null }],
    casillero_integraciones: [
      { id: SHOP_ID, user_id: U, plataforma: 'shopify', dominio: 'mi-tienda.myshopify.com', ubicacion_id: '777', webhooks: [], sync_stock: false },
      { id: WOO_ID, user_id: U, plataforma: 'woocommerce', dominio: 'https://mitienda.com', ubicacion_id: null, webhooks: [], sync_stock: false },
    ],
    casillero_integraciones_secretos: [
      { integracion_id: SHOP_ID, secretos_cifrados: cifrar(JSON.stringify({ token: 'shpat_x', secretoApi: 'secreto-shop' })), webhook_secret: 'secreto-shop' },
      { integracion_id: WOO_ID, secretos_cifrados: cifrar(JSON.stringify({ clave: 'ck_abcdefghij', secreto: 'cs_abcdefghij' })), webhook_secret: 'secreto-woo' },
    ],
    casillero_productos_externos: [
      { producto_id: 'p-cam', integracion_id: SHOP_ID, externo_id: '9001', externo_extra: null },
      { producto_id: 'p-cam', integracion_id: WOO_ID, externo_id: '10', externo_extra: '501' },
    ],
  });
}

beforeAll(async () => {
  process.env.INTEGRATIONS_ENC_KEY = CLAVE;
  process.env.SHOPIFY_CLIENT_ID = 'cid-test';
  process.env.SHOPIFY_CLIENT_SECRET = 'secreto-de-la-app';
  const app = express();
  app.use('/api', crearInventarioRouter({ admin: () => g.db, fetchFn: tienda, resolver: publica, urlPublica: () => BASE }));
  servidor = app.listen(0);
  url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;
});
afterAll(() => { servidor.close(); });
beforeEach(() => { sembrar(); llamadas = []; respuestas = () => undefined; });

const post = (ruta: string, cuerpo: unknown, h: Record<string, string> = {}) =>
  fetch(`${url}${ruta}`, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) });
const disponibles = (sku: string) => g.inventario().find((p) => p.sku === sku)!.disponibles as number;
const eventos = (tipo?: string) => g.filas('casillero_integracion_eventos').filter((e) => !tipo || e.tipo === tipo);

describe('webhooks de Shopify', () => {
  const pedido = { id: 1001, line_items: [{ id: 1, sku: 'CAM-01', quantity: 3 }, { id: 2, sku: 'NO-EXISTE', quantity: 2 }] };
  const enviar = (cuerpo: unknown, tema: string, secreto = 'secreto-shop', dominio = 'mi-tienda.myshopify.com') => {
    const crudo = JSON.stringify(cuerpo);
    return post(`/inventario/webhooks/shopify/${SHOP_ID}`, crudo, { 'x-shopify-hmac-sha256': shopify.firmaWebhook(crudo, secreto), 'x-shopify-topic': tema, 'x-shopify-shop-domain': dominio });
  };

  it('rechaza un aviso sin firma o con firma de otro secreto', async () => {
    expect((await post(`/inventario/webhooks/shopify/${SHOP_ID}`, pedido)).status).toBe(401);
    expect((await enviar(pedido, 'orders/paid', 'otro-secreto')).status).toBe(401);
    expect(disponibles('CAM-01')).toBe(100);
  });

  it('un pedido pagado descuenta por SKU, guarda el SKU desconocido como pendiente y no se repite', async () => {
    const r1 = await (await enviar(pedido, 'orders/paid')).json();
    expect(r1).toEqual({ aplicadas: 1, sin_producto: ['NO-EXISTE'] });
    expect(disponibles('CAM-01')).toBe(97);
    expect(eventos('sin_producto')).toHaveLength(1);
    expect(eventos('sin_producto')[0].detalle).toMatchObject({ sku: 'NO-EXISTE', tipo: 'venta', cantidad: -2, ref_externa: 'shopify:order:1001:2' });
    await enviar(pedido, 'orders/paid'); // Shopify reenvía
    expect(disponibles('CAM-01')).toBe(97);
    expect(eventos('sin_producto')).toHaveLength(1);
    expect(eventos('webhook').length).toBeGreaterThan(0);
  });

  it('cancelar devuelve el stock; cancelar un pedido con SKU pendiente descarta el pendiente', async () => {
    await enviar(pedido, 'orders/paid');
    await enviar(pedido, 'orders/cancelled');
    expect(disponibles('CAM-01')).toBe(100);
    expect(eventos('sin_producto')[0].resuelto).toBe(true);
    await enviar(pedido, 'orders/cancelled'); // repetido
    expect(disponibles('CAM-01')).toBe(100);
  });

  it('un reembolso repone solo lo que la tienda marcó para reponer, y una sola vez', async () => {
    await enviar(pedido, 'orders/paid');
    const reembolso = { id: 55, order_id: 1001, refund_line_items: [{ line_item_id: 1, quantity: 2, restock_type: 'return', line_item: { sku: 'CAM-01' } }, { line_item_id: 2, quantity: 1, restock_type: 'no_restock', line_item: { sku: 'NO-EXISTE' } }] };
    await enviar(reembolso, 'refunds/create');
    await enviar(reembolso, 'refunds/create');
    expect(disponibles('CAM-01')).toBe(99); // 100 - 3 + 2
  });

  it('ignora avisos de otra tienda y temas que no usa', async () => {
    expect(await (await enviar(pedido, 'orders/paid', 'secreto-shop', 'otra.myshopify.com')).json()).toEqual({ ignorado: 'otra_tienda' });
    expect(await (await enviar(pedido, 'products/update')).json()).toEqual({ ignorado: 'products/update' });
    expect(disponibles('CAM-01')).toBe(100);
  });

  it('con "mantener stock" activo, una venta empuja el stock nuevo a la tienda', async () => {
    g.filas('casillero_integraciones')[0].sync_stock = true;
    await enviar(pedido, 'orders/paid');
    const set = llamadas.find((l) => l.url.endsWith('/inventory_levels/set.json'))!;
    expect(set.cuerpo).toEqual({ location_id: 777, inventory_item_id: 9001, available: 97 });
  });
});

describe('webhooks de WooCommerce', () => {
  const orden = (status: string) => ({ id: 88, status, line_items: [{ id: 5, sku: 'CAM-01', quantity: 4 }] });
  const enviar = (cuerpo: string | object, secreto = 'secreto-woo') => {
    const crudo = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
    return post(`/inventario/webhooks/woocommerce/${WOO_ID}`, crudo, { 'x-wc-webhook-signature': woo.firmaWebhook(crudo, secreto) });
  };

  it('el aviso de prueba que Woo manda al crear el webhook se contesta sin tocar nada', async () => {
    expect(await (await enviar('webhook_id=3')).json()).toEqual({ ping: true });
  });
  it('descuenta cuando el pedido pasa a processing, no por estados intermedios, y se anula al cancelar', async () => {
    expect(await (await enviar(orden('pending'))).json()).toEqual({ ignorado: 'pending' });
    expect(disponibles('CAM-01')).toBe(100);
    await enviar(orden('processing'));
    await enviar(orden('completed')); // otro cambio de estado del mismo pedido
    expect(disponibles('CAM-01')).toBe(96);
    await enviar(orden('cancelled'));
    expect(disponibles('CAM-01')).toBe(100);
  });
  it('rechaza una firma inválida', async () => {
    expect((await enviar(orden('processing'), 'otro')).status).toBe(401);
  });
});

describe('la ruta de movimientos del equipo', () => {
  const lote = (items: unknown[], usuario = 'staff') => post('/inventario/movimientos', { items }, { 'x-test-user': usuario });
  it('solo el equipo puede registrar movimientos', async () => {
    expect((await lote([{ codigo: 'DM1001', sku: 'CAM-01', tipo: 'ingreso', cantidad: 5 }], U)).status).toBe(403);
  });
  it('el ingreso masivo aplica las filas buenas y explica las malas', async () => {
    const r = await (await lote([
      { codigo: 'DM1001', sku: 'CAM-01', tipo: 'ingreso', cantidad: 20 },
      { codigo: 'DM1001', sku: 'NOPE', tipo: 'ingreso', cantidad: 5 },
      { codigo: 'DM9999', sku: 'CAM-01', tipo: 'ingreso', cantidad: 5 },
      { codigo: 'DM1001', sku: 'GOR-02', tipo: 'ajuste', cantidad: -4 },
    ])).json();
    expect(r.aplicados).toBe(2);
    expect(r.resultados.map((x: any) => x.ok)).toEqual([true, false, false, true]);
    expect(r.resultados[1].error).toMatch(/NOPE/);
    expect(r.resultados[2].error).toMatch(/DM9999/);
    expect(disponibles('CAM-01')).toBe(120);
    expect(disponibles('GOR-02')).toBe(46);
  });
  it('un ingreso empuja el stock a las tiendas que lo pidieron', async () => {
    g.filas('casillero_integraciones')[1].sync_stock = true;
    await lote([{ codigo: 'DM1001', sku: 'CAM-01', tipo: 'ingreso', cantidad: 10 }]);
    const put = llamadas.find((l) => l.metodo === 'PUT')!;
    expect(put.url).toBe('https://mitienda.com/wp-json/wc/v3/products/10/variations/501');
    expect(put.cuerpo).toEqual({ manage_stock: true, stock_quantity: 110 });
  });
});

describe('API con llave', () => {
  const KEY = `ecx_${'a'.repeat(64)}`;
  beforeEach(() => { g.filas('casillero_api_keys').push({ id: 'k1', user_id: U, nombre: 'ERP', prefijo: 'ecx_aaaa', hash: hashLlave(KEY) }); });
  const h = { authorization: `Bearer ${KEY}` };

  it('sin llave o con llave falsa no entra', async () => {
    expect((await fetch(`${url}/v1/inventario`)).status).toBe(401);
    expect((await fetch(`${url}/v1/inventario`, { headers: { authorization: `Bearer ecx_${'b'.repeat(64)}` } })).status).toBe(401);
  });
  it('lista solo el stock del dueño de la llave', async () => {
    g.filas('casillero_productos').push({ id: 'p-otro', user_id: 'otro', sku: 'AJENO', nombre: 'Ajeno' });
    const r = await (await fetch(`${url}/v1/inventario`, { headers: h })).json();
    expect(r.productos.map((p: any) => p.sku).sort()).toEqual(['CAM-01', 'GOR-02']);
    expect((await fetch(`${url}/v1/inventario/AJENO`, { headers: h })).status).toBe(404);
  });
  it('una venta con la misma referencia no se descuenta dos veces', async () => {
    const venta = () => post('/v1/inventario/ventas', { sku: 'CAM-01', cantidad: 2, referencia: 'pedido-7' }, h);
    expect((await (await venta()).json())).toEqual({ ok: true, duplicado: false });
    expect((await (await venta()).json())).toEqual({ ok: true, duplicado: true });
    expect(disponibles('CAM-01')).toBe(98);
    expect((await post('/v1/inventario/ventas', { sku: 'CAM-01', cantidad: 0, referencia: 'x' }, h)).status).toBe(400);
    expect((await post('/v1/inventario/ventas', { sku: 'NOPE', cantidad: 1, referencia: 'y' }, h)).status).toBe(404);
  });
});

describe('conectar tiendas', () => {
  it('Shopify: valida el dominio, guarda las llaves cifradas, registra los avisos y deja constancia', async () => {
    g = dbFalsa({});
    respuestas = (u) => {
      if (u.endsWith('/shop.json')) return ok({ shop: { name: 'Mi Tienda' } });
      if (u.endsWith('/locations.json')) return ok({ locations: [{ id: 42, active: true }] });
      if (u.endsWith('/webhooks.json')) return ok({ webhook: { id: 7 } });
    };
    const mala = await post('/inventario/integraciones/shopify', { dominio: 'evil.com', token: 'shpat_123456789', secretoApi: 'secreto12' }, { 'x-test-user': U });
    expect(mala.status).toBe(400);
    const r = await post('/inventario/integraciones/shopify', { dominio: 'https://Mi-Tienda.myshopify.com/', token: 'shpat_123456789', secretoApi: 'secreto12' }, { 'x-test-user': U });
    expect(await r.json()).toMatchObject({ nombre: 'Mi Tienda' });
    const fila = g.filas('casillero_integraciones')[0];
    expect(fila).toMatchObject({ dominio: 'mi-tienda.myshopify.com', ubicacion_id: '42', user_id: U });
    expect(fila.webhooks).toHaveLength(3); // paid, cancelled, refunds
    const sec = g.filas('casillero_integraciones_secretos')[0];
    expect(sec.secretos_cifrados.startsWith('v1.')).toBe(true);
    expect(sec.secretos_cifrados).not.toContain('shpat_123456789');
    expect(llamadas.filter((l) => l.url.endsWith('/webhooks.json') && l.metodo === 'POST').map((l) => l.cuerpo.webhook.address)[0]).toBe(`${BASE}/api/inventario/webhooks/shopify/${fila.id}`);
    expect(eventos('conexion')).toHaveLength(1);
    // la misma tienda otra vez
    expect((await post('/inventario/integraciones/shopify', { dominio: 'mi-tienda.myshopify.com', token: 'shpat_123456789', secretoApi: 'secreto12' }, { 'x-test-user': U })).status).toBe(409);
  });

  it('Shopify: si no se pueden registrar los avisos, no queda una conexión a medias', async () => {
    g = dbFalsa({});
    respuestas = (u, init) => {
      if (u.endsWith('/shop.json')) return ok({ shop: { name: 'T' } });
      if (u.endsWith('/locations.json')) return ok({ locations: [{ id: 1, active: true }] });
      if (u.endsWith('/webhooks.json') && init.method === 'POST') return new Response('{}', { status: 403 });
    };
    const r = await post('/inventario/integraciones/shopify', { dominio: 'mi-tienda.myshopify.com', token: 'shpat_123456789', secretoApi: 'secreto12' }, { 'x-test-user': U });
    expect(r.status).toBe(422);
    expect(g.filas('casillero_integraciones')).toHaveLength(0);
  });

  it('WooCommerce: rechaza direcciones internas antes de hacer ninguna llamada', async () => {
    g = dbFalsa({});
    const intento = (u: string) => post('/inventario/integraciones/woocommerce', { url: u, clave: 'ck_abcdefghij', secreto: 'cs_abcdefghij' }, { 'x-test-user': U });
    for (const u of ['http://mitienda.com', 'https://169.254.169.254', 'https://localhost', 'https://10.0.0.1']) expect((await intento(u)).status).toBe(422);
    expect(llamadas).toHaveLength(0);
  });

  it('WooCommerce: conecta, crea los dos avisos con un secreto propio y exige sesión', async () => {
    g = dbFalsa({});
    respuestas = (u, init) => {
      if (u.includes('/products?per_page=1')) return ok([]);
      if (u.endsWith('/webhooks') && init.method === 'POST') return ok({ id: 9 });
    };
    expect((await post('/inventario/integraciones/woocommerce', { url: 'https://mitienda.com', clave: 'ck_abcdefghij', secreto: 'cs_abcdefghij' }, {})).status).toBe(401);
    const r = await post('/inventario/integraciones/woocommerce', { url: 'https://MiTienda.com/', clave: 'ck_abcdefghij', secreto: 'cs_abcdefghij' }, { 'x-test-user': U });
    expect(r.status).toBe(200);
    expect(g.filas('casillero_integraciones')[0].dominio).toBe('https://mitienda.com');
    const hooks = llamadas.filter((l) => l.metodo === 'POST' && l.url.endsWith('/webhooks'));
    expect(hooks.map((h) => h.cuerpo.topic)).toEqual(['order.created', 'order.updated']);
    expect(hooks[0].cuerpo.secret).toBe(g.filas('casillero_integraciones_secretos')[0].webhook_secret);
  });
});

describe('diagnóstico y reparación', () => {
  const mio = `${BASE}/api/inventario/webhooks/shopify/${SHOP_ID}`;
  it('avisa qué falta cuando la tienda no está mandando todos los avisos', async () => {
    respuestas = (u) => {
      if (u.endsWith('/shop.json')) return ok({ shop: { name: 'T' } });
      if (u.endsWith('/locations.json')) return ok({ locations: [{ id: 1, active: true }] });
      if (u.includes('/webhooks.json')) return ok({ webhooks: [{ id: 1, topic: 'orders/paid', address: mio }] });
    };
    const r = await (await post(`/inventario/integraciones/${SHOP_ID}/diagnostico`, {}, { 'x-test-user': U })).json();
    const por = Object.fromEntries(r.chequeos.map((c: any) => [c.id, c]));
    expect(por.credenciales.ok).toBe(true);
    expect(por.avisos.ok).toBe(false);
    expect(por.avisos.detalle).toMatch(/orders\/cancelled.*refunds\/create/);
    expect(por.catalogo.ok).toBe(true);
  });
  it('si las credenciales ya no sirven, lo dice y no sigue', async () => {
    respuestas = () => new Response('{}', { status: 401 });
    const r = await (await post(`/inventario/integraciones/${SHOP_ID}/diagnostico`, {}, { 'x-test-user': U })).json();
    expect(r.chequeos).toHaveLength(1);
    expect(r.chequeos[0]).toMatchObject({ id: 'credenciales', ok: false });
  });
  it('reparar borra los avisos nuestros y los crea de nuevo', async () => {
    respuestas = (u, init) => {
      if (u.includes('/webhooks.json') && (init.method ?? 'GET') === 'GET') return ok({ webhooks: [{ id: 1, topic: 'orders/paid', address: mio }, { id: 2, topic: 'orders/paid', address: 'https://otra-app.com/x' }] });
      if (u.endsWith('/webhooks.json') && init.method === 'POST') return ok({ webhook: { id: 100 + llamadas.length } });
    };
    const r = await (await post(`/inventario/integraciones/${SHOP_ID}/reparar`, {}, { 'x-test-user': U })).json();
    expect(r.creados).toBe(3);
    const borrados = llamadas.filter((l) => l.metodo === 'DELETE').map((l) => l.url);
    expect(borrados).toEqual([expect.stringContaining('/webhooks/1.json')]); // el de otra app no se toca
  });
  it('un cliente no puede operar la tienda de otro', async () => {
    expect((await post(`/inventario/integraciones/${SHOP_ID}/diagnostico`, {}, { 'x-test-user': 'intruso' })).status).toBe(404);
    expect((await post(`/inventario/integraciones/${SHOP_ID}/sincronizar`, {}, { 'x-test-user': 'intruso' })).status).toBe(404);
    expect(llamadas).toHaveLength(0);
  });
});

describe('importar y sincronizar', () => {
  it('importa el catálogo sin pisar productos existentes y registra el evento', async () => {
    respuestas = (u) => {
      if (u.includes('/products.json')) return ok({ products: [
        { title: 'Camiseta', body_html: '<p>nueva descripción</p>', image: null, variants: [{ sku: 'CAM-01', title: 'Default Title', inventory_item_id: 9001 }] },
        { title: 'Zapatos', body_html: null, image: null, variants: [{ sku: 'ZAP-9', title: 'Default Title', inventory_item_id: 9002 }] }] });
    };
    const r = await (await post(`/inventario/integraciones/${SHOP_ID}/importar`, {}, { 'x-test-user': U })).json();
    expect(r).toEqual({ nuevos: 1, existentes: 1 });
    expect(g.filas('casillero_productos').find((p) => p.sku === 'CAM-01')!.descripcion).toBeUndefined(); // no se pisó
    expect(eventos('importar')[0].resumen).toMatch(/1 productos nuevos/);
  });
  it('un error de la tienda al enviar stock queda en el registro y en la conexión', async () => {
    respuestas = (u) => (u.endsWith('/inventory_levels/set.json') ? new Response('{}', { status: 422 }) : undefined);
    const r = await (await post(`/inventario/integraciones/${SHOP_ID}/sincronizar`, {}, { 'x-test-user': U })).json();
    expect(r.actualizados).toBe(0);
    expect(r.errores).toHaveLength(1);
    expect(g.filas('casillero_integraciones')[0]).toMatchObject({ estado: 'error' });
    expect(eventos('error')).toHaveLength(1);
  });
  it('Shopify: ante un 429 espera y reintenta', async () => {
    let intentos = 0;
    respuestas = (u) => {
      if (!u.endsWith('/inventory_levels/set.json')) return undefined;
      return ++intentos === 1 ? new Response('{}', { status: 429, headers: { 'retry-after': '0' } }) : ok({});
    };
    const r = await (await post(`/inventario/integraciones/${SHOP_ID}/sincronizar`, {}, { 'x-test-user': U })).json();
    expect(r.actualizados).toBe(1);
    expect(intentos).toBe(2);
  });
});

// «Conectar con Shopify»: el cliente aprueba en Shopify y vuelve conectado.
describe('conectar con Shopify (autorización)', () => {
  const APP = 'secreto-de-la-app';
  const NUEVA = 'nueva-tienda.myshopify.com';
  const permisosOk = 'read_products,read_orders,read_inventory,write_inventory,read_locations';

  /** Lo que Shopify devuelve al navegador: la consulta con su firma. */
  const retorno = (q: Record<string, string>, secreto = APP) => {
    const hmac = createHmac('sha256', secreto).update(Object.keys(q).sort().map((k) => `${k}=${q[k]}`).join('&')).digest('hex');
    return fetch(`${url}/inventario/shopify/callback?${new URLSearchParams({ ...q, hmac })}`, { redirect: 'manual' });
  };
  const destino = (r: Response) => r.headers.get('location');
  const tiendaBuena = (scope = permisosOk, estado = 200) => (u: string, init: RequestInit): Response | undefined => {
    if (u.endsWith('/admin/oauth/access_token')) return estado === 200 ? ok({ access_token: 'shpat_oauth', scope }) : new Response('{}', { status: estado });
    if (u.endsWith('/shop.json')) return ok({ shop: { name: 'Nueva Tienda' } });
    if (u.endsWith('/locations.json')) return ok({ locations: [{ id: 99, active: true }] });
    if (u.includes('/webhooks.json') && (init.method ?? 'GET') === 'GET') return ok({ webhooks: [] });
    if (u.includes('/webhooks.json') && init.method === 'POST') return ok({ webhook: { id: 70 } });
  };
  const pedir = async (dominio = NUEVA, usuario = U) => {
    const r = await post('/inventario/integraciones/shopify/autorizar', { dominio }, { 'x-test-user': usuario });
    return { r, url: r.status === 200 ? new URL((await r.json()).url) : null };
  };

  it('pedir la autorización exige sesión, una tienda válida y la app configurada', async () => {
    expect((await post('/inventario/integraciones/shopify/autorizar', { dominio: NUEVA })).status).toBe(401);
    expect((await pedir('evil.com')).r.status).toBe(400);
    expect((await pedir('https://mitienda.com')).r.status).toBe(400);
    const id = process.env.SHOPIFY_CLIENT_ID;
    delete process.env.SHOPIFY_CLIENT_ID;
    try {
      const sin = await post('/inventario/integraciones/shopify/autorizar', { dominio: NUEVA }, { 'x-test-user': U });
      expect(sin.status).toBe(503);
      expect((await sin.json()).error).toBe('shopify_sin_app');
    } finally { process.env.SHOPIFY_CLIENT_ID = id; }
  });

  it('la dirección que se da al cliente lleva la app, los permisos, el retorno y un state de ESE cliente', async () => {
    const { url: u } = await pedir('https://Nueva-Tienda.myshopify.com/');
    expect(u!.origin + u!.pathname).toBe(`https://${NUEVA}/admin/oauth/authorize`);
    expect(u!.searchParams.get('client_id')).toBe('cid-test');
    expect(u!.searchParams.get('redirect_uri')).toBe(`${BASE}/api/inventario/shopify/callback`);
    expect(u!.searchParams.get('scope')).toBe(permisosOk);
    expect(leerEstado(u!.searchParams.get('state')!, APP)).toEqual({ ok: true, userId: U, dominio: NUEVA });
    expect(llamadas).toHaveLength(0); // pedirla no toca la tienda
  });

  it('al volver de Shopify: conecta, guarda el token cifrado, crea los avisos y deja constancia', async () => {
    respuestas = tiendaBuena();
    const { url: u } = await pedir();
    const r = await retorno({ code: 'codigo_de_un_solo_uso', shop: NUEVA, state: u!.searchParams.get('state')!, timestamp: '1700000000', host: 'YWRtaW4' });
    expect(r.status).toBe(302);
    const fila = g.filas('casillero_integraciones').find((x) => x.dominio === NUEVA)!;
    expect(destino(r)).toBe(`/casillero/integraciones?shopify=ok&id=${fila.id}`);
    expect(fila).toMatchObject({ user_id: U, plataforma: 'shopify', ubicacion_id: '99' });
    expect(fila.webhooks).toHaveLength(3);

    const intercambio = llamadas.find((l) => l.url.endsWith('/admin/oauth/access_token'))!;
    expect(intercambio.cuerpo).toEqual({ client_id: 'cid-test', client_secret: APP, code: 'codigo_de_un_solo_uso' });
    const sec = g.filas('casillero_integraciones_secretos').find((x) => x.integracion_id === fila.id)!;
    expect(sec.secretos_cifrados).not.toContain('shpat_oauth');
    expect(JSON.parse(descifrar(sec.secretos_cifrados))).toEqual({ token: 'shpat_oauth', secretoApi: APP });
    expect(sec.webhook_secret).toBe(APP); // Shopify firma los avisos con la clave de la app
    expect(llamadas.filter((l) => l.metodo === 'POST' && l.url.includes('/webhooks.json'))[0].cuerpo.webhook.address).toBe(`${BASE}/api/inventario/webhooks/shopify/${fila.id}`);
    expect(eventos('conexion').some((e) => e.resumen.includes('Nueva Tienda'))).toBe(true);
  });

  it('y esa tienda ya funciona: un pedido firmado con la clave de la app descuenta el stock', async () => {
    respuestas = tiendaBuena();
    const { url: u } = await pedir();
    const r = await retorno({ code: 'codigo123', shop: NUEVA, state: u!.searchParams.get('state')!, timestamp: '1' });
    const id = new URL(destino(r)!, 'http://x').searchParams.get('id')!;
    const crudo = JSON.stringify({ id: 5001, line_items: [{ id: 1, sku: 'CAM-01', quantity: 4 }] });
    const aviso = await post(`/inventario/webhooks/shopify/${id}`, crudo, { 'x-shopify-hmac-sha256': shopify.firmaWebhook(crudo, APP), 'x-shopify-topic': 'orders/paid', 'x-shopify-shop-domain': NUEVA });
    expect(aviso.status).toBe(200);
    expect(disponibles('CAM-01')).toBe(96);
  });

  it('si la firma de Shopify no cuadra, no se hace ninguna llamada ni se guarda nada', async () => {
    respuestas = tiendaBuena();
    const { url: u } = await pedir();
    const q = { code: 'c0digo12', shop: NUEVA, state: u!.searchParams.get('state')!, timestamp: '1' };
    const antes = g.filas('casillero_integraciones').length;
    expect(destino(await retorno(q, 'clave-de-otro'))).toBe('/casillero/integraciones?shopify=error&motivo=hmac');
    expect(destino(await fetch(`${url}/inventario/shopify/callback?${new URLSearchParams(q)}`, { redirect: 'manual' }))).toBe('/casillero/integraciones?shopify=error&motivo=hmac'); // sin hmac
    expect(destino(await fetch(`${url}/inventario/shopify/callback?hmac=x&shop[a]=b&code=c0digo12`, { redirect: 'manual' }))).toBe('/casillero/integraciones?shopify=error&motivo=hmac');
    expect(llamadas).toHaveLength(0);
    expect(g.filas('casillero_integraciones')).toHaveLength(antes);
  });

  it('un state ajeno, alterado o vencido no sirve, aunque Shopify haya firmado la consulta', async () => {
    respuestas = tiendaBuena();
    const base = { code: 'c0digo12', shop: NUEVA, timestamp: '1' };
    expect(destino(await retorno({ ...base, state: crearEstado(U, NUEVA, 'otra-clave') }))).toContain('motivo=estado');
    expect(destino(await retorno({ ...base, state: 'basura.basura' }))).toContain('motivo=estado');
    expect(destino(await retorno({ ...base, state: crearEstado(U, NUEVA, APP, Date.now() - 11 * 60_000) }))).toContain('motivo=vencido');
    expect(llamadas).toHaveLength(0);
  });

  it('la tienda que vuelve debe ser la que se pidió', async () => {
    respuestas = tiendaBuena();
    const state = crearEstado(U, NUEVA, APP);
    expect(destino(await retorno({ code: 'c0digo12', shop: 'otra-tienda.myshopify.com', state, timestamp: '1' }))).toContain('motivo=tienda');
    expect(destino(await retorno({ code: 'c0digo12', shop: 'evil.com', state, timestamp: '1' }))).toContain('motivo=tienda');
    expect(llamadas).toHaveLength(0);
  });

  it('si el cliente no concedió todos los permisos, no queda conectada', async () => {
    respuestas = tiendaBuena('read_products,read_orders');
    const r = await retorno({ code: 'c0digo12', shop: NUEVA, state: crearEstado(U, NUEVA, APP), timestamp: '1' });
    expect(destino(r)).toContain('motivo=permisos');
    expect(g.filas('casillero_integraciones').some((x) => x.dominio === NUEVA)).toBe(false);
    expect(llamadas.some((l) => l.url.includes('/webhooks.json'))).toBe(false);
  });

  it('un permiso de escritura vale como el de lectura', async () => {
    respuestas = tiendaBuena('write_products,write_orders,write_inventory,write_locations');
    const r = await retorno({ code: 'c0digo12', shop: NUEVA, state: crearEstado(U, NUEVA, APP), timestamp: '1' });
    expect(destino(r)).toContain('shopify=ok');
  });

  it('si Shopify rechaza el código (vencido o repetido), lo dice y no guarda nada', async () => {
    respuestas = tiendaBuena(permisosOk, 400);
    const r = await retorno({ code: 'c0digo12', shop: NUEVA, state: crearEstado(U, NUEVA, APP), timestamp: '1' });
    expect(destino(r)).toBe('/casillero/integraciones?shopify=error&motivo=shopify');
    expect(g.filas('casillero_integraciones').some((x) => x.dominio === NUEVA)).toBe(false);
  });

  it('si no se pueden crear los avisos, no queda una conexión a medias', async () => {
    respuestas = (u, init) => (u.includes('/webhooks.json') && init.method === 'POST' ? new Response('{}', { status: 403 }) : tiendaBuena()(u, init));
    const r = await retorno({ code: 'c0digo12', shop: NUEVA, state: crearEstado(U, NUEVA, APP), timestamp: '1' });
    expect(destino(r)).toContain('motivo=shopify');
    expect(g.filas('casillero_integraciones').some((x) => x.dominio === NUEVA)).toBe(false);
  });

  it('una tienda que ya es de otra cuenta no se puede conectar a esta', async () => {
    g.filas('casillero_integraciones').push({ id: 'ajena', user_id: 'otro-cliente', plataforma: 'shopify', dominio: NUEVA, webhooks: [], sync_stock: false });
    respuestas = tiendaBuena();
    const r = await retorno({ code: 'c0digo12', shop: NUEVA, state: crearEstado(U, NUEVA, APP), timestamp: '1' });
    expect(destino(r)).toBe('/casillero/integraciones?shopify=error&motivo=ocupada');
    expect(g.filas('casillero_integraciones').filter((x) => x.dominio === NUEVA)).toHaveLength(1);
    expect(llamadas.some((l) => l.url.includes('/webhooks.json') && l.metodo === 'POST')).toBe(false);
  });

  it('volver a conectar una tienda propia renueva el token y rehace los avisos, sin duplicarla', async () => {
    respuestas = tiendaBuena();
    const dominio = 'mi-tienda.myshopify.com'; // ya conectada en sembrar() con otro token
    const r = await retorno({ code: 'c0digo12', shop: dominio, state: crearEstado(U, dominio, APP), timestamp: '1' });
    expect(destino(r)).toBe(`/casillero/integraciones?shopify=ok&id=${SHOP_ID}&reconectada=1`);
    expect(g.filas('casillero_integraciones').filter((x) => x.dominio === dominio)).toHaveLength(1);
    const sec = g.filas('casillero_integraciones_secretos').find((x) => x.integracion_id === SHOP_ID)!;
    expect(JSON.parse(descifrar(sec.secretos_cifrados)).token).toBe('shpat_oauth');
    expect(sec.webhook_secret).toBe(APP);
    expect(g.filas('casillero_integraciones').find((x) => x.id === SHOP_ID)!.webhooks).toHaveLength(3);
  });

  it('sin la app configurada en el servidor, vuelve con un aviso claro', async () => {
    const secreto = process.env.SHOPIFY_CLIENT_SECRET;
    delete process.env.SHOPIFY_CLIENT_SECRET;
    try {
      expect(destino(await fetch(`${url}/inventario/shopify/callback?code=x&hmac=y`, { redirect: 'manual' }))).toBe('/casillero/integraciones?shopify=error&motivo=config');
    } finally { process.env.SHOPIFY_CLIENT_SECRET = secreto; }
  });
});
