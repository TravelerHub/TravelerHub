import { API_BASE } from '../config';

/**
 * Permanently soft-deletes the authenticated user's account.
 * Throws if the request fails.
 */
export async function deleteMyAccount() {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/users/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let detail = 'Failed to delete account';
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch (_) { /* ignore parse error */ }
    throw new Error(detail);
  }
  return res.json();
}
