import express from 'express';
import compression from 'compression';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, backend } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const PORT = Number(env.PORT || 3000);
const PROD = env.NODE_ENV === 'production';
const BASE_URL = (env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const STORE_NAME = env.STORE_NAME || 'USACARGOS SHOP';
const WHATSAPP = (env.WHATSAPP || '').replace(/\D/g, '');
const MP_TOKEN = env.MP_ACCESS_TOKEN || '';
const MP_API = env.MP_API_BASE || 'https://api.mercadopago.com';
const MP_WEBHOOK_SECRET = env.MP_WEBHOOK_SECRET || '';
const ADMIN_PASSWORD = env.ADMIN_PASSWORD || (PROD ? '' : 'admin');
const SESSION_SECRET = env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COMMISSION_PCT = Number(env.COMMISSION_PCT ?? 10);
const SHIPPING = Number(env.SHIPPING_COP ?? 12000);
const FREE_SHIPPING_FROM = Number(env.FREE_SHIPPING_FROM ?? 150000);
const COD = (env.COD_ENABLED ?? 'true') !== 'false';
const DEMO = !MP_TOKEN && !PROD; // pagos simulados solo en local
const CARRIERS = {
  Servientrega: 'https://www.servientrega.com', Coordinadora: 'https://www.coordinadora.com', 'Interrapidísimo': 'https://www.interrapidisimo.com',
  'Envía': 'https://envia.co', TCC: 'https://www.tcc.com.co', Deprisa: 'https://www.deprisa.com', '4-72': 'https://www.4-72.com.co', 'Entrega propia': '',
};
// Datos del responsable (Ley 1480 art. 50 y Ley 1581): se muestran en las páginas legales y de contacto cuando están configurados
const LEGAL = {
  name: (env.LEGAL_NAME || '').trim(), id: (env.LEGAL_ID || '').trim(), address: (env.LEGAL_ADDRESS || '').trim(),
  city: (env.LEGAL_CITY || '').trim(), email: (env.CONTACT_EMAIL || '').trim(), phone: (env.CONTACT_PHONE || '').trim(),
};
const MSG_KINDS = { peticion: 'Petición', queja: 'Queja', reclamo: 'Reclamo', sugerencia: 'Sugerencia', garantia: 'Garantía', retracto: 'Retracto', otro: 'Otro' };
const plainDesc = d => String(d || '').replace(/\s*\n\s*•\s*/g, ' · ').replace(/\s*\n\s*/g, ' ').trim();

// ---------- Catálogo en memoria (se refresca desde la base de datos) ----------
let allProducts = [], catalog = [], byId = new Map();
async function loadProducts() {
  const list = await db.products();
  allProducts = list;
  catalog = list.filter(p => p.active);
  byId = new Map(list.map(p => [p.id, p]));
}
await loadProducts().catch(e => { console.error('No se pudo cargar el catálogo', e.message); });
setInterval(() => loadProducts().catch(() => {}), 60_000).unref();

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(compression({ threshold: 1024 }));
app.use(express.json({ limit: '60kb' }));
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), geolocation=(), payment=(), microphone=(self)',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; manifest-src 'self'; worker-src 'self'",
  });
  if (PROD) res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
});

// ---------- utilidades ----------
const hits = new Map();
function limit(key, max, windowMs) {
  const t = Date.now(), arr = (hits.get(key) || []).filter(x => t - x < windowMs);
  if (arr.length >= max) return false; arr.push(t); hits.set(key, arr); return true;
}
setInterval(() => hits.clear(), 3600_000).unref();
const rateLimit = (name, max, windowMs) => (req, res, next) =>
  limit(`${name}:${req.ip}`, max, windowMs) ? next() : res.status(429).json({ error: 'Demasiadas solicitudes, intenta más tarde.' });
const str = (v, max = 200) => String(v ?? '').trim().replace(/[\u0000-\u001f<>]/g, '').slice(0, max);
const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const isPhone = s => /^\+?\d{7,15}$/.test(s.replace(/[\s-]/g, ''));
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'ref';
const money = n => Math.round(Number(n));
const nowIso = () => new Date().toISOString();
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(e => { console.error(e); res.status(500).json({ error: 'Error interno. Intenta de nuevo.' }); });
const isUuid = s => /^[0-9a-f-]{36}$/.test(String(s));

