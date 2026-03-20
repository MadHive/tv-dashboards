# External Integrations

**Analysis Date:** 2026-03-20

## APIs & External Services

**Google Cloud Platform (GCP):**
- Cloud Monitoring - Real-time metrics from 9,417+ metric descriptors
  - SDK/Client: `@google-cloud/monitoring` v5.3.1
  - Auth: Service account via `GOOGLE_APPLICATION_CREDENTIALS` env var
  - Usage: `server/data-sources/gcp.js`, `server/gcp-metrics.js`
  - Projects: mad-master (primary), mad-data, mad-audit, mad-looker-enterprise
  - Endpoint: `GET /api/gcp/metrics/descriptors?project=mad-master`

- BigQuery - Data warehouse for custom SQL queries and historical data
  - SDK/Client: `@google-cloud/bigquery` v8.1.1
  - Auth: Same service account as Cloud Monitoring
  - Usage: `server/data-sources/bigquery.js`
  - Query execution: Custom SQL with caching (5-minute TTL)
  - Endpoint: `GET /api/queries/` returns grouped queries

**AWS:**
- CloudWatch - Metrics and monitoring
  - SDK/Client: `@aws-sdk/client-cloudwatch` v3.1000.0
  - Auth: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` env vars
  - Usage: `server/data-sources/aws.js`
  - Credential management: `PUT /api/data-sources/aws/credentials` (whitelisted env vars in `server/data-source-env-map.js`)

**Datadog:**
- Application monitoring, metrics, and logs
  - SDK/Client: `@datadog/datadog-api-client` v1.52.0
  - Auth: `DATADOG_API_KEY`, `DATADOG_APP_KEY`, `DD_SITE` env vars
  - Usage: `server/data-sources/datadog.js`
  - Metrics API: `v1.MetricsApi` with 5-minute cache TTL
  - Credential management: `PUT /api/data-sources/datadog/credentials`

**Elasticsearch:**
- Log and event data search
  - SDK/Client: `@elastic/elasticsearch` v9.3.2
  - Auth: `ELASTICSEARCH_HOST`, `ELASTICSEARCH_API_KEY`, `ELASTICSEARCH_USERNAME`, `ELASTICSEARCH_PASSWORD` env vars
  - Usage: `server/data-sources/elasticsearch.js`
  - Credential management: `PUT /api/data-sources/elasticsearch/credentials`

**Salesforce:**
- CRM data and business metrics
  - SDK/Client: `jsforce` v3.10.14
  - Auth: `SALESFORCE_INSTANCE_URL`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_USERNAME`, `SALESFORCE_PASSWORD`, `SALESFORCE_SECURITY_TOKEN`, `SALESFORCE_ACCESS_TOKEN` env vars
  - Sandbox mode: `SALESFORCE_SANDBOX` env var
  - Usage: `server/data-sources/salesforce.js`
  - Credential management: `PUT /api/data-sources/salesforce/credentials`

**Zendesk:**
- Support and customer service metrics
  - SDK/Client: `node-zendesk` v6.0.1
  - Auth: `ZENDESK_SUBDOMAIN`, `ZENDESK_EMAIL`, `ZENDESK_API_TOKEN` env vars
  - Usage: `server/data-sources/zendesk.js`
  - Credential management: `PUT /api/data-sources/zendesk/credentials`

