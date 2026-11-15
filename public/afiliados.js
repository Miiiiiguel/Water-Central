// Programa de referidos de USACARGOS SHOP: registro y panel del vendedor
const $ = s => document.querySelector(s);
const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO');
const p = new URLSearchParams(location.search);
let PCT = 10;
const el = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [x, v] of Object.entries(a)) x === 'on' ? Object.entries(v).forEach(([ev, fn]) => e.addEventListener(ev, fn)) : e.setAttribute(x, v); e.append(...k.filter(z => z != null)); return e; };
const toast = m => { const t = el('div', { class: 'toast', role: 'status' }, m); $('#toasts').append(t); setTimeout(() => t.remove(), 3000); };
async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); } catch { prompt('Copia el link:', text); return; }
  if (btn) { const o = btn.textContent; btn.textContent = '¡Copiado!'; setTimeout(() => btn.textContent = o, 1500); } else toast('Link copiado');
}
document.addEventListener('click', e => { const id = e.target.dataset?.copy; if (id) copy(document.getElementById(id).value, e.target); });
function shareButtons(box, link, glass) {
  const msg = `Mira esta tienda: tiene de todo para la casa, belleza y mascotas, con envío a toda Colombia ${link}`;
  box.replaceChildren(...[
    el('a', { class: 'btn wa', target: '_blank', rel: 'noopener', href: `https://wa.me/?text=${encodeURIComponent(msg)}` }, 'Compartir por WhatsApp'),
    navigator.share ? el('button', { class: `btn ${glass ? 'glass' : ''}`, type: 'button', on: { click: () => navigator.share({ title: 'USACARGOS SHOP', text: msg, url: link }).catch(() => {}) } }, 'Más opciones') : null].filter(Boolean));
}
async function products(code) {
  const list = await fetch('/api/products').then(r => r.json()).catch(() => []);
  const top = list.filter(x => x.stock > 0).sort((a, b) => b.stock - a.stock).slice(0, 12);
  $('#prods').replaceChildren(...top.map(x => {
    const url = `${location.origin}/p/${x.id}?ref=${code}`;
    const msg = `${x.name} a ${fmt(x.price)}, con envío a toda Colombia: ${url}`;
    return el('div', { class: 'prod' }, el('img', { src: x.image, alt: '', loading: 'lazy' }),
      el('div', {}, el('b', {}, x.name), el('div', { class: 'muted small' }, `${fmt(x.price)} · ganas ${fmt(x.price * PCT / 100)}`)),
      el('div', { class: 'acts' },
        el('button', { class: 'btn', type: 'button', 'aria-label': `Copiar link de ${x.name}`, on: { click: () => copy(url) } }, 'Copiar'),
        el('a', { class: 'btn wa', target: '_blank', rel: 'noopener', 'aria-label': `Compartir ${x.name} por WhatsApp`, href: `https://wa.me/?text=${encodeURIComponent(msg)}` }, 'WhatsApp')));
  }));
}
function calc() { const n = +$('#sales').value, t = +$('#ticket').value; $('#salesN').textContent = n; $('#ticketN').textContent = fmt(t); $('#earn').textContent = fmt(n * t * PCT / 100); }
$('#sales').addEventListener('input', calc); $('#ticket').addEventListener('input', calc);
const cfg = fetch('/api/config').then(r => r.json()).then(c => { PCT = c.commissionPct; for (const e of document.querySelectorAll('.pct')) e.textContent = PCT; calc(); return c; });

