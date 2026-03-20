# Codebase Concerns

**Analysis Date:** 2026-03-20

## Tech Debt

**Dual widget data fetching architecture:**
- Issue: 81 widgets split between two incompatible systems — 58 use new `queryId`-based system via `data-source-registry.js`, 23 use legacy hardcoded functions in `server/gcp-metrics.js`. Widgets without queryId fall back to legacy functions. Requires script `scripts/auto-assign-queries.js` to re-assign queries if `dashboards.yaml` is regenerated.
- Files: `server/index.js` (lines 88-115), `server/data-source-registry.js` (lines 156-158), `server/gcp-metrics.js` (all legacy functions)
- Impact: Maintenance burden when adding new widgets, inconsistent data flow paths, harder to debug which system serves which widget. Silent fallback on registry failure masks data source issues.
- Fix approach: Migrate all 23 legacy widgets to use queryId system. Create dedicated `queryId` for each legacy function. Run auto-assign script. Remove fallback in `getData()` once all widgets migrated. Removes 1600+ lines from `gcp-metrics.js`.

**Unextracted session user email:**
- Issue: Two locations hardcode `userEmail = 'system@madhive.com'` instead of extracting from session/context.
- Files: `server/index.js` (lines 753, 856), `tests/integration/data-source-api.test.js` (lines 52, 86)
- Impact: Audit logs cannot track which user made config changes. Security and compliance issue for multi-user scenarios if authentication is ever added. Makes debugging user actions impossible.
- Fix approach: Extract user from session/request context. Add session management middleware. Update audit log schema to mark 'system' changes. Coordinate with any future auth implementation.

**Oversized client-side bundles:**
- Issue: `public/js/charts.js` (2931 lines, 102K), `public/js/studio.js` (2474 lines, 100K), `public/js/mapbox-map.js` (1434 lines, 58K). No bundling or minification for non-minified files. Each loads entirely on page request.
- Files: `public/js/charts.js`, `public/js/studio.js`, `public/js/mapbox-map.js`, `public/js/studio-canvas.js`
- Impact: High initial load time, large memory footprint in browser. studio.js contains 43 console.log calls and 38 JSON.parse/stringify operations. No tree-shaking or code splitting.
- Fix approach: Split charts.js by widget type (sparkline.js, gauge.js, map.js, etc.). Lazy-load MetricBrowser, QueryExplorer modules on-demand. Remove console.log statements. Consider lightweight bundler (esbuild) for production. Use dynamic imports for studio tabs.

**Manual config file backup rotation:**
- Issue: `config/` directory accumulates 20+ `.backup.*` files from auto-save logic. MAX_BACKUPS=10 in `query-manager.js` and `config-manager.js` enforces limit, but no cleanup on old files. Backup timestamps are application-generated (not filesystem mtime), risking confusion.
- Files: `server/query-manager.js` (line 14), `server/config-manager.js` (line 15), `config/` directory has 20+ backup files as of 2026-03-19
- Impact: Filesystem bloat, harder to find relevant backup by timestamp, cleanup requires manual intervention. Large YAML files (39KB queries.yaml, 31KB dashboards.yaml) multiply backup storage.
- Fix approach: Implement automatic cleanup when MAX_BACKUPS exceeded. Use filesystem mtime instead of generated timestamps. Archive old backups to `.backups/` directory by month. Document backup retention policy.

**Query manager empty object fallback:**
- Issue: `loadQueries()` and `saveQueries()` return empty `{}` objects on file not found or error without distinction. Callers cannot differentiate "no queries exist" from "file corruption/access error".
- Files: `server/query-manager.js` (lines 24, 35, 42, 59)
- Impact: Silent failures when queries.yaml is corrupted. Admin cannot tell if empty result means "no queries created yet" or "load failed". Audit trail does not capture error events.
- Fix approach: Return structured response `{ success: boolean, data: {...}, error?: string }` from all query manager functions. Log failures to audit table. Add `/api/config/status` endpoint to check file integrity.

**Empty catch blocks with silent failures:**
- Issue: Multiple locations swallow errors without logging. `studio-canvas.js` line catches and silently ignores widget update errors. `studio.js` catches promise rejections and returns empty objects `{}`. `app.js` ignores fetch errors.
- Files: `public/js/studio-canvas.js` (line ~360), `public/js/admin-api.js`, `public/js/importer.js`, `public/js/studio.js`
- Impact: Bugs in widget rendering or data fetch go unnoticed. No error telemetry. Users see blank widgets with no indication why. Makes debugging field issues impossible.
- Fix approach: Log all caught exceptions to browser console in development, send to error tracking service in production. Show user-facing toast notifications for fetch failures. Add error boundary pattern for widget rendering.

