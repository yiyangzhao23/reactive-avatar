const CACHE = 'reactive-avatar-v8';
const CORE = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/src/main.js',
  '/src/avatar.js',
  '/src/brain.js',
  '/src/perception.js',
  '/src/voice.js',
  '/src/live.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/tts') || url.pathname.startsWith('/voice') ||
      url.pathname.startsWith('/memory') || url.pathname.startsWith('/llm') ||
      url.pathname.startsWith('/model-parts/')) return;
  const networkFirst = url.pathname === '/' || url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') || url.pathname.endsWith('.css');
  if (networkFirst) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('/index.html')))
  );
});
