/**
 * TravelerHub Service Worker
 *
 * Caching strategy:
 *   App shell (navigation)  → Network-first, fall back to cached /index.html (SPA)
 *   API GET requests        → Network-first, cache response; serve cache when offline
 *   Static assets (JS/CSS)  → Cache-first (Vite hashes ensure freshness)
 *   Mapbox / tile requests  → Stale-while-revalidate (map tiles stay fresh)
 *   POST / PUT / DELETE     → Network-only (mutations never served from cache)
 *
 * Offline queue:
 *   Failed mutations are NOT handled here — the useOfflineQueue React hook
 *   manages them in localStorage and replays them on the 'online' event.
 *
 * To update the cache version, bump CACHE_VERSION below and re-deploy.
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE   = `travelerhub-shell-${CACHE_VERSION}`;
const API_CACHE     = `travelerhub-api-${CACHE_VERSION}`;
const ASSET_CACHE   = `travelerhub-assets-${CACHE_VERSION}`;
const TILE_CACHE    = `travelerhub-tiles-${CACHE_VERSION}`;

const TILE_CACHE_MAX = 500;   // max cached map tiles
const API_CACHE_MAX  = 100;   // max cached API responses

// Hosts whose responses we tile-cache (Mapbox CDN pattern)
const TILE_HOSTS = ['api.mapbox.com', 'tiles.mapbox.com', 'events.mapbox.com'];

// ─── Install ───────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(['/index.html', '/'])
    ).then(() => self.skipWaiting())
  );
});

// ─── Activate ──────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const currentCaches = [SHELL_CACHE, API_CACHE, ASSET_CACHE, TILE_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !currentCaches.includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Helpers ───────────────────────────────────────────────────────────────

async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
  }
}

function isApiRequest(url) {
  // Requests to our own FastAPI backend
  return (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.pathname.startsWith('/api/')
  );
}

function isTileRequest(url) {
  return TILE_HOSTS.some((h) => url.hostname.includes(h));
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

// ─── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET mutations — let them go to the network (or fail offline)
  if (event.request.method !== 'GET') return;

  // ── 1. SPA navigation — serve index.html from cache when offline ──
  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('/index.html', clone));
          return response;
        })
        .catch(() =>
          caches.match('/index.html').then((cached) => cached || new Response('Offline', { status: 503 }))
        )
    );
    return;
  }

  // ── 2. Map tiles — stale-while-revalidate ──
  if (isTileRequest(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkFetch = fetch(event.request).then((response) => {
          cache.put(event.request, response.clone());
          limitCacheSize(TILE_CACHE, TILE_CACHE_MAX);
          return response;
        }).catch(() => null);

        return cached || networkFetch;
      })
    );
    return;
  }

  // ── 3. API GET — network-first, cache as offline fallback ──
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((c) => {
              c.put(event.request, clone);
              limitCacheSize(API_CACHE, API_CACHE_MAX);
            });
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({ error: 'offline', cached: false }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          })
        )
    );
    return;
  }

  // ── 4. Static assets (JS, CSS, fonts, images) — cache-first ──
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(ASSET_CACHE).then((c) => c.put(event.request, clone));
        return response;
      });
    })
  );
});

// ─── Background sync message ────────────────────────────────────────────────
// The React useOfflineQueue hook posts a message here when it flushes the queue
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
