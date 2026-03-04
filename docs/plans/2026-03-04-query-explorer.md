# Query Explorer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an interactive Query Explorer modal to the Studio that lets engineers run ad-hoc GCP Metrics and BigQuery queries, inspect raw results in a table, preview the resulting widget, and save or assign the query — without leaving the Studio.

**Architecture:** A new `server/explore-routes.js` Elysia plugin exposes `POST /api/explore/gcp` and `POST /api/explore/bigquery` for unsaved ad-hoc queries returning both raw data and widget-transformed data. A full-screen `studio-modal` in the Studio contains three panels (query builder | raw results | widget preview) managed by a new `QueryExplorer` class in `public/js/query-explorer.js`. Widget type changes re-transform client-side from cached raw data — no re-fetch needed.

**Tech Stack:** Bun, Elysia.js, `gcp-metrics.js` (existing `query()` export), `BigQueryDataSource.executeQuery()` (existing), `window.Widgets` (existing), vanilla JS with `createElement`/`textContent` DOM pattern (no innerHTML with variable interpolation).

---

### Task 1: `server/explore-routes.js` — ad-hoc query endpoints

**Files:**
- Create: `server/explore-routes.js`
- Modify: `server/index.js` (add import + `.use()`)
- Test: `tests/unit/routes/explore-routes.test.js`

**Step 1: Write the failing tests**

Create `tests/unit/routes/explore-routes.test.js`:

```js
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';

const mockGcpQuery = mock(async () => [
  {
    resource: { labels: { service_name: 'bidder' } },
    metric:   { labels: {} },
    points: [
      { interval: { endTime: { seconds: 1709547600 } }, value: { doubleValue: 142.3 } },
      { interval: { endTime: { seconds: 1709547540 } }, value: { doubleValue: 138.7 } },
    ],
  },
]);

mock.module('../../../server/gcp-metrics.js', () => ({
  query:  mockGcpQuery,
  latest: (ts) => ts[0]?.points[0]?.value?.doubleValue ?? null,
  spark:  () => [],
}));

const mockBqExecute = mock(async () => [
  { zip3: '100', state: 'NY', impressions: 48291 },
  { zip3: '900', state: 'CA', impressions: 41033 },
]);

mock.module('../../../server/data-source-registry.js', () => ({
  dataSourceRegistry: {
    getSource: (name) => {
      if (name === 'bigquery') return { executeQuery: mockBqExecute };
      if (name === 'gcp')      return { transformData: (_ts, _type) => ({ value: 142.3, unit: '' }) };
    },
  },
}));

const { exploreRoutes } = await import('../../../server/explore-routes.js');

describe('Explore Routes', () => {
  let app;

  beforeEach(() => {
    app = new Elysia().use(exploreRoutes);
    mockGcpQuery.mockClear();
    mockBqExecute.mockClear();
  });

  // ── GCP ────────────────────────────────────────────────────────

  describe('POST /api/explore/gcp', () => {
    it('returns rawSeries, widgetData and executionMs', async () => {
      const res = await app.handle(new Request('http://localhost/api/explore/gcp', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ metricType: 'custom.googleapis.com/foo', timeWindow: 10 }),
      }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.rawSeries)).toBe(true);
      expect(body.rawSeries[0]).toHaveProperty('timestamp');
      expect(body.rawSeries[0]).toHaveProperty('value');
      expect(body.rawSeries[0].service_name).toBe('bidder');
      expect(body.widgetData).toBeDefined();
      expect(typeof body.executionMs).toBe('number');
      expect(body.seriesCount).toBe(1);
      expect(body.pointCount).toBe(2);
    });

    it('returns 400 when metricType is missing', async () => {
      const res = await app.handle(new Request('http://localhost/api/explore/gcp', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ timeWindow: 10 }),
      }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('passes project, filters, aggregation, timeWindow to gcpQuery', async () => {
      await app.handle(new Request('http://localhost/api/explore/gcp', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          metricType:  'custom.googleapis.com/foo',
          project:     'mad-data',
          filters:     'resource.type="global"',
          timeWindow:  5,
          aggregation: { perSeriesAligner: 'ALIGN_DELTA' },
        }),
      }));
      expect(mockGcpQuery).toHaveBeenCalledWith(
        'mad-data',
        'custom.googleapis.com/foo',
        'resource.type="global"',
        5,
        { perSeriesAligner: 'ALIGN_DELTA' }
      );
    });

    it('returns empty rawSeries and null widgetData when no time series returned', async () => {
      mockGcpQuery.mockResolvedValueOnce([]);
      const res = await app.handle(new Request('http://localhost/api/explore/gcp', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ metricType: 'custom.googleapis.com/foo' }),
      }));
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.rawSeries).toEqual([]);
      expect(body.seriesCount).toBe(0);
    });
  });

  // ── BigQuery ───────────────────────────────────────────────────

  describe('POST /api/explore/bigquery', () => {
    it('returns rows, widgetData and executionMs', async () => {
      const res = await app.handle(new Request('http://localhost/api/explore/bigquery', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ sql: 'SELECT * FROM test' }),
      }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.rows)).toBe(true);
      expect(body.rows[0].zip3).toBe('100');
      expect(body.widgetData).toBeDefined();
      expect(typeof body.executionMs).toBe('number');
      expect(body.rowCount).toBe(2);
      expect(body.columnCount).toBe(3);
    });

    it('appends LIMIT 200 when SQL has no LIMIT clause', async () => {
      await app.handle(new Request('http://localhost/api/explore/bigquery', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ sql: 'SELECT * FROM test' }),
      }));
      const callSql = mockBqExecute.mock.calls[0][0];
      expect(callSql).toMatch(/LIMIT 200/i);
    });

    it('does not double-add LIMIT when SQL already has one', async () => {
      await app.handle(new Request('http://localhost/api/explore/bigquery', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ sql: 'SELECT * FROM test LIMIT 50' }),
      }));
      const callSql = mockBqExecute.mock.calls[0][0];
      expect((callSql.match(/LIMIT/gi) || []).length).toBe(1);
    });

    it('returns 400 when sql is missing', async () => {
      const res = await app.handle(new Request('http://localhost/api/explore/bigquery', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({}),
      }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });
});
```

**Step 2: Run and confirm failure**
```bash
bun test tests/unit/routes/explore-routes.test.js
```
Expected: FAIL — `Cannot find module '../../../server/explore-routes.js'`

**Step 3: Implement `server/explore-routes.js`**

