# Studio Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add four incremental capabilities to the studio at `/admin`: visual snap-to-grid widget editor, query preview/editor, data source credentials UI, and dashboard drag-reorder with thumbnails.

**Architecture:** All work is client-side (studio-canvas.js, studio.js, studio.html, studio.css). No new server endpoints — all required APIs already exist. Each capability is a self-contained task batch that can be shipped independently.

**Tech Stack:** Vanilla JS, Bun/Elysia.js, CSS Grid, existing widgets.js/charts.js

---

## Reference Files

Before starting, read these:
- `public/js/studio-canvas.js` — canvas rendering, drag, resize (241 lines)
- `public/js/studio.js` — StudioApp class, MetricBrowser class (1245 lines)
- `public/studio.html` — three-panel shell HTML (362 lines)
- `public/css/studio.css` — all studio styles (1276 lines)
- `docs/plans/2026-03-03-studio-enhancements-design.md` — approved design

Key patterns:
- `window.StudioCanvas.render(app)` redraws the canvas from `app.modifiedConfig`
- `app.markDirty()` enables the Save button
- `app.showWidgetProps(id)` / `app.showDashboardProps()` updates the right panel
- Studio JS/CSS are served via `readFileSync` routes (no static plugin cache) — changes take effect after service restart

---

## CAPABILITY 1: Visual Widget Editor

---

## Task 1: Grid Overlay CSS

**Files:**
- Modify: `public/css/studio.css`

**Step 1: Add overlay and cell styles at the end of studio.css**

```css
/* ── Drag Grid Overlay ── */
.studio-grid-overlay {
  position: absolute;
  inset: 12px;                  /* matches page padding */
  display: grid;
  pointer-events: none;
  z-index: 20;
}

.grid-cell {
  border: 1px dashed var(--border-lit);
  border-radius: 3px;
  transition: background 0.1s, border-color 0.1s;
}

.grid-cell.drag-target {
  background: rgba(253, 164, 212, 0.15);
  border-color: var(--mh-pink);
}

.grid-cell.drag-blocked {
  background: rgba(251, 113, 133, 0.15);
  border-color: var(--red);
}

/* ── Drag Ghost ── */
.studio-drag-ghost {
  border: 2px solid var(--mh-pink);
  border-radius: 4px;
  background: rgba(253, 164, 212, 0.12);
  pointer-events: none;
  z-index: 19;
  transition: grid-column 0.05s, grid-row 0.05s;
}

.studio-drag-ghost.blocked {
  border-color: var(--red);
  background: rgba(251, 113, 133, 0.12);
}

/* ── Resize span badge ── */
.resize-badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background: var(--mh-pink);
  color: var(--mh-deep);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  padding: 2px 5px;
  border-radius: 3px;
  pointer-events: none;
  z-index: 30;
  display: none;
}
```

**Step 2: Bump studio.css version in studio.html**

In `public/studio.html`, change:
```html
<link rel="stylesheet" href="/css/studio.css?v=4">
```
to:
```html
<link rel="stylesheet" href="/css/studio.css?v=5">
```

**Step 3: Restart server and verify CSS loads**

```bash
sudo systemctl restart tv-dashboards
curl -s http://tv.madhive.local:3000/css/studio.css | grep -c "studio-grid-overlay"
# Expected: 1
```

**Step 4: Commit**

```bash
git add public/css/studio.css public/studio.html
git commit -m "feat: add grid overlay and drag ghost CSS for visual widget editor"
```

---

## Task 2: Grid Overlay + Drag Ghost JS

**Files:**
- Modify: `public/js/studio-canvas.js`

**Step 1: Add module-level ghost/overlay state and helpers at the top of the IIFE (after `let app = null;`)**

```js
let _ghost = null;
let _overlay = null;
let _dragWc = null;

function _showOverlay(page, dash, wc) {
  _hideOverlay(page);
  _dragWc = wc;

  const overlay = document.createElement('div');
  overlay.className = 'studio-grid-overlay';
  overlay.id = 'studio-drag-overlay';
  overlay.style.gridTemplateColumns = 'repeat(' + dash.grid.columns + ', 1fr)';
  overlay.style.gridTemplateRows    = 'repeat(' + dash.grid.rows    + ', 1fr)';

  for (let r = 1; r <= dash.grid.rows; r++) {
    for (let c = 1; c <= dash.grid.columns; c++) {
      const cell = document.createElement('div');
      cell.className    = 'grid-cell';
      cell.dataset.col  = c;
      cell.dataset.row  = r;
      overlay.appendChild(cell);
    }
  }
  page.appendChild(overlay);
  _overlay = overlay;

  // Ghost
  const ghost = document.createElement('div');
  ghost.className = 'studio-drag-ghost';
  ghost.style.gridColumn = wc.position.col + ' / span ' + (wc.position.colSpan || 1);
  ghost.style.gridRow    = wc.position.row + ' / span ' + (wc.position.rowSpan || 1);
  page.insertBefore(ghost, page.firstChild);
  _ghost = ghost;
}

function _hideOverlay(page) {
  if (_overlay && _overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
  if (_ghost  && _ghost.parentNode)   _ghost.parentNode.removeChild(_ghost);
  _overlay = null;
  _ghost   = null;
  _dragWc  = null;
}

function _highlightCells(col, row, colSpan, rowSpan, blocked) {
  if (!_overlay) return;
  _overlay.querySelectorAll('.grid-cell').forEach(function (cell) {
    const c = parseInt(cell.dataset.col);
    const r = parseInt(cell.dataset.row);
    const inCol = c >= col && c < col + colSpan;
    const inRow = r >= row && r < row + rowSpan;
    cell.classList.toggle('drag-target', inCol && inRow && !blocked);
    cell.classList.toggle('drag-blocked', inCol && inRow &&  blocked);
  });
  if (_ghost) _ghost.classList.toggle('blocked', blocked);
}
```

