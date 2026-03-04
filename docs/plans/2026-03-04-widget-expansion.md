# Widget Library Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose 4 hidden widget types (line-chart, table, multi-metric-card, stacked-bar-chart) in the Studio widget palette and expand type selectors in the query editor panel and Query Explorer, including server-side and client-side `table` data transforms.

**Architecture:** All 14 widget renderers already exist in `public/js/widgets.js` and `public/js/charts.js`. The gaps are: (1) the Studio palette `TYPES` array only lists 12, (2) the query editor and Explorer preview selectors only offer 4-5 options, (3) server transformers in `gcp.js` and `explore-routes.js` don't handle `table` shape, (4) client-side re-transform in `query-explorer.js` doesn't handle `table` or `multi-metric-card`. This plan adds the missing wiring, no new widget renderers needed.

**Tech Stack:** Bun, Elysia.js, vanilla JS, existing `window.Widgets` + `window.Charts`.

---

### Task 1: Studio palette + type selectors in HTML/JS

**Files:**
- Modify: `public/js/studio.js` (~line 956 — TYPES array in `openWidgetPalette()`)
- Modify: `public/studio.html` (3 selectors: `#qe-preview-type`, `#qx-widget-type`, add-widget palette source)

**No tests needed** — these are UI option additions verified manually.

**Step 1: Add 4 types to the Studio widget palette**

In `public/js/studio.js`, find the `TYPES` array inside `openWidgetPalette()` (around line 956). Currently ends with `security-scorecard`. Add 4 entries after it:

```js
        { type: 'line-chart',        icon: '\uD83D\uDCC8', name: 'Line Chart' },
        { type: 'table',             icon: '\u25A6',        name: 'Table' },
        { type: 'multi-metric-card', icon: '\u22A0',        name: 'Multi Metric' },
        { type: 'stacked-bar-chart', icon: '\u2590',        name: 'Stacked Bar' },
```

**Step 2: Add types to `#qe-preview-type` selector in `public/studio.html`**

Find `#qe-preview-type` (around line 350). Currently has 4 options. Add after `bar-chart`:
```html
                <option value="line-chart">Line Chart</option>
                <option value="table">Table</option>
                <option value="multi-metric-card">Multi Metric</option>
```

**Step 3: Add types to `#qx-widget-type` selector in `public/studio.html`**

Find `#qx-widget-type` (around line 674). Currently has 5 options. Add after `bar-chart`:
```html
              <option value="table">Table</option>
              <option value="multi-metric-card">Multi Metric</option>
              <option value="stacked-bar-chart">Stacked Bar</option>
```

**Step 4: Restart and verify**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s http://tv:3000/admin | grep -c 'line-chart\|multi-metric\|stacked-bar'
```
Expected: at least 4 matches (the new options appear in the HTML)

**Step 5: Commit**
```bash
git add public/js/studio.js public/studio.html
git commit -m "feat: expose line-chart, table, multi-metric-card, stacked-bar-chart in Studio palette and type selectors"
```

---

### Task 2: Server-side `table` transform — GCP + BigQuery

**Files:**
- Modify: `server/data-sources/gcp.js` (~line 248 — end of transformers map)
- Modify: `server/explore-routes.js` (~line 180 — `transformBqRows` switch)
- Test: `tests/unit/data-sources/gcp.test.js` (extend)
- Test: `tests/unit/routes/explore-routes.test.js` (extend)

**Context:** The `table` widget expects `{ columns: [{key, label, align, format?}], rows: [{...}] }`. For GCP time series, each point across all series becomes a row with timestamp + resource labels + value. For BigQuery rows, columns are inferred from the first row's keys.

**Step 1: Write failing GCP table transform test**

In `tests/unit/data-sources/gcp.test.js`, add a test in the `transformData()` describe block:

```js
  describe('transformData() table type', () => {
    it('returns columns and rows from time series', () => {
      const ts = [{
        resource: { labels: { service_name: 'bidder' } },
        metric:   { labels: {} },
        points: [
          { interval: { endTime: { seconds: 1709547600 } }, value: { doubleValue: 142.3 } },
          { interval: { endTime: { seconds: 1709547540 } }, value: { doubleValue: 138.7 } },
        ],
      }];
      // Access transformData via a GCPDataSource instance
      const ds = new GCPDataSource({});
      const result = ds.transformData(ts, 'table');
      expect(result).toHaveProperty('columns');
      expect(result).toHaveProperty('rows');
      expect(Array.isArray(result.columns)).toBe(true);
      expect(Array.isArray(result.rows)).toBe(true);
      // Should have timestamp, service_name, value columns
      const colKeys = result.columns.map(c => c.key);
      expect(colKeys).toContain('timestamp');
      expect(colKeys).toContain('value');
      expect(colKeys).toContain('service_name');
      // Should have 2 rows (one per point)
      expect(result.rows.length).toBe(2);
      expect(typeof result.rows[0].value).toBe('number');
    });

    it('returns empty columns and rows for empty time series', () => {
      const ds = new GCPDataSource({});
      const result = ds.transformData([], 'table');
      expect(result).toHaveProperty('columns');
      expect(result).toHaveProperty('rows');
      expect(result.rows.length).toBe(0);
    });
  });