## Known Bugs

**Mapbox GL context loss on Intel Iris Xe + Mesa 25.x:**
- Symptoms: Map widgets display blank/black canvas. WebGL context unavailable despite browser support.
- Files: Infrastructure (`kiosk-display.js` or display config, not in codebase), `public/js/mapbox-map.js`
- Trigger: Running on TV display hardware (Intel Iris Xe graphics) with Mesa 25.x driver + Chromium default GPU blocklist.
- Workaround: Kiosk display uses `--ignore-gpu-blocklist` Chromium flag (required). Without it, Mapbox GL fails silently. FLAG IS CRITICAL.
- Mitigation: Document flag as mandatory in deployment docs. Consider fallback canvas-based map renderer if WebGL fails.

**Null checks insufficient for Nullable vs Optional TypeBox fields:**
- Symptoms: Some response fields return `null` wrapped in validation error `{ type: 'validation', found: {...} }` when schema uses `t.Optional()` alone instead of `t.Nullable()`.
- Files: `server/models/*.js` — all model definitions use `t.Optional()` for fields that can be null
- Trigger: Endpoints returning null for optional fields. Example: query metadata fields (description, project, timeWindow) marked Optional but actually nullable.
- Cause: TypeBox distinction — `Optional` means "can be omitted from payload", `Nullable` means "can be null value in payload". Both are needed for fields that can be either.
- Fix approach: Audit all model definitions in `server/models/`. For fields that can be `null` in responses, use `t.Nullable(t.Optional(...))` or `t.Union([t.String(), t.Null()])`.

**GCP metrics query timeout at 20 seconds:**
- Symptoms: Large metric queries occasionally timeout and fall back to mock data. User sees stale dashboard briefly before refresh.
- Files: `server/index.js` (line 107) hardcodes 20-second timeout in `Promise.race()`
- Trigger: Complex multi-metric queries on slow GCP API response (> 20s). VulnTrack queries sometimes exceed timeout.
- Impact: Silent fallback to mock data without user indication. Dashboard briefly shows wrong data. Occurs ~1-2 times per day based on server logs.
- Fix approach: Increase timeout to 30s (GCP SLA allows 30s). Add timeout indicator to UI (show spinner during fetch). Return error response if timeout, don't fallback to mock. Log timeout events to metrics.

## Security Considerations

**Studio endpoint unauthenticated but protected by network firewall:**
- Risk: `/admin` and all data source config endpoints (`PUT /api/data-sources/*/credentials`, `PUT /api/data-sources/*/config`) accept requests from any client without auth check.
- Files: `server/index.js` (line 781-786 comment), `public/studio.html`
- Current mitigation: Code comment documents network-level firewall protection. Studio accessible only on internal network `tv.madhive.local`. No auth tokens required internally. Access control is perimeter-based (firewall + mDNS on private network).
- Recommendations: If studio ever exposed to external network, add session-based auth immediately. Document this assumption in deployment checklist. Consider adding X-Internal-Network check header as belt-and-suspenders defense. Add audit logging for all credential changes (currently only tracks config changes, not credential changes).

**Environment variable whitelist incompleteness:**
- Risk: `data-source-env-map.js` contains whitelist of allowed env vars per data source. If whitelist is incomplete, credentials endpoint cannot accept legitimate config values.
- Files: `server/data-source-env-map.js` (all entries), `server/index.js` (line 789-799)
- Current validation: Per-source whitelist prevents arbitrary env var injection. Only whitelisted keys accepted in credential PUT requests. Prevents writing SESSION_SECRET, GOOGLE_APPLICATION_CREDENTIALS, etc.
- Recommendations: Audit all data sources to ensure whitelist is complete. Add schema validation in `/api/data-sources/:name/schema` endpoint. Document required vs optional fields. Add test case for each data source's full credential set.