**Step 2: Replace the existing `enableDrag` function**

```js
function enableDrag(card, wc) {
  card.setAttribute('draggable', 'true');

  card.addEventListener('dragstart', function (e) {
    // Suppress the browser's default ghost image
    var blank = document.createElement('div');
    document.body.appendChild(blank);
    e.dataTransfer.setDragImage(blank, 0, 0);
    setTimeout(function () { document.body.removeChild(blank); }, 0);

    e.dataTransfer.setData('widgetId', wc.id);
    card.style.opacity = '0.25';

    var page = card.closest('.dashboard-page');
    var dash = app.modifiedConfig.dashboards[app.activeDashIdx];
    _showOverlay(page, dash, wc);
  });

  card.addEventListener('dragend', function () {
    card.style.opacity = '1';
    var page = card.closest('.dashboard-page');
    _hideOverlay(page);
  });
}
```

**Step 3: Bump studio-canvas.js version in studio.html**

Change:
```html
<script src="/js/studio-canvas.js?v=2"></script>
```
to:
```html
<script src="/js/studio-canvas.js?v=3"></script>
```

**Step 4: Restart and verify in browser**

```bash
sudo systemctl restart tv-dashboards
```

Navigate to `/admin`, select a dashboard, start dragging a widget. Expected: widget fades to 0.25 opacity, grid overlay appears with dotted cell borders.

**Step 5: Commit**

```bash
git add public/js/studio-canvas.js public/studio.html
git commit -m "feat: grid overlay and ghost appear on widget drag start"
```

---

## Task 3: Snap-to-Grid + Collision Detection on Dragover

**Files:**
- Modify: `public/js/studio-canvas.js`

**Step 1: Add collision helper above `enableDropZone`**

```js
function _hasCollision(dash, col, row, colSpan, rowSpan, excludeId) {
  return dash.widgets.some(function (w) {
    if (w.id === excludeId) return false;
    var wcs = w.position.colSpan || 1;
    var wrs = w.position.rowSpan || 1;
    var colOk = col < w.position.col + wcs && col + colSpan > w.position.col;
    var rowOk = row < w.position.row + wrs && row + rowSpan > w.position.row;
    return colOk && rowOk;
  });
}
```

**Step 2: Replace the existing `enableDropZone` function**

```js
function enableDropZone(page, dash) {
  page.addEventListener('dragover', function (e) {
    e.preventDefault();
    if (!_dragWc || !_overlay) return;

    var rect    = page.getBoundingClientRect();
    var relX    = e.clientX - rect.left;
    var relY    = e.clientY - rect.top;
    var colW    = rect.width  / dash.grid.columns;
    var rowH    = rect.height / dash.grid.rows;
    var col     = Math.max(1, Math.min(dash.grid.columns, Math.ceil(relX / colW)));
    var row     = Math.max(1, Math.min(dash.grid.rows,    Math.ceil(relY / rowH)));
    var colSpan = _dragWc.position.colSpan || 1;
    var rowSpan = _dragWc.position.rowSpan || 1;

    // Clamp so widget doesn't go off-grid
    col = Math.min(col, dash.grid.columns - colSpan + 1);
    row = Math.min(row, dash.grid.rows    - rowSpan + 1);

    var blocked = _hasCollision(dash, col, row, colSpan, rowSpan, _dragWc.id);

    _highlightCells(col, row, colSpan, rowSpan, blocked);

    if (_ghost) {
      _ghost.style.gridColumn = col + ' / span ' + colSpan;
      _ghost.style.gridRow    = row + ' / span ' + rowSpan;
    }

    // Live-update properties panel inputs
    var colInput = document.getElementById('prop-col');
    var rowInput = document.getElementById('prop-row');
    if (colInput) colInput.value = col;
    if (rowInput) rowInput.value = row;
  });

  page.addEventListener('drop', function (e) {
    e.preventDefault();
    var widgetId = e.dataTransfer.getData('widgetId');
    var wc = dash.widgets.find(function (w) { return w.id === widgetId; });
    if (!wc) return;

    var rect    = page.getBoundingClientRect();
    var relX    = e.clientX - rect.left;
    var relY    = e.clientY - rect.top;
    var colW    = rect.width  / dash.grid.columns;
    var rowH    = rect.height / dash.grid.rows;
    var col     = Math.max(1, Math.min(dash.grid.columns, Math.ceil(relX / colW)));
    var row     = Math.max(1, Math.min(dash.grid.rows,    Math.ceil(relY / rowH)));
    var colSpan = wc.position.colSpan || 1;
    var rowSpan = wc.position.rowSpan || 1;

    col = Math.min(col, dash.grid.columns - colSpan + 1);
    row = Math.min(row, dash.grid.rows    - rowSpan + 1);

    // Reject blocked drops
    if (_hasCollision(dash, col, row, colSpan, rowSpan, widgetId)) return;

    wc.position.col = col;
    wc.position.row = row;

    app.markDirty();
    app.renderCanvas();
    app.showWidgetProps(widgetId);
  });
}
```

