# Mapbox GL Boundaries + Impressions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add state/county boundary lines, a delivery heatmap mode, base-style toggle (brand-dark ↔ Mapbox-dark), and a prominent animated impressions-total overlay to the `usa-map-gl` widget.

**Architecture:** County GeoJSON (~2MB) bundled locally at `public/data/us-counties.json`. State lines come from Mapbox Streets v8 vector tiles (free tier). Style switching via `map.setStyle()` + `style.load` re-add pattern. Two new `mglConfig` fields (`mapStyle`, `zoomViz`) extend the existing Studio control panel. Impressions total uses a `requestAnimationFrame` counter animation stored in `this._displayedTotal`.

**Tech Stack:** Mapbox GL JS (existing bundle), Bun, vanilla JS, existing `mglConfig` Studio pattern.

---

### Task 1: Download county GeoJSON + extend buildMapConfig defaults

**Files:**
- Download: `public/data/us-counties.json`
- Modify: `public/js/mapbox-map.js` (buildMapConfig)
- Test: `tests/unit/mapbox-map-config.test.js` (extend)

**Step 1: Download simplified US county GeoJSON**

```bash
curl -L -o /home/tech/dev-dashboards/public/data/us-counties.json \
  "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-counties-1m.json"
ls -lh /home/tech/dev-dashboards/public/data/us-counties.json
```
Expected: file present, ~2MB

**Step 2: Verify it serves correctly**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s -o /dev/null -w "%{http_code}" http://tv:3000/data/us-counties.json
```
Expected: 200

**Step 3: Write failing tests for new config fields**

Add to `tests/unit/mapbox-map-config.test.js` at the end of the file:

```js
describe('buildMapConfig() — new boundary fields', () => {
  it('defaults mapStyle to brand', () => {
    expect(buildMapConfig(undefined).mapStyle).toBe('brand');
  });

  it('defaults zoomViz to dots', () => {
    expect(buildMapConfig(undefined).zoomViz).toBe('dots');
  });

  it('accepts mapStyle: mapbox', () => {
    expect(buildMapConfig({ mapStyle: 'mapbox' }).mapStyle).toBe('mapbox');
  });

  it('accepts zoomViz: heatmap', () => {
    expect(buildMapConfig({ zoomViz: 'heatmap' }).zoomViz).toBe('heatmap');
  });
});
```

**Step 4: Run and confirm 4 new tests FAIL**
```bash
bun test tests/unit/mapbox-map-config.test.js
```
Expected: 10 pass + 4 fail

**Step 5: Add new defaults to `buildMapConfig()` in `public/js/mapbox-map.js`**

Find:
```js
  function buildMapConfig(userConfig) {
    return {
      particleCount:   120,
      particleSpeed:   1.0,
      colorScheme:     'brand',
      showLeaderboard: true,
      ...(userConfig || {}),
    };
  }
```

Replace with:
```js
  function buildMapConfig(userConfig) {
    return {
      particleCount:   120,
      particleSpeed:   1.0,
      colorScheme:     'brand',
      showLeaderboard: true,
      mapStyle:        'brand',
      zoomViz:         'dots',
      ...(userConfig || {}),
    };
  }
```

**Step 6: Run tests — all 14 must pass**
```bash
bun test tests/unit/mapbox-map-config.test.js
```
Expected: 14 pass, 0 fail

**Step 7: Commit**
```bash
git add public/data/us-counties.json public/js/mapbox-map.js tests/unit/mapbox-map-config.test.js
git commit -m "feat: add county GeoJSON + mapStyle/zoomViz defaults to buildMapConfig"
```

---

### Task 2: Boundary layers — county lines + state lines

**Files:**
- Modify: `public/js/mapbox-map.js` (`_addSources()`, `_addLayers()`)

**Context:** County lines use the local GeoJSON at `public/data/us-counties.json`. State lines use Mapbox Streets v8 vector tiles with a filter for US state-level boundaries (`admin_level: 4`). Both layers go at the bottom of the layer stack (below state fills).

**Step 1: Add 2 new sources in `_addSources()`**

At the very end of `_addSources()`, after the existing `datacenter-pulse` source, add:

```js
      // Boundary sources
      this._map.addSource('us-counties', {
        type: 'geojson',
        data: '/data/us-counties.json',
      });

      this._map.addSource('mapbox-streets', {
        type:  'vector',
        url:   'mapbox://mapbox.mapbox-streets-v8',
      });
