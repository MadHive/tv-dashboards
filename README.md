# MadHive TV Dashboards

Real-time engineering dashboard system running on a dedicated display (TV) in the MadHive office. Metrics from GCP Cloud Monitoring, BigQuery, and VulnTrack are displayed on rotating dashboards. A built-in studio at `/admin` lets engineers configure dashboards, assign metrics to widgets, and manage data source credentials — all from the browser.

---

## Quick Start

**Requirements:** Bun runtime, GCP service account credentials

```bash
git clone https://github.com/MadHive/tv-dashboards.git
cd tv-dashboards
bun install
cp .env.example .env   # fill in credentials
bun run start          # server on port 3000
```

Open **http://tv:3000** for the TV display and **http://tv:3000/admin** for the studio.

---

## Environment Setup

Copy `.env.example` to `.env` and fill in the values:

```bash
# Required for live GCP data
USE_REAL_DATA=true
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
GCP_PROJECT_ID=mad-master
GCP_PROJECTS=mad-master,mad-data,mad-audit,mad-looker-enterprise

# Required for security dashboard
VULNTRACK_API_URL=https://vulntrack.madhive.dev
VULNTRACK_API_KEY=your-key-here

# Optional — fill via Sources tab in the studio UI instead
DATADOG_API_KEY=
DATADOG_APP_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
```

### GCP Service Account Permissions

The service account needs these roles on each GCP project:

```bash
# Required for metric data (dashboards)
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SA_EMAIL" \
  --role="roles/monitoring.viewer"

# Required for BigQuery data (campaign delivery map)
gcloud projects add-iam-policy-binding mad-data \
  --member="serviceAccount:SA_EMAIL" \
  --role="roles/bigquery.jobUser"
gcloud projects add-iam-policy-binding mad-data \
  --member="serviceAccount:SA_EMAIL" \
  --role="roles/bigquery.dataViewer"
```

---

## Running as a Service (systemd)

The server runs as a systemd service on the TV display machine:

```ini
# /etc/systemd/system/tv-dashboards.service
[Unit]
Description=TV Dashboards - Bun server
After=network.target

[Service]
Type=simple
User=tech
WorkingDirectory=/home/tech/dev-dashboards
EnvironmentFile=/home/tech/dev-dashboards/.env
ExecStart=/home/tech/.bun/bin/bun run server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable tv-dashboards
sudo systemctl start tv-dashboards
sudo systemctl restart tv-dashboards  # after config changes
```

---

## TV Display (`/`)

The TV display auto-rotates through all configured dashboards. It is read-only — all editing happens in the studio.

| Control | Action |
|---------|--------|
| `⏸` button (bottom bar) | Pause/resume rotation |
| `Space` | Pause/resume rotation |
| `→` / `↓` | Next dashboard |
| `←` / `↑` | Previous dashboard |
| Nav dots (bottom bar) | Jump to specific dashboard |

The rotation interval and refresh interval are configured in the studio's Settings panel.

---

## Studio (`/admin`)

The studio is a three-panel WYSIWYG editor. No authentication required — access is controlled at the network level.

```
┌──────────────┬──────────────────────────────┬──────────────────┐
│  SIDEBAR     │  CANVAS                      │  PROPERTIES      │
│              │                              │                  │
│  Dashboards  │  Live preview of the         │  Click any       │
│  Queries     │  selected dashboard.         │  widget to       │
│  Sources     │  Click/drag/resize widgets.  │  configure it.   │
└──────────────┴──────────────────────────────┴──────────────────┘
```

### Dashboards Tab

- Lists all 12 dashboards with miniature grid thumbnail previews
- Click a dashboard to load it in the canvas
- Drag the `⠿` handle to reorder the TV rotation
- `+` button to create a new blank dashboard

### Canvas

- **Click** a widget to select it and open its properties
- **Drag** to reposition (grid snaps, collision detection prevents overlaps)
- **Drag the pink handles** (appear on hover) to resize
- **Add Widget** button in the footer opens the widget type picker

### Properties Panel

When a widget is selected, four sections appear:

| Section | What you can change |
|---------|-------------------|
| **Basic** | Title, widget type |
| **Data** | Source (GCP/BigQuery/VulnTrack/Mock), query assignment |
| **Position** | Col, Row, ColSpan, RowSpan — type values or drag |
| **Display** | Unit, Min, Max, warning/critical thresholds (gauges/numbers only) |

### Saving

