// Panel de administración de USACARGOS SHOP
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO');
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const dt = d => d ? new Date(d).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '';
const dshort = d => d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '';
const SVGNS = 'http://www.w3.org/2000/svg';
function icon(id, cls = '') { const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('class', `ico ${cls}`.trim()); s.setAttribute('aria-hidden', 'true'); const u = document.createElementNS(SVGNS, 'use'); u.setAttribute('href', `#${id}`); s.append(u); return s; }
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
const STAGE = { awaiting_payment: 'Pendiente de pago', preparing: 'Por despachar', packed: 'Empacado', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado', failed: 'Pago fallido' };
const stChip = s => h('span', { class: `st ${s}` }, STAGE[s] || s);
const pmChip = m => h('span', { class: 'pmc' }, icon(m === 'contraentrega' ? 'i-wallet' : 'i-card'), m === 'contraentrega' ? 'Contra entrega' : 'Mercado Pago');
const EV = { created: 'Pedido creado', paid: 'Pago confirmado', packed: 'Empacado', shipped: 'Despachado', delivered: 'Entregado', cancelled: 'Cancelado', refunded: 'Reembolsado', payment_failed: 'Pago fallido', note: 'Nota interna', commission_paid: 'Comisión pagada' };
let ME = {}, ORDERS = null;

function toast(msg, ok = true) {
  const t = h('div', { class: 'toast', role: 'status' }, icon(ok ? 'i-check' : 'i-alert'), h('span', {}, msg));
  $('#toasts').append(t); setTimeout(() => t.remove(), 3500);
}
async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (r.status === 401 && path !== '/api/admin/login') { showLogin(); throw new Error('Sesión vencida'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Error');
  return j;
}
function modal(content) {
  const m = $('#modal'), prev = document.activeElement;
  const close = () => { m.hidden = true; m.replaceChildren(); document.removeEventListener('keydown', key); prev?.focus?.(); };
  const key = e => { if (e.key === 'Escape') close(); };
  m.replaceChildren(content(close)); m.hidden = false; document.addEventListener('keydown', key);
  m.onclick = e => { if (e.target === m) close(); };
  setTimeout(() => $('input,select,textarea,button', m)?.focus(), 30);
}
function confirmBox(title, text, okLabel, danger) {
  return new Promise(res => modal(close => h('div', { class: 'mbox', role: 'dialog', 'aria-modal': 'true' }, h('h2', {}, title), h('p', { class: 'muted', style: 'margin:0' }, text),
    h('div', { class: 'acts' }, h('button', { class: 'btn', type: 'button', on: { click: () => { close(); res(false); } } }, 'Volver'),
      h('button', { class: `btn ${danger ? 'navy' : 'primary'}`, type: 'button', on: { click: () => { close(); res(true); } } }, okLabel)))));
}
const waLink = (phone, text) => { let d = String(phone || '').replace(/\D/g, ''); if (d.length === 10) d = '57' + d; return `https://wa.me/${d}?text=${encodeURIComponent(text)}`; };
const pageHead = (title, sub, ...actions) => h('div', { class: 'pg-head' }, h('div', {}, h('h1', {}, title), sub ? h('p', {}, sub) : null), actions.length ? h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, actions) : null);

// ---------- Inicio ----------
function barChart(series) {
  const W = 720, H = 220, pad = 24, max = Math.max(1, ...series.map(s => s.total)), bw = (W - pad * 2) / series.length;
  const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'chart'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Ventas de los últimos 30 días. Total ${fmt(series.reduce((s, x) => s + x.total, 0))}`);
  svg.innerHTML = '<defs><linearGradient id="gbar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5A36"/><stop offset="1" stop-color="#FF8552"/></linearGradient></defs>';
  series.forEach((s, i) => {
    const bh = s.total ? Math.max(4, (s.total / max) * (H - 50)) : 2;
    const r = document.createElementNS(SVGNS, 'rect');
    Object.entries({ x: pad + i * bw + 2, y: H - 24 - bh, width: Math.max(2, bw - 4), height: bh, rx: 4, class: 'b' }).forEach(([k, v]) => r.setAttribute(k, v));
    if (!s.total) r.setAttribute('style', 'fill:var(--line)');
    const t = document.createElementNS(SVGNS, 'title'); t.textContent = `${s.day}: ${fmt(s.total)} · ${s.orders} pedido(s)`; r.append(t); svg.append(r);
    if (i % 5 === 0 || i === series.length - 1) { const tx = document.createElementNS(SVGNS, 'text'); tx.setAttribute('x', pad + i * bw + bw / 2); tx.setAttribute('y', H - 6); tx.setAttribute('text-anchor', 'middle'); tx.textContent = s.day.slice(8, 10) + '/' + s.day.slice(5, 7); svg.append(tx); }
  });
  return svg;
}
async function viewHome(m) {
  m.append(pageHead('Hola, bienvenido', 'Así va tu tienda hoy.', h('button', { class: 'btn sm', type: 'button', on: { click: () => route() } }, icon('i-refresh', 'sm'), 'Actualizar')));
  const d = await api('/api/admin/dashboard');
  setBadges(d.toShip); setMsgBadge(d.messagesNew || 0);
  if (d.messagesNew) m.append(h('a', { class: 'card2 alert-msg', href: '#/mensajes' }, icon('i-msg'), h('span', {}, h('b', {}, `Tienes ${d.messagesNew} mensaje${d.messagesNew === 1 ? '' : 's'} nuevo${d.messagesNew === 1 ? '' : 's'} de clientes`), h('small', { class: 'muted' }, 'Peticiones, quejas, reclamos o garantías por responder.')), icon('i-chev-r', 'sm')));
  m.append(
    h('div', { class: 'kgrid' },
      h('div', { class: 'kc hot' }, h('span', { class: 'lbl' }, icon('i-trend'), 'Ventas de hoy'), h('b', {}, fmt(d.salesToday)), h('small', {}, 'Pagos confirmados')),
      h('div', { class: 'kc' }, h('span', { class: 'lbl' }, icon('i-trend'), 'Últimos 7 días'), h('b', {}, fmt(d.sales7))),
      h('div', { class: 'kc' }, h('span', { class: 'lbl' }, icon('i-receipt'), 'Últimos 30 días'), h('b', {}, fmt(d.sales30)), h('small', {}, `${d.orders30} pedidos pagados`)),
      h('div', { class: 'kc' }, h('span', { class: 'lbl' }, icon('i-card'), 'Ticket promedio'), h('b', {}, fmt(d.aov)), h('small', {}, 'Últimos 30 días'))),
    h('div', { class: 'kgrid', style: 'margin-top:12px' },
      h('a', { class: 'kc navy', href: '#/pedidos?f=ship' }, h('span', { class: 'lbl' }, icon('i-package'), 'Por despachar'), h('b', {}, String(d.toShip)), h('small', {}, d.toShip ? 'Empácalos y envíalos' : 'Todo al día')),
      h('a', { class: 'kc', href: '#/pedidos?f=transit' }, h('span', { class: 'lbl' }, icon('i-truck'), 'En camino'), h('b', {}, String(d.inTransit))),
      h('a', { class: 'kc', href: '#/pedidos?f=cod' }, h('span', { class: 'lbl' }, icon('i-wallet'), 'Contra entrega por cobrar'), h('b', {}, String(d.codPending))),
      h('a', { class: 'kc', href: '#/vendedores' }, h('span', { class: 'lbl' }, icon('i-users'), 'Comisiones por pagar'), h('b', {}, fmt(d.commissionsOwed)), h('small', {}, `${d.affiliates} vendedores`))),
    h('div', { class: 'cols2' },
      h('div', { class: 'card2' }, h('h2', {}, 'Ventas de los últimos 30 días'), barChart(d.series)),
      h('div', { class: 'card2' }, h('h2', {}, 'Más vendidos (30 días)'),
        d.topProducts.length ? d.topProducts.map(p => h('div', { class: 'row-i' }, p.image ? h('img', { src: p.image.replace('/fotos/', '/fotos/s/'), alt: '' }) : h('span'), h('div', {}, h('div', { class: 't' }, p.name), h('div', { class: 's' }, `${p.qty} unidades`)), h('b', {}, fmt(p.revenue)))) : h('p', { class: 'empty-s' }, 'Aún no hay ventas pagadas.'))),
    h('div', { class: 'cols2' },
      h('div', { class: 'card2' }, h('h2', {}, 'Pedidos recientes', h('a', { href: '#/pedidos?f=all' }, 'Ver todos')),
        d.recent.length ? d.recent.map(o => h('a', { class: 'row-i', href: `#/pedidos/${o.id}`, style: 'grid-template-columns:1fr auto auto' }, h('div', {}, h('div', { class: 't' }, `#${o.code} · ${o.name || ''}`), h('div', { class: 's' }, `${dt(o.date)} · ${o.city || ''}`)), stChip(o.stage), h('b', {}, fmt(o.total)))) : h('p', { class: 'empty-s' }, 'Aún no hay pedidos. Cuando un cliente compre aparecerá aquí.')),
      h('div', { class: 'card2' }, h('h2', {}, 'Inventario bajo', h('a', { href: '#/productos?f=low' }, 'Ver')),
        d.lowStock.length ? d.lowStock.map(p => h('div', { class: 'row-i' }, p.image ? h('img', { src: p.image.replace('/fotos/', '/fotos/s/'), alt: '' }) : h('span'), h('div', { class: 't' }, p.name), h('b', { style: `color:${p.stock ? 'var(--warn)' : 'var(--err)'}` }, p.stock ? `${p.stock} und.` : 'Agotado'))) : h('p', { class: 'empty-s' }, 'Todo el inventario está bien.'))));
}

