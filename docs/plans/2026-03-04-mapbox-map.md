# Mapbox GL USA Map Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a new `usa-map-gl` widget type that renders the Campaign Delivery map using Mapbox GL JS (WebGL/GPU) with a blank MadHive brand style, preserving the existing `usa-map` Canvas 2D widget untouched.

**Architecture:** Mapbox GL JS is bundled locally (no CDN at runtime). A `MapboxUSAMap` class in `public/js/mapbox-map.js` manages 10 GL layers fed from the same server data shape as the existing widget. Arc particles animate via `requestAnimationFrame` + `source.setData()` — the standard Mapbox pattern. The Mapbox access token is served via `GET /api/config/mapbox-token` from `process.env.MAPBOX_ACCESS_TOKEN`. `usa-map` (Canvas 2D) remains untouched.

**Tech Stack:** Mapbox GL JS v3.2.0 (bundled locally), Bun, Elysia.js, vanilla JS, `window.US_STATES` GeoJSON (already loaded).

---

### Task 1: Bundle Mapbox GL JS locally + token API + load in HTML pages

**Files:**
- Download: `public/js/mapbox-gl.min.js`
- Download: `public/css/mapbox-gl.css`
- Modify: `server/index.js` (add token route)
- Modify: `public/index.html` (add script/link tags)
- Modify: `public/studio.html` (add script/link tags)
- Modify: `public/import.html` (add script/link tags)

**Step 1: Download Mapbox GL JS bundle and CSS locally**

```bash
curl -L -o /home/tech/dev-dashboards/public/js/mapbox-gl.min.js \
  https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.js

curl -L -o /home/tech/dev-dashboards/public/css/mapbox-gl.css \
  https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.css
```

Verify:
```bash
ls -lh public/js/mapbox-gl.min.js public/css/mapbox-gl.css
```
Expected: both files present, mapbox-gl.min.js ~800KB, CSS ~100KB

**Step 2: Add token API endpoint to `server/index.js`**

Find the `GET /api/config/mapbox-token` location (after the health route or config routes). Add:

```js
  .get('/api/config/mapbox-token', () => ({
    token: process.env.MAPBOX_ACCESS_TOKEN || ''
  }), {
    detail: { tags: ['health'], summary: 'Mapbox GL access token for client-side map rendering' }
  })
```

**Step 3: Add Mapbox GL assets to `public/index.html`**

Read the file. In `<head>`, add after the existing CSS links:
```html
  <link rel="stylesheet" href="/css/mapbox-gl.css">
  <link rel="stylesheet" href="/css/mapbox-map.css?v=1">
```

Near the bottom before `</body>`, add before the existing JS scripts:
```html
  <script src="/js/mapbox-gl.min.js"></script>
  <script src="/js/mapbox-map.js?v=1"></script>
```

**Step 4: Add same assets to `public/studio.html`**

In `<head>`, add after existing CSS links:
```html
  <link rel="stylesheet" href="/css/mapbox-gl.css">
  <link rel="stylesheet" href="/css/mapbox-map.css?v=1">
```

Before `</body>`, add after `widgets.js` and before `studio-canvas.js`:
```html
  <script src="/js/mapbox-gl.min.js"></script>
  <script src="/js/mapbox-map.js?v=1"></script>
```

**Step 5: Add same assets to `public/import.html`**

Same pattern — add CSS link in `<head>`, add scripts before `</body>` after `widgets.js`.

**Step 6: Restart and verify token endpoint**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s http://tv:3000/api/config/mapbox-token | python3 -c "import sys,json; d=json.load(sys.stdin); print('token present:', bool(d.get('token')))"
```
Expected: `token present: True`

**Step 7: Commit**
```bash
git add public/js/mapbox-gl.min.js public/css/mapbox-gl.css public/index.html public/studio.html public/import.html server/index.js
git commit -m "feat: bundle Mapbox GL JS locally + token API endpoint + load in HTML pages"
```

---

### Task 2: `public/css/mapbox-map.css` — container + leaderboard styles

**Files:**
- Create: `public/css/mapbox-map.css`

**Step 1: Create the file**

```css
/* ===========================================================================
   Mapbox GL USA Map — usa-map-gl widget styles
   =========================================================================== */

/* Map container must be position:relative for overlay positioning */
.mgl-container {
  position: relative;
  width:    100%;
  height:   100%;
  overflow: hidden;
}

