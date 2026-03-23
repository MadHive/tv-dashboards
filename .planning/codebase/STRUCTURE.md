# Codebase Structure

**Analysis Date:** 2026-03-20

## Directory Layout

```
dev-dashboards/
├── .planning/                    # GSD planning documents
│   └── codebase/                 # This analysis
├── config/                       # Dashboard and query configuration
│   ├── dashboards.yaml           # 23 dashboard definitions (TV, clients)
│   ├── queries.yaml              # 46 saved GCP metric queries
│   ├── themes.yaml               # Visual theme definitions
│   ├── templates/                # Dashboard template YAML files
│   └── *.backup.*                # Auto-generated backups (gitignored)
├── data/                         # Database and runtime data
│   └── tv-dashboards.db          # SQLite WAL-mode database (gitignored)
├── migrations/                   # Drizzle ORM migrations
│   └── 0000_productive_kree.sql  # Initial schema (applied)
├── public/                       # Frontend assets served by Elysia
│   ├── index.html                # TV display entry point
│   ├── studio.html               # Studio editor entry point
│   ├── admin.html                # Legacy admin page
│   ├── import.html               # Dashboard import tool
│   ├── data-sources-page.html    # Data source credential manager
│   ├── wizard-demo.html          # Template wizard demo
│   ├── js/                       # Client-side JavaScript
│   │   ├── app.js                # DashboardApp for TV display rotation/refresh
│   │   ├── studio.js             # StudioApp for WYSIWYG editor
│   │   ├── studio-canvas.js      # Canvas drag/resize/grid overlay
│   │   ├── widgets.js            # 15+ widget type renderers
│   │   ├── charts.js             # Canvas chart engine (sparkline, gauge, etc.)
│   │   ├── admin-app.js          # Legacy admin UI logic
│   │   ├── admin-api.js          # Admin CRUD API calls
│   │   ├── admin-components.js   # Reusable UI components
│   │   ├── importer.js           # Dashboard JSON importer UI
│   │   ├── query-editor.js       # Query CRUD editor
│   │   ├── query-explorer.js     # Query browser and execution
│   │   ├── data-sources-app.js   # Data source credential manager
│   │   ├── auth-ui.js            # Google OAuth UI (disabled)
│   │   ├── demo-wizard.js        # Template browser wizard
│   │   ├── utils.js              # Shared utilities (formatting, DOM helpers)
│   │   ├── mapbox-map.js         # Mapbox GL wrapper for USA map widgets
│   │   ├── mapbox-gl.min.js      # Mapbox GL JS library
│   │   ├── us-states.js          # USA state boundary lookup
│   │   ├── components/           # Reusable UI components
│   │   │   ├── form-builder.js   # Dynamic form generation
│   │   │   ├── template-browser.js
│   │   │   ├── theme-selector.js
│   │   │   ├── data-source-connector.js
│   │   │   ├── wizard-framework.js
│   │   │   ├── tv-preview.js
│   │   │   └── live-preview.js
│   │   └── v-*.js                # Vega-Lite chart renderers (external)
│   ├── css/                      # Client-side CSS
│   │   ├── dashboard.css         # TV display styles
│   │   ├── studio.css            # Studio editor styles
│   │   ├── importer.css          # Import tool styles
│   │   └── *.css                 # Per-page styles
│   ├── img/                      # Uploaded logos and assets
│   │   └── *                     # Client logo images (uploaded via /api/assets/upload)
│   ├── data/                     # GeoJSON and reference data
│   │   ├── us-states-hq.json     # State headquarters coordinates
│   │   └── us-counties.json      # County boundary data
│   └── favicon.svg
├── server/                       # Backend API and business logic
│   ├── index.js                  # Elysia HTTP server, route definitions
│   ├── logger.js                 # Pino structured logging with context bindings
│   ├── metrics.js                # Performance metrics collection
│   ├── rate-limiter.js           # elysia-rate-limit middleware and cache headers
│   ├── config-manager.js         # Load/save/backup YAML configuration
│   ├── dashboard-manager.js      # Dashboard CRUD operations
│   ├── query-manager.js          # Saved query execution and persistence
│   ├── template-manager.js       # Dashboard template CRUD
│   ├── theme-manager.js          # Visual theme management
│   ├── data-source-registry.js   # Plugin registry for all 18 data sources
│   ├── data-source-config.js     # Data source config DB operations
│   ├── data-source-env-map.js    # Whitelist of per-source env vars
│   ├── data-source-schemas.js    # Validation schemas for each data source
│   ├── env-writer.js             # Update .env file and process.env
│   ├── config-validator.js       # YAML schema validation
│   ├── gcp-metrics.js            # GCP Cloud Monitoring API wrapper
│   ├── gcp-dashboard-routes.js   # GET /api/dashboards/* specific endpoints
│   ├── gcp-dashboards.js         # Dashboard-specific metric queries
│   ├── mock-data.js              # Mock metric data for testing
│   ├── api-proxy.js              # Reverse proxy routes for external APIs
│   ├── bigquery-routes.js        # BigQuery-specific routes
│   ├── query-routes.js           # Query management routes (/api/queries/*)
│   ├── explore-routes.js         # Metric exploration routes
│   ├── tv-apps.js                # Apple TV and external app widget endpoints
│   ├── google-oauth.js           # Google OAuth routes (disabled)
│   ├── db/                       # Database layer
│   │   ├── index.js              # Database initialization and connection
│   │   └── schema.js             # Drizzle ORM schema (data_source_configs, config_audit_log)
│   ├── data-sources/             # Plugin implementations (18 total)
│   │   ├── base.js               # DataSource base class interface
│   │   ├── gcp.js                # Google Cloud Monitoring
│   │   ├── bigquery.js           # Google BigQuery
│   │   ├── aws.js                # AWS CloudWatch
│   │   ├── datadog.js            # Datadog monitoring
│   │   ├── elasticsearch.js      # Elasticsearch queries
│   │   ├── vulntrack.js          # VulnTrack API client
│   │   ├── salesforce.js         # Salesforce API
│   │   ├── zendesk.js            # Zendesk support API
│   │   ├── hotjar.js             # Hotjar analytics
│   │   ├── fullstory.js          # FullStory session replay
│   │   ├── checkly.js            # Checkly uptime monitoring
│   │   ├── chromatic.js          # Chromatic visual testing
│   │   ├── looker.js             # Looker business intelligence
│   │   ├── rollbar.js            # Rollbar error tracking
│   │   ├── rootly.js             # Rootly incident management
│   │   ├── segment.js            # Segment CDP
│   │   ├── computed.js           # Computed metrics (derived from other sources)
│   │   └── mock.js               # Mock data fallback
│   └── models/                   # TypeBox schema definitions
│       ├── index.js              # Model registry (Elysia plugin)
│       ├── common.model.js       # Shared schemas (success, error, pagination)
│       ├── dashboard.model.js    # Dashboard request/response schemas
│       ├── query.model.js        # Query schemas
│       ├── data-source.model.js  # Data source config schemas
│       ├── metrics.model.js      # Metrics response schemas
│       ├── template.model.js     # Template schemas
│       └── theme.model.js        # Theme schemas
├── tests/                        # Test suite (Bun test runner)
│   ├── unit/                     # Unit tests (fast, isolated)
│   │   ├── routes/               # Route handler tests
│   │   ├── managers/             # Config/template/theme manager tests
│   │   ├── models/               # Schema validation tests
│   │   ├── data-sources/         # Plugin initialization tests
│   │   ├── widgets/              # Widget renderer tests
│   │   ├── charts/               # Chart engine tests
│   │   └── db/                   # Database query tests
│   ├── integration/              # Integration tests (data source connectivity)
│   │   ├── data-source-integration.test.js
│   │   └── api-routes.integration.test.js
│   ├── e2e/                      # End-to-end tests (if any)
│   ├── helpers/                  # Shared test utilities
│   │   └── test-db.js            # In-memory SQLite for tests
│   ├── fixtures/                 # Test data
│   │   ├── dashboards.yml        # Sample dashboards
│   │   └── queries.yml           # Sample queries
│   ├── components/               # Component tests
│   └── manual/                   # Manual test scripts (not automated)
├── scripts/                      # Utility scripts
│   └── auto-assign-queries.js    # Reassign widget queryIds after config regeneration
├── docs/                         # Documentation
│   ├── api.md                    # API documentation
│   ├── architecture.md           # System design
│   └── ...                       # Other docs
├── infra/                        # Infrastructure as code
│   ├── docker/                   # Docker configs (if any)
│   └── k8s/                      # Kubernetes configs (if any)
├── .github/                      # GitHub configuration
│   └── workflows/                # CI/CD workflows
├── .env                          # Environment variables (gitignored)
├── .env.example                  # Template for .env
├── package.json                  # npm dependencies and scripts
├── bunfig.toml                   # Bun runtime configuration
├── drizzle.config.ts             # Drizzle ORM configuration
└── .gitignore                    # Excludes node_modules, data/, .env, *.backup.*
```

