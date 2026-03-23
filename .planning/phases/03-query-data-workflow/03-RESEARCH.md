# Phase 3: Query & Data Workflow - Research

**Researched:** 2026-03-20
**Domain:** Vanilla JS studio extension — query builder, data source health, credential validation, unified metric browser
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Query Builder Entry Points (QRYX-01)**
- Two entry points: (1) "Build Query" button in widget properties panel Data section, scoped to selected widget; (2) "+ New Query" button in Queries sidebar tab for freestanding queries
- Panel approach preferred for widget-scoped queries (reuse `#query-editor-panel` slot); modal or expanded panel for freestanding new queries
- After run + verify: one-click "Assign to Widget" closes builder and sets widget's `queryId`+`source`
- Freestanding queries: save to library, then assign from widget properties picker (existing flow)

**Query Result Preview (QRYX-02)**
- Live result preview shown immediately after running — no separate step
- Result preview embedded in query builder — not a separate modal
- Format decided by Claude (table / JSON pre / summary stats)
- Truncation at 100 rows max, display truncation notice below table

**Data Source Health Dashboard (DSRC-01)**
- Dedicated collapsible "HEALTH" section at top of Sources tab, above existing source list
- Per source: status dot, last error message, last-success timestamp, session error count
- Auto-refresh on tab open + every 30s while Sources tab is active
- Data from `GET /api/data-sources/health` — extend if needed for timestamps/error counts

**Credential Validation (DSRC-02)**
- Validation on "Save Credentials" button click (existing button, no layout change)
- Client-side format check first (non-empty, basic structure) then server-side `PUT /api/data-sources/:name/credentials`
- Server already enforces whitelist via `server/data-source-env-map.js`

**Unified Metric Browser (METR-01)**
- All `isConnected=true` sources shown dynamically, GCP always shown
- GCP: existing `GET /api/gcp/metrics/descriptors` — already in `MetricBrowser`
- BigQuery: static manifest of known `mad-data` tables as fallback
- VulnTrack: static curated list of available metric endpoints
- Extend existing `MetricBrowser` class and `#metric-browser-modal` — add source selector sidebar
- On metric selection: assign `source` + `queryId` to widget, close browser, `renderCanvas()`

**Carried Forward**
- Manual Save button model for credentials
- `showToast()` for all feedback
- `markDirty()` + `renderCanvas()` as change propagation pattern

### Claude's Discretion

- Query builder panel placement (reuse existing `#query-editor-panel` slot vs modal)
- Result preview format per data source type (table vs JSON vs summary stats)
- Row/byte truncation limit for large results
- Health dashboard auto-refresh interval (suggested: 30s)
- Credential validation exact flow (format check + connection test recommended)
- BigQuery metric discovery approach (dynamic schema vs static manifest)
- Metric browser assignment flow (direct assign vs preview-then-assign)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 3 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QRYX-01 | User can write and execute a query against any connected data source from within the admin UI | Existing `openQueryEditor()`, `_runQuery()`, `#query-editor-panel` slot, and `QueryExplorer` class are the foundation; "Build Query" button replaces `#new-query-btn` pattern in widget-scoped flow |
| QRYX-02 | User can preview live query results before assigning the query to a widget | `_renderQueryPreview()` already renders widget canvas previews; extend with table/JSON/summary-stats formats per result shape; "Assign to Widget" button appears post-run |
| DSRC-01 | User can view a health dashboard showing per-source status, last-success time, and recent errors | `GET /api/data-sources/health` returns `isConnected`, `isReady`, `lastError` per source; `lastSuccessAt` and session `errorCount` fields do not currently exist on the server and need to be added |
| DSRC-02 | User can validate credential format/auth before saving (client-side + server-side check) | Client-side format check → `PUT /api/data-sources/:name/credentials`; server whitelist already enforced; inline `.validation-error` elements are the prescribed error display |
| METR-01 | User can browse and search metrics across all connected data sources in a unified metric browser | `MetricBrowser` class extended with a source tab strip; GCP tab unchanged; BigQuery and VulnTrack use static manifests; tab list built from `GET /api/data-sources` at open time |
</phase_requirements>

---

## Summary

