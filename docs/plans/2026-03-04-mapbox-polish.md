# Mapbox GL Map Polish + Studio Controls Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add visual polish (glow layers, animated pulse rings, particle glow, state bloom, leaderboard fade) and Studio properties panel controls (color scheme, particle count/speed, leaderboard toggle) to the `usa-map-gl` widget.

**Architecture:** Two-phase: (1) pure config functions extracted and TDD-tested, then integrated into `MapboxUSAMap`; (2) new Mapbox GL layers added via `_addLayers()` + `_startPulse()` `setInterval`; (3) new `#mgl-config-section` in Studio properties panel reads/writes `wc.mglConfig` object, `mapbox-map.js` applies settings to layers via `setPaintProperty()`. No server changes.

**Tech Stack:** Mapbox GL JS (existing bundle), vanilla JS, Bun TDD.

---

### Task 1: Config logic TDD — `buildMapConfig` + color schemes

**Files:**
- Test: `tests/unit/mapbox-map-config.test.js`
- Modify: `public/js/mapbox-map.js` (add config constants + wire into constructor)

**Step 1: Write failing tests**

Create `tests/unit/mapbox-map-config.test.js`:

```js
// ===========================================================================
// MapboxUSAMap config logic tests — TDD
// Pure functions mirrored from mapbox-map.js for isolated testing.
// ===========================================================================

import { describe, it, expect } from 'bun:test';

// ── Mirror of mapbox-map.js config logic ────────────────────────────────────

function buildMapConfig(userConfig) {
  return {
    particleCount:   120,
    particleSpeed:   1.0,
    colorScheme:     'brand',
    showLeaderboard: true,
    ...(userConfig || {}),
  };
}

const SCHEME_COLORS = {
  brand: { particleNormal: '#67E8F9', particleFast: '#FDA4D4', stateGlowHigh: '#FDA4D4' },
  cool:  { particleNormal: '#60A5FA', particleFast: '#FFFFFF', stateGlowHigh: '#e0f2fe' },
  warm:  { particleNormal: '#fbbf24', particleFast: '#FF6B35', stateGlowHigh: '#fef08a' },
};

function getColorScheme(name) {
  return SCHEME_COLORS[name] || SCHEME_COLORS.brand;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('buildMapConfig()', () => {
  it('returns all defaults when nothing provided', () => {
    const cfg = buildMapConfig(undefined);
    expect(cfg.particleCount).toBe(120);
    expect(cfg.particleSpeed).toBe(1.0);
    expect(cfg.colorScheme).toBe('brand');
    expect(cfg.showLeaderboard).toBe(true);
  });

  it('merges user values over defaults', () => {
    const cfg = buildMapConfig({ particleCount: 60, colorScheme: 'cool' });
    expect(cfg.particleCount).toBe(60);
    expect(cfg.colorScheme).toBe('cool');
    expect(cfg.particleSpeed).toBe(1.0);    // default preserved
    expect(cfg.showLeaderboard).toBe(true); // default preserved
  });

  it('preserves all defaults when empty object provided', () => {
    const cfg = buildMapConfig({});
    expect(cfg.particleCount).toBe(120);
    expect(cfg.showLeaderboard).toBe(true);
  });

  it('accepts showLeaderboard: false', () => {
    const cfg = buildMapConfig({ showLeaderboard: false });
    expect(cfg.showLeaderboard).toBe(false);
  });

  it('accepts custom particleSpeed', () => {
    const cfg = buildMapConfig({ particleSpeed: 1.8 });
    expect(cfg.particleSpeed).toBe(1.8);
  });
});

describe('getColorScheme()', () => {
  it('brand has cyan normal particles and pink fast particles', () => {
    const s = getColorScheme('brand');
    expect(s.particleNormal).toBe('#67E8F9');
    expect(s.particleFast).toBe('#FDA4D4');
  });

  it('cool has blue normal particles and white fast particles', () => {
    const s = getColorScheme('cool');
    expect(s.particleNormal).toBe('#60A5FA');
    expect(s.particleFast).toBe('#FFFFFF');
  });

  it('warm has gold normal particles and orange fast particles', () => {
    const s = getColorScheme('warm');
    expect(s.particleNormal).toBe('#fbbf24');
    expect(s.particleFast).toBe('#FF6B35');
  });

  it('falls back to brand for unknown scheme name', () => {
    const s = getColorScheme('unknown');
    expect(s.particleNormal).toBe('#67E8F9');
    expect(s.particleFast).toBe('#FDA4D4');
  });

  it('all schemes define particleNormal, particleFast, stateGlowHigh', () => {
    ['brand', 'cool', 'warm'].forEach(name => {
      const s = getColorScheme(name);
      expect(typeof s.particleNormal).toBe('string');
      expect(typeof s.particleFast).toBe('string');
      expect(typeof s.stateGlowHigh).toBe('string');
    });
  });
});
```

