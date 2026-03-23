# MadHive TV Dashboards — v2 Enhancement

## What This Is

A real-time operational TV dashboard system for MadHive and its clients. Currently live with 23 dashboards (11 internal ops + 12 client screens), a WYSIWYG studio editor at `/admin`, and a clean TV display at `/`. The v2 initiative focuses on making the admin experience fully-featured, expanding to multi-source metrics (AWS, Datadog, Grafana, and more), improving visual quality, and establishing test coverage across the stack.

## Core Value

Operators and clients can see mission-critical metrics at a glance on TV screens — the admin must make it easy to configure exactly what's shown, and the TV display must be visually clear and client-branded.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — inferred from existing codebase -->

- ✓ TV dashboard display at `/` — rotation, keyboard nav, pause/resume, real-time refresh — existing
- ✓ Studio editor at `/admin` — 3-panel WYSIWYG (sidebar, canvas, properties) — existing
- ✓ ~60 REST API routes with OpenAPI docs at `/openapi` — existing
- ✓ GCP Cloud Monitoring integration — 46 named queries, 58 widgets using query system — existing
- ✓ BigQuery integration — historical queries and custom SQL — existing
- ✓ VulnTrack integration — security vulnerability metrics — existing
- ✓ 23 legacy hardcoded widgets (bidder/roger/k8s metrics) — existing
- ✓ Mapbox GL JS maps — 3 campaign delivery dashboards with GPU rendering — existing
- ✓ Data source registry — plugin architecture, 17 sources, hot-reloadable credentials — existing
- ✓ YAML-driven config — dashboards.yaml + queries.yaml with in-memory caching — existing
- ✓ 15+ widget types — big-number, stat-card, gauge, sparkline, bar-chart, pipeline, map, table — existing
- ✓ Theme system — CSS variable mapping per dashboard — existing
- ✓ Template system — save/load dashboard templates — existing
- ✓ SQLite audit log — config change history via Drizzle ORM — existing
- ✓ Per-client dashboards — 6 clients (iHeart, FOX, Hearst, Nexstar, EW Scripps, Cox) — existing

### Active

<!-- Current scope — building toward these -->

**Admin UI — Widget Configuration**
- [ ] Widget property panel: edit title, labels, display text for any widget
- [ ] Widget threshold configuration: set alert thresholds with color rules per widget
- [ ] Widget size/position: numeric input overrides for precise layout control
- [ ] Widget type switching: change visualization type without recreating widget

**Admin UI — Dashboard Management**
- [ ] Dashboard creation wizard: step-by-step flow for new dashboards
- [ ] Dashboard duplication: clone existing dashboard as starting point
- [ ] Bulk widget operations: multi-select, copy/paste across dashboards

**Admin UI — Query Builder**
- [ ] In-editor query builder: write, test, and preview queries against any data source
- [ ] Query result preview: live data preview before assigning to widget
- [ ] Query library management: CRUD for saved queries across all sources

**Admin UI — Data Source Management**
- [ ] Data source health dashboard: status, last-success, error rates per source
- [ ] Connection testing with detailed error output
- [ ] Credential validation before saving

**Multi-Source Metrics**
- [ ] AWS CloudWatch integration — surface existing SDK into widget query system
- [ ] Datadog metrics integration — surface existing SDK into widget query system
- [ ] Grafana integration — pull dashboards/metrics from Grafana instances
- [ ] Unified metric browser — search/browse metrics across all connected sources
- [ ] New dedicated dashboards: AWS ops screen, Datadog alerts screen

**TV Display Improvements**
- [ ] Widget visual polish — sharper charts, gauges, and map styling
- [ ] Per-client branding — logo, color scheme, font applied to client dashboard frames

**Codebase Foundation**
- [ ] Migrate 23 legacy hardcoded widgets to the query system (eliminate dual-system)
- [ ] Full API test coverage — all ~60 Elysia routes with inputs, outputs, error cases
- [ ] Data pipeline test coverage — query→transform→widget data flow tests
- [ ] UI component test coverage — widget renderer unit tests
- [ ] JS bundle optimization — split studio.js and app.js, lazy-load heavy modules

### Out of Scope

- Real-time WebSocket push — polling architecture is intentional and sufficient
- Mobile app — TV/desktop web first
- Multi-user auth — network-based access control is current design intent
- Salesforce/Zendesk/FullStory/Hotjar metric widgets — low demand, defer to v3

## Context

- **Server**: Remote Linux host (awork, 10.10.8.79), Bun runtime, systemd service `tv-dashboards`
- **Display**: Chromium kiosk with `--ignore-gpu-blocklist` required for Mapbox WebGL on Intel Iris Xe
- **Auth**: Network-based only — no login, access controlled by network
- **Config**: YAML files are canonical source of truth; SQLite stores audit/credential state
- **Dual widget system**: 58 widgets use queryId (clean data flow); 23 use legacy hardcoded functions (target for migration)
- **Existing SDKs**: AWS CloudWatch (`@aws-sdk/client-cloudwatch`) and Datadog (`@datadog/datadog-api-client`) are already installed but not surfaced in the UI

## Constraints

- **Tech Stack**: Bun + Elysia.js + Vanilla JS — no framework migrations, no TypeScript migration
- **No build step**: Vanilla JS served directly — bundle optimization means runtime splitting, not Webpack/Vite
- **Backward compatibility**: All existing 23 dashboards and widget configs must survive every change
- **Config safety**: Never overwrite dashboards.yaml or queries.yaml from tests — backups exist but prevention is better

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Brownfield improvement (not rewrite) | Large working system with real clients — iterate, don't rebuild | — Pending |
| Admin UI features as v2 priority | Users blocked by inability to configure widgets/dashboards without YAML edits | — Pending |
| Migrate legacy widgets to query system | Removes dual-system complexity; unlocks multi-source data for all widgets | — Pending |
| Full test coverage as foundational phase | Codebase growing; tests needed before confident refactoring | — Pending |

---
*Last updated: 2026-03-20 after initialization*
