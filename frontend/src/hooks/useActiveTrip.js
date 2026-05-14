import { useEffect, useState } from "react";
import {
  ACTIVE_TRIP_EVENT,
  getActiveGroupId,
  setActiveGroupId,
} from "../services/groupService";

/**
 * Source of truth for "which trip is the user currently working in".
 *
 * Reads `active_group_id` from localStorage and re-renders subscribers
 * whenever the value changes — either from the in-page TripSwitcher in the
 * top navbar (which dispatches `active-trip-changed`) or from another tab
 * (which fires a `storage` event). Pages used to roll their own
 * `useState(getActiveGroupId())` and stayed stale after a switch — now they
 * just read this hook.
 *
 * The optional `groups` argument lets a caller pass in the trips list
 * they've already fetched, so the hook can also surface the active trip's
 * display name without an extra round-trip.
 */
export function useActiveTrip(groups) {
  const [tripId, setTripId] = useState(() => getActiveGroupId() || "");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleCustom = (e) => {
      const next = e?.detail?.tripId ?? getActiveGroupId() ?? "";
      setTripId(next);
    };
    const handleStorage = (e) => {
      if (e.key === "active_group_id") setTripId(e.newValue || "");
    };

    window.addEventListener(ACTIVE_TRIP_EVENT, handleCustom);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(ACTIVE_TRIP_EVENT, handleCustom);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const tripName = (() => {
    if (!Array.isArray(groups)) return "";
    const match = groups.find(
      (g) => String(g.group_id || g.id) === String(tripId)
    );
    return match?.name || "";
  })();

  return {
    tripId,
    tripName,
    setActiveTrip: (id) => {
      setActiveGroupId(id || "");
      // Optimistic local update — the event handler will also fire and
      // confirm. Saves a render cycle on the page that triggered the change.
      setTripId(id ? String(id) : "");
    },
  };
}
