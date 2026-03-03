# USA Map Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix leaderboard scroll lag, add automatic regional zoom cycle (full USA → Northeast → Southeast), and make the map configurable from the studio editor (time window, threshold, metric).

**Architecture:** Three separate concerns — (1) a one-line scroll-reset fix in charts.js, (2) a zoom state machine + coordinate transform layered on top of the existing drawMap() without touching individual draw calls, (3) map-specific widget properties in the studio that flow through widgetConfig into the BigQuery query. All pure JS/canvas — no new dependencies.

**Tech Stack:** Vanilla JS Canvas API, Bun/Elysia.js backend, YAML config

---

## Reference Files

Read these before starting:
- `public/js/charts.js` lines 535–620 (module-level state, `usaMap()` entry point)
- `public/js/charts.js` lines 679–725 (drawMap opening: canvas setup, mapX/mapW/mapH)
- `public/js/charts.js` lines 978–985 (`sorted` variable — leaderboard data)
- `public/js/charts.js` lines 1450–1490 (leaderboard render, scrollOffset)
- `server/data-sources/gcp.js` lines 38–70 (`fetchMetrics`, legacy path)
- `server/gcp-metrics.js` lines 158–210 (`getDeliveryGeo` — BigQuery query)
- `server/gcp-metrics.js` lines 318–385 (`campaignDeliveryMap`)

Key patterns:
- Map coordinates: `px = mapX + US.project(lon, lat)[0] * mapW`
- Module state lives at top of the USA Map section (`let mapAnimId`, `let mapSparkHistory`, etc.)
- Leaderboard scroll: `Math.floor((now / 3500) % Math.max(1, lbCount - 8))`
- The canvas widget version is bumped via `?v=N` in `public/studio.html` and `public/index.html`

---

## Task 1: Fix leaderboard scroll — reset when top state changes

**Files:**
- Modify: `public/js/charts.js` — module-level state + leaderboard section

**Step 1: Add module-level tracking variable**

Find the existing module-level state block (around line 540):
```js
let mapAnimId = null;
let mapSparkHistory = {};
let mapParticles = [];
let mapPrevTotals = {};
let mapDataEvents = [];
let mapBursts = [];
```

Add immediately after:
```js
let mapScrollResetTime = 0;  // epoch ms — leaderboard resets scroll here
let mapPrevTopState  = '';   // id of #1 state on last update
```

**Step 2: Reset scroll when top state changes**

In `usaMap(canvas, data)` (around line 562), after `canvas._mapData = data;` add:
```js
  // Reset leaderboard scroll if the top state changed
  var sortedForCheck = Object.entries(data.states || {})
    .sort(function(a, b) { return b[1].impressions - a[1].impressions; });
  var topId = sortedForCheck.length ? sortedForCheck[0][0] : '';
  if (topId !== mapPrevTopState) {
    mapScrollResetTime = Date.now();
    mapPrevTopState = topId;
  }
```

**Step 3: Use reset time in scroll offset calculation**

Find (around line 1474):
```js
    var scrollOffset = Math.floor((now / 3500) % Math.max(1, lbCount - 8));
```

Replace with:
```js
    var scrollElapsed = now - mapScrollResetTime;
    var scrollOffset = Math.floor((scrollElapsed / 3500) % Math.max(1, lbCount - 8));
```

**Step 4: Bump charts.js version in index.html and studio.html**

In `public/index.html`:
```html
<script src="/js/charts.js?v=12">
```
Change to `?v=13`.

In `public/studio.html`:
```html
<script src="/js/charts.js?v=11">
```
Change to `?v=12`.

**Step 5: Run tests**
```bash
bun test tests/unit tests/integration tests/helpers tests/components 2>&1 | tail -4
```
Expected: all pass (no tests for canvas rendering — verify manually after restart).

**Step 6: Commit**
```bash
git add public/js/charts.js public/index.html public/studio.html
git commit -m "fix: leaderboard scroll resets when top state changes in USA map"
```

---

## Task 2: Add zoom state machine + region definitions

**Files:**
- Modify: `public/js/charts.js` — module-level state block

