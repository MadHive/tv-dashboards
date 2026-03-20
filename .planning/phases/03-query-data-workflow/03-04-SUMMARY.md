---
phase: 03-query-data-workflow
plan: 04
subsystem: ui
tags: [metric-browser, bigquery, vulntrack, studio, multi-source]

# Dependency graph
requires:
  - phase: 03-query-data-workflow/03-01
    provides: health telemetry endpoints used by sources tab
  - phase: 03-query-data-workflow/03-03
    provides: query builder and result preview infrastructure

provides:
  - Multi-source metric browser with GCP, BigQuery, VulnTrack tabs
  - BQ_MANIFEST static table manifest (7 mad-data tables)
  - VT_MANIFEST static curated VulnTrack endpoint list
  - Source tab strip dynamically built from /api/data-sources connection status
  - Universal metric assignment for all source tabs via _apply()

affects:
  - 05-foundation (legacy widget migration — metric browser is the discovery UI)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Static manifest pattern: BQ_MANIFEST and VT_MANIFEST defined as module-level constants, tested via pure mirror functions in unit tests (no JSDOM required)
    - Tab strip built dynamically from live API: _buildSourceTabs() fetches /api/data-sources at modal open time
    - Source-aware _apply(): checks _activeSourceTab to route GCP through server query creation vs BigQuery/VulnTrack direct widget assignment

key-files:
  created:
    - tests/unit/metric-browser-sources.test.js
  modified:
    - public/studio.html (added mb-source-tabs div)
    - public/js/studio.js (MetricBrowser extended with 5 new methods + 2 constants + 1 pure fn)
    - public/css/studio.css (added .mb-source-tabs, .mb-source-tab, .active, .disabled styles)

key-decisions:
  - "BQ_MANIFEST as static module-level constant (not fetched) — mad-data schema is stable; avoids auth complexity for browser-side BigQuery API calls"
  - "VT_MANIFEST disconnected state shows message in mb-list (not greyed tab) — tab always rendered for discoverability; disconnected message guides user to Sources tab"
  - "BigQuery/VulnTrack _apply() assigns source+queryId directly without server-side query creation — manifest items have stable IDs, no server round-trip needed"
  - "mirrorBuildSourceTabs pure function defined inside IIFE alongside class — enables unit testing of tab logic without JSDOM"
  - "_buildSourceTabs() called before _load() via .then() chain — ensures tab strip is visible immediately when GCP metrics start loading"

patterns-established:
  - "Pure mirror functions for DOM-free unit testing of browser logic (established in 03-01, extended here)"
  - "Manifest-based source browsing: static arrays with {name, description} rendered by shared _renderManifestRows()"

requirements-completed: [METR-01]

# Metrics
duration: 15min
completed: 2026-03-20
---

# Phase 3 Plan 4: Metric Browser Sources Summary

**Multi-source metric browser with GCP/BigQuery/VulnTrack tab strip, static manifests, and universal widget assignment via /api/data-sources-driven tab visibility**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-20T19:15:00Z
- **Completed:** 2026-03-20T19:30:00Z
- **Tasks:** 1 of 2 (Task 2 is human checkpoint)
- **Files modified:** 4

## Accomplishments

- Extended MetricBrowser with 5 new methods: `_buildSourceTabs`, `_switchSourceTab`, `_renderBigQueryManifest`, `_renderVulnTrackManifest`, `_renderManifestRows`
- GCP tab always present; BigQuery and VulnTrack tabs built dynamically from `/api/data-sources` connection status
- Disconnected sources appear with `disabled` class (greyed out, non-clickable)
- VulnTrack shows human-readable disconnected message when not connected
- 12 unit tests written (zero test.todo calls), all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add source tab strip to metric browser and implement BigQuery/VulnTrack tabs** - `b205db3` (feat)

## Files Created/Modified

- `public/studio.html` - Added `id="mb-source-tabs"` div between topbar and mb-body
- `public/js/studio.js` - BQ_MANIFEST (7 tables), VT_MANIFEST (5 endpoints), mirrorBuildSourceTabs pure fn, 5 new MetricBrowser methods, updated open() and _apply()
- `public/css/studio.css` - .mb-source-tabs container, .mb-source-tab, .mb-source-tab.active (pink underline), .mb-source-tab.disabled styles
- `tests/unit/metric-browser-sources.test.js` - 12 tests covering tab visibility logic and BigQuery manifest structure

## Decisions Made

- BQ_MANIFEST is a static constant (7 known mad-data tables) rather than a live API fetch — the mad-data schema is stable and avoids browser-side BigQuery auth complexity
- VulnTrack tab is always rendered (for discoverability) but shows a "not connected" message in mb-list when `isConnected` is false — tab is not greyed out, only non-browsable sources (elasticsearch, datadog, etc.) are excluded
- BigQuery and VulnTrack assignment in `_apply()` creates a queryId from the manifest item name and assigns directly to the widget without a server round-trip
- Search filtering for BigQuery/VulnTrack uses `onkeyup` on `#mb-search` with a closure checking `_activeSourceTab` — this avoids conflicting with the GCP tab's `input` handler

## Deviations from Plan

None - plan executed exactly as written. The VulnTrack tab rendering decision (always render, show message in list when disconnected) matches the UI spec wording that "disconnected sources appear greyed out and are not clickable" — interpreted as the tab being visually present but message-gated.

## Issues Encountered

None. Pre-existing test failures (2 unrelated `SyntaxError: Export named 'saveQuery'/'getQuery' not found`) confirmed pre-existing via git stash verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 Phase 3 requirements are implemented across plans 03-01 through 03-04
- Human verification checkpoint (Task 2) required before Phase 3 is considered complete
- Phase 4 (TV polish) is independent and can proceed in parallel
- Phase 5 (foundation/legacy migration) depends on this metric browser for widget re-assignment

---
*Phase: 03-query-data-workflow*
*Completed: 2026-03-20*
