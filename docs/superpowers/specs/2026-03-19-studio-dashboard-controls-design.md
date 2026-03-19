# Studio Dashboard Controls Design

**Date:** 2026-03-19
**Status:** Approved

## Overview

Extend the Studio (`/admin`) with six dashboard management features, all surfaced in the existing three-panel layout (sidebar · canvas · properties). No new pages or routes — everything fits into the existing studio shell.

---

## Feature 1: Rotation Toggle (Include / Exclude)

### What
Each dashboard in the sidebar gets a small toggle pill (green = in rotation, grey = excluded). Excluded dashboards stay in the list with faded appearance and strikethrough name but are skipped entirely during TV rotation.

### Data model
Add `excluded: boolean` (optional, default `false`) to each dashboard entry in `dashboards.yaml`. The `DashboardShape` TypeBox model in `server/models/dashboard.model.js` gains `excluded: t.Optional(t.Boolean())`.

### TV display (`public/js/app.js`)
`renderPages()` and `startRotation()` filter out dashboards where `excluded === true`. The nav dots also skip them. Arrow-key navigation skips excluded dashboards.

### Studio sidebar (`public/js/studio.js`)
- Toggle button rendered per dashboard item in `renderSidebar()`
- Click calls `PUT /api/dashboards/:id` with `{ excluded: !current }` → updates YAML → re-renders sidebar
- Status counter at bottom of list: "23 dashboards · 2 excluded"

### Properties panel
Rotation section in dashboard props panel: a larger toggle with explanatory text ("When off, dashboard stays in the list but is skipped during rotation"). Mirrors the sidebar toggle — both stay in sync.

---

## Feature 2: Custom Colors (clientBranding editor)

### What
"Branding" collapsible section in the Dashboard Properties panel. Five native `<input type="color">` pickers (bg, accent, bgCard, border, dotColor) plus text inputs for logoText and logoSub. Changes write to `dash.clientBranding` in the in-memory config and call `markDirty()`.

### Live preview
On every change, `_applyClientBranding(dash.clientBranding)` is called so the canvas background and widget cards update immediately in the studio preview. When the user navigates away, branding is cleared.

### Persistence
Saved via the existing `PUT /api/dashboards/:id` call triggered by Save. The `clientBranding` object is already passed through the API (TypeBox model updated in the iHeart PR).

### Color fields
| Field | CSS var | Label |
|---|---|---|
| `bg` | `--bg` | Background |
| `bgCard` | `--bg-card` | Card Background |
| `border` | `--border` | Border |
| `accent` | `--accent` | Accent |
| `dotColor` | `--dot-color` | Dot Grid |

---

## Feature 3: Logo

### What
In the Branding section (below color pickers): a drop-zone / "Browse" button for image upload + a URL text input below it. Either path sets `clientBranding.clientLogo` (used by the map overlay `mgl-client-logo` img) and the logo text fields set `clientBranding.logoText` / `clientBranding.logoSub` (shown in the top-bar during TV rotation).

### Upload
New server endpoint: `POST /api/assets/upload` — accepts `multipart/form-data` with a single image file, saves to `public/img/<sanitized-filename>`, returns `{ url: '/img/<filename>' }`. Accepted types: SVG, PNG, JPG, WebP. Max 2MB.

### URL path
If the user pastes a URL/path directly, it is used as-is without upload. The drop-zone shows a small preview `<img>` when a logo is set.

### Text fields
`logoText` (e.g. "iHEART") and `logoSub` (e.g. "MEDIA") sit next to each other in a two-column row directly below the logo input.

---

## Feature 4: Icon Picker

### What
"Icon" collapsible section in the Dashboard Properties panel shows a 5-column grid of icon options. Selecting one updates `dash.icon` immediately and re-renders the sidebar thumbnail + canvas label. Icons are the same set already used in the studio's "Create Dashboard" dialog.