**Step 1: Add zoom state to module-level variables**

After the `mapScrollResetTime` / `mapPrevTopState` additions from Task 1:

```js
// ── Map zoom cycle ──
// Regions defined as [x0, y0, x1, y1] in normalized [0,1] projected space.
// x0/y0 = top-left of region, x1/y1 = bottom-right.
// Use US.project(lon, lat) to verify/tune — west=0, east=1, north=0, south=1.
var MAP_ZOOM_REGIONS = [
  {
    id: 'full',
    label: '',
    duration: 12000,   // ms to hold this view
    x0: 0, y0: 0, x1: 1, y1: 1,   // full US
    states: null,      // null = all states
  },
  {
    id: 'northeast',
    label: 'NORTHEAST',
    duration: 7000,
    // Northeast: roughly lon -81 to -66, lat 37 to 47.5
    // Tuned empirically — tighten/loosen x0/y0/x1/y1 to taste
    x0: 0.76, y0: 0.03, x1: 1.03, y1: 0.50,
    states: ['ME','VT','NH','MA','RI','CT','NY','NJ','PA','DE','MD','DC','VA','WV'],
  },
  {
    id: 'southeast',
    label: 'SOUTHEAST',
    duration: 7000,
    // Southeast: roughly lon -92 to -75, lat 24.5 to 37
    x0: 0.62, y0: 0.42, x1: 0.98, y1: 0.90,
    states: ['NC','SC','GA','FL','AL','MS','TN','KY'],
  },
];

var MAP_ZOOM_TRANS_MS = 1500;   // crossfade/lerp duration
var mapZoomIdx    = 0;           // index into MAP_ZOOM_REGIONS
var mapZoomSince  = 0;           // epoch ms when current region started
var mapZoomFrom   = null;        // previous region (for lerp), null = instant
```

**Step 2: Add lerp helper (if not already present)**

Near the top of the charting IIFE (search for `function lerp` or `function clamp` — add near them):

```js
  function lerpZoom(a, b, t) {
    return {
      x0: a.x0 + (b.x0 - a.x0) * t,
      y0: a.y0 + (b.y0 - a.y0) * t,
      x1: a.x1 + (b.x1 - a.x1) * t,
      y1: a.y1 + (b.y1 - a.y1) * t,
    };
  }
```

**Step 3: Commit**
```bash
git add public/js/charts.js
git commit -m "feat: add USA map zoom region definitions and state machine variables"
```

---

## Task 3: Apply zoom transform in drawMap()

**Files:**
- Modify: `public/js/charts.js` — drawMap() function

**Step 1: Advance zoom state + compute effective zoom**

In `drawMap()`, AFTER the `mapX / mapY / mapW / mapH` are computed (around line 719) and BEFORE any drawing begins, add:

```js
    // ── Zoom cycle: advance state, compute current zoom rect ──
    var zoomNow = Date.now();
    if (mapZoomSince === 0) mapZoomSince = zoomNow;

    var curRegion = MAP_ZOOM_REGIONS[mapZoomIdx];
    var elapsed   = zoomNow - mapZoomSince;

    if (elapsed > curRegion.duration + MAP_ZOOM_TRANS_MS) {
      // Advance to next region
      mapZoomFrom   = curRegion;
      mapZoomIdx    = (mapZoomIdx + 1) % MAP_ZOOM_REGIONS.length;
      mapZoomSince  = zoomNow;
      curRegion     = MAP_ZOOM_REGIONS[mapZoomIdx];
      elapsed       = 0;
    }

    // Compute interpolated zoom rect
    var zoomRect;
    if (mapZoomFrom && elapsed < MAP_ZOOM_TRANS_MS) {
      var t = elapsed / MAP_ZOOM_TRANS_MS;
      // Ease in-out cubic
      t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      zoomRect = lerpZoom(mapZoomFrom, curRegion, t);
    } else {
      zoomRect = curRegion;
      if (elapsed >= MAP_ZOOM_TRANS_MS) mapZoomFrom = null;  // transition done
    }

    // Apply zoom: expand mapX/mapY/mapW/mapH so the zoomRect region fills the original area
    var origMapX = mapX, origMapY = mapY, origMapW = mapW, origMapH = mapH;
    var wFrac = Math.max(0.05, zoomRect.x1 - zoomRect.x0);
    var hFrac = Math.max(0.05, zoomRect.y1 - zoomRect.y0);
    mapW = origMapW / wFrac;
    mapH = origMapH / hFrac;
    mapX = origMapX - zoomRect.x0 * mapW;
    mapY = origMapY - zoomRect.y0 * mapH;
```