// ---------- Sesión de administrador (cookie firmada) ----------
const sign = v => crypto.createHmac('sha256', SESSION_SECRET).update(v).digest('base64url');
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(x => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
function isAdmin(req) {
  const c = cookies(req).ucs_adm; if (!c) return false;
  const [exp, sig] = c.split('.'); return !!exp && !!sig && Number(exp) > Date.now() && eq(sig, sign(exp));
}
function adminOnly(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Sesión vencida. Ingresa de nuevo.' });
  if (req.method !== 'GET' && !req.is('application/json')) return res.status(415).json({ error: 'Formato no válido' });
  next();
}

// ---------- Lógica de pedidos ----------
const event = (id, type, detail = '') => db.addEvent(id, type, detail).catch(e => console.error('evento', e.message));
async function applyStock(order, sign) {
  await db.stockAdjust(order.items, sign);
  loadProducts().catch(() => {});
}
async function markPaid(order, how) {
  if (order.status === 'paid') return order;
  const patch = { status: 'paid', paid_at: nowIso() };
  if (order.ref_code && COMMISSION_PCT > 0 && order.commission_status === 'none') { patch.commission = money(order.subtotal * COMMISSION_PCT / 100); patch.commission_status = 'pending'; }
  if (!order.stock_applied) { await applyStock(order, -1); patch.stock_applied = true; }
  const o = await db.updateOrder(order.id, patch);
  await event(order.id, 'paid', how);
  return o;
}
async function cancelOrder(order, reason, refunded = false) {
  const patch = { status: refunded ? 'refunded' : 'cancelled', fulfillment: 'cancelled', cancelled_at: nowIso() };
  if (['pending', 'none'].includes(order.commission_status)) patch.commission_status = order.commission_status === 'pending' ? 'cancelled' : 'none';
  if (order.stock_applied && !['shipped', 'delivered'].includes(order.fulfillment)) { await applyStock(order, 1); patch.stock_applied = false; }
  const o = await db.updateOrder(order.id, patch);
  await event(order.id, refunded ? 'refunded' : 'cancelled', reason);
  return o;
}
const isOpenForShipping = o => o.fulfillment !== 'cancelled' && !['failed', 'refunded', 'cancelled'].includes(o.status) && (o.status === 'paid' || o.payment_method === 'contraentrega');
function stage(o) {
  if (['cancelled', 'refunded'].includes(o.status) || o.fulfillment === 'cancelled') return 'cancelled';
  if (o.status === 'failed') return 'failed';
  if (o.fulfillment === 'delivered') return 'delivered';
  if (o.fulfillment === 'shipped') return 'shipped';
  if (o.fulfillment === 'packed') return 'packed';
  if (isOpenForShipping(o)) return 'preparing';
  return 'awaiting_payment';
}

// ---------- Estadísticas de un vendedor (referido) ----------
const LEVELS = [['Bronce', 0], ['Plata', 5], ['Oro', 20], ['Diamante', 50]];
function affiliateStats(a, orders) {
  const mine = orders.filter(o => o.ref_code === a.code && o.status !== 'failed');
  const paid = mine.filter(o => o.status === 'paid');
  const open = mine.filter(o => stage(o) !== 'cancelled' && o.status !== 'paid');
  const sum = (arr, f) => arr.reduce((s, o) => s + f(o), 0);
  const est = o => money(o.subtotal * COMMISSION_PCT / 100);
  const months = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) { const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)); months.push({ key: m.toISOString().slice(0, 7), commission: 0, sales: 0 }); }
  for (const o of paid) { const m = months.find(x => x.key === String(o.paid_at || o.created_at).slice(0, 7)); if (m) { m.commission += o.commission; m.sales++; } }
  const top = {};
  for (const o of paid) for (const i of o.items) top[i.id] = (top[i.id] || 0) + i.qty;
  let lv = 0; LEVELS.forEach(([, min], i) => { if (paid.length >= min) lv = i; });
  const next = LEVELS[lv + 1];
  return {
    name: a.name, code: a.code, link: `${BASE_URL}/?ref=${a.code}`, clicks: a.clicks || 0, commissionPct: COMMISSION_PCT, created_at: a.created_at,
    sales: paid.length, revenue: sum(paid, o => o.subtotal),
    pending: sum(paid.filter(o => o.commission_status === 'pending'), o => o.commission),
    paidOut: sum(paid.filter(o => o.commission_status === 'paid'), o => o.commission),
    toConfirm: sum(open, est), openCount: open.length,
    conversion: a.clicks ? Math.round(paid.length / a.clicks * 1000) / 10 : 0,
    level: { name: LEVELS[lv][0], next: next ? next[0] : null, nextAt: next ? next[1] : null, progress: next ? Math.min(100, Math.round((paid.length - LEVELS[lv][1]) / (next[1] - LEVELS[lv][1]) * 100)) : 100 },
    months,
    topProducts: Object.entries(top).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([id, qty]) => ({ id, qty, name: byId.get(id)?.name || id, image: byId.get(id)?.image || null })),
    orders: mine.slice(0, 100).map(o => ({
      code: o.code, date: o.created_at, total: o.subtotal, stage: stage(o),
      commission: o.status === 'paid' ? o.commission : stage(o) === 'cancelled' ? 0 : est(o),
      commission_status: o.status === 'paid' ? o.commission_status : stage(o) === 'cancelled' ? 'cancelled' : 'to_confirm',
    })),
  };
}

// ================= API pública =================
app.get('/api/config', (_req, res) => res.json({
  storeName: STORE_NAME, whatsapp: WHATSAPP, shipping: SHIPPING, freeShippingFrom: FREE_SHIPPING_FROM, commissionPct: COMMISSION_PCT, demo: DEMO,
  payments: { mercadopago: !!MP_TOKEN || DEMO, contraentrega: COD }, legal: LEGAL,
}));
app.post('/api/contact', rateLimit('contact', 5, 3600_000), wrap(async (req, res) => {
  const b = req.body || {};
  const m = { kind: MSG_KINDS[b.kind] ? b.kind : 'peticion', name: str(b.name, 80), email: str(b.email, 120).toLowerCase(), phone: str(b.phone, 20), order_code: str(b.order_code, 20).toUpperCase(), message: String(b.message ?? '').replace(/[\u0000-\u0008\u000b-\u001f<>]/g, '').trim().slice(0, 2000) };
  if (b.website) return res.json({ code: 'PQR-OK' }); // trampa para robots
  if (m.name.length < 3 || !isEmail(m.email) || (m.phone && !isPhone(m.phone)) || m.message.length < 10)
    return res.status(400).json({ error: 'Escribe tu nombre, un correo válido y un mensaje de al menos 10 caracteres.' });
  const row = await db.createMessage(m);
  res.json({ code: row.code });
}));
app.get('/api/products', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json(catalog.map(({ id, name, category, description, price, stock, image }) => ({ id, name, category, description, price, stock, image })));
});

