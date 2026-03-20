# Phase 3: Query & Data Workflow - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin users can build and test queries against any connected source from within the editor, preview live results before assigning them to widgets, and see the health of every data source at a glance. The existing query-editor-panel, MetricBrowser, and data-source health API are the foundations to build on and extend.

</domain>

<decisions>
## Implementation Decisions

### Query Builder Entry Points (QRYX-01)
- **Two entry points:**
  1. **Widget properties panel** — "Build Query" button in the Data section of the properties panel opens the builder scoped to the selected widget
  2. **Queries sidebar tab** — "+ New Query" button creates a freestanding query not yet tied to any widget
- **Layout**: Claude decides whether to reuse the existing `query-editor-panel` slot (right panel) or open a modal — the existing panel approach is preferred for widget-scoped queries (consistent with current pattern); a modal or expanded panel for freestanding new queries from the sidebar
- After running and verifying a query: **one-click "Assign to widget" button** appears in the result panel — sets the widget's `queryId` (and `source`) and closes the builder. This is for the widget-scoped flow.
- For freestanding queries from the Queries tab: save to library, then user can assign from widget properties picker (existing flow)

### Query Result Preview (QRYX-02)
- Live result preview shown immediately after running a query (no separate step)
- Result preview is embedded in the query builder — not a separate modal
- Format: Claude decides (table for structured data, JSON fallback for raw/custom results, summary stats for time-series)
- Truncation for large result sets: Claude decides the row/byte limit

### Data Source Health Dashboard (DSRC-01)
- **Location**: Dedicated collapsible "HEALTH" section at the top of the Sources tab (above the existing source list)
- **Shown per source**: Status (connected / disconnected / mock with color coding), last error message, last-success timestamp, error count in the current session
- **Auto-refresh**: Health data refreshes on tab open and every 30s while Sources tab is active (Claude decides exact polling interval)
- **Data source**: `GET /api/data-sources/health` already returns `{ isConnected, isReady, lastError }` — extend if needed for timestamps/error counts

### Credential Validation (DSRC-02)
- Claude decides the validation flow based on the existing credential save flow (`PUT /api/data-sources/:name/credentials`)
- Minimum: client-side format check (non-empty, basic structure validation) + server-side whitelist enforcement (already implemented via `server/data-source-env-map.js`)
- Recommended approach: validate format client-side first, then attempt a lightweight connection test server-side before committing the save — surface errors with actionable copy

### Unified Metric Browser (METR-01)
- **Sources shown**: All sources where `isConnected=true` are dynamically included, plus GCP always shown (primary source)
- **Named sources in scope**: GCP Cloud Monitoring, BigQuery, VulnTrack (plus any other currently connected sources)
- **Per-source discovery**:
  - GCP: existing `GET /api/gcp/metrics/descriptors` (9,417 metrics) — already in MetricBrowser
  - BigQuery: Claude decides (schema discovery if API supports it, static manifest of known mad-data tables as fallback)
  - VulnTrack: Static curated list of available metric endpoints
  - Future sources: register their own metric manifests (extensible pattern)
- **What happens on metric selection**: Claude decides — existing GCP browser assigns directly to widget; unified browser should follow same pattern (assign source + queryId to widget, close browser). Preview before assign is optional and at Claude's discretion.
- **Browser UI**: Extend the existing `MetricBrowser` class and `metric-browser-modal` rather than building a new one — add a source selector sidebar alongside the existing GCP service sidebar

### Carried Forward (from Phase 1/2)
- Manual Save button model — credential changes require explicit save
- `showToast()` for success/error feedback
- `markDirty()` + `renderCanvas()` as the change propagation pattern

### Claude's Discretion
- Query builder panel placement (reuse existing slot vs modal)
- Result preview format per data source type (table vs JSON vs summary)
- Row/byte truncation limit for large results
- Health dashboard auto-refresh interval (suggested: 30s)
- Credential validation — exact flow (format check + connection test recommended)
- BigQuery metric discovery approach (dynamic schema vs static manifest)
- Metric browser assignment flow (direct assign vs preview-then-assign)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Query Editor
- `public/js/studio.js` lines 2252+ — `openQueryEditor(query, source)`, `_runQuery()`, `_bindQueryEditorActions()` — existing query editor panel logic to extend
- `public/studio.html` lines 506+ — `#query-editor-panel` — existing HTML panel structure

### Data Source Architecture
- `server/index.js` line 634 — `GET /api/data-sources/health` — returns `{ name, isConnected, isReady, lastError }` per source
- `server/index.js` line 607 — `GET /api/data-sources` — full source list with status
- `server/data-source-env-map.js` — credential key whitelist per source (enforces what can be saved)
- `server/env-writer.js` — writes credentials to `.env`; called by `PUT /api/data-sources/:name/credentials`

### GCP Metrics / Existing Metric Browser
- `public/js/studio.js` lines 2566+ — `MetricBrowser` class — extend for unified browser
- `public/studio.html` — `#metric-browser-modal` — existing modal to extend
- `server/index.js` — `GET /api/gcp/metrics/descriptors?project=mad-master` — 9,417 GCP metrics

### Project Constraints
- `.planning/PROJECT.md` — Vanilla JS, no frameworks, no TypeScript, no build step
- `.planning/REQUIREMENTS.md` — QRYX-01, QRYX-02, DSRC-01, DSRC-02, METR-01 success criteria

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `query-editor-panel` in `studio.html` — existing right-panel query editor with run button; extend rather than replace
- `openQueryEditor(query, source)` in `studio.js` — opens the query editor panel; add a widget-scoped variant
- `_runQuery()` in `studio.js` — existing query execution; reuse for the inline builder's Run action
- `MetricBrowser` class in `studio.js` — extend with source selector sidebar for unified browser
- `metric-browser-modal` in `studio.html` — existing modal structure; add a source-tab strip alongside the GCP service sidebar
- `GET /api/data-sources/health` — health data already available server-side
- `showToast(msg, type)` — feedback toasts for success/error states
- `markDirty()` + `renderCanvas()` — standard change propagation

### Established Patterns
- Right-panel slot (properties-content) can show different panels via `style.display` toggle — same pattern for query builder
- Sources tab already lists sources with status dots; extend the existing DOM rather than replacing
- Credential save flow: form inputs → `PUT /api/data-sources/:name/credentials` → `reinitializeSource()` hot-reload

### Integration Points
- Widget properties panel "Data" section — add "Build Query" button that opens query editor with widget context
- Queries sidebar tab — add "+ New Query" button that opens freestanding query editor
- Sources tab — add collapsible HEALTH section above existing source list
- `MetricBrowser.open(wc)` called from properties panel — extend to support all sources, not just GCP

</code_context>

<specifics>
## Specific Ideas

- The "Build Query" button in the widget properties panel should open the query editor pre-populated with the widget's current `source` and `queryId` (if any)
- The health dashboard "HEALTH" section should be collapsed by default (consistent with the existing collapsible sidebar sections) and expand on click
- The unified metric browser source selector should appear as a top-level tab strip or sidebar — similar to how the GCP browser has a services sidebar — with "GCP", "BigQuery", "VulnTrack" (and any other connected sources) as tabs

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within Phase 3 scope

</deferred>

---

*Phase: 03-query-data-workflow*
*Context gathered: 2026-03-20*