## Directory Purposes

**`config/`:**
- Purpose: Dashboard, query, and theme definitions persisted as YAML
- Contains: YAML files (dashboards.yaml, queries.yaml, themes.yaml) and auto-generated backups
- Key files:
  - `dashboards.yaml`: 23 dashboards with grid, widgets, client branding
  - `queries.yaml`: 46 saved GCP metric queries with metricType, filters, timeWindow
  - `themes.yaml`: Color schemes with CSS custom properties
  - `templates/`: YAML files for dashboard templates created via studio
- Auto-backup: Every PUT /api/config creates timestamped backup
- Gitignored: `*.backup.*` files never committed

**`data/`:**
- Purpose: SQLite database (WAL mode) and runtime cache
- Contains: `tv-dashboards.db` (data source config audit trail)
- Tables: `data_source_configs`, `config_audit_log`
- Gitignored: Database never committed

**`migrations/`:**
- Purpose: Drizzle ORM migration files
- Contains: Applied migrations for schema initialization
- Pattern: `0000_productive_kree.sql` (initial schema)

**`public/`:**
- Purpose: Static assets and frontend entry points served by Elysia
- Contains: HTML pages, JavaScript, CSS, images, GeoJSON data
- Key pages: `index.html` (TV display), `studio.html` (editor), `data-sources-page.html` (credentials)
- Serves at: Elysia staticPlugin + explicit routes for actively-edited JS/CSS