app.post('/api/track', rateLimit('track', 60, 600_000), wrap(async (req, res) => {
  const code = str(req.body?.ref, 30).toLowerCase();
  if (code) await db.incClicks(code).catch(() => {});
  res.json({ ok: true });
}));

app.post('/api/affiliates', rateLimit('aff', 5, 3600_000), wrap(async (req, res) => {
  const name = str(req.body?.name, 80), email = str(req.body?.email, 120).toLowerCase(), phone = str(req.body?.phone, 20);
  if (name.length < 3 || !isEmail(email) || !isPhone(phone)) return res.status(400).json({ error: 'Revisa nombre, correo y celular.' });
  if (await db.getAffiliate('email', email)) return res.status(409).json({ error: 'Ese correo ya está registrado. Usa el enlace de tu panel o escríbenos para recuperarlo.' });
  let code, tries = 0;
  do { code = slug(name) + crypto.randomBytes(2).toString('hex'); tries++; } while (await db.getAffiliate('code', code) && tries < 5);
  const token = crypto.randomBytes(18).toString('hex');
  const a = await db.createAffiliate({ code, token, name, email, phone });
  res.json({ code: a.code, link: `${BASE_URL}/?ref=${a.code}`, panel: `${BASE_URL}/afiliados.html?code=${a.code}&token=${token}` });
}));

app.get('/api/affiliates/:code/stats', rateLimit('stats', 60, 600_000), wrap(async (req, res) => {
  const a = await db.getAffiliate('code', str(req.params.code, 30).toLowerCase());
  if (!a || !eq(a.token, str(req.query.token, 100))) return res.status(404).json({ error: 'Panel no encontrado' });
  res.json(affiliateStats(a, await db.listOrders({ ref: a.code })));
}));

