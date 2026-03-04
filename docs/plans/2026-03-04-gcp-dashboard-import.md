# GCP Dashboard Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import metric queries from GCP Cloud Monitoring console dashboards into `queries.yaml` via a two-step modal in the Studio Queries tab.

**Architecture:** A new `server/gcp-dashboards.js` module calls the GCP Cloud Monitoring Dashboards REST API using the existing `google-auth-library` credentials, parses chart tiles into `{ name, metricType, filters, aggregation }` records, and exposes them via two new Elysia routes. The Studio Queries tab gains an "Import from GCP Dashboards" button that opens a two-step modal (dashboard picker → tile checklist with conflict indicators → per-conflict skip/overwrite).

**Tech Stack:** Bun, Elysia.js, `google-auth-library` (already installed), vanilla JS, `queries.yaml` via `query-manager.js`.

---

### Task 1: `server/gcp-dashboards.js` — core module

**Files:**
- Create: `server/gcp-dashboards.js`
- Test: `tests/unit/gcp-dashboards.test.js`

**Step 1: Write the failing tests**

Create `tests/unit/gcp-dashboards.test.js`:

```js
import { describe, it, expect } from 'bun:test';
import { parseTiles, slugifyId } from '../../server/gcp-dashboards.js';

const FIXTURE_MOSAIC = {
  displayName: 'Bidder Overview',
  mosaicLayout: {
    tiles: [
      {
        widget: {
          title: 'Winner Candidates',
          xyChart: {
            dataSets: [{
              timeSeriesQuery: {
                timeSeriesFilter: {
                  filter: 'metric.type="custom.googleapis.com/opencensus/mhive/bidder/winner_candidates_count" resource.type="global"',
                  aggregation: {
                    alignmentPeriod: '60s',
                    perSeriesAligner: 'ALIGN_DELTA',
                    crossSeriesReducer: 'REDUCE_SUM',
                  },
                },
              },
            }],
          },
        },
      },
      {
        widget: {
          title: 'Request Latency',
          scorecard: {
            timeSeriesQuery: {
              timeSeriesFilter: {
                filter: 'metric.type="monitoring.googleapis.com/uptime_check/request_latency"',
                aggregation: {
                  alignmentPeriod: '60s',
                  perSeriesAligner: 'ALIGN_MEAN',
                  crossSeriesReducer: 'REDUCE_MEAN',
                },
              },
            },
          },
        },
      },
      {
        widget: {
          title: 'Notes',
          text: { content: 'Dashboard notes' },
        },
      },
    ],
  },
};

const FIXTURE_GRID = {
  displayName: 'Cloud Run',
  gridLayout: {
    widgets: [
      {
        title: 'Request Count',
        xyChart: {
          dataSets: [{
            timeSeriesQuery: {
              timeSeriesFilter: {
                filter: 'metric.type="run.googleapis.com/request_count"',
                aggregation: { alignmentPeriod: '60s', perSeriesAligner: 'ALIGN_RATE' },
              },
            },
          }],
        },
      },
    ],
  },
};

const FIXTURE_MULTI_DATASET = {
  displayName: 'Multi',
  mosaicLayout: {
    tiles: [{
      widget: {
        title: 'CPU & Memory',
        xyChart: {
          dataSets: [
            {
              timeSeriesQuery: {
                timeSeriesFilter: {
                  filter: 'metric.type="kubernetes.io/container/cpu/core_usage_time"',
                  aggregation: { perSeriesAligner: 'ALIGN_MEAN' },
                },
              },
            },
            {
              timeSeriesQuery: {
                timeSeriesFilter: {
                  filter: 'metric.type="kubernetes.io/container/memory/used_bytes"',
                  aggregation: { perSeriesAligner: 'ALIGN_MEAN' },
                },
              },
            },
          ],
        },
      },
    }],
  },
};

describe('parseTiles()', () => {
  it('extracts xyChart tiles from mosaicLayout', () => {
    const tiles = parseTiles(FIXTURE_MOSAIC);
    const winner = tiles.find(t => t.name === 'Winner Candidates');
    expect(winner).toBeDefined();
    expect(winner.metricType).toBe('custom.googleapis.com/opencensus/mhive/bidder/winner_candidates_count');
    expect(winner.filters).toBe('resource.type="global"');
    expect(winner.aggregation.perSeriesAligner).toBe('ALIGN_DELTA');
    expect(winner.aggregation.crossSeriesReducer).toBe('REDUCE_SUM');
    expect(winner.aggregation.alignmentPeriod).toBe('60s');
  });

  it('extracts scorecard tiles from mosaicLayout', () => {
    const tiles = parseTiles(FIXTURE_MOSAIC);
    const latency = tiles.find(t => t.name === 'Request Latency');
    expect(latency).toBeDefined();
    expect(latency.metricType).toBe('monitoring.googleapis.com/uptime_check/request_latency');
  });

  it('skips text/alert widgets with no metricType', () => {
    const tiles = parseTiles(FIXTURE_MOSAIC);
    expect(tiles.find(t => t.name === 'Notes')).toBeUndefined();
    expect(tiles.length).toBe(2);
  });

  it('extracts widgets from gridLayout', () => {
    const tiles = parseTiles(FIXTURE_GRID);
    expect(tiles.length).toBe(1);
    expect(tiles[0].metricType).toBe('run.googleapis.com/request_count');
  });

  it('splits multi-dataset tiles into multiple rows with suffixed names', () => {
    const tiles = parseTiles(FIXTURE_MULTI_DATASET);
    expect(tiles.length).toBe(2);
    expect(tiles[0].name).toBe('CPU & Memory (1)');
    expect(tiles[0].metricType).toBe('kubernetes.io/container/cpu/core_usage_time');
    expect(tiles[1].name).toBe('CPU & Memory (2)');
    expect(tiles[1].metricType).toBe('kubernetes.io/container/memory/used_bytes');
  });

  it('generates a unique slug id for each tile', () => {
    const tiles = parseTiles(FIXTURE_MOSAIC);
    expect(tiles[0].id).toMatch(/^[a-z0-9-]+-[a-z0-9]{4}$/);
    expect(tiles[0].id).not.toBe(tiles[1].id);
  });

  it('fills in missing aggregation fields with defaults', () => {
    const dashboard = {
      displayName: 'X',
      gridLayout: {
        widgets: [{
          title: 'Bare Metric',
          xyChart: {
            dataSets: [{
              timeSeriesQuery: {
                timeSeriesFilter: {
                  filter: 'metric.type="custom.googleapis.com/foo"',
                },
              },
            }],
          },
        }],
      },
    };
    const tiles = parseTiles(dashboard);
    expect(tiles[0].aggregation.perSeriesAligner).toBe('ALIGN_MEAN');
    expect(tiles[0].aggregation.alignmentPeriod).toBe('60s');
  });
});

describe('slugifyId()', () => {
  it('lowercases and replaces spaces/special chars with hyphens', () => {
    const id = slugifyId('Winner Candidates', 'custom.googleapis.com/foo');
    expect(id).toMatch(/^winner-candidates-[a-z0-9]{4}$/);
  });

  it('produces different ids for same name but different metricType', () => {
    const id1 = slugifyId('Requests', 'run.googleapis.com/request_count');
    const id2 = slugifyId('Requests', 'run.googleapis.com/request_latencies');
    expect(id1).not.toBe(id2);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun test tests/unit/gcp-dashboards.test.js
```

