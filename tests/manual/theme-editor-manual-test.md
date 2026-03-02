# Manual Test Plan: Theme Editor Integration

## Prerequisites
- Server running on http://tv.madhive.local:3000
- Themes API available (PR #28) - if not available, dropdown will be disabled

## Test Scenarios

### 1. Enter Edit Mode
**Steps:**
1. Navigate to http://tv.madhive.local:3000
2. Press `Ctrl+E` (or `Cmd+E` on Mac)

**Expected:**
- Body gets `editor-active` class
- Grid overlay appears
- Notification shows: "Edit mode enabled. Press Ctrl+D for dashboard properties, Ctrl+E to exit."
- Widgets become selectable (cursor changes to move on hover)

### 2. Open Dashboard Properties Panel
**Steps:**
1. While in edit mode, press `Ctrl+D` (or `Cmd+D` on Mac)

**Expected:**
- Property panel appears on the right side
- Panel title shows "Dashboard Properties" (not "Widget Properties")
- Form contains:
  - Dashboard name input (populated with current dashboard name)
  - Dashboard subtitle input
  - Dashboard icon dropdown
  - Theme dropdown (with "-- Default Theme --" option)
  - "Preview on TV" button
  - Grid settings (columns, rows, gap)
- Delete button is hidden (only shows for widgets)
- Save and Cancel buttons are visible

### 3. Theme Dropdown Behavior
**Steps:**
1. In dashboard properties panel, inspect theme dropdown

**Expected (if Themes API available):**
- Dropdown is enabled
- Shows "-- Default Theme --" as first option
- Lists all available themes from `/api/themes`
- Theme names are safely displayed (no XSS)

**Expected (if Themes API not available):**
- Dropdown shows "-- Default Theme (API not available) --"
- Dropdown is disabled
- "Preview on TV" button is disabled

### 4. Select a Theme
**Steps:**
1. In dashboard properties panel, select a theme from dropdown
2. Click "Save Changes"

**Expected:**
- Theme ID is stored in dashboard config
- Visual notification: "Dashboard updated"
- CSS custom properties are applied to `:root`:
  - `--theme-primary`
  - `--theme-secondary`
  - `--theme-accent`
  - `--theme-background`
  - `--theme-surface`
  - `--theme-text-primary`
  - `--theme-text-secondary`
  - `--theme-border`
- Dashboard visually updates with theme colors

### 5. Preview Theme on TV
**Steps:**
1. In dashboard properties panel, select a theme
2. Click "Preview on TV" button

**Expected:**
- TVPreview modal opens in fullscreen
- Shows simulated TV display (default 55")
- Dashboard renders with selected theme applied
- Modal contains:
  - Size selector (55", 65", 85")
  - Close button
  - Apply button
- ESC key closes the modal
- Clicking "Apply" applies the theme and closes modal

### 6. Widget vs Dashboard Panel Switching
**Steps:**
1. Open dashboard properties (`Ctrl+D`)
2. Verify "Dashboard Properties" is shown
3. Close panel (click X or ESC)
4. Click on a widget
5. Verify panel reopens with "Widget Properties"
6. Close panel and press `Ctrl+D` again
7. Verify "Dashboard Properties" is shown again

**Expected:**
- Panel correctly switches between dashboard and widget modes
- Delete button only shows for widgets
- Correct form is displayed in each mode
- Panel title updates appropriately

### 7. Save Dashboard Changes
**Steps:**
1. Open dashboard properties
2. Modify dashboard name, subtitle, or theme
3. Click "Save Changes"
4. Exit edit mode (`Ctrl+E`)
5. Re-enter edit mode and open dashboard properties

**Expected:**
- Changes are persisted to dashboard config
- Changes are sent to `/api/dashboards/{id}` endpoint
- Modified config is reflected in the dashboard display
- Theme persists across page refreshes (after server saves)

### 8. Cancel Dashboard Changes
**Steps:**
1. Open dashboard properties
2. Modify some fields
3. Click "Cancel"

**Expected:**
- Panel closes
- Changes are not applied
- No notification is shown
- Dashboard remains unchanged

### 9. Theme Visual Application
**Steps:**
1. Select a theme with distinct colors
2. Click Save
3. Inspect the page in browser DevTools

**Expected:**
- Check `<html>` element styles
- CSS custom properties are set:
  ```css
  --theme-primary: <color>;
  --theme-secondary: <color>;
  /* etc */
  ```
- Widgets that use theme variables visually update

### 10. Remove Theme (Reset to Default)
**Steps:**
1. Open dashboard properties
2. Select "-- Default Theme --" from dropdown
3. Click Save

**Expected:**
- Theme ID is removed from dashboard config (or set to empty string)
- CSS custom properties are removed from `:root`
- Dashboard returns to default styling

### 11. Grid Settings Update
**Steps:**
1. Open dashboard properties
2. Change columns from 4 to 6
3. Click Save

**Expected:**
- Dashboard grid updates to 6 columns
- Widgets reflow to new grid
- Changes persist when saving

### 12. Security: XSS Prevention
**Steps:**
1. If you have access to modify themes API, create a theme with name: `<script>alert('XSS')</script>`
2. Open dashboard properties
3. Inspect theme dropdown

**Expected:**
- Theme name is displayed as plain text (using `textContent`)
- No script execution occurs
- HTML tags are escaped/displayed as text

## API Verification

### Theme API Endpoints
```bash
# List all themes
curl http://tv.madhive.local:3000/api/themes

# Get specific theme
curl http://tv.madhive.local:3000/api/themes/{theme-id}
```

**Expected Response:**
```json
{
  "success": true,
  "themes": [
    {
      "id": "theme-id",
      "name": "Theme Name",
      "colors": {
        "primary": "#...",
        "secondary": "#...",
        "accent": "#...",
        "background": "#...",
        "surface": "#...",
        "textPrimary": "#...",
        "textSecondary": "#...",
        "border": "#..."
      }
    }
  ]
}
```

## Dashboard Config Verification

After saving a dashboard with a theme, check the config:

```bash
curl http://tv.madhive.local:3000/api/dashboards/platform-overview
```

**Expected:**
```yaml
id: platform-overview
name: Platform Overview
subtitle: Real-Time Activity
icon: bolt
theme: theme-id  # <-- Theme ID stored here
grid:
  columns: 4
  rows: 2
  gap: 14
widgets: [...]
```

## Regression Tests

### Existing Editor Functionality
1. Widget selection still works
2. Widget editing still works
3. Widget deletion still works
4. Drag and drop still works
5. Resize handles still work
6. Widget palette still works
7. Save/discard changes still work
8. Unsaved changes warning still works

### Existing Dashboard Functionality
1. Dashboard rotation still works
2. Data refresh still works
3. Navigation dots still work
4. Page switching still works
5. Keyboard shortcuts still work (arrow keys, etc.)

## Notes
- This feature depends on PR #28 (Theme API) being merged
- If Theme API is not available, the feature gracefully degrades
- Theme preview requires TVPreview component (Task 2, completed)
- Integration tests in `tests/integration/theme-editor.test.js` require Playwright setup
