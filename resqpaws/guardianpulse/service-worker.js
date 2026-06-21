const CACHE_NAME = 'resqpaws-v1';
const ASSETS = [
  './',
  './index.html',
  './about.html',
  './contact.html',
  './login.html',
  './register.html',
  './report.html',
  './track.html',
  './lost-found.html',
  './volunteer.html',
  './user-dashboard.html',
  './ngo-dashboard.html',
  './manifest.json',
  './css/style.css',
  './css/components.css',
  './css/pages.css',
  './js/firebase-config.js',
  './js/auth.js',
  './js/db.js',
  './js/main.js',
  './js/map.js',
  './js/ai.js',
  './js/pages/report.js',
  './js/pages/track.js',
  './js/pages/lost-found.js',
  './js/pages/volunteer.js',
  './js/pages/dashboard.js',
  './data/sample-data.js',
  './assets/placeholder.png',
  './assets/images/hero-bg.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Allow soft failures on remote maps resources caching to avoid build blocker
      return cache.addAll(ASSETS).catch(err => {
        console.warn('Cache addAll warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Only intercept requests for local or leaflet files
  const url = new URL(e.request.url);
  if (url.origin === location.origin || url.hostname.includes('unpkg.com')) {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        return cachedResponse || fetch(e.request).catch(() => {
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
  }
});
