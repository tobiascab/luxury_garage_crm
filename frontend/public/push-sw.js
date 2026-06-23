/* eslint-disable no-undef */
// Handlers de Web Push — importado por el Service Worker generado (workbox importScripts).
// Muestra la notificación del sistema cuando llega un push y abre la app al tocarla.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Luxury Garage', body: event.data && event.data.text ? event.data.text() : '' };
  }

  const title = data.title || 'Luxury Garage';
  const options = {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/favicon.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || '/', type: data.type || 'info' },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una ventana abierta, la enfocamos y navegamos.
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      // Si no, abrimos una nueva.
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
