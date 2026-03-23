# Technology Stack

**Analysis Date:** 2026-03-20

## Languages

**Primary:**
- JavaScript (ES modules) - All server code and frontend
- SQL - SQLite database queries via Drizzle ORM

**Secondary:**
- YAML - Configuration files (`config/dashboards.yaml`, `config/queries.yaml`)

## Runtime

**Environment:**
- Bun 1.3.9 - JavaScript runtime, also handles task execution and testing
- Node.js compatibility layer (Bun is Node.js-compatible)

**Package Manager:**
- Bun (`bun install`, `bun run`)
- Lockfile: `bun.lock` (present, committed)

## Frameworks

**Core:**
- Elysia.js v1.2 - HTTP server framework with built-in OpenAPI support
- @elysiajs/openapi v1.4.14 - OpenAPI schema generation (Scalar UI at `/openapi`)
- @elysiajs/static v1.2 - Static file serving
- @elysiajs/cookie v0.8.0 - Cookie middleware
- @elysiajs/cors v1.4.1 - CORS support
- Drizzle ORM v0.45.1 - Database abstraction layer with type safety
- drizzle-kit v0.31.9 - Schema management and migrations

**Frontend:**
- Vanilla JavaScript (no framework) - All client-side code in `public/js/`
- Mapbox GL JS (custom bundled version `mapbox-gl.min.js`) - GPU-accelerated map visualization

**Testing:**
- Bun test runner (built-in) - No external test framework
- jsdom v28.1.0 - DOM simulation for unit tests
- whatwg-url v16.0.1 - URL parsing in tests

**Build/Dev:**
- No build step - Vanilla JS and Elysia serve directly
- No linter configured (`"lint": "echo 'No linter configured'"`)
- No TypeScript - Pure JavaScript with JSDoc comments

## Key Dependencies

**Critical:**
- elysia v1.2 - Core HTTP/REST server with OpenAPI support
- drizzle-orm v0.45.1 - Type-safe database layer with Bun SQLite support
- @google-cloud/monitoring v5.3.1 - GCP Cloud Monitoring metrics API
- @google-cloud/bigquery v8.1.1 - Google BigQuery data warehouse client
- @datadog/datadog-api-client v1.52.0 - Datadog metrics and logs API

**Infrastructure:**
- @aws-sdk/client-cloudwatch v3.1000.0 - AWS CloudWatch metrics
- @elastic/elasticsearch v9.3.2 - Elasticsearch integration
- jsforce v3.10.14 - Salesforce REST API client
- node-zendesk v6.0.1 - Zendesk API client
- axios v1.13.6 - HTTP client for external API calls
- js-yaml v4.1.0 - YAML config file parsing/dumping

**Logging:**
- pino v10.3.1 - Structured logging library
- pino-pretty v13.1.3 - Pretty-print pino logs in development

**Google Cloud:**
- google-auth-library v10.6.1 - GCP service account authentication

**Database:**
- bun:sqlite - Built-in SQLite via Bun (no external package)

## Configuration

**Environment:**
- `.env` file (gitignored) - Runtime configuration via `process.env`
- Systemd service `tv-dashboards` loads environment from `EnvironmentFile`
- `MAPBOX_ACCESS_TOKEN` - Mapbox GL JS public access token (pk.* format)
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to GCP service account JSON key
- `GCP_PROJECTS` - Comma-separated GCP project IDs
- `USE_REAL_DATA` - Boolean to toggle mock vs. real data sources

**YAML Config Files:**
- `config/dashboards.yaml` - Dashboard definitions, widget layout, data sources
- `config/queries.yaml` - Named saved queries for GCP metrics and BigQuery

**Build:**
- No build config needed (vanilla JS + Elysia)
- `drizzle.config.js` - Drizzle ORM schema and migration settings
  - Dialect: SQLite
  - DB path: `./data/tv-dashboards.db`
  - Schema: `./server/db/schema.js`
  - Migrations: `./migrations/`

## Platform Requirements

**Development:**
- Bun 1.3.9 installed globally
- GCP service account key JSON file (for real data mode)
- Local SQLite database (auto-created on first run)

**Production:**
- Bun runtime
- `.env` file with all required credentials
- Linux host with systemd (service auto-starts as `tv-dashboards`)
- HTTP port 3000 (configurable via `PORT` env var)
- Kiosk display: Chromium with `--ignore-gpu-blocklist` flag for WebGL (Mapbox GL JS requirement)

## Data Storage

**Primary Database:**
- SQLite (bun:sqlite) via Drizzle ORM
- File: `data/tv-dashboards.db` (gitignored)
- WAL mode enabled for better concurrency (`PRAGMA journal_mode = WAL`)
- Tables:
  - `data_source_configs` - Credential and configuration state for each data source
  - `config_audit_log` - Audit trail of config changes (with indexes on timestamp and source_name)
- Migrations managed by `drizzle-kit` in `migrations/` directory

**External Data Sources:**
- GCP Cloud Monitoring API - Real-time metrics via `@google-cloud/monitoring`
- Google BigQuery - Historical data and custom SQL queries via `@google-cloud/bigquery`
- AWS CloudWatch - AWS metrics via `@aws-sdk/client-cloudwatch`
- Datadog API - Application monitoring metrics via `@datadog/datadog-api-client`
- Elasticsearch - Log and event data via `@elastic/elasticsearch`
- VulnTrack API - Security vulnerability metrics (custom internal API)
- Salesforce, Zendesk, Looker - Via respective SDKs

---

*Stack analysis: 2026-03-20*
