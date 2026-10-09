// Service Worker der App: zeigt Push-Nachrichten und oeffnet beim Antippen die passende Partie.
// Absichtlich ohne Zwischenspeicher: die App laedt immer die aktuelle Fassung vom Server.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'War Room';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    lang: 'de',
    data: { url: data.url || '' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '', self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of windows) {
      if (w.url.startsWith(self.registration.scope)) {
        await w.focus();
        if ('navigate' in w) {
          try {
            await w.navigate(target);
          } catch {
            // nicht gesteuert: die App bleibt, wo sie ist
          }
        }
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