Expected: FAIL — `Cannot find module '../../server/gcp-dashboards.js'`

**Step 3: Implement `server/gcp-dashboards.js`**

```js
// ===========================================================================
// GCP Dashboard Importer — lists Cloud Monitoring dashboards and parses tiles
// ===========================================================================

import { GoogleAuth } from 'google-auth-library';
import logger from './logger.js';

const MONITORING_BASE = 'https://monitoring.googleapis.com/v1';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/monitoring.read'],
  ...(process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? { keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS }
    : {}),
});

async function gcpFetch(url) {
  const client = await auth.getClient();
  const res = await client.request({ url });
  return res.data;
}

/**
 * List all custom dashboards for a GCP project.
 * Returns [{ name, displayName, tileCount }]
 */
export async function listDashboards(project) {
  const data = await gcpFetch(`${MONITORING_BASE}/projects/${project}/dashboards`);
  const dashboards = data.dashboards || [];
  return dashboards.map(d => ({
    name:        d.name,
    displayName: d.displayName || d.name.split('/').pop(),
    tileCount:   countTiles(d),
  }));
}

/**
 * Fetch a single dashboard and return its parsed tiles.
 * name: full resource name e.g. "projects/mad-master/dashboards/abc123"
 */
export async function getDashboard(name) {
  const data = await gcpFetch(`${MONITORING_BASE}/${name}`);
  return parseTiles(data);
}

function countTiles(dashboard) {
  return collectWidgets(dashboard).length;
}

function collectWidgets(dashboard) {
  const widgets = [];
  if (dashboard.mosaicLayout?.tiles) {
    for (const tile of dashboard.mosaicLayout.tiles) {
      if (tile.widget) widgets.push(tile.widget);
    }
  } else if (dashboard.gridLayout?.widgets) {
    widgets.push(...dashboard.gridLayout.widgets);
  } else if (dashboard.rowLayout?.rows) {
    for (const row of dashboard.rowLayout.rows) {
      if (row.widgets) widgets.push(...row.widgets);
    }
  }
  return widgets;
}

/**
 * Parse all chart tiles in a dashboard into importable query definitions.
 * Returns [{ id, name, metricType, filters, aggregation }]
 * Exported for unit testing.
 */
export function parseTiles(dashboard) {
  const results = [];

  for (const widget of collectWidgets(dashboard)) {
    const title = widget.title || 'Untitled';
    const tsFilters = [];

    if (widget.xyChart?.dataSets) {
      for (const ds of widget.xyChart.dataSets) {
        const tsf = ds?.timeSeriesQuery?.timeSeriesFilter;
        if (tsf) tsFilters.push(tsf);
      }
    } else if (widget.scorecard?.timeSeriesQuery?.timeSeriesFilter) {
      tsFilters.push(widget.scorecard.timeSeriesQuery.timeSeriesFilter);
    }

    if (tsFilters.length === 0) continue;

    const multi = tsFilters.length > 1;

    tsFilters.forEach((tsf, i) => {
      const parsed = parseFilter(tsf.filter || '');
      if (!parsed.metricType) return;

      const name = multi ? `${title} (${i + 1})` : title;
      const agg  = tsf.aggregation || {};

      results.push({
        id:          slugifyId(name, parsed.metricType),
        name,
        metricType:  parsed.metricType,
        filters:     parsed.remaining,
        aggregation: {
          perSeriesAligner:   agg.perSeriesAligner   || 'ALIGN_MEAN',
          crossSeriesReducer: agg.crossSeriesReducer  || undefined,
          alignmentPeriod:    agg.alignmentPeriod     || '60s',
        },
      });
    });
  }

  return results;
}

function parseFilter(filterStr) {
  const match = filterStr.match(/metric\.type="([^"]+)"/);
  if (!match) return { metricType: null, remaining: '' };
  const metricType = match[1];
  const remaining  = filterStr.replace(match[0], '').trim();
  return { metricType, remaining };
}

/**
 * Generate a stable, URL-safe id from a tile name and metricType.
 * Appends a 4-char hash of the metricType to avoid collisions.
 * Exported for unit testing.
 */
export function slugifyId(name, metricType) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  let h = 5381;
  for (let i = 0; i < metricType.length; i++) {
    h = ((h << 5) + h) ^ metricType.charCodeAt(i);
    h = h >>> 0;
  }
  const suffix = (h % 0x10000).toString(16).padStart(4, '0');

  return `${slug}-${suffix}`;
}
```

