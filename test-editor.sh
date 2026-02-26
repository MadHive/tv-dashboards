#!/bin/bash
# ===========================================================================
# Editor Verification Script
# ===========================================================================

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║         WYSIWYG Dashboard Editor - Verification Test            ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

check() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $1"
    ((pass_count++))
  else
    echo -e "${RED}✗${NC} $1"
    ((fail_count++))
  fi
}

# 1. Server Status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Server Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s http://localhost:3000 > /dev/null 2>&1
check "Server responding on port 3000"

# 2. Frontend Assets
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Frontend Assets"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -s http://localhost:3000/js/editor.js | head -1 | grep -q "Dashboard Editor"
check "editor.js loaded"

curl -s http://localhost:3000/js/editor-panel.js | head -1 | grep -q "Property Panel"
check "editor-panel.js loaded"

curl -s http://localhost:3000/js/editor-utils.js | head -1 | grep -q "Editor Utilities"
check "editor-utils.js loaded"

curl -s http://localhost:3000/js/editor-drag.js | head -1 | grep -q "Drag Controller"
check "editor-drag.js loaded"

curl -s http://localhost:3000/js/editor-resize.js | head -1 | grep -q "Resize Controller"
check "editor-resize.js loaded"

curl -s http://localhost:3000/css/editor.css | head -1 | grep -q "Editor Styles"
check "editor.css loaded"

# 3. API Endpoints
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. API Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -s http://localhost:3000/api/config | jq -e '.dashboards' > /dev/null 2>&1
check "GET /api/config"

curl -s http://localhost:3000/api/backups | jq -e '.success' > /dev/null 2>&1
check "GET /api/backups"

curl -s http://localhost:3000/api/data-sources | jq -e '.sources' > /dev/null 2>&1
check "GET /api/data-sources"

curl -s http://localhost:3000/api/data-sources/schemas | jq -e '.schemas' > /dev/null 2>&1
check "GET /api/data-sources/schemas"

curl -s http://localhost:3000/api/data-sources/health | jq -e '.health' > /dev/null 2>&1
check "GET /api/data-sources/health"

# 4. Data Sources
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Data Sources"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

total_sources=$(curl -s http://localhost:3000/api/data-sources | jq '.sources | length')
echo "   Total registered: $total_sources"

ready_sources=$(curl -s http://localhost:3000/api/data-sources | jq '[.sources[] | select(.isReady == true)] | length')
echo "   Ready sources: $ready_sources"

curl -s http://localhost:3000/api/data-sources | jq -r '.sources[] | select(.isReady == true) | "   • \(.name)"'

# 5. HTML Structure
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. HTML Structure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -s http://localhost:3000 | grep -q "editor-toggle"
check "Editor toggle button present"

curl -s http://localhost:3000 | grep -q "editor-action-bar"
check "Editor action bar present"

curl -s http://localhost:3000 | grep -q "editor-save"
check "Save button present"

curl -s http://localhost:3000 | grep -q "editor-discard"
check "Discard button present"

# 6. Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}Passed: $pass_count${NC}"
echo -e "${RED}Failed: $fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Next Steps: Open your browser"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "1. Navigate to: http://localhost:3000"
  echo "2. Press: Ctrl+E (to enter edit mode)"
  echo "3. Click any widget to select it"
  echo "4. Try dragging the widget to a new position"
  echo "5. Try resizing using the handles"
  echo "6. Edit properties in the right panel"
  echo "7. Click 'Save Changes' to persist"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Some checks failed${NC}"
  exit 1
fi