// ---------- Registro ----------
const rules = { name: v => v.trim().length >= 3, email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()), phone: v => /^\+?\d{7,15}$/.test(v.replace(/[\s-]/g, '')) };
const check = i => { const ok = rules[i.name](i.value); i.nextElementSibling.hidden = ok; i.setAttribute('aria-invalid', String(!ok)); i.style.borderColor = ok ? '' : 'var(--err)'; return ok; };
for (const i of $('#f').querySelectorAll('input')) { i.addEventListener('blur', () => { if (i.value) check(i); }); i.addEventListener('input', () => { if (i.getAttribute('aria-invalid') === 'true') check(i); }); }
$('#f').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, err = $('#err'), btn = $('#submit'); err.hidden = true;
  const bad = [...f.querySelectorAll('input')].filter(i => !check(i));
  if (bad.length) { bad[0].focus(); return; }
  btn.disabled = true; btn.textContent = 'Creando tu link…';
  try {
    const r = await fetch('/api/affiliates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(f))) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'No pudimos crear tu link. Intenta de nuevo.');
    try { localStorage.setItem('myRef', JSON.stringify(j.code)); localStorage.setItem('myPanel', JSON.stringify(j.panel)); } catch {}
    $('#signup').hidden = true; $('#done').hidden = false;
    $('#link').value = j.link; $('#panel').value = j.panel; $('#goPanel').href = j.panel;
    shareButtons($('#shareDone'), j.link);
    $('#done').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (x) { err.textContent = x.message; err.hidden = false; }
  finally { btn.disabled = false; btn.textContent = 'Crear mi link gratis'; }
});

