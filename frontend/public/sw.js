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

const CACHE_VERSION = 'v5';
const SHELL_CACHE   = `travelerhub-shell-${CACHE_VERSION}`;
const API_CACHE     = `travelerhub-api-${CACHE_VERSION}`;
const ASSET_CACHE   = `travelerhub-assets-${CACHE_VERSION}`;
const TILE_CACHE    = `travelerhub-tiles-${CACHE_VERSION}`;

const TILE_CACHE_MAX = 500;   // max cached map tiles
const API_CACHE_MAX  = 100;   // max cached API responses
const TILE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
      .then(() => pruneStaleTiles())
      .then(() => self.clients.claim())
  );
});

// Drop tile entries older than TILE_MAX_AGE_MS. We stamp `sw-cached-at` when
// putting tiles into the cache below; entries without the header (created
// before this SW version) are left alone — LRU will evict them eventually.
async function pruneStaleTiles() {
  try {
    const cache = await caches.open(TILE_CACHE);
    const reqs = await cache.keys();
    const now = Date.now();
    await Promise.all(reqs.map(async (req) => {
      const res = await cache.match(req);
      if (!res) return;
      const stamped = res.headers.get('sw-cached-at');
      if (!stamped) return;
      const age = now - parseInt(stamped, 10);
      if (Number.isFinite(age) && age > TILE_MAX_AGE_MS) {
        await cache.delete(req);
      }
    }));
  } catch (e) {
    // Cache iteration is best-effort; never block activation on failure.
  }
}

// Wrap a fetched Response so the cached copy carries the time it was stored.
async function stampCachedAt(response) {
  const clone = response.clone();
  const buf = await clone.arrayBuffer();
  const headers = new Headers(clone.headers);
  headers.set('sw-cached-at', String(Date.now()));
  return new Response(buf, {
    status: clone.status,
    statusText: clone.statusText,
    headers,
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
  }
}

function isApiRequest(url) {
  // Requests to our own FastAPI backend (dev or production)
  return (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === 'travelhub-api.fozhan.dev' ||
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

  // Skip Google APIs entirely — network-only, never cache (prevents stale 403s)
  if (url.hostname.endsWith('.googleapis.com')) return;

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
        const networkFetch = fetch(event.request).then(async (response) => {
          // Store with a `sw-cached-at` header so pruneStaleTiles() can drop
          // entries older than TILE_MAX_AGE_MS on the next SW activation.
          if (response && response.ok) {
            try {
              const stamped = await stampCachedAt(response);
              cache.put(event.request, stamped.clone());
              limitCacheSize(TILE_CACHE, TILE_CACHE_MAX);
            } catch (_) {
              // Caching is best-effort; opaque responses can throw on read.
            }
          }
          return response;
        }).catch(() => null);

        // Never resolve respondWith to null — that triggers
        // "Failed to convert value to 'Response'" in the SW. When the cache
        // misses *and* the network fetch fails (offline, ERR_FAILED, CORS),
        // hand back an explicit network error Response so the page sees a
        // normal failed image rather than an SW-level exception.
        const result = cached || (await networkFetch);
        return result || Response.error();
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
        if (response.ok) {
          const clone = response.clone();
          caches.open(ASSET_CACHE).then((c) => c.put(event.request, clone));
        }
        return response;
      }).catch(() => Response.error());
    })
  );
});

// ─── Push Notifications ────────────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'TravelerHub', {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});

// ─── Background sync message ────────────────────────────────────────────────
// The React useOfflineQueue hook posts a message here when it flushes the queue
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