/* The Mapbox canvas fills the container */
.mgl-container .mapboxgl-canvas {
  display: block;
}

/* Hide Mapbox logo and attribution for TV display */
.mgl-container .mapboxgl-ctrl-logo,
.mgl-container .mapboxgl-ctrl-attrib {
  display: none !important;
}

/* Leaderboard — right-side HTML overlay */
.mgl-leaderboard {
  position:   absolute;
  top:        12px;
  right:      12px;
  bottom:     12px;
  width:      260px;
  display:    flex;
  flex-direction: column;
  gap:        6px;
  pointer-events: none;
  overflow:   hidden;
}

.mgl-lb-title {
  font-size:      11px;
  font-weight:    700;
  color:          rgba(253,164,212,0.7);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding:        0 4px 4px;
  border-bottom:  1px solid rgba(253,164,212,0.15);
  flex-shrink:    0;
}

.mgl-lb-rows {
  flex:       1;
  overflow:   hidden;
  position:   relative;
}

.mgl-lb-scroll {
  position: absolute;
  width:    100%;
  top:      0;
  transition: transform 0.5s ease;
}

.mgl-lb-row {
  display:     flex;
  align-items: center;
  gap:         8px;
  padding:     5px 4px;
  border-bottom: 1px solid rgba(107,86,144,0.15);
}

.mgl-lb-rank {
  font-size:   10px;
  font-weight: 700;
  color:       rgba(253,164,212,0.5);
  width:       18px;
  flex-shrink: 0;
  text-align:  right;
}

.mgl-lb-state {
  font-size:   11px;
  font-weight: 700;
  color:       #F3F2EB;
  width:       22px;
  flex-shrink: 0;
}

.mgl-lb-bar-wrap {
  flex: 1;
  height: 4px;
  background: rgba(107,86,144,0.2);
  border-radius: 2px;
  overflow: hidden;
}

