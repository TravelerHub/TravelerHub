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

// ── Global 401 interceptor ───────────────────────────────────────────────
//
// We have ~130 raw `fetch(`${API_BASE}/...`)` calls scattered across pages
// and service modules that don't go through `apiFetch`. None of them
// dispatch `auth:expired` on 401, so when a user's token quietly expires
// they see broken half-rendered pages instead of being sent back to /login.
//
// Migrating every caller is a huge surface change; instead we wrap the
// global fetch once. The wrapper is URL-scoped — it only observes
// responses for `${API_BASE}/...` and only fires the event when there was
// a token to begin with (mirrors apiFetch's `hadToken` guard so anonymous
// public-story / login fetches never trigger a redirect loop).
//
// Idempotent: re-importing this module won't double-wrap.
function _installAuthFetchInterceptor() {
  if (typeof window === 'undefined' || !window.fetch) return
  if (window.__travelerhubFetchPatched) return
  const orig = window.fetch.bind(window)

  window.fetch = async function patchedFetch(input, init) {
    const hadToken = !!getToken()
    let url = ''
    try {
      url = typeof input === 'string' ? input : input?.url || ''
    } catch { /* ignore — pass through */ }

    const res = await orig(input, init)
    // Only act on our own API. Mapbox/Wikipedia/etc. handle their own auth.
    const isOurApi =
      url.startsWith(API_BASE) ||
      url.startsWith('/api/') ||
      url.startsWith('/auth') ||
      url.startsWith('/groups') ||
      url.startsWith('/trips') ||
      url.startsWith('/users') ||
      url.startsWith('/finance') ||
      url.startsWith('/calendar') ||
      url.startsWith('/activity')
    if (isOurApi && res.status === 401 && hadToken) {
      notifyAuthExpired()
    }
    return res
  }
  window.__travelerhubFetchPatched = true
}

_installAuthFetchInterceptor()