```

**Step 2: Add 2 boundary line layers in `_addLayers()`**

Insert BEFORE `states-fill` (as the very first layers in `_addLayers()`):

```js
      // County boundary lines — subtle, beneath everything
      this._map.addLayer({
        id:     'admin-county-lines',
        type:   'line',
        source: 'us-counties',
        paint: {
          'line-color':   '#3D1A5C',
          'line-width':   0.4,
          'line-opacity': 0.5,
        },
      });

      // State boundary lines — crisp vector tiles
      this._map.addLayer({
        id:           'admin-state-lines',
        type:         'line',
        source:       'mapbox-streets',
        'source-layer': 'admin',
        filter: ['all',
          ['==', ['get', 'admin_level'], 4],
          ['==', ['get', 'disputed'],    false],
        ],
        paint: {
          'line-color':   '#6B5690',
          'line-width':   1.2,
          'line-opacity': 0.75,
        },
      });
```

**Step 3: Restart and smoke test**
```bash
sudo systemctl restart tv-dashboards && sleep 2 && sudo systemctl is-active tv-dashboards
```

Manual check: open the TV at `/` → navigate to a Campaign Delivery GL dashboard → county grid and state lines should appear over the choropleth.

**Step 4: Commit**
```bash
git add public/js/mapbox-map.js
git commit -m "feat: add county GeoJSON lines + Mapbox Streets state boundary lines to usa-map-gl"
```

---

### Task 3: Heatmap layer + zip viz toggle + style switching

**Files:**
- Modify: `public/js/mapbox-map.js`

**Context:** Three new capabilities:
1. `delivery-heatmap` layer added in `_addLayers()` — always added but hidden initially
2. `_applyZoomViz(mode)` — shows/hides heatmap vs dots layers
3. `_applyMapStyle(styleName)` — switches between brand-dark and Mapbox dark-v11

**Step 1: Add `delivery-heatmap` layer in `_addLayers()`**

After `hotspots-glow` and before `hotspots-core`, add:

```js
      // Delivery heatmap — GPU smooth heat blobs (zoomViz: heatmap mode)
      this._map.addLayer({
        id:     'delivery-heatmap',
        type:   'heatmap',
        source: 'hotspots',
        layout: { visibility: 'none' }, // hidden by default (dots mode)
        paint: {
          'heatmap-weight':    ['interpolate', ['linear'], ['get', 'ir'], 0, 0, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 3, 1, 8, 3],
          'heatmap-color':     ['interpolate', ['linear'], ['heatmap-density'],
            0,   'transparent',
            0.2, '#3D1A5C',
            0.4, '#7c3aed',
            0.7, '#FDA4D4',
            1.0, '#FFFFFF'],
          'heatmap-radius':   ['interpolate', ['linear'], ['zoom'], 3, 25, 8, 55],
          'heatmap-opacity':  0.85,
        },
      });
```

**Step 2: Add `_applyZoomViz(mode)` method**

Add after `_applyColorScheme()`:

```js
    _applyZoomViz(mode) {
      if (!this._map?.isStyleLoaded()) return;
      const isHeatmap = mode === 'heatmap';
      const vis = (show) => show ? 'visible' : 'none';

      if (this._map.getLayer('delivery-heatmap'))
        this._map.setLayoutProperty('delivery-heatmap', 'visibility', vis(isHeatmap));
      if (this._map.getLayer('hotspots-glow'))
        this._map.setLayoutProperty('hotspots-glow', 'visibility', vis(!isHeatmap));
      if (this._map.getLayer('hotspots-core'))
        this._map.setLayoutProperty('hotspots-core', 'visibility', vis(!isHeatmap));
      if (this._map.getLayer('hotspots-pulse-ring'))
        this._map.setLayoutProperty('hotspots-pulse-ring', 'visibility', vis(!isHeatmap));
    }
```

**Step 3: Add `_applyMapStyle(styleName)` method**

Add after `_applyZoomViz()`:

```js
    _applyMapStyle(styleName) {
      if (!this._map) return;
      if (this._currentStyle === styleName) return; // no-op if already set
      this._currentStyle = styleName;

      const newStyle = styleName === 'mapbox'
        ? 'mapbox://styles/mapbox/dark-v11'
        : this._blankStyle();

      this._map.setStyle(newStyle);

      // Re-add all custom sources and layers after style reloads
      this._map.once('style.load', () => {
        this._addSources();
        this._addLayers();
        if (this._data) {
          // Restore data into newly-created sources
          this._applyData(this._data);
        }
        // For Mapbox style: hide road/label clutter
        if (styleName === 'mapbox') {
          const hide = ['road-street', 'road-minor', 'road-primary', 'road-secondary',
            'road-motorway', 'poi-label', 'place-label', 'country-label', 'state-label'];
          hide.forEach(id => {
            if (this._map.getLayer(id))
              this._map.setLayoutProperty(id, 'visibility', 'none');
          });
        }
      });
    }
```

**Step 4: Initialize `this._currentStyle` in constructor**

Add after `this._pulseId = null;`:
```js
      this._currentStyle = 'brand';
