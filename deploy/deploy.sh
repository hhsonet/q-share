#!/usr/bin/env bash
# Runs on the VM (invoked over SSH by .github/workflows/deploy.yml).
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "==> Fetching origin/main"
git fetch --prune origin main
git reset --hard origin/main

echo "==> Building client"
(cd client && npm ci && npm run build)

echo "==> Installing server dependencies"
(cd server && npm ci --omit=dev)

echo "==> Running migrations"
(cd server && npm run migrate)

echo "==> Restarting service"
sudo -n /usr/bin/systemctl restart quickshare

echo "==> Health check"
for i in $(seq 1 15); do
  if curl -fsS http://127.0.0.1:4000/api/health >/dev/null; then
    echo "Deployed $(git rev-parse --short HEAD)"
    exit 0
  fi
  sleep 1
done
echo "Health check failed" >&2
sudo -n /usr/bin/journalctl -u quickshare -n 30 --no-pager >&2 || true
exit 1
