/*
  Service Worker básico para PWA offline, sem alterar a lógica da app.
  Estratégias:
  - Precache de assets estáticos essenciais.
  - Cache-first para assets; network-first para navegação.
  - Ignora métodos não-GET.
*/

const CACHE_NAME = 'financaspro-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/assets/css/styles.css',
  '/assets/js/app.js',
  '/assets/js/main.js',
  '/assets/js/core/router.js',
  '/assets/js/pages/dashboard.js',
  '/assets/js/pages/transactions.js',
  '/assets/js/pages/categories.js',
  '/assets/js/pages/banks.js',
  '/assets/js/pages/goals.js',
  // Externo (opaque): manter disponível offline após primeira visita
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const requests = PRECACHE_URLS.map((url) => {
        if (url.startsWith('http')) {
          // Cache externo como opaque para evitar CORS errors.
          return fetch(new Request(url, { mode: 'no-cors' }))
            .then((res) => cache.put(url, res))
            .catch(() => {});
        }
        return cache.add(url).catch(() => {});
      });
      return Promise.all(requests);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
  if (!isHttp) return; // Ignora esquemas como chrome-extension
  if (request.method !== 'GET') return; // não interferir em POST/PUT/etc.

  const isSameOrigin = url.origin === self.location.origin;

  // Navegação: network-first, fallback index para SPA
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets estáticos (mesma origem): cache-first
  if (isSameOrigin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const cloned = response.clone();
          // Só cacheia respostas válidas
          if (response.ok && request.method === 'GET') {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned)).catch(() => {});
          }
          return response;
        });
      })
    );
    return;
  }

  // Externo: cache-first (inclui opaque)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned)).catch(() => {});
        return response;
      }).catch(() => caches.match(request));
    })
  );
});