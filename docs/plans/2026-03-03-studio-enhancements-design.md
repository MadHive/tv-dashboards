# Studio Enhancements Design
**Date:** 2026-03-03
**Status:** Approved
**Scope:** Four incremental capabilities added to the existing studio at `/admin`

---

## Context

The studio is a working 3-panel WYSIWYG editor (sidebar / canvas / properties). The server layer now includes OpenAPI schemas, `POST /api/dashboards/reorder`, `POST /api/data-sources/:name/test`, and data-source config update endpoints from the concurrent OpenAPI+Drizzle agent. All four capabilities below are primarily **client-side work** — the server API is already in place.

Primary users: **engineers** (set up data sources and queries) + **ops/marketing assemblers** (compose dashboards from pre-built building blocks). Work ships incrementally — one capability at a time.

---

## Capability 1: Visual Widget Editor

**Goal:** Replace typing col/row numbers with true drag-and-drop grid placement.

### Grid Overlay
When a drag starts, inject `<div class="studio-grid-overlay">` into the canvas — `position: absolute; inset: 0; display: grid` matching the dashboard's exact column/row template. Each cell is a `<div class="grid-cell">` with a subtle dotted border in brand purple. Cells the dragged widget would occupy highlight in `--mh-pink` at 20% opacity. Cells occupied by another widget highlight red. Overlay removed on `dragend`.

### Drag Ghost + Snap Preview
Replace HTML5 default ghost with a custom `<div class="studio-drag-ghost">` that mirrors the widget's colSpan × rowSpan footprint. Positioned absolutely in the canvas and updated on every `dragover` to snap to the nearest grid cell in discrete steps (no pixel jitter). The source widget stays semi-transparent (0.3 opacity) so you see where it came from. Properties panel col/row inputs update live as the ghost moves.

### Collision Detection
On every `dragover`, check whether the target rectangle (col, row, colSpan, rowSpan) overlaps any other widget using axis-aligned rectangle intersection. If occupied: ghost turns red, drop rejected. If clear: ghost is pink, drop proceeds. A widget dragged to its own position is not a collision. Resize handles apply the same check — snap back to last valid size on collision.

### Resize Snap + Properties Sync
Existing `Math.round(delta / colWidth)` snap logic retained. Enhancement: show a live `W×H` badge on the widget during resize. Position inputs (col, row, colSpan, rowSpan) in the properties panel become **read-only display fields** — drag is the canonical editing method, eliminating the ambiguity of two competing edit paths.

---

## Capability 2: Query Preview + Editor

**Goal:** See what a metric returns and tweak it before assigning to a widget.

### Location
New **Queries tab** in the studio sidebar. Replaces the dashboard list when active. Shows all saved queries grouped by source (GCP, BigQuery, VulnTrack) with name, source badge, and last-run time. Clicking a query opens it in the right-hand panel (temporarily replacing widget properties). Canvas stays visible.

### Editor Interface
Three zones stacked vertically:

1. **Config strip** — metric type (read-only for GCP) or SQL textarea (BigQuery), project selector, time window (5m/15m/1h/6h/24h), aggregation (Mean/Sum/Max/Rate).
2. **Results preview** — "Run" button fires query against live source, shows up to 50 rows in a compact table. Time-series data shows inline sparkline. Response time and row count displayed. Errors shown in red with full error message.
3. **Visualization picker** — row of mini widget-type icons. Click one to see a live miniature preview rendered by the same `charts.js` / `widgets.js` code as the TV display.

### Save and Assign Workflow
- **Save Query** — writes back via `PUT /api/queries/:source/:id`
- **Save as New** — creates a copy via `POST /api/queries/:source` with a new name (useful for time-window variations)
- **Assign to Widget** — canvas dims, all widgets get a pink highlight ring, click any widget to assign queryId. Replaces the current blind dropdown selection.

---

## Capability 3: Data Source Credentials UI

**Goal:** Configure and test data source connections from the browser — no SSH required.

### Location
New **Data Sources tab** in the studio sidebar. Lists all sources (GCP, BigQuery, VulnTrack, plus stubs) with status indicators: green (connected), amber (configured/untested), red (error), grey (not configured).

### Credential Config Form
Source-specific fields in the right panel:
- GCP/BigQuery: project IDs, service account key file path
- VulnTrack: API URL, API key
- Other stubs: whatever their integration needs

Sensitive fields are password inputs with a reveal toggle. Existing values show as `••••••••` — secrets are **never returned to the browser**.

**Test Connection** button fires `POST /api/data-sources/:name/test` (already exists) and shows result inline — green with response time, or red with full error.

**Save** writes via `PUT /api/data-sources/:name/config` (already exists). If the test fails after saving, the old value is restored. The server reloads only the affected data source singleton — no full restart required.

### Security Boundary
The credentials endpoint only accepts writes, never reads back secrets. Secrets flow server → `.env` only, never server → browser.

---

## Capability 4: Dashboard Reordering + Thumbnails

**Goal:** Drag dashboards to reorder the TV rotation; see layout at a glance.

### Sidebar Reordering
Dashboard list items become drag-sortable. Each row gets a drag handle (⠿) on the left, visible on hover. Dragging shows a live drop-indicator line between items. On drop, `POST /api/dashboards/reorder` fires with the new ID order array (endpoint already exists). TV picks up new rotation order within 60 seconds — no page reload needed.

### At-a-Glance Thumbnails
Each dashboard row shows a tiny `<canvas>` grid preview — rectangles representing the widget layout, color-coded by type (gauge = amber, big-number = pink, map = green, etc.). No live data — built from config already in memory. Widget count and grid dimensions (e.g. `4×2`) shown as metadata. Instant visual recognition without loading into the main canvas.

---

## Files Affected

| File | Change |
|------|--------|
| `public/js/studio-canvas.js` | Grid overlay, drag ghost, collision detection, resize badge |
| `public/js/studio.js` | Queries tab, Data Sources tab, sidebar drag-sort, thumbnails |
| `public/studio.html` | New tab nav, query editor panel, data source panel HTML |
| `public/css/studio.css` | Overlay, ghost, tabs, query editor, thumbnail styles |

No server changes needed — all required endpoints already exist.

---

## Non-Goals

- Mobile/responsive layout
- Real-time collaboration (multiple users editing simultaneously)
- User authentication or role-based access control
- New widget types
- New data source integrations
