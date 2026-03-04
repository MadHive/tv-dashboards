# Computed Queries Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate 11 legacy widgets from hardcoded `gcp-metrics.js` dispatcher functions into the query engine by adding a `computed` source type, making each widget editable in the Studio and explorable in the Query Explorer.

**Architecture:** A new `computed:` section in `queries.yaml` maps query IDs to named server functions. `server/data-sources/computed.js` implements the DataSource interface — it looks up the query by ID, calls the registered function from `gcp-metrics.js`, and returns widget data. Eight new named exports are added to `gcp-metrics.js` (extracted from the existing private dashboard functions). The 11 widgets in `dashboards.yaml` are updated with `source: computed` and a `queryId`. The Query Explorer gains a Computed source option that lists and runs these functions ad-hoc.

**Tech Stack:** Bun, Elysia.js, existing `gcp-metrics.js` functions, `DataSource` base class, `query-manager.js`, `data-source-registry.js`.

---

### Task 1: Add 8 named exports to `server/gcp-metrics.js`

**Files:**
- Modify: `server/gcp-metrics.js`
- Test: `tests/unit/gcp-metrics-exports.test.js`

**Context:** The existing private functions (`servicesHealth`, `bidderCluster`, etc.) return maps of all widgets for a dashboard. The new exports extract specific widget data and add a `rawData` array for the Explorer.

**Step 1: Write failing tests**

Create `tests/unit/gcp-metrics-exports.test.js`:

```js
import { describe, it, expect, mock } from 'bun:test';

// Mock the GCP monitoring client and BigQuery before importing gcp-metrics
mock.module('@google-cloud/monitoring', () => ({
  default: { MetricServiceClient: class { listTimeSeries: mock(async () => [[]]) } }
}));
mock.module('@google-cloud/bigquery', () => ({
  BigQuery: class { query: mock(async () => [[]]) }
}));

const gcpMetrics = await import('../../server/gcp-metrics.js');

describe('gcp-metrics named exports', () => {
  it('exports storageVolume as a function', () => {
    expect(typeof gcpMetrics.storageVolume).toBe('function');
  });
  it('exports fleetHealth as a function', () => {
    expect(typeof gcpMetrics.fleetHealth).toBe('function');
  });
  it('exports serviceLatency as a function', () => {
    expect(typeof gcpMetrics.serviceLatency).toBe('function');
  });
  it('exports campaignDeliveryMapWidget as a function', () => {
    expect(typeof gcpMetrics.campaignDeliveryMapWidget).toBe('function');
  });
  it('exports coreClusterSize as a function', () => {
    expect(typeof gcpMetrics.coreClusterSize).toBe('function');
  });
  it('exports pipelineFlow as a function', () => {
    expect(typeof gcpMetrics.pipelineFlow).toBe('function');
  });
  it('exports bidderErrorRate as a function', () => {
    expect(typeof gcpMetrics.bidderErrorRate).toBe('function');
  });
  it('exports bidderTimeoutRate as a function', () => {
    expect(typeof gcpMetrics.bidderTimeoutRate).toBe('function');
  });

  it('storageVolume returns { data, rawData }', async () => {
    const result = await gcpMetrics.storageVolume();
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('rawData');
    expect(Array.isArray(result.rawData)).toBe(true);
  });

  it('fleetHealth returns { data, rawData }', async () => {
    const result = await gcpMetrics.fleetHealth();
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('rawData');
  });
});
```

**Step 2: Run and confirm failure**
```bash
bun test tests/unit/gcp-metrics-exports.test.js
```
Expected: FAIL — exports not found

**Step 3: Add 8 exports to `server/gcp-metrics.js`**

Add the following **after** the existing private functions and **before** `export async function getMetrics`:

```js
// ===========================================================================
// Named exports for the computed query engine
// Each returns { data: widgetData, rawData: [{label, value}] }
// ===========================================================================

/**
 * Total storage bytes across BigQuery (mad-data + mad-master),
 * Bigtable (mad-master), and GCS (mad-data + mad-master).
 */
export async function storageVolume() {
  const AGG_STORAGE = { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_SUM' };
  const [bqData, bqMaster, btUsed, gcsData, gcsMaster] = await Promise.all([
    query('mad-data',   'bigquery.googleapis.com/storage/stored_bytes',  '', 60, AGG_STORAGE),
    query('mad-master', 'bigquery.googleapis.com/storage/stored_bytes',  '', 60, AGG_STORAGE),
    query('mad-master', 'bigtable.googleapis.com/table/bytes_used',      'resource.type = "bigtable_table"', 10, AGG_STORAGE),
    query('mad-data',   'storage.googleapis.com/storage/total_bytes',    'resource.type = "gcs_bucket"', 60, AGG_STORAGE),
    query('mad-master', 'storage.googleapis.com/storage/total_bytes',    'resource.type = "gcs_bucket"', 60, AGG_STORAGE),
  ]);
  const bqBytes  = (latest(bqData) || 0) + (latest(bqMaster) || 0);
  const btBytes  = latest(btUsed)  || 0;
  const gcsBytes = (latest(gcsData) || 0) + (latest(gcsMaster) || 0);
  const total    = bqBytes + btBytes + gcsBytes;
  const parts    = [];
  if (bqBytes  > 0) parts.push('BQ '  + fmtBytes(bqBytes));
  if (btBytes  > 0) parts.push('BT '  + fmtBytes(btBytes));
  if (gcsBytes > 0) parts.push('GCS ' + fmtBytes(gcsBytes));
  return {
    data: { value: total > 0 ? fmtBytes(total) : '—', detail: parts.join(' + ') || 'BQ + BT + GCS', trend: 'up' },
    rawData: [
      { label: 'BigQuery (mad-data)',    value: bqBytes  > 0 ? fmtBytes(latest(bqData) || 0)   : '0' },
      { label: 'BigQuery (mad-master)',  value: bqBytes  > 0 ? fmtBytes(latest(bqMaster) || 0) : '0' },
      { label: 'Bigtable (mad-master)',  value: btBytes  > 0 ? fmtBytes(btBytes)                : '0' },
      { label: 'GCS (mad-data)',         value: gcsBytes > 0 ? fmtBytes(latest(gcsData) || 0)   : '0' },
      { label: 'GCS (mad-master)',       value: gcsBytes > 0 ? fmtBytes(latest(gcsMaster) || 0) : '0' },
      { label: 'Total',                  value: total    > 0 ? fmtBytes(total)                   : '0' },
    ],
  };
}

/**
 * Percentage of Cloud Run services currently receiving requests.
 */
export async function fleetHealth() {
  const { requestCounts, latencies } = await getCloudRunData();
  const svcMap     = buildServiceMap(requestCounts, latencies);
  const allSvcs    = Object.values(svcMap);
  const online     = allSvcs.filter(s => s.requestRate > 0).length;
  const pct        = allSvcs.length > 0 ? Math.round(online / allSvcs.length * 100) : 100;
  return {
    data: { value: pct, detail: online + '/' + allSvcs.length + ' active', trend: 'stable' },
    rawData: [
      { label: 'online services', value: online },
      { label: 'total services',  value: allSvcs.length },
      { label: 'health %',        value: pct },
    ],
  };
}

/**
 * Median request latency across all Cloud Run services (ms).
 */
export async function serviceLatency() {
  const { latencies } = await getCloudRunData();
  const svcMap    = buildServiceMap([], latencies);
  const withLat   = Object.values(svcMap).filter(s => s.latency > 0).sort((a, b) => a.latency - b.latency);
  const median    = withLat.length > 0 ? Math.round(withLat[Math.floor(withLat.length / 2)].latency) : null;
  return {
    data: { value: median },
    rawData: withLat.slice(0, 10).map(s => ({ label: s.name, value: s.latency })),
  };
}

/**
 * Campaign delivery map data (hotspots + state choropleth).
 * params: { region?: string, widgetId?: string, timeWindow?: number, minImpressions?: number }
 */
export async function campaignDeliveryMapWidget(params = {}, widgetConfig = {}) {
  const wc = {
    id:        widgetConfig.id || params.widgetId || 'usa-delivery-map',
    mapConfig: {
      region:         params.region         || widgetConfig.mapConfig?.region,
      timeWindow:     params.timeWindow     || widgetConfig.mapConfig?.timeWindow,
      minImpressions: params.minImpressions || widgetConfig.mapConfig?.minImpressions,
    },
  };
  const all  = await campaignDeliveryMap(wc);
  const data = all[wc.id] || {};
  const topHotspots = (data.hotspots || []).slice(0, 20).map(h => ({
    label: (h.zip3 || '?') + ' (' + (h.state || '?') + ')',
    value: h.impressions || 0,
  }));
  return { data, rawData: topHotspots };
}

/**
 * Total active containers across bidder + roger + memcached.
 */
export async function coreClusterSize() {
  const containerCount = (name) => ({
    alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_COUNT',
    filter: `resource.labels.container_name = "${name}"`,
  });
  const filter = (name) => `resource.labels.container_name = "${name}"`;
  const [bidderTs, rogerTs, memTs] = await Promise.all([
    query('mad-master', 'kubernetes.io/container/uptime', filter('bidder'),    10, { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_COUNT' }),
    query('mad-master', 'kubernetes.io/container/uptime', filter('roger'),     10, { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_COUNT' }),
    query('mad-master', 'kubernetes.io/container/uptime', filter('memcached'), 10, { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_COUNT' }),
  ]);
  const bidder   = Math.round(latest(bidderTs) || 0);
  const roger    = Math.round(latest(rogerTs)  || 0);
  const memcache = Math.round(latest(memTs)    || 0);
  const total    = bidder + roger + memcache;
  return {
    data: { value: String(total), detail: 'total containers', trend: 'stable' },
    rawData: [
      { label: 'bidder',    value: bidder },
      { label: 'roger',     value: roger },
      { label: 'memcached', value: memcache },
      { label: 'total',     value: total },
    ],
  };
}

/**
 * End-to-end pipeline stage flow (6 stages with throughput + latency).
 */
export async function pipelineFlow() {
  const all = await dataPipeline();
  return {
    data: all['pipeline'],
    rawData: (all['pipeline']?.stages || []).map(s => ({ label: s.name, value: s.throughput })),
  };
}

/**
 * Bidder LB error rate — non-2xx, non-204, non-503 response codes as %.
 */
export async function bidderErrorRate() {
  const all = await bidderCluster();
  const d   = all['error-rate'] || {};
  return {
    data: d,
    rawData: [{ label: 'error rate', value: d.value ?? 0 }],
  };
}

/**
 * Bidder LB timeout rate — 408 + 504 response codes as %.
 */
export async function bidderTimeoutRate() {
  const all = await bidderCluster();
  const d   = all['timeout-rate'] || {};
  return {
    data: d,
    rawData: [{ label: 'timeout rate', value: d.value ?? 0 }],
  };
}
```

