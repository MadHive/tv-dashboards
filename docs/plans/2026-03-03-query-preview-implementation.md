# Query Preview & Data Source Explorer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add live query run + mini-widget preview to the Sources tab (shows queries for a source) and Queries tab (shows rendered result in a widget preview canvas).

**Architecture:** New `GET /api/queries/:source/:id/preview` endpoint runs a saved query and returns widget-ready data. The query editor panel gains a widget-type selector and a small canvas that renders the result using the same `Widgets.create()` + `charts.js` code as the TV display. The Sources panel's `openDatasourceEditor` is refactored to show source queries by default with credentials accessible via a toggle.

**Tech Stack:** Vanilla JS, Canvas API, Elysia.js, existing `Widgets.create()` + `window.Widgets` factory, `window.C` (charts.js)

---

## Reference Files

Read these before starting:
- `server/query-routes.js` — where `POST /:source/test` lives; new preview route goes here
- `server/data-sources/gcp.js` lines 76-125 — `executeQuery` method (returns `{ data: transformed }`)
- `server/query-manager.js` — `getQuery(source, id)` for loading saved query by ID
- `public/js/studio.js` — `openQueryEditor`, `_runQuery`, `openDatasourceEditor` methods
- `public/studio.html` — `#query-editor-panel`, `#datasource-editor-panel`, `#panel-queries`
- `public/css/studio.css` — `.qe-*` styles (query editor panel), `.ds-*` styles (source list)
- Current studio.js version: **v=18**, studio.css: **v=9**

Key patterns:
- `window.Widgets.create(type, container, { type })` returns `{ update(data) }` widget instance
- `window.C.gauge(canvas, data)` / `.bigNumber(canvas, data)` etc. for canvas rendering
- `this.showDashboardProps()` restores the properties panel when closing side panels

---

## Task 1: Add `GET /api/queries/:source/:id/preview` endpoint

**Files:**
- Modify: `server/query-routes.js` — add after the existing `GET /:source/:id` route

**Step 1: Add the route**

In `server/query-routes.js`, after the `GET /:source/:id` route (around line 80), add:

```js
  // Run a saved query by ID and return widget-ready transformed data
  .get('/:source/:id/preview', async ({ params, query }) => {
    try {
      const savedQuery = await getQuery(params.source, params.id);
      if (!savedQuery) {
        return new Response(
          JSON.stringify({ success: false, error: `Query not found: ${params.id}` }),
          { status: 404, headers: { 'content-type': 'application/json' } }
        );
      }

      const widgetType = query.type || 'big-number';

      if (params.source === 'gcp') {
        const gcpSource = dataSourceRegistry.getSource('gcp');
        const result = await gcpSource.executeQuery({
          id:      'preview',
          queryId: params.id,
          type:    widgetType,
        });
        return {
          success:    true,
          source:     'gcp',
          queryId:    params.id,
          widgetType,
          widgetData: result.data || null,
          metricType: savedQuery.metricType,
        };
      }

      if (params.source === 'bigquery') {
        const bqSource = dataSourceRegistry.getSource('bigquery');
        const result = await bqSource.fetchMetrics({
          id:      'preview',
          queryId: params.id,
          type:    widgetType,
        });
        return {
          success:    true,
          source:     'bigquery',
          queryId:    params.id,
          widgetType,
          widgetData: result.data || null,
        };
      }

      // Other sources: return mock structure
      return {
        success:    true,
        source:     params.source,
        queryId:    params.id,
        widgetType,
        widgetData: { value: 0 },
      };
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: { tags: ['queries'], summary: 'Preview a saved query as widget data' },
  })
```

**Step 2: Run tests**
```bash
bun test tests/unit tests/integration tests/helpers tests/components 2>&1 | tail -4
```
Expected: all pass (new route, no test changes needed).

**Step 3: Smoke test**
```bash
# Get a real GCP query ID first
curl -s "http://tv:3000/api/queries/gcp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['queries'][0]['id'] if d['queries'] else 'none')"
# Then preview it
curl -s "http://tv:3000/api/queries/gcp/cloudrun-request-count-madmaster/preview?type=big-number" | python3 -c "import sys,json; d=json.load(sys.stdin); print('success:', d.get('success'), '| widgetData:', str(d.get('widgetData',''))[:80])"
```
Expected: `success: True | widgetData: {'value': ..., 'unit': ...}` or similar.

**Step 4: Commit**
```bash
git add server/query-routes.js
git commit -m "feat: GET /api/queries/:source/:id/preview — run saved query, return widget data"
```

---

