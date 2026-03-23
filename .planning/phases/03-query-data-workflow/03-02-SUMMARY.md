---
phase: 03-query-data-workflow
plan: 02
subsystem: ui
tags: [studio, datasources, health-monitoring, credential-validation, polling, vanilla-js]

# Dependency graph
requires:
  - phase: 03-01
    provides: GET /api/data-sources/health endpoint with sessionErrorCount, lastSuccessAt, isConnected, isReady fields

provides:
  - Collapsible HEALTH section in Sources sidebar tab with per-source status rows
  - Auto-refresh polling every 30s while Sources tab is active (start/stop on tab switch)
  - Client-side credential form validation with inline "Required." errors per field
  - Server-rejection error banner at top of credential form
  - Save button disabled during in-flight credential PUT request

affects:
  - 03-03
  - 03-04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Health polling: setInterval(30000) started on tab activate, clearInterval on tab leave"
    - "Validation mirror: pure mirrorValidateCredFields() in tests mirrors DOM-level _validateCredForm()"
    - "data-key + data-required attributes on credential inputs enable attribute-driven validation"

key-files:
  created:
    - tests/unit/studio-credential-validation.test.js
  modified:
    - public/studio.html
    - public/js/studio.js
    - public/css/studio.css

key-decisions:
  - "health-section-header uses data-target=health-section-content to plug into bindCollapsibles() auto-wire pattern"
  - "saveBtn.disabled = true/false used instead of setAttribute for cleaner idiomatic JS"
  - "mirrorValidateCredFields pure function in test file replicates DOM _validateCredForm logic without JSDOM"

patterns-established:
  - "Health row click toggles health-error-detail div expand/collapse inline (no modal)"
  - "Polling indicator: .health-poll-dot with @keyframes pulse animation, shown/hidden with display style"

requirements-completed:
  - DSRC-01
  - DSRC-02

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 03 Plan 02: Sources Tab Health Section and Credential Validation Summary

**Collapsible HEALTH section in Sources tab with 30s auto-refresh polling, inline Required. validation, and server-error banners on credential save**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T19:00:09Z
- **Completed:** 2026-03-20T19:04:10Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- HEALTH section renders above datasource-list in Sources sidebar with per-source status dot, name, last-success timestamp, and error count badge; clicking an error row expands inline error detail
- Health polling starts automatically when datasources tab activates (setInterval 30s), stops when any other tab is selected; pulse dot animation visible during polling
- Credential form validates all required fields client-side before any network request; empty required fields show inline "Required." per field; server rejections show a banner at top of dse-fields with actionable message
- All 4 credential validation unit tests converted from test.todo to passing tests using a pure mirror function

## Task Commits

1. **Task 1: Add HEALTH section HTML, CSS, and polling logic to Sources tab** - `ca3f1ca` (feat)
2. **Task 2: Add client-side credential validation with inline errors** - `8b69831` (feat)

## Files Created/Modified

- `public/studio.html` - Added health-section-header (collapsible, data-target wired) and health-section-content div before datasource-list inside panel-datasources
- `public/js/studio.js` - Added _validateCredForm(), _renderHealthSection(), _startHealthPolling(), _stopHealthPolling(), _formatRelativeTime(); updated bindSidebarTabs() to start/stop polling; updated dse-save handler with validation and error banner; added data-key/data-required to credential inputs
- `public/css/studio.css` - Added .health-row, .health-timestamp, .health-error-badge, .health-error-detail, .health-poll-dot, @keyframes pulse, .validation-error, .validation-banner styles
- `tests/unit/studio-credential-validation.test.js` - Replaced 4 test.todo stubs with real passing tests using mirrorValidateCredFields pure function

## Decisions Made

- Used `data-target` attribute on health-section-header to plug into the existing `bindCollapsibles()` auto-wire pattern (all `.sidebar-section-header.collapsible` elements are wired on init)
- Used `saveBtn.disabled = true/false` instead of `setAttribute('disabled', '')` / `removeAttribute('disabled')` for cleaner idiomatic JS
- mirrorValidateCredFields in tests is a pure function (no JSDOM required) that directly mirrors the DOM-bound _validateCredForm logic

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — 2 pre-existing unrelated test failures in data-sources/computed.test.js and routes/query-test-execution.test.js were present before this plan and are out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- HEALTH section and credential validation are complete; Sources tab is fully functional for Plan 03-03/03-04 to build on
- Health endpoint (/api/data-sources/health) is already integrated with polling; any new data fields added server-side will render automatically in existing rows

---
*Phase: 03-query-data-workflow*
*Completed: 2026-03-20*

## Self-Check: PASSED

- public/studio.html: FOUND
- public/js/studio.js: FOUND
- public/css/studio.css: FOUND
- tests/unit/studio-credential-validation.test.js: FOUND
- .planning/phases/03-query-data-workflow/03-02-SUMMARY.md: FOUND
- Commit ca3f1ca: FOUND
- Commit 8b69831: FOUND
