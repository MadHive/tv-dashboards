# iHeart Media TV Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two TV screens for iHeart Media — a full-screen delivery map (BigQuery, org-filtered to iHeart only, iHeart brand colors + logo) and a 4×2 metrics screen (pipeline health scorecards + win rate + pacing charts).

**Architecture:** New BigQuery function `getDeliveryGeoIHeart()` in `gcp-metrics.js` joins `billable_agg → meta_inst` on `inst_id_b64` to isolate iHeart impressions. A new exported function `campaignDeliveryMapIHeartWidget()` mirrors the existing `campaignDeliveryMapWidget` pattern and is registered in `computed.js`'s `FUNCTION_REGISTRY`. The map widget gains an `iheart` color scheme (red choropleth + particles) and `clientLogo` overlay support. Three GCP queries are added for the metrics screen.

**Tech Stack:** Bun, Elysia.js, BigQuery (`mad-data.reporting.billable_agg` + `meta_geo` + `meta_inst` + `public_data.zip_codes`), GCP Cloud Monitoring, Mapbox GL JS, YAML config

---

## Chunk 1: Backend — iHeart BigQuery geo + computed function

### Task 1: Add `getDeliveryGeoIHeart()` to `server/gcp-metrics.js`

**Files:**
- Modify: `server/gcp-metrics.js` (after `getDeliveryGeoZ5`, around line 344)

The existing `getDeliveryGeo()` queries all clients. We add a parallel function that joins through `meta_inst` to filter to iHeart only. Same return shape: array of `{ zip3, state, lat, lon, impressions, clicks, zips, city, dma }`.

- [ ] **Step 1: Add `getDeliveryGeoIHeart` after `getDeliveryGeoZ5`**

Find the closing `}` of `getDeliveryGeoZ5` (around line 344) and insert immediately after:

```js
// ── iHeart-specific BigQuery delivery geo (filtered via meta_inst join) ──
let _bqIHeartGeoCache = null;
const BQ_IHEART_GEO_CACHE_TTL = 5 * 60 * 1000;

async function getDeliveryGeoIHeart(days = 7, minImpressions = 50) {
  const cacheKey = 'iheart:' + days + ':' + minImpressions;
  if (_bqIHeartGeoCache && _bqIHeartGeoCache.key === cacheKey && Date.now() - _bqIHeartGeoCache.time < BQ_IHEART_GEO_CACHE_TTL) return _bqIHeartGeoCache.data;

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
        AND mi.client.name = 'iHeart'
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
    _bqIHeartGeoCache = { key: cacheKey, time: Date.now(), data: results };
    logger.info(`[bq] iHeart delivery geo: ${results.length} zip3 prefixes loaded`);
    return _bqIHeartGeoCache.data;
  } catch (err) {
    logger.error(`[bq] iHeart delivery geo query failed: ${err.message}`);
    return _bqIHeartGeoCache ? _bqIHeartGeoCache.data : [];
  }
}
```

- [ ] **Step 2: Add `campaignDeliveryMapIHeartWidget` export after `campaignDeliveryMapWidget`**

Find the closing `}` of `export async function campaignDeliveryMapWidget` (around line 1390) and insert immediately after:

```js
export async function campaignDeliveryMapIHeartWidget(params = {}, widgetConfig = {}) {
  const wc = {
    id:        widgetConfig.id || params.widgetId || 'usa-delivery-map-iheart',
    mapConfig: {
      region:         params.region         || widgetConfig.mapConfig?.region,
      timeWindow:     params.timeWindow     || widgetConfig.mapConfig?.timeWindow,
      minImpressions: params.minImpressions || widgetConfig.mapConfig?.minImpressions,
    },
  };
  const timeWindow = Math.max(1, Math.min(90, parseInt(wc.mapConfig.timeWindow) || 7));
  const minImp     = parseInt(wc.mapConfig.minImpressions) >= 0 ? parseInt(wc.mapConfig.minImpressions) : 50;
  const region     = wc.mapConfig.region || 'full';

  const REGION_STATE_SETS = {
    northeast: new Set(['ME','VT','NH','MA','RI','CT','NY','NJ','PA','DE','MD','DC','VA','WV']),
    southeast: new Set(['NC','SC','GA','FL','AL','MS','TN','KY']),
    northwest: new Set(['WA','OR','ID','MT','WY','ND','SD','MN','WI','MI']),
    southwest: new Set(['CA','NV','AZ','NM','UT','CO','TX','OK','KS','NE']),
  };
  const regionStates = REGION_STATE_SETS[region] || null;

  const geoData = await getDeliveryGeoIHeart(timeWindow, minImp);

  const stateActivity = {};
  const hotspots      = [];

  (geoData || []).forEach(z => {
    const st = z.state;
    if (st) {
      if (!stateActivity[st]) stateActivity[st] = { impressions: 0, bids: 0, campaigns: 0 };
      stateActivity[st].impressions += z.impressions;
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

  const totals = {
    impressions: hotspots.reduce((s, h) => s + h.impressions, 0),
    bids:        hotspots.reduce((s, h) => s + (h.clicks * 50), 0),
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

- [ ] **Step 3: Verify server starts cleanly (no syntax errors)**

```bash
cd /home/tech/dev-dashboards
node --input-type=module < server/gcp-metrics.js 2>&1 | grep -i "error\|syntax" | head -5
```

Expected: no output (no errors).

---

### Task 2: Register `campaignDeliveryMapIHeartWidget` in `computed.js`

**Files:**
- Modify: `server/data-sources/computed.js` (FUNCTION_REGISTRY object, lines 11–20)

- [ ] **Step 1: Add entry to FUNCTION_REGISTRY**

In the `FUNCTION_REGISTRY` object, add after the `campaignDeliveryMapWidget` line:

```js
campaignDeliveryMapIHeartWidget: async (p, wc) => (await import('../gcp-metrics.js')).campaignDeliveryMapIHeartWidget(p, wc),
```

- [ ] **Step 2: Commit**

```bash
git add server/gcp-metrics.js server/data-sources/computed.js
git commit -m "feat: add iHeart org-filtered BigQuery delivery map function"
```

---

## Chunk 2: Frontend — iHeart brand colors, choropleth, and logo overlay

### Task 3: iHeart color scheme + choropleth in `mapbox-map.js`

**Files:**
- Modify: `public/js/mapbox-map.js`

iHeart brand: primary `#C6002B`, accent `#E30C3A`, light `#FF8FA3`. The existing purple choropleth is applied once in `_buildLayers`. We make it overridable at runtime via `setPaintProperty` in `_applyColorScheme`.

- [ ] **Step 1: Add `iheart` to `SCHEME_COLORS` and add `choropleth` field to all schemes**

Replace the `SCHEME_COLORS` block (line ~65):

```js
var SCHEME_COLORS = {
  brand:  { particleNormal: '#67E8F9', particleFast: '#FDA4D4', stateGlowHigh: '#FDA4D4', choropleth: null },
  cool:   { particleNormal: '#60A5FA', particleFast: '#FFFFFF', stateGlowHigh: '#e0f2fe', choropleth: null },
  warm:   { particleNormal: '#fbbf24', particleFast: '#FF6B35', stateGlowHigh: '#fef08a', choropleth: null },
  iheart: {
    particleNormal: '#FF6B8A', particleFast: '#FFAABB', stateGlowHigh: '#FFAABB',
    choropleth: [
      'interpolate', ['linear'], ['get', 'intensity'],
      0,    '#0d0005',
      0.10, '#2d000e',
      0.28, '#6b001a',
      0.50, '#C6002B',
      0.70, '#E30C3A',
      0.88, '#FF4D6B',
      1.0,  '#FF8FA3',
    ],
  },
};
```

- [ ] **Step 2: Update `_applyColorScheme` to switch choropleth fill when scheme has one**

In `_applyColorScheme` (line ~825), after the existing `setPaintProperty` calls, append:

```js
if (this._map.getLayer('states-fill')) {
  this._map.setPaintProperty('states-fill', 'fill-color', s.choropleth || CHOROPLETH);
}
```

- [ ] **Step 3: Add `clientLogo` to `buildMapConfig` defaults**

In `buildMapConfig` (line ~72), add `clientLogo: null` to the returned object:

```js
function buildMapConfig(userConfig) {
  return {
    particleCount:   100,
    particleSpeed:   1.0,
    colorScheme:     'brand',
    showLeaderboard: true,
    mapStyle:        'mapbox',
    zoomViz:         'dots',
    clientLogo:      null,
    ...(userConfig || {}),
  };
}
```

- [ ] **Step 4: Render client logo in `_initOverlays`**

