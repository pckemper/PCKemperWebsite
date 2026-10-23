// Service Worker der App: Zwischenspeicher für die App-Dateien (schneller Start, auch bei schlechtem Netz), zeigt
// Push-Nachrichten und öffnet beim Antippen die passende Partie.
//
// Zwischenspeicher: build.mjs trägt VERSION und APP_FILES ein (alle Dateien der Fassung außer sw.js und Quellkarten).
// Ändert sich die Fassung, ändert sich diese Datei; der Browser installiert dann im Hintergrund den neuen Worker, der
// die neuen Dateien vollständig ablegt und die alten löscht. Die laufende App bleibt, wie sie ist; auf Nachfrage nennt
// der Worker seine Fassung und ihre Dateien, daran erkennt die App, dass eine neue bereitliegt, und lädt sie mit
// „Neu laden“ sofort (G22, src/lib/update.ts); sonst gilt sie ab dem nächsten Start. Gespeichert wird nur, was in
// APP_FILES steht: keine Spielstände, keine Anfragen an den Server (Supabase liegt auf einer anderen Adresse und geht
// nie durch den Zwischenspeicher). Im Entwicklungsserver bleibt APP_FILES leer, dann speichert der Worker nichts.
const VERSION = '35e16ec3e6f0';
const APP_FILES = ["apple-touch-icon.png","assets/AtkinsonHyperlegible-Bold-7HANFXYF.woff","assets/AtkinsonHyperlegible-Regular-QM2HEKO6.woff","assets/BarlowCondensed-Bold-FT7YEVUT.woff","assets/BarlowCondensed-Medium-UPMP4O4F.woff","assets/BarlowCondensed-SemiBold-X3N26CCY.woff","assets/StardosStencil-Bold-7ILNGLM6.ttf","assets/main-CDYPH3CU.js","assets/main-VMQ4YBDQ.css","badge-96.png","badge.svg","fonts/OFL-AtkinsonHyperlegible.txt","fonts/OFL-BarlowCondensed.txt","fonts/OFL-StardosStencil.txt","icon-192.png","icon-512.png","icon.svg","index.html","manifest.webmanifest"];
const CACHE = `war-room-app-${VERSION}`;
const PREFIX = 'war-room-app-';

const scoped = (path) => new URL(path, self.registration.scope).href;
const INDEX = scoped('index.html');

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    if (APP_FILES.length) {
      const cache = await caches.open(CACHE);
      // cache: 'reload' umgeht den HTTP-Zwischenspeicher des Browsers, damit nur Dateien dieser Fassung abgelegt werden.
      // Fehlt eine Datei, schlägt die Installation fehl und der bisherige Worker bleibt (kein halber Stand).
      await cache.addAll(APP_FILES.map((f) => new Request(scoped(f), { cache: 'reload' })));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// G22: Fassung und Dateien für die App (src/lib/update.ts), Antwort über den mitgeschickten Port
self.addEventListener('message', (event) => {
  const port = event.ports && event.ports[0];
  if (event.data && event.data.type === 'version' && port) port.postMessage({ version: VERSION, files: APP_FILES });
});

self.addEventListener('fetch', (event) => {
  if (!APP_FILES.length) return;
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  // Start der App (index.html, auch mit #/partie/…): immer die abgelegte Fassung.
  if (req.mode === 'navigate') {
    const path = url.pathname;
    const scopePath = new URL(self.registration.scope).pathname;
    if (path !== scopePath && path !== `${scopePath}index.html`) return;
    event.respondWith(fromCache(INDEX, req));
    return;
  }
  const key = url.origin + url.pathname;
  if (!APP_FILES.some((f) => scoped(f) === key)) return;
  event.respondWith(fromCache(key, req));
});

/** Aus dem Zwischenspeicher dieser Fassung; fehlt die Datei dort, wie gewohnt aus dem Netz. */
async function fromCache(key, req) {
  // caches.match mit Namen statt caches.open: ein abgelöster Worker legt so keinen leeren Speicher seiner Fassung neu an.
  const hit = await caches.match(key, { cacheName: CACHE });
  return hit || fetch(req);
}

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
    // Statusleiste (Android): nur der Alphakanal zählt, daher ein einfarbiges Symbol (Quelle badge.svg)
    badge: 'badge-96.png',
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
