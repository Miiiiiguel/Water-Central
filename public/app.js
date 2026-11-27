// USACARGOS SHOP — tienda SPA sin dependencias
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = n => '$' + Math.round(n).toLocaleString('es-CO');
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
const SVGNS = 'http://www.w3.org/2000/svg';
function icon(id, cls = '') {
  const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('class', `ico ${cls}`.trim()); s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(SVGNS, 'use'); u.setAttribute('href', `#${id}`); s.append(u); return s;
}
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : String(k));
  return e;
}
// Fotos: /fotos/ID.webp (900 px) y /fotos/s/ID.webp (400 px)
const IMG_V = '6'; // sube este número cuando cambien las fotos para que los navegadores no muestren las anteriores
const big = src => (src && src.startsWith('/fotos/')) ? `${src}?v=${IMG_V}` : src;
const small = src => (src && src.startsWith('/fotos/') && !src.startsWith('/fotos/s/')) ? `${src.replace('/fotos/', '/fotos/s/')}?v=${IMG_V}` : src;
function pic(p, { sizes = '(max-width:640px) 46vw, 260px', eager = false, alt = '' } = {}) {
  return h('img', { src: small(p.image), srcset: `${small(p.image)} 400w, ${big(p.image)} 900w`, sizes, alt, loading: eager ? 'eager' : 'lazy', fetchpriority: eager === 'high' ? 'high' : null, decoding: 'async', width: 400, height: 400 });
}

const CAT_META = {
  'Belleza y Cuidado Personal': ['belleza', 'c-belleza', 'Luce y siéntete increíble, sin salir de casa.'],
  'Salud y Bienestar': ['salud', 'c-salud', 'Cuida tu cuerpo y tu descanso todos los días.'],
  'Hogar y Cocina': ['cocina', 'c-cocina', 'Cocina más rápido, más fácil y con estilo.'],
  'Hogar y Limpieza': ['limpieza', 'c-limpieza', 'Menos tiempo limpiando, más tiempo para ti.'],
  'Organización del Hogar': ['organizacion', 'c-organizacion', 'Cada cosa en su lugar. Más espacio, menos estrés.'],
  'Mascotas': ['mascotas', 'c-mascotas', 'Porque ellos también merecen lo mejor.'],
  'Tecnología': ['tecnologia', 'c-tecnologia', 'Gadgets prácticos para tu día a día.'],
  'Herramientas': ['herramientas', 'c-herramientas', 'Hazlo tú mismo, y hazlo bien.'],
  'Deportes y Fitness': ['deportes', 'c-deportes', 'Entrena en casa o donde quieras.'],
  'Juguetes': ['juguetes', 'c-juguetes', 'Diversión garantizada para grandes y chicos.'],
  'Viaje y Outdoor': ['viaje', 'c-viaje', 'Listo para salir, a donde sea.'],
  'Jardín': ['jardin', 'c-jardin', 'Tu jardín, más verde y fácil de cuidar.'],
  'Moda y Accesorios': ['moda', 'c-moda', 'Comodidad con estilo.'],
  'Automotriz': ['automotriz', 'c-auto', 'Para tu carro o tu moto.'],
  'Bebés': ['bebes', 'c-bebes', 'Lo práctico para los más pequeños.'],
};
const DEPTS = ['Amazonas','Antioquia','Arauca','Atlántico','Bogotá D.C.','Bolívar','Boyacá','Caldas','Caquetá','Casanare','Cauca','Cesar','Chocó','Córdoba','Cundinamarca','Guainía','Guaviare','Huila','La Guajira','Magdalena','Meta','Nariño','Norte de Santander','Putumayo','Quindío','Risaralda','San Andrés y Providencia','Santander','Sucre','Tolima','Valle del Cauca','Vaupés','Vichada'];
const PRICE_RANGES = [[0, 30000, 'Hasta $30.000'], [30000, 60000, '$30.000 – $60.000'], [60000, 100000, '$60.000 – $100.000'], [100000, Infinity, 'Más de $100.000']];
const STORE = 'USACARGOS SHOP';

const S = {
  cfg: { shipping: 12000, freeShippingFrom: 150000, commissionPct: 10 }, products: [], byId: new Map(), cats: [], catBySlug: new Map(),
  cart: store.get('cart', []), favs: new Set(store.get('favs', [])), recent: store.get('recent', []), myRef: store.get('myRef', null),
};

// ---------- Referidos: ?ref= en cualquier URL ----------
(function captureRef() {
  const u = new URL(location.href);
  const r = (u.searchParams.get('ref') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
  if (!r) return;
  store.set('ref', { code: r, exp: Date.now() + 30 * 864e5 });
  try {
    if (!sessionStorage.getItem('t_' + r)) {
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: r }) }).catch(() => {});
      sessionStorage.setItem('t_' + r, '1'); sessionStorage.setItem('showRef', '1');
    }
  } catch {}
  u.searchParams.delete('ref'); history.replaceState(history.state, '', u.pathname + u.search + u.hash);
})();
const activeRef = () => { const r = store.get('ref', null); return r && r.exp > Date.now() ? r.code : null; };

// ---------- Datos ----------
const subtotal = () => S.cart.reduce((s, i) => s + (S.byId.get(i.id)?.price || 0) * i.qty, 0);
const shippingFor = sub => (sub === 0 || sub >= S.cfg.freeShippingFrom ? 0 : S.cfg.shipping);
const qtyOf = id => S.cart.find(i => i.id === id)?.qty || 0;
const maxOf = p => Math.max(0, Math.min(p.stock, 10));
const catOf = p => S.cats.find(c => c.name === p.category);
const byStock = (a, b) => b.stock - a.stock;

const SYN = {
  perro: 'mascota', perrito: 'mascota', perra: 'mascota', gato: 'mascota', gatito: 'mascota', mascot: 'mascota', canino: 'mascota',
  celular: 'tecnologia', telefono: 'tecnologia', gadget: 'tecnologia', maquillaje: 'cosmetic', cosmetico: 'cosmetic', belleza: 'belleza',
  ejercicio: 'deporte', gym: 'deporte', gimnasio: 'deporte', entrenar: 'deporte', fitnes: 'deporte', nino: 'juguete', nina: 'juguete', juego: 'juguete', regalo: 'juguete',
  auto: 'carro', vehiculo: 'carro', espalda: 'postura', dolor: 'masajeador', masaje: 'masajeador', pelo: 'cabello', manicure: 'una', pedicure: 'una',
  limpiar: 'limpieza', aseo: 'limpieza', ordenar: 'organizador', guardar: 'organizador', closet: 'organizador', calzado: 'zapato', tenis: 'zapato',
};
let VOCAB = [];
const fuzzyCache = new Map();
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const stem = t => t.length > 4 && t.endsWith('es') ? t.slice(0, -2) : t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t;
const tokens = q => norm(q).split(/[^a-z0-9]+/).filter(t => t.length > 1).map(stem);
function fuzzyWords(t) {
  if (t.length < 4) return [];
  if (fuzzyCache.has(t)) return fuzzyCache.get(t);
  const tol = t.length >= 7 ? 2 : 1;
  const r = VOCAB.filter(w => w !== t && (lev(t, w) <= tol || (w.length > t.length && lev(t, w.slice(0, t.length)) <= 1)));
  fuzzyCache.set(t, r); return r;
}
function search(q) {
  const toks = tokens(q);
  if (!toks.length) return [];
  const alts = toks.map(t => { const a = [[t, 1]]; if (SYN[t]) a.push([SYN[t], .8]); for (const w of fuzzyWords(t)) a.push([w, .6]); return a; });
  const out = [];
  for (const p of S.products) {
    let score = 0, ok = true;
    for (const alt of alts) {
      let best = 0;
      for (const [t, wgt] of alt) {
        if (!p._t.includes(t)) continue;
        const sc = (p._w.some(w => w.startsWith(t)) ? 10 : p._n.includes(t) ? 6 : p._c.includes(t) ? 3 : 1) * wgt;
        if (sc > best) best = sc;
      }
      if (!best) { ok = false; break; }
      score += best;
    }
    if (ok) out.push([score, p]);
  }
  return out.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name, 'es')).map(x => x[1]);
}
function didYouMean(q) {
  let changed = false;
  const fixed = norm(q).split(/[^a-z0-9]+/).filter(Boolean).map(t => {
    if (t.length < 4 || VOCAB.includes(t) || VOCAB.includes(stem(t))) return t;
    let best = null, bd = 9;
    for (const w of VOCAB) { const d = lev(t, w); if (d < bd) { bd = d; best = w; } }
    if (best && bd <= (t.length >= 7 ? 2 : 1)) { changed = true; return best; }
    return t;
  });
  return changed ? fixed.join(' ') : null;
}

// ---------- Medios de pago ----------
const PAY = () => ({ mp: !!S.cfg.payments?.mercadopago, cod: !!S.cfg.payments?.contraentrega });
const payShort = () => { const { mp, cod } = PAY(); return mp && cod ? 'Paga en línea o contra entrega' : mp ? 'Pago seguro con Mercado Pago' : 'Paga contra entrega'; };
const payLong = () => { const { mp, cod } = PAY(); return mp && cod ? 'Con tarjeta, PSE y más vía Mercado Pago, o en efectivo cuando recibes tu pedido.' : mp ? 'Con tarjeta de crédito, débito, PSE y más a través de Mercado Pago.' : 'Pagas en efectivo cuando recibes tu pedido. Sin tarjetas ni registros.'; };

