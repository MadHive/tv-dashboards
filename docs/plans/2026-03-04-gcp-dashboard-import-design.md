# GCP Dashboard Import — Design

**Date:** 2026-03-04
**Status:** Approved

## Goal

Import metric queries from GCP Cloud Monitoring console dashboards into the local `queries.yaml` so they can be assigned to TV dashboard widgets. Scope: harvest metrics only (no layout recreation).

## Architecture & Data Flow

```
google-auth-library (existing)
  └── server/gcp-dashboards.js  (new)
        ├── listDashboards(project)   → GCP REST GET /v1/projects/{p}/dashboards
        ├── getDashboard(project, id) → GCP REST GET /v1/projects/{p}/dashboards/{id}
        └── parseTiles(dashboard)    → extracts { name, metricType, filters, aggregation }
                                        from XyChart / Scorecard tiles

  └── new Elysia route group (mounted in server/index.js)
        GET  /api/gcp/dashboards           ?project=mad-master  → list dashboards
        GET  /api/gcp/dashboards/:name     ?project=mad-master  → tiles for one dashboard

  └── Studio (public/js/studio.js + studio.css)
        Queries tab  →  "Import from GCP Dashboards" button
          → modal: project selector + dashboard list
            → click dashboard → tile list with checkboxes
              → "Import Selected" → per-conflict resolution (skip/overwrite)
                → POST /api/queries/gcp  (existing endpoint) for each tile
```

**Extracted per tile:**
- `name` — chart/widget title
- `metricType` — parsed from `timeSeriesFilter.filter` string (e.g. `metric.type="run.googleapis.com/request_count"`)
- `filters` — remaining label matchers from the filter string
- `aggregation` — `perSeriesAligner`, `crossSeriesReducer`, `alignmentPeriod`
- `project` — selected at import time
- `id` — slugified name + short timestamp hash (e.g. `winner-candidates-a3f2`)

## Implementation Approach

**Server module (`server/gcp-dashboards.js`):**
- Uses `google-auth-library` (`GoogleAuth`) to obtain an access token — same credential file already used by `gcp-metrics.js`
- Makes authenticated `fetch()` calls to `https://monitoring.googleapis.com/v1/projects/{project}/dashboards`
- `parseTiles()` walks `dashboard.mosaicLayout.tiles[].widget` or `dashboard.gridLayout.widgets[]`, extracts from `xyChart.dataSets[].timeSeriesQuery.timeSeriesFilter` and `scorecard.timeSeriesQuery.timeSeriesFilter`
- Multi-dataset tiles produce one row per dataset, named `Title (1)`, `Title (2)` etc.

**New API routes (new Elysia plugin, mounted in `server/index.js`):**
- `GET /api/gcp/dashboards?project=mad-master` — returns `{ dashboards: [{ name, displayName, tileCount }] }`
- `GET /api/gcp/dashboards/:name?project=mad-master` — returns `{ tiles: [{ name, metricType, filters, aggregation, conflictId? }] }` where `conflictId` is set if an existing query in `queries.yaml` already uses that `metricType`

**Studio UI (`public/js/studio.js` + `public/css/studio.css`):**
- "Import from GCP Dashboards" button in Queries tab toolbar
- Two-step modal (no page navigation):
  - **Step 1:** Project selector tabs + scrollable dashboard list
  - **Step 2:** Tile checklist with ⚠ conflict indicators; "Import Selected" button
- Conflict prompt per conflicting tile on import: **Skip / Overwrite**
- Summary toast on completion: `N imported, M skipped`

## Error Handling

| Scenario | Behavior |
|---|---|
| No dashboards in project | Empty state: "No custom dashboards found" |
| API auth failure | Red banner in modal: "Could not connect to GCP" |
| Individual tile parse failure | Skip tile silently, log server-side |
| Tile has no metricType (text/alert widgets) | Greyed out, unselectable |
| Missing aggregation fields | Fall back to defaults: ALIGN_MEAN, 60s period |

## Widget Types Parsed

| GCP Widget Type | Extractable | Notes |
|---|---|---|
| `xyChart` | Yes | Primary target; `dataSets[].timeSeriesQuery.timeSeriesFilter.filter` |
| `scorecard` | Yes | `timeSeriesQuery.timeSeriesFilter.filter` |
| `text` | No | No metric query |
| `alertChart` | No | References alert policy, not a raw metric |
| `collapsibleGroup` | No | Container only |

## Out of Scope

- Recreating GCP dashboard layout as a TV dashboard
- Importing Looker or other dashboard types
- Scheduling/syncing (one-shot import only)