**Step 3: Restart and test in browser**

```bash
sudo systemctl restart tv-dashboards
```

Drag a widget over occupied cells — cells should turn red and drop should be rejected. Drag to empty cells — cells highlight pink, ghost follows, drop succeeds and widget moves.

**Step 4: Commit**

```bash
git add public/js/studio-canvas.js
git commit -m "feat: snap-to-grid dragover with collision detection (red=blocked, pink=clear)"
```

---

## Task 4: Resize Badge + Read-Only Position Fields

**Files:**
- Modify: `public/js/studio-canvas.js`
- Modify: `public/studio.html`

**Step 1: Add resize badge to `addResizeHandles`**

In `addResizeHandles`, after `card.appendChild(rightHandle); card.appendChild(bottomHandle);` add:

```js
var badge = document.createElement('div');
badge.className = 'resize-badge';
badge.id = 'resize-badge-' + wc.id;
card.appendChild(badge);
```

In the right handle `onMove` function, after updating `wc.position.colSpan`, add:

```js
badge.style.display = 'block';
badge.textContent = wc.position.colSpan + '\u00D7' + (wc.position.rowSpan || 1);
```

In the right handle `onUp` function, add:

```js
badge.style.display = 'none';
```

Do the same for the bottom handle `onMove`/`onUp`, updating rowSpan in the badge.

**Step 2: Make position inputs read-only in studio.html**

In `public/studio.html`, find the Position section inputs and add `readonly` + a helper note:

```html
<details class="props-section" id="display-section">
  <summary>Position</summary>
  <div>
    <p class="props-hint">Drag widget to reposition · drag handles to resize</p>
    <div class="props-grid-2">
      <label>Col <input id="prop-col"     type="number" min="1" readonly></label>
      <label>Row <input id="prop-row"     type="number" min="1" readonly></label>
      <label>Col Span <input id="prop-colspan" type="number" min="1" readonly></label>
      <label>Row Span <input id="prop-rowspan" type="number" min="1" readonly></label>
    </div>
  </div>
</details>
```

**Step 3: Add hint style to studio.css**

```css
.props-hint {
  font-size: 10px;
  color: var(--t3);
  font-family: var(--font-display);
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.studio-properties input[readonly] {
  opacity: 0.5;
  cursor: default;
  background: var(--bg);
}
```

**Step 4: Restart and verify**

```bash
sudo systemctl restart tv-dashboards
```

Hover a widget → resize handle appears. Drag handle → badge shows `2×1` updating live. Position inputs in panel show current position as read-only.

**Step 5: Commit**

```bash
git add public/js/studio-canvas.js public/studio.html public/css/studio.css
git commit -m "feat: live resize badge and read-only position fields — drag is canonical"
```

---

## CAPABILITY 2: Query Preview + Editor

---

## Task 5: Queries Tab — Sidebar Shell

**Files:**
- Modify: `public/studio.html`
- Modify: `public/css/studio.css`
- Modify: `public/js/studio.js`

**Step 1: Add tab nav to sidebar in studio.html**

Replace the `<aside class="studio-sidebar">` opening with:

```html
<aside class="studio-sidebar">
  <div class="sidebar-tabs">
    <button class="sidebar-tab active" data-tab="dashboards">Dashboards</button>
    <button class="sidebar-tab" data-tab="queries">Queries</button>
    <button class="sidebar-tab" data-tab="datasources">Sources</button>
  </div>

  <!-- Dashboards panel (existing content, wrap in div) -->
  <div class="sidebar-panel" id="panel-dashboards">
    <!-- ... existing dashboard sections ... -->
  </div>

  <!-- Queries panel -->
  <div class="sidebar-panel" id="panel-queries" style="display:none">
    <div id="query-list" class="query-list"></div>
  </div>

  <!-- Data Sources panel -->
  <div class="sidebar-panel" id="panel-datasources" style="display:none">
    <div id="datasource-list" class="datasource-list"></div>
  </div>
```

**Step 2: Add tab CSS to studio.css**

```css
/* ── Sidebar tabs ── */
.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.sidebar-tab {
  flex: 1;
  padding: 8px 4px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--t3);
  font-family: var(--font-display);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.sidebar-tab:hover { color: var(--t2); }
.sidebar-tab.active {
  color: var(--mh-pink);
  border-bottom-color: var(--mh-pink);
}

.sidebar-panel {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
```

**Step 3: Add tab switching to studio.js `init()`**

```js
bindSidebarTabs() {
  const tabs = document.querySelectorAll('.sidebar-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const name = tab.dataset.tab;
      document.querySelectorAll('.sidebar-panel').forEach(p => {
        p.style.display = p.id === 'panel-' + name ? 'flex' : 'none';
      });
      if (name === 'queries') this.renderQueryList();
      if (name === 'datasources') this.renderDatasourceList();
    });
  });
}
```

Call `this.bindSidebarTabs()` in `init()`.

**Step 4: Restart and verify tabs switch panels**

```bash
sudo systemctl restart tv-dashboards
```

Click Queries tab → empty panel shows. Click Dashboards → returns to dashboard list.

**Step 5: Commit**