```js
// ===========================================================================
// Query Explorer Routes — ad-hoc GCP and BigQuery queries (unsaved)
// ===========================================================================

import { Elysia } from 'elysia';
import { query as gcpQuery } from './gcp-metrics.js';
import { dataSourceRegistry } from './data-source-registry.js';
import logger from './logger.js';

const DEFAULT_PROJECT = (process.env.GCP_PROJECTS || 'mad-master').split(',')[0].trim();

export const exploreRoutes = new Elysia({ prefix: '/api/explore' })

  // Ad-hoc GCP Cloud Monitoring query
  .post('/gcp', async ({ body }) => {
    const {
      metricType,
      project     = DEFAULT_PROJECT,
      timeWindow  = 30,
      aggregation = {},
      filters     = '',
      widgetType  = 'big-number',
    } = body || {};

    if (!metricType) {
      return new Response(
        JSON.stringify({ success: false, error: 'metricType is required' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    const t0 = Date.now();
    try {
      const timeSeries = await gcpQuery(project, metricType, filters, timeWindow, aggregation);
      const executionMs = Date.now() - t0;

      const rawSeries  = extractRawSeries(timeSeries);
      const gcpSource  = dataSourceRegistry.getSource('gcp');
      const widgetData = timeSeries.length
        ? gcpSource.transformData(timeSeries, widgetType)
        : null;

      return {
        success:      true,
        rawSeries,
        widgetData,
        seriesCount:  timeSeries.length,
        pointCount:   rawSeries.length,
        executionMs,
      };
    } catch (err) {
      logger.error({ err: err.message }, 'explore/gcp failed');
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['queries'],
      summary: 'Ad-hoc GCP metric query',
      description: 'Run an unsaved GCP Cloud Monitoring query and get raw time series + widget data.',
    },
  })

  // Ad-hoc BigQuery SQL query
  .post('/bigquery', async ({ body }) => {
    const { sql, widgetType = 'big-number' } = body || {};

    if (!sql?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'sql is required' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    // Enforce row cap (never execute unbounded scans from the explorer)
    let safeSql = sql.trim().replace(/;\s*$/, '');
    if (!/\bLIMIT\b/i.test(safeSql)) {
      safeSql = safeSql + ' LIMIT 200';
    }

    const t0 = Date.now();
    try {
      const bqSource   = dataSourceRegistry.getSource('bigquery');
      const rows       = await bqSource.executeQuery(safeSql, {}, false);
      const executionMs = Date.now() - t0;
      const widgetData = transformBqRows(rows, widgetType);

      return {
        success:     true,
        rows,
        widgetData,
        rowCount:    rows.length,
        columnCount: rows.length > 0 ? Object.keys(rows[0]).length : 0,
        executionMs,
      };
    } catch (err) {
      logger.error({ err: err.message }, 'explore/bigquery failed');
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['queries'],
      summary: 'Ad-hoc BigQuery SQL query',
      description: 'Run an unsaved BigQuery SQL query and get raw rows + widget data. Caps at 200 rows.',
    },
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flatten GCP time series into a row array for the results table.
 * Each row: { timestamp, value, ...resourceLabels, ...metricLabels }
 * Capped at 500 rows total.
 */
function extractRawSeries(timeSeries) {
  if (!timeSeries?.length) return [];
  const rows = [];
  for (const ts of timeSeries) {
    const labels = {
      ...(ts.resource?.labels || {}),
      ...(ts.metric?.labels  || {}),
    };
    for (const point of (ts.points || []).slice(0, 100)) {
      const v = point.value;
      rows.push({
        timestamp: point.interval?.endTime?.seconds
          ? new Date(point.interval.endTime.seconds * 1000)
              .toISOString().replace('T', ' ').slice(0, 19)
          : '',
        value: Number(v.doubleValue || v.int64Value || v.distributionValue?.mean || 0),
        ...labels,
      });
    }
  }
  return rows.slice(0, 500);
}

/**
 * Best-effort transform of BigQuery rows to widget data for preview.
 * Uses the first numeric column as value, first string column as label.
 */
function transformBqRows(rows, widgetType) {
  if (!rows?.length) return null;
  const cols   = Object.keys(rows[0]);
  const numCol = cols.find(c => typeof rows[0][c] === 'number');
  const strCol = cols.find(c => typeof rows[0][c] === 'string');
  if (!numCol) return null;

  switch (widgetType) {
    case 'big-number':
    case 'stat-card':
      return {
        value:     rows[0][numCol],
        sparkline: rows.slice(1, 21).map(r => r[numCol] || 0),
        unit:      '',
      };
    case 'gauge':
      return { value: rows[0][numCol], min: 0, max: 100, unit: '' };
    case 'bar-chart':
      return {
        bars: rows.slice(0, 10).map(r => ({
          label: strCol ? String(r[strCol]) : String(r[numCol]),
          value: r[numCol] || 0,
        })),
      };
    case 'line-chart':
      return {
        series: [{ label: numCol, data: rows.map(r => r[numCol] || 0) }],
        timestamps: [],
      };
    default:
      return { value: rows[0][numCol], unit: '' };
  }
}
```

**Step 4: Mount in `server/index.js`**

Add import alongside other route imports (after the `gcpDashboardRoutes` import line):
```js
import { exploreRoutes } from './explore-routes.js';
```

Add `.use()` after `.use(gcpDashboardRoutes)` (line ~1282):
```js
  .use(exploreRoutes)
```

**Step 5: Run tests — all must pass**
```bash
bun test tests/unit/routes/explore-routes.test.js
```
Expected: 8 pass, 0 fail

**Step 6: Smoke-test live server**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s -X POST http://tv:3000/api/explore/gcp \
  -H 'content-type: application/json' \
  -d '{"metricType":"run.googleapis.com/request_count","timeWindow":10}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('success:', d['success'], '| series:', d['seriesCount'], '| points:', d['pointCount'])"
```
Expected: `success: True | series: N | points: M`

**Step 7: Commit**
```bash
git add server/explore-routes.js server/index.js tests/unit/routes/explore-routes.test.js
git commit -m "feat: explore routes — POST /api/explore/gcp and /api/explore/bigquery"
```

---

### Task 2: Studio HTML — Explorer button, modal skeleton, asset links

**Files:**
- Modify: `public/studio.html`

**Context:** The Queries toolbar is at line ~112:
```html
<div class="query-list-toolbar">
  <button id="import-gcp-dashboards-btn" ...>&#8595; Import from GCP</button>