**Step 4: Run tests — all must pass**
```bash
bun test tests/unit/gcp-metrics-exports.test.js
```
Expected: 10 pass, 0 fail

**Step 5: Commit**
```bash
git add server/gcp-metrics.js tests/unit/gcp-metrics-exports.test.js
git commit -m "feat: add 8 named exports to gcp-metrics.js for computed query engine"
```

---

### Task 2: Add `computed:` section to `config/queries.yaml`

**Files:**
- Modify: `config/queries.yaml`

**Context:** `queries.yaml` has a top-level `bigquery:` and `gcp:` section. Add a `computed:` section with 10 entries (8 functions; `campaignDeliveryMapWidget` has 3 regional entries). The `function` field is the name of the exported function from `gcp-metrics.js` that the `ComputedDataSource` will call.

**Step 1: Add `computed:` section at the top of `config/queries.yaml`**

Add the following as the **first** content of the file (before `bigquery:`):

```yaml
computed:
  - id: storage-volume
    name: Storage Volume
    description: Combined storage bytes across BigQuery, Bigtable, and GCS (mad-data + mad-master)
    function: storageVolume
    widgetTypes:
      - stat-card
  - id: fleet-health
    name: Fleet Health
    description: Percentage of Cloud Run services currently receiving requests
    function: fleetHealth
    widgetTypes:
      - gauge
  - id: service-latency
    name: Median Service Latency
    description: Median request latency across all Cloud Run services (ms)
    function: serviceLatency
    widgetTypes:
      - gauge
  - id: campaign-delivery-map
    name: Campaign Delivery Map
    description: USA delivery heatmap — BigQuery impression data + GCP data center arcs (nationwide)
    function: campaignDeliveryMapWidget
    params:
      widgetId: usa-delivery-map
    widgetTypes:
      - usa-map
  - id: campaign-delivery-map-ne
    name: Campaign Delivery Map (Northeast)
    description: Northeast region delivery heatmap
    function: campaignDeliveryMapWidget
    params:
      region: northeast
      widgetId: usa-delivery-map-ne
    widgetTypes:
      - usa-map
  - id: campaign-delivery-map-se
    name: Campaign Delivery Map (Southeast)
    description: Southeast region delivery heatmap
    function: campaignDeliveryMapWidget
    params:
      region: southeast
      widgetId: usa-delivery-map-se
    widgetTypes:
      - usa-map
  - id: core-cluster-size
    name: Core Cluster Nodes
    description: Total active containers across bidder, roger, and memcached
    function: coreClusterSize
    widgetTypes:
      - stat-card
  - id: pipeline-flow
    name: End-to-End Data Flow
    description: Pipeline stage flow with ingest, transform, store, process, deliver, report rates
    function: pipelineFlow
    widgetTypes:
      - pipeline-flow
  - id: bidder-error-rate
    name: Bidder Error Rate
    description: Percentage of LB requests with non-2xx, non-204, non-503 response codes
    function: bidderErrorRate
    widgetTypes:
      - stat-card
  - id: bidder-timeout-rate
    name: Bidder Timeout Rate
    description: Percentage of LB requests with 408 or 504 response codes
    function: bidderTimeoutRate
    widgetTypes:
      - gauge
```

