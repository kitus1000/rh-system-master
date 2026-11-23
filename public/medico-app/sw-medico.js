const MEDICO_CACHE = 'medico-bacis-offline-v1';

const PRECACHE_URLS = [
  '/medico-app',
  '/medico-app/index.html',
  '/medico-app/styles.css',
  '/medico-app/db-sync.js',
  '/medico-app/docs-pdf.js',
  '/medico-app/app.js',
  '/medico-app/jspdf.umd.min.js',
  '/medico-app/jsqr.js',
  '/medico-app/logo-bacis.png',
  '/medico-app/medico-icon-192.png',
  '/medico-app/medico-icon-512.png',
  '/medico-app/medico-icon.svg',
  '/medico-app/manifest-medico.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(MEDICO_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('medico-bacis-offline-') && k !== MEDICO_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith('/medico-app') ||
    url.pathname.startsWith('/medico-icon')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const net = fetch(event.request)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(MEDICO_CACHE).then((c) => c.put(event.request, copy));
            }
            return res;
          })
          .catch(() => cached || caches.match('/medico-app/index.html'));
        return cached || net;
      })
    );
  }
});
