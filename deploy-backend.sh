#!/usr/bin/env bash
# deploy-backend.sh
# Deploys the TravelerHub backend (FastAPI in Docker) to the Hetzner server.
# Run from inside TravelerHub folder in Git Bash:
#   bash deploy-backend.sh
#
# Prerequisites (one-time, see TravelerHub/SETUP.md):
#   1. Supabase project created and migrations run
#   2. /opt/travelhub/.env file on server with all your secrets
#   3. SSL cert issued for travelhub-api.fozhan.dev

set -euo pipefail

# === Settings ============================================================
KEY="$HOME/my-hub"
SERVER="root@195.201.39.214"
SERVER_DIR="/opt/travelhub"
# =========================================================================

echo ""
echo "==> [1/6] Sanity check: am I in the TravelerHub folder?"
if [ ! -d "backend" ] || [ ! -f "docker-compose.prod.yml" ]; then
  echo "    X  backend/ or docker-compose.prod.yml missing. Run from TravelerHub root."
  exit 1
fi
echo "    OK"

echo ""
echo "==> [2/6] Check the server has /opt/travelhub/.env"
HAS_ENV=$(ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" "test -f /opt/travelhub/.env && echo yes || echo no")
if [ "$HAS_ENV" != "yes" ]; then
  echo "    X  /opt/travelhub/.env is missing on the server."
  echo "    Copy your secrets there first. See deploy-backend instructions."
  exit 1
fi
echo "    OK"

echo ""
echo "==> [3/6] Make sure server has $SERVER_DIR/repo and Docker"
ssh -i "$KEY" "$SERVER" "command -v docker >/dev/null 2>&1 || { echo 'Docker not installed on server'; exit 1; }; mkdir -p '$SERVER_DIR/repo'"
echo "    OK"

echo ""
echo "==> [4/6] Uploading backend source via tar over SSH..."
tar --exclude='./backend/__pycache__' \
    --exclude='./backend/venv' \
    --exclude='./backend/.env' \
    --exclude='./backend/tests/__pycache__' \
    -czf - backend docker-compose.prod.yml | \
  ssh -i "$KEY" "$SERVER" "tar -xzf - -C '$SERVER_DIR/repo'"
echo "    OK"

echo ""
echo "==> [5/6] Building & starting docker container on server..."
ssh -i "$KEY" "$SERVER" "cd '$SERVER_DIR/repo' && docker compose -f docker-compose.prod.yml up -d --build"
echo "    OK"

echo ""
echo "==> [6/6] Verifying backend is up..."
sleep 5
RESULT=$(ssh -i "$KEY" "$SERVER" "curl -k -o /dev/null -sw '%{http_code}' http://127.0.0.1:8001/health 2>/dev/null || curl -k -o /dev/null -sw '%{http_code}' http://127.0.0.1:8001/ 2>/dev/null")
echo "    Backend HTTP status (local 127.0.0.1:8001): $RESULT"

API_RESULT=$(ssh -i "$KEY" "$SERVER" "curl -k -o /dev/null -sw '%{http_code}' -H 'Host: travelhub-api.fozhan.dev' https://127.0.0.1/ 2>/dev/null")
echo "    API HTTP status (travelhub-api.fozhan.dev): $API_RESULT"

echo ""
if [ "$RESULT" = "200" ] || [ "$RESULT" = "404" ] || [ "$RESULT" = "405" ]; then
  echo "================================================================="
  echo "  SUCCESS  Backend container is responding."
  echo "  If api status is not 200/404, check nginx config + SSL cert."
  echo "  Logs: ssh -i ~/my-hub root@195.201.39.214 'docker logs travelhub-backend'"
  echo "================================================================="
else
  echo "================================================================="
  echo "  WARNING  Backend not responding. Check container logs:"
  echo "  ssh -i ~/my-hub root@195.201.39.214 'docker logs travelhub-backend'"
  echo "================================================================="
fi