**Step 2: Add clipping rect around all map rendering**

Immediately after the zoom block (before the map background gradient), add:

```js
    // Clip all map content to the original map area
    ctx.save();
    ctx.beginPath();
    ctx.rect(origMapX, origMapY, origMapW, origMapH);
    ctx.clip();
```

**Step 3: Close the clip after map content, before leaderboard**

Find the line just BEFORE the leaderboard sidebar section (around line 1452 — look for `// ── Leaderboard sidebar`). Add before it:

```js
    ctx.restore();  // end map clip
```

**Step 4: Test manually**

After restart, the map should now cycle:
- Full USA for 12 seconds
- Slide to Northeast for 7 seconds (NY/CT/NJ/MA cluster visible and large)
- Slide back through transition to Southeast for 7 seconds
- Return to full USA

If the zoom bounds are off, tune the `x0/y0/x1/y1` values in `MAP_ZOOM_REGIONS`.

**Step 5: Commit**
```bash
git add public/js/charts.js
git commit -m "feat: USA map auto-cycles through Northeast/Southeast zoom regions"
```

---

## Task 4: Add zoom region label overlay

**Files:**
- Modify: `public/js/charts.js` — drawMap(), after `ctx.restore()` (end of map clip)

**Step 1: Draw region label when zoomed in**

After `ctx.restore()` (end of map clip, from Task 3), add:

```js
    // ── Zoom region label ──
    if (curRegion.label) {
      var labelAlpha = 1;
      // Fade in during transition
      if (mapZoomFrom && elapsed < MAP_ZOOM_TRANS_MS) {
        labelAlpha = elapsed / MAP_ZOOM_TRANS_MS;
      }
      ctx.globalAlpha = labelAlpha * 0.9;
      ctx.font = "700 18px 'Space Grotesk', sans-serif";
      ctx.letterSpacing = '3px';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = BRAND.pink;
      ctx.fillText('\u25C2 ' + curRegion.label, origMapX + 10, origMapY + origMapH - 10);
      // Miniature full-US indicator dot
      ctx.font = "500 11px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text3;
      ctx.fillText('ZOOMED VIEW', origMapX + 10, origMapY + origMapH - 30);
      ctx.globalAlpha = 1;
    }
```

**Step 2: Commit**
```bash
git add public/js/charts.js
git commit -m "feat: show region label overlay when USA map is zoomed"
```

---

## Task 5: Filter leaderboard to region states during zoom

**Files:**
- Modify: `public/js/charts.js` — leaderboard section (around line 1452)

**Step 1: Filter sorted list when in a zoomed region**

Find where `sorted` is used for the leaderboard (around line 1455):
```js
    var lbCount = Math.min(15, sorted.length);
```

Replace with:
```js
    // During zoom, show only states in that region; during transition blend back to full
    var lbSorted = sorted;
    if (curRegion.states) {
      var regionSet = new Set(curRegion.states);
      var regionSorted = sorted.filter(function(e) { return regionSet.has(e[0]); });
      if (regionSorted.length > 0) {
        // Fade between full list and region list using transition progress
        var blendT = mapZoomFrom ? Math.min(1, elapsed / MAP_ZOOM_TRANS_MS) : 1;
        lbSorted = blendT >= 0.5 ? regionSorted : sorted;
      }
    }
    var lbCount = Math.min(15, lbSorted.length);
```

**Step 2: Update the leaderboard loop to use `lbSorted`**

Find (a few lines below):
```js
      var lEntry = sorted[si2];
```
Replace with:
```js
      var lEntry = lbSorted[si2];
```

