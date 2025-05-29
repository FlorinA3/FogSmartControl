const APP_VERSION = '2.2.0';
const CACHE_NAME = `fog-control-${APP_VERSION}`;
const OFFLINE_PAGE = '/offline.html';
const MAX_CACHE_AGE = 2592000; // 30 days in seconds

const CORE_ASSETS = [
  '/', '/index.html', '/styles.css', '/app.js', 
  '/manifest.json', OFFLINE_PAGE,
  '/icons/icon-192x192.png', '/icons/icon-512x512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => key !== CACHE_NAME && caches.delete(key))
    ).then(() => {
      self.clients.claim();
      cleanupCache(); // Initial cleanup
      setInterval(cleanupCache, 86400000); // Daily cleanup
    }))
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Navigation requests
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_PAGE))
    );
    return;
  }

  // API requests
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // All other assets
  e.respondWith(
    caches.match(req).then(cachedRes => {
      if (cachedRes) return cachedRes;
      return fetch(req).then(netRes => {
        if (req.method === 'GET' && netRes.type === 'basic') {
          const clone = netRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return netRes;
      }).catch(err => {
        console.error('[SW] Fetch failed:', err);
        return req.destination === 'image'
          ? caches.match('/icons/icon-512x512.png')
          : new Response('Network error', {status: 408});
      });
    })
  );
});

self.addEventListener('sync', e => {
  if (e.tag === 'sync-commands') {
    e.waitUntil(
      caches.open(CACHE_NAME).then(cache => 
        cache.keys().then(keys => Promise.all(
          keys.filter(key => 
            ['/app.js', '/api/schedules', '/api/presets']
              .some(asset => key.url.includes(asset))
          .map(req => 
            fetch(req).then(res => 
              cache.put(req, res))
        )).then(() => {
          self.registration.showNotification('Commands Synced', {
            body: 'Pending commands synchronized',
            icon: '/icons/icon-192x192.png'
          });
        }).catch(console.error)
    );
  }
});

self.addEventListener('push', e => {
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      data: {url: data.url || '/'}
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type: 'window'}).then(clients => {
      clients.length ? clients[0].focus() : clients.openWindow(e.notification.data.url);
    })
  );
});

self.addEventListener('periodicsync', e => {
  if (e.tag === 'update-content') e.waitUntil(updateContent());
});

async function updateContent() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(['/app.js', '/styles.css', '/index.html'].map(async url => {
    try {
      const res = await fetch(url);
      if (res.status === 200) await cache.put(url, res);
    } catch (err) {
      console.log(`[SW] Update failed for ${url}:`, err);
    }
  }));
  console.log('[SW] Content updated');
}

async function cleanupCache() {
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  const now = Date.now();
  
  await Promise.all(requests.map(async req => {
    const res = await cache.match(req);
    if (!res) return;
    
    const dateHeader = res.headers.get('date');
    if (!dateHeader) return;
    
    const age = Math.round((now - new Date(dateHeader).getTime()) / 1000);
    if (age > MAX_CACHE_AGE) {
      await cache.delete(req);
      console.log(`[SW] Deleted stale: ${req.url}`);
    }
  }));
}
