#!/bin/bash
# Update dashboard to use HTTPS after certificate is obtained

set -e

echo "Updating dashboard configuration to use HTTPS..."

# Update .env
sed -i 's|http://tv.madhive.dev:3000/auth/google/callback|https://tv.madhive.dev/auth/google/callback|g' /home/tech/dev-dashboards/.env

echo "✓ Updated .env with HTTPS callback URL"

# Restart dashboard
pkill -f "server/index.js" || true
sleep 1

cd /home/tech/dev-dashboards
nohup bun run start > /tmp/dashboard.log 2>&1 &

sleep 2

echo "✓ Dashboard restarted"
echo ""
echo "Next step: Update Google Cloud Console OAuth settings"
echo "Add: https://tv.madhive.dev/auth/google/callback"
echo ""
echo "Test: https://tv.madhive.dev"