Phase 3 extends the existing MadHive TV Studio admin UI with query-building, data source health visibility, and unified metric browsing. The project is pure vanilla JS (no framework, no build step, no TypeScript), which means all work is DOM manipulation in `studio.js`, `studio.html`, and `studio.css`. The strong existing foundation — `openQueryEditor()`, `MetricBrowser`, `_runQuery()`, `renderDatasourceList()` — means Phase 3 is nearly entirely additive: wiring new entry points, extending existing classes, and adding new DOM sections to existing panels.

The most significant **gaps** between what exists today and what Phase 3 requires are: (1) the `getHealth()` server response does not include `lastSuccessAt` timestamps or session error counts — those fields must be added to the registry and the API; (2) the `_assignQueryToWidget()` flow currently enters a "click a widget" canvas-dim mode rather than the CONTEXT-specified one-click close-and-assign; (3) the metric browser is GCP-only and must gain a source-selector tab strip; and (4) the Sources tab needs a new collapsible HEALTH section with polling.

The `QueryExplorer` class (in `query-explorer.js`) is an existing full-featured ad-hoc modal that handles BigQuery datasets, schema browsing, run, save-as-query, and assign — it is a reference implementation for the "freestanding" new query flow from the Queries sidebar tab.

**Primary recommendation:** Treat this phase as DOM wiring + class extension work. Every requirement maps to an existing hook point; no new server routes are strictly required except for health field extensions.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Elysia.js | 1.2 | Server-side API route handler for health endpoint extension | Already used for all ~60 routes |
| Bun | current (runtime) | Test runner + server runtime | Project-wide runtime |
| Vanilla JS | ES2022 | All frontend logic — no framework | Project constraint |
| TypeBox (`@sinclair/typebox`) | project version | Runtime schema validation for any new API response fields | Already used in all Elysia route schemas |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `bun:test` | built-in | Unit + integration tests | All server-side and pure-function tests |
| `studio.css` + `dashboard.css` | project CSS | Styling — all Phase 3 elements follow existing CSS vars | Always; no new stylesheets for studio features |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static BigQuery manifest | Dynamic `GET /api/data-sources/bigquery/metrics` | Dynamic is cleaner long-term but requires BigQuery dataset introspection which is out-of-scope for this phase; static manifest ships faster and is explicitly chosen in CONTEXT |
| Polling with `setInterval` | WebSocket push | WebSocket is explicitly out of scope per REQUIREMENTS.md |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

No new files are strictly required. All Phase 3 changes target:

```
public/
├── js/
│   ├── studio.js               # All new UI logic: health section, Build Query button, MetricBrowser extension
│   └── query-explorer.js       # Reference for freestanding query flow (read-only during Phase 3)
├── studio.html                 # New HTML: HEALTH section, source tab strip in metric-browser-modal
└── css/
    └── studio.css              # New CSS rules for .health-row, .mb-source-tab, .validation-error, polling dot
server/
├── data-source-registry.js     # Add lastSuccessAt + sessionErrorCount fields to getHealth()
└── index.js                    # No new routes required; health endpoint already exists
tests/
└── unit/
    └── data-source-registry-health.test.js   # Wave 0 gap: test new health fields
```

### Pattern 1: Right-Panel Slot Toggle

**What:** `#query-editor-panel`, `#properties-content`, `#properties-placeholder`, `#multi-select-props`, and `#datasource-editor-panel` all live in the right panel. They are shown/hidden with `style.display` toggles. No routing, no component lifecycle.

**When to use:** Any new panel content in the right rail uses the same pattern.

**Example:**
```javascript
// Source: public/js/studio.js — openQueryEditor() line 2252
openQueryEditor(query, source) {
  const props = document.getElementById('properties-placeholder');
  const content = document.getElementById('properties-content');
  const qe = document.getElementById('query-editor-panel');
  if (props)   props.style.display   = 'none';
  if (content) content.style.display = 'none';
  if (qe)      qe.style.display      = 'flex';
  // ... populate fields
}
```

For widget-scoped "Build Query": call `openQueryEditor(wc, wc.source || 'gcp')` with widget context. Store `this._assignTargetWidgetId = widgetId` so the "Assign to Widget" button knows which widget to update directly (no canvas-dim mode — one-click assign).