**Step 4: Run tests to verify they pass**

```bash
bun test tests/unit/gcp-dashboards.test.js
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add server/gcp-dashboards.js tests/unit/gcp-dashboards.test.js
git commit -m "feat: gcp-dashboards module — parseTiles, slugifyId, listDashboards, getDashboard"
```

---

### Task 2: Elysia route plugin — `server/gcp-dashboard-routes.js`

**Files:**
- Create: `server/gcp-dashboard-routes.js`
- Modify: `server/index.js` (add import + `.use()`)
- Test: `tests/unit/routes/gcp-dashboard-routes.test.js`

**Step 1: Write failing tests**

Create `tests/unit/routes/gcp-dashboard-routes.test.js`:

```js
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';

const mockListDashboards = mock(async (project) => [
  { name: `projects/${project}/dashboards/abc`, displayName: 'Bidder Overview', tileCount: 5 },
]);

const mockGetDashboard = mock(async (_name) => [
  {
    id:          'winner-candidates-a1b2',
    name:        'Winner Candidates',
    metricType:  'custom.googleapis.com/opencensus/mhive/bidder/winner_candidates_count',
    filters:     '',
    aggregation: { perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_SUM', alignmentPeriod: '60s' },
  },
]);

mock.module('../../server/gcp-dashboards.js', () => ({
  listDashboards: mockListDashboards,
  getDashboard:   mockGetDashboard,
}));

const mockLoadQueries = mock(() => ({
  gcp: [{ id: 'existing-q', metricType: 'run.googleapis.com/request_count' }],
}));

mock.module('../../server/query-manager.js', () => ({
  loadQueries: mockLoadQueries,
}));

const { gcpDashboardRoutes } = await import('../../server/gcp-dashboard-routes.js');

describe('GCP Dashboard Routes', () => {
  let app;

  beforeEach(() => {
    app = new Elysia().use(gcpDashboardRoutes);
    mockListDashboards.mockClear();
    mockGetDashboard.mockClear();
  });

  describe('GET /api/gcp/dashboards', () => {
    it('returns dashboard list for default project', async () => {
      const res  = await app.handle(new Request('http://localhost/api/gcp/dashboards'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.dashboards)).toBe(true);
      expect(body.dashboards[0].displayName).toBe('Bidder Overview');
    });

    it('passes project query param to listDashboards', async () => {
      await app.handle(new Request('http://localhost/api/gcp/dashboards?project=mad-data'));
      expect(mockListDashboards).toHaveBeenCalledWith('mad-data');
    });

    it('returns 500 with error when GCP call fails', async () => {
      mockListDashboards.mockRejectedValueOnce(new Error('auth failed'));
      const res  = await app.handle(new Request('http://localhost/api/gcp/dashboards'));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('auth failed');
    });
  });

  describe('GET /api/gcp/dashboards/:name', () => {
    it('returns parsed tiles for a dashboard', async () => {
      const res  = await app.handle(new Request('http://localhost/api/gcp/dashboards/abc?project=mad-master'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.tiles)).toBe(true);
      expect(body.tiles[0].metricType).toBe('custom.googleapis.com/opencensus/mhive/bidder/winner_candidates_count');
    });

    it('flags tiles whose metricType already exists in queries.yaml', async () => {
      mockGetDashboard.mockResolvedValueOnce([{
        id: 'req-count-xxxx',
        name: 'Request Count',
        metricType: 'run.googleapis.com/request_count',
        filters: '',
        aggregation: { perSeriesAligner: 'ALIGN_RATE', alignmentPeriod: '60s' },
      }]);
      const res  = await app.handle(new Request('http://localhost/api/gcp/dashboards/abc?project=mad-master'));
      const body = await res.json();
      expect(body.tiles[0].conflictId).toBe('existing-q');
    });

    it('reconstructs full resource name from :name param and project', async () => {
      await app.handle(new Request('http://localhost/api/gcp/dashboards/abc123?project=mad-data'));
      expect(mockGetDashboard).toHaveBeenCalledWith('projects/mad-data/dashboards/abc123');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun test tests/unit/routes/gcp-dashboard-routes.test.js
```

