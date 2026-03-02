# Admin Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace /admin with a unified three-panel WYSIWYG dashboard studio and add pause/resume slideshow control to the TV display.

**Architecture:** New studio.html/studio.js/studio-canvas.js at /admin. Three panels: sidebar (dashboard list, themes, settings), center canvas (live dashboard rendering with click/drag/resize), right properties panel. Pause/resume added to the main TV view at /. No auth gate.

**Tech Stack:** Vanilla JS, Bun/Elysia.js, YAML config, existing widgets.js/charts.js/editor modules.

---

## Reference Files

Before starting, read these:
- public/js/widgets.js — widget rendering API
- public/js/admin-api.js — dashboard CRUD wrappers
- server/index.js:211-214 — /admin route
- config/dashboards.yaml — dashboard schema
- config/queries.yaml — query schema
- docs/plans/2026-03-02-admin-studio-design.md — approved design

---

## Task 1: Studio HTML Shell, CSS Layout, Server Route

**Files:**
- Create: public/studio.html
- Create: public/css/studio.css
- Modify: server/index.js (line ~212, swap admin.html to studio.html)

**Step 1: Update server route**

In server/index.js find:
  const adminHtml = readFileSync(join(publicDir, 'admin.html'), 'utf8');
Replace with:
  const adminHtml = readFileSync(join(publicDir, 'studio.html'), 'utf8');

**Step 2: Create public/studio.html**

Three-panel shell: topbar + sidebar + canvas-pane + properties panel.
Load scripts: us-states.js, charts.js, widgets.js, query-editor.js, studio-canvas.js, studio.js

Topbar elements:
- .studio-brand (logo + "MadHive Studio")
- #dirty-indicator (hidden by default, shows "● Unsaved")
- #discard-btn (disabled by default)
- #save-btn (disabled by default)
- "View on TV ↗" link to /

Sidebar sections:
- Dashboards: #dashboard-list nav, #new-dashboard-btn (+), #new-dashboard-form (hidden)
- Themes: collapsible, #theme-swatches grid
- Settings: collapsible, #settings-form with inputs for title/rotation/refresh

Canvas pane:
- #studio-canvas (the rendering target)
- #canvas-placeholder ("Select a dashboard to edit")
- Footer with #add-widget-btn (disabled until dashboard selected)

Properties panel:
- #properties-placeholder ("Click a widget...")
- #properties-content (hidden until selection)
  - #dashboard-props: name, subtitle, cols, rows, gap inputs
  - #widget-props: Basic (title, type), Data (source, query, + New Query), Position (col, row, colspan, rowspan), Display (unit, min, max, warn, crit)
  - #delete-widget-btn (danger)

Widget palette modal:
- #widget-palette-modal (fixed overlay, hidden)
- 4x3 grid of type cards
- #add-widget-form (hidden until type selected)

**Step 3: Create public/css/studio.css**

CSS variables: --sidebar-w: 220px, --props-w: 260px, --topbar-h: 52px
Colors: --bg: #0a0a0f, --surface: #13131a, --surface2: #1a1a24, --border: #2a2a3a, --primary: #00d4ff, --danger: #ff4444, --text: #e0e0f0, --text-dim: #7070a0

Layout:
- body: height 100%, overflow hidden
- .studio-topbar: height var(--topbar-h), flex row, space-between
- .studio-layout: display grid, grid-template-columns: var(--sidebar-w) 1fr var(--props-w), height calc(100vh - topbar-h)
- .studio-sidebar: overflow-y auto, border-right
- .studio-canvas-pane: flex column, overflow hidden
- .studio-canvas-wrapper: flex 1, display flex, align/justify center, padding 20px
- .studio-canvas: width/height 100%, border, border-radius 8px
- .studio-properties: overflow-y auto, padding 16px

Widget cards in canvas: cursor pointer, outline 2px solid transparent, hover outline rgba(0,212,255,0.4), selected outline #00d4ff

