#!/bin/bash
# One-time setup for TravelerHub on the Hetzner VPS.
# Run this ONCE as root after the server is provisioned.
# Assumes Docker, nginx, and certbot are already installed
# (they were set up for fozhan.dev — if not, see Portfolio deploy notes).

set -e

echo "=== TravelerHub server setup ==="

# ── 1. Create directories ─────────────────────────────────────────────────────
mkdir -p /var/www/travelhub.fozhan.dev
mkdir -p /opt/travelhub/backend

echo "Directories created."

# ── 2. Install nginx config ───────────────────────────────────────────────────
# (Run this after uploading the config from your machine)
#
#   scp deploy/nginx-travelhub.conf root@195.201.39.214:/etc/nginx/sites-available/travelhub
#
# Then:
ln -sf /etc/nginx/sites-available/travelhub /etc/nginx/sites-enabled/travelhub
nginx -t && systemctl reload nginx

echo "nginx config linked and reloaded."

# ── 3. Get SSL certificates ───────────────────────────────────────────────────
# IMPORTANT: Cloudflare must be set to DNS-only (grey cloud) for both
#   travelhub.fozhan.dev and travelhub-api.fozhan.dev before running certbot.
# Re-enable orange cloud after certs are issued.
certbot --nginx \
  -d travelhub.fozhan.dev \
  -d travelhub-api.fozhan.dev \
  --non-interactive \
  --agree-tos \
  -m foojanbabaeeian@gmail.com

echo "SSL certificates issued."

# ── 4. Create the backend .env on the server ──────────────────────────────────
# Copy .env.server.example from the repo and fill in real values:
#
#   scp .env.server.example root@195.201.39.214:/opt/travelhub/.env
#   ssh root@195.201.39.214 nano /opt/travelhub/.env
#
# Make sure CORS_ORIGINS includes: https://travelhub.fozhan.dev

echo ""
echo "=== TODO: manually fill /opt/travelhub/.env with real secrets ==="
echo "    scp .env.server.example root@195.201.39.214:/opt/travelhub/.env"
echo "    ssh root@195.201.39.214 nano /opt/travelhub/.env"
echo ""

# ── 5. Add SERVER_SSH_KEY secret to TravelerHub GitHub repo ───────────────────
# The secret is the SAME key already used for the Portfolio repo.
# In GitHub → TravelerHub repo → Settings → Secrets → Actions:
#   SERVER_SSH_KEY = (contents of C:\Users\fooja\travelhub_deploy)
#   SERVER_IP      = 195.201.39.214

echo "=== All done. Push to main to trigger the first deploy. ==="
