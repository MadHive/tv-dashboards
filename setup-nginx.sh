#!/bin/bash
# Setup nginx reverse proxy for TV Dashboards

set -e

echo "Setting up nginx reverse proxy..."

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "Installing nginx..."
    sudo apt update
    sudo apt install -y nginx
fi

# Copy config to nginx sites-available
sudo cp /home/tech/dev-dashboards/nginx-dashboard.conf /etc/nginx/sites-available/tv-dashboards

# Remove default site if it exists
sudo rm -f /etc/nginx/sites-enabled/default

# Enable the site
sudo ln -sf /etc/nginx/sites-available/tv-dashboards /etc/nginx/sites-enabled/tv-dashboards

# Test nginx config
echo "Testing nginx configuration..."
sudo nginx -t

# Restart nginx
echo "Restarting nginx..."
sudo systemctl restart nginx

# Enable nginx to start on boot
sudo systemctl enable nginx

# Check nginx status
sudo systemctl status nginx --no-pager

echo ""
echo "✓ Nginx configured and running"
echo "  Dashboard accessible at: http://10.10.8.79"
echo "  Backend running on: http://localhost:3000"
echo ""
echo "Useful commands:"
echo "  sudo systemctl restart nginx  - Restart nginx"
echo "  sudo systemctl stop nginx     - Stop nginx"
echo "  sudo systemctl start nginx    - Start nginx"
echo "  sudo systemctl status nginx   - Check nginx status"
echo "  sudo nginx -t                 - Test nginx config"
