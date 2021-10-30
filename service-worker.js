var cacheName = 'set-game-v1';
var filesToCache = [
  './',
  './index.html',
  './app.js',
  './style.css'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(cacheName).then(function(cache) {
      cache.addAll(filesToCache);
    })
  );
});

// Try network and fall-back to cache (update cache if network succeeds) - This is good for debug or rapidly updating versions
self.addEventListener('fetch', function(e) {
  if (e.request.url.includes('google')) return false;

  e.respondWith(
    caches.open(cacheName).then(function(cache) {
      return fetch(e.request).then(function(response) {
        cache.put(e.request, response.clone());
        return response;
      }).catch(function() {
        return cache.match(e.request);
      });
    })
  );
});

// Cache first with network fallback (update cache if network succeeds) - This is good for production since this is a static files app
// self.addEventListener('fetch', function(e) {
//   e.respondWith(
//     caches.match(e.request).then(function(response) {
//       return response || fetch(e.request).then(function(response) {
//         cache.put(e.request, response.clone());
//         return response;
//       });
//     })
//   );
// });

// Cache first with network fallback (not updating cache from network) - This is good for production since this is a static files app
// self.addEventListener('fetch', function(e) {
//   e.respondWith(
//     caches.match(e.request).then(function(response) {
//       return response || fetch(e.request);
//     })
//   );
// });