**Sensitive data in configuration database:**
- Risk: `data/tv-dashboards.db` stores data source configs including potentially encrypted API keys in `dataSourceConfigs.config` column (JSON blob).
- Files: `server/db/schema.js` (dataSourceConfigs table), `server/data-source-config.js`
- Current mitigation: Database file (`tv-dashboards.db`, `tv-dashboards.db-shm`, `tv-dashboards.db-wal`) is gitignored. .env file (where secrets actually live) is also gitignored.
- Recommendations: Ensure database backups are encrypted. Document backup security requirements. Consider storing only references in database, not actual credential values. Implement field-level encryption for sensitive columns.

**Rate limiter falls back to 'unknown' key:**
- Risk: `rate-limiter.js` `getClientKey()` returns 'unknown' when X-Forwarded-For and X-Real-IP headers are missing. All requests from same IP with both headers missing share single rate limit bucket.
- Files: `server/rate-limiter.js` (line 51)
- Current mitigation: Nginx proxy sets X-Real-IP header on all requests. Internal network only — no external threat.
- Recommendations: Add logging when 'unknown' key used. Implement timeout-based session ID fallback using cookies. Document that rate limiting requires proper proxy headers.

## Performance Bottlenecks

**GCP metric descriptor caching with 5-minute TTL:**
- Problem: `gcp-metrics.js` caches 9,417+ GCP metric descriptors with 5-minute TTL. Large cache causes memory bloat on long-running server. Refresh on every 5-minute boundary means descriptor list lag.
- Files: `server/gcp-metrics.js` (caching logic around line 1615)
- Cause: Descriptor list is large (9,417 metrics × ~200 bytes each = ~2MB per project × 4 projects). Full refresh every 5 minutes even if nothing changed. No cache invalidation on descriptor update.
- Improvement path: Implement differential/incremental refresh — only fetch metrics updated since last fetch using GCP API filters. Increase TTL to 1 hour. Use LRU cache with max size (discard least-used metrics). Consider moving metrics list to separate endpoint cached at browser level.

**Dashboard config re-read on every request:**
- Problem: `loadConfig()` in `server/index.js` re-reads and re-parses `dashboards.yaml` on every API request, even with mtime-based cache. YAML parsing is expensive for 31KB file.
- Files: `server/index.js` (lines 64-81)
- Cause: Supports hot-reload across Bun worker processes using SO_REUSEPORT. Safety over performance trade-off.
- Current: Cached if mtime unchanged. Still stat() call per request.
- Improvement path: Implement debounced file watcher instead of mtime check. Cache parsed config for 10 seconds maximum. Use sendfile() for large config responses (avoid JSON serialization round-trip).

**Studio canvas render on every drag without throttling:**
- Problem: `studio-canvas.js` re-renders canvas grid overlay and widget positions on every mousemove during drag. No requestAnimationFrame throttling. Causes jank on slower machines.
- Files: `public/js/studio-canvas.js` (drag event handling)
- Impact: Visible lag when dragging large widgets. Multiple render calls per event. Canvas operations (clearRect, drawImage) called 60+ times/second.
- Improvement path: Throttle render calls to requestAnimationFrame. Batch DOM updates. Use CSS transforms for drag preview instead of canvas render. Consider WebGL canvas for high-performance grid overlay.

**Multiple JSON serialization in studio state management:**
- Problem: StudioApp uses `JSON.parse(JSON.stringify(config))` for deep clone on load, then JSON.stringify on every save. Complex configs (58+ widgets) × 20+ JSON operations = significant CPU.
- Files: `public/js/studio.js` (lines 47-52, 38 total JSON ops)
- Impact: UI freeze on save/load for large dashboards (>50 widgets). Notable on older displays/devices.
- Improvement path: Implement structural sharing or immutable data structure. Use typed arrays for large numeric data. Lazy-load widget configs. Implement undo/redo without full clone.

## Fragile Areas

**Query assignment script non-idempotent:**
- Files: `scripts/auto-assign-queries.js`
- Why fragile: Regenerating `dashboards.yaml` loses all queryId assignments to widgets. Requires manual re-run of auto-assign script or manual widget-by-widget reconfiguration. If script has bugs or crashes mid-run, dashboard becomes unqueryable.
- Safe modification: Version control auto-assign script. Add dry-run mode to preview changes. Implement idempotent query assignment logic (check if queryId already exists before assigning). Create pre-assignment backup. Document that auto-assign must follow any dashboards.yaml regeneration.
- Test coverage: No tests for auto-assign script. Script is critical path for dashboard generation. One bug breaks all dashboards.