### Pattern 2: Sidebar Tab Activation + Deferred Load

**What:** `bindSidebarTabs()` attaches a click handler to each `.sidebar-tab`. On activation it calls `renderQueryList()` or `renderDatasourceList()`. Extend this to start/stop health polling when the `datasources` tab activates/deactivates.

**When to use:** Any per-tab initialization logic — loading, polling setup.

**Example:**
```javascript
// Source: public/js/studio.js — bindSidebarTabs() line 2190
if (name === 'datasources') {
  this.renderDatasourceList();
  this._startHealthPolling();   // NEW: add for Phase 3
} else {
  this._stopHealthPolling();    // NEW: stop when leaving Sources tab
}
```

### Pattern 3: `setInterval` / `clearInterval` Polling

**What:** Health data auto-refreshes every 30s while Sources tab is active. Store interval ID as `this._healthPollInterval`. Start in `_startHealthPolling()`, clear in `_stopHealthPolling()`. Fetch `GET /api/data-sources/health` and re-render the HEALTH section.

**When to use:** Any timed background operation tied to a UI view.

**Example:**
```javascript
_startHealthPolling() {
  if (this._healthPollInterval) return;
  this._renderHealthSection();  // immediate first render
  this._healthPollInterval = setInterval(() => this._renderHealthSection(), 30_000);
}
_stopHealthPolling() {
  clearInterval(this._healthPollInterval);
  this._healthPollInterval = null;
}
```

### Pattern 4: Collapsible Sidebar Section

**What:** `.sidebar-section-header.collapsible` elements get click handlers from `bindCollapsibles()` (line 1812). The content sibling starts with `display:none` and is toggled by click. HEALTH section must follow this exact pattern to be consistent.

**When to use:** Any new collapsible section in the sidebar.

**HTML structure:**
```html
<!-- Source: studio.html — existing pattern -->
<div class="sidebar-section-header collapsible" id="health-section-header">
  HEALTH
  <span class="health-poll-dot" id="health-poll-dot" style="display:none"></span>
</div>
<div id="health-section-content" style="display:none">
  <!-- per-source health rows injected by JS -->
</div>
```

`bindCollapsibles()` already handles all `.sidebar-section-header.collapsible` — the HEALTH header will be auto-wired on init.

### Pattern 5: MetricBrowser Extension (Source Tab Strip)

**What:** `MetricBrowser.open(widgetConfig)` currently calls `_load()` which fetches GCP metrics. Extend by adding a source tab strip (`#mb-source-tabs`) above `#mb-services`. Each tab stores a `data-source` attribute. When a tab is clicked, clear the metric list and load source-specific data.

**When to use:** Adding non-GCP metric sources to the browser.

**Example flow:**
```javascript
// In MetricBrowser._buildSourceTabs()
// 1. Fetch GET /api/data-sources — filter isConnected=true sources
// 2. Always include 'gcp'; add 'bigquery', 'vulntrack' if connected
// 3. Render tab strip above #mb-services
// 4. GCP tab: existing _load() + _renderServiceSidebar()
// 5. BigQuery tab: render static mad-data table manifest as flat searchable list
// 6. VulnTrack tab: render static endpoint list
// 7. All tabs: reuse existing _filterAndRender() search pattern
```

### Pattern 6: Credential Validation (Client-Side First)

**What:** Two-phase — JS validates fields before the PUT. The credential form fields are rendered dynamically in `_loadCredentialForm(src)` from the source's schema. Client-side check: each required field must be non-empty and match basic format. If valid, call `PUT /api/data-sources/:name/credentials`. If server rejects, render `.validation-error` div at form top.

**When to use:** Any form submission that writes credentials.

**Example:**
```javascript
// Validation before PUT
function validateCredFields(fields) {
  const errors = [];
  fields.forEach(f => {
    const val = document.getElementById('cred-' + f.key)?.value?.trim();
    if (f.required && !val) errors.push({ key: f.key, msg: 'Required.' });
  });
  return errors;
}
```

The server's whitelist enforcement is already in place — client-side validation is additive protection and UX improvement only.

### Anti-Patterns to Avoid

