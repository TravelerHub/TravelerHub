/**
 * useTripCache — persists critical trip data to localStorage so it can be
 * read back when the user is offline.
 *
 * Usage:
 *   const { read, write, clear, isCached } = useTripCache('itinerary');
 *
 *   // After a successful API fetch:
 *   write(data);
 *
 *   // In your render — use cached data as the initial / fallback value:
 *   const [items, setItems] = useState(() => read() ?? []);
 *
 *   useEffect(() => {
 *     if (!isOnline) return;
 *     fetchItinerary().then(data => { setItems(data); write(data); });
 *   }, [isOnline]);
 *
 * Supported namespaces (choose freely):
 *   'itinerary', 'expenses', 'checklist', 'members', 'trip-info', 'calendar'
 *
 * Each entry is stored as:
 *   { data: ..., cachedAt: ISO string, tripId: string | null }
 */

import { useCallback } from 'react';

const PREFIX = 'travelerhub_cache';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h — stale after one day

function storageKey(namespace, tripId) {
  return tripId ? `${PREFIX}:${namespace}:${tripId}` : `${PREFIX}:${namespace}`;
}

export function useTripCache(namespace, tripId = null) {
  const write = useCallback(
    (data) => {
      try {
        localStorage.setItem(
          storageKey(namespace, tripId),
          JSON.stringify({ data, cachedAt: new Date().toISOString(), tripId })
        );
      } catch (e) {
        // localStorage quota exceeded — silently skip caching
        console.warn('[TripCache] write failed:', e.message);
      }
    },
    [namespace, tripId]
  );

  const read = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey(namespace, tripId));
      if (!raw) return null;
      const entry = JSON.parse(raw);
      // Return data regardless of age — stale is better than nothing offline
      return entry.data ?? null;
    } catch {
      return null;
    }
  }, [namespace, tripId]);

  const readWithMeta = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey(namespace, tripId));
      if (!raw) return null;
      const entry = JSON.parse(raw);
      const ageMs = Date.now() - new Date(entry.cachedAt).getTime();
      return {
        data: entry.data,
        cachedAt: entry.cachedAt,
        isStale: ageMs > MAX_AGE_MS,
        ageMinutes: Math.round(ageMs / 60000),
      };
    } catch {
      return null;
    }
  }, [namespace, tripId]);

  const clear = useCallback(() => {
    localStorage.removeItem(storageKey(namespace, tripId));
  }, [namespace, tripId]);

  const isCached = useCallback(() => {
    return localStorage.getItem(storageKey(namespace, tripId)) !== null;
  }, [namespace, tripId]);

  return { read, readWithMeta, write, clear, isCached };
}

/**
 * Utility: clear all TravelerHub caches (e.g. on logout).
 */
export function clearAllTripCaches() {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
  keys.forEach((k) => localStorage.removeItem(k));
}
