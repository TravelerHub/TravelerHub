# TravelerHub

Group travel platform with smart routing, ranked-choice voting, encrypted chat, and real-time collaboration.

---

## Local Development

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # fill in your keys
uvicorn main:app --reload
# → http://localhost:8000
```

The frontend Vite dev server proxies `/api` requests to the backend automatically — no extra config needed.

---

## Production Deployment (Hetzner VPS)

### Architecture

```
Internet
   │
   ▼
Host nginx (ports 80/443 — SSL via Let's Encrypt)
   ├── travelhub.fozhan.dev      → frontend container (React, built by Vite)
   └── api.travelhub.fozhan.dev  → backend container  (FastAPI)
```

### One-time server setup

**1. Add DNS records** — two A records pointing to your Hetzner IP:
```
travelhub.fozhan.dev     A  <your-hetzner-ip>
api.travelhub.fozhan.dev A  <your-hetzner-ip>
```

**2. SSH into the server and run the setup script:**
```bash
git clone https://github.com/TravelerHub/TravelerHub /opt/travelhub
bash /opt/travelhub/scripts/server-setup.sh
```

The script installs Docker, nginx, certbot, copies the nginx config, and obtains SSL certificates. It pauses at each step to let you fill in your `.env`.

**3. Create `/opt/travelhub/.env`** — copy from [`.env.server.example`](.env.server.example) and fill in every value. Key ones:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://api.travelhub.fozhan.dev` |
| `VITE_SUPABASE_ANON_KEY` | Use the `eyJhbG...` JWT key — **not** the `sb_secret_` service key |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Run `python backend/generate_vapid_keys.py` |
| `JWT_SECRET_KEY` | Run `openssl rand -hex 32` |

**4. Add GitHub Secrets** — repo → Settings → Secrets → Actions:
- `SERVER_IP` — your Hetzner server's public IP
- `SERVER_SSH_KEY` — private SSH key with root access to the server

### Auto-deploy

Pushing to `main` triggers GitHub Actions, which SSHs into the server, pulls the latest code, and runs `docker compose -f docker-compose.prod.yml up --build -d`.

---

## Environment Variables

| File | Used for |
|------|----------|
| `backend/.env` | Local backend dev |
| `frontend/.env` | Local frontend dev |
| `/opt/travelhub/.env` | Production server (all vars — backend + frontend build args) |
| `.env.server.example` | Template for the production `.env` |

---

## API Keys Required

| Key | Where to get |
|-----|-------------|
| `VITE_MAPBOX_TOKEN` | [mapbox.com](https://account.mapbox.com/auth/signup/) |
| `GOOGLE_PLACES_API_KEY` / `GOOGLE_API_KEY` | Google Cloud Console |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | [supabase.com/dashboard](https://supabase.com/dashboard) |
| `STRIPE_SECRET_KEY` | [stripe.com/docs/keys](https://stripe.com/docs/keys) |
| `SENDER_EMAIL` / `SENDER_PASSWORD` | Gmail App Password (requires 2FA) — [myaccount.google.com/security](https://myaccount.google.com/security) |