- **Canvas-dim assign mode for widget-scoped flow:** The existing `_assignQueryToWidget()` dims the canvas and waits for a widget click. For the widget-scoped "Build Query" button, we already know the target widget — skip canvas-dim mode and assign directly using the stored `this._assignTargetWidgetId`.
- **Replacing existing DOM in the Sources tab:** The HEALTH section goes above the existing `#datasource-list`, not replacing it. Use `insertBefore` or place the HEALTH section first in the HTML and the existing source list below it.
- **WebSocket for health polling:** Do not use WebSocket. `setInterval` is the correct pattern.
- **New CSS files for studio features:** Do not create new CSS files for Phase 3 studio UI. Add rules to `studio.css`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Relative timestamp formatting ("5m ago") | Custom time-since function | Simple inline helper `formatRelativeTime(ts)` is acceptable since there's no date library | One-liner is fine; but don't build a date-formatting library |
| Collapsible section wiring | Custom collapsible JS | `bindCollapsibles()` — auto-wires all `.sidebar-section-header.collapsible` on init | Already handles all collapsibles |
| Toast notifications | Custom notification system | `this.showToast(msg, type)` | Already implemented, handles timing, CSS |
| Panel show/hide | CSS class toggles or animation | `style.display` toggle — matches all existing panels | Project uses display toggle exclusively |
| Query execution for preview | Direct GCP API calls | `GET /api/queries/:source/:id/preview?type=:widgetType` | Already implemented; returns `widgetData` shaped for widgets |

---

## Common Pitfalls

### Pitfall 1: Health Fields Missing from `getHealth()`
**What goes wrong:** `GET /api/data-sources/health` currently returns only `isConnected`, `isReady`, `lastError`. The DSRC-01 requirement specifies `lastSuccessAt` timestamp and session `errorCount`. These fields do not exist on the `DataSource` base class or in `getHealth()`.
**Why it happens:** The health endpoint was built for basic status; richer telemetry was not needed until now.
**How to avoid:** Add `lastSuccessAt` (set to `Date.now()` on each successful fetch in the base class) and `sessionErrorCount` (incremented on each `lastError` assignment) to `server/data-sources/base.js` and expose them in `DataSourceRegistry.getHealth()`. Update the health endpoint's response schema.
**Warning signs:** Health rows show "never" for all sources even when connected.

### Pitfall 2: `_assignQueryToWidget()` Canvas-Dim Breaks Widget-Scoped Flow
**What goes wrong:** The existing `_assignQueryToWidget()` puts the canvas in `assign-mode` and waits for a widget click. For the "Build Query" widget-scoped flow, the target widget is already known when the editor opens. Calling the existing method will force the user to click on the widget they started from — confusing UX.
**Why it happens:** The existing assign flow was designed for the Queries tab (freestanding) context, not widget-scoped.
**How to avoid:** Store `this._assignTargetWidgetId` when `openQueryEditor` is called from the widget properties panel. In the "Assign to Widget" click handler, check if `_assignTargetWidgetId` is set — if so, assign directly; if not, use the existing canvas-dim flow.
**Warning signs:** User opens query editor from widget, clicks "Assign to Widget", then has to click the same widget again on canvas.

### Pitfall 3: Metric Browser Tab List Not Updating Dynamically
**What goes wrong:** Tabs are built once on modal construction and don't reflect current source connection state.
**Why it happens:** Simple implementation that hard-codes tabs.
**How to avoid:** Fetch `GET /api/data-sources` at `MetricBrowser.open()` time (each open, not once at construction) and build the tab list from the live response. Disconnect sources must render greyed-out with `cursor: not-allowed`.
**Warning signs:** BigQuery tab appears even when BigQuery is disconnected.

### Pitfall 4: Polling Timer Leak
**What goes wrong:** Health polling interval survives tab switches; multiple intervals accumulate.
**Why it happens:** `setInterval` is called multiple times without clearing the previous one.
**How to avoid:** Guard with `if (this._healthPollInterval) return;` in `_startHealthPolling()`. Always `clearInterval` in `_stopHealthPolling()` before setting to `null`.
**Warning signs:** Multiple rapid health fetches visible in browser network tab.