## Task 2: Add widget type selector + preview canvas to query editor HTML

**Files:**
- Modify: `public/studio.html`

**Step 1: Add widget type selector and preview canvas inside `#qe-results`**

Find the `qe-results` div in the query editor panel:
```html
        <!-- Results preview -->
        <div class="qe-results">
          <div class="qe-results-toolbar">
            <button id="qe-run" class="studio-btn primary small">▶ Run</button>
            <span id="qe-run-status" class="qe-run-status"></span>
          </div>
          <div id="qe-results-body" class="qe-results-body">
            <div class="mb-status">Run query to see results</div>
          </div>
        </div>
```

Replace with:
```html
        <!-- Results preview -->
        <div class="qe-results">
          <div class="qe-results-toolbar">
            <button id="qe-run" class="studio-btn primary small">&#9654; Run</button>
            <label class="qe-type-label">
              <select id="qe-preview-type" class="qe-select">
                <option value="big-number">Big Number</option>
                <option value="stat-card">Stat Card</option>
                <option value="gauge">Gauge</option>
                <option value="bar-chart">Bar Chart</option>
              </select>
            </label>
            <span id="qe-run-status" class="qe-run-status"></span>
          </div>
          <div id="qe-preview-canvas-container" class="qe-preview-canvas-container" style="display:none">
            <canvas id="qe-preview-canvas" class="qe-preview-canvas"></canvas>
          </div>
          <div id="qe-results-body" class="qe-results-body">
            <div class="mb-status">Run query to see results</div>
          </div>
        </div>
```

**Step 2: Add CSS at the end of studio.css**

```css
/* ── Query preview canvas ── */
.qe-type-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--t3);
  letter-spacing: 1px;
  font-family: var(--font-display);
  text-transform: uppercase;
}

.qe-preview-canvas-container {
  flex-shrink: 0;
  height: 120px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  margin: 4px 0;
}

.qe-preview-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
```

**Step 3: Bump studio.css version**

Find `studio.css?v=9` and change to `?v=10`.

**Step 4: Commit**
```bash
git add public/studio.html public/css/studio.css
git commit -m "feat: add widget type selector and preview canvas to query editor"
```

---

## Task 3: Implement widget preview rendering in studio.js

**Files:**
- Modify: `public/js/studio.js` — `_runQuery()` method and a new `_renderQueryPreview()` helper

**Step 1: Replace `_runQuery()` to use the preview endpoint**

Find `_runQuery()` in studio.js (search for `async _runQuery()`). Replace the entire method with:

```js
    async _runQuery() {
      const runBtn   = document.getElementById('qe-run');
      const statusEl = document.getElementById('qe-run-status');
      const bodyEl   = document.getElementById('qe-results-body');
      const canvasCtr = document.getElementById('qe-preview-canvas-container');

      if (!this._activeQuery || !this._activeSource) return;

      runBtn.setAttribute('disabled', '');
      statusEl.textContent = 'Running…';
      statusEl.style.color = 'var(--t3)';
      if (canvasCtr) canvasCtr.style.display = 'none';

      const previewType = document.getElementById('qe-preview-type')?.value || 'big-number';
      const t0 = Date.now();

      try {
        const res  = await fetch(
          '/api/queries/' + encodeURIComponent(this._activeSource) +
          '/' + encodeURIComponent(this._activeQuery.id) +
          '/preview?type=' + encodeURIComponent(previewType)
        );
        const data = await res.json();
        const ms   = Date.now() - t0;

        if (!data.success || !data.widgetData) {
          statusEl.textContent = '✗ ' + (data.error || 'No data');
          statusEl.style.color = 'var(--red)';
          bodyEl.textContent = '';
          const errDiv = document.createElement('div');
          errDiv.className = 'mb-status';
          errDiv.textContent = data.error || 'Query returned no data';
          bodyEl.appendChild(errDiv);
          return;
        }

        statusEl.textContent = '✓ ' + ms + 'ms';
        statusEl.style.color = 'var(--green)';

        // Render widget preview in canvas
        this._renderQueryPreview(data.widgetData, previewType);

        // Show raw value summary in results body
        bodyEl.textContent = '';
        const val = data.widgetData.value;
        const summary = document.createElement('div');
        summary.className = 'mb-status';
        summary.textContent = val !== null && val !== undefined
          ? 'Value: ' + (typeof val === 'number' ? val.toLocaleString() : val)
          : 'No value returned';
        bodyEl.appendChild(summary);
      } catch (e) {
        statusEl.textContent = '✗ ' + e.message;
        statusEl.style.color = 'var(--red)';
      } finally {
        runBtn.removeAttribute('disabled');
      }
    }

    _renderQueryPreview(widgetData, widgetType) {
      const container = document.getElementById('qe-preview-canvas-container');
      const canvas    = document.getElementById('qe-preview-canvas');
      if (!container || !canvas || !window.Widgets) return;

      container.style.display = 'block';

      // Clear previous widget
      if (this._previewWidget && this._previewWidget.destroy) {
        this._previewWidget.destroy();
      }
      canvas.width  = canvas.offsetWidth  || 280;
      canvas.height = canvas.offsetHeight || 120;

      // Create a temporary container div for the widget
      const tmpDiv = document.createElement('div');
      tmpDiv.style.cssText = 'width:100%;height:120px;overflow:hidden;';

      try {
        this._previewWidget = window.Widgets.create(widgetType, tmpDiv, { type: widgetType });
        if (this._previewWidget && this._previewWidget.update) {
          this._previewWidget.update(widgetData);
        }
      } catch (e) {
        // Widget type not supported for preview — show value text
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
```

