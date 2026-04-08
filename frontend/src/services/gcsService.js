/**
 * Group-Centric Search (GCS) Service
 *
 * Covers: Fair-Point (geometric median), Group Arrival Sync,
 * Isochrone "Along the Way" search, Park-and-Walk multimodal,
 * Veto / Social Contract checks, and Group Settings.
 */
import { API_BASE } from '../config';

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  };
}

// ── 1. Fair-Point (Geometric Median) ─────────────────────────────────────────

/**
 * Find the geometric median of all group members and suggest POIs near it.
 * @param {string} tripId
 * @param {object} opts - { poi_type, keyword, radius, auto_poll }
 */
export async function findFairPoint(tripId, opts = {}) {
  const res = await fetch(`${API_BASE}/gcs/fair-point`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      trip_id: tripId,
      poi_type: opts.poi_type || 'restaurant',
      keyword: opts.keyword || null,
      radius: opts.radius || 1500,
      auto_poll: opts.auto_poll || false,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to find fair point');
  }
  return res.json();
}

// ── 2. Group Arrival Sync ────────────────────────────────────────────────────

/**
 * Get ETAs for all group members to a shared destination.
 * @param {string} tripId
 * @param {number} destLat
 * @param {number} destLng
 */
export async function getGroupArrivalSync(tripId, destLat, destLng) {
  const res = await fetch(`${API_BASE}/gcs/group-arrival-sync`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      trip_id: tripId,
      destination_lat: destLat,
      destination_lng: destLng,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to sync group arrival');
  }
  return res.json();
}

// ── 3. Isochrone "Along the Way" Search ──────────────────────────────────────

/**
 * Search for POIs within a time-budget corridor around the route.
 * @param {string} tripId
 * @param {string} routePolyline - encoded overview polyline
 * @param {object} opts - { time_budget_minutes, poi_type, keyword }
 */
export async function isochroneSearch(tripId, routePolyline, opts = {}) {
  const res = await fetch(`${API_BASE}/gcs/isochrone-search`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      trip_id: tripId,
      route_polyline: routePolyline,
      time_budget_minutes: opts.time_budget_minutes || 10,
      poi_type: opts.poi_type || 'restaurant',
      keyword: opts.keyword || null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to search along route');
  }
  return res.json();
}

// ── 4. Park-and-Walk Multimodal ──────────────────────────────────────────────

/**
 * Find parking near a destination and compute hybrid Drive+Walk routes.
 * @param {number} originLat
 * @param {number} originLng
 * @param {number} destLat
 * @param {number} destLng
 * @param {number} walkRadius - metres (default 500)
 */
export async function parkAndWalk(originLat, originLng, destLat, destLng, walkRadius = 500) {
  const res = await fetch(`${API_BASE}/gcs/park-and-walk`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      origin_lat: originLat,
      origin_lng: originLng,
      destination_lat: destLat,
      destination_lng: destLng,
      walk_radius: walkRadius,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to find park-and-walk options');
  }
  return res.json();
}

// ── 5. Veto / Social Contract ────────────────────────────────────────────────

/**
 * Check if a proposed route/destination violates any member's constraints.
 * @param {string} tripId
 * @param {string[]} proposedPlaceTypes
 * @param {boolean} proposedTolls
 */
export async function vetoCheck(tripId, proposedPlaceTypes = [], proposedTolls = false) {
  const res = await fetch(`${API_BASE}/gcs/veto-check`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      trip_id: tripId,
      proposed_place_types: proposedPlaceTypes,
      proposed_tolls: proposedTolls,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to check veto');
  }
  return res.json();
}

// ── 6. Group Settings (Social Contract) ──────────────────────────────────────

export async function getGroupSettings(tripId) {
  const res = await fetch(`${API_BASE}/gcs/group-settings/${tripId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load group settings');
  return res.json();
}

export async function updateGroupSettings(tripId, settings) {
  const res = await fetch(`${API_BASE}/gcs/group-settings/${tripId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update group settings');
  }
  return res.json();
}