```bash
git add public/studio.html public/css/studio.css public/js/studio.js
git commit -m "feat: sidebar tabs for Dashboards / Queries / Sources panels"
```

---

## Task 6: Query List + Editor Panel

**Files:**
- Modify: `public/js/studio.js`
- Modify: `public/studio.html`
- Modify: `public/css/studio.css`

**Step 1: Add query list renderer to studio.js**

```js
async renderQueryList() {
  const list = document.getElementById('query-list');
  if (!list) return;
  list.textContent = '';
  try {
    const res  = await fetch('/api/queries/');
    const data = await res.json();
    const all  = data.queries || {};
    const sources = Object.keys(all);
    if (!sources.length) {
      const empty = document.createElement('div');
      empty.className = 'mb-status';
      empty.textContent = 'No saved queries';
      list.appendChild(empty);
      return;
    }
    sources.forEach(source => {
      const queries = all[source] || [];
      const hdr = document.createElement('div');
      hdr.className = 'sidebar-section-header';
      hdr.textContent = source.toUpperCase();
      list.appendChild(hdr);
      queries.forEach(q => {
        const row = document.createElement('div');
        row.className = 'query-row';
        const nameEl = document.createElement('span');
        nameEl.className = 'query-row-name';
        nameEl.textContent = q.name;
        const badge = document.createElement('span');
        badge.className = 'query-row-badge';
        badge.textContent = source;
        row.appendChild(nameEl);
        row.appendChild(badge);
        row.addEventListener('click', () => this.openQueryEditor(q, source));
        list.appendChild(row);
      });
    });
  } catch (e) {
    this.showToast('Failed to load queries: ' + e.message, 'error');
  }
}
```

**Step 2: Add query editor panel HTML to studio.html** (in right panel, after `#properties-content`)

```html
<!-- Query editor panel (shown when a query is open) -->
<div id="query-editor-panel" style="display:none" class="query-editor-panel">
  <div class="qe-header">
    <div>
      <div id="qe-name" class="qe-name"></div>
      <div id="qe-source-badge" class="qe-source-badge"></div>
    </div>
    <button id="qe-close" class="modal-close">&#215;</button>
  </div>

  <!-- Config strip -->
  <div class="qe-config">
    <label class="qe-label">Metric / SQL
      <input id="qe-metric" type="text" class="qe-input" placeholder="metric.type or SQL">
    </label>
    <div class="qe-row">
      <label class="qe-label">Time Window
        <select id="qe-time-window" class="qe-select">
          <option value="5">5 min</option>
          <option value="15">15 min</option>
          <option value="60" selected>1 hour</option>
          <option value="360">6 hours</option>
          <option value="1440">24 hours</option>
        </select>
      </label>
      <label class="qe-label">Aggregation
        <select id="qe-aggregation" class="qe-select">
          <option value="ALIGN_MEAN">Mean</option>
          <option value="ALIGN_SUM">Sum</option>
          <option value="ALIGN_MAX">Max</option>
          <option value="ALIGN_RATE">Rate/s</option>
        </select>
      </label>
    </div>
  </div>

  <!-- Results preview -->
  <div class="qe-results">
    <div class="qe-results-toolbar">
      <button id="qe-run" class="studio-btn primary small">&#9654; Run</button>
      <span id="qe-run-status" class="qe-run-status"></span>
    </div>
    <div id="qe-results-body" class="qe-results-body">
      <div class="mb-status">Run query to see results</div>
    </div>
  </div>

  <!-- Actions -->
  <div class="qe-actions">
    <button id="qe-save"        class="studio-btn primary small">Save Query</button>
    <button id="qe-save-as-new" class="studio-btn secondary small">Save as New</button>
    <button id="qe-assign"      class="studio-btn secondary small">Assign to Widget</button>
  </div>
</div>
```

**Step 3: Add query editor CSS**

```css
/* ── Query Editor Panel ── */
.query-editor-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  overflow-y: auto;
}

.qe-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.qe-name {
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 600;
  color: var(--t1);
}

.qe-source-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--mh-pink);
  letter-spacing: 1px;
  text-transform: uppercase;
}

.qe-config {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.qe-row {
  display: flex;
  gap: 8px;
}

.qe-label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 10px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--t3);
  font-family: var(--font-display);
  flex: 1;
}

.qe-input, .qe-select {
  padding: 5px 8px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--t1);
  font-family: var(--font-mono);
  font-size: 12px;
  width: 100%;
}

.qe-input:focus, .qe-select:focus { border-color: var(--mh-pink); outline: none; }

.qe-results {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 120px;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.qe-results-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.qe-run-status {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--t3);
}

.qe-results-body {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--t2);
}

.qe-result-row {
  display: flex;
  gap: 12px;
  padding: 3px 4px;
  border-bottom: 1px solid var(--border);
}

.qe-result-row:last-child { border-bottom: none; }
.qe-result-key   { color: var(--t3); min-width: 80px; flex-shrink: 0; }
.qe-result-value { color: var(--t1); }

.qe-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
```

**Step 4: Add `openQueryEditor` to studio.js**