```

**Step 2: Run and confirm failure**
```bash
bun test tests/unit/data-sources/gcp.test.js --reporter=verbose 2>&1 | grep -E 'fail|pass' | tail -5
```
Expected: new table tests FAIL

**Step 3: Add `table` transformer to `server/data-sources/gcp.js`**

Find the `transformers` object (around line 185). After the existing `'bar-chart'` case and before the closing `};`, add:

```js
      'table': (ts) => {
        const { latest } = require('../gcp-metrics.js');
        if (!Array.isArray(ts) || !ts.length) return { columns: [], rows: [] };

        // Collect all unique label keys across all series
        const labelKeys = new Set();
        ts.forEach(series => {
          Object.keys(series.resource?.labels || {}).forEach(k => labelKeys.add(k));
          Object.keys(series.metric?.labels   || {}).forEach(k => labelKeys.add(k));
        });
        const labelArr = [...labelKeys];

        const columns = [
          { key: 'timestamp', label: 'Timestamp', align: 'left' },
          ...labelArr.map(k => ({ key: k, label: k, align: 'left' })),
          { key: 'value', label: 'Value', align: 'right', format: 'number' },
        ];

        const rows = [];
        for (const series of ts) {
          const labels = {
            ...(series.resource?.labels || {}),
            ...(series.metric?.labels   || {}),
          };
          for (const point of (series.points || []).slice(0, 50)) {
            const v = point.value;
            rows.push({
              timestamp: point.interval?.endTime?.seconds
                ? new Date(point.interval.endTime.seconds * 1000)
                    .toISOString().replace('T', ' ').slice(0, 19)
                : '',
              ...Object.fromEntries(labelArr.map(k => [k, labels[k] || ''])),
              value: Number(v.doubleValue || v.int64Value || v.distributionValue?.mean || 0),
            });
          }
        }
        return {
          columns,
          rows: rows.slice(0, 200),
          ...(options.timePeriod && { timePeriod: options.timePeriod }),
        };
      },
```

**Step 4: Run GCP tests — must pass**
```bash
bun test tests/unit/data-sources/gcp.test.js 2>&1 | tail -4
```
Expected: all tests pass including new table tests

**Step 5: Write failing BigQuery table transform test**

In `tests/unit/routes/explore-routes.test.js`, add to the BigQuery describe block:

```js
    it('returns table shape when widgetType is table', async () => {
      const res = await app.handle(new Request('http://localhost/api/explore/bigquery', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ sql: 'SELECT * FROM test', widgetType: 'table' }),
      }));
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.widgetData).toHaveProperty('columns');
      expect(body.widgetData).toHaveProperty('rows');
      expect(Array.isArray(body.widgetData.columns)).toBe(true);
      // columns inferred from mock rows: zip3, state, impressions
      const colKeys = body.widgetData.columns.map(c => c.key);
      expect(colKeys).toContain('zip3');
      expect(colKeys).toContain('impressions');
      // impressions is a number — should be right-aligned
      const impCol = body.widgetData.columns.find(c => c.key === 'impressions');
      expect(impCol.align).toBe('right');
      expect(impCol.format).toBe('number');
    });
```

**Step 6: Run and confirm failure**
```bash
bun test tests/unit/routes/explore-routes.test.js 2>&1 | tail -4
```
Expected: new table test FAIL

**Step 7: Add `table` to `transformBqRows` in `server/explore-routes.js`**

Find the `switch (widgetType)` in `transformBqRows`. After the `'line-chart'` case and before `default`, add:

```js
    case 'table': {
      if (!rows?.length) return null;
      const sampleRow = rows[0];
      const cols = Object.keys(sampleRow);
      return {
        columns: cols.map(k => ({
          key:    k,
          label:  k,
          align:  typeof sampleRow[k] === 'number' ? 'right' : 'left',
          format: typeof sampleRow[k] === 'number' ? 'number' : undefined,
        })),
        rows: rows.slice(0, 200),
      };
    }