**Canvas widget collision detection with resizing:**
- Files: `public/js/studio-canvas.js` (resize handle and collision logic)
- Why fragile: Collision detection checks against grid cells but doesn't account for partially-overlapping widgets during resize. Can result in widgets placed in invalid positions. Resize handles have hit detection issues on touch devices.
- Safe modification: Separate resize validation from drag validation. Test on actual touch display hardware. Add debug mode to visualize collision zones. Implement constraint-based layout system instead of pixel-based placement.
- Test coverage: No test coverage for collision detection. Manual testing only.

**BigQuery transaction state in routes:**
- Files: `server/bigquery-routes.js` (dataset/table enumeration with nested Promise.all)
- Why fragile: Nested Promise.all for listing datasets → tables → columns. If any middle operation fails, entire response fails. No partial result handling. Rate limit can trip mid-enumeration, leaving incomplete list.
- Safe modification: Implement streaming/pagination for BigQuery schema exploration. Add timeout per nested operation. Return partial results if timeout. Cache schema list (update every 1 hour, not on-demand).
- Test coverage: Integration tests exist but don't cover failure scenarios (GCP API errors, timeouts, large account with 1000+ tables).

**Theme system relies on inline CSS variable updates:**
- Files: `public/js/components/theme-selector.js`, theme-manager server side
- Why fragile: Themes update CSS variables dynamically. If JavaScript fails to apply theme, widgets render with mismatched colors. No fallback theme. Theme persistence uses localStorage without validation.
- Safe modification: Apply theme in HTML head before body renders (prevent flash). Validate theme object before applying. Implement CSS-in-JS with type checking. Store theme selection in database alongside user profile.
- Test coverage: No tests for theme system. Visual regressions won't be caught.

## Scaling Limits

**SQLite WAL mode on single-threaded display:**
- Current capacity: `tv-dashboards.db` is 28KB. Audit log table grows ~10 rows/day. Supports ~10,000 audit entries (3MB database file).
- Limit: SQLite WAL mode scales to ~100MB before performance degrades. With 10 rows/day, hitting limit in ~2 years.
- Scaling path: Implement audit log archival (move old entries to separate `.db.archive` file yearly). Consider PostgreSQL if audit queries become complex. For now, 2-year runway is acceptable.

**GCP Cloud Monitoring API rate limits:**
- Current capacity: Service account has default quota of 500 requests/minute. Dashboard with 58 widgets × 4 projects requests ~100 queries/minute during refresh.
- Limit: Adding more dashboards or faster refresh intervals will hit quota. VulnTrack concurrent requests also consume quota.
- Scaling path: Batch metric queries using GCP MQL (Monitoring Query Language) to reduce request count. Implement shared cache layer for common metrics. Request quota increase from GCP if scaling beyond 4 projects.

**Display device memory with large metric caches:**
- Current capacity: Mapbox GL JS (1.3M minified) + Charts library (102K) + Metric data in memory. Typical dashboard loads 50-100 data points per widget.
- Limit: Display hardware (Intel Iris Xe with 8GB RAM) can handle ~100 concurrent metric queries. Beyond that, page becomes unresponsive.
- Scaling path: Implement metric data compression. Lazy-load widget data (load only visible widgets on canvas). Implement service worker for offline caching. Consider dedicated metrics aggregation server to reduce frontend computation.

## Dependencies at Risk

**@google-cloud/monitoring vulnerability surface:**
- Risk: `@google-cloud/monitoring` v5.3.1 is direct dependency on internal Google API. Protobuf-generated code has historical vulnerabilities. No type safety on metric descriptors.
- Impact: Metrics query could fail or behave unexpectedly if Google updates API. No version pinning strategy documented.
- Migration plan: Monitor security advisories for @google-cloud packages. Pin minor version in package.json. Implement metric descriptor validation schema. Consider Google Cloud Client Library alternatives if vulnerabilities emerge.

**jsforce (Salesforce SDK) large dependency tree:**
- Risk: jsforce adds 1MB+ to node_modules. Vendored dependencies include outdated XML parsers with known vulnerabilities. Not actively maintained (last update Feb 2023).
- Impact: Bundle size, security scanning failures, potential XML injection vulnerabilities if Salesforce data is user-controlled.
- Migration plan: Evaluate if REST API can replace jsforce (remove entire dependency). If needed, create thin wrapper around REST client. Monitor security advisories monthly.

