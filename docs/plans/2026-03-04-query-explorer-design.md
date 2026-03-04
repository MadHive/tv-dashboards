# Query Explorer Design

**Date:** 2026-03-04
**Status:** Approved

## Goal

Add an interactive Query Explorer to the Studio that lets engineers run ad-hoc queries against any data source, inspect raw results, preview the resulting widget, and save or assign the query — without leaving the Studio. Phase 2 adds Cloud Logging, Cloud Trace, OTel Collector sources and an automated assertion/health-check system.

## Phasing

| Phase | Scope |
|---|---|
| **1 (this plan)** | Explorer modal, GCP Metrics + BigQuery builders, raw results table, widget preview, Save/Assign actions |
| **2 (follow-up)** | Cloud Logging, Cloud Trace, OTel Collector sources; automated assertion system (`assertions.yaml`, health tab) |

The modal shell is built to accept Phase 2 sources without structural changes — greyed-out source options are present from day one.

---

## Architecture & Data Flow

```
Studio Queries tab
  └── "⬡ Explorer" button → full-screen explorer modal (studio-modal)

Explorer Modal (3-panel flex layout)
  ┌─────────────────┬──────────────────────┬────────────────┐
  │  Query Builder  │    Raw Results       │ Widget Preview │
  │  (left ~30%)   │    (center ~45%)     │  (right ~25%)  │
  │                 │                      │                │
  │  Source select  │  Time series table   │  Type select   │
  │  Query fields   │  or raw rows         │  Live canvas   │
  │  [▶ Run]        │  Export CSV          │  Unit / Max    │
  └────────┬────────┴──────────────────────┴────────────────┘
           │  [Save as Query]  [Save as New]  [Assign to Widget]
           │  [Create Assertion  ·Phase 2·]
           ▼
    POST /api/explore/gcp        POST /api/explore/bigquery
    → { timeSeries, widgetData } → { rows, widgetData }
```

**Two new server endpoints:**

- `POST /api/explore/gcp` — body: `{ metricType, project, timeWindow, aggregation, filters, widgetType }` → returns `{ success, timeSeries: [...], widgetData: {...}, executionMs }`
- `POST /api/explore/bigquery` — body: `{ sql, project, widgetType }` → returns `{ success, rows: [...], widgetData: {...}, executionMs }` (LIMIT 200 enforced server-side)

Both differ from the existing `/api/queries/:id/preview` in that they operate on **unsaved** queries with full parameter control.

---

## Query Builder Panel (left)

Source selector at top. Switching source swaps the fields below it.

**GCP Metrics:**
- Metric Type text input + Browse button (opens existing `MetricBrowser` modal)
- Project selector (from `GCP_PROJECTS` env)
- Time Window select (5m, 10m, 30m, 1h, 6h, 24h)
- Aligner select (ALIGN_RATE, ALIGN_DELTA, ALIGN_MEAN, ALIGN_SUM, ALIGN_MAX)
- Reducer select (REDUCE_NONE, REDUCE_SUM, REDUCE_MEAN, REDUCE_MAX)
- Period select (60s, 300s, 600s, 3600s)
- Filters text input (e.g. `resource.type="k8s_container"`)

**BigQuery:**
- Project selector (mad-data, mad-master)
- SQL textarea (8 rows)
- Schema browser: dataset select → table select → column list (reuses existing `/api/bigquery/datasets` endpoints)

**Phase 2 sources** (greyed out in selector, not wired):
- Cloud Logging — filter string + time range + log name + project
- Cloud Trace — service + operation + latency threshold
- OTel Collector — Prometheus endpoint URL + PromQL expression

---

## Raw Results Panel (center)

Shows unprocessed data before widget transformation. Adapts to source.

**GCP Metrics — time series table:**
- Header: `N series · M data points · Xms`
- Columns: Timestamp | [resource label keys] | Value
- Series labels extracted from resource labels (service_name, subscription_id, etc.)
- Rows sorted by timestamp desc, capped at 500

**BigQuery — row table:**
- Header: `N rows · M columns · Xms`
- Auto-detected columns from first row
- Values truncated at 80 chars with full value in `title` attribute
- Capped at 200 rows (enforced server-side)

**Both:** Export CSV button (client-side data URI, no server round-trip)

**Error state:** Red banner, raw error message, monospace. Raw results and widget preview fail independently.

**Empty result:** Yellow info banner — not an error, widget preview shows zero/empty state.

---

## Widget Preview Panel (right)

Renders using `window.Widgets.create()` — identical to TV display.

- Type selector: big-number, stat-card, gauge, line-chart, bar-chart
- Type change re-transforms client-side from cached raw data — no re-fetch
- Unit text input (updates transform, re-renders instantly)
- Max number input (gauge only)
- Unsupported combinations show "Not supported for this data shape" message

---

## Action Bar (below all panels)

- **Save as Query** — saves current builder state via `POST /api/queries/:source`
- **Save as New** — same, but generates a new ID
- **Assign to Widget** — opens the existing widget selector flow
- **Create Assertion** — greyed out, Phase 2 tooltip

---

## Error Handling

| Scenario | Behavior |
|---|---|
| GCP auth failure | Red banner: "GCP authentication failed" |
| Invalid metric type | Red banner with GCP error verbatim |
| BigQuery syntax error | Red banner with BQ error message |
| Empty result | Yellow info banner: "Query returned no data" |
| Timeout >20s | Red banner: "Query timed out — try shorter window or add filters" |
| Network failure | Red banner: "Could not reach server" |

---

## Phase 2 — Assertion System (design preview)

Stored in `config/assertions.yaml`:

```yaml
assertions:
  - id: bidder-winner-candidates-healthy
    queryId: bidder-winner-candidates
    condition: value > 0
    severity: critical
    message: "Bidder winner candidates dropped to zero"
  - id: delivery-geo-has-data
    queryId: delivery-geo-map
    condition: row_count >= 10
    severity: warning
    message: "Delivery geo map has fewer than 10 zip codes"
```

New APIs: `GET /api/assertions`, `POST /api/assertions`, `POST /api/assertions/:id/run`, `POST /api/assertions/run-all`

Results surface in a new "Health" tab in the Studio sidebar.

---

## Files Touched

**New:**
- `server/explore-routes.js` — Elysia plugin for `/api/explore/gcp` and `/api/explore/bigquery`
- `public/js/query-explorer.js` — `QueryExplorer` class (modal, three panels, all interactions)
- `public/css/query-explorer.css` — explorer-specific styles

**Modified:**
- `server/index.js` — mount `exploreRoutes`
- `public/studio.html` — Explorer button in Queries toolbar, modal skeleton, CSS `<link>`
- `public/js/studio.js` — instantiate `QueryExplorer` in `StudioApp.init()`

**Tests:**
- `tests/unit/routes/explore-routes.test.js` — unit tests for both endpoints
