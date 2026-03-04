# Mapbox GL USA Map — Design

**Date:** 2026-03-04
**Status:** Approved

## Goal

Replace the Canvas 2D usa-map widget with a pure Mapbox GL JS implementation for GPU-accelerated rendering. The existing `usa-map` widget type is preserved untouched as a fallback; the new `usa-map-gl` type is a clean, all-new implementation using Mapbox GL JS with no canvas carryover.

## Constraints

- Existing `usa-map` (Canvas 2D) stays unchanged — zero risk
- New widget type: `usa-map-gl`
- Token: `MAPBOX_ACCESS_TOKEN` in `.env`, served via `GET /api/config/mapbox-token`
- No Mapbox tile CDN dependency at runtime — blank base style, all layers are local GeoJSON
- Same data pipeline: server sends `{ states, hotspots, totals, regions, region }` — identical to existing widget

## Architecture

```
New files:
  public/js/mapbox-map.js    — MapboxUSAMap class, all GL layer logic
  public/css/mapbox-map.css  — leaderboard overlay styles

Token delivery:
  GET /api/config/mapbox-token → { token: process.env.MAPBOX_ACCESS_TOKEN }
  Served via API — not hardcoded in client JS

Data flow (identical to existing usa-map):
  server → { states, hotspots, totals, regions, region }
  mapbox-map.js reads same shape → feeds GL sources

widgets.js:
  new case 'usa-map-gl' → mapboxUsaMap(container, config)

studio.html:
  'usa-map-gl' added to palette TYPES array and #prop-type selector

dashboards.yaml:
  existing map widgets keep type 'usa-map' (Canvas 2D unchanged)
  user switches to 'usa-map-gl' in Studio properties panel if desired

server/index.js:
  new GET /api/config/mapbox-token route
```

## Map Style

**Blank MadHive brand style** — no tile sources, no external CDN requests at runtime. Mapbox GL token is required to initialize the GL context but no tiles are fetched.

Base style:
```js
{
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0E0320' } }]
}
```

All geographic content comes from `window.US_STATES` GeoJSON (already loaded).

## Layer Stack (bottom → top)

| # | Layer ID | Type | Source | Purpose |
|---|---|---|---|---|
| 1 | `background` | background | — | `#0E0320` deep purple fill |
| 2 | `states-fill` | fill | GeoJSON `us-states` | Choropleth by impressions |
| 3 | `states-outline` | line | GeoJSON `us-states` | `#6B5690` @ 0.4 opacity |
| 4 | `grid` | line | GeoJSON `lat-lon-grid` | Lat/lon lines @ 0.08 opacity |
| 5 | `arc-corridors` | line | GeoJSON `arc-corridors` | 30 dim DC→hotspot bezier routes |
| 6 | `arc-particles` | circle | GeoJSON `arc-particles` | 120 animated particle dots |
| 7 | `hotspots-glow` | circle | GeoJSON `hotspots` | Large soft radius, low opacity |
| 8 | `hotspots-core` | circle | GeoJSON `hotspots` | Data-driven radius + cyan/pink/white color |
| 9 | `datacenter-marks` | circle | GeoJSON `datacenters` | GCP data center locations |
| 10 | leaderboard | HTML | — | Absolute-positioned DOM overlay |

## Data-Driven Styling

**State choropleth:** `fill-color` uses `interpolate ['linear'] ['get', 'intensity'] 0 '#1a0840' 0.3 '#4c1d95' 0.7 '#7c3aed' 1.0 '#FDA4D4'`. Transition duration 800ms for smooth updates. `intensity` is `impressions / maxImpressions` injected into each feature's properties before `setData()`.

**Hotspot dots:** `circle-radius` interpolated 4px–18px by `imp_ratio`. `circle-color` stepped: cyan (`#67E8F9`) → pink (`#FDA4D4`) → white-hot (`#FFFFFF`) by `imp_ratio`.

**Arc particle circles:** `circle-radius` 2–4px, `circle-color` driven by `particle_type` property ('fast' → pink, 'normal' → cyan).

## Arc Particle Animation

120 GeoJSON Point features in `arc-particles` source. Each `requestAnimationFrame` tick:
1. Advance each particle's `t` (0→1 along its bezier arc) by `speed`
2. Compute new `[lon, lat]` from quadratic bezier: DC → control point → target hotspot
3. Convert canvas `[x, y]` bezier coordinates back to geographic `[lon, lat]` using inverse Albers projection
4. Call `map.getSource('arc-particles').setData(featureCollection)` — single GPU upload

The bezier control points are derived from the same DATA_CENTERS and hotspot coordinates used in the existing canvas code.

**Coordinate system:** Mapbox GL works in WGS84 `[lon, lat]`. The existing particle code uses normalized Albers `[x, y]`. The conversion is done once per hotspot when data arrives; particle positions are interpolated in the `[x, y]` space and then mapped to `[lon, lat]` for the GeoJSON update.

## Hotspot Pulse Rings

Top 30 hotspots get an expanding pulse ring. Instead of redrawing every frame (expensive in Canvas 2D), this uses a secondary circle layer `hotspots-pulse` with `circle-radius` updated once per second via `setInterval` — cycling the radius of each feature's `pulse_radius` property between `dotR+2` and `dotR+20` over a 2s period.

## Leaderboard Overlay

HTML `<div class="mgl-leaderboard">` absolutely positioned over the right side of the map container. Same scroll animation as the existing canvas leaderboard (CSS `transform: translateY` with `requestAnimationFrame` for smooth scroll). Populated from `data.states` sorted by impressions — no canvas drawing required.

## Regional Variants

`mapConfig.region` controls the initial map bounds:
- `undefined` / `'full'` → `fitBounds([-125, 24, -66, 50])` — continental USA
- `'northeast'` → `fitBounds([-80, 37, -67, 47])`
- `'southeast'` → `fitBounds([-88, 24, -75, 37])`

Mapbox handles the projection and clipping automatically — no manual viewport math needed.

## Token API

```js
// server/index.js
.get('/api/config/mapbox-token', () => ({
  token: process.env.MAPBOX_ACCESS_TOKEN || ''
}), {
  detail: { tags: ['health'], summary: 'Mapbox GL access token' }
})
```

Client fetches this once on init, then calls `mapboxgl.accessToken = token` before creating the map.

## Files Touched

**New:**
- `public/js/mapbox-map.js` — `MapboxUSAMap` class + `mapboxUsaMap()` factory
- `public/css/mapbox-map.css` — leaderboard overlay, container styles

**Modified:**
- `server/index.js` — add `GET /api/config/mapbox-token` route
- `public/js/widgets.js` — add `case 'usa-map-gl'`
- `public/studio.html` — add `usa-map-gl` to `#prop-type` and palette TYPES
- `public/import.html` — add Mapbox GL JS CDN `<link>` and `<script>` (loaded lazily only when a map widget is present)
- `public/index.html` (TV display) — same lazy load

## Out of Scope

- Migrating existing dashboards.yaml widgets to `usa-map-gl` (user does this manually)
- Mapbox Studio custom style (blank style is sufficient)
- Mapbox tile layers (ocean, terrain, roads)
