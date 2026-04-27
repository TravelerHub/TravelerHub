import { API_BASE } from '../config';

const ACTIVE_GROUP_KEY = 'active_group_id';
// Custom event name pages can subscribe to — fired whenever the active trip
// changes (via the navbar or otherwise). Lets pages refetch their data
// without a hard `window.location.reload()`.
export const ACTIVE_TRIP_EVENT = 'active-trip-changed';

function getToken() {
  return localStorage.getItem('token');
}

export function getActiveGroupId() {
  return localStorage.getItem(ACTIVE_GROUP_KEY) || '';
}

export function setActiveGroupId(groupId) {
  const next = groupId ? String(groupId) : '';
  const prev = getActiveGroupId();
  if (next === prev) return;
  if (!next) {
    localStorage.removeItem(ACTIVE_GROUP_KEY);
  } else {
    localStorage.setItem(ACTIVE_GROUP_KEY, next);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(ACTIVE_TRIP_EVENT, { detail: { tripId: next } })
    );
  }
}

export async function getMyGroups() {
  const response = await fetch(`${API_BASE}/groups/me`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load groups');
  }

  const groups = await response.json();
  return Array.isArray(groups) ? groups : [];
}

export async function ensureActiveGroupId() {
  const existing = getActiveGroupId();
  if (existing) return existing;

  const groups = await getMyGroups();
  const firstId = groups[0]?.group_id || groups[0]?.id || '';
  if (firstId) setActiveGroupId(firstId);
  return firstId;
}
