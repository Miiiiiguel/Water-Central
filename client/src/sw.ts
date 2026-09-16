// @ts-nocheck — this file runs in the ServiceWorker scope, not the DOM
// scope the rest of the app is typed against; see tsconfig note below.
//
// Custom service worker (injectManifest strategy) instead of the plugin's
// auto-generated one, so we can handle real push notifications — see
// SETUP.md section 6.
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
// Injected at build time by vite-plugin-pwa with the real asset list.
precacheAndRoute(self.__WB_MANIFEST);

// Never let a cached index.html answer an API call — those must always
// hit the network (auth, payments, chat all depend on a live response).
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), {
  denylist: [/^\/api\//],
}));

// --- Real push notifications ------------------------------------------
// Fired by the browser when a push message arrives, even if no tab is
// open. The payload is whatever JSON server/push.ts sent via web-push.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: event.data ? event.data.text() : 'Easycomex' };
  }

  const title = payload.title || 'Easycomex';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { link: payload.link || '/dashboard' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicking the OS notification focuses an existing tab (navigating it to
// the right link) or opens a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c);
      if (existing) {
        if ('navigate' in existing) existing.navigate(link).catch(() => {});
        return existing.focus();
      }
      return self.clients.openWindow(link);
    })
  );
});
