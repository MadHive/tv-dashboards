#!/bin/bash
# Fix nginx configuration for tv.madhive.dev

echo "Removing HTTPS redirect config..."
sudo rm -f /etc/nginx/sites-enabled/dashboard-ssl

echo "Adding tv.madhive.dev to HTTP config..."
sudo sed -i 's/server_name 10.10.8.79 tv.madhive.local;/server_name 10.10.8.79 tv.madhive.local tv.madhive.dev;/' /etc/nginx/sites-available/tv-dashboards

echo "Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "Reloading nginx..."
    sudo systemctl reload nginx
    echo "✓ Nginx configuration updated successfully!"
else
    echo "✗ Nginx configuration test failed. Not reloading."
    exit 1
fi