Find `_initOverlays` — locate the line `this._wrap.appendChild(overlay)` where the bottom-left total overlay is appended (around line 1020). Just **before** that line, add:

```js
if (this._cfg.clientLogo) {
  const logoWrap = document.createElement('div');
  logoWrap.className = 'mgl-client-logo';
  const logoImg = document.createElement('img');
  logoImg.src = this._cfg.clientLogo;
  logoImg.alt = '';
  logoWrap.appendChild(logoImg);
  this._wrap.appendChild(logoWrap);
}
```

- [ ] **Step 5: Add CSS for `.mgl-client-logo` in `public/css/dashboard.css`**

Append at the end of `public/css/dashboard.css`:

```css
/* Client branding overlay on full-screen map widget */
.mgl-client-logo {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 10;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  padding: 8px 14px;
}
.mgl-client-logo img {
  height: 32px;
  width: auto;
  display: block;
  opacity: 0.9;
}
```

- [ ] **Step 6: Commit frontend changes**

```bash
git add public/js/mapbox-map.js public/css/dashboard.css
git commit -m "feat: add iHeart color scheme, red choropleth, and client logo overlay to map widget"
```

---

### Task 4: Add iHeart logo asset

**Files:**
- Create: `public/img/iheart-logo.svg`

- [ ] **Step 1: Create the SVG logo**

```bash
cat > /home/tech/dev-dashboards/public/img/iheart-logo.svg << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 52">
  <text x="4" y="42" font-family="Arial Black,Arial" font-weight="900"
        font-size="40" fill="#C6002B" letter-spacing="-1">iHeart</text>
  <text x="140" y="42" font-family="Arial Black,Arial" font-weight="900"
        font-size="40" fill="#ffffff" letter-spacing="-1">Media</text>
</svg>
SVGEOF
```

- [ ] **Step 2: Verify**

```bash
file /home/tech/dev-dashboards/public/img/iheart-logo.svg
head -3 /home/tech/dev-dashboards/public/img/iheart-logo.svg
```

Expected: SVG XML file.

- [ ] **Step 3: Commit**

```bash
git add public/img/iheart-logo.svg
git commit -m "feat: add iHeart wordmark SVG asset for map logo overlay"
```

---

## Chunk 3: Config — queries and dashboards

### Task 5: Add queries to `config/queries.yaml`

**Files:**
- Modify: `config/queries.yaml`

- [ ] **Step 1: Add computed query for the iHeart map**

In the `computed:` section, after the last `campaign-delivery-map-*` entry (around line 55), insert:

```yaml
  - id: campaign-delivery-map-iheart
    name: Campaign Delivery Map (iHeart)
    description: iHeart-only delivery heatmap — BigQuery impressions filtered to iHeart org via meta_inst join
    function: campaignDeliveryMapIHeartWidget
    params:
      widgetId: usa-delivery-map-iheart
    widgetTypes:
      - usa-map-gl
```

- [ ] **Step 2: Add three GCP queries at the end of the `gcp:` section**

```yaml
  - id: iheart-datafeeds-delivered
    name: iHeart Data Feed Deliveries
    metricType: logging.googleapis.com/user/reporter-datafeeds-delivered
    project: mad-master
    timeWindow: 60
    aggregation:
      perSeriesAligner: ALIGN_SUM
      crossSeriesReducer: REDUCE_SUM
      alignmentPeriod:
        seconds: 3600
    filters: 'resource.type="cloud_run_revision"'
    widgetTypes:
      - stat-card
  - id: iheart-export-failures
    name: iHeart Export Failures
    metricType: logging.googleapis.com/user/reporter-failed-export
    project: mad-master
    timeWindow: 60
    aggregation:
      perSeriesAligner: ALIGN_SUM
      crossSeriesReducer: REDUCE_SUM
      alignmentPeriod:
        seconds: 3600
    filters: 'resource.type="cloud_run_revision"'
    widgetTypes:
      - stat-card
  - id: iheart-win-rate
    name: iHeart Win Rate (p50)
    metricType: workload.googleapis.com/mhive/roger/campaign_win_rate
    project: mad-master
    timeWindow: 60
    aggregation:
      perSeriesAligner: ALIGN_DELTA
      crossSeriesReducer: REDUCE_PERCENTILE_50
      alignmentPeriod:
        seconds: 60
    filters: 'metric.parent_org_id="popErPc0MjpPi1i94r9M0gBNFrT8"'
    widgetTypes:
      - big-number
      - line-chart
```