**`public/js/`:**
- Purpose: Client-side application logic (vanilla JavaScript, no frameworks)
- Patterns: IIFE (Immediately Invoked Function Expression) for module isolation
- Apps: DashboardApp (TV rotation/refresh), StudioApp (WYSIWYG editor)
- Renderers: Widget factory, Chart engine (canvas-based)
- Architecture: No module imports; all global namespaces (window.Widgets, window.Charts, window.StudioApp)

**`public/css/`:**
- Purpose: CSS Grid layout, component styles, MadHive brand colors
- Design: CSS custom properties for theming (--bg, --accent, --t1, --t2, etc.)
- Responsive: 1920×1080 baseline (TV display assumed), font scales with --scale
- Actively edited: Served via Bun.file() to avoid static cache conflicts

**`public/img/`:**
- Purpose: Uploaded client logos and images
- Created by: POST /api/assets/upload (validates file type, size, generates random prefix)

**`public/data/`:**
- Purpose: GeoJSON and reference data for USA map widgets
- Files: `us-states-hq.json` (state centers), `us-counties.json` (boundaries)

**`server/`:**
- Purpose: Backend HTTP API, business logic, data source plugins
- Entry: `server/index.js` exports Elysia app, listens if import.meta.main
- Layers: Routes → managers → data source registry → plugins → external APIs
- Pattern: Plugin-based architecture with registry pattern

**`server/data-sources/`:**
- Purpose: Data source plugin implementations (18 total)
- Interface: Extend DataSource base class, implement initialize() and fetchMetrics()
- Patterns:
  - GCP: Uses @google-cloud/monitoring and @google-cloud/bigquery SDKs
  - AWS: Uses @aws-sdk/client-cloudwatch
  - Others: REST API wrappers (Datadog, Elasticsearch, Salesforce, Zendesk, etc.)
  - Mock: Returns synthetic data for testing/demo
- Registration: Auto-registered in data-source-registry.js constructor

**`server/models/`:**
- Purpose: TypeBox schema definitions for API request/response validation
- Pattern: Elysia model plugin system (.use(models) in index.js)
- Files: Grouped by domain (dashboard, query, data-source, metrics, template, theme, common)
- Validation: Automatic by Elysia; validation errors return { type: 'validation', found: {...} }

