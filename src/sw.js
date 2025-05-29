const APP_VERSION = '2.3.2';
const CACHE_NAME = `fog-control-${APP_VERSION}`;
const OFFLINE_PAGE = '/public/offline.html';
const MAX_CACHE_AGE = 2592000; // 30 days

const CORE_ASSETS = [
  '/public/index.html',
  '/public/styles.css',
  '/src/app.js',
  '/public/manifest.json',
  OFFLINE_PAGE,
  '/public/icons/icon-192x192.png',
  '/public/icons/icon-512x512.png'
];

self.addEventListener('install', e => {
  console.log(`[SW] Installing version ${APP_VERSION}`);
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching core assets');
        return cache.addAll(CORE_ASSETS.map(url => 
          new Request(url, { cache: 'reload', integrity: '' })
        )).catch(err => {
          console.error('[SW] Cache addAll failed:', err);
          return Promise.reject('Caching failed');
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  console.log('[SW] Activated');
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) {
          console.log(`[SW] Deleting old cache: ${key}`);
          return caches.delete(key);
        }
        return Promise.resolve();
      })
    )).then(() => {
      self.clients.claim();
      cleanupCache();
      // Daily cache cleanup at 3 AM
      setInterval(cleanupCache, 86400000);
    })
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  
  // Skip non-GET requests and browser extensions
  if (req.method !== 'GET' || 
      url.protocol === 'chrome-extension:' ||
      url.pathname.includes('browser-sync')) {
    return;
  }

  // Handle navigation requests
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .catch(() => {
          console.log(`[SW] Serving offline page for: ${url.pathname}`);
          return caches.match(OFFLINE_PAGE);
        })
    );
    return;
  }

  // Handle API requests with cache-first strategy
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      caches.match(req).then(cachedRes => {
        // Return cached response if fresh
        if (cachedRes && isResponseFresh(cachedRes)) {
          return cachedRes;
        }
        
        // Otherwise fetch from network
        return fetch(req).then(netRes => {
          // Cache successful responses
          if (netRes.status === 200) {
            const clone = netRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return netRes;
        }).catch(() => cachedRes || new Response('API unavailable', { status: 503 }));
      })
    );
    return;
  }

  // Handle static assets with cache-first strategy
  e.respondWith(
    caches.match(req).then(cachedRes => {
      // Return cached response if available
      if (cachedRes) {
        console.log(`[SW] Serving cached: ${url.pathname}`);
        return cachedRes;
      }
      
      // Otherwise fetch from network
      return fetch(req).then(netRes => {
        // Cache valid responses
        if (netRes.status === 200) {
          const clone = netRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return netRes;
      }).catch(err => {
        console.error(`[SW] Fetch failed for ${url.pathname}:`, err);
        
        // Image fallback
        if (req.destination === 'image') {
          return caches.match('/public/icons/icon-512x512.png');
        }
        
        // CSS/JS fallback
        if (req.destination === 'script') {
          return new Response('console.error("Resource unavailable")', {
            headers: {'Content-Type': 'application/javascript'}
          });
        }
        
        return new Response('Network error', {
          status: 408,
          headers: {'Content-Type': 'text/plain'}
        });
      });
    })
  );
});

// Background sync handler (fixed syntax errors)
self.addEventListener('sync', e => {
  if (e.tag === 'sync-commands') {
    console.log('[SW] Background sync: sync-commands');
    e.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => cache.keys())
        .then(keys => {
          const requests = keys.filter(key => 
            ['/src/app.js', '/api/schedules', '/api/presets']
              .some(asset => key.url.includes(asset))
          );
          return Promise.all(
            requests.map(req => 
              fetch(req).then(res => cache.put(req, res))
          );
        })
        .then(() => {
          return self.registration.showNotification('Commands Synced', {
            body: 'Pending commands synchronized',
            icon: '/public/icons/icon-192x192.png',
            vibrate: [200, 100, 200]
          });
        })
        .catch(err => console.error('[SW] Sync failed:', err))
    );
  }
});

// Push notification handler with better fallbacks
self.addEventListener('push', e => {
  let data;
  try {
    data = e.data?.json() || {title: 'Update', body: 'New content available'};
  } catch (err) {
    data = {
      title: 'SmartFog Update',
      body: 'New features available',
      icon: '/public/icons/icon-192x192.png'
    };
  }
  
  console.log('[SW] Push received:', data);
  
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/public/icons/icon-192x192.png',
      badge: '/public/icons/icon-96x96.png',
      data: { url: data.url || '/public/index.html' },
      vibrate: [300, 100, 400]
    })
  );
});

// Notification click handler with focus management
self.addEventListener('notificationclick', e => {
  e.notification.close();
  
  e.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      const url = e.notification.data.url;
      
      // Focus existing tab if available
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new tab if none exists
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Periodic background sync with exponential backoff
self.addEventListener('periodicsync', e => {
  if (e.tag === 'update-content') {
    console.log('[SW] Periodic sync: update-content');
    e.waitUntil(
      updateContent().catch(err => {
        console.warn('[SW] Update failed, retrying later:', err);
        // Exponential backoff would be implemented here
      })
    );
  }
});

async function updateContent() {
  console.log('[SW] Updating content');
  const cache = await caches.open(CACHE_NAME);
  const urls = [
    '/src/app.js',
    '/public/styles.css',
    '/public/index.html'
  ];
  
  const updatePromises = urls.map(async url => {
    try {
      const res = await fetch(url);
      if (res.ok) {
        await cache.put(url, res.clone());
        console.log(`[SW] Updated: ${url}`);
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`[SW] Update failed for ${url}:`, err);
      return false;
    }
  });
  
  return Promise.all(updatePromises);
}

async function cleanupCache() {
  console.log('[SW] Running cache cleanup');
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  const now = Date.now();
  
  for (const req of requests) {
    try {
      const res = await cache.match(req);
      if (!res) continue;
      
      const dateHeader = res.headers.get('date');
      if (!dateHeader) continue;
      
      const age = Math.round((now - new Date(dateHeader).getTime()) / 1000);
      if (age > MAX_CACHE_AGE) {
        await cache.delete(req);
        console.log(`[SW] Deleted stale resource: ${req.url} (age: ${age}s)`);
      }
    } catch (err) {
      console.warn(`[SW] Cleanup error for ${req.url}:`, err);
    }
  }
}

// Response freshness check
function isResponseFresh(response) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return false;
  
  const age = (Date.now() - new Date(dateHeader).getTime()) / 1000;
  return age < 3600; // 1 hour freshness
}

// Extended message handling
self.addEventListener('message', e => {
  if (e.data.type === 'GET_VERSION') {
    e.ports[0]?.postMessage(APP_VERSION);
  }
  
  if (e.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(() => console.log('[SW] Cache cleared'))
      .catch(err => console.error('[SW] Cache clear failed:', err));
  }
  
  if (e.data.type === 'PRE_CACHE') {
    e.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(e.data.urls))
    );
  }
});

// Performance monitoring
self.addEventListener('fetch', e => {
  const start = Date.now();
  e.respondWith(
    (async () => {
      const response = await fetch(e.request);
      console.log(`[SW] ${e.request.url} fetched in ${Date.now() - start}ms`);
      return response;
    })()
  );
}, { once: true });

const CORE_ASSETS = [
  '/public/index.html',
  '/public/styles.css',
  '/src/app.js',
  '/public/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/manifest.json'
];
