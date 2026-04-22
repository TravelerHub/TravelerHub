import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// apiFetch lives in services/api.js and reads API_BASE from config.js which
// uses import.meta.env.VITE_API_URL.  We mock the config module so we control
// the base URL in tests, then import apiFetch after the mock is set up.

vi.mock('../config.js', () => ({
  API_BASE: 'http://test-api',
  getToken: () => null,
  authHeaders: () => ({}),
}))

// Dynamic import so the mock above is applied first.
const { apiFetch } = await import('../services/api.js')

describe('apiFetch', () => {
  let fetchSpy

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('constructs the correct URL from API_BASE + path', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'ok' }),
    })

    await apiFetch('/trips')

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url] = fetchSpy.mock.calls[0]
    expect(url).toBe('http://test-api/trips')
  })

  it('includes Authorization header from localStorage token', async () => {
    localStorage.setItem('token', 'my-jwt-token')

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    await apiFetch('/me')

    const [, options] = fetchSpy.mock.calls[0]
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer my-jwt-token',
    })
  })

  it('throws on a non-ok response', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ detail: 'Not authenticated' }),
    })

    await expect(apiFetch('/protected')).rejects.toThrow('401')
  })
})