The **Save** button in the top bar becomes active after any change. Click it to write to `dashboards.yaml`. The TV display picks up changes within the next refresh cycle (default 8s) — no restart required.

---

## Queries Tab

The Queries tab lists all 46+ saved GCP metric queries grouped by source. Each query defines a specific GCP metric type, project, time window, and aggregation.

### Assign a Metric to a Widget

1. Select a widget in the canvas
2. In the Properties panel → **Data** section, click **Browse GCP Metrics**
3. A searchable modal opens with all 9,000+ metrics from your GCP projects, organized by service (Cloud Run, BigQuery, Pub/Sub, Bigtable, etc.)
4. Click a metric → configure time window and aggregation → **Apply to Widget**
5. The query is saved and the widget is updated — click **Save** to persist

### Direct Query Assignment

Use the **Change Query** dropdown in the Data section to assign any existing saved query to a widget.

---

## Sources Tab

The Sources tab shows all 17 data sources with live connection status:

| Status | Meaning |
|--------|---------|
| 🟢 Green | Connected and serving data |
| 🟡 Amber | Configured but untested |
| 🔴 Red | Connection error |
| ⚫ Grey | Not configured (no credentials) |

Click any source to open the credential editor. Fill in API keys and click **Save Credentials** — credentials are written to `.env` and the data source reconnects immediately without a server restart.

### Currently Active

| Source | Data |
|--------|------|
| GCP Cloud Monitoring | Cloud Run, K8s, Bigtable, Pub/Sub, Load Balancer, and all custom MadHive metrics |
| BigQuery | Campaign delivery geographic data |
| VulnTrack | Security vulnerability counts and scorecard |
| Mock | Fallback for unconfigured widgets |

### Ready for Configuration

AWS CloudWatch, DataDog, Elasticsearch, Salesforce, HotJar, FullStory, Zendesk, Checkly, Chromatic, Looker, Rollbar, Rootly, Segment — all have full implementations, just need credentials.

---

## Dashboards

| Dashboard | Widgets | Data Source |
|-----------|---------|-------------|
| Platform Overview | 7 | GCP (bidder metrics, Kafka, Cloud Run) |
| Services Health | 5 | GCP Cloud Run |
| Campaign Delivery | 1 | BigQuery (geographic delivery data) |
| Data Processing | 5 | GCP BigQuery + Pub/Sub |
| Data Pipeline | 1 | GCP (multi-metric pipeline stages) |
| RTB Infrastructure | 11 | GCP Kubernetes, Load Balancer |
| Bidder Cluster | 9 | GCP Load Balancer |
| Campaign & Pacing | 9 | GCP Roger/MadServer metrics |
| Data Infrastructure | 11 | GCP Managed Kafka + Bigtable |
| API & Services | 9 | GCP Mozart/Planner/Gary2/MadServer |
| Security Posture | 1 | VulnTrack |
| Visual Showcase | 12 | Mock (testing/demo) |

---

## Widget Types

| Type | Description |
|------|-------------|
| `big-number` | Large numeric value with sparkline and trend |
| `stat-card` | Metric with label, value, and sparkline |
| `gauge` | Circular gauge with configurable min/max/thresholds |
| `gauge-row` | Horizontal row of multiple gauge values |
| `bar-chart` | Vertical bar chart with color-coded bars |
| `progress-bar` | Horizontal progress indicator |
| `status-grid` | Grid of named status items |
| `alert-list` | Scrollable list of alerts |
| `service-heatmap` | Services arranged in a heatmap |
| `pipeline-flow` | Multi-stage data pipeline visualization |
| `usa-map` | Geographic choropleth of impression/bid data |
| `security-scorecard` | VulnTrack security posture overview |

---

## API Reference

Full interactive documentation at **http://tv:3000/openapi** (Scalar UI).

### Key Endpoints

```
GET  /api/config                          Full dashboard config (all dashboards + widgets)
GET  /api/metrics/:dashboardId            Live metric data for all widgets in a dashboard

GET  /api/dashboards                      List dashboards
POST /api/dashboards                      Create dashboard
PUT  /api/dashboards/:id                  Update dashboard
DELETE /api/dashboards/:id                Delete dashboard
POST /api/dashboards/reorder              Reorder TV rotation

GET  /api/queries/                        All saved queries (grouped by source)
GET  /api/queries/:source                 Queries for a specific source
POST /api/queries/:source                 Create query (GCP requires metricType, BigQuery requires sql)
PUT  /api/queries/:source/:id             Update query
DELETE /api/queries/:source/:id           Delete query

GET  /api/data-sources                    List all sources with connection status
POST /api/data-sources/:name/test         Test connection
PUT  /api/data-sources/:name/credentials  Save credentials to .env + hot-reload

GET  /api/gcp/metrics/descriptors         Browse all GCP metric types for a project
```

