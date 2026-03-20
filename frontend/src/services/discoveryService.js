import { API_BASE } from '../config';

function getToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

/**
 * Get favorite places saved by all group members — friend activity + heatmap data.
 */
export async function getGroupActivity(groupId, category = null) {
  const params = new URLSearchParams();
  if (category) params.append("category", category);

  const url = `${API_BASE}/discovery/group-activity/${groupId}${params.toString() ? '?' + params : ''}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load group activity");
  return res.json();
}

/**
 * Get aggregated group preferences — powers the "Vibe Overlay" filter.
 */
export async function getGroupVibes(groupId) {
  const res = await fetch(`${API_BASE}/discovery/vibes/${groupId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load group vibes");
  return res.json();
}

/**
 * Get geo-tagged expense markers for the map.
 */
export async function getExpenseMarkers(tripId = null) {
  const params = new URLSearchParams();
  if (tripId) params.append("trip_id", tripId);

  const url = `${API_BASE}/discovery/expense-markers${params.toString() ? '?' + params : ''}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load expense markers");
  return res.json();
}

/**
 * Get spending summary for a group — "Wallet" integration.
 */
export async function getGroupExpenseSummary(groupId) {
  const res = await fetch(`${API_BASE}/discovery/group-expense-summary/${groupId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load expense summary");
  return res.json();
}
