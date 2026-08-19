const CACHE_NAME = 'omnivote-v2';

// Pre-cache critical shell assets and icons
const STATIC_ASSETS = [
  '/',
  '/logo.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/manifest.json',
];

// Cache API responses with short TTL for offline resilience
const API_CACHE_TTL = 60 * 1000; // 1 minute
const API_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes max staleness

// Install: cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Don't fail install if one asset is missing
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {
          console.warn('[SW] Failed to pre-cache:', url);
        }))
      );
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, stale-while-revalidate for pages, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests for caching strategies
  if (request.method !== 'GET') return;

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              // Add timestamp header for staleness check
              const headers = new Headers(clone.headers);
              headers.set('sw-cached-at', String(Date.now()));
              const body = clone.body;
              const newResponse = new Response(body, {
                status: clone.status,
                statusText: clone.statusText,
                headers,
              });
              cache.put(request, newResponse);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) {
              // Check if cached response is still fresh enough
              const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0', 10);
              const age = Date.now() - cachedAt;
              if (age < API_CACHE_MAX_AGE) {
                return cached;
              }
              // Stale but return it anyway for offline resilience
              return new Response(cached.body, {
                status: 200,
                statusText: 'OK (Offline Cache)',
                headers: { ...Object.fromEntries(cached.headers.entries()), 'X-Offline-Cache': 'true' },
              });
            }
            return new Response(
              JSON.stringify({ error: 'You are offline. Data will sync when connection is restored.', offline: true }),
              { headers: { 'Content-Type': 'application/json' }, status: 503 }
            );
          });
        })
    );
    return;
  }

  // HTML pages: stale-while-revalidate (serve cache, update in background)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached); // If network fails, return cached

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Static assets (JS, CSS, fonts, images): cache-first with network update
  const isStaticAsset =
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.includes('/icons/') ||
    url.pathname.includes('/_next/static/');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Update cache in background (stale-while-revalidate)
          fetch(request).then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
            }
          }).catch(() => {}); // Ignore network errors for cache update
          return cached;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
});

// Background sync for queued reports — reads from IndexedDB 'offline-queue' store
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncQueuedReports());
  }
  if (event.tag === 'sync-incidents') {
    event.waitUntil(syncQueuedIncidents());
  }
});

// Push notifications for alerts
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'OmniVote Alert', body: 'New alert received' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'omnivote-alert',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' },
      renotify: true,
      actions: data.actions || [
        { action: 'view', title: 'View Details' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if possible
      for (const client of clients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(targetUrl);
    })
  );
});

// Handle messages from the client (e.g., skip waiting for updates)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Background Sync: Queued Reports ─────────────────────────────────────

async function syncQueuedReports() {
  console.log('[SW] Syncing queued reports...');
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('queue', 'readonly');
    const store = tx.objectStore('queue');
    const items = await store.getAll();
    await tx.done;

    for (const item of items) {
      try {
        const response = await fetch(item.url, {
          method: item.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.body),
        });
        if (response.ok) {
          // Remove from queue on success
          const delTx = db.transaction('queue', 'readwrite');
          delTx.objectStore('queue').delete(item.id);
          await delTx.done;
          console.log('[SW] Synced queued item:', item.id);
        }
      } catch (err) {
        console.warn('[SW] Failed to sync item:', item.id, err.message);
      }
    }
  } catch (err) {
    console.error('[SW] Background sync error:', err.message);
  }
}

async function syncQueuedIncidents() {
  // Same logic as reports but for incident queue
  return syncQueuedReports();
}

// ─── IndexedDB Helper ────────────────────────────────────────────────────

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('omnivote-offline', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      }
      // Also ensure the client-side offline-queue store exists
      if (!db.objectStoreNames.contains('submission-queue')) {
        db.createObjectStore('submission-queue', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
