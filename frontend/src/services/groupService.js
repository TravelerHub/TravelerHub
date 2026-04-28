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

let _groupsCache = null;
let _groupsCacheTime = 0;
let _groupsInflight = null;
const GROUPS_TTL = 60 * 1000; // 1 minute — long enough to dedupe burst calls on page load

export function clearMyGroupsCache() {
  _groupsCache = null;
  _groupsCacheTime = 0;
  _groupsInflight = null;
}

export async function getMyGroups() {
  const now = Date.now();
  if (_groupsCache && now - _groupsCacheTime < GROUPS_TTL) {
    return _groupsCache;
  }
  if (_groupsInflight) return _groupsInflight;

  _groupsInflight = (async () => {
    try {
      const response = await fetch(`${API_BASE}/groups/me`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) {
        throw new Error('Failed to load groups');
      }
      const groups = await response.json();
      const list = Array.isArray(groups) ? groups : [];
      _groupsCache = list;
      _groupsCacheTime = Date.now();
      return list;
    } finally {
      _groupsInflight = null;
    }
  })();
  return _groupsInflight;
}

export async function ensureActiveGroupId() {
  const existing = getActiveGroupId();
  if (existing) return existing;

  const groups = await getMyGroups();
  const firstId = groups[0]?.group_id || groups[0]?.id || '';
  if (firstId) setActiveGroupId(firstId);
  return firstId;
}
