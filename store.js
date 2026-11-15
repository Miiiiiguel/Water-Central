// Capa de datos de USACARGOS SHOP.
// - Producción: Supabase, vía la función protegida public.shop_api (esquema "shop" no expuesto).
// - Local/pruebas: archivo data/db.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { SUPABASE_URL, SUPABASE_KEY, SHOP_API_SECRET } = process.env;
export const backend = SUPABASE_URL && SUPABASE_KEY && SHOP_API_SECRET ? 'supabase' : 'local';

// ---------- Supabase (RPC) ----------
async function rpc(action, args = {}) {
  const r = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/shop_api`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: SHOP_API_SECRET, p_action: action, p_args: args }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`db ${action}: ${r.status} ${j?.message || ''}`);
  return j;
}
const remote = {
  products: () => rpc('products'),
  productUpdate: (id, patch) => rpc('product_update', { id, ...patch }),
  stockAdjust: (items, sign) => rpc('stock_adjust', { items: items.map(i => ({ id: i.id, qty: i.qty })), sign }),
  createAffiliate: a => rpc('affiliate_create', a),
  getAffiliate: (field, value) => rpc('affiliate_get', { field, value }),
  listAffiliates: () => rpc('affiliates'),
  incClicks: code => rpc('inc_clicks', { code }),
  createOrder: o => rpc('order_create', o),
  getOrder: id => rpc('order_get', { id }),
  updateOrder: (id, patch) => rpc('order_update', { id, patch }),
  listOrders: ({ ref, limit } = {}) => rpc('orders', { ...(ref ? { ref } : {}), ...(limit ? { limit } : {}) }),
  addEvent: (order_id, type, detail = '') => rpc('event_add', { order_id, type, detail }),
  listEvents: order_id => rpc('events', { order_id }),
};

// ---------- Local (JSON) ----------
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const SEED = path.join(__dirname, 'data', 'products.json');
function read() {
  let db;
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { db = {}; }
  db.affiliates ??= []; db.orders ??= []; db.events ??= [];
  if (!db.products) {
    const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
    db.products = seed.map((p, i) => ({ active: true, sort: i, cost: null, ...p, updated_at: new Date().toISOString() }));
    write(db);
  }
  return db;
}
function write(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 1)); }
const now = () => new Date().toISOString();
const local = {
  async products() { return read().products; },
  async productUpdate(id, patch) {
    const db = read(), p = db.products.find(x => x.id === id); if (!p) return null;
    for (const k of ['price', 'stock', 'active', 'name', 'description']) if (patch[k] !== undefined && patch[k] !== null) p[k] = patch[k];
    p.updated_at = now(); write(db); return p;
  },
  async stockAdjust(items, sign) {
    const db = read();
    for (const i of items) { const p = db.products.find(x => x.id === i.id); if (p) p.stock = Math.max(0, p.stock + sign * i.qty); }
    write(db); return {};
  },
  async createAffiliate(a) { const db = read(); const row = { id: crypto.randomUUID(), clicks: 0, created_at: now(), ...a }; db.affiliates.push(row); write(db); return row; },
  async getAffiliate(field, value) { return read().affiliates.find(a => a[field] === value) || null; },
  async listAffiliates() { return read().affiliates; },
  async incClicks(code) { const db = read(); const a = db.affiliates.find(x => x.code === code); if (a) { a.clicks++; write(db); } return {}; },
  async createOrder(o) {
    const db = read(), id = crypto.randomUUID();
    const row = {
      id, code: id.replace(/-/g, '').slice(0, 8).toUpperCase(), status: 'pending', payment_method: 'mercadopago', fulfillment: 'unfulfilled',
      commission: 0, commission_status: 'none', stock_applied: false, carrier: null, tracking: null, admin_note: null,
      created_at: now(), updated_at: now(), paid_at: null, packed_at: null, shipped_at: null, delivered_at: null, cancelled_at: null, ...o,
    };
    db.orders.push(row); write(db); return row;
  },
  async getOrder(id) { return read().orders.find(o => o.id === id) || null; },
  async updateOrder(id, patch) { const db = read(), o = db.orders.find(x => x.id === id); if (!o) return null; Object.assign(o, patch, { updated_at: now() }); write(db); return o; },
  async listOrders({ ref, limit = 2000 } = {}) {
    let r = read().orders; if (ref) r = r.filter(o => o.ref_code === ref);
    return r.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  },
  async addEvent(order_id, type, detail = '') { const db = read(); db.events.push({ id: db.events.length + 1, order_id, type, detail, created_at: now() }); write(db); return {}; },
  async listEvents(order_id) { return read().events.filter(e => e.order_id === order_id); },
};

export const db = backend === 'supabase' ? remote : local;
