export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
export const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token')
export const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` })

// Fired once when an authenticated request comes back 401 so a listener in
// main.jsx can clear credentials and redirect to /login. Without this, the
// user sees half-rendered pages every time their token expires.
export function notifyAuthExpired() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('auth:expired'))
}

export async function apiFetch(path, options = {}) {
  const hadToken = !!getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = body && (body.detail || body.message || body.error)
    const err = new Error(detail || `${res.status} ${res.statusText}`)
    err.status = res.status
    err.body = body
    if (res.status === 401 && hadToken) notifyAuthExpired()
    throw err
  }
  return res.json()
}
