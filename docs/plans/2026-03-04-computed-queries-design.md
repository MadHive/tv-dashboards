# Computed Queries — Design

**Date:** 2026-03-04
**Status:** Approved

## Goal

Migrate the 11 legacy widgets (using hardcoded `gcp-metrics.js` dispatcher functions) into the query engine so they become editable in the Studio properties panel and explorable in the Query Explorer — without changing the underlying computation logic.

## Background

81 total widgets in the system:
- **58** — already on the query engine (have `queryId`)
- **11** — legacy path (no `queryId`, dispatched via `getMetrics(dashboardId)`)
- **12** — mock/static in visual-showcase (intentionally not migrated)

The 11 legacy widgets were left behind because they involve complex multi-metric computations that a single GCP metric query cannot represent. This design introduces a `computed` source type that wraps named server functions as first-class queryable entities.

## Widget-to-Function Mapping

| Widget ID | Dashboard | `computed` function | Shared |
|---|---|---|---|
| `storage-volume` | platform-overview | `storageVolume` | ×2 |
| `storage-volume` | data-processing | `storageVolume` | ×2 |
| `fleet-health` | services-health | `fleetHealth` | |
| `response-time` | services-health | `serviceLatency` | |
| `usa-delivery-map` | campaign-delivery | `campaignDeliveryMap` | ×3 |
| `usa-delivery-map-ne` | campaign-delivery-northeast | `campaignDeliveryMap` | ×3 |
| `usa-delivery-map-se` | campaign-delivery-southeast | `campaignDeliveryMap` | ×3 |
| `core-cluster-size` | rtb-infra | `coreClusterSize` | |
| `pipeline` | data-pipeline | `pipelineFlow` | |
| `error-rate` | bidder-cluster | `bidderErrorRate` | |
| `timeout-rate` | bidder-cluster | `bidderTimeoutRate` | |

11 widgets → 8 distinct functions (3 shared).

## Architecture

```
queries.yaml
  computed:
    - id: storage-volume
      name: Storage Volume
      function: storageVolume
      widgetTypes: [stat-card]
    - id: fleet-health
      name: Fleet Health
      function: fleetHealth
      widgetTypes: [gauge]
    ... (8 total entries)

dashboards.yaml (11 widgets updated)
  - id: fleet-health
    source: computed        ← was: no source (legacy)
    queryId: fleet-health   ← new

server/data-sources/computed.js  (new)
  ComputedDataSource extends DataSource
    fetchMetrics(widgetConfig)
      → getQuery('computed', widgetConfig.queryId)
      → FUNCTION_REGISTRY[entry.function](entry.params, widgetConfig)
      → returns { data: widgetData }

server/gcp-metrics.js  (modified)
  → 8 new named exports extracted from dashboard dispatchers
  → getMetrics() dispatcher continues to call them (backward compat)

server/explore-routes.js  (modified)
  POST /api/explore/computed
  → body: { function, params? }
  → returns { success, widgetData, rawData: [{label,value}], executionMs }

public/js/query-explorer.js  (modified)
  → add 'computed' option to source selector
  → computed builder: function dropdown + optional params JSON field
```

## computed queries.yaml Entries

```yaml
computed:
  - id: storage-volume
    name: Storage Volume
    description: Combined storage bytes across BigQuery, Bigtable, and GCS (mad-data + mad-master)
    function: storageVolume
    widgetTypes: [stat-card]
  - id: fleet-health
    name: Fleet Health
    description: Percentage of Cloud Run services currently receiving requests
    function: fleetHealth
    widgetTypes: [gauge]
  - id: service-latency
    name: Median Service Latency
    description: Median request latency across all Cloud Run services
    function: serviceLatency
    widgetTypes: [gauge]
  - id: campaign-delivery-map
    name: Campaign Delivery Map
    description: USA delivery heatmap — BigQuery impression data + GCP data center arcs
    function: campaignDeliveryMap
    params: {}
    widgetTypes: [usa-map]
  - id: campaign-delivery-map-ne
    name: Campaign Delivery Map (Northeast)
    description: Northeast region delivery heatmap
    function: campaignDeliveryMap
    params: { region: northeast }
    widgetTypes: [usa-map]
  - id: campaign-delivery-map-se
    name: Campaign Delivery Map (Southeast)
    description: Southeast region delivery heatmap
    function: campaignDeliveryMap
    params: { region: southeast }
    widgetTypes: [usa-map]
  - id: core-cluster-size
    name: Core Cluster Nodes
    description: Total active nodes across bidder, roger, and memcached
    function: coreClusterSize
    widgetTypes: [stat-card]
  - id: pipeline-flow
    name: End-to-End Data Flow
    description: Pipeline stage flow with ingest, transform, store, process, deliver, report rates
    function: pipelineFlow
    widgetTypes: [pipeline-flow]
  - id: bidder-error-rate
    name: Bidder Error Rate
    description: Percentage of LB requests with non-2xx, non-503 response codes
    function: bidderErrorRate
    widgetTypes: [stat-card]
  - id: bidder-timeout-rate
    name: Bidder Timeout Rate
    description: Percentage of LB requests with 408 or 504 response codes
    function: bidderTimeoutRate
    widgetTypes: [gauge]
```