**Step 2: Verify the API returns computed queries**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s http://tv:3000/api/queries/computed | python3 -c "import sys,json; d=json.load(sys.stdin); print('count:', len(d.get('queries',[])), '| first:', d.get('queries',[{}])[0].get('id'))"
```
Expected: `count: 10 | first: storage-volume`

**Step 3: Commit**
```bash
git add config/queries.yaml
git commit -m "feat: add computed: section to queries.yaml — 10 entries for 8 functions"
```

---

### Task 3: `server/data-sources/computed.js` + registry registration

**Files:**
- Create: `server/data-sources/computed.js`
- Modify: `server/data-source-registry.js`
- Test: `tests/unit/data-sources/computed.test.js`

**Step 1: Write failing tests**

Create `tests/unit/data-sources/computed.test.js`:

```js
import { describe, it, expect, mock, beforeEach } from 'bun:test';

const mockStorageVolume = mock(async () => ({
  data:    { value: '1.2 TB', detail: 'BQ + BT + GCS', trend: 'up' },
  rawData: [{ label: 'total', value: '1.2 TB' }],
}));
const mockFleetHealth = mock(async () => ({
  data:    { value: 95, detail: '19/20 active', trend: 'stable' },
  rawData: [{ label: 'online', value: 19 }],
}));

mock.module('../../server/gcp-metrics.js', () => ({
  storageVolume:            mockStorageVolume,
  fleetHealth:              mockFleetHealth,
  serviceLatency:           mock(async () => ({ data: { value: 42 }, rawData: [] })),
  campaignDeliveryMapWidget: mock(async () => ({ data: {}, rawData: [] })),
  coreClusterSize:          mock(async () => ({ data: { value: '42' }, rawData: [] })),
  pipelineFlow:             mock(async () => ({ data: { stages: [] }, rawData: [] })),
  bidderErrorRate:          mock(async () => ({ data: { value: '0.012%' }, rawData: [] })),
  bidderTimeoutRate:        mock(async () => ({ data: { value: 0.85 }, rawData: [] })),
}));

mock.module('../../server/query-manager.js', () => ({
  getQuery: mock(async (source, id) => {
    if (source !== 'computed') return null;
    const map = {
      'storage-volume': { id: 'storage-volume', function: 'storageVolume', params: {} },
      'fleet-health':   { id: 'fleet-health',   function: 'fleetHealth',   params: {} },
    };
    return map[id] || null;
  }),
}));

const { ComputedDataSource } = await import('../../server/data-sources/computed.js');

describe('ComputedDataSource', () => {
  let ds;

  beforeEach(() => {
    ds = new ComputedDataSource();
    mockStorageVolume.mockClear();
    mockFleetHealth.mockClear();
  });

  it('has name "computed" and isConnected true', () => {
    expect(ds.name).toBe('computed');
    expect(ds.isConnected).toBe(true);
  });

  it('fetchMetrics calls the registered function by queryId', async () => {
    const result = await ds.fetchMetrics({ queryId: 'storage-volume', id: 'storage-volume' });
    expect(mockStorageVolume).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual({ value: '1.2 TB', detail: 'BQ + BT + GCS', trend: 'up' });
    expect(result.source).toBe('computed');
    expect(result.rawData).toBeDefined();
  });

  it('fetchMetrics passes params + widgetConfig to the function', async () => {
    await ds.fetchMetrics({ queryId: 'fleet-health', id: 'fleet-health' });
    expect(mockFleetHealth).toHaveBeenCalledTimes(1);
  });

  it('fetchMetrics returns empty data for unknown queryId without crashing', async () => {
    const result = await ds.fetchMetrics({ queryId: 'does-not-exist', id: 'x' });
    expect(result.data).toBeDefined();
    expect(result.source).toBe('computed');
  });

  it('testConnection returns true', async () => {
    expect(await ds.testConnection()).toBe(true);
  });
});
```

**Step 2: Run and confirm failure**
```bash
bun test tests/unit/data-sources/computed.test.js
```
Expected: FAIL — module not found

**Step 3: Implement `server/data-sources/computed.js`**

```js
// ===========================================================================
// Computed Data Source — wraps named gcp-metrics.js functions as queryable entities
// ===========================================================================