**Step 2: Wire the `qe-preview-type` change to re-render**

In `_bindQueryEditorActions()`, after the existing bindings, add:

```js
      const previewTypeSel = document.getElementById('qe-preview-type');
      if (previewTypeSel) {
        previewTypeSel.onchange = () => {
          if (this._lastPreviewData) {
            this._renderQueryPreview(this._lastPreviewData, previewTypeSel.value);
          }
        };
      }
```

Also save `data.widgetData` to `this._lastPreviewData` inside `_runQuery()` after a successful run:
```js
        this._lastPreviewData = data.widgetData;
```

**Step 3: Bump studio.js version**

Find `studio.js?v=18` and change to `?v=19`.

**Step 4: Run tests and commit**
```bash
bun test tests/unit tests/integration tests/helpers tests/components 2>&1 | tail -4
git add public/js/studio.js public/studio.html
git commit -m "feat: live widget preview canvas in query editor — run query, see result as widget"
```

---

## Task 4: Refactor datasource-editor-panel HTML to have two views

**Files:**
- Modify: `public/studio.html`

**Step 1: Replace the datasource-editor-panel content**

Find:
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
          <button id="dse-save" class="studio-btn primary small">Save Credentials</button>
          <button id="dse-test" class="studio-btn secondary small">&#9654; Test Connection</button>
          <span id="dse-test-result" class="qe-run-status"></span>
        </div>
      </div>
```

Replace with:
```html
      <!-- Data source editor panel — two views: query list (default) + credentials -->
      <div id="datasource-editor-panel" style="display:none" class="datasource-editor-panel">
        <div class="qe-header">
          <div>
            <div id="dse-name" class="qe-name"></div>
            <div id="dse-status" class="qe-source-badge"></div>
          </div>
          <button id="dse-close" class="modal-close">&#215;</button>
        </div>

        <!-- View 1: Query list (default) -->
        <div id="dse-query-view">
          <div id="dse-query-list" class="dse-query-list">
            <div class="mb-status">Loading queries…</div>
          </div>
          <div class="qe-actions">
            <button id="dse-edit-creds" class="studio-btn ghost small">&#9998; Edit Credentials</button>
          </div>
        </div>

        <!-- View 2: Credential form (toggled) -->
        <div id="dse-cred-view" style="display:none">
          <div id="dse-fields" class="dse-fields"></div>
          <div class="qe-actions">
            <button id="dse-save" class="studio-btn primary small">Save Credentials</button>
            <button id="dse-test" class="studio-btn secondary small">&#9654; Test Connection</button>
            <span id="dse-test-result" class="qe-run-status"></span>
            <button id="dse-back" class="studio-btn ghost small">&#8592; Back</button>
          </div>
        </div>
      </div>
```

**Step 2: Add CSS for query list rows in source panel**

Add to studio.css:
```css
/* ── Source panel query list ── */
.dse-query-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.dse-query-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  border-left: 2px solid transparent;
  color: var(--t2);
  font-family: var(--font-body);
  font-size: 12px;
  transition: background 0.1s, border-color 0.1s;
}

.dse-query-row:hover {
  background: var(--bg-card);
  border-left-color: var(--mh-pink);
}

.dse-query-row-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dse-query-row-run {
  background: none;
  border: 1px solid var(--border);
  color: var(--t3);
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 3px;
  cursor: pointer;
  font-family: var(--font-display);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s;
}

