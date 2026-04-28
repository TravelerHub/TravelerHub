#!/bin/bash
# One-time setup script for a TravelerHub VPS.
# Run as root on a fresh Ubuntu 22.04 server.
#
# Required env vars (set inline or in your shell):
#   DOMAIN      — frontend hostname,    e.g. travelhub.example.com
#   API_DOMAIN  — backend hostname,     e.g. api.travelhub.example.com
#   ADMIN_EMAIL — Let's Encrypt contact email
#
# Optional:
#   REPO        — git URL to clone (default: TravelerHub upstream)
#   APP_DIR     — install path     (default: /opt/travelhub)
#
# Usage:
#   DOMAIN=foo.example.com API_DOMAIN=api.foo.example.com \
#   ADMIN_EMAIL=ops@example.com bash server-setup.sh

set -euo pipefail

: "${DOMAIN:?Set DOMAIN to your frontend hostname}"
: "${API_DOMAIN:?Set API_DOMAIN to your backend hostname}"
: "${ADMIN_EMAIL:?Set ADMIN_EMAIL for Let's Encrypt}"

REPO="${REPO:-https://github.com/TravelerHub/TravelerHub}"
APP_DIR="${APP_DIR:-/opt/travelhub}"

echo "==> Installing dependencies..."
apt update && apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git curl gettext-base

echo "==> Enabling Docker..."
systemctl enable --now docker

echo "==> Cloning repo..."
git clone "$REPO" "$APP_DIR"

echo ""
echo "================================================================"
echo " ACTION REQUIRED: Create your .env file before continuing."
echo ""
echo "   cp $APP_DIR/.env.server.example $APP_DIR/.env"
echo "   nano $APP_DIR/.env"
echo ""
echo " Fill in every value. Key ones:"
echo "   VITE_API_URL=https://$API_DOMAIN"
echo "   FRONTEND_URL=https://$DOMAIN"
echo "   CORS_ORIGINS=https://$DOMAIN"
echo "   VITE_SUPABASE_ANON_KEY — use the eyJhbG... key, not sb_secret_"
echo "   VAPID keys — run: cd $APP_DIR/backend && python generate_vapid_keys.py"
echo ""
echo " Press Enter when done..."
echo "================================================================"
read -r

echo "==> Starting Docker containers..."
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml up --build -d

echo "==> Rendering nginx config from template..."
mkdir -p "/var/www/$DOMAIN"
export DOMAIN API_DOMAIN
envsubst '$DOMAIN $API_DOMAIN' < "$APP_DIR/nginx/travelhub.conf.template" \
  > /etc/nginx/sites-available/travelhub
ln -sf /etc/nginx/sites-available/travelhub /etc/nginx/sites-enabled/travelhub
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "================================================================"
echo " ACTION REQUIRED: Point DNS before running certbot."
echo ""
echo " In your DNS provider, add two A records pointing to this IP:"
echo "   $DOMAIN      → $(curl -s ifconfig.me)"
echo "   $API_DOMAIN  → $(curl -s ifconfig.me)"
echo ""
echo " DNS changes can take a few minutes to propagate."
echo " Press Enter when DNS is ready..."
echo "================================================================"
read -r

echo "==> Obtaining SSL certificates..."
certbot --nginx -d "$DOMAIN" -d "$API_DOMAIN" \
  --non-interactive --agree-tos -m "$ADMIN_EMAIL"

echo "==> Reloading nginx with SSL..."
systemctl reload nginx

echo ""
echo "================================================================"
echo " Setup complete!"
echo "   Frontend: https://$DOMAIN"
echo "   Backend:  https://$API_DOMAIN/health"
echo "================================================================"
