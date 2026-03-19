# Multi-Client TV Dashboards Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the iHeart-specific BigQuery function with a single generic client-scoped delivery map function, then add delivery map + campaign health TV screens for FOX, Hearst, Nexstar, EW Scripps, and Cox.

**Architecture:** `getDeliveryGeoByClient(clientName, ...)` replaces `getDeliveryGeoIHeart()` — one function, per-client Map cache, clientName interpolated from YAML params (not user input). `campaignDeliveryMapClientWidget(params)` replaces `campaignDeliveryMapIHeartWidget` and reads `params.clientName`. Each client gets: one computed query entry (map) + one GCP win-rate query + two dashboards (map + 4×2 metrics) + one SVG logo + one `clientBranding` block.

**Tech Stack:** Bun, Elysia.js, BigQuery (`billable_agg → meta_inst`), GCP Cloud Monitoring (`mhive/roger/campaign_win_rate` filtered by `parent_org_id`), Mapbox GL JS, YAML config

---

## Client Reference

| Client | `meta_inst.client.name` | GCP `parent_org_id` | 7-day imps |
|---|---|---|---|
| iHeart (refactor) | `iHeart` | `popErPc0MjpPi1i94r9M0gBNFrT8` | ~104K |
| FOX | `FOX` | `KnfaABPhsYmEii2PRGC5HDNrHURa` | 128M |
| Hearst | `Hearst` | `yfSFThMib3rB0bnnSdrrM7tvMSqF` | 74M |
| Nexstar Media Group | `Nexstar Media Group` | `N6WSKUog3hq2PMHh4sTsmiADteE5` | 27M |
| EW Scripps | `EW Scripps` | `oQRQL2OLWEc66UrAOPEFdE2FovnU` | 19M |
| Cox | `Cox` | `Zmw3FbjDKGVcZ5G9FtXhY1KhUHOw` | 4.5M |

## Brand Palette Reference

| Client | bg | bgCard | border | accent | dotColor | logoText | logoSub |
|---|---|---|---|---|---|---|---|
| FOX | `#0a0f1a` | `#14202f` | `#1a3a5c` | `#F5A524` | `#1a2f44` | `FOX` | `MEDIA` |
| Hearst | `#010a1a` | `#081830` | `#0a2a5c` | `#C8A84B` | `#091830` | `HEARST` | `MEDIA` |
| Nexstar | `#050a14` | `#0c1a30` | `#0a2a60` | `#1E88E5` | `#0a1a30` | `NEXSTAR` | `MEDIA GROUP` |
| Scripps | `#020810` | `#071528` | `#0a2040` | `#E8541A` | `#0a1a28` | `SCRIPPS` | `MEDIA` |
| Cox | `#030810` | `#081520` | `#0a2040` | `#0091D5` | `#081830` | `COX` | `MEDIA GROUP` |

---

## Chunk 1: Backend refactor + generic function

### Task 1: Refactor `server/gcp-metrics.js`

**Files:**
- Modify: `server/gcp-metrics.js`

Remove the iHeart-specific cache + function + export (lines ~347-403 and ~1444-1510). Add the generic versions in their place.

- [ ] **Step 1: Replace the iHeart-specific cache/function block**

Find and remove this entire block (lines ~347-403):
```
let _bqIHeartGeoCache = null;
const BQ_IHEART_GEO_CACHE_TTL = ...
async function getDeliveryGeoIHeart(...) { ... }
```

Replace it with:

