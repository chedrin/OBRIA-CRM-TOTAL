/* ObraMaster - Service worker de notificaciones push.
 * Solo gestiona push y clics en la notificación: no guarda la app en caché. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'ObraMaster', body: event.data ? event.data.text() : '' };
  }

  event.waitUntil((async () => {
    // Si el panel está abierto y a la vista, ya sale el aviso dentro de la app: no se duplica.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.some((c) => c.visibilityState === 'visible' && c.focused)) return;

    await self.registration.showNotification(data.title || 'ObraMaster', {
      body: data.body || '',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      requireInteraction: data.category === 'urgente',
      icon: '/pwa-icon.svg',
      badge: '/pwa-icon.svg',
      data: { link: data.link || '#admin/avisos' }
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '#admin/avisos';
  const target = new URL(link.startsWith('#') ? `/${link}` : link, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((c) => new URL(c.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      return existing.navigate(target).catch(() => undefined);
    }
    return self.clients.openWindow(target);
  })());
});