</div>
```

**Step 1: Add Explorer button to the toolbar**

Find the exact `<div class="query-list-toolbar">` block and replace it:
```html
<div class="query-list-toolbar">
  <button id="import-gcp-dashboards-btn" class="btn-import-gcp" title="Import queries from GCP Cloud Monitoring dashboards">
    &#8595; Import from GCP
  </button>
  <button id="open-query-explorer-btn" class="btn-open-explorer" title="Open Query Explorer">
    &#9670; Explorer
  </button>
</div>
```

**Step 2: Add the Explorer modal before `</body>`**

Insert before the closing `</body>` tag (after the GCP import modal):
```html
<!-- Query Explorer Modal -->
<div id="qx-modal" class="studio-modal" style="display:none">
  <div class="studio-modal-content qx-modal-content">
    <div class="studio-modal-header">
      <h2>Query Explorer</h2>
      <button id="qx-close-btn" class="modal-close">&#x2715;</button>
    </div>
    <div class="qx-body">

      <!-- Left: Query Builder -->
      <div class="qx-builder">
        <div class="qx-field-row">
          <label class="qx-label">Source</label>
          <select id="qx-source" class="qx-select">
            <option value="gcp">GCP Metrics</option>
            <option value="bigquery">BigQuery</option>
            <option value="logging" disabled>Cloud Logging &#183; Phase 2</option>
            <option value="trace" disabled>Cloud Trace &#183; Phase 2</option>
            <option value="otel" disabled>OTel Collector &#183; Phase 2</option>
          </select>
        </div>

        <!-- GCP fields -->
        <div id="qx-gcp-fields" class="qx-source-fields">
          <div class="qx-field-row">
            <label class="qx-label">Metric Type</label>
            <div class="qx-metric-row">
              <input id="qx-metric-type" type="text" class="qx-input" placeholder="e.g. run.googleapis.com/request_count">
              <button id="qx-browse-btn" class="studio-btn secondary small">Browse</button>
            </div>
          </div>
          <div class="qx-field-row">
            <label class="qx-label">Project</label>
            <select id="qx-project" class="qx-select">
              <option value="mad-master">mad-master</option>
              <option value="mad-data">mad-data</option>
              <option value="mad-audit">mad-audit</option>
              <option value="mad-looker-enterprise">mad-looker-enterprise</option>
            </select>
          </div>
          <div class="qx-field-row">
            <label class="qx-label">Time Window</label>
            <select id="qx-time-window" class="qx-select">
              <option value="5">5 min</option>
              <option value="10">10 min</option>
              <option value="30" selected>30 min</option>
              <option value="60">1 hour</option>
              <option value="360">6 hours</option>
              <option value="1440">24 hours</option>
            </select>
          </div>
          <div class="qx-field-row">
            <label class="qx-label">Aligner</label>
            <select id="qx-aligner" class="qx-select">
              <option value="ALIGN_RATE">ALIGN_RATE</option>
              <option value="ALIGN_DELTA">ALIGN_DELTA</option>
              <option value="ALIGN_MEAN" selected>ALIGN_MEAN</option>
              <option value="ALIGN_SUM">ALIGN_SUM</option>
              <option value="ALIGN_MAX">ALIGN_MAX</option>
            </select>
          </div>
          <div class="qx-field-row">
            <label class="qx-label">Reducer</label>
            <select id="qx-reducer" class="qx-select">
              <option value="REDUCE_NONE" selected>REDUCE_NONE</option>
              <option value="REDUCE_SUM">REDUCE_SUM</option>
              <option value="REDUCE_MEAN">REDUCE_MEAN</option>
              <option value="REDUCE_MAX">REDUCE_MAX</option>
            </select>
          </div>
          <div class="qx-field-row">
            <label class="qx-label">Period</label>
            <select id="qx-period" class="qx-select">
              <option value="60s" selected>60s</option>
              <option value="300s">300s</option>
              <option value="600s">600s</option>
              <option value="3600s">3600s</option>
            </select>
          </div>
          <div class="qx-field-row">
            <label class="qx-label">Filters</label>
            <input id="qx-filters" type="text" class="qx-input" placeholder='resource.type="k8s_container"'>
          </div>
        </div>

        <!-- BigQuery fields -->
        <div id="qx-bq-fields" class="qx-source-fields" style="display:none">
          <div class="qx-field-row">
            <label class="qx-label">SQL</label>
            <textarea id="qx-sql" class="qx-textarea" rows="10" placeholder="SELECT&#10;  zip3, SUM(impressions) AS impressions&#10;FROM \`mad-data.reporting.billable_agg\`&#10;WHERE date_nyc >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)&#10;GROUP BY 1&#10;ORDER BY 2 DESC&#10;LIMIT 50" spellcheck="false"></textarea>
          </div>
          <div class="qx-field-row qx-schema-row">
            <label class="qx-label">Schema</label>
            <div class="qx-schema-controls">
              <select id="qx-bq-dataset" class="qx-select qx-select-sm">
                <option value="">Dataset&#8230;</option>
              </select>
              <select id="qx-bq-table" class="qx-select qx-select-sm">
                <option value="">Table&#8230;</option>
              </select>
            </div>
          </div>
          <div id="qx-schema-cols" class="qx-schema-cols"></div>
        </div>

        <button id="qx-run-btn" class="studio-btn primary qx-run-btn">&#9654; Run Query</button>
        <div id="qx-run-status" class="qx-run-status"></div>
      </div>

      <!-- Center: Raw Results -->
      <div class="qx-results" id="qx-results">
        <div class="qx-results-placeholder">Configure a query and click Run</div>
      </div>

      <!-- Right: Widget Preview -->
      <div class="qx-preview">
        <div class="qx-preview-header">
          <label class="qx-label">Widget Type
            <select id="qx-widget-type" class="qx-select">
              <option value="big-number">Big Number</option>
              <option value="stat-card">Stat Card</option>
              <option value="gauge">Gauge</option>
              <option value="line-chart">Line Chart</option>
              <option value="bar-chart">Bar Chart</option>
            </select>
          </label>
        </div>
        <div id="qx-preview-canvas-wrap" class="qx-preview-canvas-wrap">
          <div class="qx-results-placeholder">Run a query to preview</div>
        </div>
        <div class="qx-preview-config" id="qx-preview-config" style="display:none">
          <label class="qx-label qx-label-inline">Unit
            <input id="qx-unit" type="text" class="qx-input-sm" placeholder="req/s">
          </label>
          <label class="qx-label qx-label-inline" id="qx-max-row" style="display:none">Max
            <input id="qx-max" type="number" class="qx-input-sm" placeholder="100">
          </label>
        </div>
      </div>

    </div>

    <!-- Action bar -->
    <div class="qx-action-bar">
      <button id="qx-export-csv-btn" class="studio-btn secondary" disabled>&#8595; Export CSV</button>
      <div class="qx-action-bar-right">
        <button id="qx-save-btn"   class="studio-btn secondary" disabled>Save as Query</button>
        <button id="qx-assign-btn" class="studio-btn secondary" disabled>Assign to Widget</button>
        <button class="studio-btn secondary" disabled title="Coming in Phase 2">Create Assertion</button>
      </div>
    </div>
  </div>