```

**Step 5: Wire both into `_applyData()`**

In `_applyData()`, after `this._applyColorScheme(this._cfg.colorScheme);`, add:

```js
      this._applyZoomViz(this._cfg.zoomViz);
      if (this._cfg.mapStyle !== this._currentStyle) {
        this._applyMapStyle(this._cfg.mapStyle);
      }
```

**Step 6: Restart and test**
```bash
sudo systemctl restart tv-dashboards && sleep 2 && sudo systemctl is-active tv-dashboards
```

**Step 7: Commit**
```bash
git add public/js/mapbox-map.js
git commit -m "feat: delivery heatmap layer + zoomViz toggle + mapStyle brand/mapbox switching"
```

---

### Task 4: Impressions total overlay + animated counter

**Files:**
- Modify: `public/js/mapbox-map.js`
- Modify: `public/css/mapbox-map.css`

**Step 1: Add CSS for total overlay to `public/css/mapbox-map.css`**

At the end of the file, add:

```css
/* ── Impressions total overlay (bottom-left) ── */
.mgl-total-overlay {
  position:  absolute;
  bottom:    16px;
  left:      16px;
  display:   flex;
  flex-direction: column;
  gap:       2px;
  pointer-events: none;
}

.mgl-total-label {
  font-size:      9px;
  font-weight:    700;
  color:          rgba(253,164,212,0.7);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.mgl-total-value {
  font-size:   34px;
  font-weight: 800;
  color:       #FFFFFF;
  line-height: 1;
  text-shadow: 0 0 20px rgba(253,164,212,0.5), 0 0 40px rgba(124,58,237,0.4);
  font-variant-numeric: tabular-nums;
}

.mgl-total-sub {
  font-size: 10px;
  color:     rgba(184,168,208,0.6);
}
```

Also update `.mgl-lb-totals` to be a header (move styling up):
```css
/* Override lb-totals to be a header above the list */
.mgl-lb-header-total {
  font-size:      11px;
  font-weight:    700;
  color:          rgba(253,164,212,0.8);
  text-align:     center;
  padding:        0 4px 6px;
  border-bottom:  1px solid rgba(253,164,212,0.2);
  flex-shrink:    0;
  text-shadow:    0 0 8px rgba(253,164,212,0.3);
}
```

**Step 2: Build the total overlay DOM in `_buildLeaderboardDOM()`**

In `_buildLeaderboardDOM()`, after `this._wrap.appendChild(lb);`, add:

```js
      // Bottom-left impressions total overlay
      const overlay = document.createElement('div');
      overlay.className = 'mgl-total-overlay';

      const lbl = document.createElement('div');
      lbl.className  = 'mgl-total-label';
      lbl.textContent = '\u2B23 LIVE DELIVERY';

      this._totalValueEl = document.createElement('div');
      this._totalValueEl.className  = 'mgl-total-value';
      this._totalValueEl.textContent = '—';

      const sub = document.createElement('div');
      sub.className  = 'mgl-total-sub';
      sub.textContent = 'impressions right now';

      overlay.appendChild(lbl);
      overlay.appendChild(this._totalValueEl);
      overlay.appendChild(sub);
      this._wrap.appendChild(overlay);
      this._displayedTotal = 0;
```

Also add `this._totalValueEl = null;` and `this._displayedTotal = 0;` to the constructor initializations.

**Step 3: Add `_animateTotal(targetTotal)` method**

Add after `_renderLeaderboard()`:

```js
    _animateTotal(targetTotal) {
      if (!this._totalValueEl) return;
      const start    = this._displayedTotal;
      const end      = targetTotal;
      const duration = 800;
      const t0       = performance.now();

      const fmt = (n) =>
        n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' :
        n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' :
        n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(Math.round(n));

      const tick = (now) => {
        const elapsed = now - t0;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (end - start) * eased);
        if (this._totalValueEl) this._totalValueEl.textContent = fmt(current);
        if (progress < 1) requestAnimationFrame(tick);
        else this._displayedTotal = end;
      };
      requestAnimationFrame(tick);
    }
```

**Step 4: Add header total to leaderboard DOM**

In `_buildLeaderboardDOM()`, before the existing `title` element is appended to `lb`, add:

```js
      // Header total (above title)
      this._lbHeaderTotal = document.createElement('div');
      this._lbHeaderTotal.className  = 'mgl-lb-header-total';
      this._lbHeaderTotal.textContent = '—';
      lb.appendChild(this._lbHeaderTotal);
```

Add `this._lbHeaderTotal = null;` to constructor initializations.

**Step 5: Call `_animateTotal` and update header total in `_renderLeaderboard()`**

At the end of `_renderLeaderboard(states, maxImp, totals)`, replace the existing `_lbTotals` block with:

```js
      const imp = (totals && totals.impressions) ? totals.impressions : 0;

      // Animate the bottom-left overlay
      this._animateTotal(imp);

      // Update leaderboard header total
      if (this._lbHeaderTotal) {
        const fmt = (n) =>
          n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' :
          n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' :
          n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(Math.round(n));
        this._lbHeaderTotal.textContent = fmt(imp) + ' total impressions';
      }
