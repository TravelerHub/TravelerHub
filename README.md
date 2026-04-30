# TravelerHub

> **Group travel without the group-chat chaos.**

TravelerHub is the shared brain for a group trip — live location, expenses,
photos, polls, bookings, and a day-by-day plan, all in one app. Self-host
it for free, or use the hosted instance.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Tests](https://github.com/TravelerHub/TravelerHub/actions/workflows/test.yml/badge.svg)
![Security](https://github.com/TravelerHub/TravelerHub/actions/workflows/security.yml/badge.svg)

---

## Why it exists

Anyone who has organized a trip with five friends knows the loop: a chat
thread for the bookings, a spreadsheet for the budget, a Google Doc for the
itinerary, and a Splitwise tab for who-owes-whom. By day three nobody
remembers which tab the hotel confirmation lives in, and somebody is
inevitably twenty minutes late because they couldn't find the meeting pin.

TravelerHub puts the whole group in one app and tries hard to do the boring
parts for you:

- **Be where you are**: live location pins, geofence alerts when someone
  arrives at the meeting spot, and a "where to next" widget that always
  knows what the group is doing today.
- **Pay your share**: scan a receipt, the app extracts the amount and
  currency and splits it; settlements minimise the number of transfers.
- **Plan less, do more**: a deterministic day planner builds a route from
  OpenStreetMap POIs — no AI tokens required, works offline.
- **Keep the memories**: the trip pack caches everything for the flight
  home, and Story Mode generates a shareable card from the photos and
  expenses you logged.

## Highlights

| Feature | What it does |
|---------|--------------|
| 🗺️  Live group map | Real-time pins via Supabase Realtime; sub-second updates. |
| 💰  Receipt scanner | Local OCR + Gemini fallback; writes split expenses with the right currency. |
| 🏨  Booking import | Upload a confirmation email or screenshot — deterministic vendor parsers (Marriott, Airbnb, Booking.com, Kiwi) extract the booking. |
| 🗳️  Ranked-choice voting | Group decisions without endless chat threads. |
| 📅  Itinerary builder | OSM Overpass + Wikipedia produce a free, unlimited day plan. |
| 📵  Offline trip pack | Pre-cached map tiles, bookings, calendar, and members for no-signal travel. |
| 🔔  Push + 401 grace | Web push for trip events; a global 401 interceptor that won't drop your draft. |
| 🛟  Emergency page | One-tap location + medical info share for the group. |
| 🔒  Encrypted chat | TweetNaCl group chat — keys never leave the device. |

## Architecture

```
React 19 + Vite (PWA, Capacitor-wrapped iOS/Android)
        │
        ▼
FastAPI (Python 3.11) — 43 routers, slowapi rate-limited
        │
        ├── Supabase (Postgres + Realtime + Storage)
        ├── Mapbox (tiles, route optimization)
        ├── Google Maps Platform (Places, Geocoding, Gemini)
        └── Stripe (optional, for paid features)
```

## Quickstart (local dev)

```bash
git clone https://github.com/TravelerHub/TravelerHub
cd TravelerHub

# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in SUPABASE_*, JWT_SECRET_KEY at minimum
uvicorn main:app --reload

# Frontend (in another shell)
cd frontend
npm install
cp .env.example .env   # fill in VITE_SUPABASE_*, VITE_API_URL=http://localhost:8000
npm run dev
```

Open `http://localhost:5173` and sign up. The Vite dev server proxies
`/api` to the backend automatically.

For full setup (Supabase migrations, API keys, production deploy) see
[SETUP.md](SETUP.md).

## Self-host

The repository ships with a one-shot installer for any Ubuntu 22.04 host.
Set three env vars and run:

```bash
DOMAIN=travel.example.com \
API_DOMAIN=api.travel.example.com \
ADMIN_EMAIL=ops@example.com \
bash scripts/server-setup.sh
```

It installs Docker + nginx + certbot, drops in the SSL cert, and brings up
the backend container. Push to `main` and the GitHub Actions workflow
deploys frontend + backend over SSH (configure `SERVER_IP`,
`SERVER_SSH_KEY`, `FRONTEND_DOMAIN` as repo secrets).

## What's free vs paid

The app is designed so you can run a real trip on the free tiers of every
upstream service:

- **Supabase** — free tier covers small groups.
- **Mapbox** — 50k tile loads/month free.
- **Google Maps Platform** — required only if you want Places-grade search;
  the OSM Overpass fallback covers most queries with no key.
- **Gemini / Anthropic** — only the receipt scanner and the optional AI
  chat use them; everything else (itinerary, booking import) runs locally.

## Repository tour

```
backend/         FastAPI app — routers/, migrations/, tests/
frontend/        React 19 + Vite SPA, Capacitor for iOS/Android
nginx/           Templated vhost for self-hosting
scripts/         server-setup.sh
.github/         CI, dependabot, issue/PR templates
SETUP.md         Full operator guide
CONTRIBUTING.md  How to contribute
SECURITY.md      Vulnerability disclosure
```

## Roadmap

See [open issues](https://github.com/TravelerHub/TravelerHub/issues). The
near-term focus after the public release:

- Backfill router-level integration tests (currently 9 backend pytest
  files, target full router coverage).
- Optional Sentry integration with the existing per-request ID middleware.
- Demo instance with seed fixture data so the README screenshots are real.
- Native iOS/Android distribution via the existing Capacitor setup.

## Contributing

Pull requests welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). For security
issues please use the private disclosure flow in [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).
