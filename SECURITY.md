# Security Policy

## Supported versions

Only the latest release on `main` receives security fixes. Pre-1.0 there are
no LTS branches.

## Reporting a vulnerability

**Please don't open a public GitHub issue for security problems.**

Instead, email the maintainers via GitHub's [private vulnerability reporting](https://github.com/TravelerHub/TravelerHub/security/advisories/new)
form (Security tab → "Report a vulnerability"). If that's not available to
you, open a minimal-detail issue titled "security contact request" and we'll
follow up with a private channel.

When you report, please include:

- A clear description of the issue and its impact
- A minimal reproduction (request payload, steps, affected route)
- Whether the bug requires authentication and at what role
- Your suggested severity (informational / low / medium / high / critical)

We aim to:

| Step | Target |
|------|--------|
| Acknowledge the report | within 72 hours |
| Triage & confirm severity | within 7 days |
| Ship a fix or mitigation | within 30 days for high/critical |
| Public disclosure | coordinated, after a fix is available |

## Scope

In scope:

- The TravelerHub backend (FastAPI, `backend/`)
- The TravelerHub frontend (React, `frontend/`)
- The deploy scripts and Docker images shipped from this repo
- Authentication, authorization, and data-isolation flaws
- SSRF, RCE, SQL/NoSQL injection, IDOR, prototype pollution, XSS, CSRF
- Secrets accidentally committed to the repo

Out of scope:

- Third-party services (Supabase, Mapbox, Google, Stripe) — report to the
  vendor directly.
- Self-hosted deployments where the operator has misconfigured CORS, RLS, or
  secrets.
- Denial-of-service via brute-forcing rate-limited endpoints.
- Social-engineering or physical attacks against contributors.

## Hall of fame

We don't currently offer cash bounties, but we'll credit researchers in the
release notes for the version that contains the fix (with permission).
