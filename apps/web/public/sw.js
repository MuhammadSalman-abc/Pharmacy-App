const CACHE = 'medistock-offline-v2';
const CORE = ['/', '/?local=1', '/offline.html', '/manifest.webmanifest', '/icon.svg'];

async function precacheApp(cache) {
  const response = await fetch('/', { cache: 'reload' });
  if (!response.ok) throw new Error('Could not cache MediStock app shell.');
  await cache.put('/', response.clone());
  const html = await response.text();
  const assets = [...new Set([...html.matchAll(/(?:src|href)="([^\"]*\/_next\/static\/[^\"]+)"/g)].map(match => new URL(match[1], self.location.origin).href))];
  await Promise.allSettled(assets.map(async asset => {
    const file = await fetch(asset, { cache: 'reload' });
    if (file.ok) await cache.put(asset, file);
  }));
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    await precacheApp(cache);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('medistock-offline-') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    const key = url.searchParams.has('local') ? '/?local=1' : '/';
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(key, response.clone());
        }
        return response;
      } catch {
        return await caches.match(key) || await caches.match('/') || await caches.match('/offline.html');
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return new Response('', { status: 504, statusText: 'Offline asset not cached' });
      }
    })());
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  })));
});
