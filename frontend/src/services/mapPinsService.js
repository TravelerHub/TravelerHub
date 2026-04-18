import { API_BASE } from '../config';

function authHeaders() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Fetch all shared pins for a trip. */
export async function getPins(tripId) {
  const res = await fetch(`${API_BASE}/map-pins/${tripId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch map pins');
  return res.json();
}

/** Drop a new collaborative pin on the shared map. */
export async function createPin({ tripId, lat, lng, title, note = null, emoji = '📍', color = '#183a37' }) {
  const res = await fetch(`${API_BASE}/map-pins/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ trip_id: tripId, lat, lng, title, note, emoji, color }),
  });
  if (!res.ok) throw new Error('Failed to create pin');
  return res.json();
}

/** Edit a pin's title / note / emoji (own pins only). */
export async function updatePin(pinId, { title, note, emoji, color }) {
  const res = await fetch(`${API_BASE}/map-pins/${pinId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ title, note, emoji, color }),
  });
  if (!res.ok) throw new Error('Failed to update pin');
  return res.json();
}

/** Remove a pin from the shared map (own pins only). */
export async function deletePin(pinId) {
  const res = await fetch(`${API_BASE}/map-pins/${pinId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete pin');
  return true;
}

/** Toggle upvote on a pin. */
export async function upvotePin(pinId) {
  const res = await fetch(`${API_BASE}/map-pins/${pinId}/upvote`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to upvote pin');
  return res.json();
}