```js
// ── Per-client BigQuery delivery geo cache ──────────────────────────────────
const _bqClientGeoCache  = new Map(); // key: 'ClientName:days:minImp' → { time, data }
const BQ_CLIENT_GEO_CACHE_TTL = 5 * 60 * 1000;

async function getDeliveryGeoByClient(clientName, days = 7, minImpressions = 50) {
  const cacheKey = `${clientName}:${days}:${minImpressions}`;
  const cached   = _bqClientGeoCache.get(cacheKey);
  if (cached && Date.now() - cached.time < BQ_CLIENT_GEO_CACHE_TTL) return cached.data;

  try {
    const sql = `
      SELECT
        SUBSTR(b.postal, 1, 3) AS zip3,
        mg.region.code AS state,
        ROUND(SUM(b.IM * z.internal_point_lat) / SUM(b.IM), 3) AS lat,
        ROUND(SUM(b.IM * z.internal_point_lon) / SUM(b.IM), 3) AS lon,
        SUM(b.IM) AS impressions,
        SUM(b.CL) AS clicks,
        COUNT(DISTINCT b.postal) AS zip_count,
        ANY_VALUE(mg.city.name) AS city,
        ANY_VALUE(mg.dma.name) AS dma
      FROM \`mad-data.reporting.billable_agg\` b
      JOIN \`mad-data.reporting.meta_inst\` mi ON b.inst_id_b64 = mi.inst_id_b64
      LEFT JOIN \`mad-data.reporting.meta_geo\` mg
        ON b.postal = mg.postal_code AND mg.country_code = 'US'
      LEFT JOIN \`mad-data.public_data.zip_codes\` z
        ON b.postal = z.zip_code
      WHERE b.date_nyc >= DATE_SUB(CURRENT_DATE(), INTERVAL \${days} DAY)
        AND b.country = 'US'
        AND b.postal IS NOT NULL AND b.postal != ''
        AND z.internal_point_lat IS NOT NULL
        AND mi.client.name = '\${clientName}'
      GROUP BY 1, 2
      HAVING impressions > \${minImpressions}
      ORDER BY impressions DESC
      LIMIT 500
    `;

    const [rows] = await bq.query({ query: sql, location: 'US' });

    const results = rows.map(r => ({
      zip3:        r.zip3,
      state:       r.state,
      lat:         r.lat,
      lon:         r.lon,
      impressions: Number(r.impressions),
      clicks:      Number(r.clicks),
      zips:        Number(r.zip_count),
      city:        r.city || null,
      dma:         r.dma || null,
    }));
    _bqClientGeoCache.set(cacheKey, { time: Date.now(), data: results });
    logger.info(`[bq] ${clientName} delivery geo: ${results.length} zip3 prefixes loaded`);
    return results;
  } catch (err) {
    logger.error(`[bq] ${clientName} delivery geo query failed: ${err.message}`);
    const stale = _bqClientGeoCache.get(cacheKey);
    return stale ? stale.data : [];
  }
}
```

- [ ] **Step 2: Replace `campaignDeliveryMapIHeartWidget` export with `campaignDeliveryMapClientWidget`**

Find and remove the entire `export async function campaignDeliveryMapIHeartWidget` block (lines ~1444-1510).

Add this in its place (insert immediately after the closing `}` of `campaignDeliveryMapWidget`):

```js
export async function campaignDeliveryMapClientWidget(params = {}, widgetConfig = {}) {
  const clientName = params.clientName || widgetConfig.mapConfig?.clientName;
  if (!clientName) {
    logger.error('[computed] campaignDeliveryMapClientWidget: params.clientName is required');
    return {
      data:    { states: {}, hotspots: [], totals: { impressions: 0, bids: 0, services: 1 }, regions: {} },
      rawData: [],
    };
  }

  const timeWindow = Math.max(1, Math.min(90, parseInt(params.timeWindow || widgetConfig.mapConfig?.timeWindow) || 7));
  const minImp     = parseInt(params.minImpressions ?? widgetConfig.mapConfig?.minImpressions) >= 0
    ? parseInt(params.minImpressions ?? widgetConfig.mapConfig?.minImpressions)
    : 50;
  const region     = params.region || widgetConfig.mapConfig?.region || 'full';

  const REGION_STATE_SETS = {
    northeast: new Set(['ME','VT','NH','MA','RI','CT','NY','NJ','PA','DE','MD','DC','VA','WV']),
    southeast: new Set(['NC','SC','GA','FL','AL','MS','TN','KY']),
    northwest: new Set(['WA','OR','ID','MT','WY','ND','SD','MN','WI','MI']),
    southwest: new Set(['CA','NV','AZ','NM','UT','CO','TX','OK','KS','NE']),
  };
  const regionStates = REGION_STATE_SETS[region] || null;

  const geoData = await getDeliveryGeoByClient(clientName, timeWindow, minImp);

  const stateActivity = {};
  const hotspots      = [];

  (geoData || []).forEach(z => {
    const st = z.state;
    if (st) {
      if (!stateActivity[st]) stateActivity[st] = { impressions: 0, bids: 0, campaigns: 0 };
      stateActivity[st].impressions += z.impressions;
      stateActivity[st].bids        += z.clicks * 50;
      stateActivity[st].campaigns   += z.zips;
    }
    if (z.lat && z.lon) {
      if (!regionStates || regionStates.has(z.state)) {
        const snapped = snapToLand(z.lat, z.lon, z.state);
        hotspots.push({
          zip3: z.zip3, lat: snapped.lat, lon: snapped.lon,
          impressions: z.impressions, clicks: z.clicks,
          state: z.state, city: z.city || null,
        });
      }
    }
  });

  hotspots.sort((a, b) => b.impressions - a.impressions);

  // hotspots_z5 and regions omitted — client dashboards use dots mode only
  const totals = {
    impressions: hotspots.reduce((s, h) => s + h.impressions, 0),
    bids:        hotspots.reduce((s, h) => s + (h.clicks * 50), 0), // clicks-based proxy
    services:    1,
  };

  const data = { states: stateActivity, hotspots, totals, regions: {} };

  const topHotspots = hotspots.slice(0, 20).map(h => ({
    label: (h.zip3 || '?') + ' (' + (h.state || '?') + ')',
    value: h.impressions || 0,
  }));

  return { data, rawData: topHotspots };
}
```

- [ ] **Step 3: Verify no syntax errors**

```bash
bun --eval "import('./server/gcp-metrics.js').then(() => console.log('OK')).catch(e => console.error(e.message))" 2>&1 | tail -3
```

Expected: `OK`

---

### Task 2: Update `server/data-sources/computed.js`

**Files:**
- Modify: `server/data-sources/computed.js`

- [ ] **Step 1: Swap the registry entry**

Replace:
```js
campaignDeliveryMapIHeartWidget: async (p, wc) => (await import('../gcp-metrics.js')).campaignDeliveryMapIHeartWidget(p, wc),
```

With:
```js
campaignDeliveryMapClientWidget:  async (p, wc) => (await import('../gcp-metrics.js')).campaignDeliveryMapClientWidget(p, wc),
```

- [ ] **Step 2: Commit**

```bash
git add server/gcp-metrics.js server/data-sources/computed.js
git commit -m "refactor: replace iHeart-specific map function with generic campaignDeliveryMapClientWidget"
```

---

## Chunk 2: Config — queries

### Task 3: Update `config/queries.yaml`

**Files:**
- Modify: `config/queries.yaml`

- [ ] **Step 1: Refactor the iHeart computed query**

Find the `campaign-delivery-map-iheart` entry (around line 64). Change `function` and add `clientName` to params:

```yaml
  - id: campaign-delivery-map-iheart
    name: Campaign Delivery Map (iHeart)
    description: iHeart-only delivery heatmap via meta_inst join
    function: campaignDeliveryMapClientWidget
    params:
      clientName: iHeart
      widgetId: usa-delivery-map-iheart
    widgetTypes:
      - usa-map-gl