// ---------- Efectos ----------
let revealIO, countIO;
function reveal(root) {
  const els = $$('.rv:not(.in)', root);
  if (REDUCED || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  revealIO ??= new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
  els.forEach(e => revealIO.observe(e));
  const nums = $$('[data-count]', root);
  countIO ??= new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; countIO.unobserve(e.target);
    const el = e.target, to = +el.dataset.count, suf = el.dataset.suffix || '', t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 1200), v = Math.round(to * (1 - Math.pow(1 - k, 3))); el.textContent = v.toLocaleString('es-CO') + suf; if (k < 1) requestAnimationFrame(step); };
    REDUCED ? (el.textContent = to.toLocaleString('es-CO') + suf) : requestAnimationFrame(step);
  }));
  nums.forEach(n => countIO.observe(n));
}
function tilt(el, max = 7) {
  if (!FINE || REDUCED) return;
  let raf = 0;
  el.addEventListener('pointermove', e => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0; const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.classList.add('tilting');
      el.style.setProperty('--ry', `${(x - .5) * max * 2}deg`); el.style.setProperty('--rx', `${(.5 - y) * max * 2}deg`);
      el.style.setProperty('--gx', `${x * 100}%`); el.style.setProperty('--gy', `${y * 100}%`);
    });
  });
  el.addEventListener('pointerleave', () => { el.classList.remove('tilting'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
}
let fxRaf = 0;
function onScrollFx() {
  if (fxRaf || REDUCED) return;
  fxRaf = requestAnimationFrame(() => {
    fxRaf = 0;
    const hx = $('.hx'); if (hx) hx.style.setProperty('--sy', Math.min(scrollY, 1000));
    for (const b of $$('[data-px]')) {
      const r = b.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) continue;
      b.style.setProperty('--p', (((r.top + r.height / 2) - innerHeight / 2) / innerHeight).toFixed(3));
    }
  });
}
addEventListener('scroll', onScrollFx, { passive: true });
function heroMouse(hx) {
  if (!FINE || REDUCED) return;
  let raf = 0;
  hx.addEventListener('pointermove', e => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; const r = hx.getBoundingClientRect(); hx.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3)); hx.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3)); });
  });
  hx.addEventListener('pointerleave', () => { hx.style.setProperty('--mx', 0); hx.style.setProperty('--my', 0); });
}
function flyToCart(src) {
  if (REDUCED || !src) return false;
  const target = $$('[data-open-cart]').find(b => b.getBoundingClientRect().width > 0 && getComputedStyle(b.closest('.bnav') || b).display !== 'none');
  const a = src.getBoundingClientRect();
  if (!target || !a.width) return false;
  const b = target.getBoundingClientRect(), size = Math.min(a.width, a.height, 150);
  const f = h('img', { class: 'fly', src: src.currentSrc || src.src, alt: '' });
  Object.assign(f.style, { left: `${a.left + (a.width - size) / 2}px`, top: `${a.top + (a.height - size) / 2}px`, width: `${size}px`, height: `${size}px` });
  document.body.append(f);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  f.animate([
    { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 },
    { transform: `translate(${dx * .45}px,${dy * .45 - 90}px) scale(.55) rotate(-8deg)`, opacity: 1, offset: .55 },
    { transform: `translate(${dx}px,${dy}px) scale(.1) rotate(10deg)`, opacity: .3 },
  ], { duration: 780, easing: 'cubic-bezier(.5,0,.25,1)' }).onfinish = () => f.remove();
  return true;
}
function confetti() {
  if (REDUCED) return;
  const colors = ['#FF5A36', '#FF8552', '#4A63D6', '#3EE09A', '#FFD166', '#FFFFFF'];
  for (let i = 0; i < 70; i++) {
    const c = h('i', { class: 'confetti' }); c.style.background = colors[i % colors.length];
    c.style.left = `${innerWidth / 2}px`; c.style.top = `${innerHeight * .55}px`; document.body.append(c);
    const ang = Math.random() * Math.PI * 2, v = 160 + Math.random() * 340, x = Math.cos(ang) * v, y = Math.sin(ang) * v;
    c.animate([
      { transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${x}px,${y - 220}px) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: .5 },
      { transform: `translate(${x * 1.15}px,${y + 320}px) rotate(${Math.random() * 1080}deg)`, opacity: 0 },
    ], { duration: 1500 + Math.random() * 700, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = () => c.remove();
  }
}

// ---------- UI utilidades ----------
function toast(msg, action, ic = 'i-check') {
  const t = h('div', { class: 'toast', role: 'status' }, icon(ic), h('span', {}, msg), action || null);
  $('#toasts').append(t); setTimeout(() => t.remove(), 3800);
}
function updateBadges(bump) {
  const n = S.cart.reduce((s, i) => s + i.qty, 0);
  for (const b of $$('[data-cart-count]')) { b.textContent = n; b.hidden = !n; if (bump) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } }
  for (const b of $$('[data-fav-count]')) { b.textContent = S.favs.size; b.hidden = !S.favs.size; }
}
function setQty(id, q, { silent, src } = {}) {
  const p = S.byId.get(id); if (!p) return;
  q = Math.max(0, Math.min(q, maxOf(p)));
  const prev = qtyOf(id), subBefore = subtotal();
  if (q === prev) { if (q >= maxOf(p)) toast(`Máximo ${maxOf(p)} unidades por pedido`, null, 'i-package'); return; }
  S.cart = S.cart.filter(i => i.id !== id); if (q) S.cart.push({ id, qty: q });
  store.set('cart', S.cart);
  if (q > prev) { try { navigator.vibrate?.(12); } catch {} }
  const flew = q > prev && flyToCart(src);
  flew ? setTimeout(() => updateBadges(true), 700) : updateBadges(q > prev);
  for (const el of $$(`[data-add="${id}"]`)) fillAdd(el, p);
  if ($('#drawer').classList.contains('show')) renderCart();
  if (location.pathname === '/checkout') render({ keepScroll: true });
  const free = S.cfg.freeShippingFrom, subAfter = subtotal();
  if (q === 0) toast(`Quitaste ${p.name}`, h('button', { on: { click: e => { e.currentTarget.closest('.toast')?.remove(); setQty(id, prev, { silent: true }); } } }, 'Deshacer'), 'i-undo');
  else if (subBefore < free && subAfter >= free) { setTimeout(confetti, flew ? 600 : 0); toast('¡Desbloqueaste el ENVÍO GRATIS!', null, 'i-truck'); }
  else if (!silent && q > prev && prev === 0) toast(subAfter < free ? `Agregado. Te faltan ${fmt(free - subAfter)} para envío gratis` : 'Agregado al carrito', h('button', { on: { click: openCart } }, 'Ver carrito'));
}
function stepper(p, q, cls = '') {
  const minus = h('button', { type: 'button', 'aria-label': q === 1 ? `Quitar ${p.name}` : 'Quitar una unidad', on: { click: e => { e.preventDefault(); setQty(p.id, q - 1, { silent: true }); } } }, icon(q === 1 ? 'i-trash' : 'i-minus', 'sm'));
  const plus = h('button', { type: 'button', 'aria-label': 'Agregar una unidad', disabled: q >= maxOf(p), on: { click: e => { e.preventDefault(); setQty(p.id, q + 1); } } }, icon('i-plus', 'sm'));
  return h('div', { class: `stepper ${cls}` }, minus, h('span', { 'aria-live': 'polite' }, `${q}`), plus);
}
function fillAdd(el, p) {
  const q = qtyOf(p.id);
  el.replaceChildren(q ? stepper(p, q) : h('button', {
    class: 'btn navy', type: 'button', disabled: !maxOf(p),
    on: { click: e => { e.preventDefault(); setQty(p.id, 1, { src: el.closest('.card,.mini')?.querySelector('img') }); } },
  }, icon('i-cart', 'sm'), maxOf(p) ? 'Agregar' : 'Agotado'));
}
function favBtn(p) {
  const on = S.favs.has(p.id);
  const b = h('button', { class: 'fav', type: 'button', 'data-fav': p.id, 'aria-pressed': String(on), 'aria-label': on ? `Quitar ${p.name} de favoritos` : `Guardar ${p.name} en favoritos` }, icon('i-heart', 'sm'));
  b.addEventListener('click', e => { e.preventDefault(); toggleFav(p); });
  return b;
}
function toggleFav(p) {
  const on = !S.favs.has(p.id);
  on ? S.favs.add(p.id) : S.favs.delete(p.id);
  store.set('favs', [...S.favs]); updateBadges();
  for (const b of $$(`[data-fav="${p.id}"]`)) { b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? `Quitar ${p.name} de favoritos` : `Guardar ${p.name} en favoritos`); }
  toast(on ? 'Guardado en favoritos' : 'Quitado de favoritos', on ? h('a', { href: '/favoritos', 'data-nav': '' }, 'Ver') : null, 'i-heart');
  if (location.pathname === '/favoritos') render({ keepScroll: true });
}
function tags(p) {
  const t = [];
  if (p.stock > 0 && p.stock <= 15) t.push(h('span', { class: 'tag hot' }, icon('i-flame', 'sm'), `¡Últimas ${p.stock}!`));
  if (p.price >= S.cfg.freeShippingFrom) t.push(h('span', { class: 'tag ok' }, icon('i-truck', 'sm'), 'Envío gratis'));
  return t;
}
function card(p, eager) {
  const add = h('div', { class: 'add', 'data-add': p.id }); fillAdd(add, p);
  const c = h('article', { class: 'card' },
    h('div', { class: 'media' }, pic(p, { eager })),
    h('div', { class: 'meta' }, tags(p)),
    favBtn(p),
    h('div', { class: 'body' },
      h('a', { class: 'name', href: `/p/${p.id}`, 'data-nav': '' }, p.name),
      h('div', { class: 'price' }, fmt(p.price)),
      add));
  tilt(c, 6);
  return c;
}
let railIO;
function rail(title, list, href, sub, lazy) {
  if (!list.length) return null;
  const r = h('div', { class: 'rail' });
  const fill = () => { if (!r.childElementCount) { r.append(...list.map(p => card(p))); r.classList.remove('rail-ph'); } };
  const go = d => r.scrollBy({ left: d * r.clientWidth * 0.9, behavior: REDUCED ? 'auto' : 'smooth' });
  const sec = h('section', { class: 'section rv', 'aria-label': title },
    h('div', { class: 'sec-head' }, h('div', {}, h('h2', {}, title), sub ? h('p', {}, sub) : null), href ? h('a', { href, 'data-nav': '', 'aria-label': `Ver todo: ${title}` }, 'Ver todo', icon('i-chev-r', 'sm')) : null),
    h('div', { class: 'rail-wrap' }, h('button', { class: 'rail-btn l', 'aria-label': `Anteriores en ${title}`, on: { click: () => go(-1) } }, icon('i-chev-l')), r,
      h('button', { class: 'rail-btn r', 'aria-label': `Siguientes en ${title}`, on: { click: () => go(1) } }, icon('i-chev-r'))));
  if (lazy && 'IntersectionObserver' in window) {
    r.classList.add('rail-ph'); sec._fill = fill;
    railIO ??= new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { railIO.unobserve(e.target); e.target._fill?.(); } }), { rootMargin: '900px 0px' });
    requestAnimationFrame(() => railIO.observe(sec));
  } else fill();
  return sec;
}
function crumbs(...items) {
  const nav = h('nav', { class: 'crumbs', 'aria-label': 'Ruta' });
  items.forEach(([label, href], i) => {
    if (i) nav.append(icon('i-chev-r', 'sm'));
    nav.append(href ? h('a', { href, 'data-nav': '' }, label) : h('span', { 'aria-current': 'page' }, label));
  });
  return nav;
}
function shipProgress(sub) {
  const free = S.cfg.freeShippingFrom, pct = Math.min(100, Math.round(sub / free * 100));
  const bar = h('div', { class: 'ship-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': 'Progreso hacia envío gratis' }, h('i'));
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.firstChild.style.width = pct + '%'; }));
  const msg = sub >= free ? h('span', {}, icon('i-gift', 'sm'), ' ', h('b', {}, '¡Tu envío es GRATIS!')) : h('span', {}, 'Agrega ', h('strong', {}, fmt(free - sub)), ' más y tu ', h('b', {}, 'envío es GRATIS'));
  return h('div', { class: 'ship-msg' }, msg, bar);
}
function emptyState(ic, title, text, ...actions) {
  return h('div', { class: 'empty' }, icon(ic), h('h2', {}, title), text ? h('p', { class: 'muted', style: 'margin:0' }, text) : null, h('div', { class: 'hero-cta', style: 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center' }, actions));
}
const setTitle = t => { document.title = t ? `${t} · ${STORE}` : `${STORE} · Compra fácil, paga seguro, recíbelo en casa`; };

// ---------- Carrito (drawer) ----------
let lastFocus = null;
function openCart() {
  lastFocus = document.activeElement; renderCart();
  $('#drawer').classList.add('show'); $('#scrim').classList.add('show'); document.body.style.overflow = 'hidden';
  setTimeout(() => $('[data-close-cart]').focus(), 60);
}
function closeCart() {
  $('#drawer').classList.remove('show'); $('#scrim').classList.remove('show'); document.body.style.overflow = '';
  lastFocus?.focus?.();
}
function renderCart() {
  const body = $('#cartBody'), foot = $('#cartFoot');
  S.cart = S.cart.filter(i => S.byId.has(i.id));
  if (!S.cart.length) {
    body.replaceChildren(emptyState('i-cart', 'Tu carrito está vacío', 'Tu próximo favorito te está esperando.',
      h('a', { class: 'btn primary', href: '/', 'data-nav': '' }, 'Descubrir productos'),
      S.favs.size ? h('a', { class: 'btn', href: '/favoritos', 'data-nav': '' }, 'Ver favoritos') : null));
    foot.replaceChildren(); return;
  }
  const sub = subtotal(), ship = shippingFor(sub);
  const rows = S.cart.map(i => {
    const p = S.byId.get(i.id);
    return h('div', { class: 'ci-row' }, h('img', { src: small(p.image), alt: '', width: 72, height: 72 }),
      h('div', {}, h('a', { class: 'n', href: `/p/${p.id}`, 'data-nav': '' }, p.name),
        h('div', { class: 'ctl' }, stepper(p, i.qty, 'outline'), h('b', { class: 'price' }, fmt(p.price * i.qty)))));
  });
  const kids = [shipProgress(sub), ...rows];
  if (sub < S.cfg.freeShippingFrom) {
    const inCart = new Set(S.cart.map(i => i.id)), cats = new Set(S.cart.map(i => S.byId.get(i.id).category)), gap = S.cfg.freeShippingFrom - sub;
    const sug = S.products.filter(p => !inCart.has(p.id) && maxOf(p) && cats.has(p.category)).sort((a, b) => Math.abs(a.price - gap) - Math.abs(b.price - gap)).slice(0, 8);
    if (sug.length) kids.push(h('div', {}, h('h3', { style: 'font-size:1.2rem;margin-bottom:10px' }, 'Completa tu pedido y ahorra el envío'),
      h('div', { class: 'mini-rail' }, sug.map(p => h('div', { class: 'mini' }, h('img', { src: small(p.image), alt: '', loading: 'lazy', width: 120, height: 120 }),
        h('a', { class: 'n', href: `/p/${p.id}`, 'data-nav': '' }, p.name), h('b', { class: 'price' }, fmt(p.price)),
        h('button', { class: 'btn sm navy', type: 'button', on: { click: e => setQty(p.id, 1, { silent: true, src: e.currentTarget.closest('.mini').querySelector('img') }) } }, icon('i-plus', 'sm'), 'Agregar'))))));
  }
  body.replaceChildren(...kids);
  foot.replaceChildren(
    h('div', { class: 'sum' }, h('span', {}, 'Subtotal'), h('b', { class: 'price' }, fmt(sub))),
    h('div', { class: 'sum' }, h('span', {}, 'Envío'), h('b', {}, ship ? fmt(ship) : 'GRATIS')),
    h('div', { class: 'sum total' }, h('span', {}, 'Total'), h('span', { class: 'price' }, fmt(sub + ship))),
    h('a', { class: 'btn primary block xl', href: '/checkout', 'data-nav': '' }, icon('i-lock', 'sm'), 'Pagar de forma segura'),
    S.cfg.whatsapp ? h('a', { class: 'btn wa block', target: '_blank', rel: 'noopener', href: waOrderLink(sub, ship) }, icon('i-msg', 'sm'), 'Prefiero pedir por WhatsApp') : null,
    h('button', { class: 'btn ghost block', type: 'button', 'data-close-cart': '' }, 'Seguir comprando'));
}

function waOrderLink(sub, ship) {
  const lines = S.cart.map(i => { const p = S.byId.get(i.id); return `• ${i.qty}× ${p.name} (${p.id}) – ${fmt(p.price * i.qty)}`; });
  const msg = `Hola ${STORE}, quiero hacer este pedido:\n${lines.join('\n')}\nSubtotal: ${fmt(sub)}\nEnvío: ${ship ? fmt(ship) : 'GRATIS'}\nTotal: ${fmt(sub + ship)}`;
  return `https://wa.me/${S.cfg.whatsapp}?text=${encodeURIComponent(msg)}`;
}
document.addEventListener('keydown', e => {
  const d = $('#drawer');
  if (e.key !== 'Tab' || !d.classList.contains('show')) return;
  const f = $$('a[href],button:not([disabled]),input,select,textarea', d).filter(x => x.offsetParent !== null);
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
  else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
});

// ---------- Buscador con sugerencias ----------
function initSearch() {
  const input = $('#q'), box = $('#suggest'), form = $('#search form');
  let sel = -1, t;
  const opts = () => $$('.sg', box);
  const close = () => { box.hidden = true; input.setAttribute('aria-expanded', 'false'); sel = -1; };
  const mark = (text, q) => {
    const toks = norm(q).split(/\s+/).filter(x => x.length > 1); const n = norm(text); const out = [];
    let i = 0;
    while (i < text.length) {
      let hit = 0; for (const tk of toks) if (n.startsWith(tk, i)) hit = Math.max(hit, tk.length);
      if (hit) { out.push(h('mark', {}, text.slice(i, i + hit))); i += hit; } else { const j = i; i++; while (i < text.length && !toks.some(tk => n.startsWith(tk, i))) i++; out.push(text.slice(j, i)); }
    }
    return out;
  };
  const go = q => { q = q.trim(); if (!q) return; const r = store.get('searches', []).filter(x => x !== q); store.set('searches', [q, ...r].slice(0, 6)); close(); input.blur(); navigate(`/buscar?q=${encodeURIComponent(q)}`); };
  function show() {
    const q = input.value.trim(); const kids = [];
    if (!q) {
      const rec = store.get('searches', []);
      if (rec.length) kids.push(h('h4', {}, 'Búsquedas recientes'), ...rec.map(r => h('div', { class: 'sg', role: 'option', 'data-q': r }, icon('i-clock', 'sm'), h('span', { class: 't' }, r))));
      kids.push(h('h4', {}, 'Lo más buscado'), h('div', { class: 'sg-chips' }, S.cats.slice(0, 8).map(c => h('a', { class: 'chip', href: `/c/${c.slug}`, 'data-nav': '' }, c.name))));
    } else {
      const res = search(q).slice(0, 6);
      const cats = S.cats.filter(c => norm(c.name).includes(norm(q)));
      if (cats.length) kids.push(h('h4', {}, 'Categorías'), ...cats.slice(0, 3).map(c => h('div', { class: 'sg', role: 'option', 'data-href': `/c/${c.slug}` }, icon(c.icon, 'sm'), h('span', { class: 't' }, c.name))));
      if (res.length) kids.push(h('h4', {}, 'Productos'), ...res.map(p => h('div', { class: 'sg', role: 'option', 'data-href': `/p/${p.id}` }, h('img', { src: small(p.image), alt: '', width: 46, height: 46 }), h('span', { class: 't' }, mark(p.name, q)), h('span', { class: 'price' }, fmt(p.price)))),
        h('div', { class: 'sg', role: 'option', 'data-q': q }, icon('i-search', 'sm'), h('span', { class: 't' }, `Ver todos los resultados para “${q}”`)));
      if (!res.length && !cats.length) {
        const dym = didYouMean(q);
        kids.push(h('p', { class: 'muted', style: 'padding:14px 16px 6px;margin:0' }, `No encontramos “${q}”.`));
        if (dym) kids.push(h('div', { class: 'sg', role: 'option', 'data-q': dym }, icon('i-sparkle', 'sm'), h('span', { class: 't' }, '¿Quisiste decir ', h('b', {}, dym), '?')));
        else kids.push(h('p', { class: 'muted', style: 'padding:0 16px 14px;margin:0' }, 'Prueba con otra palabra o explora las categorías.'));
      }
    }
    box.replaceChildren(...kids); box.hidden = !kids.length; input.setAttribute('aria-expanded', String(!box.hidden)); sel = -1;
    opts().forEach((o, i) => { o.id = `sg${i}`; o.addEventListener('mousedown', e => { e.preventDefault(); pick(o); }); });
  }
  const pick = o => { if (o.dataset.href) { close(); input.blur(); navigate(o.dataset.href); } else go(o.dataset.q); };
  input.addEventListener('focus', show);
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(show, 120); });
  input.addEventListener('keydown', e => {
    const o = opts();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (box.hidden) show(); e.preventDefault(); if (!o.length) return;
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + o.length) % o.length;
      o.forEach((x, i) => x.setAttribute('aria-selected', String(i === sel))); input.setAttribute('aria-activedescendant', o[sel].id); o[sel].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && sel >= 0 && o[sel]) { e.preventDefault(); pick(o[sel]); }
    else if (e.key === 'Escape') { close(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
  form.addEventListener('submit', e => { e.preventDefault(); go(input.value); });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); $('.hdr').classList.remove('hide'); input.focus(); }
  });
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, vb = $('#voiceBtn');
  if (SR && vb) {
    vb.hidden = false;
    vb.addEventListener('click', () => {
      const r = new SR(); r.lang = 'es-CO'; r.interimResults = false; r.maxAlternatives = 1;
      vb.classList.add('listening'); vb.setAttribute('aria-label', 'Escuchando…');
      r.onresult = e => { const t = e.results[0][0].transcript.replace(/[.¿?¡!]/g, ''); input.value = t; go(t); };
      r.onerror = () => toast('No pudimos escucharte. Intenta de nuevo o escribe tu búsqueda.', null, 'i-mic');
      r.onend = () => { vb.classList.remove('listening'); vb.setAttribute('aria-label', 'Buscar por voz'); };
      try { r.start(); } catch { vb.classList.remove('listening'); }
    });
  }
}