### Pitfall 5: `bindCollapsibles()` Called Before HEALTH Section HTML Exists
**What goes wrong:** HEALTH section header is injected by JS after `bindCollapsibles()` runs, so it never gets a click handler.
**Why it happens:** `bindCollapsibles()` runs during `init()` which fires before dynamic content injection.
**How to avoid:** Either (a) include the HEALTH section header statically in `studio.html` (preferred — consistent with existing collapsible sections), or (b) manually attach the collapsible click handler after injecting the HEALTH section HTML.
**Warning signs:** HEALTH section header clicks do nothing.

### Pitfall 6: Elysia Schema Null Rejection
**What goes wrong:** If new health fields like `lastSuccessAt` can be `null` (no successful fetch yet), using `t.Optional(t.String())` will reject the `null` value and wrap the entire response in a validation error object.
**Why it happens:** Elysia uses TypeBox and `t.Optional()` alone does not accept `null` — only `undefined` (missing field). `null` requires `t.Nullable()`.
**How to avoid:** Use `t.Nullable(t.String())` for `lastSuccessAt` and `t.Nullable(t.Number())` for `sessionErrorCount` in any updated health response schema. Verified pattern from existing project code: `lastError: t.Optional(t.Nullable(t.String()))` in `server/models/data-source.model.js`.
**Warning signs:** `GET /api/data-sources/health` returns `{ type: 'validation', found: {...} }` instead of real data.

---

## Code Examples

Verified patterns from existing project source:

### Opening the Query Editor Panel (existing pattern to extend)
```javascript
// Source: public/js/studio.js line 2252
openQueryEditor(query, source) {
  const props = document.getElementById('properties-placeholder');
  const content = document.getElementById('properties-content');
  const qe = document.getElementById('query-editor-panel');
  if (props)   props.style.display   = 'none';
  if (content) content.style.display = 'none';
  if (qe)      qe.style.display      = 'flex';
  this._activeQuery  = { ...query };
  this._activeSource = source;
  // populate fields...
}
```

For widget-scoped "Build Query" — add `this._assignTargetWidgetId = widgetId` before calling `openQueryEditor`.

### Current `_assignQueryToWidget()` (to extend, not replace)
```javascript
// Source: public/js/studio.js line 2468
// Widget-scoped variant: skip canvas-dim, assign directly
_assignQueryToWidgetDirect(widgetId) {
  const q      = this._activeQuery;
  const source = this._activeSource;
  const dash   = this.modifiedConfig.dashboards[this.activeDashIdx];
  const wc     = dash && dash.widgets.find(w => w.id === widgetId);
  if (wc) {
    wc.source  = source;
    wc.queryId = q.id;
    this.markDirty();
    this.renderCanvas();
    this.showWidgetProps(widgetId);
    this.showToast('Query assigned', 'success');
    document.getElementById('query-editor-panel').style.display = 'none';
    document.getElementById('properties-content').style.display = '';
  }
}
```

### Health Row Construction (new DOM pattern)
```javascript
// Pattern: mirrors existing renderDatasourceList() dot logic (studio.js line 2827)
function buildHealthRow(src) {
  const row = document.createElement('div');
  row.className = 'health-row';
  const dot = document.createElement('span');
  dot.className = 'ds-status-dot ' + (
    src.isConnected ? 'green' :
    src.isReady === false && src.lastError ? 'red' : 'grey'
  );
  const name = document.createElement('span');
  name.className = 'ds-name';
  name.textContent = src.name;
  const ts = document.createElement('span');
  ts.className = 'health-timestamp';
  ts.textContent = src.lastSuccessAt ? formatRelativeTime(src.lastSuccessAt) : 'never';
  row.append(dot, name, ts);
  return row;
}
```

### Elysia Response Schema with Nullable Fields
```javascript
// Source: server/models/data-source.model.js — project pattern
// Use t.Nullable() for fields that can be null, not t.Optional() alone
lastError:      t.Optional(t.Nullable(t.String())),
lastSuccessAt:  t.Optional(t.Nullable(t.Number())),   // Unix timestamp ms
sessionErrors:  t.Optional(t.Nullable(t.Number())),
```