</div>
```

**Step 3: Add CSS link and script tag**

Add CSS link in `<head>` after the existing studio.css line:
```html
  <link rel="stylesheet" href="/css/query-explorer.css?v=1">
```

Add script tag before `</body>`, after `query-editor.js` and before `studio-canvas.js`:
```html
  <script src="/js/query-explorer.js?v=1"></script>
```

**Step 4: Restart and verify markup**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s http://tv:3000/admin | grep -c 'qx-modal\|qx-run-btn\|qx-results'
```
Expected: at least 5 matches

**Step 5: Commit**
```bash
git add public/studio.html
git commit -m "feat: Query Explorer modal skeleton and Explorer button in studio.html"
```

---

### Task 3: `public/css/query-explorer.css` — styles

**Files:**
- Create: `public/css/query-explorer.css`

**Step 1: Create the file**

```css
/* ===========================================================================
   Query Explorer — full-screen three-panel query sandbox
   =========================================================================== */

/* ── Modal override: wider than standard studio-modal-content ── */
.qx-modal-content {
  width:      95vw;
  max-width:  1400px;
  max-height: 90vh;
  overflow:   hidden;      /* panels scroll independently */
  display:    flex;
  flex-direction: column;
  position:   relative;
}

/* ── Three-panel body ── */
.qx-body {
  display:    flex;
  flex:       1;
  min-height: 0;           /* allow flex children to shrink below content size */
  overflow:   hidden;
}

/* ── Left: Query Builder ── */
.qx-builder {
  width:       280px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  overflow-y:  auto;
  padding:     12px;
  display:     flex;
  flex-direction: column;
  gap:         6px;
}

.qx-field-row {
  display:        flex;
  flex-direction: column;
  gap:            3px;
}

.qx-label {
  font-size:   10px;
  font-weight: 700;
  color:       var(--t3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.qx-label-inline {
  flex-direction: row;
  align-items:    center;
  gap:            6px;
}

.qx-input,
.qx-textarea,
.qx-select {
  background:   var(--bg-input, #1a1a2e);
  border:       1px solid var(--border);
  border-radius: 4px;
  color:        var(--t1);
  font-size:    12px;
  padding:      5px 8px;
  width:        100%;
  box-sizing:   border-box;
}

.qx-input-sm {
  background:   var(--bg-input, #1a1a2e);
  border:       1px solid var(--border);
  border-radius: 4px;
  color:        var(--t1);
  font-size:    11px;
  padding:      3px 6px;
  width:        70px;
}

.qx-select-sm {
  font-size:    11px;
  padding:      3px 6px;
}

.qx-textarea {
  font-family:  var(--font-mono, monospace);
  font-size:    11px;
  resize:       vertical;
  min-height:   120px;
}

.qx-input:focus,
.qx-textarea:focus,
.qx-select:focus {
  outline:      none;
  border-color: var(--accent, #7c3aed);
}

.qx-metric-row {
  display:  flex;
  gap:      4px;
}
.qx-metric-row .qx-input { flex: 1; }

.qx-run-btn {
  margin-top: 8px;
  width:      100%;
}

.qx-run-status {
  font-size:   11px;
  color:       var(--t3);
  text-align:  center;
  min-height:  16px;
  margin-top:  4px;
}

.qx-schema-row { margin-top: 4px; }

.qx-schema-controls {
  display: flex;
  gap:     4px;
}

.qx-schema-cols {
  font-size:   10px;
  color:       var(--t3);
  font-family: var(--font-mono, monospace);
  max-height:  100px;
  overflow-y:  auto;
  margin-top:  4px;
  padding:     4px 0;
}

.qx-schema-col {
  display: flex;
  gap:     6px;
  padding: 1px 0;
}
.qx-col-name  { color: var(--t2); }
.qx-col-type  { color: var(--t3); }

/* ── Center: Raw Results ── */
.qx-results {
  flex:      1;
  overflow:  auto;
  padding:   0;
  min-width: 0;
  position:  relative;
}

.qx-results-placeholder {
  color:      var(--t3);
  font-size:  13px;
  text-align: center;
  padding:    40px 20px;
}

.qx-results-header {
  padding:     8px 14px;
  font-size:   11px;
  color:       var(--t3);
  border-bottom: 1px solid var(--border);
  display:     flex;
  align-items: center;
  justify-content: space-between;
  position:    sticky;
  top:         0;
  background:  var(--bg-surface);
  z-index:     1;
  flex-shrink: 0;
}

.qx-results-meta {
  display: flex;
  gap:     12px;
}

.qx-results-table-wrap {
  overflow: auto;
}

.qx-results-table {
  width:           100%;
  border-collapse: collapse;
  font-size:       11px;
  font-family:     var(--font-mono, monospace);
}

.qx-results-table th {
  background:   var(--bg-input, #1a1a2e);
  border-bottom: 1px solid var(--border);
  color:        var(--t2);
  font-weight:  700;
  padding:      6px 10px;
  text-align:   left;
  white-space:  nowrap;
  position:     sticky;
  top:          0;
  z-index:      1;
}

.qx-results-table td {
  padding:      4px 10px;
  border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.04));
  white-space:  nowrap;
  max-width:    220px;
  overflow:     hidden;
  text-overflow: ellipsis;
  color:        var(--t1);
}

.qx-results-table tr:hover td {
  background: var(--hover, rgba(255,255,255,0.04));
}

.qx-td-num { color: var(--mh-pink, #f472b6); text-align: right; }

.qx-error-banner {
  background: rgba(220,38,38,0.1);
  border:     1px solid rgba(220,38,38,0.3);
  color:      #ef4444;
  font-size:  12px;
  font-family: var(--font-mono, monospace);
  padding:    12px 14px;
  margin:     12px;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}

.qx-empty-banner {
  background: rgba(245,158,11,0.08);
  border:     1px solid rgba(245,158,11,0.25);
  color:      #f59e0b;
  font-size:  12px;
  padding:    10px 14px;
  margin:     12px;
  border-radius: 6px;
}

/* ── Right: Widget Preview ── */
.qx-preview {
  width:       240px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  display:     flex;
  flex-direction: column;
  overflow-y:  auto;
  padding:     12px;
  gap:         10px;
}

.qx-preview-header { flex-shrink: 0; }

.qx-preview-canvas-wrap {
  flex:          1;
  min-height:    120px;
  border:        1px solid var(--border);
  border-radius: 6px;
  overflow:      hidden;
  display:       flex;
  align-items:   center;
  justify-content: center;
}

.qx-preview-config {
  display:        flex;
  flex-direction: column;
  gap:            6px;
  flex-shrink:    0;
}

/* ── Action bar ── */
.qx-action-bar {
  display:      flex;
  align-items:  center;
  justify-content: space-between;
  padding:      10px 16px;
  border-top:   1px solid var(--border);
  flex-shrink:  0;
  gap:          8px;
}

.qx-action-bar-right {
  display: flex;
  gap:     6px;
}

/* ── Explorer button in Queries toolbar ── */
.btn-open-explorer {
  background:    transparent;
  border:        1px solid var(--border);
  border-radius: 4px;
  color:         var(--t2);
  padding:       5px 10px;
  font-size:     11px;
  font-weight:   600;
  cursor:        pointer;
  letter-spacing: 0.02em;
  transition:    all 0.15s;
  white-space:   nowrap;
}
.btn-open-explorer:hover {
  border-color: var(--accent, #7c3aed);
  color:        var(--t1);
}
```

