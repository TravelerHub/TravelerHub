# TravelerHub — Setup & Deployment Guide

This guide covers everything you need to go from zero to a fully running, publicly accessible TravelerHub instance where multiple users can test real-time location sharing, group finance, and all other features.

---

## 1. Prerequisites

| Tool | Purpose | Get it |
|------|---------|--------|
| Node 20+ / npm | Frontend build | nodejs.org |
| Python 3.11 | Backend runtime | python.org |
| Git | Version control | git-scm.com |
| Supabase account | Database + Realtime + Storage | supabase.com (free) |
| Render account | Backend hosting | render.com (free tier) |
| Vercel account | Frontend hosting | vercel.com (free tier) |
| Google Cloud account | Maps + Gemini APIs | console.cloud.google.com |
| Mapbox account | Map tiles + routing | mapbox.com (50k loads/mo free) |
| Stripe account (optional) | Payment processing | stripe.com |

---

## 2. Supabase Setup

### 2a. Create a Project
1. Go to **supabase.com → New Project**
2. Note your **Project URL** (`https://xxxx.supabase.co`) and **anon key** from Settings → API
3. Also grab the **service_role key** — keep this secret, only used by the backend

### 2b. Run Migrations
Open the Supabase **SQL Editor** and run each file in `backend/migrations/` **in order**:

```
001_initial_schema.sql
002_...
...
020_shared_map_pins.sql
021_activity_feed.sql        ← creates trip_activity, media_comments, trip_todos, card_profiles, trip_budgets
```

> **Tip:** You can paste multiple files into the SQL editor at once. If a migration fails, check for existing tables with the same name — use `CREATE TABLE IF NOT EXISTS` if needed.

### 2c. Enable Realtime
Go to **Database → Replication → Supabase Realtime** and enable these tables:

| Table | Why |
|-------|-----|
| `member_positions` | Live group location on the map |
| `shared_map_pins` | Collaborative map pins update in real time |
| `trip_activity` | Activity feed shows events without refresh |
| `trip_todos` | Shared todo list syncs across group members |

> If the tables don't appear in the list, run the `ALTER PUBLICATION supabase_realtime ADD TABLE ...` lines from the migration files manually.

### 2d. Storage Bucket
1. Go to **Storage → New Bucket** → name it `trip-media` → **Public bucket** ✓
2. The gallery upload endpoint expects this bucket name

### 2e. Row Level Security (RLS)
The migrations include basic RLS policies. For the demo/testing phase you can also disable RLS on individual tables via the dashboard (Table Editor → RLS toggle). **Re-enable before going to production.**

---

## 3. Google Cloud APIs

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → Create a project
2. Enable these APIs (**APIs & Services → Library → search each name → Enable**):
   - **Maps JavaScript API** (not needed server-side, but good to have enabled)
   - **Places API (New)** — powers hotel/activity search
   - **Geocoding API** — converts addresses to lat/lng (receipt scanner)
   - **Directions API** — smart route optimization
   - **Gemini API** (under "Generative Language API") — receipt scanning, AI chat

3. Go to **APIs & Services → Credentials → Create Credentials → API Key**
4. For the backend, create one key (restrict to server IP or leave unrestricted for testing)
5. Note: Gemini can use either the Google AI Studio key (`GOOGLE_API_KEY`) or a Vertex AI key. The code uses `google-genai` SDK with `GEMINI_API_KEY`.

---

## 4. Mapbox Setup

