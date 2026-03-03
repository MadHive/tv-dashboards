# Query Preview & Data Source Explorer Design
**Date:** 2026-03-03
**Status:** Approved
**Scope:** Add run/preview capability to Sources and Queries tabs in the studio

---

## Problem

The Sources tab shows connection status and credential forms but no data. The Queries tab lists saved queries and shows raw rows on run, but no visual output. Engineers can't validate that a query returns the right data before assigning it to a widget — they have to save, assign, restart the service, then check the TV.

## Goal

One workflow: click a source → see its saved queries → run a query → see exactly how the data will look on the TV display → assign to a widget from there.

---

## Changes

### Sources Tab

Clicking a source row (GCP, BigQuery, VulnTrack) replaces the credential panel with a **source query panel** in the right pane showing:

1. **Source header** — name, status dot, "Edit Credentials" link (reopens credential form)
2. **Query list** — all saved queries for that source, one per row
3. **Expanded query** — click a query to expand it:
   - Widget type selector (Big Number, Gauge, Bar Chart, Stat Card)
   - **Run** button → fires the query, shows result
   - **Result preview** — small canvas rendered with the real `Widgets.create()` + `charts.js` code
   - **Assign to Widget** button

For unconfigured sources (grey dot) show a "No credentials — use Edit Credentials to connect" placeholder.

### Queries Tab Enhancement

The existing Queries tab query editor panel gains the same run/preview experience:
- Widget type selector added to the config strip
- Result preview canvas replaces / augments the raw data table
- "Assign to Widget" button

---

## Data Flow

```
User clicks Run
  → POST /api/queries/:source/test  (existing endpoint)
  → server runs the query against live data source
  → returns { success, source, results, executionTime }
  → client calls gcp.transformData() equivalent on the result
       OR sends data through the same path the TV uses
  → Widgets.create(selectedType, container, { type: selectedType })
  → widget.update(data)
  → canvas renders exact TV preview
```

**Key insight:** The query test endpoint returns raw results (rows for BigQuery, time series for GCP). The existing `gcp.js` `transformData()` method converts raw time series to `{ value, sparkline }`. For the preview we need to call the same transform.

The simplest approach: add a `GET /api/queries/:source/:id/preview` endpoint that:
1. Runs the query (same as test)
2. Transforms the result using the same path as widget rendering (`gcp.executeQuery()`)
3. Returns `{ widgetData: { value, sparkline, ... }, metricType, timePeriod }`

The client then calls `Widgets.create(selectedType, container, { type: selectedType })` and `widget.update(widgetData)`.

---

## UI Components

### Source Query Panel (right pane, Sources tab)

```
┌─ GCP Cloud Monitoring ──────────────────────────────────┐
│  ● Connected          [Edit Credentials]                 │
│                                                          │
│  Cloud Run Request Count               gcp  [▶ Run]     │
│    ┌─────────────────────────────────────────────────┐   │
│    │  Widget type: [Big Number ▼]                    │   │
│    │  ┌─────────────────┐                            │   │
│    │  │   42.1 /s       │  ← live canvas preview     │   │
│    │  │   ↑ +12%        │                            │   │
│    │  └─────────────────┘                            │   │
│    │  Ran in 340ms             [Assign to Widget]    │   │
│    └─────────────────────────────────────────────────┘   │
│                                                          │
│  Bidder Winner Candidates              gcp  [▶ Run]     │
│  Bigtable Read Rows                    gcp  [▶ Run]     │
│  ...                                                     │
│                                                          │
│  [+ New Query]  [Browse GCP Metrics]                    │
└──────────────────────────────────────────────────────────┘
```

### Preview Canvas

- Small fixed-size canvas (280×120px)
- Rendered using `window.Widgets.create(type, container, config)` + `widget.update(data)`
- Widget type defaults to `big-number` for GCP single-value queries, `bar-chart` for multi-value
- User can change type via dropdown — preview re-renders immediately

---

## Files to Change

| File | Change |
|------|--------|
| `server/index.js` | Add `GET /api/queries/:source/:id/preview` endpoint |
| `public/js/studio.js` | Replace `openDatasourceEditor` source panel with query list + preview |
| `public/js/studio.js` | Add `runQueryPreview(source, id, type)` method |
| `public/studio.html` | Add source query panel HTML |
| `public/css/studio.css` | Add preview canvas + query row styles |

---

## Success Criteria

- Click GCP in Sources → see all 46 GCP queries listed
- Click Run on any query → small widget renders in ~1 second showing real data
- Change widget type dropdown → preview re-renders
- Click Assign to Widget → canvas dims, click a widget to assign
- Unconfigured sources show a friendly placeholder
- Edit Credentials still accessible via a link
