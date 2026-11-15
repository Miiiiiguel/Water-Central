// Service worker de USACARGOS SHOP: carga rápida y funcionamiento básico sin conexión.
const VERSION = 'ucs-v4';
const SHELL = ['/', '/style.css', '/app.js', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const networkFirst = async (req, fallbackUrl) => {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(fallbackUrl || req, res.clone());
    return res;
  } catch {
    return (await cache.match(fallbackUrl || req)) || (await cache.match('/')) || Response.error();
  }
};
const staleWhileRevalidate = async req => {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
};

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && url.pathname.startsWith('/api/')) {
    // Catálogo y configuración: red primero, copia para uso sin conexión. El resto de la API nunca se guarda.
    if (url.pathname === '/api/products' || url.pathname === '/api/config') e.respondWith(networkFirst(req));
    return;
  }
  if (req.mode === 'navigate' && sameOrigin) {
    if (url.pathname.endsWith('.html') && url.pathname !== '/') return; // páginas secundarias: normal
    e.respondWith(networkFirst(req));
    return;
  }
  if (sameOrigin && (url.pathname.startsWith('/fotos/') || url.pathname.startsWith('/icons/'))) { e.respondWith(staleWhileRevalidate(req)); return; }
  if (sameOrigin && /\.(css|js|webmanifest)$/.test(url.pathname)) { e.respondWith(networkFirst(req)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { e.respondWith(staleWhileRevalidate(req)); }
});