Expected: FAIL — `Cannot find module '../../server/gcp-dashboard-routes.js'`

**Step 3: Implement `server/gcp-dashboard-routes.js`**

```js
// ===========================================================================
// GCP Dashboard Import Routes
// ===========================================================================

import { Elysia } from 'elysia';
import { listDashboards, getDashboard } from './gcp-dashboards.js';
import { loadQueries } from './query-manager.js';
import logger from './logger.js';

const DEFAULT_PROJECT = (process.env.GCP_PROJECTS || 'mad-master').split(',')[0].trim();

export const gcpDashboardRoutes = new Elysia({ prefix: '/api/gcp/dashboards' })

  .get('/', async ({ query }) => {
    const project = query.project || DEFAULT_PROJECT;
    try {
      const dashboards = await listDashboards(project);
      return { success: true, project, dashboards };
    } catch (err) {
      logger.error({ err: err.message }, 'listDashboards failed');
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['queries'],
      summary: 'List GCP custom dashboards',
      description: 'List all Cloud Monitoring custom dashboards for a GCP project, with tile counts.',
    },
  })

  .get('/:name', async ({ params, query }) => {
    const project  = query.project || DEFAULT_PROJECT;
    const fullName = `projects/${project}/dashboards/${params.name}`;
    try {
      const rawTiles   = await getDashboard(fullName);
      const existing   = loadQueries();
      const gcpQueries = existing.gcp || [];

      const tiles = rawTiles.map(tile => {
        const conflict = gcpQueries.find(q => q.metricType === tile.metricType);
        return conflict ? { ...tile, conflictId: conflict.id } : tile;
      });

      return { success: true, project, dashboardName: params.name, tiles };
    } catch (err) {
      logger.error({ err: err.message }, 'getDashboard failed');
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['queries'],
      summary: 'Get importable tiles from a GCP dashboard',
      description: 'Returns parsed metric tiles. Tiles with a conflictId already exist in queries.yaml.',
    },
  });
```

**Step 4: Mount routes in `server/index.js`**

Add import at top of `server/index.js` (after line 19, alongside the other route imports):

```js
import { gcpDashboardRoutes } from './gcp-dashboard-routes.js';
```

Add `.use()` in the chain (after line 1280, alongside `.use(queryRoutes)`):

```js
  .use(gcpDashboardRoutes)
```

**Step 5: Run tests to verify they pass**

```bash
bun test tests/unit/routes/gcp-dashboard-routes.test.js
```