## ComputedDataSource

`server/data-sources/computed.js` — follows the same `DataSource` interface as `gcp.js`:

- `fetchMetrics(widgetConfig)` — loads query entry, resolves function, returns `{ data }`
- `FUNCTION_REGISTRY` — maps function name strings to callables imported from `gcp-metrics.js`
- Registered in `server/data-source-registry.js` as source `'computed'`

## gcp-metrics.js Changes

Eight new named exports extracted from the existing dashboard dispatcher functions. The functions are identical in implementation — they're just promoted from private inner functions to named exports:

```
storageVolume()        ← from platformOverview() + dataProcessing()
fleetHealth()          ← from servicesHealth()
serviceLatency()       ← from servicesHealth()
campaignDeliveryMap(p) ← from campaignDeliveryMap() (already has widgetConfig param)
coreClusterSize()      ← from rtbInfra()
pipelineFlow()         ← from dataPipeline()
bidderErrorRate()      ← from bidderCluster()
bidderTimeoutRate()    ← from bidderCluster()
```

The existing `getMetrics()` dispatcher continues to call these functions — no regression.

## rawData Format for Query Explorer

Each function returns `rawData` alongside `widgetData`:

```js
// storageVolume example
rawData: [
  { label: 'BigQuery (mad-data)',    value: 1.2e12 },
  { label: 'BigQuery (mad-master)',  value: 3.4e11 },
  { label: 'Bigtable (mad-master)',  value: 8.7e11 },
  { label: 'GCS (mad-data)',         value: 2.1e11 },
  { label: 'GCS (mad-master)',       value: 4.5e10 },
]
```

## Query Explorer UI Changes

- Source selector gains `<option value="computed">Computed</option>`
- Computed builder panel: function name `<select>` populated from `/api/queries/computed` + optional `params` JSON `<textarea>`
- Results table renders `rawData` rows (label | value)
- Widget preview renders `widgetData` as normal

## Studio Properties Panel

When `source === 'computed'`:
- Shows function name (read-only label)
- Shows query name from the computed entry
- Shows editable params JSON for functions that accept params (`campaignDeliveryMap`)
- ▶ Run Preview calls `/api/queries/computed/:id/preview`

## Error Handling

| Scenario | Behavior |
|---|---|
| Unknown function name | Log error, return empty widget data |
| Sub-metric GCP call fails | Function returns partial data / zero (existing resilience) |
| Widget has `source: computed` but query not in yaml | Falls back to legacy `getMetrics()` — no regression |
| Explorer: function throws | `{ success: false, error }` — red banner |

## Migration Order (Non-Destructive)

1. Add 8 named exports to `gcp-metrics.js`
2. Add 10 computed entries to `queries.yaml`
3. Build `server/data-sources/computed.js` + register it
4. Add `POST /api/explore/computed` to `explore-routes.js`
5. Add Computed source to Query Explorer UI (`query-explorer.js`)
6. Update `dashboards.yaml` — 11 widgets get `source: computed` + `queryId`
7. Update Studio properties panel for `computed` source (`studio.js`)

Steps 1–5 testable without touching dashboards.yaml. Step 6 flips the switch.

## Files Touched

**New:**
- `server/data-sources/computed.js`

**Modified:**
- `server/gcp-metrics.js` — 8 new named exports
- `server/data-source-registry.js` — register ComputedDataSource
- `server/explore-routes.js` — add `POST /api/explore/computed`
- `config/queries.yaml` — add `computed:` section (10 entries)
- `config/dashboards.yaml` — 11 widgets updated
- `public/js/query-explorer.js` — computed source option + builder panel
- `public/js/studio.js` — computed source properties panel

**Tests:**
- `tests/unit/data-sources/computed.test.js`
- `tests/unit/routes/explore-routes.test.js` — extend with computed tests
