/**
 * OfflinePackButton — a Dashboard control that warms the local cache for
 * the active trip in one click. The user taps it before they get on a
 * plane / leave wifi range; afterwards Booking, Calendar, members,
 * emergency contacts, and trip metadata all render from localStorage
 * without a network round-trip.
 *
 * The button shows three states:
 *   - "Save for offline"    — never warmed for this trip
 *   - "Cached X min ago"    — has data, not currently warming
 *   - "Saving 3/5 …"        — in-flight (with optimistic counter)
 *
 * Failures are shown inline. Any partial cache from a previous warm is
 * left in place — better stale than gone.
 */

import { useEffect, useState } from "react";
import {
  warmTripCache,
  getTripCacheStatus,
  TRIP_NAMESPACES,
} from "../services/tripCache";
import { prefetchMapTilesForTrip } from "../services/tilePreFetch";

function _formatAge(iso) {
  if (!iso) return null;
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function OfflinePackButton({ tripId, tripName }) {
  const [status, setStatus] = useState(() => getTripCacheStatus(tripId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Re-read status when the active trip changes — the user could have
  // cached one trip and switched to another that's never been warmed.
  useEffect(() => {
    setStatus(getTripCacheStatus(tripId));
    setError("");
  }, [tripId]);

  const handleClick = async () => {
    if (!tripId || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await warmTripCache(tripId);
      setStatus(getTripCacheStatus(tripId));

      // Best-effort: pre-fetch a handful of static map snapshots for the
      // trip's center so the Dashboard MapSnapshot still renders offline.
      // Runs after warmTripCache so the bookings cache exists to derive
      // coords from. Failures here are silent — they're not critical and
      // the user already has all the data.
      try {
        await prefetchMapTilesForTrip(tripId);
      } catch { /* never block the cache report on tile failure */ }

      if (!result.ok && result.failed?.length) {
        // Don't crash the UI — list what failed so the user knows what's
        // still online-only.
        setError(`Couldn't cache: ${result.failed.join(", ")}`);
      }
    } catch (e) {
      setError(e?.message || "Couldn't save for offline.");
    } finally {
      setBusy(false);
    }
  };

  if (!tripId) return null;

  const ageLabel = _formatAge(status.cachedAt);
  const fullyCached = status.cached === status.total && status.total > 0;
  const partiallyCached = status.cached > 0 && status.cached < status.total;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition hover:opacity-90 disabled:opacity-60"
        style={{
          background: fullyCached ? "#166534" : "#160f29",
          color: "#fbfbf2",
        }}
        title={
          tripName
            ? `Download ${tripName} for offline use — bookings, calendar, contacts.`
            : "Save the active trip's data for offline use."
        }
      >
        {busy ? (
          <>
            <span
              className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "#fbfbf2", borderTopColor: "transparent" }}
              aria-hidden="true"
            />
            Saving…
          </>
        ) : fullyCached ? (
          <>
            <span aria-hidden="true">📥</span>
            Saved for offline
          </>
        ) : partiallyCached ? (
          <>
            <span aria-hidden="true">📥</span>
            Update offline copy
          </>
        ) : (
          <>
            <span aria-hidden="true">📥</span>
            Save for offline
          </>
        )}
      </button>

      {/* Status meta — small, muted */}
      {(ageLabel || error || partiallyCached) && (
        <div className="text-xs leading-tight" style={{ color: "#5c6b73" }}>
          {ageLabel && (
            <div>
              {status.cached}/{TRIP_NAMESPACES.length + 1} cached · last saved {ageLabel}
            </div>
          )}
          {error && (
            <div style={{ color: "#b45309" }}>{error}</div>
          )}
        </div>
      )}
    </div>
  );
}