**Step 3: Update leaderboard header to show region name**

Find:
```js
    ctx.fillText('TOP STATES', lbX + leaderboardW / 2, lbY - 19);
```
Replace with:
```js
    var lbTitle = curRegion.states ? 'TOP ' + curRegion.label : 'TOP STATES';
    ctx.fillText(lbTitle, lbX + leaderboardW / 2, lbY - 19);
```

**Step 4: Run tests and commit**
```bash
bun test tests/unit tests/integration tests/helpers tests/components 2>&1 | tail -4
git add public/js/charts.js
git commit -m "feat: leaderboard filters to visible states when USA map is zoomed"
```

---

## Task 6: Add map config properties to studio HTML

**Files:**
- Modify: `public/studio.html`

**Step 1: Add map-config section inside `#widget-props`**

Find the closing `</div>` of the Display `<details>` section (around line 262). After it, add a new `<details>` block for map-specific settings:

```html
          <details class="props-section" id="map-config-section" style="display:none">
            <summary>Map Config</summary>
            <div>
              <label>Time Window
                <select id="prop-map-timewindow">
                  <option value="1">Last 1 day</option>
                  <option value="7" selected>Last 7 days</option>
                  <option value="14">Last 14 days</option>
                  <option value="30">Last 30 days</option>
                </select>
              </label>
              <label>Min Impressions
                <input id="prop-map-minimpressions" type="number" min="0" value="100" placeholder="100">
              </label>
              <label>Primary Metric
                <select id="prop-map-metric">
                  <option value="impressions" selected>Impressions</option>
                  <option value="clicks">Clicks</option>
                </select>
              </label>
              <label>Zoom Cycle
                <select id="prop-map-zoom">
                  <option value="on" selected>On (auto-zoom regions)</option>
                  <option value="off">Off (full USA only)</option>
                </select>
              </label>
            </div>
          </details>
```

**Step 2: Bump studio.js version to force cache refresh**

Find `<script src="/js/studio.js?v=N">` and increment N by 1.

**Step 3: Commit**
```bash
git add public/studio.html
git commit -m "feat: add Map Config panel to studio widget properties"
```

---

## Task 7: Bind map config in studio.js + show/hide the section

**Files:**
- Modify: `public/js/studio.js`

**Step 1: Show/hide map-config-section based on widget type**

In `showWidgetProps(widgetId)`, find where `display-section` is shown/hidden (around line 460):
```js
      const displaySection = document.getElementById('display-section');
      if (displaySection) {
        const showDisplayTypes = ['gauge', 'gauge-row', 'progress-bar', 'big-number', 'stat-card'];
        displaySection.style.display = showDisplayTypes.includes(wc.type) ? '' : 'none';
      }
```

Add immediately after:
```js
      const mapSection = document.getElementById('map-config-section');
      if (mapSection) {
        mapSection.style.display = wc.type === 'usa-map' ? '' : 'none';
      }
```

**Step 2: Populate map config fields from widget config**

In `showWidgetProps`, in the `set()` calls section (around line 446), add:
```js
      if (wc.type === 'usa-map') {
        const mc = wc.mapConfig || {};
        set('prop-map-timewindow',     mc.timeWindow     || 7);
        set('prop-map-minimpressions', mc.minImpressions !== undefined ? mc.minImpressions : 100);
        set('prop-map-metric',         mc.metric         || 'impressions');
        set('prop-map-zoom',           mc.zoom           || 'on');
      }
```

**Step 3: Bind map config change handlers**

In `bindWidgetPropListeners(wc)`, after the existing `bind()` calls, add:
```js
      // Map-specific config (only wired if widget is usa-map)
      if (wc.type === 'usa-map') {
        function bindMap(id, applyFn) {
          const el = document.getElementById(id);
          if (!el) return;
          el.onchange = el.oninput = function() {
            if (!wc.mapConfig) wc.mapConfig = {};
            applyFn(el.value);
            self.markDirty();
          };
        }
        bindMap('prop-map-timewindow',     function(v) { wc.mapConfig.timeWindow = parseInt(v) || 7; });
        bindMap('prop-map-minimpressions', function(v) { wc.mapConfig.minImpressions = parseInt(v) || 0; });
        bindMap('prop-map-metric',         function(v) { wc.mapConfig.metric = v; });
        bindMap('prop-map-zoom',           function(v) { wc.mapConfig.zoom = v; });
      }
```

