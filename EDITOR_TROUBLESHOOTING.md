# Editor Troubleshooting Guide

## Current Issues

Based on your report: "I can't edit any of the pages, move things around, change visuals, add/change data sources"

## Step 1: Check if Editor Mode is Active

1. Open dashboard: `http://localhost:3000`
2. Click "Edit Mode" button (top-right) or press `Ctrl+E`
3. **Expected behavior:**
   - Button should turn red with a checkmark
   - Grid overlay should appear
   - Body should have class `editor-active`
   - Page rotation should stop
   - Widgets should have cursor: move

## Step 2: Check Browser Console for Errors

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for JavaScript errors (red text)
4. Common errors to check:
   - `Cannot read property '...' of undefined`
   - `... is not a function`
   - `Unexpected token`

## Step 3: Test Widget Selection

**Try this:**
1. Enter edit mode
2. Click on any widget
3. **Expected:**
   - Widget gets blue border (class="selected")
   - Property panel opens on right side
   - 8 resize handles appear on widget corners/edges
   - Console shows: `[Editor] Selected widget: widget-id`

**If nothing happens:**
- Check console for errors
- Verify widget has `data-widget-id` attribute
- Check if click event is being captured

## Step 4: Test Property Panel

**If property panel doesn't appear:**
1. Check if PropertyPanel class loaded:
   ```javascript
   // In browser console:
   console.log(window.PropertyPanel);  // Should not be undefined
   ```

2. Check if panel element exists:
   ```javascript
   document.querySelector('.property-panel');  // Should return element
   ```

3. Check panel display:
   ```javascript
   const panel = document.querySelector('.property-panel');
   console.log(panel.style.display);  // Should be 'flex' when widget selected
   ```

## Step 5: Test Drag and Drop

**Try this:**
1. Select a widget
2. Click and hold on widget
3. Drag mouse
4. **Expected:**
   - Ghost widget appears
   - Valid drop cells highlight green
   - Widget follows cursor
   - Console shows: `[Drag] Start dragging...`

**If drag doesn't work:**
- Check if `WidgetDragController` loaded
- Check console for drag-related errors
- Verify widget has `.editable` class

## Step 6: Test Property Changes

**Try this:**
1. Select a widget
2. In property panel, change the title
3. Click "Save Changes"
4. **Expected:**
   - Widget title updates immediately
   - Console shows: `[Editor] Updated widget config: ...`
   - Notification appears: "Widget updated"

**If changes don't apply:**
- Check if `updateWidgetConfig` method exists
- Check console for save errors
- Verify `this.selectedWidget` is not null

## Step 7: Test Data Source Changes

**Try this:**
1. Select a widget
2. Open property panel
3. Change "Source" dropdown to different value (e.g., vulntrack, aws)
4. Click "Save Changes"
5. **Expected:**
   - Source field updates in config
   - Widget config shows new source
   - Data may not refresh until page reload

**Current Limitation:**
- Changing data source in editor updates config only
- Widget doesn't re-fetch data until server restart or page reload
- This is a known limitation

## Step 8: Check Server API Endpoints

Test if save endpoint works:

```bash
# Get current config
curl http://localhost:3000/api/config | jq '.dashboards[0].widgets[0]'

# Test update endpoint (replace platform-overview with actual dashboard ID)
curl -X PUT http://localhost:3000/api/dashboards/platform-overview \
  -H "Content-Type: application/json" \
  -d '{
    "id": "platform-overview",
    "name": "Platform Overview",
    "widgets": [...]
  }'
```

## Common Issues & Fixes

### Issue 1: Editor button doesn't work in Chrome

**Symptom:** Click doesn't register on "Edit Mode" button

**Fix:** Already applied - added `pointer-events: auto !important` to button

**Test:**
```javascript
// In console:
const btn = document.getElementById('editor-toggle');
console.log(window.getComputedStyle(btn).pointerEvents);  // Should be 'auto'
```

### Issue 2: Can't switch between dashboard pages

**Symptom:** Navigation dots don't work in edit mode

**Current Behavior:** Page rotation stops in edit mode. You need to:
1. Exit edit mode (Ctrl+E)
2. Navigate to desired page (click dot or wait for rotation)
3. Re-enter edit mode (Ctrl+E)
4. Edit that page

**Potential Fix:** Allow manual page navigation in edit mode

### Issue 3: Property panel shows but changes don't save

**Possible causes:**
- `modifiedConfig` not initialized
- `updateWidgetConfig` not finding widget
- Backend API endpoint failing

