/*
 * Push im Service Worker (P5-6): zeigt die Nachricht des Servers an (Titel, Text, Kennung aus der verschlüsselten
 * Nachricht, server/src/push.ts) und öffnet beim Tippen die App (ein offenes Fenster bekommt den Fokus). Die Nachricht
 * enthält nichts aus dem Spiel; Texte kommen vom Server.
 */
self.addEventListener('push', (ereignis) => {
  let n = {};
  try {
    n = ereignis.data ? ereignis.data.json() : {};
  } catch {
    n = {};
  }
  ereignis.waitUntil(
    self.registration.showNotification(n.title || '', { body: n.body || '', tag: n.tag || 'dran', renotify: true, icon: 'icon-192.png', data: { url: n.url || './' } }),
  );
});

self.addEventListener('notificationclick', (ereignis) => {
  ereignis.notification.close();
  const ziel = new URL(ereignis.notification.data?.url || './', self.registration.scope).href;
  ereignis.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenster) => {
      const offen = fenster.find((f) => f.url.startsWith(self.registration.scope));
      return offen ? offen.focus() : self.clients.openWindow(ziel);
    }),
  );
});
