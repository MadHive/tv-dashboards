#!/bin/bash
# Run HTTPS setup with pre-configured Cloudflare credentials

set -e

echo "=== MadHive Dashboard - HTTPS Setup ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo bash run-https-setup.sh"
    exit 1
fi

# Install certbot with Cloudflare plugin
echo "Installing certbot and Cloudflare plugin..."
apt update -qq
apt install -y certbot python3-certbot-dns-cloudflare

# Copy credentials to root
cp /home/tech/.cloudflare.ini /root/.cloudflare.ini
chmod 600 /root/.cloudflare.ini

# Obtain SSL certificate
echo ""
echo "Obtaining SSL certificate for tv.madhive.dev..."
certbot certonly \
    --dns-cloudflare \
    --dns-cloudflare-credentials /root/.cloudflare.ini \
    --dns-cloudflare-propagation-seconds 30 \
    -d tv.madhive.dev \
    --non-interactive \
    --agree-tos \
    --email tech@madhive.com

if [ ! -f /etc/letsencrypt/live/tv.madhive.dev/fullchain.pem ]; then
    echo "ERROR: Certificate was not created. Check errors above."
    exit 1
fi

echo "✓ SSL certificate obtained successfully"

# Configure nginx
echo ""
echo "Configuring nginx for HTTPS..."

# Install nginx config
cp /home/tech/dev-dashboards/nginx-dashboard-ssl.conf /etc/nginx/sites-available/dashboard-ssl

# Enable SSL config, disable old HTTP-only config
ln -sf /etc/nginx/sites-available/dashboard-ssl /etc/nginx/sites-enabled/dashboard-ssl
rm -f /etc/nginx/sites-enabled/dashboard

# Test nginx config
if ! nginx -t; then
    echo "ERROR: Nginx configuration test failed"
    exit 1
fi

# Reload nginx
systemctl reload nginx
echo "✓ Nginx configured and reloaded"

# Update dashboard configuration
echo ""
echo "Updating dashboard to use HTTPS..."

# Update .env file
sed -i 's|http://tv.madhive.dev:3000/auth/google/callback|https://tv.madhive.dev/auth/google/callback|g' /home/tech/dev-dashboards/.env
sed -i 's|http://tv.madhive.dev/auth/google/callback|https://tv.madhive.dev/auth/google/callback|g' /home/tech/dev-dashboards/.env

echo "✓ Updated OAuth callback URL to HTTPS"

# Restart dashboard as tech user
echo ""
echo "Restarting dashboard server..."
sudo -u tech bash -c "pkill -f 'server/index.js' || true"
sleep 2
sudo -u tech bash -c "cd /home/tech/dev-dashboards && nohup bun run start > /tmp/dashboard.log 2>&1 &"
sleep 3

# Verify dashboard is running
if pgrep -f "server/index.js" > /dev/null; then
    echo "✓ Dashboard server restarted"
else
    echo "⚠ Warning: Dashboard may not have started. Check /tmp/dashboard.log"
fi

# Test certificate renewal
echo ""
echo "Testing auto-renewal configuration..."
certbot renew --dry-run --quiet && echo "✓ Auto-renewal configured successfully"

echo ""
echo "=== ✅ HTTPS Setup Complete! ==="
echo ""
echo "Certificate details:"
certbot certificates -d tv.madhive.dev 2>/dev/null || echo "Certificate installed"
echo ""
echo "Dashboard URL: https://tv.madhive.dev"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  IMPORTANT: Update Google Cloud Console"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Go to: https://console.cloud.google.com/apis/credentials"
echo "2. Edit OAuth client: 603316736725-bof64iok1dd9ie9j2uompktr6t1ct6nd"
echo "3. Add to 'Authorized redirect URIs':"
echo "   https://tv.madhive.dev/auth/google/callback"
echo "4. Save changes"
echo ""
echo "Then test: https://tv.madhive.dev"
echo ""
