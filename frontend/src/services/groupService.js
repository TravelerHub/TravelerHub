import { API_BASE } from '../config';

const ACTIVE_GROUP_KEY = 'active_group_id';

function getToken() {
  return localStorage.getItem('token');
}

export function getActiveGroupId() {
  return localStorage.getItem(ACTIVE_GROUP_KEY) || '';
}

export function setActiveGroupId(groupId) {
  if (!groupId) {
    localStorage.removeItem(ACTIVE_GROUP_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_GROUP_KEY, String(groupId));
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
