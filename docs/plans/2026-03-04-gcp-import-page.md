# GCP Import Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a dedicated `/admin/import` page with a 3-panel browser (dashboards list | tile checklist | live preview) that lets engineers browse GCP dashboards, preview chart tiles with real data, select a batch, and add them directly to the active TV dashboard.

**Architecture:** New Elysia `GET /admin/import` route serves `public/import.html`. A standalone `GcpImportPage` class in `public/js/importer.js` orchestrates the UI using existing API endpoints: `GET /api/gcp/dashboards`, `POST /api/explore/gcp`, `POST /api/queries/gcp`, and `PUT /api/dashboards/:id`. No new server endpoints needed. Studio gets a navigation button and sidebar width bump.

**Tech Stack:** Bun, Elysia.js, vanilla JS (`createElement`/`textContent` only — never `innerHTML` with variables), `window.Widgets`, existing `dashboard.css` + `studio.css`.

---

### Task 1: Elysia route + `public/import.html` shell

**Files:**
- Create: `public/import.html`
- Modify: `server/index.js` (add GET /admin/import route)

**Step 1: Add route to `server/index.js`**

Find the `.get('/admin', ...)` route (around line 218). Add immediately after it:

```js
  .get('/admin/import', () => {
    const importHtml = readFileSync(join(publicDir, 'import.html'), 'utf8');
    return new Response(importHtml, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  })
```

**Step 2: Create `public/import.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Import from GCP — MadHive Studio</title>
  <link rel="stylesheet" href="/css/dashboard.css?v=12">
  <link rel="stylesheet" href="/css/studio.css?v=11">
  <link rel="stylesheet" href="/css/importer.css?v=1">
</head>
<body class="studio-body">

  <!-- Top bar -->
  <header class="studio-topbar">
    <div class="studio-brand">
      <a href="/admin" class="imp-back-link">&#8592; Studio</a>
    </div>
    <div class="imp-topbar-title">Import from GCP Dashboards</div>
    <div class="studio-actions">
      <label class="imp-project-label">Project
        <select id="imp-project" class="imp-project-select">
          <option value="mad-master">mad-master</option>
          <option value="mad-data">mad-data</option>
          <option value="mad-audit">mad-audit</option>
          <option value="mad-looker-enterprise">mad-looker-enterprise</option>
        </select>
      </label>
    </div>
  </header>

  <!-- 3-panel layout -->
  <div class="imp-layout">

    <!-- Left: Dashboard list -->
    <aside class="imp-left">
      <div class="imp-panel-header">
        <span class="imp-panel-title">Dashboards</span>
        <input id="imp-search" type="text" class="imp-search" placeholder="Search&#8230;">
      </div>
      <div id="imp-dash-list" class="imp-dash-list">
        <div class="imp-loading">Loading&#8230;</div>
      </div>
    </aside>

    <!-- Center: Tile list -->
    <main class="imp-center">
      <div class="imp-panel-header">
        <span class="imp-panel-title" id="imp-dash-name">Select a dashboard</span>
        <span class="imp-selection-count" id="imp-sel-count"></span>
      </div>
      <div id="imp-tile-list" class="imp-tile-list">
        <div class="imp-empty">Select a dashboard on the left to see its charts.</div>
      </div>
    </main>

    <!-- Right: Live preview -->
    <aside class="imp-right">
      <div class="imp-panel-header">
        <span class="imp-panel-title">Live Preview</span>
      </div>
      <div id="imp-preview-area" class="imp-preview-area">
        <div class="imp-empty">Click a chart tile to preview its data.</div>
      </div>
      <div id="imp-preview-controls" class="imp-preview-controls" style="display:none">
        <label class="imp-ctrl-label">Type
          <select id="imp-widget-type" class="imp-select">
            <option value="big-number">Big Number</option>
            <option value="stat-card">Stat Card</option>
            <option value="gauge">Gauge</option>
            <option value="line-chart">Line Chart</option>
            <option value="bar-chart">Bar Chart</option>
            <option value="table">Table</option>
          </select>
        </label>
        <label class="imp-ctrl-label">Window
          <select id="imp-time-window" class="imp-select">
            <option value="5">5 min</option>
            <option value="10">10 min</option>
            <option value="30" selected>30 min</option>
            <option value="60">1 hour</option>
          </select>
        </label>
        <div id="imp-status" class="imp-status"></div>
      </div>
      <div class="imp-add-bar">
        <label class="imp-ctrl-label">Add to
          <select id="imp-target-dash" class="imp-select">
            <option value="">Loading&#8230;</option>
          </select>
        </label>
        <button id="imp-add-btn" class="studio-btn primary" disabled>Add to Dashboard</button>
      </div>
    </aside>

  </div>

  <script src="/js/us-states.js?v=11"></script>
  <script src="/js/charts.js?v=18"></script>
  <script src="/js/widgets.js?v=11"></script>
  <script src="/js/importer.js?v=1"></script>
</body>
</html>
```

