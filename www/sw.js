// Vanguard-Cut v2 · caché offline. Red primero (para recibir actualizaciones), caché como respaldo.
const CACHE = 'vanguard-cut-v2';
const FILES = ['./', './index.html', './styles.css', './manifest.webmanifest', './native.js',
  './js/util.js', './js/store.js', './js/engine.js', './js/timeline.js', './js/panels.js', './js/extras.js', './js/export.js', './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match('./index.html'))));
});