---

## Database

SQLite database at `data/tv-dashboards.db` (WAL mode). Stores:
- Data source configuration (non-sensitive settings)
- Configuration audit log

```bash
# View and manage via Drizzle Studio
bun run db:studio     # opens at http://tv:4983

# Schema management
bun run db:generate   # generate migration from schema changes
bun run db:migrate    # apply pending migrations
```

---

## Development

### Running Tests

```bash
bun run test                    # 1,550+ tests (unit + integration + components)
bun test tests/unit             # unit tests only
bun test tests/integration      # integration tests only
```

### File Structure

```
dev-dashboards/
├── public/
│   ├── index.html              TV display shell
│   ├── studio.html             Studio editor shell
│   ├── css/
│   │   ├── dashboard.css       TV display styles (MadHive brand palette)
│   │   └── studio.css          Studio editor styles
│   └── js/
│       ├── app.js              TV display runtime (rotation, pause, data refresh)
│       ├── charts.js           Canvas-based chart renderers
│       ├── widgets.js          Widget factory (creates all widget types)
│       ├── studio.js           Studio controller (sidebar, properties, tabs)
│       └── studio-canvas.js    Studio canvas (render, drag, resize, grid overlay)
├── server/
│   ├── index.js                Elysia server + all API routes
│   ├── gcp-metrics.js          Legacy hardcoded GCP metric functions
│   ├── query-manager.js        YAML-based saved query persistence
│   ├── data-source-registry.js Central registry for all data source plugins
│   ├── env-writer.js           Safe in-place .env file updater
│   ├── data-source-env-map.js  Whitelist of writable env vars per data source
│   ├── models/                 TypeBox schema models for OpenAPI
│   │   ├── dashboard.model.js
│   │   ├── query.model.js
│   │   ├── data-source.model.js
│   │   └── ...
│   └── data-sources/           Data source plugin implementations
│       ├── base.js             Abstract base class
│       ├── gcp.js              GCP Cloud Monitoring
│       ├── bigquery.js         BigQuery
│       ├── vulntrack.js        VulnTrack security
│       ├── mock.js             Mock/fallback
│       └── ...                 14 more (aws, datadog, elasticsearch, etc.)
├── config/
│   ├── dashboards.yaml         Dashboard + widget definitions
│   └── queries.yaml            Saved metric queries
├── migrations/                 Drizzle SQL migrations
├── scripts/
│   └── auto-assign-queries.js  One-time script: assign saved queries to widgets
└── tests/
    ├── unit/
    ├── integration/
    └── components/
```

### Adding a Data Source

1. Create `server/data-sources/your-source.js` extending `DataSource`
2. Implement `fetchMetrics()`, `testConnection()`, `getConfigSchema()`
3. Register in `server/data-source-registry.js`
4. Add env var whitelist entry in `server/data-source-env-map.js`

See `server/data-sources/vulntrack.js` for a complete example.

### Adding a Widget Type

1. Add renderer function in `public/js/charts.js`
2. Register in the `Widgets.create()` factory in `public/js/widgets.js`
3. Add option to the type selector in `public/studio.html`

---

## Architecture Notes

**Data flow for a widget with a saved query:**
```
Dashboard YAML (widget.queryId)
  → GET /api/metrics/:dashboardId
  → dataSourceRegistry.fetchDashboardMetrics()
  → gcp.executeQuery(widgetConfig)
    → getQuery('gcp', queryId)          loads from queries.yaml
    → gcp-metrics.query(metricType, ...)  calls Cloud Monitoring API
    → transformData(timeSeries, widgetType)  converts to { value, sparkline, ... }
  → browser receives { widgetId: data }
  → widget.update(data)                 renders the value
```

**Data flow for a widget WITHOUT a saved query (legacy):**
```
  → gcp.fetchMetrics({ dashboardId })
  → gcp-metrics.getMetrics(dashboardId)  hardcoded per-dashboard function
  → returns pre-processed data for all widgets in that dashboard
```

58 of 81 widgets use the saved query path. 23 use the legacy path (complex multi-metric widgets, static values, and mock widgets).

---

## License

Internal MadHive project — not for external distribution.