.dse-query-row-run:hover {
  border-color: var(--mh-pink);
  color: var(--mh-pink);
}
```

**Step 3: Bump studio.css to v=11**

**Step 4: Commit**
```bash
git add public/studio.html public/css/studio.css
git commit -m "feat: datasource panel has two views — query list (default) + credential form (toggled)"
```

---

## Task 5: Implement source query list in studio.js

**Files:**
- Modify: `public/js/studio.js` — replace `openDatasourceEditor` and add helpers

**Step 1: Replace `openDatasourceEditor`**

Find `async openDatasourceEditor(src) {` and replace the entire method with:

```js
    async openDatasourceEditor(src) {
      const props   = document.getElementById('properties-placeholder');
      const content = document.getElementById('properties-content');
      const qe      = document.getElementById('query-editor-panel');
      const dse     = document.getElementById('datasource-editor-panel');
      [props, content, qe].forEach(el => { if (el) el.style.display = 'none'; });
      if (dse) dse.style.display = 'flex';

      document.getElementById('dse-name').textContent = src.name;
      const statusEl = document.getElementById('dse-status');
      statusEl.textContent = src.isConnected ? 'connected' : 'not connected';
      statusEl.style.color = src.isConnected ? 'var(--green)' : 'var(--red)';

      // Default view: query list
      this._showDseQueryView();
      await this._loadSourceQueries(src);

      // Close button
      document.getElementById('dse-close').onclick = () => {
        if (dse) dse.style.display = 'none';
        this.showDashboardProps();
      };

      // Toggle to credential form
      const editCredsBtn = document.getElementById('dse-edit-creds');
      if (editCredsBtn) {
        editCredsBtn.onclick = () => {
          this._showDseCredView();
          this._loadCredentialForm(src);
        };
      }

      // Back button
      const backBtn = document.getElementById('dse-back');
      if (backBtn) {
        backBtn.onclick = () => {
          this._showDseQueryView();
        };
      }
    }

    _showDseQueryView() {
      const qv = document.getElementById('dse-query-view');
      const cv = document.getElementById('dse-cred-view');
      if (qv) qv.style.display = 'flex';
      if (cv) cv.style.display = 'none';
    }

    _showDseCredView() {
      const qv = document.getElementById('dse-query-view');
      const cv = document.getElementById('dse-cred-view');
      if (qv) qv.style.display = 'none';
      if (cv) cv.style.display = 'flex';
    }

    async _loadSourceQueries(src) {
      const listEl = document.getElementById('dse-query-list');
      if (!listEl) return;
      listEl.textContent = '';

      try {
        const res  = await fetch('/api/queries/' + encodeURIComponent(src.name));
        const data = await res.json();
        const queries = data.queries || [];

        if (!queries.length) {
          const empty = document.createElement('div');
          empty.className = 'mb-status';
          empty.textContent = src.isConnected
            ? 'No saved queries for this source'
            : 'Configure credentials to enable queries';
          listEl.appendChild(empty);
          return;
        }

        queries.forEach(q => {
          const row    = document.createElement('div');
          row.className = 'dse-query-row';

          const nameEl = document.createElement('span');
          nameEl.className = 'dse-query-row-name';
          nameEl.textContent = q.name;

          const runBtn = document.createElement('button');
          runBtn.className = 'dse-query-row-run';
          runBtn.textContent = '▶ Run';

          row.appendChild(nameEl);
          row.appendChild(runBtn);

          // Click row → open in query editor panel
          row.addEventListener('click', (e) => {
            if (e.target === runBtn) return;
            document.getElementById('datasource-editor-panel').style.display = 'none';
            this.openQueryEditor(q, src.name);
          });

          // Run button → open query editor and auto-run
          runBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('datasource-editor-panel').style.display = 'none';
            this.openQueryEditor(q, src.name);
            // Auto-run after a short delay so the panel is ready
            setTimeout(() => this._runQuery(), 200);
          });

          listEl.appendChild(row);
        });
      } catch (e) {
        const err = document.createElement('div');
        err.className = 'mb-status';
        err.textContent = 'Failed to load queries';
        listEl.appendChild(err);
      }
    }

    async _loadCredentialForm(src) {
      const fieldsEl = document.getElementById('dse-fields');
      if (!fieldsEl) return;
      fieldsEl.textContent = '';

      try {
        const schemaRes  = await fetch('/api/data-sources/schemas');
        const schemaData = await schemaRes.json().catch(() => ({ schemas: {} }));
        const schema = (schemaData.schemas && schemaData.schemas[src.name]) || { fields: [] };
        (schema.fields || []).forEach(field => {
          const label = document.createElement('label');
          label.className = 'qe-label';
          label.appendChild(document.createTextNode(field.description || field.name));
          const input = document.createElement('input');
          input.className   = 'qe-input';
          input.type        = field.secure ? 'password' : 'text';
          input.dataset.field  = field.name;
          input.dataset.envVar = field.envVar || '';
          input.placeholder = field.secure ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (stored)' : (field.default || '');
          label.appendChild(input);
          if (field.envVar) {
            const hint = document.createElement('div');
            hint.className = 'props-hint';
            hint.textContent = 'env: ' + field.envVar;
            label.appendChild(hint);
          }
          fieldsEl.appendChild(label);
        });
      } catch (e) {
        const err = document.createElement('div');
        err.className = 'mb-status';
        err.textContent = 'Schema unavailable';
        fieldsEl.appendChild(err);
      }

      // Wire test + save buttons
      const resultEl = document.getElementById('dse-test-result');

      document.getElementById('dse-test').onclick = async () => {
        const btn = document.getElementById('dse-test');
        btn.setAttribute('disabled', '');
        resultEl.textContent = 'Testing…'; resultEl.style.color = 'var(--t3)';
        const t0 = Date.now();
        try {
          const res  = await fetch('/api/data-sources/' + encodeURIComponent(src.name) + '/test', { method: 'POST' });
          const data = await res.json();
          const ms   = Date.now() - t0;
          if (data.connected || data.success) {
            resultEl.textContent = '✓ Connected (' + ms + 'ms)'; resultEl.style.color = 'var(--green)';
          } else {
            resultEl.textContent = '✗ Failed — ' + (data.error || 'Unknown'); resultEl.style.color = 'var(--red)';
          }
        } catch (e) {
          resultEl.textContent = '✗ ' + e.message; resultEl.style.color = 'var(--red)';
        } finally { btn.removeAttribute('disabled'); }
      };

      document.getElementById('dse-save').onclick = async () => {
        const saveBtn = document.getElementById('dse-save');
        const inputs  = document.querySelectorAll('#dse-fields input[data-field]');
        const body    = {};
        inputs.forEach(inp => { if (inp.value.trim() && inp.dataset.envVar) body[inp.dataset.envVar] = inp.value.trim(); });
        if (!Object.keys(body).length) { resultEl.textContent = 'No credentials entered'; resultEl.style.color = 'var(--amber)'; return; }
        saveBtn.setAttribute('disabled', '');
        resultEl.textContent = 'Saving…'; resultEl.style.color = 'var(--t3)';
        try {
          const res  = await fetch('/api/data-sources/' + encodeURIComponent(src.name) + '/credentials', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) { resultEl.textContent = '✗ ' + (data.error || 'Save failed'); resultEl.style.color = 'var(--red)'; return; }
          if (data.connected) {
            resultEl.textContent = '✓ Saved and connected'; resultEl.style.color = 'var(--green)';
          } else {
            resultEl.textContent = '✓ Saved — ' + (data.message || 'not yet connected'); resultEl.style.color = 'var(--amber)';
          }
          inputs.forEach(inp => { if (inp.type === 'password') inp.value = ''; });
          this.renderDatasourceList();
        } catch (e) {
          resultEl.textContent = '✗ ' + e.message; resultEl.style.color = 'var(--red)';
        } finally { saveBtn.removeAttribute('disabled'); }
      };
    }
```

**Step 2: Bump studio.js to v=20**

**Step 3: Run tests and commit**
```bash
bun test tests/unit tests/integration tests/helpers tests/components 2>&1 | tail -4
git add public/js/studio.js public/studio.html
git commit -m "feat: Sources tab shows source queries list with run/preview; credentials behind toggle"
```

---

## Task 6: Version bumps + PR

**Step 1: Verify all version strings are consistent**

```bash
grep "studio.css\|studio.js" public/studio.html
```
Expected: studio.css?v=11, studio.js?v=20

**Step 2: Run full test suite**
```bash
bun test tests/unit tests/integration tests/helpers tests/components 2>&1 | tail -4
```
Expected: all pass.

**Step 3: Create PR**
```bash
git checkout -b feat/query-preview
git push -u origin feat/query-preview
gh pr create \
  --title "feat: Sources tab shows source queries + live widget preview in query editor" \
  --body "When you click a data source in the Sources tab, you now see all its saved queries. Click any query to open it in the query editor. The query editor now has a widget-type selector and a live canvas preview — run a query, pick Big Number / Gauge / Bar Chart, and see exactly how the data will render on the TV display before assigning it to a widget. Credential form is still accessible via 'Edit Credentials' toggle."
```
