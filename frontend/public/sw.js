const CACHE_VERSION = 'cimitage-pwa-2026-06-27-1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PUBLIC_SHELL_PATHS = new Set(['/', '/offline', '/tentang']);
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/offline.html',
  '/images/branding/logo-disbudparpora.png',
  '/images/landing/cimahi.jpeg',
  '/images/landing/gedungsudirman.jpg',
  '/images/fallback-heritage.svg',
  '/icons/cimitage-192.png',
  '/icons/cimitage-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(PRECACHE_URLS.map(async (url) => {
      try {
        const response = await fetch(new Request(url, { cache: 'reload' }));
        if (response.ok) await cache.put(url, response);
      } catch {
        // Satu aset yang gagal tidak boleh menggagalkan instalasi service worker.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith('cimitage-pwa-') && name !== STATIC_CACHE)
        .map((name) => caches.delete(name)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/data/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/icons/') ||
    ['style', 'script', 'font'].includes(request.destination);

  if (isStaticAsset && !url.pathname.startsWith('/_next/image')) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirstNavigation(request) {
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (response.ok && PUBLIC_SHELL_PATHS.has(url.pathname)) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    if (PUBLIC_SHELL_PATHS.has(url.pathname)) {
      const cachedPage = await cache.match(request, { ignoreSearch: true });
      if (cachedPage) return cachedPage;
    }
    return (await cache.match('/offline.html')) || (await cache.match('/offline')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
  }
  return response;
}
