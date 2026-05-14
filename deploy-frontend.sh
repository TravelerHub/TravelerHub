#!/usr/bin/env bash
# deploy-frontend.sh
# Deploys the TravelerHub frontend to travelhub.fozhan.dev
# Run from inside TravelerHub folder in Git Bash:
#   bash deploy-frontend.sh

set -euo pipefail

# === Settings ============================================================
KEY="$HOME/my-hub"
SERVER="root@195.201.39.214"
DEST="/var/www/travelhub.fozhan.dev"
BUILD_DIR="frontend/dist"
# =========================================================================

echo ""
echo "==> [1/6] Sanity check: am I in the TravelerHub folder?"
if [ ! -d "frontend" ] || [ ! -f "frontend/package.json" ]; then
  echo "    X  frontend/package.json missing. cd into TravelerHub root first."
  exit 1
fi
echo "    OK"

echo ""
echo "==> [2/6] Building frontend (npm run build in frontend/)"
echo "    First time? This installs deps too. Could take 1-2 minutes."
( cd frontend && npm install --silent && npm run build )
if [ ! -d "$BUILD_DIR" ]; then
  echo "    X  Build did not produce $BUILD_DIR. Check npm output."
  exit 1
fi
SIZE=$(du -sb "$BUILD_DIR" 2>/dev/null | cut -f1)
echo "    Built. dist size: $SIZE bytes"
if [ "$SIZE" -lt 50000 ]; then
  echo "    X  Build dist is suspiciously small. Refusing to deploy."
  exit 1
fi

echo ""
echo "==> [3/6] Make sure destination exists on server"
ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" "mkdir -p '$DEST'"
echo "    OK"

echo ""
echo "==> [4/6] Uploading dist via tar over SSH (one connection)..."
( cd "$BUILD_DIR" && tar -czf - . ) | \
  ssh -i "$KEY" "$SERVER" "tar -xzf - -C '$DEST'"
echo "    OK"

echo ""
echo "==> [5/6] Fix ownership and reload nginx"
ssh -i "$KEY" "$SERVER" "chown -R www-data:www-data '$DEST' && systemctl reload nginx"
echo "    OK"

echo ""
echo "==> [6/6] Verifying the site is live..."
RESULT=$(ssh -i "$KEY" "$SERVER" "curl -k -o /dev/null -sw '%{http_code}' -H 'Host: travelhub.fozhan.dev' https://127.0.0.1/")
echo "    HTTP status: $RESULT"

echo ""
if [ "$RESULT" = "200" ]; then
  echo "================================================================="
  echo "  SUCCESS  travelhub.fozhan.dev is up. Hard refresh in browser."
  echo "  NOTE: backend API calls will fail until backend is deployed."
  echo "  See TravelerHub/SETUP.md for the full backend setup walkthrough."
  echo "================================================================="
else
  echo "================================================================="
  echo "  WARNING  Got HTTP $RESULT instead of 200."
  echo "  Tell Claude: 'travelhub deploy returned $RESULT'."
  echo "================================================================="
fi