**Step 2: Run and confirm tests pass immediately** (pure functions verified in isolation):
```bash
bun test tests/unit/mapbox-map-config.test.js
```
Expected: 10 pass, 0 fail

**Step 3: Add config constants to `public/js/mapbox-map.js`**

In the IIFE (after `REGION_BOUNDS` and before the class declaration), add:

```js
  // ── Config defaults + color schemes ──────────────────────────────────────

  var SCHEME_COLORS = {
    brand: { particleNormal: '#67E8F9', particleFast: '#FDA4D4', stateGlowHigh: '#FDA4D4' },
    cool:  { particleNormal: '#60A5FA', particleFast: '#FFFFFF', stateGlowHigh: '#e0f2fe' },
    warm:  { particleNormal: '#fbbf24', particleFast: '#FF6B35', stateGlowHigh: '#fef08a' },
  };

  function buildMapConfig(userConfig) {
    return {
      particleCount:   120,
      particleSpeed:   1.0,
      colorScheme:     'brand',
      showLeaderboard: true,
      ...(userConfig || {}),
    };
  }

  function getColorScheme(name) {
    return SCHEME_COLORS[name] || SCHEME_COLORS.brand;
  }
```

**Step 4: Wire config into `MapboxUSAMap` constructor**

In the constructor, add after `this._wrap = ...`:
```js
      this._cfg = buildMapConfig(config.mglConfig);
```

**Step 5: Verify tests still pass**
```bash
bun test tests/unit/mapbox-map-config.test.js tests/unit/mapbox-map-utils.test.js
```
Expected: all pass

**Step 6: Commit**
```bash
git add public/js/mapbox-map.js tests/unit/mapbox-map-config.test.js
git commit -m "feat: add buildMapConfig + color scheme constants to mapbox-map.js with TDD tests"
```

---

### Task 2: Visual polish — 4 new GL layers + pulse animation + CSS fade

**Files:**
- Modify: `public/js/mapbox-map.js`
- Modify: `public/css/mapbox-map.css`

**Context:** All additions use `_this._map.addSource()` / `addLayer()`. The `_startPulse()` method uses `setInterval(150ms)` to animate expanding rings on hotspots and data centers. The `arc-particles-glow` layer uses the same `arc-particles` source — just a second, blurred rendering of it. The `states-glow` line layer uses a `filter` expression to only show on high-intensity states.

**Step 1: Add 2 new sources in `_addSources()`**

After the `this._map.addSource('datacenters', ...)` call, add:

```js
      // Animated pulse ring sources
      this._map.addSource('hotspots-pulse',   { type: 'geojson', data: this._empty() });
      this._map.addSource('datacenter-pulse', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: DATA_CENTERS.map((dc, i) => ({
            type: 'Feature',
            properties: { phase: i / DATA_CENTERS.length },
            geometry: { type: 'Point', coordinates: [dc.lon, dc.lat] },
          })),
        },
      });
```

**Step 2: Add 4 new layers in `_addLayers()`**

**2a.** After `states-outline`, add `states-glow` (bloom on hot states):
```js
      this._map.addLayer({
        id: 'states-glow', type: 'line', source: 'us-states',
        filter: ['>', ['get', 'intensity'], 0.45],
        paint: {
          'line-color':   ['interpolate', ['linear'], ['get', 'intensity'],
            0.45, '#7c3aed', 0.75, '#b87aff', 1.0, '#FDA4D4'],
          'line-width':   14,
          'line-blur':    10,
          'line-opacity': ['interpolate', ['linear'], ['get', 'intensity'],
            0.45, 0.1, 1.0, 0.45],
          'line-color-transition': { duration: 800 },
        },
      });
```