// ---------- Componentes de portada ----------
// Productos con las fotos más vistosas para la portada (si no existen, se usan los de más stock por categoría)
const HERO_PICKS = ['UCS-0108', 'UCS-0103', 'UCS-0079', 'UCS-0107', 'UCS-0127', 'UCS-0031', 'UCS-0099', 'UCS-0049', 'UCS-0077', 'UCS-0082'];
const CAT_PICKS = { 'Belleza y Cuidado Personal': 'UCS-0077', 'Salud y Bienestar': 'UCS-0103', 'Hogar y Cocina': 'UCS-0108', 'Organización del Hogar': 'UCS-0112', 'Hogar y Limpieza': 'UCS-0094', 'Mascotas': 'UCS-0007', 'Tecnología': 'UCS-0107', 'Juguetes': 'UCS-0127', 'Deportes y Fitness': 'UCS-0049', 'Herramientas': 'UCS-0132', 'Jardín': 'UCS-0003', 'Viaje y Outdoor': 'UCS-0006', 'Moda y Accesorios': 'UCS-0131' };
const catPick = c => S.byId.get(CAT_PICKS[c.name]) || S.products.filter(p => p.category === c.name).sort(byStock)[0];
function heroSection() {
  const picks = HERO_PICKS.map(id => S.byId.get(id)).filter(Boolean);
  const featured = picks.length >= 8 ? picks : S.cats.map(c => S.products.filter(p => p.category === c.name).sort(byStock)[0]).filter(Boolean);
  const faces = featured.slice(0, 6);
  const floaters = [featured[6] || featured[0], featured[1], featured[7] || featured[2], featured[3]].filter(Boolean);
  const free = S.cfg.freeShippingFrom;
  const hx = h('section', { class: 'hx', 'aria-label': 'Bienvenida' },
    h('div', { class: 'blob b1' }), h('div', { class: 'blob b2' }), h('div', { class: 'hx-floor' }),
    h('div', { class: 'wrap hx-inner' },
      h('div', { class: 'hx-copy' },
        h('span', { class: 'chip-live' }, h('i'), `Envíos a toda Colombia · ${payShort()}`),
        h('h1', {}, h('span', { class: 'line' }, h('span', {}, 'Compra fácil.')), h('span', { class: 'line' }, h('span', {}, 'Paga seguro.')), h('span', { class: 'line' }, h('span', { class: 'grad-text' }, 'Recíbelo en casa.'))),
        h('p', { class: 'hx-sub' }, `Más de ${Math.max(10, Math.floor((S.products.length - 1) / 10) * 10)} productos para tu hogar, tu belleza, tu salud y tus mascotas, a precios que te van a encantar. Eliges hoy, pagas seguro y te lo llevamos a la puerta.`),
        h('div', { class: 'hx-cta' },
          h('button', { class: 'btn primary xl', type: 'button', on: { click: () => $('#destacados')?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }) } }, icon('i-zap', 'sm'), 'Comprar ahora'),
          h('a', { class: 'btn glass xl', href: '/buscar?q=&precio=0', 'data-nav': '' }, 'Todo por menos de $30.000')),
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('b', { 'data-count': S.products.length, 'data-suffix': '+' }, '0'), h('span', {}, 'productos listos para ti')),
          h('div', { class: 'stat' }, h('b', { 'data-count': S.cats.length }, '0'), h('span', {}, 'categorías')),
          h('div', { class: 'stat' }, h('b', {}, fmt(free).replace('.000', 'k')), h('span', {}, 'y tu envío es gratis')))),
      h('div', { class: 'stage', 'aria-hidden': 'true' },
        h('div', { class: 'cube-wrap' }, h('div', { class: 'cube' }, faces.map((p, i) => h('div', { class: `face f${i + 1}` }, h('img', { src: small(p.image), alt: '', width: 400, height: 400 }))))),
        h('div', { class: 'cube-shadow' }),
        floaters.map((p, i) => h('a', { class: `floater ${'abcd'[i]}`, href: `/p/${p.id}`, 'data-nav': '', tabindex: '-1' }, h('img', { src: small(p.image), alt: '', width: 96, height: 96 }), h('span', {}, h('span', { class: 't' }, p.name), h('span', { class: 'price' }, fmt(p.price))))))));
  heroMouse(hx);
  return hx;
}
function marquee() {
  const items = [['i-truck', `Envío GRATIS desde ${fmt(S.cfg.freeShippingFrom)}`], ...(PAY().cod ? [['i-wallet', 'Paga contra entrega: en efectivo al recibir']] : []), ...(PAY().mp ? [['i-lock', 'Pago 100% seguro con Mercado Pago'], ['i-card', 'Tarjeta de crédito, débito y PSE']] : []), ['i-package', 'Envíos a toda Colombia'], ['i-wallet', `Gana el ${S.cfg.commissionPct ?? 10}% recomendando`]];
  if (S.cfg.whatsapp) items.push(['i-headset', 'Atención por WhatsApp']);
  const seq = () => items.map(([i, t]) => h('span', {}, icon(i, 'sm'), t));
  return h('div', { class: 'mq', 'aria-label': 'Beneficios' }, h('div', { class: 'mq-track' }, seq(), h('span', { 'aria-hidden': 'true', style: 'display:contents' }, seq())));
}
function catTiles() {
  return h('div', { class: 'cats' }, S.cats.map((c, i) => {
    const p = catPick(c);
    return h('a', { class: 'cat rv', style: `--rd:${Math.min(i, 10) * 40}ms`, href: `/c/${c.slug}`, 'data-nav': '' },
      h('span', { class: 'cat-img' }, p ? h('img', { src: small(p.image), alt: '', loading: 'lazy', decoding: 'async', width: 400, height: 400 }) : null),
      h('span', { class: 'cat-txt' }, h('span', { class: 'ci' }, icon(c.icon, 'sm')), h('span', {}, h('b', {}, c.name), h('small', {}, `${c.count} producto${c.count === 1 ? '' : 's'}`))));
  }), h('a', { class: 'cat cat-all rv', href: '/buscar?q=', 'data-nav': '' },
    h('span', { class: 'cat-img' }, h('span', { class: 'cat-all-ic' }, icon('i-grid'))),
    h('span', { class: 'cat-txt' }, h('span', {}, h('b', {}, 'Ver todo'), h('small', {}, `${S.products.length} productos`)))));
}
function coverflow(list) {
  const items = list.map(p => h('div', { class: 'cf-item' }, card(p)));
  const n = items.length; let i = 0, timer = 0, paused = false;
  const dots = h('div', { class: 'cf-dots', 'aria-hidden': 'true' }, items.map(() => h('i')));
  const stage = h('div', { class: 'cf', tabindex: '0', role: 'region', 'aria-roledescription': 'carrusel', 'aria-label': 'Productos destacados' }, items);
  const layout = () => {
    const w = items[0]?.offsetWidth || 250;
    items.forEach((it, k) => {
      let d = k - i; if (d > n / 2) d -= n; if (d < -n / 2) d += n;
      const ad = Math.abs(d);
      it.style.transform = `translateX(${d * w * .6}px) translateZ(${-ad * 180}px) rotateY(${-Math.sign(d) * Math.min(ad, 3) * 22}deg)`;
      it.style.zIndex = 100 - ad; it.style.opacity = ad > 3 ? 0 : 1 - ad * .14; it.style.filter = ad ? `brightness(${1 - ad * .15})` : '';
      it.classList.toggle('center', d === 0); it.setAttribute('aria-hidden', String(d !== 0));
      for (const f of $$('a,button', it)) f.tabIndex = d === 0 ? 0 : -1;
    });
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
  };
  const go = k => { i = (k + n) % n; layout(); };
  items.forEach((it, k) => it.addEventListener('click', e => { if (!it.classList.contains('center')) { e.preventDefault(); e.stopPropagation(); go(k); } }, true));
  stage.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); });
  let x0 = null;
  stage.addEventListener('pointerdown', e => { x0 = e.clientX; });
  stage.addEventListener('pointerup', e => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1)); });
  stage.addEventListener('pointerenter', () => paused = true); stage.addEventListener('pointerleave', () => paused = false);
  stage.addEventListener('focusin', () => paused = true); stage.addEventListener('focusout', () => paused = false);
  if (!REDUCED) { timer = setInterval(() => { if (!paused && !document.hidden) go(i + 1); }, 3800); cleanup.push(() => clearInterval(timer)); }
  requestAnimationFrame(layout); addEventListener('resize', layout); cleanup.push(() => removeEventListener('resize', layout));
  return h('section', { class: 'section rv', id: 'destacados' }, h('div', { class: 'cf-sec' }, h('div', { class: 'wrap' },
    h('div', { class: 'sec-head' }, h('div', {}, h('span', { class: 'kicker' }, 'Selección de la semana'), h('h2', {}, 'Lo más destacado'), h('p', {}, 'Desliza, elige y agrégalo en un toque.'))),
    stage,
    h('div', { class: 'cf-ctl' }, h('button', { class: 'icon-btn', 'aria-label': 'Anterior', on: { click: () => go(i - 1) } }, icon('i-chev-l')), dots, h('button', { class: 'icon-btn', 'aria-label': 'Siguiente', on: { click: () => go(i + 1) } }, icon('i-chev-r'))))));
}
function quads() {
  const cats = S.cats.slice().sort((a, b) => b.count - a.count).slice(0, 4);
  const pick4 = c => { const first = catPick(c); return [first, ...S.products.filter(p => p.category === c.name && p !== first).sort(byStock)].filter(Boolean).slice(0, 4); };
  return h('section', { class: 'section rv', 'aria-label': 'Lo mejor de cada categoría' },
    h('div', { class: 'sec-head' }, h('div', {}, h('span', { class: 'kicker' }, 'Elegidos para ti'), h('h2', {}, 'Lo mejor de cada categoría'))),
    h('div', { class: 'quads' }, cats.map(c => h('div', { class: 'quad' },
      h('h3', {}, c.name), h('p', { class: 'muted small' }, CAT_META[c.name]?.[2] || ''),
      h('div', { class: 'q4' }, pick4(c).map(p => h('a', { href: `/p/${p.id}`, 'data-nav': '', class: 'q' },
        h('span', { class: 'qi' }, h('img', { src: small(p.image), alt: '', loading: 'lazy', decoding: 'async', width: 400, height: 400 })),
        h('span', { class: 'qt' }, p.name), h('b', { class: 'qp' }, fmt(p.price))))),
      h('a', { class: 'q-more', href: `/c/${c.slug}`, 'data-nav': '' }, `Ver todo en ${c.name}`, icon('i-chev-r', 'sm'))))));
}
function howTo() {
  const steps = [
    ['i-pointer', 'Elige', 'Explora por categoría o búscalo en segundos. Guarda tus favoritos con un toque.'],
    ['i-lock', PAY().mp ? 'Paga seguro' : 'Pide sin pagar ahora', payLong()],
    ['i-truck', 'Recíbelo', `Te lo enviamos a toda Colombia. Envío gratis desde ${fmt(S.cfg.freeShippingFrom)}.`],
  ];
  return h('section', { class: 'section' },
    h('div', { class: 'sec-head rv' }, h('div', {}, h('span', { class: 'kicker' }, 'Así de fácil'), h('h2', {}, 'Comprar es así de fácil'))),
    h('div', { class: 'steps3' }, steps.map(([i, t, d], k) => h('div', { class: 'step rv', style: `--rd:${k * 120}ms` }, h('div', { class: 'ci' }, icon(i, 'lg')), h('h3', {}, t), h('p', {}, d)))));
}
function band({ coral, kicker, title, text, ctas, big }) {
  return h('section', { class: 'section rv' }, h('div', { class: `band${coral ? ' coral' : ''}`, 'data-px': '' },
    h('div', { class: 'shape s1' }), h('div', { class: 'shape s2' }), h('div', { class: 'shape s3' }), big ? h('div', { class: 'big-num', 'aria-hidden': 'true' }, big) : null,
    kicker ? h('span', { class: 'kicker', style: 'color:#fff' }, kicker) : null, h('h2', {}, title), h('p', {}, text), h('div', { class: 'row2' }, ctas)));
}
function faqItems(short) {
  const free = fmt(S.cfg.freeShippingFrom), ship = fmt(S.cfg.shipping), pct = S.cfg.commissionPct ?? 10;
  const items = [
    ['¿Cómo puedo pagar?', payLong() + (PAY().cod ? ' Con pago contra entrega le pagas al mensajero el total del pedido en efectivo.' : '')],
    ['¿Cuánto cuesta el envío?', `El envío cuesta ${ship} a cualquier parte de Colombia y es GRATIS en compras desde ${free}. Lo ves en el carrito antes de pagar.`],
    ['¿Es seguro comprar aquí?', PAY().mp ? 'Sí. Los pagos en línea los procesa Mercado Pago: nunca vemos ni guardamos los datos de tu tarjeta o cuenta bancaria.' + (PAY().cod ? ' Y si prefieres, pagas al recibir.' : '') : 'Sí. No pagas nada por adelantado: pagas en efectivo cuando el pedido llega a tus manos.'],
    ['¿Cómo sigo mi envío?', 'Cuando despachamos tu pedido verás la transportadora y el número de guía en “Mis pedidos”, en la página de tu pedido.'],
    ['¿Cómo sé que recibieron mi pedido?', 'Al confirmar tu compra verás el número de tu pedido. También queda guardado en “Mis pedidos” en este dispositivo, y te contactamos a tu celular para coordinar la entrega.'],
    ['¿Cuánto tarda en llegar?', 'Depende de tu ciudad. Cuando te contactemos para confirmar la entrega te damos el tiempo estimado para tu dirección.'],
    ['¿Cómo gano dinero recomendando?', `Crea tu link gratis en “Gana dinero”, compártelo y recibe el ${pct}% del valor de los productos de cada compra pagada que llegue por tu link.`],
  ];
  return short ? items.slice(0, 5) : items;
}
function faq(short) {
  return h('section', { class: 'section', id: 'faq' },
    h('div', { class: 'sec-head rv' }, h('div', {}, h('span', { class: 'kicker' }, 'Resolvemos tus dudas'), h('h2', {}, 'Preguntas frecuentes'))),
    h('div', { class: 'faq' }, faqItems(short).map(([q, a], i) => h('details', { class: 'rv', style: `--rd:${i * 60}ms` }, h('summary', {}, q), h('p', {}, a)))));
}
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (location.pathname === '/') showInstall(); });
function showInstall() {
  if (!installEvt || store.get('installDismissed', 0) > Date.now() || $('.install')) return;
  const slot = $('#installSlot'); if (!slot) return;
  const close = () => { store.set('installDismissed', Date.now() + 14 * 864e5); b.remove(); };
  const b = h('div', { class: 'install', role: 'region', 'aria-label': 'Instalar aplicación' }, h('img', { src: '/icons/icon-192.png', alt: '' }),
    h('div', {}, h('b', {}, 'Instala USACARGOS SHOP'), h('span', {}, 'Acceso directo desde tu pantalla de inicio, más rápido y sin ocupar espacio.')),
    h('button', { class: 'btn primary sm', type: 'button', on: { click: async () => { installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; b.remove(); } } }, icon('i-download', 'sm'), 'Instalar'),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Ahora no', on: { click: close } }, icon('i-x', 'sm')));
  slot.append(b);
}
function trustRow() {
  const items = [PAY().mp ? ['i-shield', 'Pago 100% seguro', 'Procesado por Mercado Pago. Tus datos bancarios nunca pasan por nosotros.'] : ['i-wallet', 'Pagas al recibir', 'Sin pagos por adelantado: pagas en efectivo cuando llega tu pedido.'], ['i-truck', 'Envíos a toda Colombia', `Envío gratis en compras desde ${fmt(S.cfg.freeShippingFrom)}.`], ['i-package', 'Disponibilidad real', 'Ves las unidades disponibles antes de comprar.']];
  if (S.cfg.whatsapp) items.push(['i-headset', 'Te acompañamos', 'Escríbenos por WhatsApp antes, durante y después de tu compra.']);
  return h('section', { class: 'section' }, h('div', { class: 'trust-row' }, items.map(([i, t, d], k) => h('div', { class: 'trust-card rv', style: `--rd:${k * 90}ms` }, icon(i), h('div', {}, h('b', {}, t), h('span', {}, d))))));
}

// ---------- Vistas ----------
function home(v) {
  setTitle();
  v.append(heroSection(), marquee());
  const w = h('div', { class: 'wrap' }); v.append(w);
  w.append(h('section', { class: 'section', id: 'categorias' }, h('div', { class: 'sec-head rv' }, h('div', {}, h('span', { class: 'kicker' }, 'Explora'), h('h2', {}, '¿Qué necesitas hoy?'))), catTiles()));
  const featured = S.cats.flatMap(c => S.products.filter(p => p.category === c.name).sort(byStock).slice(0, 1));
  w.prepend(h('div', { id: 'installSlot' }));
  w.append(coverflow(featured.length >= 6 ? featured : S.products.slice(0, 10)));
  w.append(quads());
  const seen = new Set(S.recent), recentCats = [...new Set(S.recent.map(id => S.byId.get(id)?.category).filter(Boolean))].slice(0, 3);
  if (recentCats.length) w.append(rail('Inspirado en lo que viste', S.products.filter(p => recentCats.includes(p.category) && !seen.has(p.id)).sort(byStock).slice(0, 14), null, 'Elegidos según los productos que miraste.'));
  w.append(rail('Precios que enamoran', S.products.filter(p => p.price < 30000).sort(byStock).slice(0, 16), '/buscar?q=&precio=0', 'Todo por menos de $30.000', true));
  w.append(howTo());
  for (const c of S.cats.slice(0, 3)) w.append(rail(c.name, S.products.filter(p => p.category === c.name).sort(byStock).slice(0, 14), `/c/${c.slug}`, CAT_META[c.name]?.[2], true));
  const pct = S.cfg.commissionPct ?? 10;
  w.append(band({
    kicker: 'Programa de referidos', title: 'Tu WhatsApp ya es un negocio.', big: `${pct}%`,
    text: `Comparte tu link y gana el ${pct}% de cada venta pagada. Sin inversión, sin inventario y con tu panel para ver tus ganancias en tiempo real.`,
    ctas: [h('a', { class: 'btn primary xl', href: '/afiliados.html' }, icon('i-wallet', 'sm'), 'Quiero ganar dinero'), h('a', { class: 'btn glass xl', href: '/afiliados.html' }, 'Cómo funciona')],
  }));
  for (const c of S.cats.slice(3, 6)) w.append(rail(c.name, S.products.filter(p => p.category === c.name).sort(byStock).slice(0, 14), `/c/${c.slug}`, CAT_META[c.name]?.[2], true));
  const recent = S.recent.map(id => S.byId.get(id)).filter(Boolean);
  if (recent.length) w.append(rail('Vistos recientemente', recent.slice(0, 12), null, 'Retoma donde lo dejaste.', true));
  requestAnimationFrame(showInstall);
  w.append(trustRow());
  w.append(faq());
  w.append(band({
    coral: true, title: 'Tu próximo favorito está a un clic.', text: `Más de ${Math.max(10, Math.floor((S.products.length - 1) / 10) * 10)} productos esperando por ti. Pide hoy: ${payShort().toLowerCase()}.`,
    ctas: [h('a', { class: 'btn primary xl', href: '/buscar?q=', 'data-nav': '' }, 'Ver todos los productos', icon('i-chev-r', 'sm'))],
  }));
}
function catsPage(v) {
  setTitle('Categorías');
  v.append(h('div', { class: 'wrap' }, crumbs(['Inicio', '/'], ['Categorías']), h('div', { class: 'list-hero' }, h('h1', {}, 'Todas las categorías'), h('p', {}, 'Encuentra justo lo que buscas.')), catTiles()));
}
function listing(v, { title, sub, ic, list, crumb, chipsTop, emptyMsg }) {
  const sp = new URLSearchParams(location.search);
  const range = sp.get('precio'), envio = sp.get('envio') === '1', orden = sp.get('orden') || 'rel';
  let r = list.slice();
  const heroPics = list.length >= 3 ? list.slice().sort(byStock).slice(0, 3) : [];
  if (range != null && PRICE_RANGES[range]) { const [a, b] = PRICE_RANGES[range]; r = r.filter(p => p.price >= a && p.price < b); }
  if (envio) r = r.filter(p => p.price >= S.cfg.freeShippingFrom);
  if (orden === 'asc') r.sort((a, b) => a.price - b.price);
  if (orden === 'desc') r.sort((a, b) => b.price - a.price);
  if (orden === 'az') r.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const setParam = (k, val) => { const u = new URLSearchParams(location.search); val == null ? u.delete(k) : u.set(k, val); navigate(`${location.pathname}?${u}`, { replace: true, keepScroll: true }); };
  const sel = h('select', { class: 'select', 'aria-label': 'Ordenar por', on: { change: e => setParam('orden', e.target.value === 'rel' ? null : e.target.value) } },
    [['rel', 'Recomendados'], ['asc', 'Menor precio'], ['desc', 'Mayor precio'], ['az', 'Nombre A–Z']].map(([k, l]) => h('option', { value: k, selected: k === orden }, l)));
  const toolbar = h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Filtros' }, sel,
    PRICE_RANGES.map(([, , label], i) => h('button', { class: 'chip', 'aria-pressed': String(range === String(i)), on: { click: () => setParam('precio', range === String(i) ? null : i) } }, label)),
    h('button', { class: 'chip', 'aria-pressed': String(envio), on: { click: () => setParam('envio', envio ? null : 1) } }, icon('i-truck', 'sm'), 'Envío gratis'));
  const w = h('div', { class: 'wrap' }, crumb,
    h('div', { class: `list-hero${heroPics.length ? ' has-pics' : ''}` }, h('h1', {}, title), h('p', {}, `${r.length} producto${r.length === 1 ? '' : 's'}${sub ? ` · ${sub}` : ''}`),
      heroPics.length ? h('div', { class: 'lh-pics', 'aria-hidden': 'true' }, heroPics.map(p => h('img', { src: small(p.image), alt: '', width: 400, height: 400, decoding: 'async' }))) : ic ? h('span', { class: 'ci', 'aria-hidden': 'true' }, icon(ic)) : null),
    chipsTop || null, toolbar);
  if (r.length) w.append(h('div', { class: 'grid' }, r.map((p, i) => card(p, i === 0 ? 'high' : i < 4))));
  else w.append(emptyMsg && !list.length ? emptyMsg : emptyState('i-search', 'Sin resultados con estos filtros', 'Prueba quitando algún filtro.', h('a', { class: 'btn primary', href: location.pathname + (sp.get('q') != null ? `?q=${encodeURIComponent(sp.get('q'))}` : ''), 'data-nav': '' }, 'Quitar filtros')));
  v.append(w);
}
function categoryPage(v, slug) {
  const c = S.catBySlug.get(slug); if (!c) return notFound(v);
  setTitle(c.name);
  listing(v, { title: c.name, sub: CAT_META[c.name]?.[2], ic: c.icon, list: S.products.filter(p => p.category === c.name), crumb: crumbs(['Inicio', '/'], [c.name]) });
}
function searchPage(v) {
  const q = new URLSearchParams(location.search).get('q') || '';
  $('#q').value = q;
  let list = q.trim() ? search(q) : S.products, fixedFrom = null;
  if (q.trim() && !list.length) { const d = didYouMean(q); if (d && search(d).length) { fixedFrom = q; list = search(d); } }
  setTitle(q ? `Resultados para “${q}”` : 'Todos los productos');
  const cats = [...new Set(list.map(p => p.category))].map(n => S.cats.find(c => c.name === n)).filter(Boolean);
  listing(v, {
    title: q ? `Resultados para “${q}”` : 'Todos los productos', sub: `Envío gratis desde ${fmt(S.cfg.freeShippingFrom)}`, ic: 'i-search', list, crumb: crumbs(['Inicio', '/'], ['Búsqueda']),
    chipsTop: h('div', {}, fixedFrom ? h('p', { class: 'dym' }, icon('i-sparkle', 'sm'), `No encontramos “${fixedFrom}”. Te mostramos resultados para “${didYouMean(fixedFrom)}”.`) : null,
      q && cats.length > 1 ? h('div', { class: 'toolbar', style: 'position:static' }, cats.map(c => h('a', { class: 'chip', href: `/c/${c.slug}`, 'data-nav': '' }, icon(c.icon, 'sm'), c.name))) : null),
    emptyMsg: h('div', {}, emptyState('i-search', `No encontramos “${q}”`, 'Revisa la ortografía o usa palabras más generales, como “cepillo” u “organizador”.'),
      h('section', { class: 'section' }, h('div', { class: 'sec-head' }, h('h2', {}, 'Explora por categoría')), catTiles())),
  });
}
function productPage(v, id) {
  const p = S.byId.get(id); if (!p) return notFound(v);
  setTitle(p.name);
  S.recent = [p.id, ...S.recent.filter(x => x !== p.id)].slice(0, 12); store.set('recent', S.recent);
  const c = catOf(p), wa = S.cfg.whatsapp, max = maxOf(p), free = S.cfg.freeShippingFrom;
  const shareUrl = `${location.origin}/p/${p.id}${S.myRef ? `?ref=${S.myRef}` : ''}`;
  const img = h('img', { src: big(p.image), alt: p.name, width: 640, height: 640, fetchpriority: 'high' });
  img.style.viewTransitionName = 'pimg';
  const gal = h('button', { class: 'gallery', type: 'button', 'aria-label': `Ampliar imagen de ${p.name}` }, img, h('span', { class: 'g-badges', 'aria-hidden': 'true' }, tags(p)), h('span', { class: 'zoom-hint', 'aria-hidden': 'true' }, icon('i-expand', 'sm'), 'Ampliar'));
  if (FINE && !REDUCED) {
    gal.addEventListener('mousemove', e => {
      const r = gal.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      gal.classList.add('tilting'); gal.style.setProperty('--ry', `${(x - .5) * 10}deg`); gal.style.setProperty('--rx', `${(.5 - y) * 10}deg`);
      img.style.transformOrigin = `${x * 100}% ${y * 100}%`; img.style.transform = 'scale(1.6)';
    });
    gal.addEventListener('mouseleave', () => { gal.classList.remove('tilting'); gal.style.setProperty('--rx', '0deg'); gal.style.setProperty('--ry', '0deg'); img.style.transform = ''; });
  }
  gal.addEventListener('click', () => lightbox(p));
  let q = 1;
  const addLabel = h('span', {}, max ? 'Agregar al carrito' : 'Agotado');
  const setQ = n => { q = n; qtyLabel.textContent = q; addLabel.textContent = q > 1 ? `Agregar ${q} · ${fmt(p.price * q)}` : 'Agregar al carrito'; };
  const qtyLabel = h('span', { 'aria-live': 'polite' }, '1');
  const qtyBox = h('div', { class: 'stepper outline lg', style: 'width:160px' },
    h('button', { type: 'button', 'aria-label': 'Menos', on: { click: () => setQ(Math.max(1, q - 1)) } }, icon('i-minus', 'sm')), qtyLabel,
    h('button', { type: 'button', 'aria-label': 'Más', on: { click: () => { if (q < max) setQ(q + 1); else toast(`Máximo ${max} unidades por pedido`, null, 'i-package'); } } }, icon('i-plus', 'sm')));
  const addNow = () => setQty(p.id, Math.min(max, qtyOf(p.id) + q), { src: img });
  const addBtn = h('button', { class: 'btn primary xl', type: 'button', disabled: !max, on: { click: () => { addNow(); setQ(1); } } }, icon('i-cart', 'sm'), addLabel);
  const buyBtn = h('button', { class: 'btn navy xl full', type: 'button', disabled: !max, on: { click: () => { if (!qtyOf(p.id)) setQty(p.id, q, { silent: true }); navigate('/checkout'); } } }, icon('i-zap', 'sm'), 'Comprar ahora');
  const share = async () => {
    const data = { title: p.name, text: `${p.name} a ${fmt(p.price)} en ${STORE}`, url: shareUrl };
    if (navigator.share) { try { await navigator.share(data); } catch {} }
    else { try { await navigator.clipboard.writeText(shareUrl); toast('Link copiado', null, 'i-link'); } catch { prompt('Copia el link:', shareUrl); } }
  };
  const benefits = [
    PAY().cod ? 'Paga contra entrega: en efectivo al recibir' : null,
    PAY().mp ? 'Pago 100% seguro con Mercado Pago' : null,
    p.price >= free ? '¡Este producto tiene envío GRATIS!' : `Envío a toda Colombia · GRATIS desde ${fmt(free)}`,
    PAY().mp ? 'Tarjeta de crédito, débito, PSE y más medios' : null,
    wa ? 'Resolvemos tus dudas por WhatsApp' : null,
  ].filter(Boolean);
  const buy = h('div', { class: 'buybox' },
    c ? h('a', { class: 'cat-link', href: `/c/${c.slug}`, 'data-nav': '' }, c.name) : null,
    h('h1', {}, p.name),
    h('div', { class: 'price-row' }, h('div', { class: 'price' }, fmt(p.price)), h('span', { class: 'note' }, 'Precio final en COP')),
    p.stock > 0 && p.stock <= 15 ? h('div', { class: 'urgency', role: 'status' }, icon('i-flame', 'sm'), h('span', {}, `¡Solo quedan ${p.stock} unidades!`), h('div', { class: 'bar' }, h('i', { style: `width:${Math.max(8, p.stock / 15 * 100)}%` }))) : null,
    h('ul', { class: 'benefits' }, benefits.map(b => h('li', {}, icon('i-check', 'sm'), b))),
    h('div', { class: 'actions' }, max ? qtyBox : null, addBtn, buyBtn,
      wa ? h('a', { class: 'btn ghost full', target: '_blank', rel: 'noopener', href: `https://wa.me/${wa}?text=${encodeURIComponent(`Hola, quiero información de: ${p.name} (${p.id})`)}` }, icon('i-msg', 'sm'), 'Preguntar por WhatsApp') : null),
    h('div', { class: 'box' },
      shipProgress(subtotal() + (qtyOf(p.id) ? 0 : p.price)),
      h('div', { class: 'line' }, icon('i-truck'), h('div', {}, h('b', {}, 'Envío a toda Colombia'), h('span', { class: 'muted small' }, `${fmt(S.cfg.shipping)} o GRATIS desde ${fmt(free)}. Te contactamos para confirmar la entrega.`))),
      h('div', { class: 'line' }, icon('i-package'), h('div', {}, h('b', {}, max ? `${p.stock.toLocaleString('es-CO')} unidades disponibles` : 'Sin disponibilidad'), h('span', { class: 'muted small' }, 'Disponibilidad sujeta a confirmación.')))),
    h('section', { class: 'about' }, h('h2', {}, 'Por qué te va a encantar'), descBlock(p.description)),
    h('div', { class: 'share' },
      h('button', { class: 'btn sm', type: 'button', on: { click: share } }, icon('i-share', 'sm'), 'Compartir'),
      h('a', { class: 'btn sm', target: '_blank', rel: 'noopener', href: `https://wa.me/?text=${encodeURIComponent(`Mira esto: ${p.name} a ${fmt(p.price)} ${shareUrl}`)}` }, icon('i-msg', 'sm'), 'Enviar por WhatsApp'),
      favBtn(p)),
    S.myRef ? h('p', { class: 'muted small', style: 'margin:0' }, icon('i-link', 'sm'), ' Tus links incluyen tu código de referido: ganas comisión si compran.') : null,
    h('span', { class: 'ref-code' }, `Ref. ${p.id}`));
  const related = S.products.filter(x => x.category === p.category && x.id !== p.id).sort(byStock).slice(0, 14);
  v.append(h('div', { class: 'wrap' },
    crumbs(['Inicio', '/'], c ? [c.name, `/c/${c.slug}`] : ['Productos', '/buscar?q='], [p.name]),
    h('div', { class: 'pdp' }, h('div', { class: 'gallery-wrap' }, gal), buy),
    rail('Combínalo con', related, c ? `/c/${c.slug}` : null, 'Más productos de la misma categoría.'),
    faq(true)));
  const bar = h('div', { class: 'buybar', id: 'buybar' }, h('div', {}, h('div', { class: 'small muted', style: 'max-width:40vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, p.name), h('div', { class: 'price' }, fmt(p.price))),
    h('button', { class: 'btn primary', type: 'button', disabled: !max, on: { click: addNow } }, icon('i-cart', 'sm'), 'Agregar'));
  v.append(bar); document.body.classList.add('has-buybar');
  let raf = 0;
  const onScroll = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; bar.classList.toggle('show', addBtn.getBoundingClientRect().bottom < $('.hdr').offsetHeight); }); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  cleanup.push(() => { removeEventListener('scroll', onScroll); document.body.classList.remove('has-buybar'); });
  if (wa) $('#waFab').href = `https://wa.me/${wa}?text=${encodeURIComponent(`Hola, quiero información de: ${p.name} (${p.id})`)}`;
}
// Descripción: párrafos y viñetas ("• ...") separados por saltos de línea
function descBlock(text = '') {
  const out = [], lines = String(text).split('\n').map(s => s.trim()).filter(Boolean);
  let ul = null;
  for (const ln of lines) {
    if (ln.startsWith('•')) { ul ??= h('ul', { class: 'feat' }); ul.append(h('li', {}, icon('i-check', 'sm'), ln.replace(/^•\s*/, ''))); continue; }
    if (ul) { out.push(ul); ul = null; }
    if (/^características:?$/i.test(ln)) continue;
    out.push(h('p', { class: 'desc' }, ln));
  }
  if (ul) out.push(ul);
  return out;
}
function lightbox(p) {
  const prev = document.activeElement;
  const close = () => { lb.remove(); document.removeEventListener('keydown', key); document.body.style.overflow = ''; prev?.focus?.(); };
  const key = e => { if (e.key === 'Escape') close(); };
  const btn = h('button', { class: 'icon-btn', 'aria-label': 'Cerrar', on: { click: close } }, icon('i-x'));
  const lb = h('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': p.name, on: { click: e => { if (e.target === lb) close(); } } }, h('img', { src: big(p.image), alt: p.name }), btn);
  document.body.append(lb); document.body.style.overflow = 'hidden'; document.addEventListener('keydown', key); btn.focus();
}
// ---------- Páginas informativas y legales ----------
const INFO = [
  ['nosotros', 'Quiénes somos', 'i-package'], ['envios', 'Envíos y entregas', 'i-truck'], ['cambios-y-garantias', 'Cambios y garantías', 'i-shield'],
  ['contacto', 'Contacto y PQRS', 'i-headset'], ['terminos', 'Términos y condiciones', 'i-receipt'], ['privacidad', 'Privacidad y datos', 'i-lock'],
];
const UPDATED = 'noviembre de 2026';
function legalBox() {
  const L = S.cfg.legal || {}, rows = [['Responsable', L.name || STORE], ['NIT / documento', L.id], ['Dirección', [L.address, L.city].filter(Boolean).join(', ')], ['Correo', L.email], ['Teléfono', L.phone], ['WhatsApp', S.cfg.whatsapp ? `+${S.cfg.whatsapp}` : '']].filter(r => r[1]);
  return h('div', { class: 'legal-box' }, h('dl', {}, rows.flatMap(([k, val]) => h('div', {}, h('dt', {}, k), h('dd', {}, val)))),
    h('p', { class: 'muted small', style: 'margin:8px 0 0' }, 'También puedes escribirnos en cualquier momento desde el ', h('a', { href: '/contacto', 'data-nav': '' }, 'formulario de contacto y PQRS'), '.'));
}
const P = (...k) => h('p', {}, ...k);
const L_ = (href, t) => h('a', { href, 'data-nav': '' }, t);
const UL = items => h('ul', { class: 'ticks' }, items.map(i => h('li', {}, icon('i-check', 'sm'), h('span', {}, i))));
const SEC = (t, ...k) => h('section', { class: 'doc-sec' }, h('h2', {}, t), ...k);
function infoContent(key) {
  const ship = fmt(S.cfg.shipping), free = fmt(S.cfg.freeShippingFrom), pct = S.cfg.commissionPct ?? 10, pay = PAY();
  switch (key) {
    case 'nosotros': return [
      P(`${STORE} es una tienda colombiana en línea. Seleccionamos productos prácticos para el hogar, la cocina, la belleza, la salud, las mascotas y el día a día; los tenemos en nuestra propia bodega y los despachamos directamente a cualquier ciudad del país.`),
      h('div', { class: 'values' }, [
        ['i-package', 'Bodega propia', 'Lo que ves en la tienda está en nuestro inventario. La disponibilidad se actualiza con cada venta.'],
        ['i-truck', 'Envíos a toda Colombia', `Despachamos con transportadoras reconocidas y te damos el número de guía. Envío gratis desde ${free}.`],
        ['i-shield', 'Compra protegida', `${pay.cod ? 'Puedes pagar al recibir. ' : ''}Tienes derecho de retracto y garantía legal en todos los productos.`],
      ].map(([i, t, d]) => h('div', { class: 'value' }, h('span', { class: 'ci' }, icon(i)), h('b', {}, t), h('span', { class: 'muted' }, d)))),
      SEC('Gana dinero con nosotros', P(`Con nuestro programa de referidos recibes el ${pct}% del valor de los productos de cada compra pagada que llegue por tu link. Es gratis y tienes un panel para ver tus ventas y ganancias.`), h('a', { class: 'btn primary', href: '/afiliados.html' }, icon('i-wallet', 'sm'), 'Quiero mi link')),
      SEC('Datos de contacto', legalBox()),
    ];
    case 'envios': return [
      SEC('Cobertura y costo', UL([`Enviamos a todo Colombia, a las ciudades y municipios donde operan nuestras transportadoras.`, `El envío cuesta ${ship} por pedido y es GRATIS en compras desde ${free}.`, 'Ves el costo exacto en el carrito antes de confirmar. No hay cobros sorpresa.'])),
      SEC('Confirmación y despacho', P('Después de hacer tu pedido te contactamos al celular que registraste para confirmar la dirección. Luego lo empacamos y lo despachamos desde nuestra bodega.'),
        P('El tiempo de entrega depende de tu ciudad y de la transportadora. Te lo informamos al confirmar tu pedido.')),
      SEC('Seguimiento', P('Cuando despachamos verás la transportadora y el número de guía en ', L_('/pedidos', 'Mis pedidos'), '. Desde ahí puedes ir directo a la página de rastreo de la transportadora.')),
      pay.cod ? SEC('Pago contra entrega', P('Si elegiste pago contra entrega, le pagas al mensajero el total del pedido (productos + envío) en efectivo al recibirlo. Te recomendamos tener el valor exacto.')) : null,
      SEC('Al recibir tu pedido', UL(['Revisa que el empaque esté en buen estado antes de firmar la guía.', 'Si llega golpeado o abierto, déjalo anotado en la guía y escríbenos con tu número de pedido.', 'Si no hay quien reciba, la transportadora puede intentar de nuevo o dejar aviso. Escríbenos para coordinar.'])),
      P(h('a', { class: 'btn', href: '/contacto', 'data-nav': '' }, icon('i-headset', 'sm'), 'Tengo una pregunta sobre mi envío')),
    ];
    case 'cambios-y-garantias': return [
      P('Protegemos tus derechos como consumidor según el Estatuto del Consumidor (Ley 1480 de 2011).'),
      SEC('Derecho de retracto', P('Como compraste a distancia, puedes retractarte de tu compra dentro de los 5 días hábiles siguientes a la entrega del producto.'),
        UL(['El producto debe estar sin usar, en el mismo estado en que lo recibiste y con su empaque.', 'Los costos de transporte de la devolución corren por tu cuenta, como lo establece la ley.', 'Te devolvemos el dinero pagado, sin descuentos, en un plazo máximo de 30 días calendario desde que ejerces el derecho.', 'No aplica para los casos que excluye la ley, como bienes de uso personal o que por su naturaleza no se puedan devolver.'])),
      SEC('Garantía legal', P('Todos nuestros productos tienen la garantía legal de calidad, idoneidad y seguridad. Si un producto presenta una falla, te ofrecemos la reparación, el cambio por otro igual o la devolución del dinero, según corresponda y en los términos de la ley.'),
        UL(['Te respondemos en máximo 15 días hábiles desde que recibimos tu solicitud.', 'La garantía no cubre daños por mal uso, golpes, humedad, instalación indebida o desgaste normal.', 'Conserva el empaque y el número de tu pedido: nos ayudan a resolver más rápido.'])),
      SEC('Reversión del pago', P('Si pagaste con un medio de pago electrónico y fuiste víctima de fraude, la operación no fue solicitada, no recibiste el producto o el producto no corresponde a lo pedido o es defectuoso, puedes pedir la reversión del pago (art. 51 de la Ley 1480). Debes informarnos y avisar al emisor del medio de pago dentro de los 5 días hábiles siguientes a que tengas conocimiento del hecho, y devolver el producto si lo recibiste.')),
      SEC('Cómo solicitarlo', P('Escríbenos desde el ', L_('/contacto', 'formulario de PQRS'), ' eligiendo “Garantía” o “Retracto” e indica tu número de pedido. Te responderemos al correo que nos dejes con los pasos a seguir.')),
    ];
    case 'terminos': return [
      P(`Estos términos regulan el uso de la tienda en línea ${STORE} y las compras que hagas en ella. Al hacer un pedido los aceptas. Última actualización: ${UPDATED}.`),
      SEC('1. Productos', P('Mostramos fotos, descripciones y unidades disponibles de cada producto. Las imágenes son ilustrativas: el color, el empaque o algunos detalles pueden variar ligeramente. La disponibilidad se confirma al procesar tu pedido.')),
      SEC('2. Precios', P(`Los precios están en pesos colombianos (COP) y son el valor final del producto. El envío (${ship}, o gratis desde ${free}) se muestra por separado antes de confirmar. Si encontramos un error evidente en un precio, te lo informaremos antes de despachar para que decidas si continúas.`)),
      SEC('3. Pedidos', P('Tu pedido queda registrado con un número que ves al finalizar la compra y en “Mis pedidos”. Te contactamos para confirmarlo. Si no hay disponibilidad o no logramos confirmar la entrega, podemos cancelarlo y, si ya pagaste, te devolvemos el total.')),
      SEC('4. Pagos', UL([pay.cod ? 'Contra entrega: pagas en efectivo al recibir el pedido.' : null, pay.mp ? 'En línea con Mercado Pago (tarjetas, PSE y otros medios). Los datos de pago los procesa Mercado Pago; nosotros no los vemos ni los guardamos.' : null].filter(Boolean))),
      SEC('5. Envíos, retracto y garantías', P('Consulta las condiciones en ', L_('/envios', 'Envíos y entregas'), ' y en ', L_('/cambios-y-garantias', 'Cambios y garantías'), '.')),
      SEC('6. Programa de referidos', UL([`Ganas el ${pct}% del valor de los productos (sin envío) de cada pedido pagado que llegue por tu link. En pago contra entrega, la comisión se genera cuando el pedido se entrega y se cobra.`, 'La comisión se anula si el pedido se cancela, se devuelve o se reembolsa.', 'No genera comisión una compra hecha con el mismo correo del vendedor.', 'Los pagos de comisiones se hacen por transferencia, según lo acordado con cada vendedor.', 'Podemos suspender un código de referido si detectamos fraude o uso indebido.'])),
      SEC('7. Uso de la tienda', P('Te comprometes a dar información verdadera y a no usar la tienda con fines ilícitos. Las marcas y nombres de productos de terceros pertenecen a sus respectivos dueños.')),
      SEC('8. Datos personales', P('Tratamos tus datos según nuestra ', L_('/privacidad', 'Política de privacidad'), '.')),
      SEC('9. Ley aplicable y reclamos', P('Estos términos se rigen por las leyes de Colombia. Puedes presentarnos peticiones, quejas y reclamos desde el ', L_('/contacto', 'formulario de PQRS'), '. Si no quedas satisfecho, puedes acudir a la Superintendencia de Industria y Comercio (www.sic.gov.co).')),
      SEC('Responsable', legalBox()),
    ];
    case 'privacidad': return [
      P(`En ${STORE} cuidamos tus datos personales conforme a la Ley 1581 de 2012 y sus decretos reglamentarios. Última actualización: ${UPDATED}.`),
      SEC('Responsable del tratamiento', legalBox()),
      SEC('Qué datos recogemos', UL(['Al comprar: nombre, correo, celular, documento (opcional), dirección, ciudad, departamento y notas de entrega.', 'Si te registras como vendedor: nombre, correo y celular.', 'Si nos escribes: nombre, correo, celular (opcional), número de pedido y tu mensaje.', 'No recogemos datos de tarjetas ni cuentas bancarias: los pagos en línea los procesa Mercado Pago.'])),
      SEC('Para qué los usamos', UL(['Procesar, confirmar, despachar y entregar tus pedidos.', 'Comunicarnos contigo sobre tu pedido, garantías, retractos y solicitudes.', 'Calcular y pagar comisiones del programa de referidos.', 'Cumplir obligaciones legales y contables.'])),
      SEC('Con quién los compartimos', P('Solo con quienes nos ayudan a prestar el servicio: la transportadora que lleva tu pedido (nombre, dirección y celular), el proveedor de pagos cuando pagas en línea y el servicio de alojamiento y base de datos de la tienda. No vendemos ni alquilamos tus datos.')),
      SEC('Tus derechos', UL(['Conocer, actualizar y rectificar tus datos.', 'Pedir prueba de la autorización que nos diste.', 'Saber qué uso le hemos dado a tus datos.', 'Revocar la autorización o pedir que eliminemos tus datos, cuando no exista un deber legal de conservarlos.', 'Presentar quejas ante la Superintendencia de Industria y Comercio.'])),
      SEC('Cómo ejercerlos', P('Escríbenos desde el ', L_('/contacto', 'formulario de contacto'), ' indicando tu solicitud. Respondemos las consultas en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles; si necesitamos más tiempo te avisaremos, dentro de los plazos de la ley.')),
      SEC('Datos en tu dispositivo', P('Tu carrito, favoritos, pedidos recientes y código de referido se guardan en el almacenamiento de tu propio navegador para que no los pierdas. No usamos cookies de publicidad ni herramientas de rastreo de terceros.')),
      SEC('Seguridad', P('Protegemos la información con conexiones cifradas y acceso restringido. Solo el personal autorizado de la tienda puede ver los datos de los pedidos.')),
    ];
    default: return [];
  }
}
function infoPage(v, key) {
  const it = INFO.find(i => i[0] === key); if (!it) return notFound(v);
  setTitle(it[1]);
  const nav = h('nav', { class: 'doc-nav', 'aria-label': 'Información' }, INFO.map(([k, t, i]) => h('a', { href: `/${k}`, 'data-nav': '', 'aria-current': k === key ? 'page' : null }, icon(i, 'sm'), t)));
  const body = key === 'contacto' ? contactForm() : infoContent(key);
  v.append(h('div', { class: 'wrap' }, crumbs(['Inicio', '/'], [it[1]]),
    h('div', { class: 'list-hero' }, h('h1', {}, it[1]), h('p', {}, key === 'contacto' ? 'Peticiones, quejas, reclamos, sugerencias, garantías y retractos.' : `${STORE} · Información para comprar tranquilo`), h('span', { class: 'ci', 'aria-hidden': 'true' }, icon(it[2]))),
    h('div', { class: 'doc' }, nav, h('article', { class: 'doc-body' }, body))));
}
function contactForm() {
  const K = [['peticion', 'Petición o pregunta'], ['queja', 'Queja'], ['reclamo', 'Reclamo'], ['garantia', 'Garantía'], ['retracto', 'Retracto (devolver una compra)'], ['sugerencia', 'Sugerencia'], ['otro', 'Otro']];
  const kind = new URLSearchParams(location.search).get('tipo');
  const fld = (label, el, hint) => h('label', { class: 'field' }, h('span', {}, label), el, hint ? h('small', { class: 'muted' }, hint) : null);
  const recent = (store.get('orders', []) || [])[0];
  const f = h('form', { class: 'pqrs', novalidate: true },
    h('div', { class: 'grid2' },
      fld('Tipo de solicitud', h('select', { name: 'kind' }, K.map(([k, t]) => h('option', { value: k, selected: k === kind }, t)))),
      fld('Número de pedido (opcional)', h('input', { name: 'order_code', maxlength: 20, autocomplete: 'off', placeholder: 'Ej. 3F9A12BC', value: recent?.code || '' })),
      fld('Nombre completo', h('input', { name: 'name', required: true, minlength: 3, maxlength: 80, autocomplete: 'name' })),
      fld('Correo electrónico', h('input', { name: 'email', type: 'email', required: true, maxlength: 120, autocomplete: 'email' }), 'Te respondemos a este correo.'),
      fld('Celular (opcional)', h('input', { name: 'phone', type: 'tel', inputmode: 'tel', maxlength: 20, autocomplete: 'tel' }))),
    fld('Tu mensaje', h('textarea', { name: 'message', required: true, minlength: 10, maxlength: 2000, rows: 6, placeholder: 'Cuéntanos qué pasó o qué necesitas.' })),
    h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', class: 'hp', 'aria-hidden': 'true' }),
    h('p', { class: 'muted small' }, 'Al enviar autorizas el tratamiento de tus datos para responder tu solicitud, según nuestra ', L_('/privacidad', 'Política de privacidad'), '.'),
    h('div', { class: 'form-err', role: 'alert' }),
    h('button', { class: 'btn primary xl', type: 'submit' }, icon('i-msg', 'sm'), 'Enviar mensaje'));
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f)), err = $('.form-err', f), btn = $('button[type=submit]', f);
    err.textContent = '';
    if ((d.name || '').trim().length < 3) return (err.textContent = 'Escribe tu nombre completo.', f.elements.namedItem('name').focus());
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((d.email || '').trim())) return (err.textContent = 'Escribe un correo válido.', f.elements.namedItem('email').focus());
    if ((d.message || '').trim().length < 10) return (err.textContent = 'Cuéntanos un poco más (mínimo 10 caracteres).', f.elements.namedItem('message').focus());
    btn.disabled = true;
    try {
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No pudimos enviar tu mensaje. Intenta de nuevo.');
      f.replaceWith(h('div', { class: 'sent', role: 'status' }, h('span', { class: 'ci' }, icon('i-check', 'lg')), h('h2', {}, '¡Recibimos tu mensaje!'),
        h('p', {}, 'Tu número de radicado es ', h('b', {}, j.code), '. Te responderemos al correo ', h('b', {}, d.email.trim()), '.'),
        h('a', { class: 'btn', href: '/', 'data-nav': '' }, 'Seguir comprando')));
    } catch (x) { err.textContent = x.message; btn.disabled = false; }
  });
  return [
    h('div', { class: 'quick' }, [['/pedidos', 'i-receipt', '¿Dónde está mi pedido?', 'Mira el estado y la guía en Mis pedidos.'], ['/envios', 'i-truck', 'Envíos', 'Costos, tiempos y entregas.'], ['/cambios-y-garantias', 'i-shield', 'Garantías y retracto', 'Tus derechos como consumidor.']]
      .map(([href, i, t, d]) => h('a', { href, 'data-nav': '', class: 'q-card' }, icon(i), h('span', {}, h('b', {}, t), h('small', { class: 'muted' }, d))))),
    S.cfg.whatsapp ? h('a', { class: 'btn ghost', target: '_blank', rel: 'noopener', href: `https://wa.me/${S.cfg.whatsapp}` }, icon('i-msg', 'sm'), 'Escríbenos por WhatsApp') : null,
    SEC('Escríbenos', f),
    SEC('Datos de contacto', legalBox()),
  ];
}
function favsPage(v) {
  setTitle('Favoritos');
  const list = [...S.favs].map(id => S.byId.get(id)).filter(Boolean);
  const w = h('div', { class: 'wrap' }, crumbs(['Inicio', '/'], ['Favoritos']), h('div', { class: 'list-hero' }, h('h1', {}, 'Tus favoritos'), h('p', {}, `${list.length} guardado${list.length === 1 ? '' : 's'} · Agrégalos al carrito antes de que se agoten`), h('span', { class: 'ci', 'aria-hidden': 'true' }, icon('i-heart'))));
  w.append(list.length ? h('div', { class: 'grid' }, list.map(p => card(p))) : emptyState('i-heart', 'Aún no tienes favoritos', 'Toca el corazón en cualquier producto para guardarlo aquí.', h('a', { class: 'btn primary', href: '/', 'data-nav': '' }, 'Descubrir productos')));
  v.append(w);
}