```

- [ ] **Step 2: Add 5 new computed map queries**

After the iHeart computed query entry, add:

```yaml
  - id: campaign-delivery-map-fox
    name: Campaign Delivery Map (FOX)
    description: FOX-only delivery heatmap via meta_inst join
    function: campaignDeliveryMapClientWidget
    params:
      clientName: FOX
      widgetId: usa-delivery-map-fox
    widgetTypes:
      - usa-map-gl
  - id: campaign-delivery-map-hearst
    name: Campaign Delivery Map (Hearst)
    description: Hearst-only delivery heatmap via meta_inst join
    function: campaignDeliveryMapClientWidget
    params:
      clientName: Hearst
      widgetId: usa-delivery-map-hearst
    widgetTypes:
      - usa-map-gl
  - id: campaign-delivery-map-nexstar
    name: Campaign Delivery Map (Nexstar)
    description: Nexstar-only delivery heatmap via meta_inst join
    function: campaignDeliveryMapClientWidget
    params:
      clientName: Nexstar Media Group
      widgetId: usa-delivery-map-nexstar
    widgetTypes:
      - usa-map-gl
  - id: campaign-delivery-map-scripps
    name: Campaign Delivery Map (EW Scripps)
    description: EW Scripps-only delivery heatmap via meta_inst join
    function: campaignDeliveryMapClientWidget
    params:
      clientName: EW Scripps
      widgetId: usa-delivery-map-scripps
    widgetTypes:
      - usa-map-gl
  - id: campaign-delivery-map-cox
    name: Campaign Delivery Map (Cox)
    description: Cox-only delivery heatmap via meta_inst join
    function: campaignDeliveryMapClientWidget
    params:
      clientName: Cox
      widgetId: usa-delivery-map-cox
    widgetTypes:
      - usa-map-gl