### Credential Validation Pattern (client-side)
```javascript
// Source: logic mirrors existing dse-save flow (studio.js line 3040)
function _validateCredForm(fields) {
  let valid = true;
  fields.forEach(f => {
    const input = document.getElementById('cred-' + f.key);
    const errEl = document.getElementById('cred-err-' + f.key);
    if (!input || !errEl) return;
    const val = input.value.trim();
    errEl.style.display = 'none';
    if (f.required && !val) {
      errEl.textContent = 'Required.';
      errEl.style.display = '';
      valid = false;
    }
  });
  return valid;
}
```

### `setInterval` Health Poll (new)
```javascript
_startHealthPolling() {
  if (this._healthPollInterval) return;
  this._renderHealthSection();
  this._healthPollInterval = setInterval(() => this._renderHealthSection(), 30_000);
  // Show polling indicator dot
  const dot = document.getElementById('health-poll-dot');
  if (dot) dot.style.display = '';
}

_stopHealthPolling() {
  clearInterval(this._healthPollInterval);
  this._healthPollInterval = null;
  const dot = document.getElementById('health-poll-dot');
  if (dot) dot.style.display = 'none';
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GCP-only metric browser | Extend `MetricBrowser` with source tab strip | Phase 3 (now) | BigQuery + VulnTrack browsable in same modal |
| Canvas-dim "click a widget" assign mode | Direct one-click assign for widget-scoped flow | Phase 3 (now) | Faster workflow when widget context is known |
| No health timestamps/error counts | Add `lastSuccessAt` + `sessionErrorCount` to base class | Phase 3 (now) | Health dashboard has meaningful data |

**Currently available but not yet wired:**

- `GET /api/data-sources/health` — exists, but health section in Sources tab does not yet exist
- `QueryExplorer` class (`query-explorer.js`) — already handles BigQuery dataset discovery, schema loading, save-as-query, assign — this is the existing freestanding query builder; the "+ New Query" Queries sidebar button should open this modal (or `openQueryEditor` with a blank template) rather than building new freestanding infrastructure
- `#new-query-btn` in widget Data section — currently calls `window.queryEditor.open()` (which may be undefined; `queryExplorer.open()` is the working path via `window.QueryExplorer`)
- `POST /api/data-sources/:name/test` — test connection endpoint already exists; used by `dse-test` button in credential editor; available for credential validation flow

---

## Open Questions

1. **`lastSuccessAt` tracking granularity**
   - What we know: `DataSource.lastError` is set per-fetch on failure; there is no success timestamp field
   - What's unclear: Should `lastSuccessAt` track the most recent successful `fetchMetrics()` call across all widget fetches, or only explicit health pings?
   - Recommendation: Track in `DataSource` base class — set `this.lastSuccessAt = Date.now()` in the success path of `fetchMetrics()` in `base.js`. This covers all real usage.

2. **`window.queryEditor` vs `window.QueryExplorer` reference**
   - What we know: `#new-query-btn` calls `window.queryEditor.open()` but the class is instantiated as `this.queryExplorer = new window.QueryExplorer(this)`. There is no `window.queryEditor` assignment visible in the loaded code.
   - What's unclear: Whether `window.queryEditor` is set elsewhere (another file) or is currently a dead reference
   - Recommendation: Planner should instruct implementer to verify by checking `studio.html` script loading order and confirm whether `window.queryEditor` is defined; if not, wire `#new-query-btn` to `this.queryExplorer.open()` as part of Phase 3

