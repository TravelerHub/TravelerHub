# Changelog

All notable changes to TravelerHub are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
  `CHANGELOG.md` for first public release.
- Public-release issue templates, PR template, and Dependabot config under
  `.github/`.
- CI workflow running backend `pytest`, frontend `vitest`, ESLint, and
  Gitleaks secret scanning on every PR.
- `Privacy` and `Terms` pages, linked from the public footer.
- SQL migration `025_enable_rls.sql` that re-enables row-level security on
  every user-data table (a safety net against testing-only `DISABLE RLS`).

### Changed
- `/docs`, `/redoc`, and `/openapi.json` are now disabled in production
  unless `ENABLE_API_DOCS=true` is set explicitly.
- Removed personal `fozhan.dev` defaults from CORS, invite URLs, story URLs,
  and the service worker; all hostnames are now driven by env vars
  (`FRONTEND_URL`, `INVITE_BASE_URL`, `CORS_ORIGINS`, `VITE_API_URL`).
- Public-facing `README.md` rewritten to highlight features, screenshots, and
  the demo flow; operator details moved to `SETUP.md`.

## [0.x] – pre-public

The full pre-public history is in `git log`. Highlights from the last 30
days before going public:

- **Observability**: per-request IDs and a structured error envelope (#98).
- **Auth**: global 401 fetch interceptor so legacy `fetch()` callers also
  redirect on session expiry (#97); replaced `passlib` with direct `bcrypt`
  to fix Python 3.12 signup/login crashes (#92).
- **Live trip**: Today-of-trip widget on the dashboard with current/next stop
  (#94); deterministic OSM-based day planner with no AI dependency (#91).
- **Offline**: trip pack caches bookings/calendar/members for no-signal
  travel (#89); pre-fetch trip-center map snapshots into the SW tile cache
  (#96).
- **Booking import**: import bookings from email or photo via local OCR and
  deterministic vendor parsers, no AI (#88); OSM Overpass + Wikipedia as a
  free fallback for Google Places (#87).
- **Maps & gallery**: bucket-aware photo URL repair (#104); deep-link search
  results to the right trip + photo (#100); group + iconified sidebar (#103).
- **Money**: receipt amounts render in their actual currency, not always USD
  (#101).