**2b.** Before `arc-particles`, add `arc-particles-glow`:
```js
      this._map.addLayer({
        id: 'arc-particles-glow', type: 'circle', source: 'arc-particles',
        paint: {
          'circle-radius':  ['*', ['get', 'sz'], 3.5],
          'circle-color':   ['case', ['==', ['get', 'pt'], 'fast'], '#FDA4D4', '#67E8F9'],
          'circle-opacity': 0.10,
          'circle-blur':    0.9,
        },
      });
```

**2c.** After `hotspots-core`, add `hotspots-pulse-ring`:
```js
      this._map.addLayer({
        id: 'hotspots-pulse-ring', type: 'circle', source: 'hotspots-pulse',
        paint: {
          'circle-radius':          ['get', 'pr'],
          'circle-color':           'transparent',
          'circle-stroke-width':    1.5,
          'circle-stroke-color':    ['case', ['>', ['get', 'ir'], 0.4], '#FDA4D4', '#67E8F9'],
          'circle-stroke-opacity':  ['get', 'po'],
          'circle-blur':            0.3,
        },
      });
```

**2d.** After `datacenter-marks`, add `datacenter-pulse-ring`:
```js
      this._map.addLayer({
        id: 'datacenter-pulse-ring', type: 'circle', source: 'datacenter-pulse',
        paint: {
          'circle-radius':         ['get', 'pr'],
          'circle-color':          'transparent',
          'circle-stroke-width':   2,
          'circle-stroke-color':   '#67E8F9',
          'circle-stroke-opacity': ['get', 'po'],
          'circle-blur':           0.2,
        },
      });
```

**Step 3: Add `_startPulse()` method**

Add after `_startAnimation()`:

```js
    _startPulse() {
      let tick = 0;
      this._pulseId = setInterval(() => {
        if (!this._map) return;
        tick += 1;
        const t = tick / 7; // advances ~0.14 per 150ms

        // Hotspot pulse rings — top 20
        if (this._data?.hotspots?.length) {
          const maxHot = this._data.hotspots[0]?.impressions || 1;
          const features = this._data.hotspots
            .filter(h => h.lat && h.lon)
            .slice(0, 20)
            .map((h, i) => {
              const phase = (t * 0.8 + i * 0.31) % 1;
              const ir    = (h.impressions || 0) / maxHot;
              const baseR = 3 + ir * 14;
              return {
                type: 'Feature',
                properties: { pr: baseR + phase * 22, po: (1 - phase) * 0.38 * ir, ir },
                geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
              };
            });
          this._map.getSource('hotspots-pulse')?.setData({ type: 'FeatureCollection', features });
        }

        // Data center pulse rings
        const dcFeatures = DATA_CENTERS.map((dc, i) => {
          const phase = (t * 0.55 + i * 0.33) % 1;
          return {
            type: 'Feature',
            properties: { pr: 8 + phase * 28, po: (1 - phase) * 0.65 },
            geometry: { type: 'Point', coordinates: [dc.lon, dc.lat] },
          };
        });
        this._map.getSource('datacenter-pulse')?.setData({ type: 'FeatureCollection', features: dcFeatures });
      }, 150);
    }
```

**Step 4: Call `_startPulse()` and cancel on destroy**

In `_applyData()`, after `if (!this._animId) this._startAnimation();`, add:
```js
      if (!this._pulseId) this._startPulse();
```

In `destroy()`, after the animId cancellation, add:
```js
      if (this._pulseId) { clearInterval(this._pulseId); this._pulseId = null; }
```

In the constructor, initialize:
```js
      this._pulseId = null;
```

**Step 5: Add leaderboard fade gradient to `mapbox-map.css`**

Find `.mgl-lb-rows` and add AFTER it (not inside):
```css
/* Soft fade at bottom of leaderboard list */
.mgl-lb-rows::after {
  content:    '';
  position:   absolute;
  bottom:     0;
  left:       0;
  right:      0;
  height:     40px;
  background: linear-gradient(transparent, rgba(14,3,32,0.85));
  pointer-events: none;
}
```

Also improve the leaderboard title:
```css
.mgl-lb-title {
  /* existing rules stay, add: */
  text-shadow: 0 0 12px rgba(253,164,212,0.4);
}
```

