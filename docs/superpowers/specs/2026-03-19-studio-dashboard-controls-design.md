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
- Click sets `dash.excluded = !dash.excluded` in `modifiedConfig` and calls `markDirty()` — follows the same deferred-Save flow as all other studio edits. No immediate API call.
- Status counter at bottom of list: "23 dashboards · 2 excluded"

### Properties panel
Rotation section in dashboard props panel: a larger toggle with explanatory text ("When off, dashboard stays in the list but is skipped during rotation"). Mirrors the sidebar toggle — both write to `modifiedConfig` via `applyDashboardProps()` and call `markDirty()`.

---

## Feature 2: Custom Colors (clientBranding editor)

### What
"Branding" collapsible section in the Dashboard Properties panel. Five native `<input type="color">` pickers (bg, accent, bgCard, border, dotColor) plus text inputs for logoText and logoSub. Changes write to `dash.clientBranding` in the in-memory config and call `markDirty()`.

### Live preview
On every change, `_applyClientBranding(dash.clientBranding)` is called so the canvas background and widget cards update immediately in the studio preview. When the user selects a different dashboard or deselects all, `_applyClientBranding(null)` is called to restore MadHive defaults and prevent bleed-through.

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
In the Branding section (below color pickers): a drop-zone / "Browse" button for image upload + a URL text input below it. Either path sets `clientBranding.logoImage` (a new field). Logo text fields set `clientBranding.logoText` / `clientBranding.logoSub`.

### Two logo read-paths — unified at save
The map overlay (`mgl-client-logo`) reads from `mglConfig.clientLogo` (set on the widget, passed through `buildMapConfig`). The top-bar swap reads from `clientBranding` in `app.js`. To bridge these without duplicating data: when the user clicks Save, the studio writes `clientBranding.logoImage` to the dashboard AND copies the same URL into every `usa-map-gl` widget's `mglConfig.clientLogo` on that dashboard. This way both read-paths are satisfied with a single source of truth in `clientBranding.logoImage`.

### Upload
New server endpoint: `POST /api/assets/upload` — accepts `multipart/form-data` with a single image file. Filename is sanitized: lowercase, alphanumeric + hyphens + dots only, non-conforming chars replaced with `-`; a 6-char random prefix is prepended to prevent collisions (e.g. `a3f9k2-iheart-logo.svg`). Saves to `public/img/`, returns `{ url: '/img/<filename>' }`. Accepted types: SVG, PNG, JPG, WebP. Max 2MB.

### URL path
If the user pastes a URL/path directly, it is used as-is without upload. The drop-zone shows a small preview `<img>` when a logo is set.

### Text fields
`logoText` (e.g. "iHEART") and `logoSub` (e.g. "MEDIA") sit next to each other in a two-column row directly below the logo input.

---

## Feature 4: Icon Picker

### What
"Icon" collapsible section in the Dashboard Properties panel shows a 5-column grid of icon options. Selecting one updates `dash.icon` immediately and re-renders the sidebar thumbnail + canvas label. Icons are the same set already used in the studio's "Create Dashboard" dialog.

### Icons available
Exactly the set defined in the `ICONS` constant in `public/js/app.js`: `⚡ bolt`, `▦ grid`, `⌘ server`, `⇄ flow`, `⌸ data`, `⛨ shield`, `○ map`. The icon picker renders only keys present in `ICONS` so glyphs are always resolvable. Additional icons require adding them to `ICONS` first.

### Implementation
Move the icon picker HTML from the "Create Dashboard" modal into the `#dashboard-props` section. The `showDashboardProps()` function reads `dash.icon` and marks the matching cell selected. A click handler calls `applyDashboardProps()`.

---

## Feature 5: Query Picker (Browse button on queryId)

### What
The existing `<select id="prop-query">` in the Widget Properties panel is replaced with a text input + "Browse" button. The text input shows the raw query ID (readable, copyable). The Browse button opens an inline searchable panel (slides in from the right, replacing panel content temporarily) showing all saved queries grouped by source (GCP · BigQuery · Computed). Clicking a query fills the text input, closes the picker panel, and calls `markDirty()`. The existing `loadQueryOptions()` function is removed since the select is gone.

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

1. **Region picker** — button group: Nationwide · NE · SE · NW · SW · Custom. Sets `wc.mapConfig.region` (the widget's `mapConfig` object, which `campaignDeliveryMapClientWidget` already reads server-side via `widgetConfig.mapConfig?.region`). The existing `bindMap('prop-map-region', ...)` pattern is used. "Custom" is included in the button group but deferred — clicking it is a no-op for now (label reads "Custom — coming soon").

2. **Zoom slider** — range input 2–10, sets `mglConfig.initialZoom`. The Mapbox map reads this on load via `buildMapConfig()` and passes it to `map.setZoom()`.

### Region coverage
All five named regions (northeast, southeast, northwest, southwest) already exist in `REGION_STATE_SETS` inside `campaignDeliveryMapClientWidget`. "Nationwide" corresponds to the absence of a region filter (no `mapConfig.region` or `region: 'full'`).

### Mapbox wiring
`buildMapConfig()` in `mapbox-map.js` gains `initialZoom: 4` as a default field. `MapboxUSAMap` constructor passes `this._cfg.initialZoom` to the `Map` constructor's `zoom` option. Verify that `buildMapConfig` spreads `userConfig` last so `initialZoom` from the dashboard config is not overwritten by the default.

### Properties panel
The Map Config `<details>` section in `studio.html` (already exists for legacy `usa-map` and `usa-map-gl` widgets) is extended with the region button group and zoom slider. Both bind via the existing `bind()` / `bindMap()` pattern in `showWidgetProps()`.

---

## Architecture Summary

### Files changed
| File | Change |
|---|---|
| `server/models/dashboard.model.js` | Add `excluded: t.Optional(t.Boolean())` to DashboardShape |
| `server/index.js` | Add `POST /api/assets/upload` endpoint |
| `public/studio.html` | Add rotation toggle, branding section, icon picker, query picker panel, zoom/region controls; replace `<select>` queryId with text+browse |
| `public/js/studio.js` | Bind all new controls; `showQueryPicker()`; `renderSidebar()` toggle; live branding preview; logo copy-to-mglConfig on save; remove `loadQueryOptions()` |
| `public/css/studio.css` | Color picker styles, logo drop-zone, query picker list, rotation toggle pill |
| `public/js/app.js` | Filter excluded dashboards in `renderPages()`, `startRotation()`, arrow-key nav; `_applyClientBranding` reads `logoImage` field |
| `public/js/mapbox-map.js` | Add `initialZoom: 4` default to `buildMapConfig()`; pass to `Map` constructor `zoom` option |

### No new pages, no new DB tables
All state flows through the existing YAML config via the existing `PUT /api/dashboards/:id` and `PUT /api/config` endpoints. The asset upload is the only new server endpoint.

### Save behaviour
All changes (branding, exclusion, icon, queryId, zoom) are held in `modifiedConfig` in-memory until the user clicks Save, consistent with existing studio behavior. The dirty indicator (●) shows when unsaved changes exist.
