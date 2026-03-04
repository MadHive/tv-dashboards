# Mapbox GL Boundaries + Impressions Total — Design

**Date:** 2026-03-04
**Status:** Approved

## Goal

Enhance the `usa-map-gl` widget with crisp admin boundary lines (state + county), two zip-level delivery visualization modes (heatmap vs dots), a base-style toggle (brand-dark vs Mapbox-dark), and a prominent impressions total overlay.

## New Studio Controls (added to existing `#mgl-config-section`)

| Control | Field | Values |
|---|---|---|
| Base Style | `mglConfig.mapStyle` | `'brand'` (default) \| `'mapbox'` |
| Zip Visualization | `mglConfig.zoomViz` | `'dots'` (default) \| `'heatmap'` |

## Architecture

```
New data file:
  public/data/us-counties.json   ← ~2MB simplified county GeoJSON (bundled locally)

New GL sources:
  mapbox-streets  ← vector source: mapbox://mapbox.mapbox-streets-v8 (state admin)
  us-counties     ← geojson: /data/us-counties.json (county polygons)

New GL layers:
  admin-county-lines   ← line, source: us-counties, subtle purple, 0.4px
  admin-state-lines    ← line, source: mapbox-streets, source-layer: admin,
                         filter: admin_level=4 + disputed=false, 1.2px
  delivery-heatmap     ← heatmap, source: hotspots (existing), active when zoomViz='heatmap'

New HTML overlays:
  .mgl-total-overlay    ← absolute bottom-left: "⬡ LIVE DELIVERY / 142.3M impressions"
  .mgl-lb-header-total  ← total moved to top of leaderboard as header

Style switching:
  map.setStyle(url)
  → on 'style.load': re-add all custom sources + layers
  → C2 (mapbox dark-v11): hide road/label/POI layers via setLayoutProperty visibility=none

mglConfig applied in _applyData() (existing re-read pattern):
  mapStyle → triggers setStyle() if changed
  zoomViz  → show/hide delivery-heatmap vs hotspots-glow + hotspots-core
```

## Boundary Layers

### State Lines — Mapbox Streets v8 vector source

```js
map.addSource('mapbox-streets', {
  type: 'vector',
  url:  'mapbox://mapbox.mapbox-streets-v8'
});

map.addLayer({ id: 'admin-state-lines', type: 'line',
  source: 'mapbox-streets', 'source-layer': 'admin',
  filter: ['all', ['==', 'admin_level', 4], ['==', 'disputed', false]],
  paint: {
    'line-color':   '#6B5690',
    'line-width':   1.2,
    'line-opacity': 0.7,
  }
});
```

Available free on all Mapbox plans. Vector tiles — crisp at all zoom levels. Filtered to US state boundaries (`admin_level: 4`) with `disputed: false`.

### County Lines — local GeoJSON

```js
map.addSource('us-counties', { type: 'geojson', data: '/data/us-counties.json' });

map.addLayer({ id: 'admin-county-lines', type: 'line', source: 'us-counties',
  paint: {
    'line-color':   '#3D1A5C',
    'line-width':   0.4,
    'line-opacity': 0.5,
  }
});
```

Simplified US Census county GeoJSON (~2MB, bundled at `public/data/us-counties.json`). Thinner and more subtle than state lines — provides geographic context without visual noise.

**Layer order:** county lines → state lines → existing data layers (hotspots, particles, etc.)

## Style Switching (C1 ↔ C2)

**C1 — Brand Dark (default):**
```js
{ version: 8, sources: {}, layers: [{ id: 'background', type: 'background',
  paint: { 'background-color': '#0E0320' } }] }
```

**C2 — Mapbox Dark-v11:**
```js
'mapbox://styles/mapbox/dark-v11'
// After style.load: hide road/label/POI layers:
const hideIds = ['road-street', 'road-minor', 'road-major', 'poi-label',
  'place-label', 'road-primary', 'road-secondary', 'road-motorway'];
hideIds.forEach(id => {
  if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
});
```

**Style reload pattern:** `map.setStyle(url)` wipes all custom sources and layers. After `style.load` fires, call `_addSources()` + `_addLayers()` to restore custom layers. Store current style in `this._currentStyle` to detect changes.

## Zip Visualization Modes

**`dots` (default):** existing `hotspots-glow` + `hotspots-core` circle layers — no change.

**`heatmap`:** Mapbox built-in heatmap layer using the existing `hotspots` source:
```js
map.addLayer({ id: 'delivery-heatmap', type: 'heatmap', source: 'hotspots',
  paint: {
    'heatmap-weight':     ['interpolate', ['linear'], ['get', 'ir'], 0, 0, 1, 1],
    'heatmap-intensity':  ['interpolate', ['linear'], ['zoom'], 3, 1, 8, 3],
    'heatmap-color':      ['interpolate', ['linear'], ['heatmap-density'],
      0,    'transparent',
      0.2,  '#3D1A5C',
      0.4,  '#7c3aed',
      0.7,  '#FDA4D4',
      1.0,  '#FFFFFF'],
    'heatmap-radius':     ['interpolate', ['linear'], ['zoom'], 3, 30, 8, 60],
    'heatmap-opacity':    0.85,
  }
});
```

Switching `zoomViz` shows/hides the appropriate layers:
- `heatmap`: show `delivery-heatmap`, hide `hotspots-glow` + `hotspots-core`
- `dots`: show `hotspots-glow` + `hotspots-core`, hide `delivery-heatmap`

## Impressions Total Display

### Bottom-left map overlay

HTML `<div class="mgl-total-overlay">` appended to `.mgl-container` in `_buildLeaderboardDOM()`. Contains:
- `.mgl-total-label` — "⬡ LIVE DELIVERY" (11px, pink, uppercase)
- `.mgl-total-value` — "142.3M" (32px, white, glow)
- `.mgl-total-sub` — "impressions right now" (10px, muted)

### Leaderboard header total

`.mgl-lb-totals` (existing) moved from footer to header position (above `.mgl-lb-title`). Reformatted as a proper header: `142.3M total impressions` in pink gradient text.

### Animated counter

When data updates, the displayed number animates from the previous value to the new value over 800ms using `requestAnimationFrame`. Eased with `easeOutCubic`. Adds visual life on each data refresh.

## Files Touched

**New:**
- `public/data/us-counties.json` — simplified US county GeoJSON (download from US Census)

**Modified:**
- `public/js/mapbox-map.js` — boundary sources/layers, style switching, heatmap layer, total overlay, animated counter
- `public/css/mapbox-map.css` — `.mgl-total-overlay` styles, updated leaderboard header total
- `public/studio.html` — 2 new selects in `#mgl-config-section`: mapStyle + zoomViz
- `public/js/studio.js` — populate + bind the 2 new selects in `showWidgetProps` and `bindWidgetPropListeners`

## Out of Scope

- Individual zip code polygon fills (ZCTA boundaries are ~50MB — too large)
- Mapbox Studio custom style (blank + Streets is sufficient)
- County-level delivery data (server only has zip3 data from BigQuery)