- [ ] **Step 3: Restart and verify queries load**

```bash
sudo systemctl restart tv-dashboards && sleep 3
curl -s http://tv:3000/api/queries/ | python3 -c "
import json, sys
d = json.load(sys.stdin)
gcp  = [q['id'] for q in d.get('queries',{}).get('gcp',[])  if 'iheart' in q['id']]
comp = [q['id'] for q in d.get('queries',{}).get('computed',[]) if 'iheart' in q['id']]
print('GCP:', gcp)
print('Computed:', comp)
"
```

Expected:
```
GCP: ['iheart-datafeeds-delivered', 'iheart-export-failures', 'iheart-win-rate']
Computed: ['campaign-delivery-map-iheart']
```

- [ ] **Step 4: Commit**

```bash
git add config/queries.yaml
git commit -m "feat: add iHeart GCP and computed queries"
```

---

### Task 6: Add dashboards to `config/dashboards.yaml`

**Files:**
- Modify: `config/dashboards.yaml`

- [ ] **Step 1: Append both dashboards at the end of the `dashboards:` list**

```yaml
  - id: iheart-delivery-map
    name: iHeart Media
    subtitle: Delivery
    icon: map
    grid:
      columns: 1
      rows: 1
      gap: 0
    widgets:
      - id: usa-delivery-map-iheart
        type: usa-map-gl
        title: ''
        source: computed
        queryId: campaign-delivery-map-iheart
        position:
          col: 1
          row: 1
          colSpan: 1
          rowSpan: 1
        mglConfig:
          colorScheme: iheart
          showLeaderboard: true
          zoomViz: dots
          clientLogo: /img/iheart-logo.svg
  - id: iheart-metrics
    name: iHeart Media
    subtitle: Campaign Health
    icon: chart-bar
    grid:
      columns: 4
      rows: 2
      gap: 14
    widgets:
      - id: iheart-feeds-delivered
        type: stat-card
        title: Data Feed Deliveries
        source: gcp
        queryId: iheart-datafeeds-delivered
        position:
          col: 1
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: iheart-export-failures-widget
        type: stat-card
        title: Export Failures
        source: gcp
        queryId: iheart-export-failures
        position:
          col: 2
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: iheart-win-rate-stat
        type: big-number
        title: Win Rate (p50)
        source: gcp
        queryId: iheart-win-rate
        position:
          col: 3
          row: 1
          colSpan: 1
          rowSpan: 1
        unit: '%'
      - id: iheart-pacing-stat
        type: big-number
        title: Pacing Ratio (p50)
        source: gcp
        queryId: roger-pacing-ratio
        position:
          col: 4
          row: 1
          colSpan: 1
          rowSpan: 1
      - id: iheart-win-rate-chart
        type: line-chart
        title: iHeart Win Rate (p50)
        source: gcp
        queryId: iheart-win-rate
        position:
          col: 1
          row: 2
          colSpan: 2
          rowSpan: 1
      - id: iheart-pacing-chart
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

- [ ] **Step 2: Restart and verify both dashboards appear**

```bash
sudo systemctl restart tv-dashboards && sleep 3
curl -s http://tv:3000/api/dashboards | python3 -c "
import json, sys
for d in json.load(sys.stdin):
    if 'iheart' in d['id']:
        print(d['id'], '—', d['name'], '/', d['subtitle'], '— widgets:', d['widgetCount'])
"
```

Expected:
```
iheart-delivery-map — iHeart Media / Delivery — widgets: 1
iheart-metrics — iHeart Media / Campaign Health — widgets: 6
```

- [ ] **Step 3: Smoke-test the iHeart map query returns real data**

```bash
curl -s "http://tv:3000/api/queries/computed/campaign-delivery-map-iheart/run" | python3 -c "
import json, sys
d = json.load(sys.stdin)
hs = (d.get('data') or {}).get('hotspots', [])
print(f'hotspots: {len(hs)}')
if hs: print('top:', hs[0].get('state'), hs[0].get('impressions'), 'imps')
"
```

Expected: `hotspots: N` (N > 0), top state + impression count.

- [ ] **Step 4: Final commit**

```bash
git add config/dashboards.yaml
git commit -m "feat: add iHeart delivery map and campaign health TV dashboards"
```
