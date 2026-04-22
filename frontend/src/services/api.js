export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
export const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token')
export const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` })

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}