**`tests/`:**
- Purpose: Unit, integration, E2E test suites (Bun test runner)
- Unit tests: Fast, isolated, mock external services
- Integration tests: Real data source connections (requires .env)
- E2E tests: Full flows (if any)
- Helpers: Shared test utilities (in-memory SQLite, fixtures)
- Run: `bun test` or `bun test:unit`, `bun test:integration`

**`scripts/`:**
- Purpose: Utility scripts for maintenance
- Key: `auto-assign-queries.js` — re-assign widget queryIds if dashboards.yaml regenerated

**`docs/`:**
- Purpose: Developer documentation
- Contains: API docs, architecture diagrams, setup guides

**`infra/`:**
- Purpose: Infrastructure as code (Docker, Kubernetes, Terraform)
- Location: Systemd service runs `bun server/index.js` with `.env` EnvironmentFile

## Key File Locations

**Entry Points:**

| File | Purpose | Triggers |
|------|---------|----------|
| `public/index.html` | TV display viewer | User navigates to `/` |
| `public/studio.html` | WYSIWYG editor | User navigates to `/admin` |
| `public/data-sources-page.html` | Credential manager | User navigates to `/data-sources.html` |
| `public/import.html` | Dashboard importer | User navigates to `/admin/import` |
| `server/index.js` | API server | Bun startup (port 80, HOST=tv.madhive.local) |

**Configuration:**

| File | Purpose |
|------|---------|
| `config/dashboards.yaml` | 23 dashboard definitions (grid, widgets, branding) |
| `config/queries.yaml` | 46 saved GCP queries (metricType, filters, timeWindow) |
| `config/themes.yaml` | Visual theme definitions (colors, CSS vars) |
| `config/templates/` | Dashboard template YAML files |
| `.env` | Environment variables (API keys, service account paths) — gitignored |
| `package.json` | npm dependencies and scripts |
| `drizzle.config.ts` | Drizzle ORM config for SQLite |

**Core Logic:**

| File | Purpose |
|------|---------|
| `public/js/app.js` | DashboardApp: config load, page rotation, data refresh, keyboard nav |
| `public/js/studio.js` | StudioApp: dashboard management, canvas editor, property panel |
| `public/js/studio-canvas.js` | Canvas drag/resize, grid overlay, collision detection |
| `public/js/widgets.js` | Widget factory: 15+ types (big-number, stat-card, gauge, map, etc.) |
| `public/js/charts.js` | Canvas chart engine: sparkline, gauge, bar-chart, pipeline, DPI scaling |
| `server/index.js` | Elysia HTTP routes, middleware, cache management |
| `server/config-manager.js` | Load/save/backup YAML, file mtime caching |
| `server/data-source-registry.js` | Plugin registration, initialization, hot-reload |
| `server/query-manager.js` | Save query execution, query persistence |
| `server/gcp-metrics.js` | Cloud Monitoring API wrapper, query execution, data transformation |

**Testing:**

| File | Purpose |
|------|---------|
| `tests/unit/routes/` | Route handler unit tests |
| `tests/integration/data-source-integration.test.js` | Real data source connectivity tests |
| `tests/helpers/test-db.js` | In-memory SQLite for test isolation |
| `tests/fixtures/` | Sample dashboard/query YAML for testing |

## Naming Conventions

**Files:**

- **JavaScript**: camelCase (`app.js`, `dashboardManager.js`, `data-sources/`)
- **YAML**: kebab-case (`dashboards.yaml`, `queries.yaml`, `themes.yaml`)
- **Test files**: `.test.js` suffix (`dashboard-manager.test.js`, `query-routes.test.js`)
- **Backup files**: `{original}.backup.YYYY-MM-DDTHH-mm-ss` (ISO timestamp)
- **CSS files**: kebab-case (`dashboard.css`, `studio.css`)

**Directories:**

- **Plural for collections**: `data-sources/`, `models/`, `tests/`, `scripts/`
- **Singular for feature areas**: `server/`, `public/`, `config/`, `data/`
- **Lowercase with hyphens**: `data-sources/`, `studio-canvas.js`

**TypeBox Models:**

- **File pattern**: `{domain}.model.js` (dashboard.model.js, query.model.js)
- **Export pattern**: `export const {domain}Models = new Elysia(...)`
- **Schema naming**: `t.Object({ ... })` schemas named by route (e.g., 'dashboard.create', 'dashboard.update')