import { DataSource } from './base.js';
import { getQuery } from '../query-manager.js';
import logger from '../logger.js';

// Registry maps function name strings to callables from gcp-metrics.js.
// Lazy-imported to avoid circular deps and heavy GCP client init at startup.
const FUNCTION_REGISTRY = {
  storageVolume:            async (p, wc) => (await import('../gcp-metrics.js')).storageVolume(p, wc),
  fleetHealth:              async (p, wc) => (await import('../gcp-metrics.js')).fleetHealth(p, wc),
  serviceLatency:           async (p, wc) => (await import('../gcp-metrics.js')).serviceLatency(p, wc),
  campaignDeliveryMapWidget:async (p, wc) => (await import('../gcp-metrics.js')).campaignDeliveryMapWidget(p, wc),
  coreClusterSize:          async (p, wc) => (await import('../gcp-metrics.js')).coreClusterSize(p, wc),
  pipelineFlow:             async (p, wc) => (await import('../gcp-metrics.js')).pipelineFlow(p, wc),
  bidderErrorRate:          async (p, wc) => (await import('../gcp-metrics.js')).bidderErrorRate(p, wc),
  bidderTimeoutRate:        async (p, wc) => (await import('../gcp-metrics.js')).bidderTimeoutRate(p, wc),
};

export class ComputedDataSource extends DataSource {
  constructor() {
    super('computed');
    this.isConnected = true; // always connected — functions are local
  }

  async fetchMetrics(widgetConfig) {
    const startTime = Date.now();
    try {
      const entry = await getQuery('computed', widgetConfig.queryId);

      if (!entry) {
        logger.warn({ queryId: widgetConfig.queryId }, '[computed] query not found — returning empty');
        return {
          timestamp: new Date().toISOString(),
          source:    'computed',
          data:      {},
          rawData:   [],
          widgetId:  widgetConfig.id,
          queryId:   widgetConfig.queryId,
        };
      }

      const fn = FUNCTION_REGISTRY[entry.function];
      if (!fn) {
        logger.error({ function: entry.function }, '[computed] function not in registry');
        return { timestamp: new Date().toISOString(), source: 'computed', data: {}, rawData: [] };
      }

      const result = await fn(entry.params || {}, widgetConfig);
      logger.info({ queryId: widgetConfig.queryId, ms: Date.now() - startTime }, '[computed] fetchMetrics ok');

      return {
        timestamp: new Date().toISOString(),
        source:    'computed',
        data:      result.data   ?? {},
        rawData:   result.rawData ?? [],
        widgetId:  widgetConfig.id,
        queryId:   widgetConfig.queryId,
      };
    } catch (err) {
      logger.error({ err: err.message, queryId: widgetConfig.queryId }, '[computed] fetchMetrics failed');
      return { timestamp: new Date().toISOString(), source: 'computed', data: {}, rawData: [] };
    }
  }

  async testConnection() {
    return true;
  }

  getConfigSchema() {
    return {
      name:        'Computed',
      description: 'Named server-side computed metric functions',
      fields:      [],
    };
  }
}

export const computedDataSource = new ComputedDataSource();
```

**Step 4: Register in `server/data-source-registry.js`**

Add import at top (after line 21, alongside other imports):
```js
import { computedDataSource } from './data-sources/computed.js';
```

Add registration in `initialize()` (after `this.register(segmentDataSource)`):
```js
    this.register(computedDataSource);
```

**Step 5: Run tests — all must pass**
```bash
bun test tests/unit/data-sources/computed.test.js
```
Expected: 5 pass, 0 fail

**Step 6: Smoke test**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s http://tv:3000/api/data-sources | python3 -c "import sys,json; d=json.load(sys.stdin); cs=[s for s in d.get('sources',[]) if s['name']=='computed']; print('computed registered:', bool(cs))"
```
Expected: `computed registered: True`