app.post('/api/checkout', rateLimit('checkout', 10, 600_000), wrap(async (req, res) => {
  const b = req.body || {}, c = b.customer || {};
  const customer = {
    name: str(c.name, 80), email: str(c.email, 120).toLowerCase(), phone: str(c.phone, 20), doc: str(c.doc, 20),
    address: str(c.address, 160), city: str(c.city, 60), dept: str(c.dept, 60), notes: str(c.notes, 300),
  };
  if (customer.name.length < 3 || !isEmail(customer.email) || !isPhone(customer.phone) || customer.address.length < 6 || !customer.city || !customer.dept)
    return res.status(400).json({ error: 'Completa nombre, correo, celular, dirección, ciudad y departamento.' });
  const method = b.payment_method === 'contraentrega' ? 'contraentrega' : 'mercadopago';
  if (method === 'contraentrega' && !COD) return res.status(400).json({ error: 'El pago contra entrega no está disponible.' });
  if (method === 'mercadopago' && !MP_TOKEN && !DEMO) return res.status(400).json({ error: 'El pago en línea aún no está disponible. Elige pago contra entrega.' });

  const items = [];
  for (const it of (Array.isArray(b.items) ? b.items.slice(0, 40) : [])) {
    const p = byId.get(str(it.id, 20)), qty = Math.floor(Number(it.qty));
    if (!p || !p.active || !(qty >= 1)) continue;
    if (qty > Math.min(p.stock, 10)) return res.status(400).json({ error: p.stock ? `Solo quedan ${p.stock} unidades de ${p.name}.` : `${p.name} se agotó.` });
    items.push({ id: p.id, name: p.name, qty, price: p.price });
  }
  if (!items.length) return res.status(400).json({ error: 'El carrito está vacío.' });
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING;
  const total = subtotal + shipping;

  let ref_code = str(b.ref, 30).toLowerCase() || null;
  if (ref_code) { const a = await db.getAffiliate('code', ref_code); if (!a || a.email === customer.email) ref_code = null; }

  const order = await db.createOrder({ status: 'pending', payment_method: method, ref_code, customer, items, subtotal, shipping, total, stock_applied: method === 'contraentrega' });
  if (method === 'contraentrega') { await applyStock(order, -1); await event(order.id, 'created', 'Pedido contra entrega'); }
  else await event(order.id, 'created', 'Pedido en línea (Mercado Pago)');

  if (method === 'contraentrega' || !MP_TOKEN) return res.json({ orderId: order.id, code: order.code, url: `${BASE_URL}/pedido/${order.id}` });

  const pref = {
    items: [
      ...items.map(i => ({ id: i.id, title: i.name, quantity: i.qty, unit_price: i.price, currency_id: 'COP' })),
      ...(shipping ? [{ id: 'ENVIO', title: 'Envío', quantity: 1, unit_price: shipping, currency_id: 'COP' }] : []),
    ],
    payer: { name: customer.name, email: customer.email },
    external_reference: order.id,
    notification_url: `${BASE_URL}/api/mp/webhook`,
    back_urls: ['success', 'failure', 'pending'].reduce((o, k) => ({ ...o, [k]: `${BASE_URL}/pedido/${order.id}` }), {}),
    auto_return: 'approved',
    statement_descriptor: 'USACARGOS SHOP',
  };
  const r = await fetch(`${MP_API}/checkout/preferences`, { method: 'POST', headers: { Authorization: `Bearer ${MP_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(pref) });
  const j = await r.json();
  if (!r.ok) { console.error('MP preference error', r.status, j); return res.status(502).json({ error: 'No se pudo iniciar el pago. Intenta de nuevo o elige contra entrega.' }); }
  await db.updateOrder(order.id, { mp_preference_id: j.id });
  res.json({ orderId: order.id, code: order.code, url: j.init_point });
}));

// ---------- Mercado Pago ----------
function validSignature(req, dataId) {
  if (!MP_WEBHOOK_SECRET) return true;
  const sig = req.get('x-signature') || '', reqId = req.get('x-request-id') || '';
  const ts = (sig.match(/ts=([^,]+)/) || [])[1], v1 = (sig.match(/v1=([^,]+)/) || [])[1];
  if (!ts || !v1) return false;
  return eq(crypto.createHmac('sha256', MP_WEBHOOK_SECRET).update(`id:${String(dataId).toLowerCase()};request-id:${reqId};ts:${ts};`).digest('hex'), v1);
}
async function applyPayment(paymentId, expectedOrderId) {
  const r = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${MP_TOKEN}` } });
  if (!r.ok) throw new Error(`MP payment ${paymentId}: ${r.status}`);
  const p = await r.json();
  if (expectedOrderId && p.external_reference !== expectedOrderId) return;
  const order = p.external_reference && isUuid(p.external_reference) ? await db.getOrder(p.external_reference) : null;
  if (!order) return;
  if (money(p.transaction_amount) !== order.total) { console.error('Monto no coincide', order.id); return; }
  await db.updateOrder(order.id, { mp_payment_id: String(p.id) });
  if (['approved', 'authorized'].includes(p.status)) await markPaid(order, `Mercado Pago #${p.id}`);
  else if (['refunded', 'charged_back'].includes(p.status) && order.status === 'paid') await cancelOrder(order, `Reembolso en Mercado Pago #${p.id}`, true);
  else if (['rejected', 'cancelled'].includes(p.status) && order.status === 'pending') { await db.updateOrder(order.id, { status: 'failed' }); await event(order.id, 'payment_failed', `Mercado Pago: ${p.status}`); }
}
app.post('/api/mp/webhook', wrap(async (req, res) => {
  const type = req.query.type || req.query.topic || req.body?.type;
  const dataId = req.query['data.id'] || req.query.id || req.body?.data?.id;
  if (type === 'payment' && dataId && MP_TOKEN) {
    if (!validSignature(req, dataId)) return res.sendStatus(401);
    await applyPayment(dataId);
  }
  res.sendStatus(200);
}));

// Seguimiento del pedido para el cliente (sin datos personales). El id es un UUID imposible de adivinar.
app.get('/api/orders/:id/status', rateLimit('ostatus', 120, 600_000), wrap(async (req, res) => {
  const id = req.params.id;
  let o = isUuid(id) ? await db.getOrder(id) : null;
  if (!o) return res.status(404).json({ error: 'Pedido no encontrado' });
  const pid = str(req.query.payment_id, 30);
  if (pid && /^\d+$/.test(pid) && MP_TOKEN && o.status === 'pending') { try { await applyPayment(pid, o.id); o = await db.getOrder(id); } catch (e) { console.error('verificar pago', e.message); } }
  res.json({
    code: o.code, status: o.status, payment_method: o.payment_method, fulfillment: o.fulfillment, stage: stage(o),
    carrier: o.carrier, tracking: o.tracking, tracking_url: o.carrier ? CARRIERS[o.carrier] || null : null,
    created_at: o.created_at, paid_at: o.paid_at, packed_at: o.packed_at, shipped_at: o.shipped_at, delivered_at: o.delivered_at, cancelled_at: o.cancelled_at,
    items: o.items.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price, image: byId.get(i.id)?.image || null })),
    subtotal: o.subtotal, shipping: o.shipping, total: o.total,
  });
}));

if (DEMO) {
  app.post('/api/demo/pay/:id', wrap(async (req, res) => {
    const o = isUuid(req.params.id) ? await db.getOrder(req.params.id) : null;
    if (!o) return res.sendStatus(404);
    await markPaid(o, 'Pago simulado (demo)'); res.json({ ok: true });
  }));
}

