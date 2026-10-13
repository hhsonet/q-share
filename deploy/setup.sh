#!/usr/bin/env bash
# One-time VM setup.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "run with sudo" >&2; exit 1; }

# Usage: sudo bash deploy/setup.sh   (optional: NGINX_PORT=<port> sudo -E bash deploy/setup.sh)
DEPLOY_USER="${SUDO_USER:?run via sudo from the deploy user}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_PORT="${NGINX_PORT:-80}"

echo "==> Stopping dev servers"
fuser -k 4000/tcp 5173/tcp 2>/dev/null || true

echo "==> Production .env settings"
sed -i 's/^NODE_ENV=.*/NODE_ENV=production/; s/^HOST=.*/HOST=127.0.0.1/; s/^TRUST_PROXY=.*/TRUST_PROXY=true/' "$APP_DIR/server/.env"

echo "==> Initial build"
sudo -u "$DEPLOY_USER" bash -c "cd $APP_DIR/client && npm ci && npm run build && cd ../server && npm ci --omit=dev"

echo "==> systemd service"
sed "s#__DEPLOY_USER__#$DEPLOY_USER#; s#__APP_DIR__#$APP_DIR#" "$APP_DIR/deploy/quickshare.service" > /etc/systemd/system/quickshare.service
systemctl daemon-reload
systemctl enable --now quickshare

echo "==> nginx (port $NGINX_PORT)"
sed "s#__NGINX_PORT__#$NGINX_PORT#" "$APP_DIR/deploy/nginx-quickshare.conf" > /etc/nginx/sites-available/quickshare
ln -sf /etc/nginx/sites-available/quickshare /etc/nginx/sites-enabled/quickshare
nginx -t && systemctl reload nginx

echo "==> Allow passwordless restart for deploys"
echo "$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart quickshare, /usr/bin/journalctl -u quickshare -n 30 --no-pager" > /etc/sudoers.d/quickshare
chmod 440 /etc/sudoers.d/quickshare
visudo -cf /etc/sudoers.d/quickshare

echo "Done. App: http://$(hostname -I | awk '{print $1}'):$NGINX_PORT"