**Step 3: Smoke test**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s -o /dev/null -w "%{http_code}" http://tv:3000/admin/import
```
Expected: `200`

**Step 4: Commit**
```bash
git add public/import.html server/index.js
git commit -m "feat: add GET /admin/import route and import.html shell"
```

---

### Task 2: `public/css/importer.css` — 3-panel layout styles

**Files:**
- Create: `public/css/importer.css`

**Step 1: Create the file**

```css
/* ===========================================================================
   GCP Import Page — 3-panel browser
   =========================================================================== */

/* ── Layout ── */
.imp-layout {
  display:    flex;
  height:     calc(100vh - var(--studio-topbar-h));
  overflow:   hidden;
}

/* ── Top bar extras ── */
.imp-back-link {
  color:           var(--t2);
  text-decoration: none;
  font-size:       13px;
  font-weight:     600;
  padding:         4px 8px;
  border-radius:   4px;
  transition:      color 0.15s;
}
.imp-back-link:hover { color: var(--t1); }

.imp-topbar-title {
  font-size:      14px;
  font-weight:    700;
  color:          var(--t1);
  letter-spacing: 0.04em;
}

.imp-project-label {
  display:     flex;
  align-items: center;
  gap:         6px;
  font-size:   11px;
  font-weight: 700;
  color:       var(--t3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.imp-project-select,
.imp-select {
  background:    var(--bg-input, #1a1a2e);
  border:        1px solid var(--border);
  border-radius: 4px;
  color:         var(--t1);
  font-size:     12px;
  padding:       4px 8px;
}

/* ── Panels ── */
.imp-left {
  width:        240px;
  flex-shrink:  0;
  border-right: 1px solid var(--border);
  display:      flex;
  flex-direction: column;
  overflow:     hidden;
}

.imp-center {
  flex:         1;
  display:      flex;
  flex-direction: column;
  overflow:     hidden;
  border-right: 1px solid var(--border);
}

.imp-right {
  width:        340px;
  flex-shrink:  0;
  display:      flex;
  flex-direction: column;
  overflow:     hidden;
}

/* ── Panel headers ── */
.imp-panel-header {
  padding:       10px 14px;
  border-bottom: 1px solid var(--border);
  display:       flex;
  align-items:   center;
  justify-content: space-between;
  flex-shrink:   0;
  gap:           8px;
}

.imp-panel-title {
  font-size:      11px;
  font-weight:    700;
  color:          var(--t3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.imp-selection-count {
  font-size:  11px;
  color:      var(--accent, #7c3aed);
  font-weight: 600;
}

/* ── Search ── */
.imp-search {
  flex:          1;
  background:    var(--bg-input, #1a1a2e);
  border:        1px solid var(--border);
  border-radius: 4px;
  color:         var(--t1);
  font-size:     11px;
  padding:       4px 8px;
  min-width:     0;
}
.imp-search:focus { outline: none; border-color: var(--accent, #7c3aed); }

/* ── Dashboard list ── */
.imp-dash-list {
  flex:       1;
  overflow-y: auto;
  padding:    6px 0;
}

.imp-dash-row {
  padding:     9px 14px;
  cursor:      pointer;
  font-size:   12px;
  color:       var(--t2);
  border-left: 3px solid transparent;
  transition:  background 0.1s, border-color 0.1s;
  display:     flex;
  align-items: center;
  justify-content: space-between;
  gap:         6px;
}
.imp-dash-row:hover { background: var(--hover, rgba(255,255,255,0.05)); }
.imp-dash-row.active {
  background:   rgba(124,58,237,0.12);
  border-color: var(--accent, #7c3aed);
  color:        var(--t1);
  font-weight:  600;
}
.imp-dash-tile-count {
  font-size: 10px;
  color:     var(--t3);
  flex-shrink: 0;
}

/* ── Tile list ── */
.imp-tile-list {
  flex:       1;
  overflow-y: auto;
  padding:    6px 0;
}

.imp-tile-row {
  display:     flex;
  align-items: flex-start;
  gap:         10px;
  padding:     9px 14px;
  cursor:      pointer;
  border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.04));
  transition:  background 0.1s;
}
.imp-tile-row:hover     { background: var(--hover, rgba(255,255,255,0.04)); }
.imp-tile-row.previewing { background: rgba(124,58,237,0.08); }
.imp-tile-row.disabled  { opacity: 0.4; pointer-events: none; }

.imp-tile-row input[type="checkbox"] {
  margin-top:   3px;
  flex-shrink:  0;
  accent-color: var(--accent, #7c3aed);
}

.imp-tile-info  { flex: 1; min-width: 0; }
.imp-tile-name  {
  font-size:     12px;
  font-weight:   500;
  color:         var(--t1);
  white-space:   nowrap;
  overflow:      hidden;
  text-overflow: ellipsis;
}
.imp-tile-metric {
  font-size:     10px;
  color:         var(--t3);
  font-family:   monospace;
  white-space:   nowrap;
  overflow:      hidden;
  text-overflow: ellipsis;
  margin-top:    2px;
}
.imp-tile-conflict {
  font-size:    9px;
  color:        #f59e0b;
  background:   rgba(245,158,11,0.12);
  border:       1px solid rgba(245,158,11,0.3);
  border-radius: 3px;
  padding:      1px 5px;
  flex-shrink:  0;
  align-self:   center;
  white-space:  nowrap;
}

/* ── Preview area ── */
.imp-preview-area {
  flex:        1;
  display:     flex;
  align-items: center;
  justify-content: center;
  overflow:    hidden;
  padding:     16px;
  min-height:  0;
}

.imp-preview-widget-wrap {
  width:  100%;
  height: 100%;
}

/* ── Preview controls ── */
.imp-preview-controls {
  padding:       10px 14px;
  border-top:    1px solid var(--border);
  display:       flex;
  flex-direction: column;
  gap:           8px;
  flex-shrink:   0;
}

.imp-ctrl-label {
  display:     flex;
  align-items: center;
  gap:         8px;
  font-size:   10px;
  font-weight: 700;
  color:       var(--t3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.imp-ctrl-label .imp-select { flex: 1; }

/* ── Status badge ── */
.imp-status {
  font-size:  11px;
  min-height: 16px;
  color:      var(--t3);
}
.imp-status.ok    { color: #4ade80; }
.imp-status.warn  { color: #f59e0b; }
.imp-status.error { color: #ef4444; }

/* ── Add bar ── */
.imp-add-bar {
  padding:       12px 14px;
  border-top:    1px solid var(--border);
  display:       flex;
  align-items:   center;
  gap:           10px;
  flex-shrink:   0;
}
.imp-add-bar .imp-ctrl-label { flex: 1; }

/* ── Common states ── */
.imp-loading,
.imp-empty {
  font-size:  12px;
  color:      var(--t3);
  text-align: center;
  padding:    24px 16px;
}

.imp-error-msg {
  font-size:     11px;
  color:         #ef4444;
  background:    rgba(220,38,38,0.08);
  border:        1px solid rgba(220,38,38,0.2);
  border-radius: 4px;
  padding:       8px 12px;
  margin:        8px 14px;
}
```

**Step 2: Verify it loads**
```bash
curl -s http://tv:3000/css/importer.css | grep -c 'imp-'
```
Expected: at least 20 matches

**Step 3: Commit**
```bash
git add public/css/importer.css
git commit -m "feat: importer.css — 3-panel layout styles for /admin/import"
```

---

### Task 3: `public/js/importer.js` — GcpImportPage class

**Files:**
- Create: `public/js/importer.js`

**Critical:** Never use `innerHTML` with variable interpolation. All dynamic DOM via `createElement` + `textContent`.

**Step 1: Create `public/js/importer.js`**

```js
/* ===========================================================================
   GCP Import Page — browse GCP dashboards, preview live data, add to TV
   =========================================================================== */

(function () {
  'use strict';

  class GcpImportPage {
    constructor() {
      this._project     = 'mad-master';
      this._dashboards  = [];
      this._tiles       = [];
      this._lastRaw     = null;   // cached rawSeries from last explore call
      this._previewTile = null;   // tile currently shown in right panel
      this._widget      = null;   // active Widgets instance
      this._dashboards_all = []; // unfiltered list for search

      // DOM refs
      this._projectSel  = document.getElementById('imp-project');
      this._search      = document.getElementById('imp-search');
      this._dashList    = document.getElementById('imp-dash-list');
      this._dashName    = document.getElementById('imp-dash-name');
      this._selCount    = document.getElementById('imp-sel-count');
      this._tileList    = document.getElementById('imp-tile-list');
      this._previewArea = document.getElementById('imp-preview-area');
      this._previewCtrl = document.getElementById('imp-preview-controls');
      this._widgetType  = document.getElementById('imp-widget-type');
      this._timeWindow  = document.getElementById('imp-time-window');
      this._status      = document.getElementById('imp-status');
      this._targetDash  = document.getElementById('imp-target-dash');
      this._addBtn      = document.getElementById('imp-add-btn');

      this._bindEvents();
      this._loadDashboards();
      this._loadTargetDashboards();
    }

    _bindEvents() {
      this._projectSel?.addEventListener('change', () => {
        this._project = this._projectSel.value;
        this._loadDashboards();
      });

      this._search?.addEventListener('input', () => this._filterDashboards());

      this._widgetType?.addEventListener('change', () => this._onTypeChange());
      this._timeWindow?.addEventListener('change', () => {
        if (this._previewTile) this._runPreview(this._previewTile);
      });

      this._addBtn?.addEventListener('click', () => this._addToSashboard());
    }

    // ── Left panel: dashboard list ──────────────────────────────────────────

    async _loadDashboards() {
      this._setDashList('<div class="imp-loading">Loading dashboards\u2026</div>');
      try {
        const res  = await fetch('/api/gcp/dashboards?project=' + encodeURIComponent(this._project));
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Unknown error');
        this._dashboards_all = data.dashboards || [];
        this._renderDashList(this._dashboards_all);
      } catch (err) {
        this._setDashList('<div class="imp-error-msg">Could not load dashboards: ' + err.message.slice(0, 80) + '</div>', true);
      }
    }

    _filterDashboards() {
      const q = (this._search?.value || '').toLowerCase();
      const filtered = q
        ? this._dashboards_all.filter(d => d.displayName.toLowerCase().includes(q))
        : this._dashboards_all;
      this._renderDashList(filtered);
    }

    _renderDashList(dashboards) {
      if (!this._dashList) return;
      this._dashList.textContent = '';

      if (!dashboards.length) {
        const empty = document.createElement('div');
        empty.className = 'imp-empty';
        empty.textContent = 'No dashboards found.';
        this._dashList.appendChild(empty);
        return;
      }

      dashboards.forEach(d => {
        const row = document.createElement('div');
        row.className = 'imp-dash-row';
        row.dataset.name = d.name;

        const nameEl = document.createElement('span');
        nameEl.textContent = d.displayName;

        const countEl = document.createElement('span');
        countEl.className = 'imp-dash-tile-count';
        countEl.textContent = d.tileCount + ' charts';

        row.appendChild(nameEl);
        row.appendChild(countEl);
        row.addEventListener('click', () => this._selectDashboard(d, row));
        this._dashList.appendChild(row);
      });
    }

    async _selectDashboard(dashboard, rowEl) {
      // Highlight active row
      this._dashList.querySelectorAll('.imp-dash-row').forEach(r => r.classList.remove('active'));
      rowEl.classList.add('active');

      if (this._dashName) this._dashName.textContent = dashboard.displayName;
      this._setTileList('<div class="imp-loading">Loading tiles\u2026</div>');
      this._clearPreview();

      const shortId = dashboard.name.split('/').pop();
      try {
        const res  = await fetch('/api/gcp/dashboards/' + encodeURIComponent(shortId) + '?project=' + encodeURIComponent(this._project));
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Unknown error');
        this._tiles = data.tiles || [];
        this._renderTileList(this._tiles);
      } catch (err) {
        this._setTileList('<div class="imp-error-msg">Failed to load tiles: ' + err.message.slice(0, 80) + '</div>', true);
      }
    }

    // ── Center panel: tile list ─────────────────────────────────────────────

    _renderTileList(tiles) {
      if (!this._tileList) return;
      this._tileList.textContent = '';
      this._updateSelCount();

      if (!tiles.length) {
        const empty = document.createElement('div');
        empty.className = 'imp-empty';
        empty.textContent = 'No importable chart tiles in this dashboard.';
        this._tileList.appendChild(empty);
        return;
      }

      tiles.forEach((tile, i) => {
        const row = document.createElement('div');
        row.className = 'imp-tile-row';
        row.dataset.idx = i;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.idx = i;
        cb.addEventListener('change', () => {
          this._updateSelCount();
          this._updateAddBtn();
        });

        const info = document.createElement('div');
        info.className = 'imp-tile-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'imp-tile-name';
        nameEl.textContent = tile.name;

        const metricEl = document.createElement('div');
        metricEl.className = 'imp-tile-metric';
        metricEl.textContent = tile.metricType;

        info.appendChild(nameEl);
        info.appendChild(metricEl);
        row.appendChild(cb);
        row.appendChild(info);

        if (tile.conflictId) {
          const badge = document.createElement('span');
          badge.className = 'imp-tile-conflict';
          badge.textContent = '\u26a0 exists';
          badge.title = 'Already saved as: ' + tile.conflictId;
          row.appendChild(badge);
        }

        // Click row (not checkbox) → preview
        row.addEventListener('click', (e) => {
          if (e.target === cb) return;
          this._tileList.querySelectorAll('.imp-tile-row').forEach(r => r.classList.remove('previewing'));
          row.classList.add('previewing');
          this._runPreview(tile);
        });

        this._tileList.appendChild(row);
      });
    }

    _updateSelCount() {
      const n = this._tileList
        ? this._tileList.querySelectorAll('input[type="checkbox"]:checked').length
        : 0;
      if (this._selCount) {
        this._selCount.textContent = n > 0 ? n + ' selected' : '';
      }
      return n;
    }

    _updateAddBtn() {
      const n = this._updateSelCount();
      if (this._addBtn) {
        this._addBtn.disabled = n === 0;
        this._addBtn.textContent = n > 0 ? 'Add ' + n + ' to Dashboard' : 'Add to Dashboard';
      }
    }

    // ── Right panel: live preview ───────────────────────────────────────────

    async _runPreview(tile) {
      this._previewTile = tile;
      this._lastRaw     = null;

      // Show controls, set loading state
      if (this._previewCtrl) this._previewCtrl.style.display = '';
      this._setStatus('querying');
      this._clearWidgetCanvas();

      // Auto-suggest widget type based on aggregation
      if (this._widgetType && tile.aggregation) {
        const reducer = tile.aggregation.crossSeriesReducer || '';
        if (reducer === 'REDUCE_NONE' || !reducer) {
          this._widgetType.value = 'big-number';
        } else {
          this._widgetType.value = 'bar-chart';
        }
      }

      const timeWindow = parseInt(this._timeWindow?.value || '30', 10);
      const widgetType = this._widgetType?.value || 'big-number';

      try {
        const res  = await fetch('/api/explore/gcp', {
          method:  'POST',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify({
            metricType:  tile.metricType,
            project:     this._project,
            filters:     tile.filters || '',
            aggregation: tile.aggregation || {},
            timeWindow,
            widgetType,
          }),
        });
        const data = await res.json();

        if (!data.success) {
          this._setStatus('error', data.error || 'Query failed');
          return;
        }

        this._lastRaw = data.rawSeries || [];

        if (!data.rawSeries?.length) {
          this._setStatus('warn', 'No data for this time window');
        } else {
          this._setStatus('ok', data.seriesCount + ' series \u00b7 ' + data.executionMs + 'ms');
        }

        this._renderPreviewWidget(data.widgetData, widgetType);
      } catch (err) {
        this._setStatus('error', err.message);
      }
    }

    _onTypeChange() {
      if (!this._lastRaw || !this._previewTile) return;
      const type = this._widgetType?.value || 'big-number';
      // Client-side re-transform from cached rawSeries (no re-fetch)
      const vals = this._lastRaw.map(r => r.value);
      let widgetData = null;
      switch (type) {
        case 'big-number':
        case 'stat-card':
          widgetData = { value: vals[0], sparkline: vals.slice(0, 20), unit: '' };
          break;
        case 'gauge':
          widgetData = { value: vals[0], min: 0, max: 100, unit: '' };
          break;
        case 'line-chart':
          widgetData = { series: [{ label: 'Value', data: vals.slice(0, 30) }], timestamps: [] };
          break;
        case 'bar-chart': {
          const labelKey = this._lastRaw[0] && Object.keys(this._lastRaw[0]).find(k => k !== 'timestamp' && k !== 'value');
          const seen = new Map();
          this._lastRaw.forEach(r => { const l = String(r[labelKey] || 'Value'); if (!seen.has(l)) seen.set(l, r.value); });
          widgetData = { bars: [...seen.entries()].slice(0, 10).map(([label, value]) => ({ label, value })) };
          break;
        }
        case 'table': {
          if (this._lastRaw.length) {
            const cols = Object.keys(this._lastRaw[0]);
            widgetData = {
              columns: cols.map(k => ({ key: k, label: k, align: typeof this._lastRaw[0][k] === 'number' ? 'right' : 'left', format: typeof this._lastRaw[0][k] === 'number' ? 'number' : undefined })),
              rows: this._lastRaw.slice(0, 50),
            };
          }
          break;
        }
        default:
          widgetData = { value: vals[0], unit: '' };
      }
      this._renderPreviewWidget(widgetData, type);
    }

    _renderPreviewWidget(widgetData, widgetType) {
      this._clearWidgetCanvas();
      if (!widgetData || !window.Widgets) return;

      const wrap = document.createElement('div');
      wrap.className = 'imp-preview-widget-wrap';
      if (this._previewArea) {
        this._previewArea.textContent = '';
        this._previewArea.appendChild(wrap);
      }

      try {
        this._widget = window.Widgets.create(widgetType, wrap, { type: widgetType });
        if (this._widget?.update) this._widget.update(widgetData);
      } catch (_) {
        const msg = document.createElement('div');
        msg.className = 'imp-empty';
        msg.textContent = 'Not supported for this data shape.';
        wrap.textContent = '';
        wrap.appendChild(msg);
      }
    }

    _clearWidgetCanvas() {
      if (this._widget?.destroy) this._widget.destroy();
      this._widget = null;
      if (this._previewArea) {
        const placeholder = document.createElement('div');
        placeholder.className = 'imp-empty';
        placeholder.textContent = 'Loading preview\u2026';
        this._previewArea.textContent = '';
        this._previewArea.appendChild(placeholder);
      }
    }

    _clearPreview() {
      if (this._widget?.destroy) this._widget.destroy();
      this._widget = null;
      this._lastRaw = null;
      this._previewTile = null;
      if (this._previewArea) {
        const placeholder = document.createElement('div');
        placeholder.className = 'imp-empty';
        placeholder.textContent = 'Click a chart tile to preview its data.';
        this._previewArea.textContent = '';
        this._previewArea.appendChild(placeholder);
      }
      if (this._previewCtrl) this._previewCtrl.style.display = 'none';
      if (this._status) { this._status.textContent = ''; this._status.className = 'imp-status'; }
    }

    _setStatus(state, message) {
      if (!this._status) return;
      const icons = { querying: '\u27f3 Querying GCP\u2026', ok: '\u2713 ', warn: '\u26a0 ', error: '\u2717 ' };
      this._status.textContent = (icons[state] || '') + (message || '');
      this._status.className   = 'imp-status ' + (state === 'ok' ? 'ok' : state === 'warn' ? 'warn' : state === 'error' ? 'error' : '');
    }

    // ── Target dashboard list ────────────────────────────────────────────────

    async _loadTargetDashboards() {
      if (!this._targetDash) return;
      try {
        const res  = await fetch('/api/config');
        const data = await res.json();
        const dbs  = data.dashboards || [];
        this._targetDash.textContent = '';

        // Restore last-used selection from localStorage
        const lastId = localStorage.getItem('lastActiveDash') || '';

        dbs.forEach(d => {
          const opt = document.createElement('option');
          opt.value       = d.id;
          opt.textContent = d.name || d.id;
          if (d.id === lastId) opt.selected = true;
          this._targetDash.appendChild(opt);
        });
      } catch (_) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Could not load dashboards';
        this._targetDash.appendChild(opt);
      }
    }

    // ── Add to Dashboard ─────────────────────────────────────────────────────

    async _addToSashboard() {
      const dashId = this._targetDash?.value;
      if (!dashId) { alert('Select a target dashboard first.'); return; }

      const checked = [...(this._tileList?.querySelectorAll('input[type="checkbox"]:checked') || [])];
      if (!checked.length) return;

      const tiles = checked.map(cb => this._tiles[parseInt(cb.dataset.idx, 10)]).filter(t => t?.metricType);
      if (!tiles.length) return;

      this._addBtn.disabled    = true;
      this._addBtn.textContent = 'Adding\u2026';

      try {
        // 1. Save any new queries (skip if conflictId)
        const queryIds = await Promise.all(tiles.map(async tile => {
          if (tile.conflictId) return tile.conflictId;
          const body = {
            id:          tile.id,
            name:        tile.name,
            metricType:  tile.metricType,
            project:     this._project,
            filters:     tile.filters || '',
            aggregation: tile.aggregation || {},
            timeWindow:  parseInt(this._timeWindow?.value || '30', 10),
            widgetTypes: [],
          };
          const res  = await fetch('/api/queries/gcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
          const data = await res.json();
          return data.query?.id || tile.id;
        }));

        // 2. Fetch current dashboard and append widgets
        const cfgRes   = await fetch('/api/config');
        const cfgData  = await cfgRes.json();
        const dashboard = (cfgData.dashboards || []).find(d => d.id === dashId);
        if (!dashboard) throw new Error('Dashboard not found: ' + dashId);

        if (!dashboard.widgets) dashboard.widgets = [];
        const gridCols = dashboard.grid?.columns || 4;

        // Find next available position (after last widget)
        let col = 1, row = 1;
        if (dashboard.widgets.length > 0) {
          const last = dashboard.widgets[dashboard.widgets.length - 1];
          const nextCol = (last.position?.col || 1) + 1;
          col = nextCol > gridCols ? 1 : nextCol;
          row = nextCol > gridCols ? (last.position?.row || 1) + 1 : (last.position?.row || 1);
        }

        tiles.forEach((tile, i) => {
          dashboard.widgets.push({
            id:       tile.id + '-' + Date.now() + '-' + i,
            type:     this._widgetType?.value || 'big-number',
            title:    tile.name,
            source:   'gcp',
            queryId:  queryIds[i],
            position: { col, row, colSpan: 1, rowSpan: 1 },
          });
          col++;
          if (col > gridCols) { col = 1; row++; }
        });

        // 3. Save updated dashboard
        const putRes = await fetch('/api/dashboards/' + encodeURIComponent(dashId), {
          method:  'PUT',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify(dashboard),
        });
        if (!putRes.ok) throw new Error('Failed to save dashboard');

        localStorage.setItem('lastActiveDash', dashId);

        // 4. Redirect to Studio
        const n = tiles.length;
        setTimeout(() => { window.location.href = '/admin'; }, 1200);
        this._addBtn.textContent = '\u2713 ' + n + ' widget' + (n !== 1 ? 's' : '') + ' added! Returning\u2026';
      } catch (err) {
        this._addBtn.disabled    = false;
        this._addBtn.textContent = 'Add to Dashboard';
        alert('Error: ' + err.message);
      }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    _setDashList(html, isError) {
      if (!this._dashList) return;
      this._dashList.textContent = '';
      const el = document.createElement('div');
      el.className = isError ? 'imp-error-msg' : 'imp-loading';
      el.textContent = html.replace(/<[^>]+>/g, '');  // strip any tags, use plain text
      this._dashList.appendChild(el);
    }

    _setTileList(html, isError) {
      if (!this._tileList) return;
      this._tileList.textContent = '';
      const el = document.createElement('div');
      el.className = isError ? 'imp-error-msg' : 'imp-loading';
      el.textContent = html.replace(/<[^>]+>/g, '');
      this._tileList.appendChild(el);
    }
  }

  // Boot
  document.addEventListener('DOMContentLoaded', () => {
    new GcpImportPage();
  });
})();
```

**Step 2: Restart and smoke test**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s http://tv:3000/admin/import | grep -c 'imp-layout\|imp-dash-list'
```
Expected: 2

**Step 3: Commit**
```bash
git add public/js/importer.js
git commit -m "feat: GcpImportPage — 3-panel browse/preview/add flow in /admin/import"
```

---

### Task 4: Studio navigation changes

**Files:**
- Modify: `public/studio.html`
- Modify: `public/js/studio.js`

**Step 1: Add `[+ Import from GCP]` button to Studio top bar**

In `public/studio.html`, find the `.studio-actions` div (around line 21):
```html
    <div class="studio-actions">
      <span id="dirty-indicator" style="display:none">&#9679; Unsaved</span>
```

Add this link before `dirty-indicator`:
```html
      <a href="/admin/import" class="studio-btn ghost small">&#8595; Import from GCP</a>
```

**Step 2: Change Queries toolbar button to navigate instead of open modal**

In `public/studio.html`, find `#import-gcp-dashboards-btn` (around line 114):
```html
          <button id="import-gcp-dashboards-btn" class="btn-import-gcp" title="Import queries from GCP Cloud Monitoring dashboards">
            &#8595; Import from GCP
          </button>
```

Replace with an anchor tag:
```html
          <a href="/admin/import" class="btn-import-gcp" title="Browse GCP dashboards and import charts">
            &#8595; Import from GCP
          </a>
```

**Step 3: Remove the old GcpDashboardImporter instantiation from `studio.js`**

In `public/js/studio.js`, find:
```js
      try { this.gcpImporter = new GcpDashboardImporter(this); } catch (e) { console.error('[studio] GcpDashboardImporter init failed:', e); }
```

Remove that line — the importer modal is replaced by the dedicated page.

**Step 4: Restart and verify**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s http://tv:3000/admin | grep -c 'Import from GCP'
```
Expected: 2 (top bar + queries toolbar)

**Step 5: Commit**
```bash
git add public/studio.html public/js/studio.js
git commit -m "feat: add Import from GCP navigation to Studio top bar and Queries toolbar"
```

---

### Task 5: Studio sidebar width increase

**Files:**
- Modify: `public/css/studio.css` (line 8)

**Step 1: Increase sidebar width**

Find (line 8):
```css
  --studio-sidebar-w: 220px;
```

Replace with:
```css
  --studio-sidebar-w: 280px;
```

**Step 2: Add resize affordance to `.studio-sidebar`**

Find `.studio-sidebar {` (around line 117). Add to its existing rules:
```css
  resize:    horizontal;
  overflow:  auto;
  min-width: 200px;
  max-width: 520px;
```

Note: `resize: horizontal` requires `overflow` not `hidden`. The sidebar previously had `overflow: hidden` — changing to `overflow: auto` enables drag-to-resize while keeping content scrollable.

**Step 3: Restart and verify**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s http://tv:3000/admin | grep -c 'studio-sidebar'
```
Expected: at least 1 (confirming the page loads)

**Step 4: Commit**
```bash
git add public/css/studio.css
git commit -m "fix: increase Studio sidebar to 280px and add resize handle"
```

---

### Task 6: Final integration check

**Step 1: Run full test suite**
```bash
git restore config/ && bun test 2>&1 | tail -5
```
Expected: existing tests pass, 0 regressions (all changes are UI-only except the new route)

**Step 2: Verify the import page end-to-end**
```bash
# Route returns 200
curl -s -o /dev/null -w "%{http_code}" http://tv:3000/admin/import
# JS and CSS assets load
curl -s -o /dev/null -w "%{http_code}" http://tv:3000/js/importer.js
curl -s -o /dev/null -w "%{http_code}" http://tv:3000/css/importer.css
```
Expected: all 200

**Step 3: Verify Studio navigation**
```bash
curl -s http://tv:3000/admin | python3 -c "
import sys; h = sys.stdin.read()
print('top bar import link:', '/admin/import' in h)
print('queries toolbar link:', 'href=\"/admin/import\"' in h)
"
```
Expected: both True

**Step 4: Check git log**
```bash
git log --oneline -7
```
Expected commits:
- `fix: increase Studio sidebar to 280px and add resize handle`
- `feat: add Import from GCP navigation to Studio top bar and Queries toolbar`
- `feat: GcpImportPage — 3-panel browse/preview/add flow in /admin/import`
- `feat: importer.css — 3-panel layout styles`
- `feat: add GET /admin/import route and import.html shell`
