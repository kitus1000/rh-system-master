const CACHE_NAME = 'choferes-bacis-offline-v6';

const PRECACHE_ASSETS = [
  '/',
  '/chofer-app',
  '/logistica/choferes',
  '/logistica/choferes/bitacora',
  '/manifest.json',
  '/logo-bacis.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    // Si es POST (como sync) y estamos offline, responder gracefully
    if (!navigator.onLine) {
      event.respondWith(
        new Response(JSON.stringify({ success: true, offline: true, message: 'Guardado en cola offline' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        })
      );
    }
    return;
  }

  // Stale-While-Revalidate para navegación y recursos estáticos
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Si estamos offline y no hay cache exacto de la ruta, devolver la app shell de chofer-app
          if (event.request.mode === 'navigate') {
            return caches.match('/chofer-app') || caches.match('/logistica/choferes') || cachedResponse;
          }
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
