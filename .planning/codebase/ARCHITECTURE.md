# Architecture

**Analysis Date:** 2026-03-20

## Pattern Overview

**Overall:** Layered plugin-based system with clean separation between backend API, frontend display, and editor.

**Key Characteristics:**
- Plugin-based data source architecture with hot-reloadable registry
- YAML-driven configuration persisted to file with in-memory caching
- Vanilla JavaScript frontend (no frameworks) with canvas-based rendering
- Elysia.js REST API with TypeBox schema validation and OpenAPI documentation
- Real-time metrics via polling with 10-second widget-level caching
- Two distinct frontend applications: read-only TV display and WYSIWYG studio editor

## Layers

**Backend API Layer (`server/index.js`):**
- Purpose: HTTP REST API serving dashboard config, metrics, and CRUD operations
- Location: `server/index.js`
- Contains: Elysia route definitions, middleware, cache management, error handling
- Depends on: Data source registry, config manager, query manager, template manager, theme manager, database
- Used by: Frontend applications (TV display and studio editor)

**Data Source Registry Layer (`server/data-source-registry.js`):**
- Purpose: Manages plugin system for all external data sources (GCP, BigQuery, AWS, VulnTrack, Datadog, Elasticsearch, Salesforce, Zendesk, Hotjar, FullStory, Checkly, Chromatic, Looker, Rollbar, Rootly, Segment, Mock)
- Location: `server/data-source-registry.js` + `server/data-sources/*.js`
- Contains: DataSource base class, per-source implementations with fetch/execute patterns
- Depends on: Individual data source modules, metrics collector, logger
- Used by: Backend API routes for `/api/data-sources` and widget metric fetching

**Config Management Layer (`server/config-manager.js`):**
- Purpose: Load/save/validate dashboard YAML configuration with automatic backups
- Location: `server/config-manager.js`
- Contains: loadConfig, saveConfig, updateDashboard, createDashboard, deleteDashboard, listBackups, restoreBackup
- Depends on: File system (config/dashboards.yaml), YAML parser (js-yaml)
- Used by: Backend API for all dashboard CRUD operations

**Query Management Layer (`server/query-manager.js`):**
- Purpose: Manage 46 saved GCP queries with execution and validation
- Location: `server/query-manager.js`
- Contains: Query execution, query persistence, query grouping by source
- Depends on: GCP data source, metrics collector
- Used by: Data source plugins executing widget queries, studio query explorer

**Database Layer (`server/db/`):**
- Purpose: SQLite WAL-mode database for data source configuration audit trail
- Location: `server/db/schema.js`, `server/db/index.js`
- Contains: Drizzle ORM schema, connection pool, migrations
- Tables: `data_source_configs` (enabled flag, config JSON, updatedAt, updatedBy), `config_audit_log` (change tracking)
- Used by: `server/data-source-config.js` for credential management history

**Template & Theme Layer:**
- Purpose: Dashboard templates and visual themes for studio and TV display
- Template Location: `server/template-manager.js` + `config/templates/`
- Theme Location: `server/theme-manager.js` + `config/themes.yaml`
- Contains: Template save/load/delete, theme CRUD with CSS variable mapping
- Used by: Studio editor for template browser, TV display for branding application

**Frontend TV Display Layer (`public/js/app.js`):**
- Purpose: Clean read-only dashboard viewer with auto-rotation and real-time refresh
- Location: `public/js/app.js`
- Contains: DashboardApp class managing page rotation, data refresh, keyboard navigation, pause toggle
- Depends on: Widget renderers (widgets.js), Chart engine (charts.js), Config API, Metrics API
- Used by: Public dashboard viewing at `/`

**Studio Editor Layer (`public/js/studio.js`):**
- Purpose: WYSIWYG dashboard editor with 3-panel layout (sidebar, canvas, properties)
- Location: `public/js/studio.js`
- Contains: StudioApp class managing dashboards tab, queries tab, data sources tab, drag-drop canvas, property editor
- Depends on: Canvas controller (studio-canvas.js), Query explorer, Metric browser, Config API
- Used by: Dashboard creation/editing at `/admin`

**Widget Renderer Layer (`public/js/widgets.js`):**
- Purpose: 15+ widget types rendering live dashboard data (big-number, stat-card, gauge, sparkline, bar-chart, pipeline, map, table, etc.)
- Location: `public/js/widgets.js`
- Contains: Widget factory (create by type), update method for each renderer
- Depends on: Chart engine (charts.js) for canvas rendering
- Used by: TV display and studio live preview

**Chart Engine Layer (`public/js/charts.js`):**
- Purpose: Canvas-based chart rendering with MadHive brand colors and DPI scaling
- Location: `public/js/charts.js`
- Contains: sparkline, gauge, bar-chart, pipeline-flow, threshold-color functions, DPI-aware setup
- Depends on: None (standalone canvas API)
- Used by: Widget renderers for visual output