**Step 6: Restart and verify server is active**
```bash
sudo systemctl restart tv-dashboards && sleep 2 && sudo systemctl is-active tv-dashboards
```

**Step 7: Commit**
```bash
git add public/js/mapbox-map.js public/css/mapbox-map.css
git commit -m "feat: visual polish — particle glow, state bloom, pulse rings, DC rings, leaderboard fade"
```

---

### Task 3: Studio properties panel + `mapbox-map.js` config integration

**Files:**
- Modify: `public/studio.html` (add `#mgl-config-section`)
- Modify: `public/js/studio.js` (show/hide + bind)
- Modify: `public/js/mapbox-map.js` (apply config to layers)

**Step 1: Add `#mgl-config-section` to `public/studio.html`**

Find `#map-config-section` closing `</details>` (around line 309). Add AFTER it:

```html
          <details class="props-section" id="mgl-config-section" style="display:none">
            <summary>Map GL Config</summary>
            <div>
              <label>Color Scheme
                <select id="prop-mgl-scheme">
                  <option value="brand">Brand (Purple/Pink)</option>
                  <option value="cool">Cool (Blue/Cyan)</option>
                  <option value="warm">Warm (Orange/Gold)</option>
                </select>
              </label>
              <label>Particles
                <select id="prop-mgl-particles">
                  <option value="60">60 — Light</option>
                  <option value="120" selected>120 — Normal</option>
                  <option value="180">180 — Dense</option>
                </select>
              </label>
              <label>Speed
                <select id="prop-mgl-speed">
                  <option value="0.5">Slow</option>
                  <option value="1.0" selected>Normal</option>
                  <option value="1.8">Fast</option>
                </select>
              </label>
              <label>Leaderboard
                <select id="prop-mgl-leaderboard">
                  <option value="true" selected>Visible</option>
                  <option value="false">Hidden</option>
                </select>
              </label>
            </div>
          </details>
```

**Step 2: Show/hide and populate in `showWidgetProps()` in `public/js/studio.js`**

Find where `mapSection.style.display = wc.type === 'usa-map' ? '' : 'none';` is set (~line 475). Add immediately after it:

```js
      const mglSection = document.getElementById('mgl-config-section');
      if (mglSection) {
        mglSection.style.display = wc.type === 'usa-map-gl' ? '' : 'none';
        if (wc.type === 'usa-map-gl') {
          const mgl = wc.mglConfig || {};
          set('prop-mgl-scheme',      mgl.colorScheme    || 'brand');
          set('prop-mgl-particles',   String(mgl.particleCount || 120));
          set('prop-mgl-speed',       String(mgl.particleSpeed  || 1.0));
          set('prop-mgl-leaderboard', String(mgl.showLeaderboard !== false));
        }
      }
```

**Step 3: Bind mglConfig changes in `bindWidgetPropListeners()` in `public/js/studio.js`**

Find where `bind('prop-map-zoom', ...)` is called (~line 530). After it, add:

```js
      bind('prop-mgl-scheme',      (v) => { wc.mglConfig = { ...(wc.mglConfig || {}), colorScheme: v }; });
      bind('prop-mgl-particles',   (v) => { wc.mglConfig = { ...(wc.mglConfig || {}), particleCount: parseInt(v, 10) }; });
      bind('prop-mgl-speed',       (v) => { wc.mglConfig = { ...(wc.mglConfig || {}), particleSpeed: parseFloat(v) }; });
      bind('prop-mgl-leaderboard', (v) => { wc.mglConfig = { ...(wc.mglConfig || {}), showLeaderboard: v === 'true' }; });
```

**Step 4: Apply config in `mapbox-map.js`**

**4a.** Apply particle count in `_initParticles()` — change `120` to `this._cfg.particleCount`:
```js
    _initParticles(hotspots) {
      const count   = this._cfg.particleCount;  // was: 120
      const targets = hotspots.length ? hotspots : [{ lon: -98, lat: 39 }];
      this._particles = Array.from({ length: count }, () => {
```

**4b.** Apply particle speed in `_startAnimation()` — change the speed multiplier:
```js
            p.t += p.speed * (p.pt === 'fast' ? 1.5 : 1) * this._cfg.particleSpeed;
```