**Step 4: Also update `bindWidgetPropListeners` display-section type change handler**

In the `bind('prop-type', ...)` handler (around line 486), add the map section toggle alongside the display section toggle:
```js
        const mapSec = document.getElementById('map-config-section');
        if (mapSec) mapSec.style.display = v === 'usa-map' ? '' : 'none';
```

**Step 5: Run tests and commit**
```bash
bun test tests/unit tests/integration tests/helpers tests/components 2>&1 | tail -4
git add public/js/studio.js
git commit -m "feat: studio binds map config panel to usa-map widget properties"
```

---

## Task 8: Pass widgetConfig to gcp-metrics + apply in query

**Files:**
- Modify: `server/data-sources/gcp.js` lines 53–55
- Modify: `server/gcp-metrics.js` — `getMetrics()` and `campaignDeliveryMap()`

**Step 1: Pass widgetConfig to legacy getMetrics call**

In `server/data-sources/gcp.js`, find (around line 53):
```js
      const dashboardId = widgetConfig.dashboardId || 'platform-overview';
      const allMetrics = await this.gcpMetrics.getMetrics(dashboardId);
```

Replace with:
```js
      const dashboardId = widgetConfig.dashboardId || 'platform-overview';
      const allMetrics = await this.gcpMetrics.getMetrics(dashboardId, widgetConfig);
```

**Step 2: Forward widgetConfig in getMetrics dispatch**

In `server/gcp-metrics.js`, find `getMetrics(dashboardId)`:
```js
export async function getMetrics(dashboardId) {
  switch (dashboardId) {
    case 'platform-overview':  return platformOverview();
    ...
    case 'campaign-delivery':  return campaignDeliveryMap();
```

Change to:
```js
export async function getMetrics(dashboardId, widgetConfig = {}) {
  switch (dashboardId) {
    case 'platform-overview':  return platformOverview();
    ...
    case 'campaign-delivery':  return campaignDeliveryMap(widgetConfig);
```

**Step 3: Apply mapConfig in campaignDeliveryMap**

In `server/gcp-metrics.js`, change `campaignDeliveryMap()` signature and read config:

```js
async function campaignDeliveryMap(widgetConfig = {}) {
  const mc = widgetConfig.mapConfig || {};
  const timeWindow   = Math.max(1, Math.min(90, parseInt(mc.timeWindow)   || 7));
  const minImp       = Math.max(0, parseInt(mc.minImpressions) !== undefined ? parseInt(mc.minImpressions) : 100);
  const metric       = mc.metric === 'clicks' ? 'clicks' : 'impressions';
```

**Step 4: Apply config to getDeliveryGeo call**

`getDeliveryGeo` currently hardcodes 7 days and minImpressions 100. Change the call:

```js
  const [geoData, crData] = await Promise.all([
    getDeliveryGeo(timeWindow, minImp),
    getCloudRunData(),
  ]);
```

**Step 5: Update getDeliveryGeo signature**

```js
async function getDeliveryGeo(days = 7, minImpressions = 100) {
```

Update the BigQuery query string — find:
```sql
WHERE b.date_nyc >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
```
Replace with template literal (note the function already uses backtick strings):
```sql
WHERE b.date_nyc >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
```

Find:
```sql
HAVING impressions > 100
```
Replace with:
```sql
HAVING impressions > ${minImpressions}
```

**Step 6: Apply metric choice in state aggregation**

In `campaignDeliveryMap`, find the stateActivity aggregation (around line 340):
```js
      stateActivity[st].impressions += z.impressions;
      stateActivity[st].bids += z.clicks * 50;
```

The choropleth color is based on `impressions`. If metric is `clicks`, swap which value drives the color:

```js
      stateActivity[st].impressions += metric === 'clicks' ? z.clicks : z.impressions;
      stateActivity[st].bids        += z.clicks * 50;
```

**Step 7: Invalidate geo cache when config changes**

`getDeliveryGeo` has a 30-minute cache that ignores the `days`/`minImpressions` params. The cache key needs to include the params. Find the cache TTL section in `getDeliveryGeo` and update:

```js
// Simple cache keyed by params
const cacheKey = `${days}:${minImpressions}`;
if (_geoCache && _geoCache.key === cacheKey && Date.now() - _geoCache.time < 30 * 60 * 1000) {
  return _geoCache.data;
}
// ... fetch ...
_geoCache = { key: cacheKey, time: Date.now(), data: results };
```

Look at current cache implementation and adapt to include the key.

**Step 8: Run tests and commit**
```bash
bun test tests/unit tests/integration tests/helpers tests/components 2>&1 | tail -4
git add server/data-sources/gcp.js server/gcp-metrics.js
git commit -m "feat: map config (time window, threshold, metric) flows from studio to BigQuery query"
```

---

## Task 9: Respect zoom:off config in canvas

**Files:**
- Modify: `public/js/charts.js`

**Step 1: Pass zoom config from widget data to canvas**

In `usaMap(canvas, data)`, after setting `canvas._mapData = data`:
```js
  canvas._mapZoomEnabled = (data.zoom !== false);  // default on
```

**Step 2: Check flag in zoom advance logic**

In `drawMap()`, find the zoom advance block from Task 3:
```js
    if (elapsed > curRegion.duration + MAP_ZOOM_TRANS_MS) {
```

Wrap the entire zoom state advance in a flag check:
```js
    var zoomEnabled = canvas._mapZoomEnabled !== false;
    if (!zoomEnabled) {
      // Reset to full view
      mapZoomIdx = 0; mapZoomFrom = null;
    } else if (elapsed > curRegion.duration + MAP_ZOOM_TRANS_MS) {
      // advance as before
    }
```

**Step 3: Pass zoom flag from server**

In `server/gcp-metrics.js` `campaignDeliveryMap`, add to the return value:
```js
    return {
      'usa-delivery-map': {
        states:   stateActivity,
        totals:   { impressions: totalImpressions, bids: totalBids, campaigns: withTraffic },
        regions:  regions,
        hotspots: hotspots,
        zoom:     mc.zoom !== 'off',   // pass studio setting to canvas
      },
    };
```

**Step 4: Run tests, bump versions, commit**
```bash
bun test tests/unit tests/integration tests/helpers tests/components 2>&1 | tail -4
git add public/js/charts.js server/gcp-metrics.js public/index.html public/studio.html
git commit -m "feat: usa-map respects zoom:off setting from studio config"
```

---

## Task 10: PR

**Step 1: Push and create PR**
```bash
git checkout -b feat/usa-map-improvements
git push -u origin feat/usa-map-improvements
gh pr create \
  --title "feat: USA map regional zoom cycle, leaderboard scroll fix, studio config" \
  --body "Three improvements to the Campaign Delivery map:
  1. Leaderboard scroll resets when the top state changes (was drifting mid-list)
  2. Map auto-cycles: Full USA (12s) → Northeast zoom (7s) → Southeast zoom (7s) with smooth lerp transitions
  3. Studio properties panel for usa-map widgets: time window (1/7/14/30 days), min impressions threshold, impressions vs clicks metric, zoom on/off"
```

---

## Manual Verification Checklist

After restart:
- [ ] Map cycles: full USA → Northeast (NY/NJ/CT/MA are large and readable) → Southeast (FL/GA visible) → back
- [ ] Region label `◂ NORTHEAST` appears bottom-left during zoom
- [ ] Leaderboard title changes to `TOP NORTHEAST` / `TOP SOUTHEAST` during zoom
- [ ] When data refreshes mid-scroll, leaderboard jumps to top state (#1)
- [ ] Studio: select `usa-delivery-map` widget → Map Config panel appears → change time window → Save → map reloads with new data
- [ ] Setting zoom to Off: map stays full USA only