**VulnTrack (Internal):**
- Security vulnerability tracking
  - URL: Configurable via `VULNTRACK_API_URL` (default: https://vulntrack.madhive.dev)
  - Auth: `VULNTRACK_API_KEY` header `X-API-Key`
  - Client: Native `fetch` API
  - Usage: `server/data-sources/vulntrack.js`
  - Endpoints: `/api/reports/dashboard?teamIds=global`, `/api/vulnerabilities/stats?teamIds=global`
  - Cache: 2-minute TTL

**Checkly:**
- Synthetic monitoring and uptime checks
  - SDK/Client: Custom via `axios` v1.13.6
  - Auth: `CHECKLY_API_KEY`, `CHECKLY_ACCOUNT_ID` env vars
  - Usage: `server/data-sources/checkly.js`
  - Credential management: `PUT /api/data-sources/checkly/credentials`

**Hotjar:**
- Behavioral analytics and heatmaps
  - SDK/Client: Custom via `axios`
  - Auth: `HOTJAR_SITE_ID`, `HOTJAR_API_KEY` env vars
  - Usage: `server/data-sources/hotjar.js`
  - Credential management: `PUT /api/data-sources/hotjar/credentials`

**FullStory:**
- Session replay and analytics
  - SDK/Client: Custom via `axios`
  - Auth: `FULLSTORY_API_KEY`, `FULLSTORY_ORG_ID` env vars
  - Usage: `server/data-sources/fullstory.js`
  - Credential management: `PUT /api/data-sources/fullstory/credentials`

**Looker:**
- Business intelligence and dashboards
  - SDK/Client: Custom via `axios`
  - Auth: `LOOKER_BASE_URL`, `LOOKER_CLIENT_ID`, `LOOKER_CLIENT_SECRET` env vars
  - Usage: `server/data-sources/looker.js`
  - OAuth flow supported
  - Credential management: `PUT /api/data-sources/looker/credentials`

**Rollbar:**
- Error tracking and monitoring
  - SDK/Client: Custom via `axios`
  - Auth: `ROLLBAR_ACCESS_TOKEN`, `ROLLBAR_PROJECT_ID` env vars
  - Usage: `server/data-sources/rollbar.js`
  - Credential management: `PUT /api/data-sources/rollbar/credentials`

**Rootly:**
- Incident management
  - SDK/Client: Custom via `axios`
  - Auth: `ROOTLY_API_KEY` env var
  - Usage: `server/data-sources/rootly.js`
  - Credential management: `PUT /api/data-sources/rootly/credentials`

**Segment:**
- Customer data platform
  - SDK/Client: Custom via `axios`
  - Auth: `SEGMENT_ACCESS_TOKEN`, `SEGMENT_WORKSPACE_ID` env vars
  - Usage: `server/data-sources/segment.js`
  - Credential management: `PUT /api/data-sources/segment/credentials`

**Chromatic:**
- Design system testing and publishing
  - SDK/Client: Custom via `axios`
  - Auth: `CHROMATIC_PROJECT_TOKEN`, `CHROMATIC_APP_ID` env vars
  - Usage: `server/data-sources/chromatic.js`
  - Credential management: `PUT /api/data-sources/chromatic/credentials`

## Data Storage

**Databases:**
- SQLite (via `bun:sqlite`)
  - Connection: Local file at `data/tv-dashboards.db`
  - Client: Drizzle ORM v0.45.1
  - Purpose: Data source config storage and audit logging

**File Storage:**
- Local filesystem only - No cloud storage integration
- Config files: `config/dashboards.yaml`, `config/queries.yaml` (YAML format)
- Backups: `config/*.backup.*` (gitignored)
- Database: `data/tv-dashboards.db` (gitignored, auto-created)

**Caching:**
- In-memory Map objects in data source classes
  - GCP metrics: No explicit cache (query-based)
  - BigQuery: 5-minute TTL via `queryCache`
  - Datadog: 5-minute TTL via `metricCache`
  - VulnTrack: 2-minute TTL via local `cache`
  - Checkly, AWS, etc.: 5-minute TTL patterns

## Authentication & Identity

**Auth Provider:**
- Google OAuth 2.0 (optional, for studio editor access)
  - Implementation: `server/google-oauth.js`
  - Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `ALLOWED_DOMAIN`
  - Endpoint: `GET /auth/google/callback`
  - Purpose: Restrict editor access to `@madhive.com` domain users

**Public API Access:**
- TV display at `/` is read-only, no authentication required
- Studio at `/admin` requires Google OAuth if configured
- API routes at `GET /api/` are public (no auth gate currently)

**Service Account Authentication:**
- GCP Cloud Monitoring and BigQuery: Service account JSON key
  - Key path: `GOOGLE_APPLICATION_CREDENTIALS` env var
  - Service account email: `vulntrack-directory-api@mad-hack.iam.gserviceaccount.com`
  - IAM roles: `roles/monitoring.viewer` (all projects), `roles/bigquery.jobUser`, `roles/bigquery.dataViewer` (mad-data)

## Monitoring & Observability

**Error Tracking:**
- None configured by default
- Integrations available: Rollbar, Rootly, Sentry (via external API)

**Logs:**
- Pino structured logging (`pino` v10.3.1)
- Output: Console/stdout in development, JSON structured logs in production
- Pretty printing: `pino-pretty` v13.1.3 in dev
- Usage: `server/logger.js`
- Log levels: info, warn, error, debug

**Metrics:**
- Internal collection: `server/metrics.js` collects performance metrics
- Integrations: Datadog, AWS CloudWatch, GCP metrics (data sources, not self-reporting)

## CI/CD & Deployment

**Hosting:**
- Systemd service on Linux: `systemd service tv-dashboards`
- Service file loads `.env` via `EnvironmentFile` directive
- Auto-restart on system boot
- Manual restart: `sudo systemctl restart tv-dashboards`

**Build/Deployment:**
- No build step (vanilla JS + Elysia)
- Deployment: Copy source and run `bun install && sudo systemctl restart tv-dashboards`
- Dependencies: Requires Bun runtime and all env credentials
- Health check: API at `GET /openapi` returns OpenAPI schema (Scalar UI)

**CI Pipeline:**
- No GitHub Actions or CI service configured
- Manual testing via: `bun test`, `bun test:watch`, `bun test:coverage`

## Environment Configuration

**Required env vars:**
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to GCP service account JSON
- `GCP_PROJECTS` - Comma-separated list of GCP project IDs
- `MAPBOX_ACCESS_TOKEN` - Mapbox GL JS public token (pk.* format)
- `VULNTRACK_API_URL`, `VULNTRACK_API_KEY` - VulnTrack API credentials
- `PORT`, `HOST` - Server binding (defaults: 3000, tv.madhive.local)

**Optional env vars (data source credentials):**
- `DATADOG_API_KEY`, `DATADOG_APP_KEY`, `DD_SITE`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- `ELASTICSEARCH_HOST`, `ELASTICSEARCH_API_KEY`
- `SALESFORCE_*`, `ZENDESK_*`, `LOOKER_*`, etc. (see `server/data-source-env-map.js` for complete list)

**Secrets location:**
- `.env` file (gitignored)
- Google service account key: `google-service-account-key.json` (gitignored)
- All credentials must be manually provisioned before service start

## Webhooks & Callbacks

**Incoming:**
- No webhook endpoints configured
- All data is pull-based via APIs

**Outgoing:**
- None configured
- Data flows: Internal → External APIs (read-only)

## Mobile/Desktop Compatibility

**Frontend:**
- Mapbox GL JS - Uses WebGL for GPU rendering
- Requires: Hardware WebGL support (Chromium flag: `--ignore-gpu-blocklist`)
- Display: Optimized for 16:9 kiosk displays at 1080p
- Scaling: Device scale factor configurable via Chromium `--force-device-scale-factor`

**Browser Support:**
- Chromium/Chrome (primary - kiosk)
- Firefox, Safari (supported by Mapbox GL JS and vanilla JS)
- No IE11 support

---

*Integration audit: 2026-03-20*
