const CACHE_NAME = 'basket-manager-cache-v26';
const ASSETS = [
  '.',
  'index.html',
  'css/styles.css',
  'js/data.js',
  'js/utils.js',
  'js/stats-utils.js',
  'js/game-core.js',
  'js/sim.js',
  'js/live-utils.js',
  'js/audio.js',
  'js/theme.js',
  'js/scouting.js',
  'js/i18n.js',
  'js/ui.js',
  'js/text.js',
  'js/overlay.js',
  'js/render-core.js',
  'js/market-ui.js',
  'js/season-sim.js',
  'js/market-core.js',
  'js/season-core.js',
  'js/live.js',
  'js/app.js',
  'js/storage.js',
  'js/tests.js',
  'manifest.json',
  'assets/icon.svg',
  'assets/logo.png',
  'assets/logo-192.png',
  'assets/logo-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isLocal = url.hostname === 'localhost'
    || url.hostname === '127.0.0.1'
    || url.hostname.startsWith('192.168.')
    || url.hostname.endsWith('.local');
  if (isLocal) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('index.html'));
    })
  );
});
