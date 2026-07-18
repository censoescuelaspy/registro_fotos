const CACHE_VERSION = 'cialpa-fotos-v1.1.0';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/js/api.js',
  './assets/js/config.js',
  './assets/js/db.js',
  './assets/js/image.js',
  './assets/js/map.js',
  './assets/js/operations.js',
  './assets/data/pilot-schools.json',
  './docs/FICHA_CONTINGENCIA_PLANO_MANUAL_CIALPA_v1.4.pdf',
  './assets/img/logo.png',
  './assets/img/favicon.png',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/vendor/leaflet/leaflet.css',
  './assets/vendor/leaflet/leaflet.js',
  './assets/vendor/leaflet/images/marker-icon.png',
  './assets/vendor/leaflet/images/marker-icon-2x.png',
  './assets/vendor/leaflet/images/marker-shadow.png',
  './assets/vendor/lucide/lucide.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    }))
  );
});
