---
phase: 03-query-data-workflow
plan: 05
subsystem: ui
tags: [javascript, studio, datasource, query-explorer, credential-editor, bug-fix, class-scope]

# Dependency graph
requires:
  - phase: 03-query-data-workflow
    provides: "Health section, Query Explorer, Credential Editor code written in plans 03-01 through 03-04"
provides:
  - "All three gap-closure fixes verified working in browser"
  - "Health section renders datasource rows with status dots and timestamps"
  - "Query Explorer executes GCP queries and renders results in modal"
  - "Credential editor opens with input fields from schema, validates on save"
affects:
  - 04-tv-polish
  - 05-foundation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All StudioApp instance methods must remain inside the StudioApp class body — MetricBrowser is a sibling class, not a nested scope"
    - "Class-scope audit: grep for method definitions after the closing brace of MetricBrowser to verify placement"

key-files:
  created: []
  modified:
    - public/js/studio.js

key-decisions:
  - "Root cause was method scope: renderDatasourceList, openDatasourceEditor, _showDseCredView, _loadCredentialForm, _renderHealthSection, _startHealthPolling and related methods were accidentally placed inside MetricBrowser class body instead of StudioApp — JS silently treated them as MetricBrowser methods, causing TypeError on all this.renderDatasourceList() calls from StudioApp"
  - "Fix was a pure structural relocation: all affected methods moved back into StudioApp, duplicates inside MetricBrowser removed, no logic changes"
  - "GCP source health error 'Saved query not found: kafka-writes-madmaster' is a real data error (widget references a deleted query ID), NOT a code bug — health section correctly surfaces it"

patterns-established:
  - "Gap-closure plan pattern: when verification fails after a phase, create a targeted 03-05-PLAN.md with gap_closure: true to fix runtime issues without rewriting working code"

requirements-completed:
  - DSRC-01
  - DSRC-02
  - QRYX-01
  - QRYX-02

# Metrics
duration: 30min
completed: 2026-03-20
---

# Phase 3 Plan 5: Runtime Bug Fix (Gap Closure) Summary

**Relocated datasource/health methods from MetricBrowser back into StudioApp, fixing silent TypeError that broke health section, query explorer, and credential editor in the admin UI**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-20T20:00:00Z
- **Completed:** 2026-03-20T20:30:00Z
- **Tasks:** 4 (3 auto + 1 human-verify)
- **Files modified:** 1

## Accomplishments

- Identified single root cause for all three gap-closure bugs: datasource/health methods inside MetricBrowser instead of StudioApp
- Moved all affected methods back to StudioApp and removed MetricBrowser duplicates in one targeted commit
- Human verification confirmed all three flows work: health section renders rows, query explorer runs queries and shows results, credential editor opens with input fields and validates on save

## Task Commits

Each task was committed atomically:

1. **Tasks 1-3: Debug and fix health section, query explorer, credential editor** - `ed3737c` (fix)
2. **Task 4: Human-verify checkpoint** - approved by user

**Plan metadata:** (this commit)

## Files Created/Modified

- `public/js/studio.js` - Moved `renderDatasourceList`, `openDatasourceEditor`, `_showDseCredView`, `_showDseQueryView`, `_loadCredentialForm`, `_validateCredForm`, `_saveCredentials`, `_renderHealthSection`, `_startHealthPolling`, `_stopHealthPolling` and supporting methods from MetricBrowser class body back into StudioApp class body; removed duplicates

## Decisions Made

- Root cause was structural (class scope), not logic: all three bugs shared one fix — no separate patches per feature
- The GCP health error "Saved query not found: kafka-writes-madmaster" is expected behavior — a widget in dashboards.yaml references a query ID that no longer exists in queries.yaml; the health section is working correctly by surfacing this real data inconsistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Methods accidentally inside MetricBrowser class body**
- **Found during:** Task 1 (debugging health section empty rendering)
- **Issue:** `renderDatasourceList`, `openDatasourceEditor`, `_showDseCredView`, `_loadCredentialForm`, `_renderHealthSection`, `_startHealthPolling`, and related methods were inside MetricBrowser's class body instead of StudioApp's. When `bindSidebarTabs()` in StudioApp called `this.renderDatasourceList()`, JavaScript threw `TypeError: this.renderDatasourceList is not a function` silently (no visible console error in production). This caused all three features to silently fail at the same entry point.
- **Fix:** Moved all affected methods to StudioApp, removed MetricBrowser duplicates. Bumped cache-busting version to `?v=24`.
- **Files modified:** `public/js/studio.js`
- **Verification:** Human verified all three flows at checkpoint — health section shows rows, query explorer renders results, credential editor opens with form fields
- **Committed in:** `ed3737c`

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Single structural fix resolved all three reported gaps. No scope creep.

## Issues Encountered

- No console error was visible in production for the TypeError — JS silently swallowed the call to `this.renderDatasourceList()` when it didn't exist on the StudioApp instance, making the root cause non-obvious from browser inspection alone. Code audit of class boundaries was required to find the misplacement.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 is now complete — all requirements (DSRC-01, DSRC-02, QRYX-01, QRYX-02) verified in browser
- One known data inconsistency: a widget references `kafka-writes-madmaster` query ID that was removed from queries.yaml — health section surfaces this correctly; operator should re-assign or remove the widget
- Phase 4 (TV polish) can proceed; Phase 5 (foundation/migration) depends on Phase 3 being complete

---
*Phase: 03-query-data-workflow*
*Completed: 2026-03-20*