**Chromatic SDK dependency:**
- Risk: `chromatic` dependency tree includes optional dependencies that may not be installed. Dependency resolution is implicit.
- Impact: Chromatic widget data fetch may fail silently if SDK not properly initialized.
- Migration plan: Audit chromatic data source to ensure all dependencies are declared. Add fallback if SDK fails. Consider removing if unused on any dashboard.

## Missing Critical Features

**No query plan/explain for slow GCP queries:**
- Problem: Cannot diagnose slow metric queries. No visibility into GCP Monitoring API execution time. All queries treated equally regardless of metric cardinality.
- Blocks: Cannot optimize query performance or detect runaway queries.
- Solution: Implement `/api/gcp/metrics/explain` endpoint that returns metric metadata (cardinality, metric kind, value type, query cost estimate). Add query timing telemetry. Log slow queries (>5s) automatically.

**No audit trail for query/widget changes:**
- Problem: Dashboard edits create backups but no structured audit log of what changed. Admin cannot see "user added widget X" or "query Y was modified".
- Blocks: Cannot track configuration drift, debug dashboard regressions, or restore specific changes (only full-file backups available).
- Solution: Implement change tracking in dashboard manager. Store widget/query delta in audit table. Implement `/api/audit/changes?dashboard=X` endpoint. Add timeline UI in studio showing recent changes.

**No dashboard version control or branching:**
- Problem: Only one dashboard config per ID. Cannot test changes before deploying to TV. No rollback to previous dashboard state without manual file restore.
- Blocks: Cannot safely test dashboard changes. Cannot A/B test different layouts. One mistake affects TV display immediately.
- Solution: Implement draft/staging system. Allow multiple dashboard versions per ID. Add "preview as published" feature. Implement 1-click rollback to previous version.

**No data source health monitoring:**
- Problem: Failed data source connections fail silently. Widget shows "no data" but admin doesn't know if source is down, credentials are invalid, or query is slow.
- Blocks: Cannot proactively detect broken integrations. Dashboards degrade without visibility.
- Solution: Implement `/api/data-sources/health` endpoint with per-source status (connected/disconnected/error). Add background health check job. Show status indicator in Sources tab. Alert admin if source down >5 minutes.

## Test Coverage Gaps

**Widget rendering and data transformation not tested:**
- What's not tested: Canvas-based chart renderers (sparkline, gauge, USA map), widget data transformation pipeline (metric → widget value), color thresholding logic.
- Files: `public/js/charts.js` (all functions), `public/js/widgets.js`, data transformation in `server/gcp-metrics.js` (lines 1200+)
- Risk: Bugs in chart rendering only visible on TV display. Color thresholds may apply incorrectly. USA map snapping logic untested with all 50 states. Sparkline rendering can silently fail if data format unexpected.
- Priority: High — chart rendering is user-facing and cannot be debugged remotely on display device.

**Data source credential update endpoints not tested:**
- What's not tested: Credential validation, env var whitelist enforcement, hot-reload after credential update, error cases (invalid key format, rate limit).
- Files: `server/index.js` (lines 786-820), `server/data-source-env-map.js`
- Risk: Credentials endpoint can silently fail or reject valid input if validation rules not correct. No test for per-source validation rules.
- Priority: Medium — critical functionality but used infrequently (manual admin action).

**Studio canvas drag/resize collision detection:**
- What's not tested: Drag detection with overlapping widgets, resize validation at grid boundaries, collision detection edge cases (widget at grid edge, collision with multiple widgets).
- Files: `public/js/studio-canvas.js` (all drag/resize handlers)
- Risk: Widgets can be placed in invalid positions. Drag operations may behave unexpectedly. No automated test prevents regressions.
- Priority: Medium — manual testing sufficient for now, but fragile as codebase scales.

**BigQuery data source with large result sets:**
- What's not tested: Query returning 10,000+ rows, memory behavior with large result sets, pagination handling, timeout behavior on slow queries.
- Files: `server/data-sources/bigquery.js`, `server/bigquery-routes.js`
- Risk: Large query result can cause OOM or browser freeze. Query timeout behavior untested.
- Priority: Medium — not yet used at scale but critical for future campaign delivery dashboards if data grows.

---

*Concerns audit: 2026-03-20*