Studio buttons (.studio-btn): primary (bg #00d4ff, color #000), secondary (bg surface2, border), ghost (transparent), danger (bg #ff4444), small variant

Props panel: label+input pairs, details/summary sections for Basic/Data/Position/Display

**Step 4: Verify layout**

Navigate to http://tv:3000/admin
Expected: three-panel dark layout loads, no JS errors

**Step 5: Commit**

git add public/studio.html public/css/studio.css server/index.js
git commit -m "feat: studio shell HTML/CSS and server route"

---

## Task 2: Studio Controller (studio.js) — Sidebar & State

**Files:**
- Create: public/js/studio.js

**Step 1: Create StudioApp class with:**

Properties:
- this.config — loaded from /api/config
- this.modifiedConfig — deep clone (working copy)
- this.activeDashIdx — active dashboard index (-1 = none)
- this.selectedWidgetId — currently selected widget id
- this.isDirty — unsaved changes flag

Methods:
- init() — loadConfig(), loadThemes(), renderSidebar(), bind all UI
- loadConfig() — fetch /api/config, clone to modifiedConfig
- markDirty() / markClean() — toggle dirty indicator and Save/Discard buttons
- save() — PUT /api/dashboards/:id with modifiedConfig dashboard, then markClean()
- discard() — confirm, restore modifiedConfig from config, re-render
- renderSidebar() — build dashboard-nav-list from modifiedConfig.dashboards
- selectDashboard(idx) — set activeDashIdx, call renderCanvas(), showDashboardProps()
- deleteDashboard(idx) — confirm, DELETE /api/dashboards/:id, reload config
- showDashboardProps() — populate dashboard-props inputs, bind oninput handlers
- applyDashboardProps() — update modifiedConfig, markDirty, renderCanvas, renderSidebar
- showWidgetProps(id) — populate all widget-props inputs, bind listeners, loadQueryOptions
- bindWidgetPropListeners(wc) — bind each input to update wc in modifiedConfig, then markDirty + renderCanvas
- loadQueryOptions(source, selectedId) — fetch /api/queries/:source, populate #prop-query select
- deleteSelectedWidget() — confirm, remove from dash.widgets, markDirty, renderCanvas
- openWidgetPalette() — populate type grid, wire up form submit to addWidget()
- addWidget(type, title, source, queryId) — push new widget config, markDirty, renderCanvas
- loadPaletteQueries(source) — populate #aw-query from /api/queries/:source
- renderThemeSwatches() — build swatch cards from this.themes
- applyTheme(id) — POST /api/themes/:id/activate
- loadSettings() / bindSettings() — populate and save settings form
- showToast(msg, type) — temporary notification div in bottom-right
- renderCanvas() — delegate to window.StudioCanvas.render(this)

Boot: document.addEventListener('DOMContentLoaded', () => { window.studio = new StudioApp(); window.studio.init(); })

**Step 2: Verify sidebar works**

Navigate to http://tv:3000/admin
Expected: dashboards listed in sidebar, clicking one highlights it (active class), properties placeholder shows

**Step 3: Commit**

git add public/js/studio.js
git commit -m "feat: studio controller with sidebar, state management, and properties panel"

---

## Task 3: Canvas Rendering (studio-canvas.js)

**Files:**
- Create: public/js/studio-canvas.js

**Step 1: Create StudioCanvas module**

window.StudioCanvas = (function() {
  let app = null;

  function render(studioApp) {
    app = studioApp;
    const canvas = document.getElementById('studio-canvas');
    const dash = app.modifiedConfig.dashboards[app.activeDashIdx];
    if (!dash) { show placeholder; return; }

    canvas.innerHTML = '';  // safe: we control this content

    Create .dashboard-page div:
    - display: grid
    - grid-template-columns: repeat(N, 1fr)
    - grid-template-rows: repeat(N, 1fr)
    - gap, padding, height 100%

    For each widget config (wc):
      Create .widget.widget-{type} div
      Set grid-column, grid-row via style
      Set outline based on selection state
      Append .widget-title (textContent = wc.title)
      Append .widget-content
      Call window.Widgets.create(wc.type, contentEl, wc)
      Add click handler -> app.showWidgetProps(wc.id), update outlines
      Add mouseenter/mouseleave for hover outline

    Click on canvas background -> app.selectedWidgetId = null, show dashboard props

    canvas.appendChild(page)
  }

  return { render };
})();

**Step 2: Add to studio.html before studio.js**

  script src="/js/studio-canvas.js?v=1"

**Step 3: Verify canvas renders**

Select a dashboard -> canvas shows widgets with titles and content
Click widget -> blue outline + properties panel shows widget data

**Step 4: Commit**

git add public/js/studio-canvas.js public/studio.html
git commit -m "feat: studio canvas renders dashboard widgets with click selection"

---

## Task 4: Drag to Reposition

**Files:**
- Modify: public/js/studio-canvas.js

**Step 1: Add enableDrag(card, wc) function**

- card.setAttribute('draggable', true)
- dragstart: card.style.opacity = '0.5', e.dataTransfer.setData('widgetId', wc.id)
- dragend: card.style.opacity = '1'

**Step 2: Add enableDropZone(page, dash) function**

- page dragover: e.preventDefault()
- page drop: get widgetId from dataTransfer, calculate grid col/row from drop coordinates
  - colWidth = rect.width / dash.grid.columns
  - rowHeight = rect.height / dash.grid.rows
  - col = clamp(1, columns, ceil(relX / colWidth))
  - row = clamp(1, rows, ceil(relY / rowHeight))
  - Update wc.position.col and wc.position.row
  - app.markDirty(), app.renderCanvas(), app.showWidgetProps(widgetId)

**Step 3: Call in render()**

After creating each card: enableDrag(card, wc)
After creating page: enableDropZone(page, dash)

**Step 4: Verify**

Drag a widget to a new grid position, release -> widget moves

**Step 5: Commit**

git add public/js/studio-canvas.js
git commit -m "feat: drag-to-reposition widgets in studio canvas"

---

## Task 5: Resize Handles

**Files:**
- Modify: public/js/studio-canvas.js

**Step 1: Add addResizeHandles(card, wc, dash) function**

Create two absolutely-positioned handle divs:
- Right handle (8px wide, 60% height, right:-4px): cursor ew-resize
- Bottom handle (8px tall, 60% width, bottom:-4px): cursor ns-resize
Both: background rgba(0,212,255,0.6), opacity 0, transition

Show/hide on card mouseenter/mouseleave

Right handle mousedown:
- Record startX, startSpan = wc.position.colSpan || 1
- document mousemove: delta = clientX - startX, spanDelta = round(delta / colWidth)
  wc.position.colSpan = clamp(1, cols - col + 1, startSpan + spanDelta)
  update card.style.gridColumn live
- document mouseup: removeListeners, app.markDirty(), app.renderCanvas(), showWidgetProps

Bottom handle mousedown: same pattern for rowSpan with clientY / rowHeight

**Step 2: Call in render()**

After creating each card: addResizeHandles(card, wc, dash)
card.style.position = 'relative' (required for absolute handles)

**Step 3: Verify**

Hover widget -> blue handles appear. Drag right handle -> colSpan increases. Drag bottom -> rowSpan increases.

**Step 4: Commit**

git add public/js/studio-canvas.js
git commit -m "feat: resize handles for widget colSpan and rowSpan"

---

## Task 6: Slideshow Pause/Resume on TV Display

The TV display at / should support pausing the auto-rotation via:
- Spacebar key
- Clicking anywhere on the dashboard (outside widgets)
- A visible pause indicator when paused

**Files:**
- Modify: public/js/app.js
- Modify: public/index.html
- Modify: public/css/dashboard.css

**Step 1: Add pause indicator to public/index.html**

In the bottom bar (nav#bottom-bar), add after nav-dots:
  div#pause-indicator class="pause-indicator" style="display:none"
    span "⏸ PAUSED — Click or press Space to resume"

**Step 2: Add pause indicator CSS to public/css/dashboard.css**

.pause-indicator {
  position: fixed;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.75);
  color: #00d4ff;
  padding: 8px 20px;
  border-radius: 20px;
  border: 1px solid #00d4ff;
  font-size: 14px;
  letter-spacing: 1px;
  pointer-events: none;
  z-index: 100;
}

**Step 3: Modify app.js — enhance pause/resume**

In the DashboardApp class, find the existing Space key handler in bindKeys():

Current:
  case ' ':
    e.preventDefault();
    this.paused = !this.paused;
    document.getElementById('rotation-progress').style.animationPlayState =
      this.paused ? 'paused' : 'running';
    break;

Replace with:
  case ' ':
    e.preventDefault();
    this.togglePause();
    break;

Add togglePause() method to DashboardApp:
  togglePause() {
    this.paused = !this.paused;
    const bar = document.getElementById('rotation-progress');
    const indicator = document.getElementById('pause-indicator');
    if (this.paused) {
      clearInterval(this.rotationTimer);
      clearInterval(this.refreshTimer);
      bar.style.animationPlayState = 'paused';
      if (indicator) indicator.style.display = 'block';
    } else {
      this.startRotation();
      this.startRefresh();
      bar.style.animationPlayState = 'running';
      if (indicator) indicator.style.display = 'none';
    }
  }

**Step 4: Add click-to-pause on main dashboard area**

In init(), after this.bindKeys(), add:

  document.getElementById('dashboard-container').addEventListener('click', () => {
    this.togglePause();
  });

**Step 5: Add mouse click anywhere on body (outside header/nav) to toggle**

Still in init():

  document.addEventListener('click', (e) => {
    if (e.target.closest('#top-bar') || e.target.closest('#bottom-bar')) return;
    this.togglePause();
  });

(Remove the dashboard-container specific handler from Step 4 if using this broader one)

**Step 6: Verify on TV view**

Navigate to http://tv:3000/
1. Press Space -> rotation stops, "⏸ PAUSED" indicator appears
2. Press Space again -> rotation resumes, indicator disappears
3. Click anywhere on the dashboard -> same pause/resume behavior
4. While paused, use arrow keys to manually advance dashboards (existing behavior)

**Step 7: Commit**

git add public/js/app.js public/index.html public/css/dashboard.css
git commit -m "feat: click or spacebar to pause/resume slideshow on TV display"

---

## Task 7: Global Settings API Endpoint

**Files:**
- Modify: server/index.js

**Step 1: Check if PUT /api/config/global exists**

Run: grep -n "config/global" server/index.js

If not found, add near the GET /api/config route:

  .put('/api/config/global', ({ body }) => {
    try {
      const cfg = loadConfig();
      cfg.global = { ...cfg.global, ...body };
      saveConfig(cfg);
      return { success: true };
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  })

Note: Check imports at top of index.js for the correct loadConfig/saveConfig function names.

**Step 2: Test**

curl -X PUT http://localhost:3000/api/config/global \
  -H "Content-Type: application/json" \
  -d '{"rotation_interval": 30}'

Expected: {"success":true}

**Step 3: Commit**

git add server/index.js
git commit -m "feat: PUT /api/config/global endpoint for studio settings"

---

## Task 8: End-to-End Verification

**Full workflow checklist:**

Admin Studio (http://tv:3000/admin):
[ ] Three-panel layout loads
[ ] All dashboards listed in sidebar
[ ] Click dashboard -> canvas renders it
[ ] Click widget -> properties panel populates
[ ] Edit title -> canvas updates live
[ ] Change source -> query dropdown repopulates
[ ] Change position inputs -> widget moves
[ ] Drag widget -> repositions on drop
[ ] Hover widget -> resize handles appear; drag to resize
[ ] "+ Add Widget" -> palette modal -> pick type -> fill form -> widget added
[ ] Delete widget (button in panel) -> removed from canvas
[ ] Save -> toast "Saved!", dirty indicator clears
[ ] Navigate to / -> TV shows updated dashboard within 8s
[ ] "+ New Dashboard" form -> creates and selects new empty dashboard
[ ] Delete dashboard (x button) -> removed from list

TV Display (http://tv:3000/):
[ ] Spacebar pauses slideshow, "PAUSED" indicator appears
[ ] Spacebar again resumes
[ ] Mouse click on dashboard pauses/resumes
[ ] Arrow keys navigate dashboards while paused

**Fix any issues, then final commit:**

git add -A
git commit -m "feat: admin studio complete with pause/resume TV control"

---

## Quick Reference

Server: bun run server/index.js
Tests: bun test tests/unit tests/integration

Key API endpoints:
- GET /api/config
- GET /api/themes
- PUT /api/dashboards/:id
- POST /api/dashboards
- DELETE /api/dashboards/:id
- GET /api/queries/:source
- PUT /api/config/global

New files: public/studio.html, public/css/studio.css, public/js/studio.js, public/js/studio-canvas.js
Modified: server/index.js, public/js/app.js, public/index.html, public/css/dashboard.css
