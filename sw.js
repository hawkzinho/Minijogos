const VERSION = 'minijogos-safe-v2-taboo';
const CACHE = VERSION;
const ASSETS = [
  '/index.html',
  '/app.css',
  '/manifest.webmanifest',
  '/src/app.js',
  '/src/icons.js',
  '/src/content.js',
  '/src/engine.js',
  '/src/platform.js',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(ASSETS.map(url => cache.add(new Request(url, { cache: 'reload' }))));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) client.postMessage({ type: 'OFFLINE_READY' });
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'CACHE_STATUS') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const matches = await Promise.all(ASSETS.map(url => cache.match(url)));
      event.ports[0]?.postMessage({ ready: matches.every(Boolean) });
    })());
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // CRITICAL: never intercept page/document navigation. Cloudflare Pages serves index.html.
  // This prevents an installed PWA/service worker from turning later navigations into a cached 404.
  if (request.mode === 'navigate' || request.destination === 'document') return;

  if (!ASSETS.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(url.pathname);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) cache.put(url.pathname, response.clone()).catch(() => {});
    return response;
  })());
});