## Data Flow

**Dashboard Display at `/`:**

1. Browser requests GET `/` → server returns `public/index.html`
2. Client loads `app.js` → initializes DashboardApp
3. DashboardApp calls `GET /api/config` → returns `{ dashboards: [...], global: {...} }`
4. App renders pages (CSS grid) with widget containers
5. App starts rotation timer (30s default) and refresh timer (5s default)
6. For each visible dashboard:
   - Call `GET /api/metrics/{dashboardId}` → server executes all widgets
   - Data source registry fetches each widget's data via plugin
   - Returns `{ [widgetId]: { value, sparkline, trend, ... }, ... }`
7. Widget renderers (widgets.js) call `update(data)` → canvas charts render
8. Pause button pauses rotation/refresh; arrow keys navigate dashboards

**Data Flow with queryId (58 widgets):**

```
widget { type: 'big-number', queryId: 'cloudrun-request-count-madmaster' }
  ↓
GET /api/metrics/{dashboardId}
  ↓
server/index.js getData()
  ↓
dataSourceRegistry.fetchDashboardMetrics()
  ↓
for each widget: gcpDataSource.executeQuery(widgetConfig)
  ↓
query-manager.getQuery('gcp', 'cloudrun-request-count-madmaster')
  ↓
gcp-metrics.query(project, metricType, filters, timeWindow)
  ↓
Cloud Monitoring API
  ↓
transformData(timeSeries, widgetType)
  ↓
{ value: 12500, sparkline: [...], trend: 'up', timePeriod: 'Last 10 min' }
  ↓
widget.update(data) → canvas renders sparkline
```

**Legacy Data Flow (23 widgets):**

```
widget { type: 'stat-card', no queryId }
  ↓
GET /api/metrics/{dashboardId}
  ↓
gcp-metrics.getMetrics(dashboardId)
  ↓
Dashboard-specific hardcoded functions
  ↓
returns data object with all widgets
```

**Studio Editor at `/admin`:**

1. Browser loads `studio.html` → loads `studio.js`
2. StudioApp fetches `GET /api/config` → displays dashboard list with thumbnails
3. User clicks dashboard → renders on canvas
4. Canvas overlay shows grid, snap-to-cell, collision detection (red highlight)
5. Drag widget → updates position in modifiedConfig (not persisted)
6. Resize handles show live W×H badge
7. Click widget → property panel shows widget config, query selector
8. Browse GCP Metrics button opens modal with metric descriptor search
9. Save button → `PUT /api/config` with full updated dashboard config
10. Discard button → revert to last server state

**Data Source Credential Flow:**

1. User navigates to `/data-sources-page.html`
2. Fetches `GET /api/data-sources` → list with connection status
3. Clicks edit on data source (e.g., "datadog")
4. Form validates against schema in `server/data-source-schemas.js`
5. User submits credentials → `PUT /api/data-sources/datadog/credentials`
6. Server validates key names against `ENV_MAP['datadog']` whitelist
7. Writes to `.env` via `server/env-writer.js`
8. Updates `process.env` immediately
9. Calls `dataSourceRegistry.reinitializeSource('datadog')`
10. Reloads datadog plugin with new credentials
11. Returns `{ success: true, connected: true, message: null }`

**Config Cache Strategy:**

- `loadConfig()` caches YAML in memory with mtime tracking
- File watcher (polling mtime) detects external changes
- Cache invalidated when any PUT/POST/DELETE modifies config
- Allows multiple Bun worker processes to share SO_REUSEPORT without stomping

**Widget Data Caching:**

- In-memory `widgetCache` Map stores `{ data, timestamp }`
- 10-second TTL per widget
- `GET /api/data/:widgetId` checks cache first
- Metrics collector tracks cache hits/misses

**State Management:**

TV Display:
- DashboardApp holds currentPage, pages array, widgets map
- Widgets indexed by `dashboardId:widgetId`
- Each widget has `update(data)` method (reactive pattern)
- Pause state toggles rotation/refresh timers

Studio Editor:
- StudioApp holds config (from server) and modifiedConfig (working copy)
- isDirty flag tracks unsaved changes
- modifiedConfig lives in memory until Save clicked
- Property panel binds to currently selected widget in modifiedConfig

## Key Abstractions

**DataSource Plugin Interface:**
- Location: `server/data-sources/base.js`
- Pattern: Class extending DataSource with initialize(), fetchMetrics(), executeQuery()
- Example: `server/data-sources/gcp.js` implements Cloud Monitoring API calls
- Enables: Plugin registration in registry, hot reload without restart

**Widget Factory Pattern:**
- Location: `public/js/widgets.js`
- Pattern: `Widgets.create(type, container, config)` returns `{ update(data) }`
- Types: big-number, stat-card, gauge, sparkline, bar-chart, pipeline, table, map, etc.
- Enables: Type-driven rendering, unified update pattern

