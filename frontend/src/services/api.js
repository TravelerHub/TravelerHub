export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
export const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token')
export const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` })

export async function apiFetch(path, options = {}) {
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
    throw err
  }
  return res.json()
}