```js
openQueryEditor(query, source) {
  // Show query editor, hide properties
  const props = document.getElementById('properties-placeholder');
  const content = document.getElementById('properties-content');
  const qe = document.getElementById('query-editor-panel');
  if (props)   props.style.display   = 'none';
  if (content) content.style.display = 'none';
  if (qe)      qe.style.display      = 'flex';

  this._activeQuery  = { ...query };
  this._activeSource = source;

  document.getElementById('qe-name').textContent         = query.name;
  document.getElementById('qe-source-badge').textContent = source;
  document.getElementById('qe-metric').value             = query.metricType || query.sql || '';
  document.getElementById('qe-time-window').value        = query.timeWindow || 60;
  document.getElementById('qe-aggregation').value        =
    (query.aggregation && query.aggregation.perSeriesAligner) || 'ALIGN_MEAN';

  this._bindQueryEditorActions();
}

_bindQueryEditorActions() {
  document.getElementById('qe-close').onclick = () => {
    document.getElementById('query-editor-panel').style.display = 'none';
    this.showDashboardProps();
  };

  document.getElementById('qe-run').onclick = () => this._runQuery();

  document.getElementById('qe-save').onclick = async () => {
    await this._saveQuery(false);
  };

  document.getElementById('qe-save-as-new').onclick = async () => {
    await this._saveQuery(true);
  };

  document.getElementById('qe-assign').onclick = () => {
    this._assignQueryToWidget();
  };
}
```

**Step 5: Restart and verify**

```bash
sudo systemctl restart tv-dashboards
```

Click Queries tab → list loads. Click a query → right panel switches to query editor with name, source badge, config fields populated.

**Step 6: Commit**

```bash
git add public/js/studio.js public/studio.html public/css/studio.css
git commit -m "feat: query list in sidebar and query editor panel shell"
```

---

## Task 7: Query Run + Results Preview

**Files:**
- Modify: `public/js/studio.js`

**Step 1: Add `_runQuery` method to StudioApp**

```js
async _runQuery() {
  const runBtn    = document.getElementById('qe-run');
  const statusEl  = document.getElementById('qe-run-status');
  const bodyEl    = document.getElementById('qe-results-body');
  const source    = this._activeSource;
  const queryId   = this._activeQuery && this._activeQuery.id;

  runBtn.setAttribute('disabled', '');
  runBtn.textContent = 'Running\u2026';
  statusEl.textContent = '';
  bodyEl.textContent = '';

  const t0 = Date.now();
  try {
    // Use the query-test endpoint
    const res = await fetch('/api/queries/' + source + '/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryId }),
    });
    const data = await res.json();
    const ms = Date.now() - t0;
    statusEl.textContent = ms + 'ms';

    if (!res.ok || !data.success) throw new Error(data.error || 'Query failed');

    // Render result rows
    const result = data.result || data.data || {};
    const entries = Object.entries(result).slice(0, 50);
    if (!entries.length) {
      const msg = document.createElement('div');
      msg.className = 'mb-status';
      msg.textContent = 'No data returned';
      bodyEl.appendChild(msg);
    } else {
      entries.forEach(([key, val]) => {
        const row = document.createElement('div');
        row.className = 'qe-result-row';
        const k = document.createElement('span');
        k.className   = 'qe-result-key';
        k.textContent = key;
        const v = document.createElement('span');
        v.className   = 'qe-result-value';
        v.textContent = typeof val === 'object' ? JSON.stringify(val) : String(val);
        row.appendChild(k);
        row.appendChild(v);
        bodyEl.appendChild(row);
      });
    }
  } catch (e) {
    statusEl.textContent = 'Error';
    statusEl.style.color = 'var(--red)';
    const err = document.createElement('div');
    err.style.color   = 'var(--red)';
    err.style.padding = '8px';
    err.style.fontFamily = 'var(--font-mono)';
    err.style.fontSize   = '11px';
    err.textContent = e.message;
    bodyEl.appendChild(err);
  } finally {
    runBtn.removeAttribute('disabled');
    runBtn.textContent = '\u25B6 Run';
  }
}
```

**Step 2: Add `_saveQuery` method**

```js
async _saveQuery(asNew) {
  const q      = this._activeQuery;
  const source = this._activeSource;
  if (!q) return;

  const metricOrSql = document.getElementById('qe-metric').value.trim();
  const timeWindow  = parseInt(document.getElementById('qe-time-window').value)  || 60;
  const aligner     = document.getElementById('qe-aggregation').value;

  const body = {
    id:   asNew ? (q.id + '-' + Date.now()) : q.id,
    name: asNew ? (q.name + ' (copy)') : q.name,
  };

  if (source === 'bigquery') {
    body.sql = metricOrSql;
  } else {
    body.metricType  = metricOrSql;
    body.timeWindow  = timeWindow;
    body.aggregation = { perSeriesAligner: aligner, crossSeriesReducer: 'REDUCE_MEAN' };
  }

  try {
    const url    = asNew ? ('/api/queries/' + source) : ('/api/queries/' + source + '/' + q.id);
    const method = asNew ? 'POST' : 'PUT';
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    this.showToast(asNew ? 'Saved as new query' : 'Query saved', 'success');
    this.renderQueryList();
  } catch (e) {
    this.showToast('Save failed: ' + e.message, 'error');
  }
}
```

**Step 3: Add `_assignQueryToWidget` method**

