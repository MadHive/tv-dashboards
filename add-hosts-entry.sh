#!/bin/bash
# Add tv.madhive.dev to /etc/hosts

echo "Adding tv.madhive.dev to /etc/hosts..."
echo "10.10.8.79    tv.madhive.dev" | sudo tee -a /etc/hosts

echo ""
echo "✓ Done! Verifying entry:"
grep tv.madhive.dev /etc/hosts