**Query Manager:**
- Location: `server/query-manager.js`
- Pattern: `getQuery(source, queryId)` returns saved query with metricType, filters, timeWindow
- Stored in: `config/queries.yaml` (46 GCP queries across services)
- Enables: Widget queryId → metric execution decoupling

**Configuration as Data:**
- Location: `config/dashboards.yaml`, `config/queries.yaml`, `config/themes.yaml`
- Pattern: YAML read/persisted via config-manager
- Enables: Studio edits saved without code changes, instant TV display refresh

**Canvas-based Rendering:**
- Location: `public/js/charts.js` and `public/js/widgets.js`
- Pattern: DPI-aware canvas setup, MadHive brand palette constants
- Enables: GPU-accelerated sparklines, gauges, pipeline flow (no SVG overhead)

## Entry Points

**TV Display:**
- Location: `public/index.html` → `public/js/app.js`
- Triggers: User navigates to `/`
- Responsibilities: Load config, render dashboard pages, manage rotation/refresh, handle keyboard shortcuts

**Studio Editor:**
- Location: `public/studio.html` → `public/js/studio.js`
- Triggers: User navigates to `/admin`
- Responsibilities: Load dashboards, manage sidebar tabs, render canvas with grid/snap, persist edits

**Data Sources Page:**
- Location: `public/data-sources-page.html` → `public/js/data-sources-app.js`
- Triggers: User navigates to `/data-sources.html`
- Responsibilities: Display data source list, manage credential forms, test connections

**API Entry Point:**
- Location: `server/index.js`
- Starts: Bun HTTP server on configured HOST/PORT (tv.madhive.local:80)
- Exports: app object for testing
- Listens: Guarded by `import.meta.main` check

## Error Handling

**Strategy:** Try-catch with fallbacks; non-fatal errors don't crash display

**Patterns:**

Data Fetching (`server/index.js` getData):
```javascript
// Try data source registry first
try {
  return await dataSourceRegistry.fetchDashboardMetrics(dashboardId, dashboard);
} catch (err) {
  logger.warn('Failed to use registry, falling back to legacy');
}
// Fallback to legacy gcp-metrics
try {
  return await gcp-metrics.getMetrics(dashboardId);
} catch (err) {
  return mockGetMetrics(dashboardId);
}
```

Config Loading (`public/js/studio.js`):
```javascript
try {
  const res = await fetch('/api/config');
  this.config = await res.json();
} catch (e) {
  this.showToast('Failed to load config: ' + e.message, 'error');
  this.config = { global: {}, dashboards: [] };
}
```

Theme Loading (non-fatal):
```javascript
try {
  const res = await fetch('/api/themes/' + themeId);
  this.applyThemeCss(theme);
} catch (_) {
  // Theme load failure is non-fatal — keep default brand theme
}
```

Data Refresh in TV Display:
```javascript
async refreshData() {
  try {
    const res = await fetch(`/api/metrics/${dash.id}`);
    const data = await res.json();
    dash.widgets.forEach(wc => {
      if (data[wc.id]) {
        this.widgets[widgetKey].update(data[wc.id]);
      }
    });
  } catch (err) {
    console.error('[app] refresh failed:', err);
    // Keep displaying stale data, retry on next interval
  }
}
```

## Cross-Cutting Concerns

**Logging:**
- Framework: Pino (structured JSON logging)
- Setup: `server/logger.js` with pino-pretty dev transport
- Context bindings: dataSource, requestId, widgetId, dashboardId
- Patterns: createLogger(), createDataSourceLogger(), logQueryExecution()

**Validation:**
- TypeBox schemas in `server/models/` for all request/response types
- Elysia validates against schema; validation errors wrapped in `{ type: 'validation', found: {...} }`
- Path traversal prevention in template routes: validate BEFORE sanitization
- Nullable vs Optional: use `t.Nullable()` for fields accepting null

**Authentication:**
- No per-user auth (Google OAuth disabled)
- Network-layer access control only (internal network assumed trusted)
- Studio at `/admin` open to internal network, no session management
- Credentials stored in environment (`.env`, gitignored)

**Performance:**
- 10-second widget-level cache for metric fetches
- Config file mtime caching to detect changes without constant parsing
- Bun SO_REUSEPORT allows multiple workers sharing port
- Rate limiting via elysia-rate-limit on API routes (smartRateLimit middleware)
- Cache-Control headers: no-cache for HTML, 1-hour for assets, 1-minute for config

**Monitoring:**
- Metrics collector (`server/metrics.js`) tracks request count, duration, status, cache hits/misses
- Endpoint: `GET /api/metrics` returns { success, metrics: {...} }
- Health check: `GET /health` returns version and service name (Cloud Run compatibility)

---

*Architecture analysis: 2026-03-20*
