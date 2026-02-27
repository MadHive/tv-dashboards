#!/bin/bash
# Setup HTTPS with Let's Encrypt for tv.madhive.dev

set -e

echo "=== Setting up HTTPS for MadHive Dashboard ==="

# Install certbot
echo "Installing certbot..."
apt update
apt install -y certbot python3-certbot-nginx

# Check DNS provider
echo ""
echo "For DNS-01 challenge (works with internal IPs), you'll need DNS provider API access."
echo "Common providers: cloudflare, route53, google, etc."
echo ""
echo "If tv.madhive.dev is publicly accessible, we can use HTTP-01 (simpler)."
echo ""
read -p "Is tv.madhive.dev publicly accessible on port 80? (y/n): " PUBLIC_ACCESS

if [ "$PUBLIC_ACCESS" = "y" ]; then
    echo ""
    echo "Using HTTP-01 challenge (automatic)..."
    certbot --nginx -d tv.madhive.dev --non-interactive --agree-tos --email tech@madhive.com
else
    echo ""
    echo "Using DNS-01 challenge (manual)..."
    echo "You'll need to add a TXT record to your DNS provider."
    certbot certonly --manual --preferred-challenges dns -d tv.madhive.dev --agree-tos --email tech@madhive.com

    # After getting cert, update nginx config
    echo ""
    echo "Certificate obtained! Updating nginx config..."
    cat > /etc/nginx/sites-available/dashboard-ssl << 'NGINX_CONFIG'
server {
    listen 80;
    listen [::]:80;
    server_name 10.10.8.79 tv.madhive.dev;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    server_name tv.madhive.dev;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/tv.madhive.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tv.madhive.dev/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy to dashboard running on port 3000
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
NGINX_CONFIG

    # Enable the new config
    ln -sf /etc/nginx/sites-available/dashboard-ssl /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/dashboard

    # Test and reload nginx
    nginx -t
    systemctl reload nginx
fi

echo ""
echo "=== HTTPS Setup Complete! ==="
echo ""
echo "Next steps:"
echo "1. Update /home/tech/dev-dashboards/.env:"
echo "   GOOGLE_REDIRECT_URI=https://tv.madhive.dev/auth/google/callback"
echo ""
echo "2. Update Google Cloud Console OAuth settings:"
echo "   Add: https://tv.madhive.dev/auth/google/callback"
echo ""
echo "3. Restart the dashboard server"
echo ""
echo "Certificate will auto-renew via systemd timer."
