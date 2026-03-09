#!/bin/bash
# Install local network discovery configs (nginx + avahi mDNS)
# Run as root or with sudo from the repo root.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INFRA="$REPO_DIR/infra"

echo "Installing nginx site config..."
cp "$INFRA/nginx/tv-dashboards" /etc/nginx/sites-available/tv-dashboards
ln -sf /etc/nginx/sites-available/tv-dashboards /etc/nginx/sites-enabled/tv-dashboards
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable --now nginx && systemctl reload nginx

echo "Installing avahi mDNS service announcement..."
cp "$INFRA/avahi/tv-dashboards.service" /etc/avahi/services/tv-dashboards.service

echo "Installing avahi-publish-tv systemd service..."
cp "$INFRA/bin/avahi-publish-tv" /usr/local/bin/avahi-publish-tv
chmod +x /usr/local/bin/avahi-publish-tv
cp "$INFRA/systemd/avahi-publish-tv.service" /etc/systemd/system/avahi-publish-tv.service
systemctl daemon-reload
systemctl enable --now avahi-publish-tv

echo ""
echo "Done. The TV dashboard is now accessible at:"
echo "  http://tv.local"
echo "  http://tv.madhive.local"