Expected: All tests PASS.

**Step 6: Smoke-test the running server**

```bash
sudo systemctl restart tv-dashboards
curl -s 'http://tv:3000/api/gcp/dashboards?project=mad-master' | head -c 300
```

Expected: JSON with `{ "success": true, "project": "mad-master", "dashboards": [...] }`

**Step 7: Commit**

```bash
git add server/gcp-dashboards.js server/gcp-dashboard-routes.js server/index.js tests/unit/routes/gcp-dashboard-routes.test.js
git commit -m "feat: GCP dashboard import API routes — GET /api/gcp/dashboards and /:name"
```

---

### Task 3: Studio HTML — import button and modal markup

**Files:**
- Modify: `public/studio.html`

**Context:** The Queries panel at line ~111 of `studio.html`:
```html
<div class="sidebar-panel" id="panel-queries" style="display:none">
  <div id="query-list" class="query-list"></div>
</div>
```

**Step 1: Replace `#panel-queries` block**

Find the exact string above and replace it with:

```html
<div class="sidebar-panel" id="panel-queries" style="display:none">
  <div class="query-list-toolbar">
    <button id="import-gcp-dashboards-btn" class="btn-import-gcp" title="Import queries from GCP Cloud Monitoring dashboards">
      &#8595; Import from GCP
    </button>
  </div>
  <div id="query-list" class="query-list"></div>
</div>
```

**Step 2: Add import modal just before `</body>`**

```html
<!-- GCP Dashboard Import Modal -->
<div id="gcp-import-modal" class="modal-overlay" style="display:none">
  <div class="modal-box gcp-import-modal-box">
    <div class="modal-header">
      <div class="modal-title-row">
        <button id="gcp-import-back-btn" class="btn-modal-back" style="display:none">&#8592; Back</button>
        <h2 id="gcp-import-title">Import from GCP Dashboards</h2>
      </div>
      <button id="gcp-import-close-btn" class="btn-modal-close">&#x2715;</button>
    </div>
    <div id="gcp-import-step1">
      <div class="gcp-import-project-tabs" id="gcp-import-project-tabs"></div>
      <div id="gcp-import-dashboard-list" class="gcp-import-list">
        <div class="gcp-import-loading">Loading dashboards&#8230;</div>
      </div>
    </div>
    <div id="gcp-import-step2" style="display:none">
      <div id="gcp-import-tile-list" class="gcp-import-list"></div>
      <div class="gcp-import-footer">
        <span id="gcp-import-selected-count" class="gcp-import-count">0 selected</span>
        <button id="gcp-import-do-btn" class="btn-primary" disabled>Import Selected</button>
      </div>
    </div>
  </div>
</div>
```

**Step 3: Restart and verify button appears**

```bash
sudo systemctl restart tv-dashboards
```

Open `/admin` → Queries tab → confirm "↓ Import from GCP" button renders. No JS errors.

**Step 4: Commit**

```bash
git add public/studio.html
git commit -m "feat: add GCP dashboard import button and modal skeleton to studio.html"
```

---

### Task 4: Studio CSS — import modal styles

**Files:**
- Modify: `public/css/studio.css`

**Step 1: Append to end of `public/css/studio.css`**

