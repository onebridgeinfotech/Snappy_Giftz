/* SNAPPY GIFTZ — network-passthrough SW (installability; no document/API cache). */
const SW_VERSION = 'sg-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('sg-pwa-')).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

void SW_VERSION;

self.addEventListener('push', (event) => {
  let payload = {
    title: 'SNAPPY GIFTZ',
    body: 'You have an update from SNAPPY GIFTZ.',
    url: '/',
  };
  try {
    if (event.data) {
      payload = { ...payload, ...JSON.parse(event.data.text()) };
    }
  } catch {
    /* defaults */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(url);
          }
          return undefined;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
      return undefined;
    }),
  );
});