// ---------- Panel ----------
const STAGE = { awaiting_payment: ['Pendiente de pago', 'mut'], preparing: ['En preparación', 'hot'], packed: ['Empacado', 'hot'], shipped: ['Enviado', 'hot'], delivered: ['Entregado', 'ok'], cancelled: ['Cancelado', 'mut'] };
const COM = { to_confirm: ['Comisión por confirmar', 'mut'], pending: ['Comisión por cobrar', 'hot'], paid: ['Comisión pagada', 'ok'], cancelled: ['Sin comisión', 'mut'], none: ['Sin comisión', 'mut'] };
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function chart(months) {
  const W = 600, H = 200, max = Math.max(1, ...months.map(m => m.commission)), bw = W / months.length;
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'chart'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Comisiones de los últimos 6 meses: ' + months.map(m => `${MONTHS[+m.key.slice(5) - 1]} ${fmt(m.commission)}`).join(', '));
  svg.innerHTML = '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5A36"/><stop offset="1" stop-color="#FF8552"/></linearGradient></defs>';
  months.forEach((m, i) => {
    const bh = m.commission ? Math.max(6, m.commission / max * (H - 60)) : 3, x = i * bw + bw * .2, w = bw * .6;
    const r = document.createElementNS(NS, 'rect'); Object.entries({ x, y: H - 26 - bh, width: w, height: bh, rx: 8, fill: m.commission ? 'url(#g)' : 'var(--line)' }).forEach(([k, v]) => r.setAttribute(k, v)); svg.append(r);
    const t = document.createElementNS(NS, 'text'); t.setAttribute('x', x + w / 2); t.setAttribute('y', H - 8); t.setAttribute('text-anchor', 'middle'); t.textContent = MONTHS[+m.key.slice(5) - 1]; svg.append(t);
    if (m.commission) { const v = document.createElementNS(NS, 'text'); v.setAttribute('x', x + w / 2); v.setAttribute('y', H - 32 - bh); v.setAttribute('text-anchor', 'middle'); v.setAttribute('style', 'fill:var(--text);font-weight:800'); v.textContent = fmt(m.commission); svg.append(v); }
  });
  return svg;
}
function renderDash(d, adminView) {
  document.title = `Panel de ${d.name} · USACARGOS SHOP`;
  $('#signupView').hidden = true; $('#dashView').hidden = false;
  if (adminView) { const b = $('#adminBar'); b.hidden = false; b.textContent = `Vista de administrador: así ve ${d.name} su panel.`; $('#toStore').hidden = true; }
  const first = d.name.split(' ')[0];
  $('#lvlBadge').className = `lvl-badge ${d.level.name}`; $('#lvlBadge').textContent = `Nivel ${d.level.name}`;
  $('#hello').textContent = `Hola, ${first}`;
  requestAnimationFrame(() => requestAnimationFrame(() => { $('#lvlBar').style.width = d.level.progress + '%'; }));
  $('#lvlText').textContent = d.level.next ? `Te faltan ${d.level.nextAt - d.sales} venta(s) para llegar a ${d.level.next}.` : '¡Llegaste al nivel más alto! Eres de los mejores vendedores.';
  $('#mPending').textContent = fmt(d.pending);
  $('#mPendingSub').textContent = d.toConfirm ? `+ ${fmt(d.toConfirm)} por confirmar en ${d.openCount} pedido(s) en curso` : 'Comparte tu link y empieza a sumar';
  $('#mylink').value = d.link; shareButtons($('#shareDash'), d.link, true);
  const k = (lbl, val, sub, hl) => el('div', { class: `k${hl ? ' hl' : ''}` }, el('span', {}, lbl), el('b', {}, val), sub ? el('small', {}, sub) : null);
  $('#kpis').replaceChildren(
    k('Ganado en total', fmt(d.pending + d.paidOut), 'Pagado + por cobrar', true), k('Ya te pagamos', fmt(d.paidOut)), k('Por confirmar', fmt(d.toConfirm), `${d.openCount} pedido(s) en curso`),
    k('Ventas', String(d.sales), fmt(d.revenue) + ' vendidos'), k('Visitas a tu link', String(d.clicks)), k('Conversión', `${d.conversion}%`, 'ventas / visitas'));
  $('#chart').replaceChildren(chart(d.months));
  $('#salesList').replaceChildren(...(d.orders.length ? d.orders.map(o => el('div', { class: 'sale' },
    el('div', {}, el('div', { class: 'c' }, `#${o.code}`), el('div', { class: 'd' }, `${new Date(o.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })} · venta ${fmt(o.total)}`)),
    el('div', { class: 'm' }, fmt(o.commission)),
    el('div', { class: 'chips' }, el('span', { class: `chip2 ${(STAGE[o.stage] || ['', 'mut'])[1]}` }, (STAGE[o.stage] || [o.stage])[0]), el('span', { class: `chip2 ${(COM[o.commission_status] || ['', 'mut'])[1]}` }, (COM[o.commission_status] || [o.commission_status])[0])))) :
    [el('p', { class: 'muted', style: 'margin:0' }, 'Aún no tienes ventas. Comparte tu link con 10 contactos hoy: cada compra aparecerá aquí con su estado.')]));
  if (d.topProducts.length) { $('#topBox').hidden = false; $('#topList').replaceChildren(...d.topProducts.map(t => el('div', { class: 'prod' }, t.image ? el('img', { src: t.image, alt: '' }) : el('span'), el('b', {}, t.name), el('span', { class: 'muted' }, `${t.qty} und.`)))); }
  products(d.code);
}
async function dashboard() {
  await cfg;
  const adminView = p.get('admin') === '1';
  const url = adminView ? `/api/admin/affiliates/${encodeURIComponent(p.get('code'))}/stats` : `/api/affiliates/${encodeURIComponent(p.get('code'))}/stats?token=${encodeURIComponent(p.get('token'))}`;
  const r = await fetch(url);
  if (!r.ok) { toast(adminView ? 'Inicia sesión como administrador.' : 'No encontramos tu panel. Revisa el enlace.'); return; }
  const d = await r.json();
  if (!adminView) { try { localStorage.setItem('myRef', JSON.stringify(d.code)); localStorage.setItem('myPanel', JSON.stringify(location.href)); } catch {} }
  renderDash(d, adminView);
}
if (p.get('code') && (p.get('token') || p.get('admin') === '1')) dashboard();
else {
  try {
    const saved = JSON.parse(localStorage.getItem('myPanel') || 'null');
    if (saved && saved.startsWith(location.origin)) $('#signup').prepend(el('a', { class: 'btn navy block', href: saved }, 'Ya tengo un link: ir a mi panel'));
  } catch {}
}