```js
_assignQueryToWidget() {
  const q      = this._activeQuery;
  const source = this._activeSource;
  if (!q || this.activeDashIdx < 0) return;

  // Dim canvas and highlight all widgets for selection
  const canvas = document.getElementById('studio-canvas');
  if (!canvas) return;
  canvas.classList.add('assign-mode');

  const widgets = canvas.querySelectorAll('.widget');
  widgets.forEach(card => {
    const origClick = card.onclick;
    card.addEventListener('click', function handler(e) {
      e.stopPropagation();
      card.removeEventListener('click', handler);
      canvas.classList.remove('assign-mode');
      // Reset all card outlines
      canvas.querySelectorAll('.widget').forEach(c => c.style.outline = '2px solid transparent');

      const widgetId = card.dataset.widgetId;
      const dash = window.studio.modifiedConfig.dashboards[window.studio.activeDashIdx];
      const wc   = dash && dash.widgets.find(w => w.id === widgetId);
      if (wc) {
        wc.source  = source;
        wc.queryId = q.id;
        window.studio.markDirty();
        window.studio.renderCanvas();
        window.studio.showWidgetProps(widgetId);
        window.studio.showToast('Query assigned to ' + (wc.title || widgetId), 'success');
      }
    }, { once: true });
  });

  this.showToast('Click a widget to assign this query', 'info');
}
```

**Step 4: Add assign-mode CSS to studio.css**

```css
.studio-canvas.assign-mode .widget {
  outline: 2px solid var(--mh-pink) !important;
  cursor: crosshair !important;
  animation: assignPulse 1s ease-in-out infinite;
}

@keyframes assignPulse {
  0%, 100% { outline-color: var(--mh-pink); }
  50%       { outline-color: var(--mh-hot-pink); box-shadow: 0 0 12px rgba(253,164,212,0.3); }
}
```

**Step 5: Restart and test full query flow**

```bash
sudo systemctl restart tv-dashboards
```

1. Queries tab → click a GCP query → Run → results appear
2. Modify time window → Save → toast confirms
3. Assign to Widget → canvas highlights → click widget → widget updates

**Step 6: Commit**

```bash
git add public/js/studio.js public/css/studio.css
git commit -m "feat: query run preview, save, save-as-new, assign-to-widget flow"
```

---

## CAPABILITY 3: Data Source Credentials UI

---

## Task 8: Data Sources Panel + Status List

**Files:**
- Modify: `public/js/studio.js`
- Modify: `public/css/studio.css`

**Step 1: Add `renderDatasourceList` to StudioApp**

```js
async renderDatasourceList() {
  const list = document.getElementById('datasource-list');
  if (!list) return;
  list.textContent = '';

  try {
    const res  = await fetch('/api/data-sources');
    const data = await res.json();
    const sources = (data.sources || []);

    sources.forEach(src => {
      const row  = document.createElement('div');
      row.className = 'ds-row';

      const dot  = document.createElement('span');
      dot.className = 'ds-status-dot ' + (src.isConnected ? 'green' : src.lastError ? 'red' : 'grey');

      const name = document.createElement('span');
      name.className   = 'ds-name';
      name.textContent = src.name;

      const type = document.createElement('span');
      type.className   = 'ds-type';
      type.textContent = src.isConnected ? 'connected' : (src.lastError ? 'error' : 'not configured');

      row.appendChild(dot);
      row.appendChild(name);
      row.appendChild(type);
      row.addEventListener('click', () => this.openDatasourceEditor(src));
      list.appendChild(row);
    });
  } catch (e) {
    this.showToast('Failed to load data sources: ' + e.message, 'error');
  }
}
```

**Step 2: Add data source status styles to studio.css**

```css
/* ── Data Source List ── */
.datasource-list { display: flex; flex-direction: column; }

.ds-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background 0.1s;
}

.ds-row:hover { background: var(--bg-card); }

.ds-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ds-status-dot.green { background: var(--green);  box-shadow: 0 0 6px var(--green); }
.ds-status-dot.amber { background: var(--amber);  box-shadow: 0 0 6px var(--amber); }
.ds-status-dot.red   { background: var(--red);    box-shadow: 0 0 6px var(--red); }
.ds-status-dot.grey  { background: var(--t3); }

.ds-name { font-family: var(--font-body); font-size: 13px; color: var(--t2); flex: 1; }
.ds-type { font-family: var(--font-mono); font-size: 10px; color: var(--t3); }
```

**Step 3: Restart and verify**

```bash
sudo systemctl restart tv-dashboards
```

Sources tab → list shows GCP (green), BigQuery (green), VulnTrack (green/red depending on status), stubs (grey).

**Step 4: Commit**

```bash
git add public/js/studio.js public/css/studio.css
git commit -m "feat: data sources tab with live connection status indicators"
```

---

## Task 9: Data Source Credential Editor + Test Connection

**Files:**
- Modify: `public/js/studio.js`
- Modify: `public/studio.html`
- Modify: `public/css/studio.css`

**Step 1: Add data source editor panel HTML to studio.html** (after `#query-editor-panel`)

```html
<!-- Data source editor panel -->
<div id="datasource-editor-panel" style="display:none" class="datasource-editor-panel">
  <div class="qe-header">
    <div>
      <div id="dse-name" class="qe-name"></div>
      <div id="dse-status" class="qe-source-badge"></div>
    </div>
    <button id="dse-close" class="modal-close">&#215;</button>
  </div>
  <div id="dse-fields" class="dse-fields"></div>
  <div class="qe-actions">
    <button id="dse-test" class="studio-btn secondary small">&#9654; Test Connection</button>
    <span id="dse-test-result" class="qe-run-status"></span>
  </div>
</div>
```

