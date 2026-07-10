const CACHE_NAME = 'rosa-fuerte-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event (Required for PWA install trigger)
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only handle requests to our own origin
  if (url.origin !== self.location.origin) return;

  // BOLD payment redirects: do not intercept requests that contain BOLD callback parameters
  if (
    url.searchParams.has('bold-tx-status') ||
    url.searchParams.has('bold-order-id') ||
    url.searchParams.has('bold_status') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/v1')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async (error) => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // If it's a navigation request and we're offline, return cached index.html
      if (event.request.mode === 'navigate') {
        const indexResponse = await caches.match('/index.html');
        if (indexResponse) {
          return indexResponse;
        }
      }
      
      // Return a fallback response to avoid service worker TypeError
      return new Response('Network error occurred', {
        status: 480,
        statusText: 'Network Error',
        headers: { 'Content-Type': 'text/plain' }
      });
    })
  );
});