**Debug:**
```javascript
// In console when widget is selected:
const editor = window.app.editor;
console.log('Has modified config:', editor.modifiedConfig !== null);
console.log('Selected widget:', editor.selectedWidget);
console.log('Current page:', editor.dashboardApp.currentPage);
```

### Issue 4: Drag and drop doesn't work

**Possible causes:**
- `WidgetDragController` not initialized
- Mouse events not attached
- CSS preventing drag

**Debug:**
```javascript
// Check if drag controller exists:
const editor = window.app.editor;
console.log('Drag controller:', editor.dragController);

// Check if widget has drag handlers:
const widget = document.querySelector('.widget');
console.log('Has editable class:', widget.classList.contains('editable'));
console.log('Cursor style:', window.getComputedStyle(widget).cursor);
```

### Issue 5: Can't add new widgets

**Symptom:** Widget palette doesn't appear or drag from palette doesn't work

**Check:**
1. Is palette visible? Look for left sidebar with widget icons
2. Does palette have widgets? Check `window.WidgetPalette`
3. Can you drag from palette to grid?

**Current Status:** Widget palette is implemented in `editor-palette.js`

## Manual Testing Checklist

Run through this checklist:

- [ ] Server is running on port 3000
- [ ] Dashboard loads at http://localhost:3000
- [ ] Edit Mode button is visible (top-right)
- [ ] Clicking Edit Mode toggles editor (button turns red)
- [ ] Grid overlay appears when in edit mode
- [ ] Widgets have "move" cursor in edit mode
- [ ] Clicking widget shows property panel
- [ ] Property panel shows all widget fields
- [ ] Changing title in panel updates widget live
- [ ] Clicking "Save Changes" persists updates
- [ ] Dragging widget shows ghost and highlights cells
- [ ] Dropping widget moves it to new position
- [ ] Resize handles appear on selected widget
- [ ] Dragging resize handle changes widget size
- [ ] Changes persist after page reload
- [ ] Can navigate between pages and edit each

## Getting More Info

If issues persist, collect this debug info:

```javascript
// Run in browser console:
const debug = {
  editorExists: window.app?.editor !== undefined,
  editorActive: window.app?.editor?.isActive,
  propertyPanelExists: window.PropertyPanel !== undefined,
  dragControllerExists: window.WidgetDragController !== undefined,
  resizeControllerExists: window.ResizeController !== undefined,
  paletteExists: window.WidgetPalette !== undefined,
  currentPage: window.app?.currentPage,
  selectedWidget: window.app?.editor?.selectedWidget,
  hasModifiedConfig: window.app?.editor?.modifiedConfig !== null,
  widgets: document.querySelectorAll('.widget').length,
  editableWidgets: document.querySelectorAll('.widget.editable').length,
};
console.table(debug);
```

Send this output for further diagnosis.

## Known Limitations

### What Works:
- ✅ Toggle edit mode on/off
- ✅ Select widgets
- ✅ View/edit widget properties (title, type, position, size)
- ✅ Drag widgets to reposition
- ✅ Resize widgets with handles
- ✅ Save changes to server
- ✅ Changes persist after reload

### What Doesn't Work Yet:
- ❌ Change metrics/queries from UI (must edit gcp-metrics.js directly)
- ❌ Configure metric parameters (filters, aggregations) from UI
- ❌ Add new widgets from palette (palette implemented but integration incomplete)
- ❌ Navigate between pages in edit mode (must exit first)
- ❌ Live data refresh when changing data source (requires reload)
- ❌ Undo/redo functionality
- ❌ Copy/paste widgets
- ❌ Dashboard templates

### Architecture Limitations:
- GCP metrics are hard-coded per-dashboard in `server/gcp-metrics.js`
- To add/modify GCP metrics, you must:
  1. Edit the dashboard function in `gcp-metrics.js`
  2. Add new queries with Cloud Monitoring API
  3. Map results to widget IDs
  4. Restart server

See `DATASOURCES.md` for details on configuring metrics.

## Next Steps

If basic editing works but you need more features:

1. **To configure GCP metrics**: See `DATASOURCES.md` section "GCP Metrics Configuration"
2. **To add new data sources**: See `DATASOURCES.md` section "Adding New Metrics"
3. **To transform data**: See `DATASOURCES.md` section "Transforming Data"

## Still Not Working?

Provide this information:

1. Browser version and OS
2. JavaScript console errors (full stack trace)
3. Output of debug script above
4. Which specific actions don't work
5. Screenshots of property panel (if it appears)
