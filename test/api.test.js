// Pruebas de punta a punta de la API (modo local, sin tocar la base de datos real).
// Ejecutar: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3900 + Math.floor(Math.random() * 90);
const B = `http://localhost:${PORT}`;
const DB = path.join(root, 'data', 'db.json');
let srv, backup = null, cookie = '';

const j = async (url, opts = {}) => {
  const r = await fetch(B + url, { ...opts, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...(opts.headers || {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined, redirect: 'manual' });
  let body = null; try { body = await r.json(); } catch {}
  return { status: r.status, body, headers: r.headers };
};
const customer = { name: 'Cliente Prueba', email: 'cliente@prueba.co', phone: '3001234567', address: 'Calle 10 # 20-30', city: 'Cali', dept: 'Valle del Cauca' };

before(async () => {
  if (fs.existsSync(DB)) backup = fs.readFileSync(DB);
  fs.rmSync(DB, { force: true });
  const env = { ...process.env, PORT: String(PORT), NODE_ENV: 'production', BASE_URL: B, ADMIN_PASSWORD: 'clave-de-prueba', SESSION_SECRET: 'x', COD_ENABLED: 'true' };
  for (const k of ['SUPABASE_URL', 'SUPABASE_KEY', 'SHOP_API_SECRET', 'MP_ACCESS_TOKEN']) delete env[k];
  srv = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`${B}/healthz`)).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error('El servidor no arrancó');
});
after(() => { srv?.kill(); fs.rmSync(DB, { force: true }); if (backup) fs.writeFileSync(DB, backup); });

test('catálogo y configuración', async () => {
  const c = await j('/api/config');
  assert.equal(c.body.payments.contraentrega, true);
  assert.equal(c.body.payments.mercadopago, false, 'sin token no se ofrece Mercado Pago en producción');
  const p = await j('/api/products');
  assert.ok(p.body.length > 100);
  assert.ok(p.body.every(x => !('cost' in x)), 'el costo nunca se expone al público');
});

test('cabeceras de seguridad y recursos versionados', async () => {
  const r = await fetch(`${B}/`);
  const html = await r.text();
  assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  const v = html.match(/\/app\.js\?v=([a-f0-9]{10})/);
  assert.ok(v, 'app.js se referencia con versión');
  const a = await fetch(`${B}/app.js?v=${v[1]}`);
  assert.match(a.headers.get('cache-control'), /immutable/);
});

test('el demo de pagos no existe en producción', async () => {
  assert.equal((await j('/api/demo/pay/00000000-0000-0000-0000-000000000000', { method: 'POST' })).status, 404);
});

