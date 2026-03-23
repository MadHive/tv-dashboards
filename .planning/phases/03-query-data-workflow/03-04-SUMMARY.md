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
  - Multi-source metric browser with GCP, BigQuery, VulnTrack tabs (code only — not verified end-to-end)
  - BQ_MANIFEST static table manifest (7 mad-data tables)
  - VT_MANIFEST static curated VulnTrack endpoint list
  - Source tab strip dynamically built from /api/data-sources connection status

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

patterns-established:
  - "Pure mirror functions for DOM-free unit testing of browser logic (established in 03-01, extended here)"
  - "Manifest-based source browsing: static arrays with {name, description} rendered by shared _renderManifestRows()"

requirements-completed: []

# Metrics
duration: 15min
completed: 2026-03-20
---

# Phase 3 Plan 4: Metric Browser Sources Summary

**Multi-source metric browser tab strip implemented (b205db3) but Phase 3 end-to-end verification FAILED — health section empty, query browser non-functional, credentials UI broken**

## Performance

- **Duration:** ~15 min (Task 1) + checkpoint
- **Started:** 2026-03-20T19:15:00Z
- **Completed:** 2026-03-20T19:30:00Z (checkpoint only; verification not approved)
- **Tasks:** 1 of 2 completed (Task 2 checkpoint: FAILED)
- **Files modified:** 4

## Accomplishments

- Extended MetricBrowser with 5 new methods: `_buildSourceTabs`, `_switchSourceTab`, `_renderBigQueryManifest`, `_renderVulnTrackManifest`, `_renderManifestRows`
- GCP tab always present; BigQuery and VulnTrack tabs built dynamically from `/api/data-sources` connection status
- Disconnected sources handled via in-list message when not connected
- 12 unit tests written (zero test.todo calls), all passing

## Task Commits

1. **Task 1: Add source tab strip to metric browser and implement BigQuery/VulnTrack tabs** - `b205db3` (feat)

## Files Created/Modified

- `public/studio.html` - Added `id="mb-source-tabs"` div between topbar and mb-body
- `public/js/studio.js` - BQ_MANIFEST (7 tables), VT_MANIFEST (5 endpoints), mirrorBuildSourceTabs pure fn, 5 new MetricBrowser methods, updated open() and _apply()
- `public/css/studio.css` - .mb-source-tabs container, .mb-source-tab, .mb-source-tab.active (pink underline), .mb-source-tab.disabled styles
- `tests/unit/metric-browser-sources.test.js` - 12 tests covering tab visibility logic and BigQuery manifest structure

## Decisions Made

- BQ_MANIFEST is a static constant (7 known mad-data tables) rather than a live API fetch
- VulnTrack tab is always rendered but shows a "not connected" message in mb-list when not connected
- BigQuery and VulnTrack assignment in `_apply()` creates a queryId from the manifest item name and assigns directly to the widget

## Deviations from Plan

None during Task 1 execution. Task 2 (human-verify checkpoint) returned FAILED status.

## Verification Result: FAILED

Task 2 was a `checkpoint:human-verify` gate. The human tested the complete Phase 3 workflow at http://tv:3000/admin and reported the following issues.

### Gaps Found

**Gap 1: Health section is empty**
- **Symptom:** The HEALTH section in the Sources tab renders but shows no data — no source rows, no status dots, no timestamps, no error badges.
- **Scope:** Affects plans 03-01 (health telemetry server side) and 03-02 (health section UI + auto-refresh).
- **Plans to revisit:** 03-01 and/or 03-02.

**Gap 2: Query browser does not work in the query explorer**
- **Symptom:** Opening the query explorer (Queries tab, "+ New Query", or "Build Query" from widget properties) does not produce a working query browser — functionality is broken or non-functional.
- **Scope:** Affects plan 03-03 (query builder, Build Query button, result preview, one-click assign).
- **Plans to revisit:** 03-03.

**Gap 3: No way to view or save credentials**
- **Symptom:** The credential editing flow in the Sources tab is broken — users cannot view existing credential fields or save new credentials. The "Edit Credentials" and "Save Credentials" UI path does not work end-to-end.
- **Scope:** Affects plan 03-02 (credential validation) and possibly 03-01 (data-source credential endpoints).
- **Plans to revisit:** 03-01 and/or 03-02.

### Summary of Gaps

| Gap | Area | Severity | Plans Affected |
|-----|------|----------|----------------|
| Health section empty | Sources tab HEALTH section | High — primary Phase 3 feature | 03-01, 03-02 |
| Query browser non-functional | Query explorer / Build Query flow | High — core query workflow | 03-03 |
| Credentials UI broken | Sources tab Edit/Save Credentials | High — data source management | 03-01, 03-02 |

All three gaps indicate that prior plans in Phase 3 (03-01 through 03-03) produced incomplete implementations that passed unit tests but do not function correctly in the running application. Phase 3 is NOT complete and requires remediation before proceeding to Phase 4 or Phase 5.

## Issues Encountered

Human verification at Task 2 revealed that the Phase 3 implementation is partially working across three distinct areas. The metric browser source tabs from Task 1 of this plan were not reported as broken, but the Phase 3 features implemented in plans 03-01, 03-02, and 03-03 are all non-functional to varying degrees.

## User Setup Required

None.

## Next Phase Readiness

Phase 3 is NOT ready to advance. The following remediation is required before Phase 3 can be marked complete:

1. Fix health section: investigate 03-01 health endpoint responses and 03-02 HEALTH section rendering
2. Fix query browser: investigate 03-03 query explorer open/run/assign flow
3. Fix credentials UI: investigate 03-01/03-02 Edit/Save Credentials path
4. Re-run human verification after all three gaps are resolved

Phase 4 (TV polish) may proceed independently as it has no dependency on Phase 3.

---
*Phase: 03-query-data-workflow*
*Status: GAPS_FOUND — verification failed, remediation required*
*Completed: 2026-03-20 (partial — Task 1 only)*

## Self-Check: FAILED

Verification at Task 2 (checkpoint:human-verify) was NOT approved. The human reported:
- Health section is empty (renders, no data)
- Query browser does not work in query explorer
- No way to view or save credentials

Task 1 commit b205db3 exists and is valid. Task 2 did not pass. Phase 3 requires remediation across plans 03-01, 03-02, and 03-03 before this plan's acceptance criteria ("Human verifies complete Phase 3 workflow") can be met.