**4c.** Add `_applyColorScheme(schemeName)` method — call `setPaintProperty` to live-update layer colors:

```js
    _applyColorScheme(schemeName) {
      if (!this._map?.isStyleLoaded()) return;
      const s = getColorScheme(schemeName);

      // Arc particles — normal vs fast color
      this._map.setPaintProperty('arc-particles',
        'circle-color', ['case', ['==', ['get', 'pt'], 'fast'], s.particleFast, s.particleNormal]);
      this._map.setPaintProperty('arc-particles-glow',
        'circle-color', ['case', ['==', ['get', 'pt'], 'fast'], s.particleFast, s.particleNormal]);

      // Hotspot pulse ring color driven by ir
      this._map.setPaintProperty('hotspots-pulse-ring',
        'circle-stroke-color', ['case', ['>', ['get', 'ir'], 0.4], s.particleFast, s.particleNormal]);

      // State glow high-end color
      this._map.setPaintProperty('states-glow', 'line-color',
        ['interpolate', ['linear'], ['get', 'intensity'], 0.45, '#7c3aed', 0.75, '#b87aff', 1.0, s.stateGlowHigh]);
    }
```

**4d.** Apply config after map loads + on data update. In `_applyData()`, after `if (!this._pulseId) this._startPulse();`, add:

```js
      // Apply mglConfig settings
      this._cfg = buildMapConfig(this._config.mglConfig); // re-read in case Studio changed it
      this._applyColorScheme(this._cfg.colorScheme);
      if (this._lbEl) {
        this._lbEl.style.display = this._cfg.showLeaderboard ? '' : 'none';
      }
```

Also store `this._config = config` in constructor (needed for `re-read` above):
```js
      this._config = config || {};
```

**Step 5: Restart and smoke test**
```bash
sudo systemctl restart tv-dashboards && sleep 2 && sudo systemctl is-active tv-dashboards
```

Manual check:
1. Open `/admin` → add a `usa-map-gl` widget → click it
2. Properties panel shows "Map GL Config" section with 4 selectors
3. Change Color Scheme to "Cool" → map particles change to blue/white
4. Change Particles to 60 → fewer particles visible
5. Set Leaderboard to Hidden → leaderboard overlay disappears

**Step 6: Commit**
```bash
git add public/studio.html public/js/studio.js public/js/mapbox-map.js
git commit -m "feat: Studio mglConfig controls — color scheme, particle count/speed, leaderboard toggle"
```

---

### Task 4: Final integration check

**Step 1: Run full test suite**
```bash
git restore config/ && bun test 2>&1 | tail -5
```
Expected: existing tests pass + new config tests pass, 0 new regressions

**Step 2: Run all Mapbox tests**
```bash
bun test tests/unit/routes/mapbox-token.test.js tests/unit/mapbox-map-utils.test.js tests/unit/mapbox-map-config.test.js
```
Expected: 32 pass, 0 fail (10 token + 22 utils + 10 config... wait, config is 10 new)

Wait — the config tests in step 1 of Task 1 are the same functions tested in Task 1. Count: 5 buildMapConfig tests + 5 getColorScheme tests = 10 new tests.

Total Mapbox tests: 3 (token) + 22 (utils) + 10 (config) = 35 pass, 0 fail

**Step 3: Verify Studio controls in served HTML**
```bash
curl -s http://tv:3000/admin | grep -c 'mgl-config\|prop-mgl'
```
Expected: at least 5 (section + 4 selectors)

**Step 4: Verify GL dashboards in rotation**
```bash
curl -s http://tv:3000/api/config | python3 -c "
import sys,json; d=json.load(sys.stdin)
gl = [db['id'] for db in d['dashboards'] if 'gl' in db.get('id','')]
print('GL dashboards:', gl)
"
```
Expected: `['campaign-delivery-gl', 'campaign-delivery-gl-ne', 'campaign-delivery-gl-se']`

**Step 5: Git log**
```bash
git log --oneline -5
```
Expected:
- `feat: Studio mglConfig controls — color scheme, particle count/speed, leaderboard toggle`
- `feat: visual polish — particle glow, state bloom, pulse rings, DC rings, leaderboard fade`
- `feat: add buildMapConfig + color scheme constants to mapbox-map.js with TDD tests`