**Step 2: Verify it loads**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s http://tv:3000/css/query-explorer.css | grep -c 'qx-'
```
Expected: at least 20 matches

**Step 3: Commit**
```bash
git add public/css/query-explorer.css
git commit -m "feat: Query Explorer CSS — three-panel layout, results table, widget preview"
```

---

### Task 4: `public/js/query-explorer.js` — QueryExplorer class

**Files:**
- Create: `public/js/query-explorer.js`

**Critical:** Never use `innerHTML` with variable interpolation. All dynamic DOM content uses `createElement` + `textContent`.

**Step 1: Create the file**

```js
/* ===========================================================================
   QueryExplorer — interactive ad-hoc query sandbox for Studio
   =========================================================================== */

window.QueryExplorer = (function () {
  'use strict';

  class QueryExplorer {
    constructor(studioApp) {
      this.app      = studioApp;
      this._lastRaw = null;    // { type: 'gcp'|'bigquery', rawSeries|rows, columns }
      this._widget  = null;    // active Widgets instance in preview

      // DOM refs — populated lazily on first open
      this._modal          = null;
      this._source         = null;
      this._gcpFields      = null;
      this._bqFields       = null;
      this._runBtn         = null;
      this._runStatus      = null;
      this._results        = null;
      this._previewWrap    = null;
      this._previewConfig  = null;
      this._widgetType     = null;
      this._unit           = null;
      this._maxRow         = null;
      this._maxInput       = null;
      this._exportBtn      = null;
      this._saveBtn        = null;
      this._assignBtn      = null;
      this._bqDataset      = null;
      this._bqTable        = null;
      this._schemaCols     = null;

      this._bound = false;
    }

    _init() {
      if (this._bound) return;
      this._modal         = document.getElementById('qx-modal');
      this._source        = document.getElementById('qx-source');
      this._gcpFields     = document.getElementById('qx-gcp-fields');
      this._bqFields      = document.getElementById('qx-bq-fields');
      this._runBtn        = document.getElementById('qx-run-btn');
      this._runStatus     = document.getElementById('qx-run-status');
      this._results       = document.getElementById('qx-results');
      this._previewWrap   = document.getElementById('qx-preview-canvas-wrap');
      this._previewConfig = document.getElementById('qx-preview-config');
      this._widgetType    = document.getElementById('qx-widget-type');
      this._unit          = document.getElementById('qx-unit');
      this._maxRow        = document.getElementById('qx-max-row');
      this._maxInput      = document.getElementById('qx-max');
      this._exportBtn     = document.getElementById('qx-export-csv-btn');
      this._saveBtn       = document.getElementById('qx-save-btn');
      this._assignBtn     = document.getElementById('qx-assign-btn');
      this._bqDataset     = document.getElementById('qx-bq-dataset');
      this._bqTable       = document.getElementById('qx-bq-table');
      this._schemaCols    = document.getElementById('qx-schema-cols');

      if (!this._modal) return; // HTML not ready

      document.getElementById('open-query-explorer-btn')
        ?.addEventListener('click', () => this.open());
      document.getElementById('qx-close-btn')
        ?.addEventListener('click', () => this.close());
      this._modal.addEventListener('click', (e) => {
        if (e.target === this._modal) this.close();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this._modal.style.display !== 'none') this.close();
      });

      this._source.addEventListener('change', () => this._onSourceChange());
      this._runBtn.addEventListener('click', () => this._runQuery());
      this._widgetType.addEventListener('change', () => this._onWidgetTypeChange());
      this._unit.addEventListener('input', () => this._onWidgetTypeChange());
      this._maxInput?.addEventListener('input', () => this._onWidgetTypeChange());
      this._exportBtn.addEventListener('click', () => this._exportCsv());
      this._saveBtn.addEventListener('click', () => this._saveAsQuery());
      this._assignBtn.addEventListener('click', () => this._assignToWidget());

      document.getElementById('qx-browse-btn')
        ?.addEventListener('click', () => this._openMetricBrowser());

      // BigQuery schema browser
      this._bqDataset?.addEventListener('change', () => this._loadBqTables());
      this._bqTable?.addEventListener('change', () => this._loadBqSchema());

      this._bound = true;
    }

    open() {
      this._init();
      if (!this._modal) return;
      this._modal.style.display = 'flex';
      this._onSourceChange(); // ensure correct fields visible

      // Load BQ datasets if BigQuery source is selected
      if (this._source?.value === 'bigquery') this._loadBqDatasets();
    }

    close() {
      if (this._modal) this._modal.style.display = 'none';
    }

    // ── Source switching ──────────────────────────────────────────

    _onSourceChange() {
      const src = this._source?.value;
      if (this._gcpFields) this._gcpFields.style.display = src === 'gcp'      ? '' : 'none';
      if (this._bqFields)  this._bqFields.style.display  = src === 'bigquery' ? '' : 'none';
      if (src === 'bigquery') this._loadBqDatasets();
    }

    // ── Run ──────────────────────────────────────────────────────

    async _runQuery() {
      if (!this._runBtn) return;
      const src = this._source?.value;
      if (!src || src === 'logging' || src === 'trace' || src === 'otel') return;

      this._runBtn.setAttribute('disabled', '');
      this._runStatus.textContent = 'Running\u2026';
      this._runStatus.style.color = 'var(--t3)';
      this._setActionsDisabled(true);

      const t0 = Date.now();
      try {
        let body;
        if (src === 'gcp') {
          body = this._buildGcpBody();
          if (!body) { this._runStatus.textContent = 'Enter a metric type'; return; }
        } else {
          body = this._buildBqBody();
          if (!body) { this._runStatus.textContent = 'Enter a SQL query'; return; }
        }

        const res  = await fetch('/api/explore/' + src, {
          method:  'POST',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify(body),
        });
        const data = await res.json();
        const ms   = Date.now() - t0;

        if (!data.success) {
          this._showError(data.error || 'Unknown error');
          this._runStatus.textContent = 'Error';
          this._runStatus.style.color = 'var(--red, #ef4444)';
          return;
        }

        this._runStatus.textContent = ms + 'ms';
        this._runStatus.style.color = 'var(--green, #4ade80)';

        if (src === 'gcp') {
          this._lastRaw = { type: 'gcp', rawSeries: data.rawSeries, meta: data };
          this._renderGcpResults(data.rawSeries, data.seriesCount, data.pointCount, ms);
        } else {
          this._lastRaw = { type: 'bigquery', rows: data.rows, meta: data };
          this._renderBqResults(data.rows, data.rowCount, data.columnCount, ms);
        }

        this._renderWidgetPreview(data.widgetData, body.widgetType || 'big-number');
        this._setActionsDisabled(false);
      } catch (err) {
        this._showError(err.message);
        this._runStatus.textContent = 'Error';
        this._runStatus.style.color = 'var(--red, #ef4444)';
      } finally {
        this._runBtn.removeAttribute('disabled');
      }
    }

    _buildGcpBody() {
      const metricType = document.getElementById('qx-metric-type')?.value?.trim();
      if (!metricType) return null;
      return {
        metricType,
        project:     document.getElementById('qx-project')?.value || 'mad-master',
        timeWindow:  parseInt(document.getElementById('qx-time-window')?.value || '30', 10),
        aggregation: {
          perSeriesAligner:   document.getElementById('qx-aligner')?.value || 'ALIGN_MEAN',
          crossSeriesReducer: document.getElementById('qx-reducer')?.value || 'REDUCE_NONE',
          alignmentPeriod:    document.getElementById('qx-period')?.value  || '60s',
        },
        filters:    document.getElementById('qx-filters')?.value?.trim() || '',
        widgetType: this._widgetType?.value || 'big-number',
      };
    }

    _buildBqBody() {
      const sql = document.getElementById('qx-sql')?.value?.trim();
      if (!sql) return null;
      return { sql, widgetType: this._widgetType?.value || 'big-number' };
    }

    // ── Raw Results Rendering ─────────────────────────────────────

    _showError(message) {
      this._results.textContent = '';
      const div = document.createElement('div');
      div.className = 'qx-error-banner';
      div.textContent = message;
      this._results.appendChild(div);
    }

    _renderGcpResults(rawSeries, seriesCount, pointCount, ms) {
      this._results.textContent = '';
      if (!rawSeries?.length) {
        const div = document.createElement('div');
        div.className = 'qx-empty-banner';
        div.textContent = 'Query returned no data for this time window.';
        this._results.appendChild(div);
        return;
      }

      // Header
      const hdr = document.createElement('div');
      hdr.className = 'qx-results-header';
      const meta = document.createElement('span');
      meta.className = 'qx-results-meta';
      const s1 = document.createElement('span');
      s1.textContent = seriesCount + ' series';
      const s2 = document.createElement('span');
      s2.textContent = pointCount + ' points';
      const s3 = document.createElement('span');
      s3.textContent = ms + 'ms';
      meta.appendChild(s1);
      meta.appendChild(s2);
      meta.appendChild(s3);
      hdr.appendChild(meta);
      this._results.appendChild(hdr);

      // Table
      this._results.appendChild(this._buildTable(rawSeries));
    }

    _renderBqResults(rows, rowCount, columnCount, ms) {
      this._results.textContent = '';
      if (!rows?.length) {
        const div = document.createElement('div');
        div.className = 'qx-empty-banner';
        div.textContent = 'Query returned no rows.';
        this._results.appendChild(div);
        return;
      }

      // Header
      const hdr = document.createElement('div');
      hdr.className = 'qx-results-header';
      const meta = document.createElement('span');
      meta.className = 'qx-results-meta';
      const s1 = document.createElement('span');
      s1.textContent = rowCount + ' rows';
      const s2 = document.createElement('span');
      s2.textContent = columnCount + ' columns';
      const s3 = document.createElement('span');
      s3.textContent = ms + 'ms';
      meta.appendChild(s1);
      meta.appendChild(s2);
      meta.appendChild(s3);
      hdr.appendChild(meta);
      this._results.appendChild(hdr);

      this._results.appendChild(this._buildTable(rows));
    }

    _buildTable(rows) {
      if (!rows?.length) return document.createTextNode('');
      const cols = Object.keys(rows[0]);

      const wrap  = document.createElement('div');
      wrap.className = 'qx-results-table-wrap';
      const table = document.createElement('table');
      table.className = 'qx-results-table';

      // Header row
      const thead = document.createElement('thead');
      const hrow  = document.createElement('tr');
      cols.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        hrow.appendChild(th);
      });
      thead.appendChild(hrow);
      table.appendChild(thead);

      // Body rows
      const tbody = document.createElement('tbody');
      rows.forEach(row => {
        const tr = document.createElement('tr');
        cols.forEach(col => {
          const td  = document.createElement('td');
          const val = row[col];
          const str = val === null || val === undefined ? 'NULL' : String(val);
          td.textContent = str.length > 80 ? str.slice(0, 80) + '\u2026' : str;
          if (typeof val === 'number') td.classList.add('qx-td-num');
          if (str.length > 80) td.title = str;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      return wrap;
    }

    // ── Widget Preview ────────────────────────────────────────────

    _renderWidgetPreview(widgetData, widgetType) {
      this._previewWrap.textContent = '';
      this._previewConfig.style.display = '';

      const unit = this._unit?.value?.trim() || '';
      const max  = parseFloat(this._maxInput?.value) || undefined;
      if (this._maxRow) {
        this._maxRow.style.display = widgetType === 'gauge' ? '' : 'none';
      }

      if (!widgetData || !window.Widgets) {
        const p = document.createElement('div');
        p.className = 'qx-results-placeholder';
        p.textContent = 'No data to preview';
        this._previewWrap.appendChild(p);
        return;
      }

      const data = { ...widgetData };
      if (unit)           data.unit = unit;
      if (max !== undefined && widgetType === 'gauge') data.max = max;

      try {
        if (this._widget?.destroy) this._widget.destroy();
        this._widget = window.Widgets.create(widgetType, this._previewWrap, { type: widgetType });
        if (this._widget?.update) this._widget.update(data);
      } catch (_) {
        const p = document.createElement('div');
        p.className = 'qx-results-placeholder';
        p.textContent = 'Not supported for this data shape';
        this._previewWrap.textContent = '';
        this._previewWrap.appendChild(p);
      }
    }

    _onWidgetTypeChange() {
      if (!this._lastRaw) return;
      const type = this._widgetType?.value || 'big-number';

      // Re-transform client-side from cached raw data
      let widgetData = null;
      if (this._lastRaw.type === 'gcp') {
        widgetData = this._transformGcpClientSide(this._lastRaw.rawSeries, type);
      } else {
        widgetData = this._transformBqClientSide(this._lastRaw.rows, type);
      }
      this._renderWidgetPreview(widgetData, type);
    }

    _transformGcpClientSide(rawSeries, widgetType) {
      if (!rawSeries?.length) return null;
      const vals = rawSeries.map(r => r.value);
      switch (widgetType) {
        case 'big-number':
        case 'stat-card':
          return { value: vals[0], sparkline: vals.slice(0, 20), unit: '' };
        case 'gauge':
          return { value: vals[0], min: 0, max: 100, unit: '' };
        case 'line-chart':
          return { series: [{ label: 'Value', data: vals.slice(0, 30) }], timestamps: [] };
        case 'bar-chart': {
          // Group by first non-timestamp, non-value key
          const labelKey = Object.keys(rawSeries[0]).find(k => k !== 'timestamp' && k !== 'value');
          if (!labelKey) return { bars: [{ label: 'Value', value: vals[0] }] };
          const seen = new Map();
          rawSeries.forEach(r => {
            const lbl = String(r[labelKey]);
            if (!seen.has(lbl)) seen.set(lbl, r.value);
          });
          return { bars: [...seen.entries()].slice(0, 10).map(([label, value]) => ({ label, value })) };
        }
        default:
          return { value: vals[0], unit: '' };
      }
    }

    _transformBqClientSide(rows, widgetType) {
      if (!rows?.length) return null;
      const cols   = Object.keys(rows[0]);
      const numCol = cols.find(c => typeof rows[0][c] === 'number');
      const strCol = cols.find(c => typeof rows[0][c] === 'string');
      if (!numCol) return null;

      switch (widgetType) {
        case 'big-number':
        case 'stat-card':
          return { value: rows[0][numCol], sparkline: rows.slice(1, 21).map(r => r[numCol] || 0), unit: '' };
        case 'gauge':
          return { value: rows[0][numCol], min: 0, max: 100, unit: '' };
        case 'bar-chart':
          return { bars: rows.slice(0, 10).map(r => ({ label: strCol ? String(r[strCol]) : String(r[numCol]), value: r[numCol] || 0 })) };
        case 'line-chart':
          return { series: [{ label: numCol, data: rows.map(r => r[numCol] || 0) }], timestamps: [] };
        default:
          return { value: rows[0][numCol], unit: '' };
      }
    }

    // ── Export CSV ────────────────────────────────────────────────

    _exportCsv() {
      if (!this._lastRaw) return;
      const rows = this._lastRaw.type === 'gcp'
        ? this._lastRaw.rawSeries
        : this._lastRaw.rows;
      if (!rows?.length) return;

      const cols = Object.keys(rows[0]);
      const lines = [
        cols.join(','),
        ...rows.map(r => cols.map(c => {
          const v = r[c] ?? '';
          const s = String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? '"' + s.replace(/"/g, '""') + '"'
            : s;
        }).join(',')),
      ];

      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'query-explorer-' + Date.now() + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    }

    // ── Save as Query ─────────────────────────────────────────────

    async _saveAsQuery() {
      const src = this._source?.value;
      if (!src) return;
      let body;
      if (src === 'gcp') {
        body = this._buildGcpBody();
        if (!body) { this.app.showToast('Enter a metric type first', 'error'); return; }
        // Map explore body shape to queries API shape
        body = {
          id:          body.metricType.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + Date.now(),
          name:        body.metricType.split('/').pop(),
          metricType:  body.metricType,
          project:     body.project,
          timeWindow:  body.timeWindow,
          aggregation: body.aggregation,
          filters:     body.filters,
          widgetTypes: [],
        };
      } else {
        body = this._buildBqBody();
        if (!body) { this.app.showToast('Enter a SQL query first', 'error'); return; }
        body = {
          id:          'bq-' + Date.now(),
          name:        'BigQuery Query ' + new Date().toLocaleTimeString(),
          sql:         body.sql,
          widgetTypes: [],
        };
      }

      try {
        const res = await fetch('/api/queries/' + src, {
          method:  'POST',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        this.app.showToast('Query saved: ' + body.name, 'success');
        this.app.renderQueryList();
      } catch (err) {
        this.app.showToast('Save failed: ' + err.message, 'error');
      }
    }

    // ── Assign to Widget ──────────────────────────────────────────

    _assignToWidget() {
      // Delegate to the existing assign flow in the query editor panel
      this.app.showToast('Open the widget properties panel and use "Assign to Widget" there', 'info');
    }

    // ── Metric Browser integration ────────────────────────────────

    _openMetricBrowser() {
      if (!this.app?.metricBrowser) return;
      // Register a one-shot callback: when a metric is selected in the browser,
      // populate our metric type input instead of saving a query.
      this.app.metricBrowser._explorerCallback = (metricType) => {
        const input = document.getElementById('qx-metric-type');
        if (input) input.value = metricType;
        this.app.metricBrowser._explorerCallback = null;
      };
      // Open with a sentinel target so _apply() doesn't crash
      this.app.metricBrowser.open({ _explorerMode: true });
    }

    // ── BigQuery schema browser ───────────────────────────────────

    async _loadBqDatasets() {
      if (!this._bqDataset) return;
      try {
        const res  = await fetch('/api/bigquery/datasets');
        const data = await res.json();
        if (!data.success) return;
        this._bqDataset.textContent = '';
        const dflt = document.createElement('option');
        dflt.value = '';
        dflt.textContent = 'Dataset\u2026';
        this._bqDataset.appendChild(dflt);
        (data.datasets || []).forEach(d => {
          const opt = document.createElement('option');
          opt.value = opt.textContent = typeof d === 'string' ? d : d.id || d.datasetId;
          this._bqDataset.appendChild(opt);
        });
      } catch (_) { /* silent */ }
    }

    async _loadBqTables() {
      if (!this._bqTable) return;
      const ds = this._bqDataset?.value;
      if (!ds) return;
      try {
        const res  = await fetch('/api/bigquery/datasets/' + encodeURIComponent(ds) + '/tables');
        const data = await res.json();
        this._bqTable.textContent = '';
        const dflt = document.createElement('option');
        dflt.value = '';
        dflt.textContent = 'Table\u2026';
        this._bqTable.appendChild(dflt);
        (data.tables || []).forEach(t => {
          const opt = document.createElement('option');
          opt.value = opt.textContent = typeof t === 'string' ? t : t.id || t.tableId;
          this._bqTable.appendChild(opt);
        });
      } catch (_) { /* silent */ }
    }

    async _loadBqSchema() {
      if (!this._schemaCols) return;
      const ds = this._bqDataset?.value;
      const tbl = this._bqTable?.value;
      if (!ds || !tbl) return;
      try {
        const res  = await fetch('/api/bigquery/datasets/' + encodeURIComponent(ds) + '/tables/' + encodeURIComponent(tbl) + '/schema');
        const data = await res.json();
        this._schemaCols.textContent = '';
        const fields = data.schema?.fields || data.fields || [];
        fields.forEach(f => {
          const row   = document.createElement('div');
          row.className = 'qx-schema-col';
          const name  = document.createElement('span');
          name.className = 'qx-col-name';
          name.textContent = f.name;
          const type  = document.createElement('span');
          type.className = 'qx-col-type';
          type.textContent = f.type;
          row.appendChild(name);
          row.appendChild(type);
          this._schemaCols.appendChild(row);
        });
      } catch (_) { /* silent */ }
    }

    // ── Utilities ─────────────────────────────────────────────────

    _setActionsDisabled(disabled) {
      if (this._exportBtn) this._exportBtn.disabled = disabled;
      if (this._saveBtn)   this._saveBtn.disabled   = disabled;
      if (this._assignBtn) this._assignBtn.disabled  = disabled;
    }
  }

  return QueryExplorer;
})();
```

**Step 2: Commit**
```bash
git add public/js/query-explorer.js
git commit -m "feat: QueryExplorer class — three-panel query sandbox with GCP + BigQuery support"
```

---

### Task 5: Wire up — StudioApp.init() + MetricBrowser callback

**Files:**
- Modify: `public/js/studio.js`

**Step 1: Instantiate QueryExplorer in StudioApp.init()**

In `StudioApp.init()`, add the following line immediately after the `GcpDashboardImporter` try/catch (line ~25):
```js
      try { this.queryExplorer = new QueryExplorer(this); } catch (e) { console.error('[studio] QueryExplorer init failed:', e); }
```

**Step 2: Patch MetricBrowser._apply() to support explorer mode**

Find `MetricBrowser._apply()` (around line 1699 in studio.js). It starts with:
```js
    async _apply() {
      const wc = this.target, descriptor = this.selected;
      if (!wc || !descriptor) return;
```

Add an early-exit branch for explorer mode, before the main body:
```js
    async _apply() {
      const wc = this.target, descriptor = this.selected;
      if (!wc || !descriptor) return;

      // Explorer mode: route metric type to the callback instead of saving a query
      if (wc._explorerMode && typeof this._explorerCallback === 'function') {
        this._explorerCallback(descriptor.type);
        this.close();
        return;
      }
```

**Step 3: Restart and manual test**
```bash
sudo systemctl restart tv-dashboards && sleep 2
sudo systemctl is-active tv-dashboards
```

Manual test sequence:
1. Open `/admin` → Queries tab → click **⬧ Explorer**
2. Explorer modal opens full-screen with three panels
3. **GCP:** type `run.googleapis.com/request_count`, click ▶ Run — raw time series table appears, widget preview renders in right panel
4. Change widget type → preview re-renders without re-fetch
5. Click Browse → MetricBrowser opens → select a metric → closes and populates the metric type field
6. **BigQuery:** switch source to BigQuery → type `SELECT zip3, state, SUM(impressions) AS impressions FROM \`mad-data.reporting.billable_agg\` WHERE date_nyc >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 20` → click ▶ Run → table shows zip3/state/impressions columns
7. Click **↓ Export CSV** → file downloads
8. Click **Save as Query** → query appears in Queries tab list

**Step 4: Commit**
```bash
git add public/js/studio.js
git commit -m "feat: wire QueryExplorer into StudioApp.init() + MetricBrowser explorer-mode callback"
```

---

### Task 6: Final integration check

**Step 1: Run full test suite**
```bash
bun test 2>&1 | tail -6
```
Expected: all existing tests pass + 8 new explore-routes tests pass, 0 fail

**Step 2: Verify new routes in OpenAPI**
```bash
curl -s http://tv:3000/api/explore/gcp \
  -X POST -H 'content-type: application/json' \
  -d '{}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error'))"
```
Expected: `metricType is required`

**Step 3: Confirm git log**
```bash
git log --oneline -8
```
Expected commits in order:
- `feat: wire QueryExplorer into StudioApp.init()…`
- `feat: QueryExplorer class…`
- `feat: Query Explorer CSS…`
- `feat: Query Explorer modal skeleton…`
- `feat: explore routes — POST /api/explore/gcp…`