```

- [ ] **Step 3: Add 5 win-rate GCP queries at the end of the `gcp:` section**

```yaml
  - id: fox-win-rate
    name: FOX Win Rate (p50)
    metricType: workload.googleapis.com/mhive/roger/campaign_win_rate
    project: mad-master
    timeWindow: 60
    aggregation:
      perSeriesAligner: ALIGN_DELTA
      crossSeriesReducer: REDUCE_PERCENTILE_50
      alignmentPeriod:
        seconds: 60
    filters: 'metric.parent_org_id="KnfaABPhsYmEii2PRGC5HDNrHURa"'
    widgetTypes:
      - big-number
      - line-chart
  - id: hearst-win-rate
    name: Hearst Win Rate (p50)
    metricType: workload.googleapis.com/mhive/roger/campaign_win_rate
    project: mad-master
    timeWindow: 60
    aggregation:
      perSeriesAligner: ALIGN_DELTA
      crossSeriesReducer: REDUCE_PERCENTILE_50
      alignmentPeriod:
        seconds: 60
    filters: 'metric.parent_org_id="yfSFThMib3rB0bnnSdrrM7tvMSqF"'
    widgetTypes:
      - big-number
      - line-chart
  - id: nexstar-win-rate
    name: Nexstar Win Rate (p50)
    metricType: workload.googleapis.com/mhive/roger/campaign_win_rate
    project: mad-master
    timeWindow: 60
    aggregation:
      perSeriesAligner: ALIGN_DELTA
      crossSeriesReducer: REDUCE_PERCENTILE_50
      alignmentPeriod:
        seconds: 60
    filters: 'metric.parent_org_id="N6WSKUog3hq2PMHh4sTsmiADteE5"'
    widgetTypes:
      - big-number
      - line-chart
  - id: scripps-win-rate
    name: EW Scripps Win Rate (p50)
    metricType: workload.googleapis.com/mhive/roger/campaign_win_rate
    project: mad-master
    timeWindow: 60
    aggregation:
      perSeriesAligner: ALIGN_DELTA
      crossSeriesReducer: REDUCE_PERCENTILE_50
      alignmentPeriod:
        seconds: 60
    filters: 'metric.parent_org_id="oQRQL2OLWEc66UrAOPEFdE2FovnU"'
    widgetTypes:
      - big-number
      - line-chart
  - id: cox-win-rate
    name: Cox Win Rate (p50)
    metricType: workload.googleapis.com/mhive/roger/campaign_win_rate
    project: mad-master
    timeWindow: 60
    aggregation:
      perSeriesAligner: ALIGN_DELTA
      crossSeriesReducer: REDUCE_PERCENTILE_50
      alignmentPeriod:
        seconds: 60
    filters: 'metric.parent_org_id="Zmw3FbjDKGVcZ5G9FtXhY1KhUHOw"'
    widgetTypes:
      - big-number
      - line-chart
```

- [ ] **Step 4: Restart and verify queries load**

```bash
sudo systemctl restart tv-dashboards && sleep 3
curl -s http://tv:3000/api/queries/ | python3 -c "
import json, sys
d = json.load(sys.stdin)
comp = [q['id'] for q in d['queries'].get('computed',[]) if 'delivery-map' in q['id']]
gcp  = [q['id'] for q in d['queries'].get('gcp',[]) if 'win-rate' in q['id']]
print('Computed map queries:', comp)
print('Win-rate queries:', gcp)
"
```

Expected:
```
Computed map queries: ['campaign-delivery-map-iheart', 'campaign-delivery-map-fox', 'campaign-delivery-map-hearst', 'campaign-delivery-map-nexstar', 'campaign-delivery-map-scripps', 'campaign-delivery-map-cox']
Win-rate queries: ['iheart-win-rate', 'fox-win-rate', 'hearst-win-rate', 'nexstar-win-rate', 'scripps-win-rate', 'cox-win-rate']
```

- [ ] **Step 5: Commit**

```bash
git add config/queries.yaml
git commit -m "feat: add generic client map queries and win-rate queries for FOX, Hearst, Nexstar, Scripps, Cox"
```

---

## Chunk 3: Logo assets

### Task 4: Create SVG wordmark logos for 5 new clients

**Files:**
- Create: `public/img/fox-logo.svg`
- Create: `public/img/hearst-logo.svg`
- Create: `public/img/nexstar-logo.svg`
- Create: `public/img/scripps-logo.svg`
- Create: `public/img/cox-logo.svg`

- [ ] **Step 1: Create all 5 SVG files**

```bash
cat > /home/tech/dev-dashboards/public/img/fox-logo.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 52">
  <text x="4" y="42" font-family="Arial Black,Arial" font-weight="900"
        font-size="40" fill="#F5A524" letter-spacing="-1">FOX</text>
  <text x="94" y="42" font-family="Arial Black,Arial" font-weight="900"
        font-size="40" fill="#ffffff" letter-spacing="-1">Media</text>
</svg>
EOF

cat > /home/tech/dev-dashboards/public/img/hearst-logo.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 52">
  <text x="4" y="42" font-family="Arial Black,Arial" font-weight="900"
        font-size="40" fill="#C8A84B" letter-spacing="-1">HEARST</text>
  <text x="175" y="42" font-family="Arial Black,Arial" font-weight="900"
        font-size="40" fill="#ffffff" letter-spacing="-1">Media</text>
</svg>
EOF

cat > /home/tech/dev-dashboards/public/img/nexstar-logo.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 52">
  <text x="4" y="42" font-family="Arial Black,Arial" font-weight="900"
        font-size="40" fill="#1E88E5" letter-spacing="-1">NEXSTAR</text>
  <text x="215" y="42" font-family="Arial Black,Arial" font-weight="900"
        font-size="40" fill="#ffffff" letter-spacing="-1">Media</text>
</svg>
EOF

cat > /home/tech/dev-dashboards/public/img/scripps-logo.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 52">
  <text x="4" y="42" font-family="Arial Black,Arial" font-weight="900"
        font-size="40" fill="#E8541A" letter-spacing="-1">SCRIPPS</text>
  <text x="195" y="42" font-family="Arial Black,Arial" font-weight="900"
        font-size="40" fill="#ffffff" letter-spacing="-1">Media</text>