// ================= Administración =================
app.post('/api/admin/login', rateLimit('login', 10, 900_000), (req, res) => {
  const pw = String(req.body?.password || '');
  if (!ADMIN_PASSWORD || !eq(pw, ADMIN_PASSWORD)) return res.status(401).json({ error: 'Contraseña incorrecta' });
  const exp = String(Date.now() + 12 * 3600_000);
  res.set('Set-Cookie', `ucs_adm=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${12 * 3600}${PROD ? '; Secure' : ''}`);
  res.json({ ok: true });
});
app.post('/api/admin/logout', (_req, res) => { res.set('Set-Cookie', `ucs_adm=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${PROD ? '; Secure' : ''}`); res.json({ ok: true }); });
app.get('/api/admin/me', (req, res) => res.json({ admin: isAdmin(req), storeName: STORE_NAME, backend, carriers: Object.keys(CARRIERS), commissionPct: COMMISSION_PCT, baseUrl: BASE_URL, whatsapp: WHATSAPP }));

const dayKey = iso => new Date(new Date(iso).getTime() - 5 * 3600_000).toISOString().slice(0, 10); // hora de Colombia
app.get('/api/admin/dashboard', adminOnly, wrap(async (_req, res) => {
  const [orders, affiliates, messages] = await Promise.all([db.listOrders(), db.listAffiliates(), db.listMessages().catch(() => [])]);
  const paid = orders.filter(o => o.status === 'paid');
  const today = dayKey(nowIso());
  const since = days => { const t = Date.now() - days * 864e5; return paid.filter(o => new Date(o.paid_at || o.created_at).getTime() >= t); };
  const total = arr => arr.reduce((s, o) => s + o.total, 0);
  const series = [];
  for (let i = 29; i >= 0; i--) { const k = dayKey(new Date(Date.now() - i * 864e5).toISOString()); series.push({ day: k, total: 0, orders: 0 }); }
  for (const o of paid) { const s = series.find(x => x.day === dayKey(o.paid_at || o.created_at)); if (s) { s.total += o.total; s.orders++; } }
  const top = {};
  for (const o of since(30)) for (const i of o.items) { top[i.id] ??= { id: i.id, name: i.name, qty: 0, revenue: 0 }; top[i.id].qty += i.qty; top[i.id].revenue += i.qty * i.price; }
  const toShip = orders.filter(o => isOpenForShipping(o) && ['unfulfilled', 'packed'].includes(o.fulfillment));
  const last30 = since(30);
  res.json({
    salesToday: total(paid.filter(o => dayKey(o.paid_at || o.created_at) === today)),
    sales7: total(since(7)), sales30: total(last30), orders30: last30.length,
    aov: last30.length ? Math.round(total(last30) / last30.length) : 0,
    toShip: toShip.length, inTransit: orders.filter(o => o.fulfillment === 'shipped').length,
    codPending: orders.filter(o => o.payment_method === 'contraentrega' && o.status === 'pending' && o.fulfillment !== 'cancelled').length,
    awaitingPayment: orders.filter(o => o.payment_method === 'mercadopago' && o.status === 'pending').length,
    commissionsOwed: orders.filter(o => o.commission_status === 'pending').reduce((s, o) => s + o.commission, 0),
    affiliates: affiliates.length, messagesNew: messages.filter(m => m.status === 'nuevo').length,
    series, topProducts: Object.values(top).sort((a, b) => b.qty - a.qty).slice(0, 5).map(t => ({ ...t, image: byId.get(t.id)?.image || null })),
    lowStock: allProducts.filter(p => p.active && p.stock <= 5).sort((a, b) => a.stock - b.stock).slice(0, 8).map(({ id, name, stock, image }) => ({ id, name, stock, image })),
    recent: orders.slice(0, 8).map(o => ({ id: o.id, code: o.code, date: o.created_at, name: o.customer?.name, city: o.customer?.city, total: o.total, stage: stage(o), payment_method: o.payment_method })),
  });
}));
const adminOrder = o => ({ ...o, stage: stage(o) });
app.get('/api/admin/messages', adminOnly, wrap(async (_req, res) => res.json(await db.listMessages())));
app.post('/api/admin/messages/:id', adminOnly, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Mensaje no encontrado' });
  const b = req.body || {}, patch = {};
  if (b.status !== undefined) { if (!['nuevo', 'en_proceso', 'resuelto'].includes(b.status)) return res.status(400).json({ error: 'Estado no válido' }); patch.status = b.status; }
  if (b.admin_note !== undefined) patch.admin_note = str(b.admin_note, 1000);
  const m = await db.updateMessage(req.params.id, patch);
  if (!m) return res.status(404).json({ error: 'Mensaje no encontrado' });
  res.json(m);
}));
app.get('/api/admin/orders', adminOnly, wrap(async (_req, res) => res.json((await db.listOrders()).map(adminOrder))));
app.get('/api/admin/orders/:id', adminOnly, wrap(async (req, res) => {
  const o = isUuid(req.params.id) ? await db.getOrder(req.params.id) : null;
  if (!o) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json({ order: adminOrder(o), events: await db.listEvents(o.id), affiliate: o.ref_code ? await db.getAffiliate('code', o.ref_code).then(a => a && { code: a.code, name: a.name, phone: a.phone }) : null });
}));
app.post('/api/admin/orders/:id/action', adminOnly, wrap(async (req, res) => {
  let o = isUuid(req.params.id) ? await db.getOrder(req.params.id) : null;
  if (!o) return res.status(404).json({ error: 'Pedido no encontrado' });
  const action = String(req.body?.action || ''), st = stage(o);
  const fail = msg => res.status(400).json({ error: msg });
  if (action === 'pack') {
    if (st !== 'preparing') return fail('Este pedido no está listo para empacar.');
    o = await db.updateOrder(o.id, { fulfillment: 'packed', packed_at: nowIso() }); await event(o.id, 'packed', 'Pedido empacado en bodega');
  } else if (action === 'ship') {
    if (!['preparing', 'packed'].includes(st)) return fail('Este pedido no se puede despachar.');
    const carrier = str(req.body?.carrier, 40), tracking = str(req.body?.tracking, 60);
    if (!carrier) return fail('Elige la transportadora.');
    if (carrier !== 'Entrega propia' && !tracking) return fail('Escribe el número de guía.');
    o = await db.updateOrder(o.id, { fulfillment: 'shipped', shipped_at: nowIso(), packed_at: o.packed_at || nowIso(), carrier, tracking: tracking || null });
    await event(o.id, 'shipped', `${carrier}${tracking ? ` · guía ${tracking}` : ''}`);
  } else if (action === 'deliver') {
    if (st !== 'shipped') return fail('Primero marca el pedido como enviado.');
    o = await db.updateOrder(o.id, { fulfillment: 'delivered', delivered_at: nowIso() }); await event(o.id, 'delivered', 'Entregado al cliente');
    if (o.payment_method === 'contraentrega' && o.status === 'pending') o = await markPaid(o, 'Pago contra entrega recibido');
  } else if (action === 'mark_paid') {
    if (o.status !== 'pending') return fail('Este pedido no está pendiente de pago.');
    o = await markPaid(o, str(req.body?.note, 120) || 'Pago confirmado manualmente');
  } else if (action === 'cancel') {
    if (['delivered', 'cancelled'].includes(st)) return fail('Este pedido no se puede cancelar.');
    o = await cancelOrder(o, str(req.body?.note, 200) || 'Cancelado por la tienda');
  } else return fail('Acción no válida');
  res.json(adminOrder(o));
}));
app.post('/api/admin/orders/:id/note', adminOnly, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Pedido no encontrado' });
  const note = str(req.body?.note, 500);
  const o = await db.updateOrder(req.params.id, { admin_note: note });
  if (note) await event(req.params.id, 'note', note);
  res.json(adminOrder(o));
}));
app.get('/api/admin/products', adminOnly, wrap(async (_req, res) => { await loadProducts(); res.json(allProducts); }));
app.post('/api/admin/products/:id', adminOnly, wrap(async (req, res) => {
  const b = req.body || {}, patch = {};
  if (b.price !== undefined) { const v = Math.round(Number(b.price)); if (!(v >= 0)) return res.status(400).json({ error: 'Precio no válido' }); patch.price = v; }
  if (b.stock !== undefined) { const v = Math.round(Number(b.stock)); if (!(v >= 0)) return res.status(400).json({ error: 'Stock no válido' }); patch.stock = v; }
  if (b.active !== undefined) patch.active = !!b.active;
  if (b.name !== undefined) { const v = str(b.name, 80).trim(); if (v.length < 3) return res.status(400).json({ error: 'Nombre muy corto' }); patch.name = v; }
  if (b.description !== undefined) patch.description = String(b.description ?? '').slice(0, 2000);
  const p = await db.productUpdate(str(req.params.id, 20), patch);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  await loadProducts(); res.json(p);
}));
app.get('/api/admin/affiliates', adminOnly, wrap(async (_req, res) => {
  const [affiliates, orders] = await Promise.all([db.listAffiliates(), db.listOrders()]);
  res.json(affiliates.map(a => { const s = affiliateStats(a, orders); return { code: a.code, name: a.name, email: a.email, phone: a.phone, created_at: a.created_at, clicks: s.clicks, sales: s.sales, revenue: s.revenue, pending: s.pending, paidOut: s.paidOut, toConfirm: s.toConfirm, conversion: s.conversion, level: s.level.name }; }).sort((x, y) => y.revenue - x.revenue));
}));
app.get('/api/admin/affiliates/:code/stats', adminOnly, wrap(async (req, res) => {
  const a = await db.getAffiliate('code', str(req.params.code, 30).toLowerCase());
  if (!a) return res.status(404).json({ error: 'Vendedor no encontrado' });
  res.json({ ...affiliateStats(a, await db.listOrders({ ref: a.code })), email: a.email, phone: a.phone, panel: `${BASE_URL}/afiliados.html?code=${a.code}&token=${a.token}` });
}));
app.post('/api/admin/affiliates/:code/payout', adminOnly, wrap(async (req, res) => {
  const orders = await db.listOrders({ ref: str(req.params.code, 30).toLowerCase() });
  let n = 0, amount = 0;
  for (const o of orders) if (o.status === 'paid' && o.commission_status === 'pending') { await db.updateOrder(o.id, { commission_status: 'paid' }); await event(o.id, 'commission_paid', `Comisión pagada al vendedor ${o.ref_code}`); n++; amount += o.commission; }
  res.json({ ok: true, orders: n, amount });
}));

