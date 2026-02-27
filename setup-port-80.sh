#!/bin/bash
# Port forwarding: redirect port 80 to 3000

echo "Setting up port forwarding: 80 -> 3000"

# Add iptables rules
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000
sudo iptables -t nat -A OUTPUT -p tcp --dport 80 -j REDIRECT --to-port 3000

# Verify rules
echo ""
echo "Current iptables NAT rules:"
sudo iptables -t nat -L -n -v | grep 3000

echo ""
echo "✓ Port 80 is now forwarded to port 3000"
echo "  Access dashboard at: http://10.10.8.79"