test('flujo completo: referido → compra contra entrega → despacho → comisión', async () => {
  const a = await j('/api/affiliates', { method: 'POST', body: { name: 'Vendedora Prueba', email: 'vendedora@prueba.co', phone: '3109998877' } });
  assert.equal(a.status, 200);
  const token = new URL(a.body.panel).searchParams.get('token');
  assert.equal((await j('/api/affiliates', { method: 'POST', body: { name: 'Otra', email: 'vendedora@prueba.co', phone: '3109998877' } })).status, 409, 'no permite correos duplicados');

  const before = (await j('/api/products')).body.find(p => p.id === 'UCS-0028');
  const o = await j('/api/checkout', { method: 'POST', body: { items: [{ id: 'UCS-0028', qty: 2, price: 1 }], customer, ref: a.body.code, payment_method: 'contraentrega' } });
  assert.equal(o.status, 200);
  const st = await j(`/api/orders/${o.body.orderId}/status`);
  assert.equal(st.body.subtotal, before.price * 2, 'el precio lo calcula el servidor, no el cliente');
  assert.equal(st.body.stage, 'preparing');
  assert.ok(!('customer' in st.body), 'el seguimiento público no expone datos personales');
  const after1 = (await j('/api/products')).body.find(p => p.id === 'UCS-0028');
  assert.equal(after1.stock, before.stock - 2, 'contra entrega reserva inventario');

  assert.equal((await j('/api/admin/orders')).status, 401, 'administración protegida');
  assert.equal((await j('/api/admin/login', { method: 'POST', body: { password: 'mala' } })).status, 401);
  const login = await fetch(`${B}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'clave-de-prueba' }) });
  cookie = login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'), /HttpOnly/);

  const act = (action, extra = {}) => j(`/api/admin/orders/${o.body.orderId}/action`, { method: 'POST', body: { action, ...extra } });
  assert.equal((await act('deliver')).status, 400, 'no se entrega sin despachar');
  assert.equal((await act('pack')).body.stage, 'packed');
  assert.equal((await act('ship', { carrier: 'Servientrega' })).status, 400, 'pide número de guía');
  assert.equal((await act('ship', { carrier: 'Servientrega', tracking: '123456' })).body.stage, 'shipped');
  const done = await act('deliver');
  assert.equal(done.body.stage, 'delivered');
  assert.equal(done.body.status, 'paid', 'contra entrega queda pagado al entregar');
  assert.equal(done.body.commission, Math.round(before.price * 2 * 0.1));

  const pub = await j(`/api/affiliates/${a.body.code}/stats?token=${token}`);
  assert.equal(pub.body.pending, done.body.commission);
  assert.equal(pub.body.sales, 1);
  assert.equal((await j(`/api/affiliates/${a.body.code}/stats?token=malo`)).status, 404);

  const pay = await j(`/api/admin/affiliates/${a.body.code}/payout`, { method: 'POST', body: {} });
  assert.equal(pay.body.amount, done.body.commission);
  assert.equal((await j(`/api/affiliates/${a.body.code}/stats?token=${token}`)).body.paidOut, done.body.commission);
  cookie = '';
});

test('cancelar devuelve el inventario', async () => {
  const login = await fetch(`${B}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'clave-de-prueba' }) });
  cookie = login.headers.get('set-cookie').split(';')[0];
  const before = (await j('/api/products')).body.find(p => p.id === 'UCS-0001');
  const o = await j('/api/checkout', { method: 'POST', body: { items: [{ id: 'UCS-0001', qty: 1 }], customer: { ...customer, email: 'otro@prueba.co' }, payment_method: 'contraentrega' } });
  const r = await j(`/api/admin/orders/${o.body.orderId}/action`, { method: 'POST', body: { action: 'cancel', note: 'prueba' } });
  assert.equal(r.body.stage, 'cancelled');
  assert.equal((await j('/api/products')).body.find(p => p.id === 'UCS-0001').stock, before.stock);
  cookie = '';
});

test('validaciones del checkout', async () => {
  assert.equal((await j('/api/checkout', { method: 'POST', body: { items: [], customer, payment_method: 'contraentrega' } })).status, 400);
  assert.equal((await j('/api/checkout', { method: 'POST', body: { items: [{ id: 'UCS-0001', qty: 1 }], customer: { ...customer, email: 'malo' }, payment_method: 'contraentrega' } })).status, 400);
  assert.equal((await j('/api/checkout', { method: 'POST', body: { items: [{ id: 'UCS-0001', qty: 999 }], customer, payment_method: 'contraentrega' } })).status, 400);
  assert.equal((await j('/api/checkout', { method: 'POST', body: { items: [{ id: 'UCS-0001', qty: 1 }], customer, payment_method: 'mercadopago' } })).status, 400, 'sin token, Mercado Pago no está disponible');
});

test('páginas y SEO', async () => {
  const p = await (await fetch(`${B}/p/UCS-0028`)).text();
  assert.match(p, /og:image" content="[^"]+\/og\/UCS-0028\.jpg/);
  const c = await (await fetch(`${B}/c/mascotas`)).text();
  assert.match(c, /<title>Mascotas · USACARGOS SHOP<\/title>/);
  const sm = await (await fetch(`${B}/sitemap.xml`)).text();
  assert.match(sm, /\/c\/belleza/);
  assert.equal((await fetch(`${B}/no-existe`)).status, 404);
});