```

**Step 8: Run all explore-routes tests — must pass**
```bash
bun test tests/unit/routes/explore-routes.test.js 2>&1 | tail -4
```
Expected: all tests pass

**Step 9: Commit**
```bash
git add server/data-sources/gcp.js server/explore-routes.js tests/unit/data-sources/gcp.test.js tests/unit/routes/explore-routes.test.js
git commit -m "feat: add table transformer to GCPDataSource and explore-routes BigQuery transform"
```

---

### Task 3: Client-side transforms in Query Explorer

**Files:**
- Modify: `public/js/query-explorer.js`

**Context:** `_transformGcpClientSide(rawSeries, type)` and `_transformBqClientSide(rows, type)` both need `table` and `multi-metric-card` cases so the Explorer preview re-renders without a re-fetch when the user changes the widget type dropdown.

`rawSeries` shape: `[{ timestamp, value, ...resourceLabels }]` (flat, from the server's `extractRawSeries`)
`rows` shape: `[{ col1: val, col2: val, ... }]` (BigQuery raw rows)

**No tests** — these are client-side transform functions called only in the browser.

**Step 1: Add `table` and `multi-metric-card` to `_transformGcpClientSide()`**

Find `_transformGcpClientSide(rawSeries, widgetType)`. Currently has cases for big-number, stat-card, gauge, line-chart, bar-chart. Add before `default`:

```js
        case 'table': {
          if (!rawSeries?.length) return null;
          const sample = rawSeries[0];
          const cols   = Object.keys(sample);
          return {
            columns: cols.map(k => ({
              key:    k,
              label:  k,
              align:  typeof sample[k] === 'number' ? 'right' : 'left',
              format: typeof sample[k] === 'number' ? 'number' : undefined,
            })),
            rows: rawSeries.slice(0, 200),
          };
        }
        case 'multi-metric-card': {
          // Group by the first non-timestamp/non-value label key
          const labelKey = rawSeries[0] && Object.keys(rawSeries[0]).find(k => k !== 'timestamp' && k !== 'value');
          if (!labelKey) return { metrics: [{ label: 'Value', value: rawSeries[0]?.value ?? 0, unit: '', trend: 'stable' }] };
          const seen = new Map();
          rawSeries.forEach(r => {
            const lbl = String(r[labelKey]);
            if (!seen.has(lbl)) seen.set(lbl, r.value);
          });
          return {
            metrics: [...seen.entries()].slice(0, 6).map(([label, value]) => ({ label, value, unit: '', trend: 'stable' })),
          };
        }
```

**Step 2: Add `table` and `multi-metric-card` to `_transformBqClientSide()`**

Find `_transformBqClientSide(rows, widgetType)`. Add before `default`:

```js
        case 'table': {
          if (!rows?.length) return null;
          const sample = rows[0];
          const cols   = Object.keys(sample);
          return {
            columns: cols.map(k => ({
              key:    k,
              label:  k,
              align:  typeof sample[k] === 'number' ? 'right' : 'left',
              format: typeof sample[k] === 'number' ? 'number' : undefined,
            })),
            rows: rows.slice(0, 200),
          };
        }
        case 'multi-metric-card': {
          if (!rows?.length) return null;
          const sample  = rows[0];
          const numCols = Object.keys(sample).filter(k => typeof sample[k] === 'number');
          if (!numCols.length) return null;
          return {
            metrics: numCols.slice(0, 6).map(k => ({ label: k, value: sample[k], unit: '', trend: 'stable' })),
          };
        }
        case 'stacked-bar-chart': {
          // Each row = one category; numeric columns = series data
          if (!rows?.length) return null;
          const sample   = rows[0];
          const strCol   = Object.keys(sample).find(k => typeof sample[k] === 'string');
          const numCols  = Object.keys(sample).filter(k => typeof sample[k] === 'number');
          if (!numCols.length) return null;
          return {
            categories: rows.map(r => strCol ? String(r[strCol]) : ''),
            series: numCols.map(k => ({
              label: k,
              data:  rows.map(r => r[k] || 0),
            })),
          };
        }
```

**Step 3: Restart and manual test**
```bash
sudo systemctl restart tv-dashboards && sleep 2
```

Open `/admin` → Queries tab → ⬧ Explorer → select BigQuery → type:
```sql
SELECT zip3, state, impressions FROM `mad-data.reporting.billable_agg`
WHERE date_nyc = CURRENT_DATE() LIMIT 20
```
Click ▶ Run → switch Widget Type to **Table** → confirm a proper `{ columns, rows }` table widget renders in the right panel.

Also test: switch to **Multi Metric** → confirm metric cards appear.

**Step 4: Commit**
```bash
git add public/js/query-explorer.js
git commit -m "feat: add table, multi-metric-card, stacked-bar-chart client-side transforms to Query Explorer"
```

---

### Task 4: Final integration check

**Step 1: Run full test suite**
```bash
git restore config/ && bun test 2>&1 | tail -5
```
Expected: existing tests pass + new table transform tests pass

**Step 2: Run new tests specifically**
```bash
bun test tests/unit/data-sources/gcp.test.js tests/unit/routes/explore-routes.test.js 2>&1 | tail -4
```
Expected: all pass

**Step 3: Verify Studio palette has new types**
```bash
curl -s http://tv:3000/admin | python3 -c "
import sys
html = sys.stdin.read()
for t in ['line-chart', 'table', 'multi-metric-card', 'stacked-bar-chart']:
    print(t + ':', t in html)
"
```
Expected: all True

**Step 4: Check git log**
```bash
git log --oneline -5
```
Expected commits:
- `feat: add table, multi-metric-card, stacked-bar-chart client-side transforms`
- `feat: add table transformer to GCPDataSource and explore-routes`
- `feat: expose line-chart, table, multi-metric-card, stacked-bar-chart in Studio palette`