```css
/* ── GCP Dashboard Import ─────────────────────────────────────── */

.query-list-toolbar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  gap: 6px;
}

.btn-import-gcp {
  background: var(--accent, #7c3aed);
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: 0.02em;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.btn-import-gcp:hover { opacity: 0.85; }

.gcp-import-modal-box {
  width: 520px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

.modal-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-modal-back {
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted, #888);
  padding: 3px 8px;
  font-size: 12px;
  cursor: pointer;
}
.btn-modal-back:hover { color: var(--text); }

.gcp-import-project-tabs {
  display: flex;
  gap: 4px;
  padding: 10px 16px 0;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.gcp-import-project-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #888);
  cursor: pointer;
  margin-bottom: -1px;
}
.gcp-import-project-tab.active {
  border-bottom-color: var(--accent, #7c3aed);
  color: var(--text);
}

.gcp-import-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  min-height: 200px;
}

.gcp-import-loading,
.gcp-import-empty {
  padding: 24px 16px;
  color: var(--text-muted, #888);
  font-size: 13px;
  text-align: center;
}

.gcp-import-error {
  padding: 12px 16px;
  background: rgba(220,38,38,0.1);
  color: #ef4444;
  font-size: 12px;
  border-radius: 4px;
  margin: 8px 16px;
}

.gcp-dashboard-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.05));
  transition: background 0.1s;
}
.gcp-dashboard-row:hover { background: var(--hover, rgba(255,255,255,0.05)); }

.gcp-dashboard-row-name { font-size: 13px; font-weight: 500; }
.gcp-dashboard-row-count { font-size: 11px; color: var(--text-muted, #888); }

.gcp-tile-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.05));
}
.gcp-tile-row.disabled { opacity: 0.4; pointer-events: none; }

.gcp-tile-row input[type="checkbox"] {
  margin-top: 2px;
  flex-shrink: 0;
  accent-color: var(--accent, #7c3aed);
}

.gcp-tile-info { flex: 1; min-width: 0; }

.gcp-tile-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gcp-tile-metric {
  font-size: 11px;
  color: var(--text-muted, #888);
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gcp-tile-conflict {
  font-size: 10px;
  color: #f59e0b;
  background: rgba(245,158,11,0.12);
  border: 1px solid rgba(245,158,11,0.3);
  border-radius: 3px;
  padding: 1px 5px;
  white-space: nowrap;
  flex-shrink: 0;
  align-self: center;
}

.gcp-import-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.gcp-import-count { font-size: 12px; color: var(--text-muted, #888); }

/* Inline conflict resolution prompt */
.gcp-conflict-prompt {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  z-index: 10;
}

.gcp-conflict-box {
  background: var(--surface, #1e1e2e);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px 24px;
  max-width: 340px;
  text-align: center;
}

.gcp-conflict-msg {
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 16px;
}

.gcp-conflict-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}
```

**Step 2: Visual check (manual)**

Open `/admin` → Queries tab → button is styled. (Modal not interactive yet — JS in next task.)

**Step 3: Commit**

```bash
git add public/css/studio.css
git commit -m "feat: GCP dashboard import styles — button, project tabs, tile checklist, conflict badge"
```

---

### Task 5: Studio JS — GcpDashboardImporter class

**Files:**
- Modify: `public/js/studio.js`

**Context:** `studio.js` is a single IIFE. Add `GcpDashboardImporter` as a class inside the IIFE, after `MetricBrowser` and before `const app = new StudioApp()`. Wire it up in `StudioApp.init()`.

**Important:** All dynamic DOM content must use `createElement` + `textContent` — never `innerHTML` with variable interpolation.

**Step 1: Locate the insertion point**

Search for `const app = new StudioApp()` near the bottom of `studio.js`. Insert the new class immediately above that line.

**Step 2: Add `GcpDashboardImporter` class**