1. Go to [mapbox.com](https://mapbox.com) → Account → Tokens → Create a token
2. Default public token works for development; restrict it to your domain in production
3. Keep this as `VITE_MAPBOX_TOKEN` in the frontend

---

## 5. Local Development

### 5a. Backend

```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Copy and fill in the env file:
cp .env.example .env
# Edit .env — see Section 6 for all variables

uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`.
API docs at `http://localhost:8000/docs`.

### 5b. Frontend

```bash
cd frontend
npm install

# Copy and fill in the env file:
cp .env.example .env
# Edit .env — see Section 7 for all variables

npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## 6. Backend Environment Variables (`backend/.env`)

```env
# ── Supabase ──────────────────────────────────────────────────────────
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # From Supabase → Settings → API → service_role
SUPABASE_ANON_KEY=eyJ...          # From Supabase → Settings → API → anon

# ── JWT Auth ──────────────────────────────────────────────────────────
JWT_SECRET_KEY=any-long-random-string-here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440   # 24 hours

# ── Email (for OTP password reset) ────────────────────────────────────
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=your-gmail@gmail.com
SENDER_PASSWORD=your-16-char-app-password   # Gmail → Security → App Passwords

OTP_EXPIRY_MINUTES=10
MAX_OTP_ATTEMPTS=5

# ── Google APIs ───────────────────────────────────────────────────────
GOOGLE_PLACES_API_KEY=AIza...    # Places API + Geocoding API
GOOGLE_API_KEY=AIza...           # Gemini / Generative AI
GEMINI_API_KEY=AIza...           # Can be same as GOOGLE_API_KEY

# ── Mapbox (server-side route optimization) ───────────────────────────
MAPBOX_TOKEN=pk.eyJ...

# ── CORS (comma-separated, no spaces) ─────────────────────────────────
# Local:
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
# Production (set in Render dashboard):
# CORS_ORIGINS=https://your-app.vercel.app

# ── Stripe (optional — for billing features) ──────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # Only needed if using webhooks
```

---

## 7. Frontend Environment Variables (`frontend/.env`)

```env
# ── Supabase ──────────────────────────────────────────────────────────
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...   # anon key (safe to expose in frontend)

# ── Map APIs ──────────────────────────────────────────────────────────
VITE_MAPBOX_TOKEN=pk.eyJ...
VITE_GOOGLE_PLACES_API_KEY=AIza...   # For place autocomplete in the frontend

# ── Backend URL ───────────────────────────────────────────────────────
# Local:
VITE_API_URL=http://localhost:8000
# Production (set in Vercel dashboard):
# VITE_API_URL=https://travelerhub-api.onrender.com

# ── Stripe (frontend publishable key — safe to expose) ────────────────
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## 8. Deploy: Backend → Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → **New → Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Python Version:** 3.11
5. Under **Environment → Add from .env** — paste all your backend env vars
6. **Critically:** set `CORS_ORIGINS=https://YOUR_VERCEL_APP.vercel.app`
7. Deploy → note the public URL (e.g. `https://travelerhub-api.onrender.com`)

> **Free tier note:** Render's free tier spins down after 15 min of inactivity. The first request after idle takes ~30s. Consider Render Starter ($7/mo) for always-on, or use a free uptime monitor (UptimeRobot) to ping every 10 min.

---

## 9. Deploy: Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project → Import from GitHub**
2. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite (auto-detected)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `dist` (default)
3. Under **Environment Variables**, add all `VITE_*` variables from Section 7
4. **Critically:** set `VITE_API_URL=https://travelerhub-api.onrender.com`
5. Deploy → your app is live at `https://travelerhub-xxxxx.vercel.app`

> The `frontend/vercel.json` in the repo already configures SPA routing so deep links like `/dashboard` work on refresh.

---

## 10. Post-Deploy Checklist

- [ ] Visit `/` — landing page loads
- [ ] Create an account → verify login works
- [ ] Create a trip → verify it appears in the dashboard
- [ ] Open the app in two different browser profiles (or two devices) → both join the same trip
- [ ] Go to Navigation in both windows → enable location sharing → verify both see each other's pins on the map in real time (this is the core multi-user test)
- [ ] Upload a photo in Gallery → verify it appears for both users
- [ ] Add a todo → verify it appears for both users after refresh
- [ ] Add an expense → split it → verify balances update

---

## 11. Real-Time Location Sharing — Testing

The most important thing to verify after deployment is live group location sharing. Here's the exact test:

1. User A opens `https://your-app.vercel.app/navigation` → clicks "Share Location"
2. User B opens the same URL on a different device/browser → joins the same trip → clicks "Share Location"
3. Both should see colored initials-pins on the map updating in near real-time (<1s on Supabase Realtime)

If pins aren't updating:
- Check that `member_positions` table has Realtime enabled in Supabase
- Check browser console for Supabase connection errors
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly in Vercel

---

## 12. Feature-Specific Setup

### Receipt Scanner (Expenses page)
Requires `GEMINI_API_KEY` and `GOOGLE_PLACES_API_KEY` (for geocoding the merchant).

### Smart Route (Navigation)
Requires `MAPBOX_TOKEN` on both frontend (map rendering) and backend (`MAPBOX_TOKEN` for route optimization API).

### AI Chat Widget
Requires `ANTHROPIC_API_KEY` (Claude) or `GOOGLE_API_KEY` (Gemini) — see `backend/routers/ai_chat.py`.

### Credit Card Optimizer (Finance page)
No extra API keys needed. Users add their own cards via the Card Wallet in Finance settings. The recommendation engine runs entirely on your backend.

### Stripe Payments
1. Get your Stripe keys from [dashboard.stripe.com](https://dashboard.stripe.com)
2. For local webhook testing: `stripe listen --forward-to localhost:8000/billing/webhook`
3. In production, configure the webhook endpoint in Stripe dashboard → `https://your-api.onrender.com/billing/webhook`

---

## 13. Common Issues

| Problem | Fix |
|---------|-----|
| CORS error in browser console | Set `CORS_ORIGINS` in Render to match your Vercel URL exactly (no trailing slash) |
| 401 Unauthorized on all API calls | JWT secret mismatch — `JWT_SECRET_KEY` must be the same key the token was signed with |
| Map doesn't load | Check `VITE_MAPBOX_TOKEN` is set and the token isn't rate-limited |
| Photos fail to upload | Check `trip-media` Supabase Storage bucket exists and is public |
| Location pins don't update | Check `member_positions` Realtime is enabled in Supabase |
| "Failed to create checklist" | Run migration 021 — the `trip_todos` and `media_comments` tables may not exist yet |
| Render cold start (slow first load) | Free tier behavior — use UptimeRobot to ping `/` every 10 min |
| OTP emails not sending | Check Gmail App Password (not regular password) and that 2FA is enabled on the Gmail account |