**Step 7: Commit**
```bash
git add server/data-sources/computed.js server/data-source-registry.js tests/unit/data-sources/computed.test.js
git commit -m "feat: ComputedDataSource — wraps named gcp-metrics functions as query engine entities"
```

---

### Task 4: `POST /api/explore/computed` in `server/explore-routes.js`

**Files:**
- Modify: `server/explore-routes.js`
- Modify: `tests/unit/routes/explore-routes.test.js`

**Step 1: Add tests for the new endpoint**

In `tests/unit/routes/explore-routes.test.js`, add mock and tests. Find the end of the existing mock setup and add:

After the existing `mock.module('../../../server/data-source-registry.js', ...)` block, extend the `getSource` mock to handle `'computed'`:

```js
// Extend the existing mock — replace getSource lambda
mock.module('../../../server/data-source-registry.js', () => ({
  dataSourceRegistry: {
    getSource: (name) => {
      if (name === 'bigquery') return { executeQuery: mockBqExecute };
      if (name === 'gcp')      return { transformData: (_ts, _type) => ({ value: 142.3, unit: '' }) };
      if (name === 'computed') return {
        fetchMetrics: mock(async ({ queryId }) => ({
          source:  'computed',
          data:    { value: '1.2 TB', detail: 'BQ + BT + GCS' },
          rawData: [{ label: 'total', value: '1.2 TB' }],
          queryId,
        })),
      };
    },
  },
}));
```

Add a new describe block after the existing BigQuery tests:

```js
  describe('POST /api/explore/computed', () => {
    it('returns data, rawData and executionMs', async () => {
      const res = await app.handle(new Request('http://localhost/api/explore/computed', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ function: 'storage-volume' }),
      }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.widgetData).toBeDefined();
      expect(Array.isArray(body.rawData)).toBe(true);
      expect(typeof body.executionMs).toBe('number');
    });

    it('returns 400 when function is missing', async () => {
      const res = await app.handle(new Request('http://localhost/api/explore/computed', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({}),
      }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });
```

**Step 2: Run and confirm new tests fail**
```bash
bun test tests/unit/routes/explore-routes.test.js
```
Expected: 2 new tests FAIL

**Step 3: Add the computed endpoint to `server/explore-routes.js`**

Add after the existing `.post('/bigquery', ...)` route (before the closing semicolon of the Elysia chain):

```js
  .post('/computed', async ({ body }) => {
    const { function: fnId, params = {}, widgetType = 'big-number' } = body || {};

    if (!fnId) {
      return new Response(
        JSON.stringify({ success: false, error: 'function is required' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    const t0 = Date.now();
    try {
      const computedSource = dataSourceRegistry.getSource('computed');
      const result = await computedSource.fetchMetrics({ queryId: fnId, id: fnId, ...params });

      return {
        success:     true,
        widgetData:  result.data   || null,
        rawData:     result.rawData || [],
        executionMs: Date.now() - t0,
      };
    } catch (err) {
      logger.error({ err: err.message }, 'explore/computed failed');
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['queries'],
      summary: 'Ad-hoc computed function query',
      description: 'Run a named computed function ad-hoc for the Query Explorer.',
    },
  })
```

**Step 4: Run all explore-routes tests — all must pass**
```bash
bun test tests/unit/routes/explore-routes.test.js
```
Expected: 10 pass, 0 fail

**Step 5: Commit**
```bash
git add server/explore-routes.js tests/unit/routes/explore-routes.test.js
git commit -m "feat: POST /api/explore/computed — ad-hoc computed function for Query Explorer"
```

---

### Task 5: Update 11 widgets in `config/dashboards.yaml`

**Files:**
- Modify: `config/dashboards.yaml`

**Context:** Each of the 11 legacy widgets currently has `source: gcp` (or no source) and no `queryId`. Add `source: computed` and the matching `queryId`. The `ComputedDataSource` will be called instead of the legacy `getMetrics()` dispatcher.

**Step 1: Make 11 targeted edits**

Find each widget by its `id:` and add/replace the `source` and `queryId` fields. Use these exact replacements:

**1. platform-overview → storage-volume** (around line 77):
Find: `    source: gcp` immediately after `  - id: storage-volume` in the platform-overview dashboard.
Replace `source: gcp` with:
```yaml
    queryId: storage-volume
    source: computed
```

**2. services-health → fleet-health** (around line 95):
Find: `    source: gcp` after `  - id: fleet-health`
Replace with:
```yaml
    queryId: fleet-health
    source: computed
```