// ---------- Pedidos ----------
const FILTERS = [
  ['ship', 'Por despachar', o => ['preparing', 'packed'].includes(o.stage)],
  ['pay', 'Pendientes de pago', o => o.stage === 'awaiting_payment'],
  ['cod', 'Contra entrega por cobrar', o => o.payment_method === 'contraentrega' && o.status === 'pending' && o.stage !== 'cancelled'],
  ['transit', 'En camino', o => o.stage === 'shipped'],
  ['done', 'Entregados', o => o.stage === 'delivered'],
  ['cancel', 'Cancelados', o => ['cancelled', 'failed'].includes(o.stage)],
  ['all', 'Todos', () => true],
];
async function viewOrders(m, q) {
  const f = q.get('f') || 'ship';
  ORDERS = await api('/api/admin/orders');
  setBadges(ORDERS.filter(FILTERS[0][2]).length);
  const current = () => ORDERS.filter((FILTERS.find(x => x[0] === f) || FILTERS[0])[2]);
  m.append(pageHead('Pedidos', 'Todas las ventas en línea de la tienda. Empaca, despacha y entrega desde aquí.',
    f === 'ship' ? h('button', { class: 'btn primary sm', type: 'button', on: { click: () => printSlips(current()) } }, icon('i-print', 'sm'), 'Imprimir todas') : null,
    h('button', { class: 'btn sm', type: 'button', on: { click: () => exportCSV(current(), `pedidos-${f}`) } }, icon('i-download', 'sm'), 'Exportar a Excel')));
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Filtrar pedidos' }, FILTERS.map(([k, label, fn]) => { const n = ORDERS.filter(fn).length; return h('button', { type: 'button', 'aria-pressed': String(k === f), on: { click: () => { location.hash = `#/pedidos?f=${k}`; } } }, label, n && k !== 'all' && k !== 'done' && k !== 'cancel' ? h('span', { class: 'n' }, String(n)) : null); }));
  const input = h('input', { type: 'search', placeholder: 'Buscar por número, nombre, celular o ciudad', 'aria-label': 'Buscar pedidos', value: q.get('q') || '' });
  const list = h('div', { class: 'olist' });
  const draw = () => {
    const fn = (FILTERS.find(x => x[0] === f) || FILTERS[0])[2], term = norm(input.value);
    const rows = ORDERS.filter(fn).filter(o => !term || norm(`${o.code} ${o.customer?.name} ${o.customer?.phone} ${o.customer?.city} ${o.ref_code || ''}`).includes(term));
    list.replaceChildren(...(rows.length ? rows.map(o => h('a', { class: 'orow', href: `#/pedidos/${o.id}` },
      h('div', { class: 'top' }, h('span', { class: 'code' }, `#${o.code}`)),
      h('div', {}, h('div', { style: 'font-weight:700' }, o.customer?.name || ''), h('div', { class: 'who' }, `${o.customer?.city || ''}, ${o.customer?.dept || ''} · ${dt(o.created_at)}`)),
      h('div', { class: 'top' }, stChip(o.stage), pmChip(o.payment_method)),
      h('div', { class: 'who' }, `${o.items.reduce((s, i) => s + i.qty, 0)} producto(s)${o.ref_code ? ` · ref. ${o.ref_code}` : ''}`),
      h('div', { class: 'amt' }, fmt(o.total)))) : [h('div', { class: 'card2', style: 'text-align:center' }, h('p', { class: 'empty-s' }, f === 'ship' ? '¡Todo despachado! No hay pedidos pendientes por enviar.' : 'No hay pedidos en esta vista.'))]));
  };
  input.addEventListener('input', draw);
  m.append(seg, h('div', { class: 'srch' }, icon('i-search'), input), list); draw();
}
const escH = v => String(v ?? '').replace(/[&<>"]/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[x]);
function slipHTML(o) {
  const c = o.customer || {}, cod = o.payment_method === 'contraentrega' && o.status !== 'paid';
  return `<section class="slip"><div class="top"><div><h1>USACARGOS SHOP</h1><div>Orden de despacho</div></div><div style="text-align:right"><div class="big">#${escH(o.code)}</div><div>${escH(dt(o.created_at))}</div></div></div>
  ${cod ? `<div class="cod">COBRAR AL ENTREGAR: ${escH(fmt(o.total))}</div>` : '<div class="box"><b>PAGADO</b> — no cobrar al cliente.</div>'}
  <div class="box"><div style="color:#555">Destinatario</div><div class="big">${escH(c.name)}</div><div>Cel: ${escH(c.phone)}${c.doc ? ` · CC ${escH(c.doc)}` : ''}</div>
  <div style="margin-top:8px" class="big">${escH(c.address)}</div><div class="big">${escH(c.city)}, ${escH(c.dept)}</div>${c.notes ? `<div style="margin-top:6px">Indicaciones: ${escH(c.notes)}</div>` : ''}</div>
  <table><thead><tr><th>Ref.</th><th>Producto</th><th class="r">Cant.</th><th class="r">Valor</th></tr></thead><tbody>
  ${o.items.map(i => `<tr><td>${escH(i.id)}</td><td>${escH(i.name)}</td><td class="r"><b>${i.qty}</b></td><td class="r">${escH(fmt(i.price * i.qty))}</td></tr>`).join('')}
  <tr><td></td><td>Envío</td><td></td><td class="r">${o.shipping ? escH(fmt(o.shipping)) : 'Gratis'}</td></tr><tr><td></td><td><b>Total</b></td><td></td><td class="r"><b>${escH(fmt(o.total))}</b></td></tr></tbody></table>
  ${o.carrier ? `<p>Transportadora: <b>${escH(o.carrier)}</b>${o.tracking ? ` · Guía: <b>${escH(o.tracking)}</b>` : ''}</p>` : ''}
  <p style="margin-top:24px">Empacado por: ____________________ &nbsp; Fecha: ____________</p></section>`;
}
function printSlips(list) {
  if (!list.length) { toast('No hay pedidos para imprimir', false); return; }
  const w = window.open('', '_blank', 'width=820,height=900'); if (!w) { toast('Permite ventanas emergentes para imprimir', false); return; }
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${list.length === 1 ? `Orden de despacho #${escH(list[0].code)}` : `${list.length} órdenes de despacho`}</title><style>
  body{font:14px/1.45 Arial,sans-serif;color:#111;margin:28px}h1{font-size:22px;margin:0}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111;padding-bottom:12px;margin-bottom:16px}
  .box{border:2px solid #111;border-radius:8px;padding:14px;margin:12px 0}.big{font-size:20px;font-weight:700}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border-bottom:1px solid #999;padding:8px;text-align:left}td.r,th.r{text-align:right}
  .cod{background:#111;color:#fff;padding:14px;border-radius:8px;font-size:20px;font-weight:700;text-align:center;margin:12px 0}.slip+.slip{break-before:page;margin-top:40px}</style></head><body>${list.map(slipHTML).join('')}</body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 350);
}
const printSlip = o => printSlips([o]);
function exportCSV(rows, name) {
  const cols = ['Pedido', 'Fecha', 'Estado', 'Pago', 'Cliente', 'Celular', 'Correo', 'Cédula', 'Dirección', 'Ciudad', 'Departamento', 'Indicaciones', 'Productos', 'Unidades', 'Subtotal', 'Envío', 'Total', 'Transportadora', 'Guía', 'Vendedor'];
  const q = v => { const t = String(v ?? ''); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const lines = rows.map(o => { const c = o.customer || {}; return [o.code, dt(o.created_at), STAGE[o.stage] || o.stage, o.payment_method === 'contraentrega' ? 'Contra entrega' : 'Mercado Pago', c.name, c.phone, c.email, c.doc, c.address, c.city, c.dept, c.notes, o.items.map(i => `${i.qty}x ${i.name} (${i.id})`).join(' | '), o.items.reduce((s, i) => s + i.qty, 0), o.subtotal, o.shipping, o.total, o.carrier, o.tracking, o.ref_code].map(q).join(';'); });
  const blob = new Blob(['﻿' + [cols.join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `${name}-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`${rows.length} pedido(s) exportados`);
}
async function viewOrder(m, id) {
  const { order: o, events, affiliate } = await api(`/api/admin/orders/${id}`);
  api('/api/admin/orders').then(list => setBadges(list.filter(x => ['preparing', 'packed'].includes(x.stage)).length)).catch(() => {});
  const c = o.customer || {}, cod = o.payment_method === 'contraentrega';
  const run = async (action, extra = {}, okMsg) => {
    try { const r = await api(`/api/admin/orders/${o.id}/action`, { method: 'POST', body: { action, ...extra } }); toast(okMsg); return r; }
    catch (e) { toast(e.message, false); return null; }
  };
  const shipMsg = (carrier, tracking) => `Hola ${c.name?.split(' ')[0] || ''}, ¡tu pedido #${o.code} de USACARGOS SHOP ya va en camino! Transportadora: ${carrier}${tracking ? `, guía ${tracking}` : ''}.${cod ? ` Recuerda tener listos ${fmt(o.total)} para pagar al recibir.` : ''} Sigue tu pedido aquí: ${ME.baseUrl}/pedido/${o.id}`;
  const shipModal = () => modal(close => {
    const sel = h('select', { required: true }, h('option', { value: '' }, 'Elige la transportadora'), (ME.carriers || []).map(x => h('option', { value: x, selected: x === o.carrier }, x)));
    const guia = h('input', { placeholder: 'Ej: 1234567890', inputmode: 'numeric', value: o.tracking || '' });
    const notify = h('input', { type: 'checkbox', checked: true, style: 'width:20px;min-height:20px' });
    const err = h('p', { class: 'alert', hidden: true });
    return h('form', { class: 'mbox', on: { submit: async e => {
      e.preventDefault(); err.hidden = true;
      const r = await run('ship', { carrier: sel.value, tracking: guia.value }, `Pedido #${o.code} despachado`);
      if (r) { close(); if (notify.checked && c.phone) window.open(waLink(c.phone, shipMsg(sel.value, guia.value)), '_blank'); route({ silent: true }); }
    } } }, h('h2', {}, `Despachar #${o.code}`),
      h('label', {}, 'Transportadora', sel), h('label', {}, 'Número de guía', guia),
      h('label', { style: 'display:flex;align-items:center;gap:10px;font-weight:600' }, notify, 'Avisar al cliente por WhatsApp con la guía'), err,
      h('div', { class: 'acts' }, h('button', { class: 'btn', type: 'button', on: { click: close } }, 'Cancelar'), h('button', { class: 'btn primary', type: 'submit' }, icon('i-truck', 'sm'), 'Marcar como enviado')));
  });
  const cancelModal = () => modal(close => {
    const reason = h('textarea', { placeholder: 'Ej: el cliente desistió, sin stock…', rows: 3 });
    return h('form', { class: 'mbox', on: { submit: async e => { e.preventDefault(); if (await run('cancel', { note: reason.value }, `Pedido #${o.code} cancelado`)) { close(); route({ silent: true }); } } } },
      h('h2', {}, `Cancelar #${o.code}`), h('p', { class: 'muted', style: 'margin:0' }, o.status === 'paid' && !cod ? 'El pedido está pagado por Mercado Pago: recuerda hacer el reembolso desde tu cuenta de Mercado Pago. El inventario se devuelve si no se ha despachado.' : 'El inventario se devuelve automáticamente si el pedido no se ha despachado.'),
      h('label', {}, 'Motivo', reason),
      h('div', { class: 'acts' }, h('button', { class: 'btn', type: 'button', on: { click: close } }, 'Volver'), h('button', { class: 'btn navy', type: 'submit' }, 'Cancelar pedido')));
  });
  const primary = [];
  if (o.stage === 'preparing') primary.push(h('button', { class: 'btn primary', type: 'button', on: { click: async () => { if (await run('pack', {}, 'Pedido empacado')) route({ silent: true }); } } }, icon('i-package', 'sm'), 'Marcar empacado'), h('button', { class: 'btn navy', type: 'button', on: { click: shipModal } }, icon('i-truck', 'sm'), 'Despachar'));
  if (o.stage === 'packed') primary.push(h('button', { class: 'btn primary', type: 'button', on: { click: shipModal } }, icon('i-truck', 'sm'), 'Despachar'));
  if (o.stage === 'shipped') primary.push(h('button', { class: 'btn primary', type: 'button', on: { click: async () => { if (await confirmBox('¿Marcar como entregado?', cod ? `Confirma que el cliente recibió y pagó ${fmt(o.total)} en efectivo.` : 'Confirma que el cliente recibió el pedido.', 'Sí, entregado') && await run('deliver', {}, 'Pedido entregado')) route({ silent: true }); } } }, icon('i-check', 'sm'), cod ? 'Entregado y cobrado' : 'Marcar entregado'));
  const secondary = [
    h('button', { class: 'btn', type: 'button', on: { click: () => printSlip(o) } }, icon('i-print', 'sm'), 'Imprimir orden'),
    c.phone ? h('a', { class: 'btn wa', target: '_blank', rel: 'noopener', href: waLink(c.phone, o.stage === 'shipped' ? shipMsg(o.carrier, o.tracking) : `Hola ${c.name?.split(' ')[0] || ''}, te escribimos de USACARGOS SHOP por tu pedido #${o.code}.`) }, icon('i-msg', 'sm'), 'WhatsApp') : null,
    o.status === 'pending' && o.stage !== 'cancelled' ? h('button', { class: 'btn', type: 'button', on: { click: async () => { if (await confirmBox('¿Confirmar pago?', `Marca el pedido #${o.code} como pagado (${fmt(o.total)}).`, 'Confirmar pago') && await run('mark_paid', {}, 'Pago confirmado')) route({ silent: true }); } } }, icon('i-wallet', 'sm'), 'Marcar pagado') : null,
    !['delivered', 'cancelled'].includes(o.stage) ? h('button', { class: 'btn ghost', type: 'button', on: { click: cancelModal } }, icon('i-x', 'sm'), 'Cancelar') : null,
  ];
  const note = h('textarea', { class: 'note', placeholder: 'Nota interna (solo la ves tú)' }, o.admin_note || '');
  const addr = `${c.name}\n${c.address}\n${c.city}, ${c.dept}\nCel: ${c.phone}`;
  m.append(
    h('a', { class: 'back', href: '#/pedidos' }, icon('i-chev-l', 'sm'), 'Pedidos'),
    pageHead(`Pedido #${o.code}`, dt(o.created_at), stChip(o.stage), pmChip(o.payment_method)),
    h('div', { class: 'od' },
      h('div', {},
        h('div', { class: 'actionbar' }, primary, secondary),
        cod && o.status !== 'paid' && o.stage !== 'cancelled' ? h('div', { class: 'cod-box' }, `Contra entrega: el mensajero debe cobrar ${fmt(o.total)} en efectivo.`) : null,
        h('div', { class: 'card2' }, h('h2', {}, 'Productos'),
          o.items.map(i => h('div', { class: 'row-i' }, h('img', { src: `/fotos/${i.id}.webp`, alt: '' }), h('div', {}, h('div', { class: 't' }, i.name), h('div', { class: 's' }, `${i.id} · ${fmt(i.price)} × ${i.qty}`)), h('b', {}, fmt(i.price * i.qty)))),
          h('dl', { class: 'kv' }, h('dt', {}, 'Subtotal'), h('dd', {}, fmt(o.subtotal)), h('dt', {}, 'Envío'), h('dd', {}, o.shipping ? fmt(o.shipping) : 'Gratis'), h('dt', {}, 'Total'), h('dd', { style: 'font-size:1.2rem' }, fmt(o.total)))),
        h('div', { class: 'card2' }, h('h2', {}, 'Historial'), h('ul', { class: 'events' }, events.map(e => h('li', {}, h('div', {}, h('b', {}, EV[e.type] || e.type), h('span', {}, `${dt(e.created_at)}${e.detail ? ` · ${e.detail}` : ''}`))))))),
      h('div', {},
        h('div', { class: 'card2' }, h('h2', {}, 'Cliente'),
          h('dl', { class: 'kv' }, h('dt', {}, 'Nombre'), h('dd', {}, c.name), h('dt', {}, 'Celular'), h('dd', {}, h('a', { href: `tel:${c.phone}` }, c.phone)), h('dt', {}, 'Correo'), h('dd', {}, c.email), c.doc ? [h('dt', {}, 'Cédula'), h('dd', {}, c.doc)] : null)),
        h('div', { class: 'card2' }, h('h2', {}, 'Dirección de envío', h('button', { class: 'btn sm', type: 'button', on: { click: () => navigator.clipboard.writeText(addr).then(() => toast('Dirección copiada')) } }, icon('i-copy', 'sm'), 'Copiar')),
          h('div', { class: 'addr' }, `${c.address}\n${c.city}, ${c.dept}`), c.notes ? h('p', { class: 'muted', style: 'margin:0' }, `Indicaciones: ${c.notes}`) : null,
          o.carrier ? h('dl', { class: 'kv' }, h('dt', {}, 'Transportadora'), h('dd', {}, o.carrier), h('dt', {}, 'Guía'), h('dd', {}, o.tracking || '—')) : null),
        affiliate ? h('div', { class: 'card2' }, h('h2', {}, 'Vendido por referido'), h('dl', { class: 'kv' }, h('dt', {}, 'Vendedor'), h('dd', {}, h('a', { href: `#/vendedores/${affiliate.code}` }, affiliate.name)), h('dt', {}, 'Comisión'), h('dd', {}, `${fmt(o.commission || Math.round(o.subtotal * (ME.commissionPct || 10) / 100))} · ${({ none: 'por confirmar', pending: 'por pagar', paid: 'pagada', cancelled: 'cancelada' })[o.commission_status]}`))) : null,
        h('div', { class: 'card2' }, h('h2', {}, 'Nota interna'), note, h('button', { class: 'btn sm', type: 'button', on: { click: async () => { try { await api(`/api/admin/orders/${o.id}/note`, { method: 'POST', body: { note: note.value } }); toast('Nota guardada'); } catch (e) { toast(e.message, false); } } } }, 'Guardar nota')))));
}

// ---------- Productos ----------
async function viewProducts(m, q) {
  const list = await api('/api/admin/products');
  let f = q.get('f') || 'all';
  m.append(pageHead('Productos', `${list.length} productos · inventario de tu bodega. Los cambios se guardan solos.`));
  const seg = h('div', { class: 'seg' }, [['all', 'Todos'], ['low', 'Bajo inventario'], ['off', 'Ocultos']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(k === f), on: { click: () => { f = k; $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.textContent === l))); draw(); } } }, l)));
  const input = h('input', { type: 'search', placeholder: 'Buscar por nombre, referencia o categoría', 'aria-label': 'Buscar productos' });
  const box = h('div', { class: 'ptable' });
  const save = async (p, patch, el) => {
    try { const r = await api(`/api/admin/products/${p.id}`, { method: 'POST', body: patch }); Object.assign(p, r); toast(`${p.name}: guardado`); if (el) el.classList.toggle('low', p.stock <= 5); }
    catch (e) { toast(e.message, false); }
  };
  const draw = () => {
    const t = norm(input.value);
    const rows = list.filter(p => (f === 'all' || (f === 'low' && p.active && p.stock <= 5) || (f === 'off' && !p.active)) && (!t || norm(`${p.name} ${p.id} ${p.category}`).includes(t)));
    box.replaceChildren(...rows.slice(0, 300).map(p => {
      const price = h('input', { type: 'number', min: 0, step: 100, value: p.price, 'aria-label': `Precio de ${p.name}` });
      const stock = h('input', { type: 'number', min: 0, step: 1, value: p.stock, class: p.stock <= 5 ? 'low' : '', 'aria-label': `Inventario de ${p.name}` });
      const act = h('input', { type: 'checkbox', checked: p.active, 'aria-label': `Mostrar ${p.name} en la tienda` });
      price.addEventListener('change', () => save(p, { price: price.value }));
      stock.addEventListener('change', () => save(p, { stock: stock.value }, stock));
      act.addEventListener('change', () => save(p, { active: act.checked }));
      const margin = p.cost ? Math.round((p.price - p.cost) / p.price * 100) : null;
      const edit = () => modal(close => {
        const nm = h('input', { value: p.name, maxlength: 80, required: true }), ds = h('textarea', { rows: 8, maxlength: 2000 });
        ds.value = p.description || '';
        return h('form', { class: 'mbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Editar ${p.name}`, on: { submit: async e => {
          e.preventDefault(); if (nm.value.trim().length < 3) return toast('El nombre es muy corto', false);
          await save(p, { name: nm.value.trim(), description: ds.value }); close(); draw();
        } } }, h('h2', {}, 'Editar textos'), h('p', { class: 'muted small', style: 'margin:0' }, `${p.id} · Usa una línea que empiece con “•” para cada característica.`),
          h('label', { class: 'fl' }, 'Nombre', nm), h('label', { class: 'fl' }, 'Descripción', ds),
          h('div', { class: 'acts' }, h('button', { class: 'btn', type: 'button', on: { click: close } }, 'Cancelar'), h('button', { class: 'btn primary', type: 'submit' }, 'Guardar')));
      });
      return h('div', { class: 'prow' }, h('img', { src: p.image.replace('/fotos/', '/fotos/s/'), alt: '', loading: 'lazy' }),
        h('div', { class: 'nm' }, h('b', {}, p.name), h('span', {}, `${p.id} · ${p.category}`), margin != null ? h('div', { class: 'margin' }, `Costo ${fmt(p.cost)} · margen ${margin}%`) : null,
          h('button', { class: 'lnk', type: 'button', on: { click: edit } }, 'Editar nombre y descripción')),
        h('div', { class: 'ed' }, h('label', {}, 'Precio', price), h('label', {}, 'Inventario', stock), h('label', {}, 'Visible', h('span', { class: 'sw' }, act, h('span')))));
    }));
    if (!rows.length) box.append(h('p', { class: 'empty-s' }, 'No hay productos en esta vista.'));
  };
  input.addEventListener('input', draw);
  m.append(seg, h('div', { class: 'srch' }, icon('i-search'), input), box); draw();
}

// ---------- Vendedores ----------
async function viewSellers(m) {
  const list = await api('/api/admin/affiliates');
  const owed = list.reduce((s, a) => s + a.pending, 0), rev = list.reduce((s, a) => s + a.revenue, 0);
  m.append(pageHead('Vendedores', 'Tus referidos: lo que venden, lo que ganan y su panel.'),
    h('div', { class: 'kgrid', style: 'margin-bottom:16px' },
      h('div', { class: 'kc navy' }, h('span', { class: 'lbl' }, icon('i-users'), 'Vendedores'), h('b', {}, String(list.length))),
      h('div', { class: 'kc' }, h('span', { class: 'lbl' }, icon('i-trend'), 'Ventas por referidos'), h('b', {}, fmt(rev))),
      h('div', { class: 'kc hot' }, h('span', { class: 'lbl' }, icon('i-wallet'), 'Comisiones por pagar'), h('b', {}, fmt(owed))),
      h('div', { class: 'kc' }, h('span', { class: 'lbl' }, icon('i-check'), 'Comisiones pagadas'), h('b', {}, fmt(list.reduce((s, a) => s + a.paidOut, 0))))));
  if (!list.length) { m.append(h('div', { class: 'card2', style: 'text-align:center' }, h('p', { class: 'empty-s' }, 'Aún no hay vendedores. Comparte el enlace de registro:'), h('a', { class: 'btn primary', href: '/afiliados.html', target: '_blank' }, 'Abrir página de referidos'))); return; }
  m.append(h('div', { class: 'vlist' }, list.map(a => h('a', { class: 'vrow', href: `#/vendedores/${a.code}` },
    h('span', { class: 'av' }, (a.name || '?').trim()[0].toUpperCase()),
    h('div', {}, h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, h('b', {}, a.name), h('span', { class: `lvl ${a.level}` }, a.level)),
      h('div', { class: 'meta2' }, h('span', {}, `${a.sales} ventas`), h('span', {}, `${fmt(a.revenue)} vendidos`), h('span', {}, `${a.clicks} visitas`), h('span', {}, `${a.conversion}% conversión`))),
    h('div', { style: 'text-align:right' }, h('div', { class: 'muted small' }, 'Por pagar'), h('b', { style: `font-size:1.1rem;color:${a.pending ? 'var(--brand-600)' : 'inherit'}` }, fmt(a.pending)))))));
}
async function viewSeller(m, code) {
  const s = await api(`/api/admin/affiliates/${encodeURIComponent(code)}/stats`);
  m.append(h('a', { class: 'back', href: '#/vendedores' }, icon('i-chev-l', 'sm'), 'Vendedores'),
    pageHead(s.name, `${s.email} · ${s.phone} · desde ${dshort(s.created_at)}`,
      s.pending ? h('button', { class: 'btn primary', type: 'button', on: { click: async () => {
        if (!await confirmBox('¿Registrar pago de comisiones?', `Confirma que ya le pagaste ${fmt(s.pending)} a ${s.name}. Las comisiones quedarán como pagadas.`, 'Sí, ya pagué')) return;
        try { const r = await api(`/api/admin/affiliates/${encodeURIComponent(code)}/payout`, { method: 'POST', body: {} }); toast(`Registrado: ${fmt(r.amount)} pagados`); route({ silent: true }); } catch (e) { toast(e.message, false); }
      } } }, icon('i-wallet', 'sm'), `Pagar ${fmt(s.pending)}`) : null,
      h('a', { class: 'btn wa', target: '_blank', rel: 'noopener', href: waLink(s.phone, `Hola ${s.name.split(' ')[0]}, te escribimos de USACARGOS SHOP.`) }, icon('i-msg', 'sm'), 'WhatsApp'),
      h('button', { class: 'btn', type: 'button', on: { click: () => navigator.clipboard.writeText(s.panel).then(() => toast('Enlace del panel copiado: envíaselo si lo perdió')) } }, icon('i-copy', 'sm'), 'Copiar enlace de su panel')),
    h('iframe', { class: 'frame', src: `/afiliados.html?code=${encodeURIComponent(code)}&admin=1`, title: `Panel de ${s.name}` }));
}

// ---------- Mensajes (PQRS) ----------
const KIND = { peticion: 'Petición', queja: 'Queja', reclamo: 'Reclamo', sugerencia: 'Sugerencia', garantia: 'Garantía', retracto: 'Retracto', otro: 'Otro' };
const MSG_ST = { nuevo: ['Nuevo', 'preparing'], en_proceso: ['En proceso', 'packed'], resuelto: ['Resuelto', 'delivered'] };
function setMsgBadge(n) { for (const id of ['nbMsg', 'nbMsg2']) { const b = document.getElementById(id); if (b) { b.textContent = n; b.hidden = !n; } } }
async function viewMessages(m, q) {
  const list = await api('/api/admin/messages'), f = q.get('f') || 'nuevo';
  setMsgBadge(list.filter(x => x.status === 'nuevo').length);
  const F = [['nuevo', 'Nuevos'], ['en_proceso', 'En proceso'], ['resuelto', 'Resueltos'], ['all', 'Todos']];
  m.append(pageHead('Mensajes', 'Peticiones, quejas, reclamos, garantías y retractos que llegan desde la página de contacto.', h('a', { class: 'btn sm', href: '/contacto', target: '_blank', rel: 'noopener' }, icon('i-ext', 'sm'), 'Ver formulario')),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Filtrar mensajes' }, F.map(([k, l]) => { const n = k === 'all' ? list.length : list.filter(x => x.status === k).length; return h('button', { type: 'button', 'aria-pressed': String(k === f), on: { click: () => { location.hash = `#/mensajes?f=${k}`; } } }, l, n && k !== 'all' && k !== 'resuelto' ? h('span', { class: 'n' }, String(n)) : null); })));
  const rows = list.filter(x => f === 'all' || x.status === f);
  if (!rows.length) { m.append(h('div', { class: 'card2' }, h('p', { class: 'empty-s' }, f === 'nuevo' ? 'No tienes mensajes nuevos. ¡Todo al día!' : 'No hay mensajes en esta lista.'))); return; }
  m.append(h('div', { class: 'msgs' }, rows.map(x => {
    const save = async (patch, ok) => { try { await api(`/api/admin/messages/${x.id}`, { method: 'POST', body: patch }); toast(ok); } catch (e) { toast(e.message, false); } };
    const sel = h('select', { 'aria-label': `Estado de ${x.code}`, on: { change: async () => { await save({ status: sel.value }, 'Estado actualizado'); route({ silent: true }); } } }, Object.entries(MSG_ST).map(([k, [l]]) => h('option', { value: k, selected: k === x.status }, l)));
    const note = h('textarea', { rows: 2, placeholder: 'Nota interna (qué respondiste, acuerdos, etc.)', 'aria-label': `Nota interna de ${x.code}`, on: { change: () => save({ admin_note: note.value }, 'Nota guardada') } });
    note.value = x.admin_note || '';
    const subj = `Respuesta a tu solicitud ${x.code} · USACARGOS SHOP`;
    return h('article', { class: 'card2 msg' },
      h('div', { class: 'msg-h' }, h('b', {}, x.code), h('span', { class: `st ${MSG_ST[x.status]?.[1] || ''}` }, MSG_ST[x.status]?.[0] || x.status), h('span', { class: 'kind' }, KIND[x.kind] || x.kind), h('span', { class: 'muted small' }, dt(x.created_at))),
      h('div', { class: 'msg-who' }, h('b', {}, x.name), h('a', { href: `mailto:${x.email}?subject=${encodeURIComponent(subj)}` }, x.email), x.phone ? h('a', { href: waLink(x.phone, `Hola ${x.name.split(' ')[0]}, te escribimos de USACARGOS SHOP sobre tu solicitud ${x.code}.`), target: '_blank', rel: 'noopener' }, `WhatsApp ${x.phone}`) : null,
        x.order_code ? h('a', { href: `#/pedidos?f=all&q=${encodeURIComponent(x.order_code)}` }, `Pedido #${x.order_code}`) : null),
      h('p', { class: 'msg-t' }, x.message),
      h('div', { class: 'msg-a' }, h('label', {}, 'Estado ', sel), note,
        h('a', { class: 'btn sm primary', href: `mailto:${x.email}?subject=${encodeURIComponent(subj)}` }, icon('i-msg', 'sm'), 'Responder por correo')));
  })));
}

// ---------- Router ----------
let baseTitle = 'USACARGOS ADMIN', pendingShip = 0;
const paintTitle = () => { document.title = (pendingShip ? `(${pendingShip}) ` : '') + baseTitle; };
function setBadges(n) { pendingShip = n; for (const id of ['nbShip', 'nbShip2']) { const b = document.getElementById(id); b.textContent = n; b.hidden = !n; } paintTitle(); }
async function route(opts = {}) {
  const m = $('#main'), [path, qs] = (location.hash.slice(1) || '/inicio').split('?'), q = new URLSearchParams(qs || ''), y = scrollY;
  const parts = path.split('/').filter(Boolean), sec = parts[0] || 'inicio';
  for (const a of $$('[data-r]')) a.dataset.r === sec ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  if (!opts.silent) m.replaceChildren(h('div', { class: 'sk', style: 'height:140px;border-radius:18px' }));
  try {
    const frag = h('div', { class: opts.silent ? '' : 'view-enter' });
    if (sec === 'pedidos' && parts[1]) await viewOrder(frag, parts[1]);
    else if (sec === 'pedidos') await viewOrders(frag, q);
    else if (sec === 'productos') await viewProducts(frag, q);
    else if (sec === 'vendedores' && parts[1]) await viewSeller(frag, parts[1]);
    else if (sec === 'vendedores') await viewSellers(frag);
    else if (sec === 'mensajes') await viewMessages(frag, q);
    else await viewHome(frag);
    m.replaceChildren(frag);
    if (opts.silent) scrollTo(0, y); else { scrollTo(0, 0); m.focus({ preventScroll: true }); }
    baseTitle = `${$('h1', frag)?.textContent || 'Administración'} · USACARGOS ADMIN`; paintTitle();
  } catch (e) { if (e.message !== 'Sesión vencida') m.replaceChildren(h('div', { class: 'card2' }, h('h2', {}, 'No pudimos cargar esta sección'), h('p', { class: 'muted' }, e.message), h('button', { class: 'btn primary', on: { click: route } }, 'Reintentar'))); }
}
function showLogin() { $('#app').hidden = true; $('#login').hidden = false; setTimeout(() => $('#pw').focus(), 30); }
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); const err = $('#loginErr'); err.hidden = true;
  try { await api('/api/admin/login', { method: 'POST', body: { password: $('#pw').value } }); $('#pw').value = ''; start(); }
  catch (x) { err.textContent = x.message; err.hidden = false; }
});
$('#logout').addEventListener('click', async () => { await fetch('/api/admin/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } }); showLogin(); });
async function start() {
  ME = await fetch('/api/admin/me').then(r => r.json());
  if (!ME.admin) return showLogin();
  $('#login').hidden = true; $('#app').hidden = false; route();
}
addEventListener('hashchange', () => { if (!$('#app').hidden) route(); });
setInterval(() => {
  if (document.hidden || $('#app').hidden || !$('#modal').hidden || document.activeElement?.matches?.('input,textarea,select')) return;
  if (/^#\/(inicio)?$|^#\/pedidos(\?.*)?$/.test(location.hash || '#/')) route({ silent: true });
}, 60_000);
start();