```js
  /* ==========================================================================
     GcpDashboardImporter — two-step modal for importing GCP dashboard metrics
     ========================================================================== */

  class GcpDashboardImporter {
    constructor(studioApp) {
      this.app           = studioApp;
      this.projects      = (window.__GCP_PROJECTS__ ||
                            'mad-master,mad-data,mad-audit,mad-looker-enterprise')
                             .split(',').map(p => p.trim()).filter(Boolean);
      this.activeProject = this.projects[0];
      this._tiles        = [];
      this._dashboard    = null;

      this.modal      = document.getElementById('gcp-import-modal');
      this.step1      = document.getElementById('gcp-import-step1');
      this.step2      = document.getElementById('gcp-import-step2');
      this.titleEl    = document.getElementById('gcp-import-title');
      this.backBtn    = document.getElementById('gcp-import-back-btn');
      this.closeBtn   = document.getElementById('gcp-import-close-btn');
      this.projectTabs= document.getElementById('gcp-import-project-tabs');
      this.dashList   = document.getElementById('gcp-import-dashboard-list');
      this.tileList   = document.getElementById('gcp-import-tile-list');
      this.doBtn      = document.getElementById('gcp-import-do-btn');
      this.countEl    = document.getElementById('gcp-import-selected-count');

      this._bindEvents();
    }

    _bindEvents() {
      document.getElementById('import-gcp-dashboards-btn')
        ?.addEventListener('click', () => this.open());
      this.closeBtn?.addEventListener('click', () => this.close());
      this.backBtn?.addEventListener('click',  () => this._showStep1());
      this.modal?.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
      this.doBtn?.addEventListener('click', () => this._importSelected());
    }

    open() {
      if (!this.modal) return;
      this.modal.style.display = 'flex';
      this._showStep1();
      this._renderProjectTabs();
      this._loadDashboards();
    }

    close() {
      if (this.modal) this.modal.style.display = 'none';
    }

    // ── Step 1: dashboard list ─────────────────────────────────────

    _renderProjectTabs() {
      if (!this.projectTabs) return;
      this.projectTabs.textContent = '';
      this.projects.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'gcp-import-project-tab' + (p === this.activeProject ? ' active' : '');
        btn.textContent = p;
        btn.addEventListener('click', () => {
          this.activeProject = p;
          this._renderProjectTabs();
          this._loadDashboards();
        });
        this.projectTabs.appendChild(btn);
      });
    }

    async _loadDashboards() {
      this.dashList.textContent = '';
      const loading = document.createElement('div');
      loading.className = 'gcp-import-loading';
      loading.textContent = 'Loading dashboards\u2026';
      this.dashList.appendChild(loading);

      try {
        const res  = await fetch('/api/gcp/dashboards?project=' + encodeURIComponent(this.activeProject));
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Unknown error');

        this.dashList.textContent = '';
        const dashboards = data.dashboards || [];
        if (!dashboards.length) {
          const empty = document.createElement('div');
          empty.className = 'gcp-import-empty';
          empty.textContent = 'No custom dashboards found in this project.';
          this.dashList.appendChild(empty);
          return;
        }

        dashboards.forEach(d => {
          const row = document.createElement('div');
          row.className = 'gcp-dashboard-row';

          const nameEl = document.createElement('span');
          nameEl.className = 'gcp-dashboard-row-name';
          nameEl.textContent = d.displayName;

          const countEl = document.createElement('span');
          countEl.className = 'gcp-dashboard-row-count';
          countEl.textContent = d.tileCount + ' charts';

          row.appendChild(nameEl);
          row.appendChild(countEl);
          row.addEventListener('click', () => this._openDashboard(d));
          this.dashList.appendChild(row);
        });
      } catch (err) {
        this.dashList.textContent = '';
        const errEl = document.createElement('div');
        errEl.className = 'gcp-import-error';
        errEl.textContent = 'Could not connect to GCP: ' + err.message;
        this.dashList.appendChild(errEl);
      }
    }

    // ── Step 2: tile checklist ─────────────────────────────────────

    async _openDashboard(d) {
      this._dashboard = d;
      this._showStep2();
      this.tileList.textContent = '';
      const loading = document.createElement('div');
      loading.className = 'gcp-import-loading';
      loading.textContent = 'Loading tiles\u2026';
      this.tileList.appendChild(loading);
      this.doBtn.disabled = true;
      this.countEl.textContent = '0 selected';

      const shortId = d.name.split('/').pop();

      try {
        const res  = await fetch('/api/gcp/dashboards/' + encodeURIComponent(shortId) + '?project=' + encodeURIComponent(this.activeProject));
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Unknown error');

        this._tiles = data.tiles || [];
        this._renderTiles();
      } catch (err) {
        this.tileList.textContent = '';
        const errEl = document.createElement('div');
        errEl.className = 'gcp-import-error';
        errEl.textContent = 'Failed to load tiles: ' + err.message;
        this.tileList.appendChild(errEl);
      }
    }

    _renderTiles() {
      this.tileList.textContent = '';
      if (!this._tiles.length) {
        const empty = document.createElement('div');
        empty.className = 'gcp-import-empty';
        empty.textContent = 'No importable chart tiles found.';
        this.tileList.appendChild(empty);
        return;
      }

      this._tiles.forEach((tile, i) => {
        const row = document.createElement('div');
        row.className = 'gcp-tile-row';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.idx = i;
        cb.addEventListener('change', () => this._updateCount());

        const info = document.createElement('div');
        info.className = 'gcp-tile-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'gcp-tile-name';
        nameEl.textContent = tile.name;

        const metricEl = document.createElement('div');
        metricEl.className = 'gcp-tile-metric';
        metricEl.textContent = tile.metricType;

        info.appendChild(nameEl);
        info.appendChild(metricEl);
        row.appendChild(cb);
        row.appendChild(info);

        if (tile.conflictId) {
          const badge = document.createElement('span');
          badge.className = 'gcp-tile-conflict';
          badge.textContent = '\u26a0 exists';
          badge.title = 'Already saved as query: ' + tile.conflictId;
          row.appendChild(badge);
        }

        this.tileList.appendChild(row);
      });
    }

    _updateCount() {
      const checked = this.tileList.querySelectorAll('input[type="checkbox"]:checked').length;
      this.countEl.textContent = checked + ' selected';
      this.doBtn.disabled = checked === 0;
    }

    // ── Import ─────────────────────────────────────────────────────

    async _importSelected() {
      const checkboxes = [...this.tileList.querySelectorAll('input[type="checkbox"]:checked')];
      if (!checkboxes.length) return;

      const selected = checkboxes.map(cb => ({ ...this._tiles[parseInt(cb.dataset.idx, 10)] }));

      let imported = 0;
      let skipped  = 0;

      for (const tile of selected) {
        if (tile.conflictId) {
          const action = await this._resolveConflict(tile);
          if (action === 'skip') { skipped++; continue; }
          tile.id = tile.conflictId; // overwrite: reuse existing id
        }

        try {
          const res = await fetch('/api/queries/gcp', {
            method:  'POST',
            headers: { 'content-type': 'application/json' },
            body:    JSON.stringify({
              id:          tile.id,
              name:        tile.name,
              metricType:  tile.metricType,
              project:     this.activeProject,
              filters:     tile.filters || '',
              aggregation: tile.aggregation,
              timeWindow:  10,
              widgetTypes: [],
            }),
          });
          if (res.ok) imported++;
          else skipped++;
        } catch (_) {
          skipped++;
        }
      }

      this.close();
      this.app.renderQueryList();
      const msg   = imported + ' imported' + (skipped ? ', ' + skipped + ' skipped' : '');
      const level = imported > 0 ? 'success' : 'info';
      this.app.showToast(msg, level);
    }

    // Returns Promise<'skip'|'overwrite'>
    _resolveConflict(tile) {
      return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'gcp-conflict-prompt';

        const box = document.createElement('div');
        box.className = 'gcp-conflict-box';

        const msg = document.createElement('div');
        msg.className = 'gcp-conflict-msg';
        const strong = document.createElement('strong');
        strong.textContent = tile.name;
        msg.appendChild(strong);
        msg.appendChild(document.createTextNode(' already exists as a saved query.'));

        const actions = document.createElement('div');
        actions.className = 'gcp-conflict-actions';

        const skipBtn = document.createElement('button');
        skipBtn.className = 'btn-secondary';
        skipBtn.textContent = 'Skip';
        skipBtn.addEventListener('click', () => { overlay.remove(); resolve('skip'); });

        const overwriteBtn = document.createElement('button');
        overwriteBtn.className = 'btn-primary';
        overwriteBtn.textContent = 'Overwrite';
        overwriteBtn.addEventListener('click', () => { overlay.remove(); resolve('overwrite'); });

        actions.appendChild(skipBtn);
        actions.appendChild(overwriteBtn);
        box.appendChild(msg);
        box.appendChild(actions);
        overlay.appendChild(box);

        const modalBox = this.modal.querySelector('.modal-box');
        if (modalBox) modalBox.appendChild(overlay);
      });
    }

    // ── Navigation ─────────────────────────────────────────────────

    _showStep1() {
      this.step1.style.display  = '';
      this.step2.style.display  = 'none';
      this.backBtn.style.display = 'none';
      this.titleEl.textContent   = 'Import from GCP Dashboards';
    }

    _showStep2() {
      this.step1.style.display   = 'none';
      this.step2.style.display   = '';
      this.backBtn.style.display = '';
      this.titleEl.textContent   = this._dashboard?.displayName || 'Select Tiles';
    }
  }
```

