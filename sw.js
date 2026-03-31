// scoreplace.app — Service Worker
// Cache-first for static assets, network-first for API/Firebase

var CACHE_NAME = 'scoreplace-v0.2.20';
var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/components.css',
  '/css/layout.css',
  '/css/bracket.css',
  '/css/responsive.css',
  '/js/theme.js',
  '/js/store.js',
  '/js/firebase-db.js',
  '/js/notifications.js',
  '/js/ui.js',
  '/js/router.js',
  '/js/main.js',
  '/js/views/dashboard.js',
  '/js/views/tournaments.js',
  '/js/views/create-tournament.js',
  '/js/views/pre-draw.js',
  '/js/views/bracket.js',
  '/js/views/participants.js',
  '/js/views/rules.js',
  '/js/views/explore.js',
  '/js/views/notifications-view.js',
  '/js/views/auth.js',
  '/js/views/result-modal.js',
  '/js/views/enroll-modal.js',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

// Domains that should NEVER be cached (APIs, auth, real-time data)
var NO_CACHE_PATTERNS = [
  'firestore.googleapis.com',
  'firebase',
  'identitytoolkit',
  'securetoken',
  'googleapis.com/identitytoolkit',
  'maps.googleapis.com',
  'openweathermap.org'
];

// Install: pre-cache static assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).catch(function(err) {
        console.warn('[SW] Pre-cache partial fail:', err);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API/Firebase/auth requests — always network
  for (var i = 0; i < NO_CACHE_PATTERNS.length; i++) {
    if (url.indexOf(NO_CACHE_PATTERNS[i]) !== -1) return;
  }

  // Skip chrome-extension and other non-http
  if (url.indexOf('http') !== 0) return;

  // For same-origin static assets: cache-first with network fallback
  if (url.indexOf(self.location.origin) === 0) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) {
          // Return cached, but also update cache in background (stale-while-revalidate)
          var fetchPromise = fetch(event.request).then(function(networkResponse) {
            if (networkResponse && networkResponse.status === 200) {
              var responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          }).catch(function() {});
          return cached;
        }
        // Not in cache: fetch from network and cache it
        return fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // External resources (fonts, CDN): cache-first
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request).then(function(response) {
        if (response && response.status === 200 && response.type !== 'opaque') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});
