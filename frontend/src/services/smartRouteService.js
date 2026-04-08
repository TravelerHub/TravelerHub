import { API_BASE } from '../config';

function getToken() {
  return localStorage.getItem("token");
}

/**
 * Plan a smart route with preference-based POI suggestions and trip chapters.
 *
 * @param {Array} waypoints - Array of { name, coordinates: [lng, lat] }
 * @param {string} mode - driving | walking | bicycling | transit
 * @param {string} preference - fastest | scenic | foodie | budget
 * @param {string|null} departureTime - ISO datetime string
 * @param {string|null} groupId - for group preference filtering
 */
export async function planSmartRoute(waypoints, mode = 'driving', preference = 'fastest', departureTime = null, groupId = null) {
  const res = await fetch(`${API_BASE}/smart-route/plan`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      waypoints,
      mode,
      preference,
      departure_time: departureTime,
      group_id: groupId,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to plan smart route');
  }
  return res.json();
}

/**
 * Get positions/info of all group members for group sync.
 * Now returns actual lat/lng from member_positions table.
 */
export async function getGroupPositions(groupId) {
  const res = await fetch(`${API_BASE}/smart-route/group-positions/${groupId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to load group positions");
  return res.json();
}

/**
 * Send the current user's position to the backend for group sync.
 * UPSERTs into member_positions and triggers Supabase Realtime.
 */
export async function syncMyPosition(groupId, { lat, lng, heading, accuracy }) {
  const res = await fetch(`${API_BASE}/smart-route/group-sync/${groupId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lat, lng, heading, accuracy }),
  });
  if (!res.ok) throw new Error("Failed to sync position");
  return res.json();
}

/**
 * Ranked-choice vote submission for Borda Count polls.
 */
export async function submitRankedVote(pollId, rankings) {
  const res = await fetch(`${API_BASE}/polls/${pollId}/ranked-vote`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rankings }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit ranked vote');
  }
  return res.json();
}

/**
 * Get Borda Count results for a ranked-choice poll.
 */
export async function getBordaResults(pollId) {
  const res = await fetch(`${API_BASE}/polls/${pollId}/borda-results`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to load Borda results");
  return res.json();
}

/**
 * Get the Frustration Index for all members in a trip.
 */
export async function getFrustrationIndex(tripId) {
  const res = await fetch(`${API_BASE}/polls/frustration-index/${tripId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to load frustration index");
  return res.json();
}