// ---------- Checkout ----------
const RULES = {
  name: [v => v.trim().length >= 3, 'Escribe tu nombre y apellido.'],
  email: [v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()), 'Escribe un correo válido, por ejemplo nombre@gmail.com.'],
  phone: [v => /^\+?\d{7,15}$/.test(v.replace(/[\s-]/g, '')), 'Escribe tu celular de 10 dígitos, por ejemplo 3001234567.'],
  dept: [v => !!v, 'Selecciona tu departamento.'],
  city: [v => v.trim().length >= 2, 'Escribe tu ciudad o municipio.'],
  address: [v => v.trim().length >= 6, 'Escribe la dirección completa (calle, número, barrio).'],
};
let coStep = 1, coExpress = false;
const CITIES = {
  'Amazonas': 'Leticia,Puerto Nariño', 'Antioquia': 'Medellín,Bello,Itagüí,Envigado,Sabaneta,Rionegro,La Estrella,Copacabana,Girardota,Caldas,Marinilla,La Ceja,Apartadó,Turbo,Caucasia',
  'Arauca': 'Arauca,Saravena,Tame', 'Atlántico': 'Barranquilla,Soledad,Malambo,Puerto Colombia,Galapa,Baranoa,Sabanalarga', 'Bogotá D.C.': 'Bogotá',
  'Bolívar': 'Cartagena,Magangué,Turbaco,Arjona,El Carmen de Bolívar', 'Boyacá': 'Tunja,Duitama,Sogamoso,Chiquinquirá,Paipa,Puerto Boyacá',
  'Caldas': 'Manizales,Villamaría,Chinchiná,La Dorada,Riosucio', 'Caquetá': 'Florencia,San Vicente del Caguán', 'Casanare': 'Yopal,Aguazul,Villanueva,Paz de Ariporo',
  'Cauca': 'Popayán,Santander de Quilichao,Puerto Tejada,Patía', 'Cesar': 'Valledupar,Aguachica,Agustín Codazzi,Bosconia', 'Chocó': 'Quibdó,Istmina',
  'Córdoba': 'Montería,Cereté,Lorica,Sahagún,Planeta Rica', 'Cundinamarca': 'Soacha,Chía,Zipaquirá,Facatativá,Fusagasugá,Girardot,Mosquera,Madrid,Funza,Cajicá,Cota,La Calera,Tocancipá,Sopó',
  'Guainía': 'Inírida', 'Guaviare': 'San José del Guaviare', 'Huila': 'Neiva,Pitalito,Garzón,La Plata', 'La Guajira': 'Riohacha,Maicao,Uribia,San Juan del Cesar',
  'Magdalena': 'Santa Marta,Ciénaga,Fundación,El Banco', 'Meta': 'Villavicencio,Acacías,Granada,Puerto López', 'Nariño': 'Pasto,Ipiales,Tumaco,Túquerres',
  'Norte de Santander': 'Cúcuta,Villa del Rosario,Los Patios,Ocaña,Pamplona', 'Putumayo': 'Mocoa,Puerto Asís,Orito', 'Quindío': 'Armenia,Calarcá,Montenegro,La Tebaida,Quimbaya',
  'Risaralda': 'Pereira,Dosquebradas,Santa Rosa de Cabal,La Virginia', 'San Andrés y Providencia': 'San Andrés,Providencia',
  'Santander': 'Bucaramanga,Floridablanca,Girón,Piedecuesta,Barrancabermeja,San Gil,Socorro', 'Sucre': 'Sincelejo,Corozal,Sampués,San Marcos',
  'Tolima': 'Ibagué,Espinal,Melgar,Honda,Chaparral,Mariquita', 'Valle del Cauca': 'Cali,Palmira,Jamundí,Yumbo,Candelaria,Tuluá,Buga,Cartago,Buenaventura',
  'Vaupés': 'Mitú', 'Vichada': 'Puerto Carreño',
};
const MAIL_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com', 'hotmail.es', 'yahoo.es', 'outlook.es', 'msn.com'];
function mailSuggestion(v) {
  const m = v.trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+)$/); if (!m || MAIL_DOMAINS.includes(m[2])) return null;
  let best = null, bd = 9; for (const d of MAIL_DOMAINS) { const x = lev(m[2], d); if (x < bd) { bd = x; best = d; } }
  return best && bd <= 2 ? `${m[1]}@${best}` : null;
}
const phoneFmt = v => { let d = v.replace(/\D/g, ''); if (d.length === 12 && d.startsWith('57')) d = d.slice(2); return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : v.trim(); };
const customerReady = () => { const d = store.get('customer', {}); return Object.keys(RULES).every(k => RULES[k][0](d[k] || '')); };
function saveOrder(o) {
  const list = store.get('orders', []).filter(x => x.id !== o.id);
  const prev = store.get('orders', []).find(x => x.id === o.id) || {};
  store.set('orders', [{ ...prev, ...o }, ...list].slice(0, 20));
}
function checkout(v) {
  setTitle('Finalizar compra');
  const w = h('div', { class: 'wrap' }, crumbs(['Inicio', '/'], ['Finalizar compra']), h('h1', { class: 'co-title' }, 'Finalizar compra')); v.append(w);
  if (!S.cart.length) { coStep = 1; w.append(emptyState('i-cart', 'Tu carrito está vacío', 'Agrega productos para continuar.', h('a', { class: 'btn primary', href: '/', 'data-nav': '' }, 'Descubrir productos'))); return; }
  const data = store.get('customer', {});
  const express = coStep === 2 && coExpress;
  const sub = subtotal(), ship = shippingFor(sub), total = sub + ship;
  const steps = h('div', { class: 'steps', 'aria-label': `Paso ${coStep} de 2` },
    h('span', { class: coStep === 1 ? 'on' : 'done' }, h('i', {}, coStep === 1 ? '1' : icon('i-check', 'sm')), 'Datos de envío'), h('hr'),
    h('span', { class: coStep === 2 ? 'on' : '' }, h('i', {}, '2'), 'Revisar y pagar'));
  const field = (name, label, attrs = {}, opt) => {
    const id = `f-${name}`;
    const input = attrs.tag === 'select'
      ? h('select', { id, name, autocomplete: attrs.autocomplete }, h('option', { value: '' }, 'Selecciona…'), DEPTS.map(d => h('option', { value: d, selected: data[name] === d }, d)))
      : attrs.tag === 'textarea' ? h('textarea', { id, name, rows: 2, maxlength: 300, placeholder: attrs.placeholder }, data[name] || '')
      : h('input', { id, name, type: attrs.type || 'text', inputmode: attrs.inputmode, autocomplete: attrs.autocomplete, placeholder: attrs.placeholder, value: data[name] || '', 'aria-describedby': `${id}-e`, list: attrs.list, enterkeyhint: 'next' });
    const f = h('div', { class: 'field' }, h('label', { for: id }, label, opt ? h('span', { class: 'opt' }, ' (opcional)') : ' *'), input, attrs.help ? h('span', { class: 'help' }, attrs.help) : null, h('span', { class: 'err', id: `${id}-e`, role: 'alert' }, RULES[name]?.[1] || ''));
    input.addEventListener('blur', () => {
      if (name === 'phone' && input.value) { input.value = phoneFmt(input.value); data.phone = input.value; store.set('customer', data); }
      if (name === 'email') {
        f.querySelector('.suggest-mail')?.remove();
        const sug = mailSuggestion(input.value);
        if (sug) f.append(h('span', { class: 'suggest-mail', role: 'status' }, '¿Quisiste decir ', h('button', { type: 'button', on: { click: e => { input.value = sug; data.email = sug; store.set('customer', data); e.currentTarget.parentElement.remove(); validate(f, name, sug); } } }, sug), '?'));
      }
      validate(f, name, input.value);
    });
    input.addEventListener('input', () => { data[name] = input.value; store.set('customer', data); if (f.classList.contains('bad')) validate(f, name, input.value); });
    input.addEventListener('change', () => {
      data[name] = input.value; store.set('customer', data);
      if (name === 'dept') { const dl = $('#cities'); if (dl) dl.replaceChildren(...(CITIES[input.value] || '').split(',').filter(Boolean).map(c => h('option', { value: c }))); }
    });
    return f;
  };
  const validate = (f, name, val) => { const r = RULES[name]; const ok = !r || r[0](val); f.classList.toggle('bad', !ok); f.querySelector('input,select')?.setAttribute('aria-invalid', String(!ok)); return ok; };
  const summary = h('aside', {}, h('details', { class: 'box co-sum', open: matchMedia('(min-width:960px)').matches },
    h('summary', {}, h('span', {}, h('h2', { style: 'font-size:1.4rem' }, 'Resumen del pedido'), h('span', { class: 'muted small' }, `${S.cart.reduce((a, i) => a + i.qty, 0)} producto(s)`)), h('span', { style: 'display:grid;justify-items:end' }, h('span', { class: 'price' }, fmt(total)), h('span', { class: 'tog small' }, 'Ver detalle', icon('i-chev-r', 'sm')))),
    S.cart.map(i => { const p = S.byId.get(i.id); return h('div', { class: 'ci-row', style: 'grid-template-columns:56px 1fr auto' }, h('img', { src: small(p.image), alt: '', style: 'width:56px;height:56px' }), h('div', { class: 'small' }, h('b', {}, p.name), h('div', { class: 'muted' }, `Cantidad: ${i.qty}`)), h('b', { class: 'price' }, fmt(p.price * i.qty))); }),
    h('hr', { style: 'border:0;border-top:1px solid var(--line);margin:0' }),
    h('div', { class: 'sum' }, h('span', {}, 'Subtotal'), h('b', { class: 'price' }, fmt(sub))),
    h('div', { class: 'sum' }, h('span', {}, 'Envío'), h('b', {}, ship ? fmt(ship) : 'GRATIS')),
    h('div', { class: 'sum total' }, h('span', {}, 'Total'), h('span', { class: 'price' }, fmt(total))),
    shipProgress(sub),
    h('div', { class: 'trust' },
      h('div', { class: 'line' }, icon('i-shield'), h('span', {}, PAY().mp ? 'Pagos en línea procesados por Mercado Pago. No guardamos datos de tu tarjeta.' : 'No pagas nada por adelantado: pagas al recibir.')),
      h('div', { class: 'line' }, icon('i-truck'), h('span', {}, 'Envío a toda Colombia. Te contactamos para confirmar la entrega.')))));
  let main;
  if (coStep === 1) {
    const form = h('form', { class: 'box', novalidate: true },
      h('h2', { style: 'font-size:1.5rem' }, '¿A dónde te lo enviamos?'),
      h('div', { class: 'fields' },
        field('name', 'Nombre completo', { autocomplete: 'name' }),
        h('div', { class: 'f2' }, field('email', 'Correo electrónico', { type: 'email', autocomplete: 'email', inputmode: 'email' }), field('phone', 'Celular', { type: 'tel', autocomplete: 'tel', inputmode: 'tel', help: 'Te escribiremos para coordinar la entrega.' })),
        field('doc', 'Cédula', { inputmode: 'numeric' }, true),
        h('div', { class: 'f2' }, field('dept', 'Departamento', { tag: 'select', autocomplete: 'address-level1' }), field('city', 'Ciudad o municipio', { autocomplete: 'address-level2', list: 'cities' })),
        h('datalist', { id: 'cities' }, (CITIES[data.dept] || '').split(',').filter(Boolean).map(c => h('option', { value: c }))),
        field('address', 'Dirección', { autocomplete: 'street-address', placeholder: 'Calle 10 # 20-30, barrio' }),
        field('notes', 'Indicaciones para la entrega', { tag: 'textarea', placeholder: 'Apartamento, torre, punto de referencia…' }, true)),
      h('button', { class: 'btn primary block xl', type: 'submit' }, 'Continuar', icon('i-chev-r', 'sm')));
    form.addEventListener('submit', e => {
      e.preventDefault();
      let first = null;
      for (const name of Object.keys(RULES)) { const f = form.querySelector(`[name=${name}]`).closest('.field'); if (!validate(f, name, form.elements[name].value) && !first) first = form.elements[name]; }
      if (first) { first.focus(); return; }
      store.set('customer', Object.fromEntries(new FormData(form))); coStep = 2; coExpress = false; render();
    });
    main = h('div', {}, steps, form);
  } else {
    const err = h('div', { class: 'alert', role: 'alert', hidden: true });
    const { mp, cod } = PAY();
    let method = store.get('payMethod', mp ? 'mercadopago' : 'contraentrega');
    if ((method === 'mercadopago' && !mp) || (method === 'contraentrega' && !cod)) method = mp ? 'mercadopago' : 'contraentrega';
    const label = () => method === 'contraentrega' ? [icon('i-check', 'sm'), `Confirmar pedido · pagas ${fmt(total)} al recibir`] : [icon('i-lock', 'sm'), `Pagar ${fmt(total)} de forma segura`];
    const pay = h('button', { class: 'btn primary block xl', type: 'button' }, label());
    const opt = (val, ic, title, sub) => {
      const inp = h('input', { type: 'radio', name: 'pm', value: val, checked: method === val, on: { change: () => { method = val; store.set('payMethod', val); pay.replaceChildren(...label()); } } });
      return h('label', { class: 'pm' }, inp, h('span', { class: 'pm-ic' }, icon(ic)), h('span', {}, h('b', {}, title), h('span', { class: 'muted small' }, sub)));
    };
    const methods = h('div', { class: 'pms', role: 'radiogroup', 'aria-label': 'Medio de pago' },
      mp ? opt('mercadopago', 'i-card', 'Pagar en línea', 'Tarjeta de crédito, débito, PSE y más con Mercado Pago.') : null,
      cod ? opt('contraentrega', 'i-wallet', 'Pago contra entrega', `Pagas ${fmt(total)} en efectivo cuando recibes tu pedido.`) : null);
    pay.addEventListener('click', async () => {
      err.hidden = true; pay.disabled = true; pay.replaceChildren(h('span', { class: 'spin' }), method === 'contraentrega' ? 'Confirmando tu pedido…' : 'Conectando con Mercado Pago…');
      try {
        const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: S.cart, customer: store.get('customer', {}), ref: activeRef(), payment_method: method }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'No pudimos crear tu pedido.');
        saveOrder({ id: j.orderId, code: j.code, total, date: new Date().toISOString(), status: 'pending', stage: method === 'contraentrega' ? 'preparing' : 'awaiting_payment' });
        if (method === 'contraentrega') { S.cart = []; store.set('cart', []); store.set(`done_${j.orderId}`, true); store.set(`celebrate_${j.orderId}`, true); }
        coStep = 1; location.href = j.url;
      } catch (x) {
        err.textContent = `${x.message} Revisa tu conexión e inténtalo de nuevo.`; err.hidden = false;
        pay.disabled = false; pay.replaceChildren(...label());
      }
    });
    const d = store.get('customer', {});
    main = h('div', {}, steps,
      express ? h('div', { class: 'express', role: 'status' }, icon('i-zap', 'sm'), 'Compra exprés: usamos los datos de tu última compra. Revisa y confirma.') : null,
      h('div', { class: 'box' },
        h('div', { class: 'sum' }, h('h2', { style: 'font-size:1.4rem' }, 'Enviar a'), h('button', { class: 'btn ghost sm', type: 'button', on: { click: () => { coStep = 1; coExpress = false; render(); } } }, 'Editar')),
        h('div', {}, h('b', {}, d.name), h('div', { class: 'muted' }, `${d.address}, ${d.city}, ${d.dept}`), h('div', { class: 'muted' }, `${d.phone} · ${d.email}`), d.notes ? h('div', { class: 'muted small' }, d.notes) : null)),
      h('div', { class: 'box', style: 'margin-top:14px' },
        h('h2', { style: 'font-size:1.4rem' }, 'Tus productos'),
        h('div', { class: 'review' }, S.cart.map(i => { const p = S.byId.get(i.id); return h('div', { class: 'ci-row' }, h('img', { src: small(p.image), alt: '', width: 72, height: 72 }), h('div', {}, h('b', {}, p.name), h('div', { style: 'margin-top:6px' }, stepper(p, i.qty, 'outline'))), h('b', { class: 'price' }, fmt(p.price * i.qty))); })),
      ),
      h('div', { class: 'box', style: 'margin-top:14px' }, h('h2', { style: 'font-size:1.4rem' }, '¿Cómo quieres pagar?'), methods, err, pay,
        h('p', { class: 'muted small consent' }, 'Al confirmar aceptas los ', L_('/terminos', 'Términos y condiciones'), ' y autorizas el tratamiento de tus datos según la ', L_('/privacidad', 'Política de privacidad'), '. Tienes ', L_('/cambios-y-garantias', 'derecho de retracto'), ' de 5 días hábiles.'),
        h('p', { class: 'muted small center', style: 'margin:0' }, method === 'contraentrega' && !mp ? 'No pagas nada ahora. Te contactamos para coordinar la entrega.' : 'Si eliges pagar en línea te llevaremos a Mercado Pago para completar el pago de forma segura.')));
  }
  w.append(h('div', { class: 'co' }, summary, main));
}
function orderPage(v, id) {
  setTitle('Tu pedido');
  const w = h('div', { class: 'wrap' }, crumbs(['Inicio', '/'], ['Mis pedidos', '/pedidos'], ['Pedido'])); v.append(w);
  const box = h('div', { style: 'margin-top:8px' }, h('div', { class: 'sk', style: 'height:280px;border-radius:28px' })); w.append(box);
  const sp = new URLSearchParams(location.search), pid = sp.get('payment_id') || sp.get('collection_id');
  let tries = 0, alive = true; cleanup.push(() => { alive = false; });
  async function load() {
    let o;
    try { const r = await fetch(`/api/orders/${encodeURIComponent(id)}/status${pid && tries === 0 ? `?payment_id=${encodeURIComponent(pid)}` : ''}`); if (!r.ok) throw 0; o = await r.json(); }
    catch { if (alive) box.replaceChildren(emptyState('i-receipt', 'No encontramos este pedido', 'Revisa el enlace o consulta tus pedidos.', h('a', { class: 'btn primary', href: '/pedidos', 'data-nav': '' }, 'Mis pedidos'))); return; }
    if (!alive) return;
    saveOrder({ id, code: o.code, total: o.total, date: o.created_at, status: o.status, stage: o.stage });
    if (o.status === 'paid' && !store.get(`done_${id}`, false)) {
      store.set(`done_${id}`, true); S.cart = []; store.set('cart', []); updateBadges(); setTimeout(confetti, 350);
    }
    if (store.get(`celebrate_${id}`, false)) { store.set(`celebrate_${id}`, false); setTimeout(confetti, 350); }
    box.replaceChildren(orderView(id, o, load));
    reveal(box);
    if (o.stage === 'awaiting_payment' && tries++ < 40) setTimeout(() => alive && load(), 3000);
  }
  load();
}
const STAGE_LABEL = { awaiting_payment: 'Pendiente de pago', preparing: 'En preparación', packed: 'Empacado', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado', failed: 'No pagado' };
const STAGE_PILL = { awaiting_payment: 'pending', preparing: 'paid', packed: 'paid', shipped: 'paid', delivered: 'paid', cancelled: 'failed', failed: 'failed' };
function orderView(id, o, reload) {
  const wa = S.cfg.whatsapp, cod = o.payment_method === 'contraentrega', st = o.stage;
  const H = {
    awaiting_payment: ['i-clock', 'pending', 'Estamos confirmando tu pago', 'Esto suele tardar unos segundos. Si pagaste por PSE puede tardar un poco más; esta página se actualiza sola.'],
    preparing: ['i-check', '', cod ? '¡Pedido confirmado!' : '¡Pago aprobado!', cod ? `Pagas ${fmt(o.total)} en efectivo cuando lo recibas. Ya estamos preparando tu pedido en bodega y te contactaremos para coordinar la entrega.` : 'Ya estamos preparando tu pedido en bodega. Te contactaremos a tu celular para coordinar la entrega.'],
    packed: ['i-package', '', '¡Tu pedido está empacado!', 'Está listo en bodega y saldrá muy pronto con la transportadora.'],
    shipped: ['i-truck', '', '¡Tu pedido va en camino!', `Lo despachamos con ${o.carrier || 'la transportadora'}${o.tracking ? `, guía ${o.tracking}` : ''}.${cod ? ` Ten listos ${fmt(o.total)} en efectivo para pagar al recibir.` : ''}`],
    delivered: ['i-check', '', '¡Pedido entregado!', '¡Gracias por comprar en USACARGOS SHOP! Esperamos que lo disfrutes.'],
    cancelled: ['i-x', 'failed', 'Pedido cancelado', 'Este pedido fue cancelado. Si tienes dudas, escríbenos.'],
    failed: ['i-x', 'failed', 'El pago no se completó', 'No se realizó ningún cobro. Tus productos siguen en el carrito para que lo intentes de nuevo.'],
  }[st] || ['i-clock', 'pending', 'Pedido en proceso', ''];
  const date = d => d ? new Date(d).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const order = ['awaiting_payment', 'preparing', 'packed', 'shipped', 'delivered'];
  const at = order.indexOf(st), dead = st === 'cancelled' || st === 'failed';
  const cls = i => dead ? (i === 0 ? 'done' : '') : i < at ? 'done' : i === at ? (st === 'delivered' ? 'done' : 'now') : '';
  const step = (c, ic, title, sub, extra) => h('li', { class: c }, h('span', { class: 'dot' }, icon(ic, 'sm')), h('div', {}, h('b', {}, title), sub ? h('span', {}, sub) : null, extra || null));
  const trackLink = o.tracking_url ? h('div', { style: 'margin-top:6px' }, h('a', { class: 'btn sm', target: '_blank', rel: 'noopener', href: o.tracking_url }, icon('i-truck', 'sm'), `Rastrear en ${o.carrier}`)) : null;
  const timeline = h('ol', { class: 'timeline' },
    step('done', 'i-receipt', 'Pedido recibido', date(o.created_at)),
    step(cod ? (dead ? '' : 'done') : (o.paid_at ? 'done' : dead ? '' : 'now'), cod ? 'i-wallet' : o.paid_at ? 'i-check' : 'i-clock',
      cod ? (o.paid_at ? 'Pagado al recibir' : 'Pago contra entrega') : o.paid_at ? 'Pago aprobado' : dead ? 'Pago no completado' : 'Confirmando el pago',
      cod ? (o.paid_at ? date(o.paid_at) : `Pagas ${fmt(o.total)} en efectivo al recibir`) : date(o.paid_at)),
    step(cls(order.indexOf('packed')) || (o.packed_at ? 'done' : ''), 'i-package', 'Empacado en bodega', date(o.packed_at)),
    step(cls(order.indexOf('shipped')) || (o.shipped_at ? 'done' : ''), 'i-truck', 'Enviado', o.shipped_at ? `${date(o.shipped_at)} · ${o.carrier || ''}${o.tracking ? ` · Guía ${o.tracking}` : ''}` : 'Te avisamos cuando salga de bodega.', o.shipped_at ? trackLink : null),
    step(st === 'delivered' ? 'done' : '', 'i-home', 'Entregado', date(o.delivered_at)));
  const items = h('div', { class: 'box' }, h('h2', { style: 'font-size:1.3rem' }, 'Tu pedido'),
    o.items.map(i => h('div', { class: 'ci-row', style: 'grid-template-columns:56px 1fr auto' }, i.image ? h('img', { src: small(i.image), alt: '', style: 'width:56px;height:56px' }) : h('span'), h('div', { class: 'small' }, h('b', {}, i.name), h('div', { class: 'muted' }, `Cantidad: ${i.qty}`)), h('b', { class: 'price' }, fmt(i.price * i.qty)))),
    h('hr', { style: 'border:0;border-top:1px solid var(--line);margin:0' }),
    h('div', { class: 'sum' }, h('span', {}, 'Subtotal'), h('b', { class: 'price' }, fmt(o.subtotal))),
    h('div', { class: 'sum' }, h('span', {}, 'Envío'), h('b', {}, o.shipping ? fmt(o.shipping) : 'GRATIS')),
    h('div', { class: 'sum total' }, h('span', {}, cod && !o.paid_at ? 'Total a pagar al recibir' : 'Total'), h('span', { class: 'price' }, fmt(o.total))),
    h('div', { class: 'muted small' }, `Medio de pago: ${cod ? 'contra entrega (efectivo)' : 'Mercado Pago'}`));
  const ctas = h('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center' },
    st === 'failed' && S.cart.length ? h('a', { class: 'btn primary xl', href: '/checkout', 'data-nav': '' }, icon('i-lock', 'sm'), 'Intentar pagar de nuevo') : null,
    wa ? h('a', { class: 'btn wa xl', target: '_blank', rel: 'noopener', href: `https://wa.me/${wa}?text=${encodeURIComponent(`Hola, hice el pedido #${o.code} en ${STORE}.`)}` }, icon('i-msg', 'sm'), 'Escríbenos por WhatsApp') : null,
    h('a', { class: `btn ${dead ? '' : 'primary'} xl`, href: '/', 'data-nav': '' }, 'Seguir comprando'));
  return h('div', { style: 'display:grid;gap:18px' },
    h('div', { class: 'order-hero' }, h('div', { class: `status-ic ${H[1]}` }, icon(H[0])), h('span', { class: 'code' }, icon('i-receipt', 'sm'), `Pedido #${o.code}`), h('h1', {}, H[2]), h('p', {}, H[3]),
      S.cfg.demo && st === 'awaiting_payment' ? h('button', { class: 'btn glass', type: 'button', on: { click: async () => { await fetch(`/api/demo/pay/${encodeURIComponent(id)}`, { method: 'POST' }); reload(); } } }, 'Simular pago aprobado (demo)') : null),
    h('div', { class: 'co' }, h('div', { class: 'box rv' }, h('h2', { style: 'font-size:1.3rem' }, 'Seguimiento'), timeline), h('aside', { class: 'rv' }, items)),
    ctas);
}
function ordersPage(v) {
  setTitle('Mis pedidos');
  const list = store.get('orders', []);
  const w = h('div', { class: 'wrap' }, crumbs(['Inicio', '/'], ['Mis pedidos']),
    h('div', { class: 'list-hero' }, h('h1', {}, 'Mis pedidos'), h('p', {}, 'Los pedidos que hiciste desde este dispositivo.'), h('span', { class: 'ci', 'aria-hidden': 'true' }, icon('i-receipt'))));
  v.append(w);
  if (!list.length) { w.append(emptyState('i-receipt', 'Aún no tienes pedidos', 'Cuando hagas tu primera compra aparecerá aquí con su estado.', h('a', { class: 'btn primary', href: '/', 'data-nav': '' }, 'Descubrir productos'))); return; }

  const box = h('div', { class: 'orders' }); w.append(box);
  const draw = () => box.replaceChildren(...store.get('orders', []).map(o => h('a', { class: 'order-row', href: `/pedido/${o.id}`, 'data-nav': '' },
    h('span', { class: 'ic' }, icon('i-receipt')),
    h('div', {}, h('b', {}, `Pedido #${o.code || o.id.slice(0, 8).toUpperCase()}`), h('div', { class: 'muted small' }, o.date ? new Date(o.date).toLocaleDateString('es-CO', { dateStyle: 'medium' }) : '')),
    h('div', { style: 'display:grid;justify-items:end;gap:4px' }, h('b', { class: 'price' }, fmt(o.total || 0)), h('span', { class: `pill ${STAGE_PILL[o.stage] || 'pending'}` }, STAGE_LABEL[o.stage] || 'En proceso')))));
  draw();
  Promise.all(list.map(o => fetch(`/api/orders/${encodeURIComponent(o.id)}/status`).then(r => r.ok ? r.json() : null).then(d => d && saveOrder({ id: o.id, code: d.code, total: d.total, status: d.status, stage: d.stage })).catch(() => {}))).then(() => location.pathname === '/pedidos' && draw());
}
function notFound(v) {
  setTitle('Página no encontrada');
  const box = emptyState('i-search', 'No encontramos esta página', 'Puede que el producto ya no esté disponible. Mira lo que más se está llevando la gente:', h('a', { class: 'btn primary', href: '/', 'data-nav': '' }, 'Ir al inicio'), h('a', { class: 'btn', href: '/buscar?q=', 'data-nav': '' }, 'Ver todo el catálogo'));
  const t = $('h2', box); t.replaceWith(h('h1', {}, t.textContent));
  v.append(h('div', { class: 'wrap' }, h('div', { class: 'section' }, box),
    rail('Lo más pedido', S.products.slice().sort(byStock).slice(0, 14), '/buscar?q=', 'Productos con más unidades disponibles.')));
}

// ---------- Router ----------
const ROUTES = [
  [/^\/$/, v => home(v), 'home'],
  [/^\/categorias$/, v => catsPage(v), 'cats'],
  [/^\/c\/([a-z0-9-]+)$/, (v, m) => categoryPage(v, m[1]), null],
  [/^\/buscar$/, v => searchPage(v), null],
  [/^\/p\/([A-Za-z0-9-]+)$/, (v, m) => productPage(v, m[1]), null],
  [/^\/favoritos$/, v => favsPage(v), 'favs'],
  [/^\/checkout$/, v => checkout(v), null],
  [/^\/pedidos$/, v => ordersPage(v), null],
  [/^\/pedido\/([0-9a-f-]{36})$/, (v, m) => orderPage(v, m[1]), null],
  [/^\/(nosotros|contacto|envios|cambios-y-garantias|terminos|privacidad)$/, (v, m) => infoPage(v, m[1]), null],
];
let cleanup = [];
const scrolls = store.get('_s', {});
history.scrollRestoration = 'manual';
function navigate(url, { replace, keepScroll } = {}) {
  if (history.state?.k) scrolls[history.state.k] = scrollY;
  const st = { k: Math.random().toString(36).slice(2) };
  replace ? history.replaceState(st, '', url) : history.pushState(st, '', url);
  if (url.startsWith('/checkout') && !replace) { coExpress = customerReady(); coStep = coExpress ? 2 : 1; }
  const go = vt => render({ keepScroll, vt });
  if (document.startViewTransition && !REDUCED && !keepScroll) {
    const t = document.startViewTransition(() => go(true));
    t.finished.finally(() => { for (const e of $$('img')) if (e.style.viewTransitionName) e.style.viewTransitionName = ''; });
  } else go(false);
}
function render({ restore, keepScroll, vt } = {}) {
  cleanup.forEach(f => f()); cleanup = [];
  const v = $('#view'), y = scrollY; v.replaceChildren(); v.classList.remove('view-enter');
  const path = location.pathname.replace(/\/+$/, '') || '/';
  let tab = null;
  for (const [re, fn, t] of ROUTES) { const m = path.match(re); if (m) { fn(v, m); tab = t; break; } }
  if (!v.childNodes.length) notFound(v);
  if (!vt) { void v.offsetWidth; v.classList.add('view-enter'); }
  for (const a of $$('.bnav [data-tab]')) a.dataset.tab === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  const cslug = path.startsWith('/c/') ? path.slice(3) : null;
  for (const a of $$('#catbar a')) a.getAttribute('href') === `/c/${cslug}` ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  if (keepScroll) scrollTo(0, y);
  else if (restore && history.state?.k && scrolls[history.state.k] != null) requestAnimationFrame(() => scrollTo(0, scrolls[history.state.k]));
  else { scrollTo(0, 0); v.focus({ preventScroll: true }); }
  reveal(v); onScrollFx();
  if (location.hash.length > 1) requestAnimationFrame(() => { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) { $$('.rv', t).forEach(x => x.classList.add('in')); t.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }); } });
  if (S.cfg.whatsapp && !path.startsWith('/p/')) $('#waFab').href = `https://wa.me/${S.cfg.whatsapp}?text=${encodeURIComponent('Hola, quiero información de un producto')}`;
}
addEventListener('popstate', () => render({ restore: true }));
addEventListener('pagehide', () => { if (history.state?.k) scrolls[history.state.k] = scrollY; store.set('_s', scrolls); });
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-nav]');
  if (a && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
    e.preventDefault(); if ($('#drawer').classList.contains('show')) closeCart();
    const href = a.getAttribute('href'), img = a.closest('.card')?.querySelector('.media img');
    if (img && href.startsWith('/p/')) img.style.viewTransitionName = 'pimg';
    navigate(href);
    return;
  }
  if (e.target.closest('[data-open-cart]')) openCart();
  if (e.target.closest('[data-close-cart]') || e.target.id === 'scrim') closeCart();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#drawer').classList.contains('show')) closeCart(); });

