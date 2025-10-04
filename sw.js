const CACHE_NAME = 'ludo-universe-v1';
const urlsToCache = [
  './', // This is the alias for index.html
  'manifest.json',
  'https://raw.githubusercontent.com/Mirjan-Ali-Sha/ludo/main/Ludo_App-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js'
];

// Install event: Open a cache and add the assets to it
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching files');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event: Serve content from cache first (Cache-First strategy)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // If the request is in the cache, return it
        if (response) {
          return response;
        }
        // If the request is not in the cache, fetch it from the network
        return fetch(event.request);
      }
    )
  );
});