### Icons available
`⚡ bolt`, `○ map`, `📊 chart-bar`, `⌘ server`, `⛨ shield`, `⇄ flow`, `⌸ data`, `▦ grid`, `★ star`, `🌐 globe` (expandable via the `ICONS` constant in `app.js`).

### Implementation
Move the icon picker HTML from the "Create Dashboard" modal into the `#dashboard-props` section. The `showDashboardProps()` function reads `dash.icon` and marks the matching cell selected. A click handler calls `applyDashboardProps()`.

---

## Feature 5: Query Picker (Browse button on queryId)

### What
The queryId text input in the Widget Properties panel gets a "Browse" button beside it. Clicking opens an inline searchable panel (slides in from the right, replacing the current panel content temporarily) showing all saved queries grouped by source (GCP · BigQuery · Computed). Clicking a query fills the queryId input, closes the panel, and calls `markDirty()`.

### Query panel layout
- Search input at top (filters by query ID, name, or description)
- Grouped list: GCP queries (sorted by name), BigQuery queries, Computed queries
- Each row: query ID (monospace), name, short description
- Selected query shown with a checkmark and the query's description shown below the queryId input in green ("✓ GCP · Cloud Run Request Count")

### Data source
Reuses `GET /api/queries/` which already returns all queries grouped by source. No new endpoint needed.

### No new routes
The picker is a panel state in the existing studio JS, not a new page or modal. The `showQueryPicker(widgetId)` function swaps the right panel content; "Cancel" or selecting a query swaps back to widget props.

---

## Feature 6: Map Region & Zoom

### What
The existing "Map Config" section in the Widget Properties panel (already has time window, min impressions, metric, zoomViz) gains two new controls for `usa-map-gl` widgets:

1. **Region picker** — button group: Nationwide · NE · SE · NW · SW · Custom. Sets `mglConfig.region` (which `campaignDeliveryMapClientWidget` already reads). "Custom" reveals lat/lon/zoom number inputs.

2. **Zoom slider** — range input 2–10, sets `mglConfig.initialZoom`. The Mapbox map reads this on load via `buildMapConfig()` and passes it to `map.setZoom()`.

### Mapbox wiring
`buildMapConfig()` in `mapbox-map.js` gains `initialZoom: 4` default. `MapboxUSAMap` constructor passes `this._cfg.initialZoom` to the `Map` constructor's `zoom` option. Region selection updates `mglConfig.region` which the computed function uses to filter hotspots server-side.

### Properties panel
The Map Config `<details>` section in `studio.html` (already exists for legacy `usa-map` and `usa-map-gl` widgets) is extended with the region button group and zoom slider. Both bind via the existing `bind()` / `bindMap()` pattern in `showWidgetProps()`.

---

## Architecture Summary

### Files changed
| File | Change |
|---|---|
| `server/models/dashboard.model.js` | Add `excluded: t.Optional(t.Boolean())` to DashboardShape |
| `server/index.js` | Add `POST /api/assets/upload` endpoint |
| `public/studio.html` | Add rotation toggle, branding section, icon picker, query picker panel, zoom/region controls |
| `public/js/studio.js` | Bind all new controls; `showQueryPicker()`; `renderSidebar()` toggle; live branding preview |
| `public/css/studio.css` | Color picker styles, logo drop-zone, query picker list, rotation toggle pill |
| `public/js/app.js` | Filter excluded dashboards in `renderPages()`, `startRotation()`, arrow-key nav |
| `public/js/mapbox-map.js` | Read `initialZoom` from config; pass to Mapbox `Map` constructor |

### No new pages, no new DB tables
All state flows through the existing YAML config via the existing `PUT /api/dashboards/:id` and `PUT /api/config` endpoints. The asset upload is the only new server endpoint.

### Save behaviour
All changes (branding, exclusion, icon, queryId, zoom) are held in `modifiedConfig` in-memory until the user clicks Save, consistent with existing studio behavior. The dirty indicator (●) shows when unsaved changes exist.