**Step 2: Add `openDatasourceEditor` to StudioApp**

```js
async openDatasourceEditor(src) {
  const props   = document.getElementById('properties-placeholder');
  const content = document.getElementById('properties-content');
  const qe      = document.getElementById('query-editor-panel');
  const dse     = document.getElementById('datasource-editor-panel');

  [props, content, qe].forEach(el => { if (el) el.style.display = 'none'; });
  if (dse) dse.style.display = 'flex';

  document.getElementById('dse-name').textContent   = src.name;
  document.getElementById('dse-status').textContent = src.isConnected ? 'connected' : 'not connected';
  document.getElementById('dse-status').style.color = src.isConnected ? 'var(--green)' : 'var(--red)';

  // Load schema to know which fields to show
  const schemaRes = await fetch('/api/data-sources/schemas/detailed');
  const schemaData = await schemaRes.json().catch(() => ({ schemas: {} }));
  const schema = (schemaData.schemas && schemaData.schemas[src.name]) || { fields: [] };

  const fieldsEl = document.getElementById('dse-fields');
  fieldsEl.textContent = '';

  (schema.fields || []).forEach(field => {
    const label = document.createElement('label');
    label.className = 'qe-label';
    label.textContent = field.description || field.name;

    const input = document.createElement('input');
    input.className  = 'qe-input';
    input.type       = field.secure ? 'password' : 'text';
    input.dataset.field = field.name;
    input.placeholder = field.secure ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (stored)' : (field.default || '');
    input.value = '';   // Never pre-fill secrets

    if (field.envVar) {
      const hint = document.createElement('div');
      hint.className   = 'props-hint';
      hint.textContent = 'env: ' + field.envVar;
      label.appendChild(input);
      label.appendChild(hint);
    } else {
      label.appendChild(input);
    }
    fieldsEl.appendChild(label);
  });

  // Bind test button
  document.getElementById('dse-close').onclick = () => {
    dse.style.display = 'none';
    this.showDashboardProps();
  };

  document.getElementById('dse-test').onclick = async () => {
    const btn    = document.getElementById('dse-test');
    const result = document.getElementById('dse-test-result');
    btn.setAttribute('disabled', '');
    result.textContent = 'Testing\u2026';
    result.style.color = 'var(--t3)';
    const t0 = Date.now();
    try {
      const res  = await fetch('/api/data-sources/' + src.name + '/test', { method: 'POST' });
      const data = await res.json();
      const ms   = Date.now() - t0;
      if (data.connected) {
        result.textContent = '\u2713 Connected (' + ms + 'ms)';
        result.style.color = 'var(--green)';
      } else {
        result.textContent = '\u2717 Failed';
        result.style.color = 'var(--red)';
      }
    } catch (e) {
      result.textContent = '\u2717 ' + e.message;
      result.style.color = 'var(--red)';
    } finally {
      btn.removeAttribute('disabled');
    }
  };
}
```

**Step 3: Add data source editor CSS**

```css
/* ── Data Source Editor ── */
.datasource-editor-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  overflow-y: auto;
}

.dse-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

**Step 4: Restart and test**

```bash
sudo systemctl restart tv-dashboards
```

Sources tab → click GCP → editor opens showing fields from schema. Click Test Connection → shows "✓ Connected (42ms)" or error message.

**Step 5: Commit**

```bash
git add public/js/studio.js public/studio.html public/css/studio.css
git commit -m "feat: data source credential editor with test connection"
```

---

## CAPABILITY 4: Dashboard Reordering + Thumbnails

---

## Task 10: Drag-Sortable Dashboard List

**Files:**
- Modify: `public/js/studio.js`
- Modify: `public/css/studio.css`

**Step 1: Update `renderSidebar` to add drag handles and sortable behaviour**

Replace the existing `renderSidebar` method body with the following (keep the same structure, add drag handles and sortable events):

```js
renderSidebar() {
  const list = document.getElementById('dashboard-list');
  if (!list) return;
  list.textContent = '';

  const dashes = (this.modifiedConfig && this.modifiedConfig.dashboards) || [];
  dashes.forEach((dash, i) => {
    const item = document.createElement('div');
    item.className = 'dashboard-nav-item' + (i === this.activeDashIdx ? ' active' : '');
    item.setAttribute('draggable', 'true');
    item.dataset.idx = i;

    // Thumbnail canvas
    const thumb = document.createElement('canvas');
    thumb.className = 'dash-thumb';
    thumb.width  = 40;
    thumb.height = 24;
    this._drawThumbnail(thumb, dash);

    // Drag handle
    const handle = document.createElement('span');
    handle.className   = 'nav-drag-handle';
    handle.textContent = '\u2807';   // ⠇ braille dots as drag icon
    handle.title       = 'Drag to reorder';

    const name  = document.createElement('span');
    name.className   = 'nav-name';
    name.textContent = dash.name;

    const count = document.createElement('span');
    count.className   = 'nav-count';
    count.textContent = (dash.widgets ? dash.widgets.length : 0) + 'w';

    const delBtn = document.createElement('button');
    delBtn.className   = 'nav-delete';
    delBtn.textContent = '\u2715';
    delBtn.title       = 'Delete';

    item.appendChild(handle);
    item.appendChild(thumb);
    item.appendChild(name);
    item.appendChild(count);
    item.appendChild(delBtn);

    item.addEventListener('click', (e) => {
      if (e.target === delBtn || e.target === handle) return;
      this.selectDashboard(i);
    });

    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteDashboard(i);
    });

    // Drag-sort events
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('dashIdx', i);
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      list.querySelectorAll('.dashboard-nav-item').forEach(el => el.classList.remove('drag-over'));
      item.classList.add('drag-over');
    });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIdx = parseInt(e.dataTransfer.getData('dashIdx'));
      const toIdx   = parseInt(item.dataset.idx);
      if (fromIdx === toIdx) return;
      item.classList.remove('drag-over');
      this._reorderDashboard(fromIdx, toIdx);
    });

    list.appendChild(item);
  });
}