**CSS Custom Properties:**

- **Colors**: `--bg`, `--bg-surface`, `--bg-card`, `--accent`, `--t1`, `--t2`, `--t3`, `--border`, `--border-lit`
- **MadHive palette**: `--mh-pink`, `--mh-hot-pink`, `--cyan`, `--green`, `--amber`, `--red`
- **Layout**: `--scale` (device scale factor), `--gap` (grid gap)

**Elysia Routes:**

- **Pattern**: `/api/{resource}/{id}/{action}`
- **Examples**:
  - `GET /api/config` — full config
  - `POST /api/dashboards` — create
  - `PUT /api/dashboards/:id` — update
  - `DELETE /api/dashboards/:id` — delete
  - `GET /api/data-sources` — list sources
  - `PUT /api/data-sources/:name/credentials` — update credentials
  - `GET /api/metrics/:dashboardId` — fetch all widget data

## Where to Add New Code

**New Widget Type:**
1. Add renderer function to `public/js/widgets.js` (returns { update(data) })
2. Register in Widgets.create factory: `case 'new-widget': return newWidget(container, config);`
3. Add CSS styles to `public/css/dashboard.css` (selector: `.widget-new-widget`)
4. Add instance test if complex logic in `tests/unit/widgets/`

**New Data Source:**
1. Create `server/data-sources/{name}.js` extending DataSource base class
2. Implement initialize() (auth setup), fetchMetrics() (execute query)
3. Register in `server/data-source-registry.js` constructor
4. Add schema to `server/data-source-schemas.js`
5. Add env var whitelist to `server/data-source-env-map.js`
6. Write integration test in `tests/integration/data-source-integration.test.js`

**New Route:**
1. Add route handler in `server/{feature}-routes.js` (or new file for new domain)
2. Define TypeBox schema in `server/models/{domain}.model.js`
3. Register schema in `server/models/index.js` (.use())
4. Import routes in `server/index.js` (.use(featureRoutes))
5. Add documentation tag in OpenAPI config
6. Write unit test in `tests/unit/routes/{feature}.test.js`

**New Dashboard:**
1. Edit `config/dashboards.yaml` manually OR use studio at `/admin`
2. Studio: click "New Dashboard" → configure grid → add widgets → save
3. Widget: select from palette → drag to grid → edit properties → queryId selector
4. Save → persists to dashboards.yaml with auto-backup

**New Query:**
1. Edit `config/queries.yaml` manually OR use studio at `/admin`
2. Studio: Queries tab → "New Query" → select source → configure metricType/filters/timeWindow
3. Copy queryId (UUID) and reference in widget config

**New Theme:**
1. Create YAML in `config/themes.yaml` with colors object (or via studio)
2. Elysia endpoint: POST /api/themes with name, colors
3. TV display applies via GET /api/themes/{id} → CSS vars in applyThemeCss()

**New Component (UI):**
1. Create in `public/js/components/{component-name}.js` as IIFE class
2. Export as `window.{ComponentName} = class { ... }`
3. Use in studio/admin pages via `new window.ComponentName()`
4. Style in `public/css/{feature}.css`

**New Utility/Helper:**
1. Add to `public/js/utils.js` for frontend helpers
2. Add to `server/logger.js`, `server/metrics.js`, etc. for backend utilities
3. Export and import with ES6 modules (server) or global namespace (frontend)

## Special Directories

**`config/`:**
- Auto-backups: Created every PUT /api/config, never committed
- Cleanup: Backups older than 90 days should be pruned (not automated)
- Regeneration: If dashboards.yaml accidentally regenerated, run `scripts/auto-assign-queries.js` to restore queryIds

**`public/img/`:**
- Generated by: POST /api/assets/upload (client logo uploads)
- Storage: Local filesystem (not S3)
- Cleanup: Manual cleanup required; no auto-expiration

**`data/`:**
- SQLite WAL mode: Creates .db-wal and .db-shm files (temporary)
- Gitignored: Never commit database files
- Backups: Manual backup of `tv-dashboards.db` recommended

**`tests/`:**
- Test isolation: Each test gets fresh in-memory SQLite (via test-db.js helper)
- Fixtures: YAML files in fixtures/ referenced by tests
- Real tests: Integration tests require valid .env (skipped if missing credentials)

---

*Structure analysis: 2026-03-20*