// ================= Recursos estáticos minificados y versionados =================
const ASSETS = {};
async function buildAssets() {
  let esbuild = null;
  try { esbuild = await import('esbuild'); } catch { console.warn('esbuild no disponible: se sirven archivos sin minificar'); }
  for (const [file, loader, type] of [['app.js', 'js', 'application/javascript'], ['admin.js', 'js', 'application/javascript'], ['afiliados.js', 'js', 'application/javascript'], ['style.css', 'css', 'text/css'], ['admin.css', 'css', 'text/css']]) {
    const src = fs.readFileSync(path.join(__dirname, 'public', file), 'utf8');
    let code = src;
    if (esbuild) { try { code = (await esbuild.transform(src, { loader, minify: true, target: loader === 'js' ? 'es2020' : ['chrome90', 'safari14', 'firefox90'] })).code; } catch (e) { console.warn(`No se pudo minificar ${file}:`, e.message); } }
    ASSETS[file] = { body: Buffer.from(code), type, v: crypto.createHash('sha1').update(code).digest('hex').slice(0, 10) };
  }
}
await buildAssets();
const versioned = html => html.replace(/(href|src)="\/(app\.js|admin\.js|afiliados\.js|style\.css|admin\.css)"/g, (_m, attr, f) => `${attr}="/${f}?v=${ASSETS[f]?.v || '0'}"`);
for (const f of Object.keys(ASSETS)) {
  app.get(`/${f}`, (req, res) => {
    const a = ASSETS[f];
    res.set({ 'Content-Type': `${a.type}; charset=utf-8`, ETag: `"${a.v}"`, 'Cache-Control': req.query.v === a.v ? 'public, max-age=31536000, immutable' : 'no-cache' });
    if (req.get('if-none-match') === `"${a.v}"`) return res.status(304).end();
    res.send(a.body);
  });
}
const htmlFile = name => versioned(fs.readFileSync(path.join(__dirname, 'public', name), 'utf8'));
const ADMIN_HTML = htmlFile('admin.html'), AFF_HTML = htmlFile('afiliados.html');

