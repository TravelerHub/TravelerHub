// Strip a trailing slash so callers can write `${API_BASE}/trips/...` and we
// never end up with `//trips/...` (which some servers redirect → loses POST
// body for cross-origin multipart uploads).
const _raw = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const API_BASE = _raw.replace(/\/+$/, '');

// Loud runtime warning when the bundle ships with the localhost fallback but
// is being served from a real domain — this is the most common cause of
// "Failed to fetch" on production deploys.
if (typeof window !== 'undefined') {
  const onLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const apiOnLocalhost = /(?:localhost|127\.0\.0\.1)/.test(API_BASE);
  if (!onLocalhost && apiOnLocalhost) {
    // eslint-disable-next-line no-console
    console.error(
      `[config] VITE_API_URL is not set for this build — falling back to ${API_BASE}.\n` +
      `Page is being served from ${window.location.origin} (HTTPS), so all API calls\n` +
      `will fail with "Failed to fetch" due to mixed content. Set VITE_API_URL in the\n` +
      `frontend deploy environment and redeploy.`
    );
  }
}