3. **BigQuery static manifest — which tables?**
   - What we know: CONTEXT says use static manifest of known `mad-data` tables
   - What's unclear: The exact table names in `mad-data` are not documented in the planning files
   - Recommendation: Implementer should run `GET /api/data-sources/bigquery/metrics` (if it returns useful data) or inspect `queries.yaml` for existing BigQuery query SQL to extract table names; use those as the static manifest

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun Test (built-in `bun:test`) |
| Config file | none — discovered automatically |
| Quick run command | `bun test tests/unit tests/integration --timeout 10000` |
| Full suite command | `bun test tests/unit tests/integration tests/helpers tests/components` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QRYX-01 | `openQueryEditor(query, source)` opens panel with widget context stored | unit | `bun test tests/unit/studio-query-builder.test.js -t "widget-scoped"` | ❌ Wave 0 |
| QRYX-01 | "+ New Query" Queries tab opens freestanding query builder | manual-only | — | — (UI-only DOM interaction) |
| QRYX-02 | Result preview renders table for array-of-objects, JSON pre for raw, summary stats for time-series | unit | `bun test tests/unit/studio-query-builder.test.js -t "result format"` | ❌ Wave 0 |
| QRYX-02 | "Assign to Widget" sets `queryId`+`source` on target widget, calls `renderCanvas` | unit | `bun test tests/unit/studio-query-builder.test.js -t "assign"` | ❌ Wave 0 |
| DSRC-01 | `getHealth()` returns `lastSuccessAt` and `sessionErrorCount` fields | unit | `bun test tests/unit/data-source-registry-health.test.js` | ❌ Wave 0 |
| DSRC-01 | `GET /api/data-sources/health` response includes new fields without schema rejection | integration | `bun test tests/integration/data-source-api.test.js -t "health"` | ✅ (exists; needs health-fields test added) |
| DSRC-02 | Client-side validation rejects empty required fields before PUT | unit | `bun test tests/unit/studio-credential-validation.test.js` | ❌ Wave 0 |
| DSRC-02 | Server rejects unknown credential key — existing coverage | integration | `bun test tests/integration/credentials-endpoint.test.js` | ✅ |
| METR-01 | Source tab list built from `GET /api/data-sources` — disconnected sources greyed | manual-only | — | — (DOM interaction) |
| METR-01 | BigQuery static manifest renders correct table list | unit | `bun test tests/unit/metric-browser-sources.test.js -t "bigquery manifest"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `bun test tests/unit --timeout 10000`
- **Per wave merge:** `bun test tests/unit tests/integration --timeout 15000`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/studio-query-builder.test.js` — covers QRYX-01 (widget context storage), QRYX-02 (result format selection, assign behavior); pure-function tests mirroring the clipboard test pattern
- [ ] `tests/unit/data-source-registry-health.test.js` — covers DSRC-01 (`lastSuccessAt` set on success, `sessionErrorCount` incremented on error, `getHealth()` exposes fields)
- [ ] `tests/unit/studio-credential-validation.test.js` — covers DSRC-02 client-side format check (pure function, no DOM)
- [ ] `tests/unit/metric-browser-sources.test.js` — covers METR-01 BigQuery static manifest content and tab-visibility logic

---

## Sources

### Primary (HIGH confidence)

- `public/js/studio.js` (lines 2252–2502, 2190–2204, 2808–2843) — `openQueryEditor`, `bindSidebarTabs`, `renderDatasourceList` — direct code inspection
- `public/js/query-explorer.js` — existing freestanding query builder class — direct code inspection
- `public/studio.html` (lines 290–323, 506–578, 620) — Data section, `#query-editor-panel`, `#metric-browser-modal` — direct code inspection
- `server/data-source-registry.js` (lines 245–255) — `getHealth()` current implementation — direct code inspection
- `server/data-sources/base.js` — `DataSource` base class fields — direct code inspection
- `server/index.js` (lines 634–643) — health endpoint — direct code inspection
- `.planning/phases/03-query-data-workflow/03-CONTEXT.md` — locked decisions
- `.planning/phases/03-query-data-workflow/03-UI-SPEC.md` — visual contract
- `server/models/data-source.model.js` — `t.Nullable()` pattern for null fields

### Secondary (MEDIUM confidence)

- `tests/unit/studio-clipboard.test.js` — confirmed test pattern: pure-function extraction for DOM-bound logic, `bun:test` imports
- `tests/integration/credentials-endpoint.test.js` — confirmed integration test pattern: `app.handle(new Request(...))` pattern

### Tertiary (LOW confidence)

- BigQuery `mad-data` table names — inferred from `queries.yaml` reference in MEMORY.md, not directly inspected; implementer should verify

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies
- Architecture patterns: HIGH — directly read from source; all patterns are extensions of existing code
- Pitfalls: HIGH — each identified from actual code gaps (health fields missing, existing assign flow behavior, collapsible timing)
- Test strategy: HIGH — confirmed `bun:test` pattern, existing test directory structure, gap list derived from requirement analysis

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable vanilla JS project; no fast-moving dependencies)