**Step 3: Wire up in `StudioApp.init()`**

In `StudioApp.init()`, add this line immediately after the `MetricBrowser` init try/catch (around line 24 of studio.js):

```js
      try { this.gcpImporter = new GcpDashboardImporter(this); } catch (e) { console.error('[studio] GcpDashboardImporter init failed:', e); }
```

**Step 4: Restart and end-to-end test**

```bash
sudo systemctl restart tv-dashboards
```

Manual test sequence:
1. Open `/admin` → Queries tab → click "↓ Import from GCP"
2. Modal opens; project tabs show (mad-master, mad-data, etc.)
3. Dashboard list loads from GCP (or shows "No custom dashboards")
4. Click a dashboard → tile checklist appears with ⚠ badges on conflicts
5. Check tiles → "Import Selected" enables → click it
6. Conflicting tile shows inline Skip/Overwrite prompt
7. After completing, modal closes, query list refreshes, toast shows count

**Step 5: Commit**

```bash
git add public/js/studio.js
git commit -m "feat: GcpDashboardImporter — two-step import modal wired in Studio Queries tab"
```

---

### Task 6: Final integration check

**Step 1: Run full test suite**

```bash
bun test
```

Expected: All existing tests pass. New tests in `tests/unit/gcp-dashboards.test.js` and `tests/unit/routes/gcp-dashboard-routes.test.js` pass.

**Step 2: Verify OpenAPI docs**

Open `http://tv:3000/openapi` → confirm two new routes appear under the `queries` tag:
- `GET /api/gcp/dashboards`
- `GET /api/gcp/dashboards/{name}`

**Step 3: Final commit if any fixups**

```bash
git log --oneline -6
```

Confirm the 5 feature commits are in sequence.
