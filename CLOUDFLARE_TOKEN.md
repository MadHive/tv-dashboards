# Cloudflare API Token Setup for Let's Encrypt

## Quick Steps

1. **Go to Cloudflare API Tokens page:**
   https://dash.cloudflare.com/profile/api-tokens

2. **Create a new token:**
   - Click **"Create Token"**
   - Use template: **"Edit zone DNS"**

3. **Configure permissions:**
   ```
   Permissions:
   - Zone / DNS / Edit

   Zone Resources:
   - Include / Specific zone / madhive.dev
   ```

4. **Create and copy token:**
   - Click **"Continue to summary"**
   - Click **"Create Token"**
   - **Copy the token** (you won't see it again!)

5. **Run the setup script:**
   ```bash
   sudo bash setup-https-cloudflare.sh
   ```
   Paste the token when prompted.

---

## Detailed Configuration

### Minimal Permissions (Recommended)
```
Permissions:
├─ Zone
│  └─ DNS
│     └─ Edit

Zone Resources:
├─ Include
│  └─ Specific zone
│     └─ madhive.dev

Account Resources:
└─ (None needed)

Client IP Address Filtering:
└─ (Optional: restrict to your server IP)

TTL:
└─ (Leave default or set expiration)
```

### Token Example
After creation, you'll get a token like:
```
abc123xyz789_EXAMPLE_TOKEN_DO_NOT_SHARE
```

**⚠️ IMPORTANT:**
- Keep this token secret (like a password)
- Store securely (password manager, vault)
- The setup script saves it to `/root/.cloudflare.ini` with 600 permissions
- Don't commit it to git

---

## Verification

After running the setup script, verify:

```bash
# Check certificate exists
sudo certbot certificates

# Test renewal
sudo certbot renew --dry-run

# Check nginx is using HTTPS
sudo nginx -t
curl -I https://tv.madhive.dev

# Check auto-renewal timer
sudo systemctl status certbot.timer
```

---

## Troubleshooting

### "Invalid token" error
- Verify the token has DNS edit permissions
- Check it's for the correct zone (madhive.dev)
- Regenerate token if needed

### DNS propagation timeout
- Cloudflare is usually fast (30-60 seconds)
- Script uses 30s propagation delay
- If fails, try manual verification:
  ```bash
  dig TXT _acme-challenge.tv.madhive.dev +short
  ```

### Certificate not created
- Check certbot logs: `/var/log/letsencrypt/letsencrypt.log`
- Verify DNS zone contains tv.madhive.dev record
- Try manual certbot command with `--debug` flag

---

## Renewal

Certificates auto-renew via systemd timer. Check with:
```bash
sudo systemctl list-timers certbot
```

Manual renewal:
```bash
sudo certbot renew
```

The Cloudflare token is saved and will be used for future renewals automatically.
