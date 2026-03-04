# GCP Import Page — Design

**Date:** 2026-03-04
**Status:** Approved

## Goal

Replace the existing GCP import modal with a dedicated `/admin/import` page that lets engineers browse GCP Cloud Monitoring dashboards, preview each chart tile with live data, select a batch, and add them directly to the active TV dashboard — all in a single focused flow.

## User Workflow

```
/admin  →  [+ Import from GCP]  →  /admin/import

  1. Select GCP project (mad-master, mad-data, etc.)
  2. Browse 132 custom dashboards — search by name
  3. Click a dashboard → tile list appears in center panel
  4. Click a tile → live query runs, result renders in right panel
  5. Try different widget types in the preview
  6. Check the tiles you want (one or many)
  7. "Add N to Dashboard" → widgets dropped onto active TV dashboard
  8. Auto-redirect to /admin to fine-tune positions
```

## Architecture & Data Flow

All server endpoints already exist — no new backend work required.

```
GET  /admin/import        → import.html (new Elysia route)

Left panel:
  GET /api/gcp/dashboards?project=X   → dashboard list

Center panel:
  GET /api/gcp/dashboards/:name?project=X  → tile list

Right panel (live preview):
  POST /api/explore/gcp
    { metricType, filters, aggregation, timeWindow, widgetType }
  → { rawSeries, widgetData, executionMs }
  → window.Widgets.create(type, container, {})

"Add N to Dashboard":
  POST /api/queries/gcp          (save query — skipped if conflictId)
  POST /api/dashboards/:id/widgets  (add widget to TV dashboard)
  → redirect /admin
```

**New files:** `import.html`, `public/js/importer.js`, `public/css/importer.css`
**Reused:** All 4 API endpoints, `window.Widgets`, `window.Charts`, `dashboard.css`

## Three-Panel UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Studio    Import from GCP                    [mad-master ▾]      │
├──────────────┬──────────────────────────┬──────────────────────────┤
│  Dashboards  │  Bidder Overview         │  Live Preview            │
│  ──────────  │  ─────────────────────── │  ──────────────────────  │
│  🔍 search   │  ☑ Winner Candidates     │                          │
│              │    custom/.../winner_... │  ┌──────────────────┐   │
│  Bidder    ▶ │  ☑ Bid Request Rate      │  │   142.3 req/s   │   │
│  Overview    │    custom/.../bid_req... │  │   Last 30 min   │   │
│              │  ☐ LB 503s    ⚠ exists  │  └──────────────────┘   │
│  Cloud Run   │    run.googleapis...     │                          │
│  Services    │  ☑ Kafka Writes          │  Type: [Big Number ▾]   │
│              │    custom/.../kafka...   │  Time: [30 min ▾]       │
│  Kafka       │  ─────────────────────── │                          │
│  Pipeline    │  3 selected              │  ✓ 2 series · 847ms     │
│              │                          │                          │
└──────────────┴──────────────────────────┴──────────────────────────┘
                                           [Add 3 to Dashboard]
```

### Left panel (220px fixed)
- Project tabs (mad-master, mad-data, mad-audit, mad-looker-enterprise)
- Search box filters by dashboard name
- Dashboard list — active row highlighted, click loads tiles in center

### Center panel (flex-1)
- Tile list with checkboxes
- ⚠ conflict badge if `conflictId` present (query already saved)
- Greyed out + unselectable if no parseable `metricType`
- Clicking a tile loads live preview in right panel (independent of checkbox)
- Selection count at bottom

### Right panel (320px fixed)
- Live widget preview via `window.Widgets.create()`
- Widget type selector (big-number, stat-card, gauge, line-chart, bar-chart, table)
- Time window selector (5m, 10m, 30m, 1h, 6h)
- Status badge (see Validation section)
- "Add N to Dashboard" button — enabled when ≥1 tile checked

## Live Preview & Validation

**On tile click:** fires `POST /api/explore/gcp` with tile's metricType/filters/aggregation + selected time window.

**Status badge states:**

| State | Badge |
|---|---|
| Querying | `⟳ Querying GCP…` (grey) |
| Data returned | `✓ N series · Xms` (green) |
| Empty result | `⚠ No data for this time window` (amber) |
| GCP error | `✗ error message` (red) |

Tiles are addable regardless of status — the user decides whether to include an empty or erroring metric.

**Auto-suggested widget type** based on result shape:
- Single series → `big-number` (default)
- Multi-series (>1) → `bar-chart`
- Distribution value → `gauge`

Type selector defaults to suggestion; user can override. Preview re-renders on type/time change without re-fetch (client-side re-transform, same as Query Explorer).

## "Add N to Dashboard" Flow

For each checked tile (in parallel):
1. If no `conflictId`: `POST /api/queries/gcp` to save query
2. `POST /api/dashboards/:id/widgets` to add widget at next available grid position
   - Widget: `{ type: selectedWidgetType, source: 'gcp', queryId, title: tile.name, colSpan: 1, rowSpan: 1 }`

Toast: `N widgets added to [Dashboard Name]` with link to Studio.
Auto-navigate to `/admin` after 1.5s.

**Dashboard selector:** shown at top of right panel — defaults to the dashboard that was last active in Studio (stored in `localStorage['lastActiveDash']`). Dropdown lists all dashboards if user wants to target a different one.

## Navigation Changes

**Studio top bar:** New `[+ Import from GCP]` button → navigates to `/admin/import`

**Studio Queries toolbar:** Existing `↓ Import from GCP` button → changed to navigate to `/admin/import` (replaces the modal)

**Import page top bar:** `← Back to Studio` link → navigates to `/admin`

## Studio Sidebar Width Fix

- Default sidebar width: increased from ~220px to `280px`
- Add `resize: horizontal; overflow: hidden; min-width: 200px; max-width: 520px` so the user can drag it wider
- A subtle drag handle visual (2px border-right with a grab cursor indicator)

## Out of Scope

- Editing metric configuration on the import page (do that in Studio after adding)
- Importing more than 1 project's dashboards simultaneously
- Layout arrangement before adding (use Studio canvas for that)