async _reorderDashboard(fromIdx, toIdx) {
  const dashes = this.modifiedConfig.dashboards;
  const moved  = dashes.splice(fromIdx, 1)[0];
  dashes.splice(toIdx, 0, moved);

  const order = dashes.map(d => d.id);
  try {
    await fetch('/api/dashboards/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
    this.showToast('Dashboard order saved', 'success');
  } catch (e) {
    this.showToast('Reorder failed: ' + e.message, 'error');
  }

  const newActive = dashes.findIndex(d => d === (this.modifiedConfig.dashboards[this.activeDashIdx]));
  this.activeDashIdx = newActive >= 0 ? newActive : 0;
  this.renderSidebar();
}
```

**Step 2: Add thumbnail draw helper to StudioApp**

```js
_drawThumbnail(canvas, dash) {
  const ctx  = canvas.getContext('2d');
  const w    = canvas.width;
  const h    = canvas.height;
  const cols = dash.grid ? dash.grid.columns : 4;
  const rows = dash.grid ? dash.grid.rows    : 2;
  const cw   = w / cols;
  const rh   = h / rows;

  // Background
  ctx.fillStyle = '#0E0320';
  ctx.fillRect(0, 0, w, h);

  const TYPE_COLORS = {
    'big-number':        '#FDA4D4',
    'stat-card':         '#FDA4D4',
    'gauge':             '#FBBF24',
    'gauge-row':         '#FBBF24',
    'bar-chart':         '#60A5FA',
    'progress-bar':      '#60A5FA',
    'status-grid':       '#4ADE80',
    'alert-list':        '#FB7185',
    'service-heatmap':   '#4ADE80',
    'pipeline-flow':     '#67E8F9',
    'usa-map':           '#4ADE80',
    'security-scorecard':'#FB7185',
  };

  (dash.widgets || []).forEach(wc => {
    const x  = (wc.position.col - 1) * cw;
    const y  = (wc.position.row - 1) * rh;
    const bw = (wc.position.colSpan || 1) * cw - 1;
    const bh = (wc.position.rowSpan || 1) * rh - 1;
    ctx.fillStyle = TYPE_COLORS[wc.type] || '#8B75B0';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(x + 1, y + 1, bw - 1, bh - 1);
    ctx.globalAlpha = 1;
  });
}
```

**Step 3: Add drag-sort CSS to studio.css**

```css
/* ── Dashboard drag-sort ── */
.nav-drag-handle {
  color: var(--t3);
  cursor: grab;
  font-size: 12px;
  padding: 0 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}

.dashboard-nav-item:hover .nav-drag-handle { opacity: 1; }
.dashboard-nav-item.dragging { opacity: 0.4; }
.dashboard-nav-item.drag-over { border-top: 2px solid var(--mh-pink); }

/* ── Dashboard thumbnails ── */
.dash-thumb {
  border-radius: 2px;
  flex-shrink: 0;
  border: 1px solid var(--border);
}
```

**Step 4: Restart and test**

```bash
sudo systemctl restart tv-dashboards
```

Sidebar should show colored mini-grid thumbnails next to each dashboard name. Hover to see drag handle (⠇). Drag a row up/down — drop indicator line appears, release to reorder.

**Step 5: Commit**

```bash
git add public/js/studio.js public/css/studio.css
git commit -m "feat: drag-to-reorder dashboards with canvas thumbnails and live API sync"
```

---

## Final: Version Bumps + Push PR

**Step 1: Bump studio.js and studio.css versions in studio.html**

```html
<link rel="stylesheet" href="/css/studio.css?v=6">
...
<script src="/js/studio-canvas.js?v=4"></script>
<script src="/js/studio.js?v=5"></script>
```

**Step 2: Final restart and smoke test**

```bash
sudo systemctl restart tv-dashboards
```

Verify all four capabilities work end-to-end:
- [ ] Drag widget → grid overlay appears → snap to cell → drop moves widget
- [ ] Hover resize handle → badge shows `W×H` live
- [ ] Position inputs are read-only
- [ ] Queries tab → list loads → click query → Run → results appear
- [ ] Save Query / Save as New / Assign to Widget all work
- [ ] Data Sources tab → status dots correct → click source → Test Connection works
- [ ] Dashboard list shows thumbnails
- [ ] Drag dashboard row → reorder → TV rotation order updates

**Step 3: Create PR**

```bash
git checkout -b feat/studio-enhancements
git push -u origin feat/studio-enhancements
gh pr create --title "feat: studio visual editor, query preview, data source UI, dashboard reorder"
```