.mgl-lb-bar {
  height:        100%;
  border-radius: 2px;
  background:    linear-gradient(90deg, #7c3aed, #FDA4D4);
  transition:    width 0.8s ease;
}

.mgl-lb-val {
  font-size:   9px;
  color:       rgba(184,168,208,0.7);
  width:       36px;
  text-align:  right;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* Totals banner at bottom */
.mgl-lb-totals {
  font-size:  10px;
  color:      rgba(184,168,208,0.6);
  text-align: center;
  padding-top: 4px;
  border-top:  1px solid rgba(107,86,144,0.2);
  flex-shrink: 0;
}
```

**Step 2: Verify it loads**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s -o /dev/null -w "%{http_code}" http://tv:3000/css/mapbox-map.css
```
Expected: 200

**Step 3: Commit**
```bash
git add public/css/mapbox-map.css
git commit -m "feat: mapbox-map.css — container and leaderboard overlay styles"
```

---

### Task 3: `public/js/mapbox-map.js` — MapboxUSAMap class

**Files:**
- Create: `public/js/mapbox-map.js`

**Step 1: Create the file**

```js
/* ===========================================================================
   MapboxUSAMap — GPU-accelerated USA delivery map via Mapbox GL JS
   Widget type: usa-map-gl
   Data shape: identical to usa-map — { states, hotspots, totals, regions, region }
   =========================================================================== */

window.MapboxUSAMap = (function () {
  'use strict';

  // GCP data center locations (same as charts.js)
  var DATA_CENTERS = [
    { id: 'us-west1',    label: 'WEST',    lon: -121.2, lat: 45.6 },
    { id: 'us-central1', label: 'CENTRAL', lon: -95.9,  lat: 41.3 },
    { id: 'us-east4',    label: 'EAST',    lon: -77.5,  lat: 39.0 },
  ];

  // Regional bounding boxes [sw, ne] in [lon, lat]
  var REGION_BOUNDS = {
    northeast: [[-81, 36], [-66, 48]],
    southeast: [[-89, 24], [-75, 37]],
  };
  var USA_BOUNDS = [[-125, 24], [-66, 50]];

  // MadHive brand choropleth stops (intensity 0→1)
  var CHOROPLETH = [
    'interpolate', ['linear'], ['get', 'intensity'],
    0,    '#1a0840',
    0.15, '#3D1A5C',
    0.35, '#5b2a8f',
    0.60, '#7c3aed',
    0.85, '#b87aff',
    1.0,  '#FDA4D4',
  ];

  class MapboxUSAMap {
    constructor(container, config) {
      this._container  = container;
      this._config     = config || {};
      this._map        = null;
      this._data       = null;
      this._particles  = [];
      this._animId     = null;
      this._lbScroll   = 0;
      this._lbDir      = 1;

      this._wrap = document.createElement('div');
      this._wrap.className = 'mgl-container';
      container.appendChild(this._wrap);

      this._buildLeaderboardDOM();
      this._initMap();
    }

    // ── Initialisation ────────────────────────────────────────────────────────

    async _initMap() {
      try {
        const res   = await fetch('/api/config/mapbox-token');
        const data  = await res.json();
        const token = data.token;
        if (!token) { console.error('[MapboxUSAMap] No access token'); return; }

        mapboxgl.accessToken = token;

        this._map = new mapboxgl.Map({
          container:         this._wrap,
          style:             this._blankStyle(),
          bounds:            USA_BOUNDS,
          fitBoundsOptions:  { padding: 20 },
          interactive:       false,
          attributionControl: false,
          logoPosition:      'bottom-left',
        });

        this._map.on('load', () => {
          this._addSources();
          this._addLayers();
          if (this._data) this._applyData(this._data);
        });
      } catch (err) {
        console.error('[MapboxUSAMap] init failed:', err);
      }
    }

    _blankStyle() {
      return {
        version: 8,
        sources: {},
        layers:  [{ id: 'background', type: 'background', paint: { 'background-color': '#0E0320' } }],
      };
    }

    // ── Sources ───────────────────────────────────────────────────────────────

    _addSources() {
      const US = window.US_STATES;
      if (!US) return;

      // US state polygons — path is already [[lon,lat],...]
      const stateFeatures = US.states.map(s => ({
        type: 'Feature',
        id:   s.id,
        properties: { id: s.id, intensity: 0, impressions: 0 },
        geometry:   { type: 'Polygon', coordinates: [s.path] },
      }));

      this._map.addSource('us-states', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: stateFeatures },
      });

      this._map.addSource('hotspots',      { type: 'geojson', data: this._empty() });
      this._map.addSource('arc-corridors', { type: 'geojson', data: this._empty() });
      this._map.addSource('arc-particles', { type: 'geojson', data: this._empty() });

      this._map.addSource('datacenters', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: DATA_CENTERS.map(dc => ({
            type: 'Feature',
            properties: { label: dc.label },
            geometry: { type: 'Point', coordinates: [dc.lon, dc.lat] },
          })),
        },
      });
    }

    _empty() { return { type: 'FeatureCollection', features: [] }; }

    // ── Layers ────────────────────────────────────────────────────────────────

    _addLayers() {
      // 1. State fills — data-driven choropleth
      this._map.addLayer({
        id: 'states-fill', type: 'fill', source: 'us-states',
        paint: {
          'fill-color':   CHOROPLETH,
          'fill-opacity': 0.85,
          'fill-color-transition': { duration: 800 },
        },
      });

      // 2. State outlines
      this._map.addLayer({
        id: 'states-outline', type: 'line', source: 'us-states',
        paint: { 'line-color': '#6B5690', 'line-width': 0.8, 'line-opacity': 0.45 },
      });

      // 3. Persistent arc corridors (dim bezier routes)
      this._map.addLayer({
        id: 'arc-corridors', type: 'line', source: 'arc-corridors',
        paint: {
          'line-color':   '#67E8F9',
          'line-width':   ['get', 'lw'],
          'line-opacity': ['get', 'lo'],
        },
      });

      // 4. Arc particle dots
      this._map.addLayer({
        id: 'arc-particles', type: 'circle', source: 'arc-particles',
        paint: {
          'circle-radius':  ['get', 'sz'],
          'circle-color':   ['case', ['==', ['get', 'pt'], 'fast'], '#FDA4D4', '#67E8F9'],
          'circle-opacity': 0.9,
          'circle-blur':    0.2,
        },
      });

      // 5. Hotspot glow (large soft circles)
      this._map.addLayer({
        id: 'hotspots-glow', type: 'circle', source: 'hotspots',
        paint: {
          'circle-radius':  ['interpolate', ['linear'], ['get', 'ir'], 0, 8,  1, 40],
          'circle-color':   ['case', ['>', ['get', 'ir'], 0.4], '#FDA4D4', '#67E8F9'],
          'circle-opacity': ['interpolate', ['linear'], ['get', 'ir'], 0, 0.06, 1, 0.22],
          'circle-blur':    1.0,
        },
      });

      // 6. Hotspot core dots
      this._map.addLayer({
        id: 'hotspots-core', type: 'circle', source: 'hotspots',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'ir'], 0, 3, 1, 14],
          'circle-color':  [
            'interpolate', ['linear'], ['get', 'ir'],
            0,    '#67E8F9',
            0.40, '#FDA4D4',
            0.85, '#FFFFFF',
          ],
          'circle-opacity': ['interpolate', ['linear'], ['get', 'ir'], 0, 0.55, 1, 0.95],
        },
      });

      // 7. Data center markers
      this._map.addLayer({
        id: 'datacenter-marks', type: 'circle', source: 'datacenters',
        paint: {
          'circle-radius':       7,
          'circle-color':        '#FFFFFF',
          'circle-opacity':      0.92,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#67E8F9',
        },
      });
    }

    // ── Data update ───────────────────────────────────────────────────────────

    update(data) {
      this._data = data;
      if (this._map && this._map.isStyleLoaded()) this._applyData(data);
    }

    _applyData(data) {
      const US      = window.US_STATES;
      const states  = data.states  || {};
      const hotspots = (data.hotspots || []);
      const maxImp  = Object.values(states).reduce((m, s) => Math.max(m, s.impressions || 0), 1);
      const maxHot  = hotspots.length ? (hotspots[0].impressions || 1) : 1;

      // Update state choropleth
      if (US) {
        const stateFeatures = US.states.map(s => {
          const st = states[s.id] || { impressions: 0 };
          return {
            type: 'Feature', id: s.id,
            properties: { id: s.id, intensity: st.impressions / maxImp, impressions: st.impressions },
            geometry:   { type: 'Polygon', coordinates: [s.path] },
          };
        });
        this._map.getSource('us-states')?.setData({ type: 'FeatureCollection', features: stateFeatures });
      }

      // Update hotspot dots
      const hotFeatures = hotspots
        .filter(h => h.lat && h.lon)
        .map(h => ({
          type: 'Feature',
          properties: { ir: (h.impressions || 0) / maxHot },
          geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
        }));
      this._map.getSource('hotspots')?.setData({ type: 'FeatureCollection', features: hotFeatures });

      // Update arc corridors
      this._buildCorridors(hotspots.slice(0, 30), maxHot);

      // Init particles and start loop
      this._initParticles(hotspots.slice(0, 50));
      if (!this._animId) this._startAnimation();

      // Regional bounds
      const bounds = REGION_BOUNDS[data.region] || USA_BOUNDS;
      this._map.fitBounds(bounds, { padding: 20, duration: 800 });

      // Leaderboard
      this._renderLeaderboard(states, maxImp, data.totals);
    }

    // ── Arc corridors ─────────────────────────────────────────────────────────

    _buildCorridors(hotspots, maxHot) {
      const features = [];
      hotspots.forEach(hs => {
        if (!hs.lat || !hs.lon) return;
        const dc = DATA_CENTERS.reduce((nearest, d) => {
          const dist = Math.hypot(hs.lon - d.lon, hs.lat - d.lat);
          return dist < Math.hypot(hs.lon - nearest.lon, hs.lat - nearest.lat) ? d : nearest;
        });
        const mx  = (dc.lon + hs.lon) / 2;
        const my  = (dc.lat + hs.lat) / 2 + Math.abs(dc.lat - hs.lat) * 0.3 + 2;
        const pts = [];
        for (let t = 0; t <= 1; t += 0.05) {
          const it = 1 - t;
          pts.push([
            it * it * dc.lon  + 2 * it * t * mx  + t * t * hs.lon,
            it * it * dc.lat  + 2 * it * t * my  + t * t * hs.lat,
          ]);
        }
        const ir = Math.sqrt((hs.impressions || 0) / maxHot);
        features.push({
          type: 'Feature',
          properties: { lw: 0.5 + ir * 1.5, lo: 0.04 + ir * 0.12 },
          geometry: { type: 'LineString', coordinates: pts },
        });
      });
      this._map.getSource('arc-corridors')?.setData({ type: 'FeatureCollection', features });
    }

    // ── Particle animation ────────────────────────────────────────────────────

    _initParticles(hotspots) {
      const targets = hotspots.length ? hotspots : [{ lon: -98, lat: 39 }];
      this._particles = Array.from({ length: 120 }, () => {
        const dc  = DATA_CENTERS[Math.floor(Math.random() * DATA_CENTERS.length)];
        const tgt = targets[Math.floor(Math.random() * targets.length)];
        return {
          t:     Math.random(),
          speed: 0.003 + Math.random() * 0.006,
          dc, tgt,
          pt:    Math.random() > 0.7 ? 'fast' : 'normal',
          sz:    1.5 + Math.random() * 2,
        };
      });
    }

    _startAnimation() {
      const tick = () => {
        // Visibility-aware throttle: 30fps visible, 2fps hidden
        const isVisible = !!this._wrap?.closest?.('.dashboard-page.active');
        const delay = isVisible ? 16 : 500;

        if (this._map?.getSource('arc-particles')) {
          const features = this._particles.map(p => {
            p.t += p.speed * (p.pt === 'fast' ? 1.5 : 1);
            if (p.t > 1) {
              p.t = 0;
              // Reassign to a new random target
              const targets = this._data?.hotspots || [];
              if (targets.length) {
                p.tgt = targets[Math.floor(Math.random() * Math.min(50, targets.length))];
              }
            }
            const { dc, tgt, t, sz, pt } = p;
            const mx  = (dc.lon + tgt.lon) / 2;
            const my  = (dc.lat + tgt.lat) / 2 + Math.abs(dc.lat - tgt.lat) * 0.3 + 2;
            const it  = 1 - t;
            const lon = it * it * dc.lon + 2 * it * t * mx + t * t * tgt.lon;
            const lat = it * it * dc.lat + 2 * it * t * my + t * t * tgt.lat;
            return {
              type: 'Feature',
              properties: { pt, sz },
              geometry: { type: 'Point', coordinates: [lon, lat] },
            };
          });

          this._map.getSource('arc-particles').setData({
            type: 'FeatureCollection', features,
          });
        }

        setTimeout(() => {
          this._animId = requestAnimationFrame(tick);
        }, delay);
      };

      this._animId = requestAnimationFrame(tick);
    }

    // ── Leaderboard ───────────────────────────────────────────────────────────

    _buildLeaderboardDOM() {
      const lb = document.createElement('div');
      lb.className = 'mgl-leaderboard';

      const title = document.createElement('div');
      title.className = 'mgl-lb-title';
      title.textContent = 'TOP MARKETS';

      const rowsWrap = document.createElement('div');
      rowsWrap.className = 'mgl-lb-rows';

      this._lbScrollEl = document.createElement('div');
      this._lbScrollEl.className = 'mgl-lb-scroll';
      rowsWrap.appendChild(this._lbScrollEl);

      this._lbTotals = document.createElement('div');
      this._lbTotals.className = 'mgl-lb-totals';

      lb.appendChild(title);
      lb.appendChild(rowsWrap);
      lb.appendChild(this._lbTotals);
      this._wrap.appendChild(lb);
      this._lbEl = lb;
    }

    _renderLeaderboard(states, maxImp, totals) {
      if (!this._lbScrollEl) return;

      const sorted = Object.entries(states)
        .filter(([, s]) => s.impressions > 0)
        .sort(([, a], [, b]) => b.impressions - a.impressions)
        .slice(0, 20);

      this._lbScrollEl.textContent = '';

      sorted.forEach(([id, s], i) => {
        const row = document.createElement('div');
        row.className = 'mgl-lb-row';

        const rank = document.createElement('span');
        rank.className = 'mgl-lb-rank';
        rank.textContent = i + 1;

        const state = document.createElement('span');
        state.className = 'mgl-lb-state';
        state.textContent = id;

        const barWrap = document.createElement('div');
        barWrap.className = 'mgl-lb-bar-wrap';
        const bar = document.createElement('div');
        bar.className = 'mgl-lb-bar';
        bar.style.width = Math.round((s.impressions / maxImp) * 100) + '%';
        barWrap.appendChild(bar);

        const val = document.createElement('span');
        val.className = 'mgl-lb-val';
        const n = s.impressions;
        val.textContent = n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(n);

        row.appendChild(rank);
        row.appendChild(state);
        row.appendChild(barWrap);
        row.appendChild(val);
        this._lbScrollEl.appendChild(row);
      });

      if (totals && this._lbTotals) {
        const imp = totals.impressions || 0;
        const fmt = imp >= 1e9 ? (imp / 1e9).toFixed(1) + 'B' : imp >= 1e6 ? (imp / 1e6).toFixed(1) + 'M' : (imp / 1e3).toFixed(0) + 'K';
        this._lbTotals.textContent = fmt + ' total impressions';
      }
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    destroy() {
      if (this._animId) cancelAnimationFrame(this._animId);
      this._animId = null;
      if (this._map) { this._map.remove(); this._map = null; }
    }
  }

  // Factory function matching widgets.js pattern
  function mapboxUsaMap(container, config) {
    const instance = new MapboxUSAMap(container, config);
    return {
      update:  (data) => instance.update(data),
      destroy: ()     => instance.destroy(),
    };
  }

  return { MapboxUSAMap, mapboxUsaMap };
})();
```

**Step 2: Restart and verify**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s -o /dev/null -w "%{http_code}" http://tv:3000/js/mapbox-map.js
```
Expected: 200

**Step 3: Commit**
```bash
git add public/js/mapbox-map.js
git commit -m "feat: MapboxUSAMap class — GPU-accelerated usa-map-gl widget with 7 GL layers + RAF particles"
```

---

### Task 4: Register `usa-map-gl` in widgets.js + Studio palette + prop-type selector

**Files:**
- Modify: `public/js/widgets.js`
- Modify: `public/js/studio.js` (TYPES array in openWidgetPalette)
- Modify: `public/studio.html` (#prop-type select)

**Step 1: Add `usa-map-gl` case to `public/js/widgets.js`**

Read the file. Find the factory `switch` (around line 672). After `case 'usa-map':`, add:

```js
      case 'usa-map-gl':
        if (window.MapboxUSAMap) return window.MapboxUSAMap.mapboxUsaMap(container, config);
        return usaMapWidget(container, config); // fallback to Canvas 2D if GL not loaded
```

**Step 2: Add `usa-map-gl` to Studio TYPES array in `public/js/studio.js`**

Find `openWidgetPalette()` TYPES array. After the `usa-map` entry, add:
```js
        { type: 'usa-map-gl', icon: '\uD83D\uDDFA', name: 'USA Map (GL)' },
```

**Step 3: Add `usa-map-gl` to `#prop-type` in `public/studio.html`**

Find `#prop-type` select. After the `usa-map` option, add:
```html
                  <option value="usa-map-gl">USA Map (GL)</option>
```

**Step 4: Restart and verify**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s http://tv:3000/admin | grep -c 'usa-map-gl'
```
Expected: at least 2 (palette + prop-type)

**Step 5: Commit**
```bash
git add public/js/widgets.js public/js/studio.js public/studio.html
git commit -m "feat: register usa-map-gl in widgets factory, Studio palette, and type selector"
```

---

### Task 5: Final integration check

**Step 1: Run full test suite**
```bash
git restore config/ && bun test 2>&1 | tail -5
```
Expected: existing tests pass, 0 regressions

**Step 2: Verify token endpoint**
```bash
curl -s http://tv:3000/api/config/mapbox-token | python3 -c "import sys,json; d=json.load(sys.stdin); print('token ok:', len(d.get('token',''))>10)"
```
Expected: `token ok: True`

**Step 3: Verify all assets load**
```bash
for f in /js/mapbox-gl.min.js /js/mapbox-map.js /css/mapbox-gl.css /css/mapbox-map.css; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://tv:3000$f)
  echo "$f → $code"
done
```
Expected: all 200

**Step 4: Manually test in Studio**
1. Open `/admin` → select any dashboard → click `+ Add Widget`
2. Select type "USA Map (GL)" → Source: computed or mock → Add to Dashboard
3. In the canvas, the widget should show "Loading…" then render the Mapbox GL map
4. In widget properties panel → Type selector → `usa-map-gl` is present

**Step 5: Manually test with live data**

Go to the TV display at `/` → navigate to a Campaign Delivery dashboard → the `usa-map` widget uses Canvas 2D (unchanged). In Studio, switch that widget's type to `usa-map-gl` → the GL version renders with the same data.

**Step 6: Check git log**
```bash
git log --oneline -6
```
Expected:
- `feat: register usa-map-gl in widgets factory, Studio palette, and type selector`
- `feat: MapboxUSAMap class — GPU-accelerated usa-map-gl widget`
- `feat: mapbox-map.css — container and leaderboard overlay styles`
- `feat: bundle Mapbox GL JS locally + token API endpoint + load in HTML pages`