</svg>
EOF

cat > /home/tech/dev-dashboards/public/img/cox-logo.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 52">
  <text x="4" y="42" font-family="Arial Black,Arial" font-weight="900"
        font-size="40" fill="#0091D5" letter-spacing="-1">COX</text>
  <text x="100" y="42" font-family="Arial Black,Arial" font-weight="900"
        font-size="40" fill="#ffffff" letter-spacing="-1">Media</text>
</svg>
EOF
```

- [ ] **Step 2: Verify all 5 exist**

```bash
ls -la /home/tech/dev-dashboards/public/img/*-logo.svg
```

Expected: 6 files (iheart + 5 new).

- [ ] **Step 3: Commit**

```bash
git add public/img/fox-logo.svg public/img/hearst-logo.svg public/img/nexstar-logo.svg public/img/scripps-logo.svg public/img/cox-logo.svg
git commit -m "feat: add SVG wordmark logos for FOX, Hearst, Nexstar, Scripps, Cox"
```

---

## Chunk 4: Config — dashboards

### Task 5: Update `config/dashboards.yaml`

**Files:**
- Modify: `config/dashboards.yaml`

Two changes: update the iHeart delivery map widget to use the new generic queryId params, and append 10 new dashboards (2 per client × 5 clients).

- [ ] **Step 1: Update iHeart delivery map widget mglConfig**

The iHeart delivery map widget already uses `queryId: campaign-delivery-map-iheart`. The computed query now points to `campaignDeliveryMapClientWidget` with `params.clientName: iHeart`. No widget-level change needed — the query handles it.

**No change required** — the query YAML was already updated in Task 3.

- [ ] **Step 2: Append 10 new dashboards after the `iheart-metrics` dashboard**

Find the end of the `iheart-metrics` dashboard (last widget ends around line 715 in the original, now shifted due to the `clientBranding` blocks). Append after it and before `global:`:

```yaml
  # ── FOX ─────────────────────────────────────────────────────────────────────
  - id: fox-delivery-map
    name: FOX
    subtitle: Delivery
    icon: map
    grid:
      columns: 1
      rows: 1
      gap: 0
    clientBranding:
      logoText: FOX
      logoSub: MEDIA
      bg: '#0a0f1a'
      bgSurface: '#0f1826'
      bgCard: '#14202f'
      bgCardAlt: '#1a2a3f'
      border: '#1a3a5c'
      borderLit: '#2a5a8c'
      accent: '#F5A524'
      accentDim: 'rgba(245,165,36,0.15)'
      t2: '#c8d8e8'
      t3: '#7090a8'
      dotColor: '#1a2f44'
    widgets:
      - id: usa-delivery-map-fox
        type: usa-map-gl
        title: ''
        source: computed
        queryId: campaign-delivery-map-fox
        position:
          col: 1
          row: 1
          colSpan: 1
          rowSpan: 1
        mglConfig:
          colorScheme: warm
          showLeaderboard: true
          zoomViz: dots
          clientLogo: /img/fox-logo.svg
  - id: fox-metrics
    name: FOX
    subtitle: Campaign Health
    icon: chart-bar
    grid:
      columns: 4
      rows: 2
      gap: 14
    clientBranding:
      logoText: FOX
      logoSub: MEDIA
      bg: '#0a0f1a'
      bgSurface: '#0f1826'
      bgCard: '#14202f'
      bgCardAlt: '#1a2a3f'
      border: '#1a3a5c'
      borderLit: '#2a5a8c'
      accent: '#F5A524'
      accentDim: 'rgba(245,165,36,0.15)'
      t2: '#c8d8e8'
      t3: '#7090a8'
      dotColor: '#1a2f44'
    widgets:
      - id: fox-feeds-delivered
        type: stat-card
        title: Data Feed Deliveries
        source: gcp
        queryId: iheart-datafeeds-delivered
        position:
          col: 1
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: fox-export-failures
        type: stat-card
        title: Export Failures
        source: gcp
        queryId: iheart-export-failures
        position:
          col: 2
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: fox-win-rate-stat
        type: big-number
        title: Win Rate (p50)
        source: gcp
        queryId: fox-win-rate
        position:
          col: 3
          row: 1
          colSpan: 1
          rowSpan: 1
        unit: '%'
      - id: fox-pacing-stat
        type: big-number
        title: Pacing Ratio (p50)
        source: gcp
        queryId: roger-pacing-ratio
        position:
          col: 4
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: fox-win-rate-chart
        type: line-chart
        title: FOX Win Rate (p50)
        source: gcp
        queryId: fox-win-rate
        position:
          col: 1
          row: 2
          colSpan: 2
          rowSpan: 1
      - id: fox-pacing-chart
        type: line-chart
        title: Pacing Ratio (p50)
        source: gcp
        queryId: roger-pacing-ratio
        position:
          col: 3
          row: 2
          colSpan: 2
          rowSpan: 1
  # ── HEARST ───────────────────────────────────────────────────────────────────
  - id: hearst-delivery-map
    name: Hearst
    subtitle: Delivery
    icon: map
    grid:
      columns: 1
      rows: 1
      gap: 0
    clientBranding:
      logoText: HEARST
      logoSub: MEDIA
      bg: '#010a1a'
      bgSurface: '#051224'
      bgCard: '#081830'
      bgCardAlt: '#0c2040'
      border: '#0a2a5c'
      borderLit: '#1040a0'
      accent: '#C8A84B'
      accentDim: 'rgba(200,168,75,0.15)'
      t2: '#c0ccdc'
      t3: '#6080a0'
      dotColor: '#091830'
    widgets:
      - id: usa-delivery-map-hearst
        type: usa-map-gl
        title: ''
        source: computed
        queryId: campaign-delivery-map-hearst
        position:
          col: 1
          row: 1
          colSpan: 1
          rowSpan: 1
        mglConfig:
          colorScheme: warm
          showLeaderboard: true
          zoomViz: dots
          clientLogo: /img/hearst-logo.svg
  - id: hearst-metrics
    name: Hearst
    subtitle: Campaign Health
    icon: chart-bar
    grid:
      columns: 4
      rows: 2
      gap: 14
    clientBranding:
      logoText: HEARST
      logoSub: MEDIA
      bg: '#010a1a'
      bgSurface: '#051224'
      bgCard: '#081830'
      bgCardAlt: '#0c2040'
      border: '#0a2a5c'
      borderLit: '#1040a0'
      accent: '#C8A84B'
      accentDim: 'rgba(200,168,75,0.15)'
      t2: '#c0ccdc'
      t3: '#6080a0'
      dotColor: '#091830'
    widgets:
      - id: hearst-feeds-delivered
        type: stat-card
        title: Data Feed Deliveries
        source: gcp
        queryId: iheart-datafeeds-delivered
        position:
          col: 1
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: hearst-export-failures
        type: stat-card
        title: Export Failures
        source: gcp
        queryId: iheart-export-failures
        position:
          col: 2
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: hearst-win-rate-stat
        type: big-number
        title: Win Rate (p50)
        source: gcp
        queryId: hearst-win-rate
        position:
          col: 3
          row: 1
          colSpan: 1
          rowSpan: 1
        unit: '%'
      - id: hearst-pacing-stat
        type: big-number
        title: Pacing Ratio (p50)
        source: gcp
        queryId: roger-pacing-ratio
        position:
          col: 4
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: hearst-win-rate-chart
        type: line-chart
        title: Hearst Win Rate (p50)
        source: gcp
        queryId: hearst-win-rate
        position:
          col: 1
          row: 2
          colSpan: 2
          rowSpan: 1
      - id: hearst-pacing-chart
        type: line-chart
        title: Pacing Ratio (p50)
        source: gcp
        queryId: roger-pacing-ratio
        position:
          col: 3
          row: 2
          colSpan: 2
          rowSpan: 1
  # ── NEXSTAR ──────────────────────────────────────────────────────────────────
  - id: nexstar-delivery-map
    name: Nexstar
    subtitle: Delivery
    icon: map
    grid:
      columns: 1
      rows: 1
      gap: 0
    clientBranding:
      logoText: NEXSTAR
      logoSub: MEDIA GROUP
      bg: '#050a14'
      bgSurface: '#081222'
      bgCard: '#0c1a30'
      bgCardAlt: '#102040'
      border: '#0a2a60'
      borderLit: '#1050b0'
      accent: '#1E88E5'
      accentDim: 'rgba(30,136,229,0.15)'
      t2: '#b8cce0'
      t3: '#6080a0'
      dotColor: '#0a1a30'
    widgets:
      - id: usa-delivery-map-nexstar
        type: usa-map-gl
        title: ''
        source: computed
        queryId: campaign-delivery-map-nexstar
        position:
          col: 1
          row: 1
          colSpan: 1
          rowSpan: 1
        mglConfig:
          colorScheme: cool
          showLeaderboard: true
          zoomViz: dots
          clientLogo: /img/nexstar-logo.svg
  - id: nexstar-metrics
    name: Nexstar
    subtitle: Campaign Health
    icon: chart-bar
    grid:
      columns: 4
      rows: 2
      gap: 14
    clientBranding:
      logoText: NEXSTAR
      logoSub: MEDIA GROUP
      bg: '#050a14'
      bgSurface: '#081222'
      bgCard: '#0c1a30'
      bgCardAlt: '#102040'
      border: '#0a2a60'
      borderLit: '#1050b0'
      accent: '#1E88E5'
      accentDim: 'rgba(30,136,229,0.15)'
      t2: '#b8cce0'
      t3: '#6080a0'
      dotColor: '#0a1a30'
    widgets:
      - id: nexstar-feeds-delivered
        type: stat-card
        title: Data Feed Deliveries
        source: gcp
        queryId: iheart-datafeeds-delivered
        position:
          col: 1
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: nexstar-export-failures
        type: stat-card
        title: Export Failures
        source: gcp
        queryId: iheart-export-failures
        position:
          col: 2
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: nexstar-win-rate-stat
        type: big-number
        title: Win Rate (p50)
        source: gcp
        queryId: nexstar-win-rate
        position:
          col: 3
          row: 1
          colSpan: 1
          rowSpan: 1
        unit: '%'
      - id: nexstar-pacing-stat
        type: big-number
        title: Pacing Ratio (p50)
        source: gcp
        queryId: roger-pacing-ratio
        position:
          col: 4
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: nexstar-win-rate-chart
        type: line-chart
        title: Nexstar Win Rate (p50)
        source: gcp
        queryId: nexstar-win-rate
        position:
          col: 1
          row: 2
          colSpan: 2
          rowSpan: 1
      - id: nexstar-pacing-chart
        type: line-chart
        title: Pacing Ratio (p50)
        source: gcp
        queryId: roger-pacing-ratio
        position:
          col: 3
          row: 2
          colSpan: 2
          rowSpan: 1
  # ── EW SCRIPPS ───────────────────────────────────────────────────────────────
  - id: scripps-delivery-map
    name: EW Scripps
    subtitle: Delivery
    icon: map
    grid:
      columns: 1
      rows: 1
      gap: 0
    clientBranding:
      logoText: SCRIPPS
      logoSub: MEDIA
      bg: '#020810'
      bgSurface: '#040f1c'
      bgCard: '#071528'
      bgCardAlt: '#0a1c34'
      border: '#0a2040'
      borderLit: '#0f3060'
      accent: '#E8541A'
      accentDim: 'rgba(232,84,26,0.15)'
      t2: '#c8c0b8'
      t3: '#908070'
      dotColor: '#0a1a28'
    widgets:
      - id: usa-delivery-map-scripps
        type: usa-map-gl
        title: ''
        source: computed
        queryId: campaign-delivery-map-scripps
        position:
          col: 1
          row: 1
          colSpan: 1
          rowSpan: 1
        mglConfig:
          colorScheme: warm
          showLeaderboard: true
          zoomViz: dots
          clientLogo: /img/scripps-logo.svg
  - id: scripps-metrics
    name: EW Scripps
    subtitle: Campaign Health
    icon: chart-bar
    grid:
      columns: 4
      rows: 2
      gap: 14
    clientBranding:
      logoText: SCRIPPS
      logoSub: MEDIA
      bg: '#020810'
      bgSurface: '#040f1c'
      bgCard: '#071528'
      bgCardAlt: '#0a1c34'
      border: '#0a2040'
      borderLit: '#0f3060'
      accent: '#E8541A'
      accentDim: 'rgba(232,84,26,0.15)'
      t2: '#c8c0b8'
      t3: '#908070'
      dotColor: '#0a1a28'
    widgets:
      - id: scripps-feeds-delivered
        type: stat-card
        title: Data Feed Deliveries
        source: gcp
        queryId: iheart-datafeeds-delivered
        position:
          col: 1
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: scripps-export-failures
        type: stat-card
        title: Export Failures
        source: gcp
        queryId: iheart-export-failures
        position:
          col: 2
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: scripps-win-rate-stat
        type: big-number
        title: Win Rate (p50)
        source: gcp
        queryId: scripps-win-rate
        position:
          col: 3
          row: 1
          colSpan: 1
          rowSpan: 1
        unit: '%'
      - id: scripps-pacing-stat
        type: big-number
        title: Pacing Ratio (p50)
        source: gcp
        queryId: roger-pacing-ratio
        position:
          col: 4
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: scripps-win-rate-chart
        type: line-chart
        title: EW Scripps Win Rate (p50)
        source: gcp
        queryId: scripps-win-rate
        position:
          col: 1
          row: 2
          colSpan: 2
          rowSpan: 1
      - id: scripps-pacing-chart
        type: line-chart
        title: Pacing Ratio (p50)
        source: gcp
        queryId: roger-pacing-ratio
        position:
          col: 3
          row: 2
          colSpan: 2
          rowSpan: 1
  # ── COX ──────────────────────────────────────────────────────────────────────
  - id: cox-delivery-map
    name: Cox Media Group
    subtitle: Delivery
    icon: map
    grid:
      columns: 1
      rows: 1
      gap: 0
    clientBranding:
      logoText: COX
      logoSub: MEDIA GROUP
      bg: '#030810'
      bgSurface: '#051018'
      bgCard: '#081520'
      bgCardAlt: '#0c1c2c'
      border: '#0a2040'
      borderLit: '#105090'
      accent: '#0091D5'
      accentDim: 'rgba(0,145,213,0.15)'
      t2: '#b8ccdc'
      t3: '#607890'
      dotColor: '#081830'
    widgets:
      - id: usa-delivery-map-cox
        type: usa-map-gl
        title: ''
        source: computed
        queryId: campaign-delivery-map-cox
        position:
          col: 1
          row: 1
          colSpan: 1
          rowSpan: 1
        mglConfig:
          colorScheme: cool
          showLeaderboard: true
          zoomViz: dots
          clientLogo: /img/cox-logo.svg
  - id: cox-metrics
    name: Cox Media Group
    subtitle: Campaign Health
    icon: chart-bar
    grid:
      columns: 4
      rows: 2
      gap: 14
    clientBranding:
      logoText: COX
      logoSub: MEDIA GROUP
      bg: '#030810'
      bgSurface: '#051018'
      bgCard: '#081520'
      bgCardAlt: '#0c1c2c'
      border: '#0a2040'
      borderLit: '#105090'
      accent: '#0091D5'
      accentDim: 'rgba(0,145,213,0.15)'
      t2: '#b8ccdc'
      t3: '#607890'
      dotColor: '#081830'
    widgets:
      - id: cox-feeds-delivered
        type: stat-card
        title: Data Feed Deliveries
        source: gcp
        queryId: iheart-datafeeds-delivered
        position:
          col: 1
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: cox-export-failures
        type: stat-card
        title: Export Failures
        source: gcp
        queryId: iheart-export-failures
        position:
          col: 2
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: cox-win-rate-stat
        type: big-number
        title: Win Rate (p50)
        source: gcp
        queryId: cox-win-rate
        position:
          col: 3
          row: 1
          colSpan: 1
          rowSpan: 1
        unit: '%'
      - id: cox-pacing-stat
        type: big-number
        title: Pacing Ratio (p50)
        source: gcp
        queryId: roger-pacing-ratio
        position:
          col: 4
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: cox-win-rate-chart
        type: line-chart
        title: Cox Win Rate (p50)
        source: gcp
        queryId: cox-win-rate
        position:
          col: 1
          row: 2
          colSpan: 2
          rowSpan: 1
      - id: cox-pacing-chart
        type: line-chart
        title: Pacing Ratio (p50)
        source: gcp
        queryId: roger-pacing-ratio
        position:
          col: 3
          row: 2
          colSpan: 2
          rowSpan: 1
```

- [ ] **Step 3: Restart and verify all new dashboards appear**

```bash
sudo systemctl restart tv-dashboards && sleep 3
curl -s http://tv:3000/api/dashboards | python3 -c "
import json, sys
clients = ['fox','hearst','nexstar','scripps','cox']
for d in json.load(sys.stdin):
    for c in clients:
        if c in d['id']:
            print(d['id'], '— widgets:', d['widgetCount'])
"
```

Expected: 10 lines, each with 1 or 6 widgets.

- [ ] **Step 4: Spot-check one map query returns data**

```bash
curl -s "http://tv:3000/api/data/usa-delivery-map-fox" | python3 -c "
import json, sys
d = json.load(sys.stdin)
hs = (d.get('data') or {}).get('hotspots', [])
print(f'FOX hotspots: {len(hs)}')
if hs: print('top:', hs[0].get('state'), hs[0].get('impressions'), 'imps')
"
```

Expected: hotspots > 0 (FOX has 128M impressions, expect 200+ hotspots).

- [ ] **Step 5: Commit**

```bash
git add config/dashboards.yaml
git commit -m "feat: add delivery map + campaign health dashboards for FOX, Hearst, Nexstar, Scripps, Cox"
```

---

## Chunk 5: Ship it

### Task 6: PR, merge, restart

- [ ] **Step 1: Create PR**

```bash
git checkout -b feat/multi-client-tv-dashboards
git push -u origin feat/multi-client-tv-dashboards
gh pr create \
  --title "feat: multi-client TV dashboards (FOX, Hearst, Nexstar, Scripps, Cox)" \
  --body "Refactors iHeart-specific delivery map into a generic client-scoped function and adds 10 new TV screens (delivery map + campaign health) for the top 5 clients by impression volume. Each screen has full client branding (colors, logo, dot grid) that activates on transition and resets to MadHive purple on exit." \
  --base main
```

- [ ] **Step 2: Merge**

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull --rebase origin main 2>/dev/null || git reset --hard origin/main
```

- [ ] **Step 3: Restart X and service**

```bash
sudo systemctl restart tv-dashboards lightdm
sleep 5
sudo systemctl is-active tv-dashboards lightdm
```

Expected: both `active`.