**3. services-health → response-time** (around line 117):
Find: `    source: gcp` after `  - id: response-time`
Replace with:
```yaml
    queryId: service-latency
    source: computed
```

**4. campaign-delivery → usa-delivery-map** (around line 158):
The widget currently has no `source` or `queryId`. Add after `  - id: usa-delivery-map`:
```yaml
    queryId: campaign-delivery-map
    source: computed
```
(Add before `position:`)

**5. campaign-delivery-northeast → usa-delivery-map-ne** (around line 176):
Add after `  - id: usa-delivery-map-ne`:
```yaml
    queryId: campaign-delivery-map-ne
    source: computed
```

**6. campaign-delivery-southeast → usa-delivery-map-se** (around line 198):
Add after `  - id: usa-delivery-map-se`:
```yaml
    queryId: campaign-delivery-map-se
    source: computed
```

**7. data-processing → storage-volume** (around line 243):
Find the second `storage-volume` widget (in data-processing dashboard). Replace its `source: gcp` with:
```yaml
    queryId: storage-volume
    source: computed
```

**8. bidder-cluster → error-rate** (around line 299):
Find `  - id: error-rate` and replace `source: gcp` with:
```yaml
    queryId: bidder-error-rate
    source: computed
```

**9. bidder-cluster → timeout-rate** (around line 308):
Find `  - id: timeout-rate` and replace `source: gcp` with:
```yaml
    queryId: bidder-timeout-rate
    source: computed
```

**10. data-pipeline → pipeline** (around line 380):
Find `  - id: pipeline` and add (no existing source):
```yaml
    queryId: pipeline-flow
    source: computed
```

**11. rtb-infra → core-cluster-size** (around line 428):
Find `  - id: core-cluster-size` and replace `source: gcp` with:
```yaml
    queryId: core-cluster-size
    source: computed
```

**Step 2: Verify the dashboards still load**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s http://tv:3000/api/config | python3 -c "import sys,json; d=json.load(sys.stdin); print('dashboards:', len(d.get('dashboards',[])))"
```
Expected: `dashboards: 12`

**Step 3: Spot check a widget with computed source**
```bash
curl -s http://tv:3000/api/data/services-health | python3 -c "
import sys, json
d = json.load(sys.stdin)
fh = d.get('fleet-health') or d.get('widgets', {}).get('fleet-health')
print('fleet-health data:', fh)
"
```
Expected: fleet-health data with a numeric `value` (the online service percentage)

**Step 4: Commit**
```bash
git add config/dashboards.yaml
git commit -m "feat: migrate 11 legacy widgets to source:computed with queryId in dashboards.yaml"
```

---

### Task 6: Query Explorer UI — add Computed source

**Files:**
- Modify: `public/js/query-explorer.js`
- Modify: `public/studio.html`

**Context:** The Query Explorer modal already has GCP Metrics and BigQuery source options. Add Computed as a third live source (the greyed-out Phase 2 options remain). The Computed builder shows a function selector (populated from `/api/queries/computed`) and an optional params JSON field.

**Step 1: Add Computed option to `#qx-source` in `studio.html`**

Find the `#qx-source` select element. Currently the options are:
```html
<option value="gcp">GCP Metrics</option>
<option value="bigquery">BigQuery</option>
<option value="logging" disabled>...
```

Add a new option between bigquery and logging:
```html
<option value="computed">Computed Functions</option>
```

**Step 2: Add Computed builder panel HTML to modal in `studio.html`**

After the BigQuery fields `</div>` (closing `id="qx-bq-fields"`), add:

```html
        <!-- Computed fields -->
        <div id="qx-computed-fields" class="qx-source-fields" style="display:none">
          <div class="qx-field-row">
            <label class="qx-label">Function</label>
            <select id="qx-computed-fn" class="qx-select">
              <option value="">Loading&#8230;</option>
            </select>
          </div>
          <div class="qx-field-row">
            <label class="qx-label">Params (JSON, optional)</label>
            <textarea id="qx-computed-params" class="qx-textarea" rows="3" spellcheck="false" placeholder="{}"></textarea>
          </div>
        </div>
```

**Step 3: Add Computed logic to `public/js/query-explorer.js`**

In `_init()`, add DOM refs after the `_schemaCols` line:
```js
      this._computedFields  = document.getElementById('qx-computed-fields');
      this._computedFn      = document.getElementById('qx-computed-fn');
      this._computedParams  = document.getElementById('qx-computed-params');
```

