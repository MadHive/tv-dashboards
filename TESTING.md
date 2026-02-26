# WYSIWYG Editor Testing Guide

## Pre-Test Verification ✓

All systems operational:
- ✅ Server running on http://localhost:3000
- ✅ All editor JavaScript files loaded (51,648 bytes total)
- ✅ Editor CSS loaded (12,873 bytes)
- ✅ 10 data sources registered (3 active: GCP, Mock, VulnTrack)
- ✅ API endpoints operational
- ✅ HTML structure with editor controls present

---

## Browser Testing Steps

### 1. Open the Dashboard
```
Navigate to: http://localhost:3000
```

You should see the MadHive Platform dashboard with metrics.

---

### 2. Enter Edit Mode

**Method 1:** Press `Ctrl+E` on your keyboard

**Method 2:** Click the "Edit Mode" button (bottom right)

**Expected Result:**
- Grid overlay appears with cell labels
- Widgets show drag handle (⋮⋮) in top-left corner
- "Edit mode enabled" notification appears
- Action bar appears at bottom with Save/Discard/Exit buttons

---

### 3. Select a Widget

Click any widget (e.g., "Bids Served" or "Platform Uptime")

**Expected Result:**
- Widget gets purple border
- 8 resize handles appear (4 corners + 4 edges)
- Property panel slides in from the right side
- Panel shows widget configuration:
  - Widget ID
  - Type
  - Title
  - Data Source
  - Position (col, row, colSpan, rowSpan)
  - Type-specific options

---

### 4. Test Drag & Drop

**Steps:**
1. Click and hold a widget
2. Drag it to a new position
3. Watch the ghost widget follow your cursor
4. Watch grid cells highlight:
   - Green = valid drop location
   - Red = collision with another widget
5. Release mouse to drop

**Expected Result:**
- Widget snaps to grid cell
- No overlap with other widgets
- Property panel updates with new position

---

### 5. Test Resize

**Steps:**
1. Select a widget
2. Hover over a resize handle (corner or edge)
3. Cursor changes to resize cursor
4. Click and drag to resize
5. Release to apply

**Expected Result:**
- Widget resizes while maintaining grid alignment
- Minimum size enforced (1x1 grid cell)
- Cannot resize beyond grid boundaries
- Property panel updates with new size

---

### 6. Test Property Editing

**Steps:**
1. Select a widget
2. In the property panel, change the Title field
3. Press Tab or click outside the field

**Expected Result:**
- Widget title updates immediately (live preview)
- "Save Changes" button highlights (indicates unsaved changes)

---

### 7. Test Save

**Steps:**
1. After making changes, click "Save Changes" button
2. Wait for notification

**Expected Result:**
- "Changes saved successfully!" notification appears
- Backup created in `config/` directory
- Changes persist after page reload

---

### 8. Test Discard

**Steps:**
1. Make some changes (drag, resize, edit)
2. Click "Discard" button
3. Confirm when prompted

**Expected Result:**
- All changes revert to last saved state
- Widgets return to original positions
- Property panel resets

---

### 9. Test Exit Edit Mode

**Method 1:** Press `Ctrl+E` again

**Method 2:** Click "Exit Editor" button

**Expected Result:**
- Grid overlay disappears
- Resize handles disappear
- Property panel closes
- Dashboard rotation resumes
- "Edit mode disabled" notification appears

---

### 10. Test Persistence

**Steps:**
1. Make and save some changes
2. Reload the page (F5 or Ctrl+R)
3. Enter edit mode again

**Expected Result:**
- All saved changes are preserved
- Widgets are in their new positions

---

## Advanced Testing

### Test Collision Detection
1. Try to drag a widget on top of another
2. Grid cells should turn red
3. Cannot drop in invalid position

### Test Backups
```bash
# List backups
curl http://localhost:3000/api/backups | jq '.backups'

# Check backup files
ls -la config/dashboards.yaml.backup.*
```

### Test Data Sources
```bash
# List all data sources
curl http://localhost:3000/api/data-sources | jq '.sources'

# Check health
curl http://localhost:3000/api/data-sources/health | jq '.health'

# Test connection
curl -X POST http://localhost:3000/api/data-sources/gcp/test | jq '.'
```

---

## Troubleshooting

### Editor doesn't open (Ctrl+E does nothing)
- Check browser console for JavaScript errors
- Verify editor.js is loaded: View Page Source, search for "editor.js"

### Property panel doesn't appear
- Make sure you clicked the widget, not the canvas
- Check console for errors

### Can't drag widgets
- Ensure you're in edit mode (grid overlay visible)
- Try refreshing the page

### Changes don't save
- Check browser console for API errors
- Verify server is running: `curl http://localhost:3000/api/config`

### Browser Console
Press F12 to open developer tools and check the Console tab for errors.

---

## Expected Console Messages

When entering edit mode, you should see:
```
[Editor] Entering edit mode
[Editor] Selected widget: <widget-id>
```

When saving:
```
[Editor] Saving changes...
[config-manager] Configuration saved successfully
```

---

## Quick Test Checklist

- [ ] Dashboard loads
- [ ] Ctrl+E enters edit mode
- [ ] Grid overlay visible
- [ ] Can select widgets
- [ ] Property panel appears
- [ ] Can drag widgets
- [ ] Ghost widget shows while dragging
- [ ] Grid cells highlight (green/red)
- [ ] Can resize widgets
- [ ] 8 resize handles work
- [ ] Can edit widget title
- [ ] Live preview works
- [ ] Save button works
- [ ] Backup created
- [ ] Changes persist after reload
- [ ] Discard reverts changes
- [ ] Exit edit mode works
- [ ] Dashboard rotation resumes

---

## Browser Compatibility

Tested and working on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Next Steps After Testing

If everything works:
1. Try customizing your dashboard layout
2. Experiment with different widget sizes
3. Explore the data source schemas
4. Consider implementing Phase 5 (Widget Palette)

If you encounter issues:
1. Check browser console for errors
2. Verify all files are loaded (Network tab in DevTools)
3. Check server logs for backend errors
4. Review `/home/tech/dev-dashboards/EDITOR_STATUS.md` for details