```

Remove the old `mgl-lb-totals` references (the old footer text at the bottom of the leaderboard). The `this._lbTotals` element can be removed from `_buildLeaderboardDOM()` too since it's replaced by the header total.

**Step 6: Restart and verify**
```bash
sudo systemctl restart tv-dashboards && sleep 2 && sudo systemctl is-active tv-dashboards
```

**Step 7: Commit**
```bash
git add public/js/mapbox-map.js public/css/mapbox-map.css
git commit -m "feat: impressions total overlay with animated counter + leaderboard header total"
```

---

### Task 5: Studio controls + integration check

**Files:**
- Modify: `public/studio.html` (add 2 selects to `#mgl-config-section`)
- Modify: `public/js/studio.js` (populate + bind)

**Step 1: Add 2 new selects to `#mgl-config-section` in `public/studio.html`**

Find `#mgl-config-section`. After the `prop-mgl-leaderboard` label/select block (the last existing one), add:

```html
              <label>Base Style
                <select id="prop-mgl-mapstyle">
                  <option value="brand" selected>Brand Dark</option>
                  <option value="mapbox">Mapbox Dark</option>
                </select>
              </label>
              <label>Zip Visualization
                <select id="prop-mgl-zoomviz">
                  <option value="dots" selected>Dots</option>
                  <option value="heatmap">Heatmap</option>
                </select>
              </label>
```

**Step 2: Populate in `showWidgetProps()` in `public/js/studio.js`**

Find the `if (wc.type === 'usa-map-gl')` block in `showWidgetProps()`. Add 2 more `set()` calls:

```js
          set('prop-mgl-mapstyle', mgl.mapStyle || 'brand');
          set('prop-mgl-zoomviz',  mgl.zoomViz  || 'dots');
```

**Step 3: Bind in `bindWidgetPropListeners()` in `public/js/studio.js`**

After the existing `prop-mgl-leaderboard` bind call, add:

```js
      bind('prop-mgl-mapstyle', (v) => { wc.mglConfig = { ...(wc.mglConfig || {}), mapStyle: v }; });
      bind('prop-mgl-zoomviz',  (v) => { wc.mglConfig = { ...(wc.mglConfig || {}), zoomViz: v }; });
```

**Step 4: Run full test suite**
```bash
git restore config/ && bun test 2>&1 | tail -5
```
Expected: all new tests pass (14 config tests), 0 new regressions

**Step 5: Verify Studio controls**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s http://tv:3000/admin | grep -c 'mgl-mapstyle\|mgl-zoomviz'
```
Expected: 2

**Step 6: Verify county file serves**
```bash
curl -s -o /dev/null -w "%{http_code}" http://tv:3000/data/us-counties.json
```
Expected: 200

**Step 7: Commit**
```bash
git add public/studio.html public/js/studio.js
git commit -m "feat: add Base Style + Zip Visualization controls to Studio mglConfig panel"
```

---

### Task 6: Final integration check

**Step 1: Run all Mapbox tests**
```bash
bun test tests/unit/routes/mapbox-token.test.js tests/unit/mapbox-map-utils.test.js tests/unit/mapbox-map-config.test.js
```
Expected: 3 + 22 + 14 = 39 pass, 0 fail

**Step 2: Verify assets**
```bash
for f in /data/us-counties.json /js/mapbox-map.js /css/mapbox-map.css; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://tv:3000$f)
  printf "%s → %s\n" "$f" "$code"
done
```
Expected: all 200

**Step 3: Manual TV test checklist**

Open `/` → navigate to `campaign-delivery-gl`:
- County lines (thin purple grid) visible beneath choropleth
- State lines (brighter purple) crisp at all map sizes
- Bottom-left shows animated "142.3M" number (or "—" if no data yet)
- Leaderboard header shows total above "TOP MARKETS"

Open Studio `/admin` → click a `usa-map-gl` widget → Map GL Config:
- "Base Style" selector shows Brand Dark / Mapbox Dark
- "Zip Visualization" selector shows Dots / Heatmap
- Switch to Heatmap → smooth glowing blobs replace dots
- Switch to Mapbox Dark → base style changes to Mapbox geographic context

**Step 4: Git log**
```bash
git log --oneline -7
```
Expected commits:
- `feat: add Base Style + Zip Visualization controls to Studio mglConfig panel`
- `feat: impressions total overlay with animated counter + leaderboard header total`
- `feat: delivery heatmap layer + zoomViz toggle + mapStyle switching`
- `feat: add county GeoJSON lines + Mapbox Streets state boundary lines`
- `feat: add county GeoJSON + mapStyle/zoomViz defaults to buildMapConfig`