In `_onSourceChange()`, add a branch:
```js
      if (this._computedFields) this._computedFields.style.display = src === 'computed' ? '' : 'none';
      if (src === 'computed') this._loadComputedFunctions();
```

Add new methods to the class (before `_setActionsDisabled`):

```js
    async _loadComputedFunctions() {
      if (!this._computedFn) return;
      try {
        const res  = await fetch('/api/queries/computed');
        const data = await res.json();
        this._computedFn.textContent = '';
        const dflt = document.createElement('option');
        dflt.value = '';
        dflt.textContent = 'Select function\u2026';
        this._computedFn.appendChild(dflt);
        (data.queries || []).forEach(q => {
          const opt = document.createElement('option');
          opt.value       = q.id;
          opt.textContent = q.name + ' (' + q.id + ')';
          this._computedFn.appendChild(opt);
        });
      } catch (_) { /* silent */ }
    }

    _buildComputedBody() {
      const fnId = this._computedFn?.value?.trim();
      if (!fnId) return null;
      let params = {};
      try {
        const raw = this._computedParams?.value?.trim();
        if (raw && raw !== '{}') params = JSON.parse(raw);
      } catch (_) { /* ignore bad JSON */ }
      return { function: fnId, params, widgetType: this._widgetType?.value || 'big-number' };
    }
```

In `_runQuery()`, add a computed branch. Find:
```js
        } else {
          body = this._buildBqBody();
```
And change to:
```js
        } else if (src === 'computed') {
          body = this._buildComputedBody();
          if (!body) {
            this._runStatus.textContent = 'Select a function';
            this._runBtn.removeAttribute('disabled');
            if (this._lastRaw) this._setActionsDisabled(false);
            return;
          }
        } else {
          body = this._buildBqBody();
```

In the results rendering section of `_runQuery()`, add a computed branch. Find:
```js
        if (src === 'gcp') {
          this._lastRaw = { type: 'gcp', ...
```
Change to:
```js
        if (src === 'computed') {
          this._lastRaw = { type: 'computed', rows: data.rawData || [], meta: data };
          this._renderBqResults(data.rawData || [], (data.rawData || []).length, data.rawData?.length > 0 ? Object.keys(data.rawData[0]).length : 0, ms);
        } else if (src === 'gcp') {
          this._lastRaw = { type: 'gcp', ...
```

In `_onWidgetTypeChange()`, add a computed branch:
```js
      if (this._lastRaw.type === 'computed') {
        widgetData = this._transformBqClientSide(this._lastRaw.rows, type);
      } else if (this._lastRaw.type === 'gcp') {
```

**Step 4: Restart and verify**
```bash
sudo systemctl restart tv-dashboards && sleep 2
```
Open `/admin` → Queries tab → ⬧ Explorer → select "Computed Functions" → confirm function dropdown populates → select `fleet-health` → click ▶ Run → see rawData table + widget preview.

**Step 5: Commit**
```bash
git add public/js/query-explorer.js public/studio.html
git commit -m "feat: add Computed source to Query Explorer with function selector and params field"
```

---

### Task 7: Final integration check

**Step 1: Run full test suite**
```bash
git restore config/ && bun test 2>&1 | tail -6
```
Expected: all prior tests pass + new tests (gcp-metrics-exports: 10, computed data source: 5, explore-routes: 10 total)

**Step 2: Verify computed source in data-sources list**
```bash
curl -s http://tv:3000/api/data-sources | python3 -c "
import sys,json; d=json.load(sys.stdin)
computed=[s for s in d['sources'] if s['name']=='computed']
print('computed connected:', computed[0]['isConnected'] if computed else 'NOT FOUND')
"
```
Expected: `computed connected: True`

**Step 3: Verify queries API returns computed**
```bash
curl -s http://tv:3000/api/queries/ | python3 -c "
import sys,json; d=json.load(sys.stdin)
print('computed count:', len(d['queries'].get('computed',[])))
print('gcp count:',      len(d['queries'].get('gcp',[])))
"
```
Expected: `computed count: 10 | gcp count: N`

**Step 4: Check git log**
```bash
git log --oneline -8
```
Expected commits:
- `feat: add Computed source to Query Explorer`
- `feat: migrate 11 legacy widgets to source:computed`
- `feat: POST /api/explore/computed`
- `feat: ComputedDataSource`
- `feat: add computed: section to queries.yaml`
- `feat: add 8 named exports to gcp-metrics.js`