// ================= Páginas =================
const TEMPLATE = htmlFile('index.html');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cop = n => '$' + Math.round(n).toLocaleString('es-CO');
function page(res, { title, description, image, url, product, status = 200, noindex }) {
  const meta = [
    `<meta name="description" content="${esc(description)}">`, `<link rel="canonical" href="${esc(url)}">`,
    noindex ? '<meta name="robots" content="noindex">' : '',
    `<meta property="og:site_name" content="${esc(STORE_NAME)}">`, `<meta property="og:type" content="${product ? 'product' : 'website'}">`,
    `<meta property="og:title" content="${esc(title)}">`, `<meta property="og:description" content="${esc(description)}">`, `<meta property="og:url" content="${esc(url)}">`,
    image ? `<meta property="og:image" content="${esc(image)}">\n<meta property="og:image:width" content="600">\n<meta property="og:image:height" content="600">` : '',
    '<meta name="twitter:card" content="summary_large_image">',
    product ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: product.name, sku: product.id, image, description: plainDesc(product.description), category: product.category, offers: { '@type': 'Offer', priceCurrency: 'COP', price: product.price, availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url } }).replace(/</g, '\\u003c')}</script>` : '',
  ].filter(Boolean).join('\n');
  res.status(status).set('Cache-Control', 'no-cache').type('html').send(TEMPLATE.replace('__TITLE__', esc(title)).replace('<!--META-->', meta));
}
const CAT_SEO = {
  'Belleza y Cuidado Personal': ['belleza', 'Luce y siéntete increíble, sin salir de casa.'], 'Salud y Bienestar': ['salud', 'Cuida tu cuerpo y tu descanso todos los días.'],
  'Hogar y Cocina': ['cocina', 'Cocina más rápido, más fácil y con estilo.'], 'Hogar y Limpieza': ['limpieza', 'Menos tiempo limpiando, más tiempo para ti.'],
  'Organización del Hogar': ['organizacion', 'Cada cosa en su lugar. Más espacio, menos estrés.'], 'Mascotas': ['mascotas', 'Porque ellos también merecen lo mejor.'],
  'Tecnología': ['tecnologia', 'Gadgets prácticos para tu día a día.'], 'Herramientas': ['herramientas', 'Hazlo tú mismo, y hazlo bien.'],
  'Deportes y Fitness': ['deportes', 'Entrena en casa o donde quieras.'], 'Juguetes': ['juguetes', 'Diversión garantizada para grandes y chicos.'],
  'Viaje y Outdoor': ['viaje', 'Listo para salir, a donde sea.'], 'Jardín': ['jardin', 'Tu jardín, más verde y fácil de cuidar.'], 'Moda y Accesorios': ['moda', 'Comodidad con estilo.'],
  'Automotriz': ['automotriz', 'Para tu carro o tu moto.'], 'Bebés': ['bebes', 'Lo práctico para los más pequeños.'],
};
const catBySlug = slug => Object.entries(CAT_SEO).find(([, v]) => v[0] === slug)?.[0];
const HOME_DESC = () => `Compra fácil, paga seguro y recíbelo en casa. ${catalog.length}+ productos para tu hogar, belleza, salud y mascotas. Envío a toda Colombia.`;
app.get('/p/:id', (req, res) => {
  const p = byId.get(req.params.id);
  if (!p || !p.active) return page(res, { title: `Producto no encontrado · ${STORE_NAME}`, description: HOME_DESC(), url: `${BASE_URL}/`, status: 404 });
  page(res, { title: `${p.name} · ${cop(p.price)} · ${STORE_NAME}`, description: `${p.name} por ${cop(p.price)}. ${plainDesc(p.description)}`, image: `${BASE_URL}/og/${p.id}.jpg?v=6`, url: `${BASE_URL}/p/${p.id}`, product: p });
});
app.get('/c/:slug', (req, res, next) => {
  const name = catBySlug(req.params.slug); if (!name) return next();
  const list = catalog.filter(p => p.category === name);
  page(res, { title: `${name} · ${STORE_NAME}`, description: `${CAT_SEO[name][1]} ${list.length} productos de ${name.toLowerCase()} con envío a toda Colombia.`, image: list[0] ? `${BASE_URL}/og/${list[0].id}.jpg?v=6` : '', url: `${BASE_URL}/c/${req.params.slug}` });
});
const INFO_PAGES = {
  '/nosotros': ['Quiénes somos', 'Tienda colombiana en línea con bodega propia: productos para tu hogar, belleza, salud y mascotas con envío a todo el país.'],
  '/contacto': ['Contacto y PQRS', 'Escríbenos tus peticiones, quejas, reclamos, sugerencias, solicitudes de garantía o retracto. Te respondemos por correo.'],
  '/envios': ['Envíos y entregas', 'Cómo, cuándo y cuánto cuesta el envío de tu pedido a cualquier ciudad de Colombia.'],
  '/cambios-y-garantias': ['Cambios, devoluciones y garantías', 'Derecho de retracto, garantía legal y cómo solicitar un cambio o devolución según el Estatuto del Consumidor.'],
  '/terminos': ['Términos y condiciones', 'Condiciones de uso de la tienda, compras, pagos, envíos y programa de referidos.'],
  '/privacidad': ['Política de privacidad y tratamiento de datos', 'Cómo tratamos tus datos personales conforme a la Ley 1581 de 2012.'],
};
app.get(Object.keys(INFO_PAGES), (req, res) => { const [t, d] = INFO_PAGES[req.path]; page(res, { title: `${t} · ${STORE_NAME}`, description: d, url: `${BASE_URL}${req.path}` }); });
app.get(['/', '/c/:slug', '/buscar', '/favoritos', '/categorias', '/checkout', '/pedidos', '/pedido/:id'], (req, res) =>
  page(res, { title: `${STORE_NAME} · Compra fácil, paga seguro, recíbelo en casa`, description: HOME_DESC(), image: catalog[0] ? `${BASE_URL}/og/${catalog[0].id}.jpg?v=6` : '', url: `${BASE_URL}${req.path}`, noindex: /^\/(checkout|pedido)/.test(req.path) }));
app.get('/robots.txt', (_req, res) => res.type('text').send(`User-agent: *\nDisallow: /admin\nDisallow: /checkout\nDisallow: /pedido/\nDisallow: /pedidos\nSitemap: ${BASE_URL}/sitemap.xml\n`));
app.get('/sitemap.xml', (_req, res) => res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${BASE_URL}/</loc></url>\n${Object.keys(INFO_PAGES).map(u => `<url><loc>${BASE_URL}${u}</loc></url>`).join('\n')}\n${[...new Set(catalog.map(p => p.category))].filter(c => CAT_SEO[c]).map(c => `<url><loc>${BASE_URL}/c/${CAT_SEO[c][0]}</loc></url>`).join('\n')}\n${catalog.map(p => `<url><loc>${BASE_URL}/p/${p.id}</loc></url>`).join('\n')}\n</urlset>`));
app.get('/index.html', (_req, res) => res.redirect(301, '/'));
app.get('/sw.js', (_req, res) => res.set('Cache-Control', 'no-cache').type('application/javascript').sendFile(path.join(__dirname, 'public', 'sw.js')));
app.get('/gracias.html', (req, res) => res.redirect(302, isUuid(req.query.order) ? `/pedido/${req.query.order}` : '/pedidos'));
app.get(['/admin', '/admin.html'], (_req, res) => res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }).type('html').send(ADMIN_HTML));
app.get(['/afiliados', '/afiliados.html'], (_req, res) => res.set('Cache-Control', 'no-cache').type('html').send(AFF_HTML));
app.get('/favicon.ico', (_req, res) => res.redirect(301, '/icons/icon-192.png'));
const LONG = { maxAge: '30d', index: false };
app.use('/fonts', express.static(path.join(__dirname, 'public', 'fonts'), { maxAge: '365d', immutable: true, index: false }));
for (const dir of ['fotos', 'og', 'icons']) app.use(`/${dir}`, express.static(path.join(__dirname, 'public', dir), LONG));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', index: false }));
app.get('/healthz', (_req, res) => res.json({ ok: true, products: catalog.length, backend }));
app.use((req, res) => page(res, { title: `Página no encontrada · ${STORE_NAME}`, description: HOME_DESC(), url: `${BASE_URL}/`, status: 404 }));

app.listen(PORT, () => console.log(`${STORE_NAME} en ${BASE_URL} · datos: ${backend} · productos: ${catalog.length}${DEMO ? ' · MODO DEMO' : ''}${COD ? ' · contra entrega' : ''}${MP_TOKEN ? ' · Mercado Pago' : ''}`));
