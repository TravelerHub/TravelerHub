/**
 * Trip cache — explicit warm + clear of every offline-relevant slice of
 * a trip in one place. Companion to `hooks/useTripCache.js` (which is
 * the per-component read/write surface). This module is what the
 * "Download for offline" button calls to pre-populate the cache before
 * the user goes off-grid.
 *
 * Why localStorage and not IndexedDB: the data we care about offline
 * (bookings, members, calendar events, emergency contacts) is small —
 * well under 1 MB even for a busy trip. The 5–10 MB localStorage budget
 * is comfortable, and reads are synchronous, so pages can render their
 * cached state on first paint without an `await`. Map *tiles* and
 * *photos* (which would need IndexedDB) are out of scope for this batch
 * — tiles already use the SW Cache API, photos are not critical offline.
 *
 * Cached namespaces and the endpoints they're populated from:
 *   bookings:        GET /api/bookings?trip_id={id}
 *   members:         GET /groups/{id}/members
 *   calendar:        GET /calendar/events?trip_id={id}
 *   emergency:       GET /users/me/emergency-contacts  (user-scoped, not trip)
 *   trip-info:       GET /groups/me                    (the active trip's row)
 *
 * Add new namespaces here, not in pages — keeps the warm/read story
 * symmetric and means the offline indicator's "X of Y cached" math has
 * a single source of truth.
 */

import { API_BASE } from "../config";

const PREFIX = "travelerhub_cache";

// Source-of-truth list of trip-scoped namespaces. Used by warmTripCache,
// clearTripFromCache, and the Dashboard "save offline" status indicator.
export const TRIP_NAMESPACES = [
  "bookings",
  "members",
  "calendar",
  "trip-info",
];
// User-scoped (not tied to a single trip — survives trip switches).
export const USER_NAMESPACES = ["emergency"];

function storageKey(namespace, tripId) {
  return tripId ? `${PREFIX}:${namespace}:${tripId}` : `${PREFIX}:${namespace}`;
}

function _writeRaw(namespace, tripId, data) {
  try {
    localStorage.setItem(
      storageKey(namespace, tripId),
      JSON.stringify({ data, cachedAt: new Date().toISOString(), tripId }),
    );
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[tripCache] write ${namespace}:${tripId} failed:`, e?.message);
    return false;
  }
}

function _readRaw(namespace, tripId) {
  try {
    const raw = localStorage.getItem(storageKey(namespace, tripId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function _authHeaders() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function _fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: _authHeaders() });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Read a previously cached slice. Returns null if nothing is cached.
 * Always succeeds even with no network — that's the point.
 */
export function readTripCache(namespace, tripId = null) {
  const entry = _readRaw(namespace, tripId);
  return entry ? entry.data : null;
}

export function readTripCacheWithMeta(namespace, tripId = null) {
  const entry = _readRaw(namespace, tripId);
  if (!entry) return null;
  const ageMs = Date.now() - new Date(entry.cachedAt).getTime();
  return {
    data: entry.data,
    cachedAt: entry.cachedAt,
    ageMinutes: Math.round(ageMs / 60000),
  };
}

/**
 * Write a slice into the cache. Pages should call this in the success
 * branch of any data fetch they care about offline.
 */
export function writeTripCache(namespace, tripId, data) {
  return _writeRaw(namespace, tripId || null, data);
}

/**
 * Pre-fetch every offline-relevant slice for a trip in one go. Used by
 * the "Save trip for offline" button. Returns a small report so the UI
 * can show "Cached 4 of 4 slices" or "Cached 2 of 4 — calendar failed".
 */
export async function warmTripCache(tripId) {
  if (!tripId) {
    return { ok: false, error: "No trip selected", succeeded: [], failed: ["all"] };
  }

  const tasks = [
    {
      ns: "bookings",
      run: async () => _fetchJson(`/api/bookings?trip_id=${encodeURIComponent(tripId)}`),
    },
    {
      ns: "members",
      run: async () => _fetchJson(`/groups/${encodeURIComponent(tripId)}/members`),
    },
    {
      ns: "calendar",
      run: async () => _fetchJson(`/calendar/events?trip_id=${encodeURIComponent(tripId)}`),
    },
    {
      ns: "trip-info",
      // The active trip's row lives inside the user's `/groups/me` list.
      // Cache the full list — it's small and the navbar uses it too.
      run: async () => _fetchJson(`/groups/me`),
    },
  ];

  const results = await Promise.allSettled(
    tasks.map(async (t) => {
      const data = await t.run();
      _writeRaw(t.ns, t.ns === "trip-info" ? null : tripId, data);
      return t.ns;
    }),
  );

  // Emergency contacts are user-scoped (no trip key).
  try {
    const data = await _fetchJson(`/users/me/emergency-contacts`);
    _writeRaw("emergency", null, data);
    results.push({ status: "fulfilled", value: "emergency" });
  } catch (e) {
    results.push({ status: "rejected", reason: e });
  }

  const succeeded = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
  const failed = tasks
    .map((t) => t.ns)
    .concat(["emergency"])
    .filter((ns) => !succeeded.includes(ns));

  return {
    ok: failed.length === 0,
    succeeded,
    failed,
    cachedAt: new Date().toISOString(),
  };
}

/**
 * Drop all cached entries for one trip — call when the user leaves /
 * deletes a trip so we don't waste storage on dead data.
 */
export function clearTripFromCache(tripId) {
  if (!tripId) return;
  for (const ns of TRIP_NAMESPACES) {
    localStorage.removeItem(storageKey(ns, tripId));
  }
}

/**
 * Drop everything (used on logout).
 */
export function clearAllCache() {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
  keys.forEach((k) => localStorage.removeItem(k));
}

/**
 * Quick read: is a specific trip fully cached? Returns
 * `{ cached: 4, total: 4, cachedAt: "..." }`. Used by the offline-pack
 * button to render its current state.
 */
export function getTripCacheStatus(tripId) {
  if (!tripId) return { cached: 0, total: TRIP_NAMESPACES.length, cachedAt: null };
  let cached = 0;
  let oldestAt = null;
  for (const ns of TRIP_NAMESPACES) {
    const entry = _readRaw(ns, tripId);
    if (entry) {
      cached++;
      const ts = new Date(entry.cachedAt).getTime();
      if (oldestAt === null || ts < oldestAt) oldestAt = ts;
    }
  }
  return {
    cached,
    total: TRIP_NAMESPACES.length,
    cachedAt: oldestAt ? new Date(oldestAt).toISOString() : null,
  };
}
