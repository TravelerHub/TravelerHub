import { API_BASE } from '../config';

function getToken() {
  return localStorage.getItem("token");
}

function authHeaders(json = false) {
  const h = { Authorization: `Bearer ${getToken()}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

/**
 * Nominate a place for the group to consider.
 */
export async function nominatePlace(groupId, nomination) {
  const res = await fetch(`${API_BASE}/nominations/${groupId}/nominate`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(nomination),
  });
  if (!res.ok) throw new Error("Failed to nominate place");
  return res.json();
}

/**
 * Vote on a nomination. vote: 1 (upvote) or -1 (downvote).
 */
export async function voteOnNomination(groupId, nominationId, vote) {
  const res = await fetch(`${API_BASE}/nominations/${groupId}/vote`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ nomination_id: nominationId, vote }),
  });
  if (!res.ok) throw new Error("Failed to record vote");
  return res.json();
}

/**
 * Get the shortlist of nominations with vote tallies.
 */
export async function getShortlist(groupId, tripId = null) {
  const params = new URLSearchParams();
  if (tripId) params.append("trip_id", tripId);

  const url = `${API_BASE}/nominations/${groupId}/shortlist${params.toString() ? '?' + params : ''}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load shortlist");
  return res.json();
}

/**
 * Delete a nomination.
 */
export async function deleteNomination(nominationId) {
  const res = await fetch(`${API_BASE}/nominations/${nominationId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete nomination");
  return res.json();
}

/**
 * Detect conflicts between nominated places.
 */
export async function detectConflicts(groupId, tripId = null, maxDistanceKm = 50) {
  const params = new URLSearchParams();
  if (tripId) params.append("trip_id", tripId);
  params.append("max_distance_km", maxDistanceKm.toString());

  const url = `${API_BASE}/nominations/${groupId}/conflicts?${params}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to detect conflicts");
  return res.json();
}