let lastY = scrollY, uiRaf = 0;
addEventListener('scroll', () => {
  if (uiRaf) return;
  uiRaf = requestAnimationFrame(() => {
    uiRaf = 0; const y = scrollY, hdr = $('.hdr');
    if (innerWidth < 768 && !hdr.contains(document.activeElement)) {
      if (y > lastY + 6 && y > 180) hdr.classList.add('hide'); else if (y < lastY - 6 || y < 120) hdr.classList.remove('hide');
    } else hdr.classList.remove('hide');
    lastY = y;
    $('#toTop').hidden = y < 1400;
  });
}, { passive: true });
$('#toTop').addEventListener('click', () => { scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); $('#view').focus({ preventScroll: true }); });
addEventListener('offline', () => { if (!$('.offline')) document.body.append(h('div', { class: 'offline', role: 'status' }, icon('i-wifi-off', 'sm'), 'Sin conexión. Puedes seguir mirando el catálogo.')); });
addEventListener('online', () => { $('.offline')?.remove(); toast('Conexión restablecida'); });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

// ---------- Inicio ----------
function skeleton() {
  $('#view').replaceChildren(h('div', { class: 'wrap section' }, h('div', { class: 'sk', style: 'height:320px;margin-bottom:20px;border-radius:28px' }), h('div', { class: 'grid' }, Array.from({ length: 10 }, () => h('div', { class: 'sk', style: 'aspect-ratio:3/4' })))));
}
async function init() {
  skeleton();
  const [cfg, products] = await Promise.all([fetch('/api/config').then(r => r.json()), fetch('/api/products').then(r => r.json())]);
  S.cfg = { ...S.cfg, ...cfg }; S.products = products;
  for (const p of products) { p._n = norm(p.name); p._c = norm(p.category); p._w = p._n.split(/\s+/); p._t = `${p._n} ${p._c} ${norm(p.description)}`; S.byId.set(p.id, p); }
  VOCAB = [...new Set(products.flatMap(p => `${p._n} ${p._c}`.split(/[^a-z0-9]+/)).filter(w => w.length >= 4))];
  const counts = {}; for (const p of products) counts[p.category] = (counts[p.category] || 0) + 1;
  S.cats = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => { const [slug, ic] = CAT_META[name] || [norm(name).replace(/[^a-z0-9]+/g, '-'), 'i-tag']; return { name, slug, icon: ic, count }; });
  for (const c of S.cats) S.catBySlug.set(c.slug, c);
  $('#catbar').replaceChildren(h('a', { href: '/buscar?q=', 'data-nav': '' }, icon('i-grid', 'sm'), 'Todo'), ...S.cats.map(c => h('a', { href: `/c/${c.slug}`, 'data-nav': '' }, icon(c.icon, 'sm'), c.name)));
  $('#ftrCats').replaceChildren(...S.cats.slice(0, 6).map(c => h('a', { href: `/c/${c.slug}`, 'data-nav': '' }, c.name)));
  if (cfg.whatsapp) { $('#waFab').hidden = false; const f = $('#ftrWa'); f.hidden = false; f.href = `https://wa.me/${cfg.whatsapp}`; }
  const promo = $('#promoText');
  promo.replaceChildren('Envío ', h('b', {}, 'GRATIS'), h('span', { class: 'promo-long' }, ' en compras'), ` desde ${fmt(S.cfg.freeShippingFrom)}`, h('span', { class: 'promo-long' }, ' a toda Colombia · ', h('a', { href: '/buscar?q=', 'data-nav': '' }, 'Comprar ahora')));
  if (innerWidth < 420) $('#q').placeholder = '¿Qué buscas?';
  let showRef = false; try { showRef = sessionStorage.getItem('showRef') === '1'; sessionStorage.removeItem('showRef'); } catch {}
  if (showRef && activeRef()) promo.replaceChildren(h('b', {}, '¡Bienvenido!'), ' Llegaste por la recomendación de un amigo. Envío GRATIS desde ', fmt(S.cfg.freeShippingFrom), '.');
  if (cfg.demo) { $('#promo').classList.add('demo'); promo.replaceChildren(h('b', {}, 'Modo demostración:'), ' los pagos no se procesan.'); }
  S.cart = S.cart.filter(i => S.byId.has(i.id)); updateBadges();
  if (!history.state?.k) history.replaceState({ k: Math.random().toString(36).slice(2) }, '', location.href);
  if (location.pathname === '/checkout') { coExpress = customerReady(); coStep = coExpress ? 2 : 1; }
  initSearch(); render({ restore: true });
}
init().catch(() => { $('#view').replaceChildren(h('div', { class: 'wrap section' }, emptyState('i-package', 'No pudimos cargar la tienda', 'Revisa tu conexión a internet.', h('button', { class: 'btn primary', on: { click: () => location.reload() } }, 'Reintentar')))); });
