# HTTPS Setup Guide for tv.madhive.dev

## Overview

This guide covers setting up HTTPS with Let's Encrypt for the MadHive Dashboard. Since `tv.madhive.dev` points to an internal IP (10.10.8.79), we have two options:

---

## Option 1: HTTP-01 Challenge (Easiest - if domain is publicly accessible)

**Requirements:**
- Port 80 must be publicly accessible from the internet
- Domain must resolve to a public IP (even temporarily)

**Steps:**
```bash
# Run the automated setup script
sudo bash setup-https.sh
# Select 'y' when asked if domain is publicly accessible
```

The script will:
1. Install certbot
2. Obtain SSL certificate automatically
3. Configure nginx for HTTPS
4. Set up auto-renewal

---

## Option 2: DNS-01 Challenge (Works with internal IPs)

**Requirements:**
- Access to DNS provider to add TXT records
- No public accessibility needed

### Step 1: Install Certbot
```bash
sudo apt update
sudo apt install -y certbot
```

### Step 2: Request Certificate (Manual DNS Challenge)
```bash
sudo certbot certonly --manual --preferred-challenges dns \
  -d tv.madhive.dev \
  --agree-tos \
  --email tech@madhive.com
```

Certbot will display something like:
```
Please deploy a DNS TXT record under the name:
_acme-challenge.tv.madhive.dev

with the following value:
abc123xyz789...

Press Enter to continue
```

### Step 3: Add DNS TXT Record
Go to your DNS provider (e.g., Cloudflare, Route53, Google Cloud DNS) and add:

```
Type: TXT
Name: _acme-challenge.tv.madhive.dev
Value: <value shown by certbot>
TTL: 300
```

### Step 4: Verify DNS Propagation
```bash
# Wait a minute, then verify
dig TXT _acme-challenge.tv.madhive.dev +short
```

### Step 5: Complete Certificate Issuance
Press Enter in the certbot terminal. Certificate will be saved to:
- `/etc/letsencrypt/live/tv.madhive.dev/fullchain.pem`
- `/etc/letsencrypt/live/tv.madhive.dev/privkey.pem`

### Step 6: Configure Nginx
```bash
# Copy the SSL config
sudo cp /home/tech/dev-dashboards/nginx-dashboard-ssl.conf /etc/nginx/sites-available/dashboard-ssl

# Enable it
sudo ln -sf /etc/nginx/sites-available/dashboard-ssl /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/dashboard

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## Option 3: DNS-01 with Automated DNS Plugin (Best for Production)

If your DNS provider has a certbot plugin, you can automate DNS-01:

### Cloudflare
```bash
sudo apt install python3-certbot-dns-cloudflare
echo "dns_cloudflare_api_token = YOUR_API_TOKEN" > ~/.cloudflare.ini
chmod 600 ~/.cloudflare.ini

sudo certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials ~/.cloudflare.ini \
  -d tv.madhive.dev
```

### Google Cloud DNS
```bash
sudo apt install python3-certbot-dns-google
sudo certbot certonly --dns-google \
  --dns-google-credentials /path/to/service-account.json \
  -d tv.madhive.dev
```

### AWS Route53
```bash
sudo apt install python3-certbot-dns-route53
sudo certbot certonly --dns-route53 -d tv.madhive.dev
```

---

## Post-Setup: Update OAuth Configuration

### 1. Update .env
```bash
# Edit /home/tech/dev-dashboards/.env
GOOGLE_REDIRECT_URI=https://tv.madhive.dev/auth/google/callback
```

### 2. Update Google Cloud Console
1. Go to https://console.cloud.google.com/apis/credentials
2. Edit OAuth client: `603316736725-bof64iok1dd9ie9j2uompktr6t1ct6nd`
3. Add to "Authorized redirect URIs": `https://tv.madhive.dev/auth/google/callback`
4. Remove HTTP version (optional): `http://tv.madhive.dev:3000/auth/google/callback`

### 3. Restart Dashboard
```bash
pkill -f "server/index.js"
cd /home/tech/dev-dashboards
bun run start &
```

---

## Certificate Auto-Renewal

Certbot installs a systemd timer for auto-renewal:
```bash
# Check renewal timer
sudo systemctl status certbot.timer

# Test renewal (dry-run)
sudo certbot renew --dry-run

# Manual renewal
sudo certbot renew
```

For DNS-01 manual challenge, you'll need to manually add TXT records every 90 days, OR use a DNS plugin for automation.

---

## Troubleshooting

### Certificate Not Found
```bash
# List certificates
sudo certbot certificates

# If missing, re-run certbot
```

### Nginx 502 Bad Gateway
```bash
# Check dashboard is running
ps aux | grep "server/index.js"

# Check logs
tail -f /tmp/dashboard.log
```

### HTTPS Redirect Loop
```bash
# Check proxy headers in nginx config
proxy_set_header X-Forwarded-Proto $scheme;
```

### DNS Propagation Issues
```bash
# Check DNS from multiple servers
dig @8.8.8.8 TXT _acme-challenge.tv.madhive.dev
dig @1.1.1.1 TXT _acme-challenge.tv.madhive.dev
```

---

## Security Notes

1. **HTTP to HTTPS Redirect**: Configured automatically
2. **HSTS Header**: Enforces HTTPS for 1 year
3. **TLS 1.2+**: Only modern TLS protocols allowed
4. **Strong Ciphers**: PFS-enabled cipher suites
5. **OCSP Stapling**: Improves SSL handshake performance

---

## Quick Reference

**Certificate Location:**
- `/etc/letsencrypt/live/tv.madhive.dev/fullchain.pem`
- `/etc/letsencrypt/live/tv.madhive.dev/privkey.pem`

**Nginx Config:**
- `/etc/nginx/sites-available/dashboard-ssl`
- `/etc/nginx/sites-enabled/dashboard-ssl`

**Renewal:**
- Auto: `systemctl status certbot.timer`
- Manual: `sudo certbot renew`

**Access:**
- Dashboard: https://tv.madhive.dev
- HTTP redirects to HTTPS automatically
