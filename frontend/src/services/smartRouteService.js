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
 */
export async function getGroupPositions(groupId) {
  const res = await fetch(`${API_BASE}/smart-route/group-positions/${groupId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to load group positions");
  return res.json();
}
