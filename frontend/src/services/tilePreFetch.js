/**
 * Map-tile pre-fetcher (Phase 1: static-image API).
 *
 * Triggers fetch() for a small set of Mapbox static-image URLs around a
 * trip's center point. The service worker (sw.js) already intercepts every
 * api.mapbox.com request and caches it with stale-while-revalidate, so
 * issuing the requests here is enough — there's no extra storage code on
 * the client side.
 *
 * What this does NOT cover (yet):
 *   - Vector tiles for the interactive Navigation map (mapbox-gl's
 *     {z}/{x}/{y}.vector.pbf). Mapbox's SDK uses a custom storage
 *     protocol and bulk pre-cache is restricted by their TOS. Tracked
 *     for a follow-up phase against a different tile provider (likely
 *     OpenStreetMap raster tiles via a stadia/maptiler proxy).
 *
 * Returns a small status object so the OfflinePackButton can show
 * "5/6 tiles cached" and roll up failures with the rest of the warm.
 */

import { readTripCache } from './tripCache';

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim();

// The dashboard MapSnapshot uses dark-v11; the Navigation map uses streets.
// Pre-fetching both costs us 6 image fetches per trip (3 zooms x 2 styles)
// — well under Mapbox's free-tier static-image limits for any realistic
// number of trips per month.
const STYLES = ['dark-v11', 'streets-v12'];
const ZOOMS = [10, 12, 14];
const SIZE = '600x400@2x';

function _staticUrl(style, lat, lng, zoom) {
  return (
    `https://api.mapbox.com/styles/v1/mapbox/${style}/static/` +
    `${lng},${lat},${zoom},0/${SIZE}?access_token=${MAPBOX_TOKEN}`
  );
}

/**
 * Pre-fetch static map images centered on (lat, lng). Each request goes
 * through the service worker, so the second time the page asks for the
 * same URL (online or offline) it'll come from CacheStorage.
 *
 * Returns: { ok, fetched, failed, total }
 *   - ok: every requested tile cached successfully
 *   - fetched: number of 200-status responses
 *   - failed: number that errored (network, 401, 403, etc.)
 */
export async function prefetchMapSnapshots(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, fetched: 0, failed: 0, total: 0, reason: 'no-coords' };
  }
  if (!MAPBOX_TOKEN) {
    return { ok: false, fetched: 0, failed: 0, total: 0, reason: 'no-token' };
  }

  const urls = [];
  for (const style of STYLES) {
    for (const zoom of ZOOMS) {
      urls.push(_staticUrl(style, lat, lng, zoom));
    }
  }

  const results = await Promise.allSettled(
    urls.map((u) =>
      fetch(u, { mode: 'cors', credentials: 'omit' }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r;
      })
    )
  );

  let fetched = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') fetched += 1;
    else failed += 1;
  }
  return {
    ok: failed === 0,
    fetched,
    failed,
    total: urls.length,
  };
}


// ── Trip-aware helpers ────────────────────────────────────────────────────

const COORD_KEYS = [
  ['lat', 'lng'],
  ['lat', 'lon'],
  ['latitude', 'longitude'],
];

function _firstCoordIn(record) {
  if (!record || typeof record !== 'object') return null;
  for (const [a, b] of COORD_KEYS) {
    const lat = record[a];
    const lng = record[b];
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }
  // Some bookings nest coords under `location` / `place`.
  for (const k of ['location', 'place', 'destination', 'origin']) {
    const inner = record[k];
    if (inner && typeof inner === 'object') {
      const c = _firstCoordIn(inner);
      if (c) return c;
    }
  }
  return null;
}

function _pickTripCenter(tripId) {
  const bookings = readTripCache('bookings', tripId);
  const list = Array.isArray(bookings)
    ? bookings
    : Array.isArray(bookings?.data)
    ? bookings.data
    : [];
  for (const b of list) {
    const c = _firstCoordIn(b);
    if (c) return c;
  }
  return null;
}

/**
 * Pre-fetch map snapshots for the trip's center, using the cached bookings
 * to pick coords. Returns the same shape as `prefetchMapSnapshots` plus a
 * `reason` field when there's nothing to fetch.
 *
 * Call this AFTER `warmTripCache(tripId)` so the bookings cache is populated
 * — without bookings we have no good origin point and silently skip rather
 * than burn fetches on whatever the user's browser geolocation happens to
 * return.
 */
export async function prefetchMapTilesForTrip(tripId, fallbackCoords = null) {
  const center = _pickTripCenter(tripId) || fallbackCoords;
  if (!center) {
    return { ok: false, fetched: 0, failed: 0, total: 0, reason: 'no-trip-center' };
  }
  return prefetchMapSnapshots(center.lat, center.lng);
}
