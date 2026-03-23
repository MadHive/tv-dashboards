---
phase: 01-widget-control
plan: 02
subsystem: ui
tags: [studio, dashboard, widget, properties-panel, collision-detection, snap-to-nearest]

# Dependency graph
requires:
  - phase: 01-widget-control
    plan: 01
    provides: "HTML fields for subtitle, format, labels, and labels-section div; Wave 0 test scaffolds with snap-to-nearest todos"
provides:
  - "StudioCanvas.snapToNearest() and StudioCanvas.hasCollision() on public API"
  - "Drop handler snaps to nearest open slot instead of rejecting collisions"
  - "Dragover updates prop-colspan and prop-rowspan inputs (not just col/row)"
  - "set()/bind() wiring for prop-subtitle, prop-format, prop-x-label, prop-y-label, prop-legend"
  - "updateSectionVisibility(type) method covering display/map/mgl/labels sections (DRY)"
  - "Position bind handlers (col/row/colspan/rowspan) use snapToNearest for collision-safe moves"
  - "Wave 0 snap-to-nearest test.todo() stubs filled in with 5 real passing tests"
affects: [01-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snap-to-nearest collision resolution: search right→down→left→up in expanding rings; clamp desired position to grid bounds before fast-path no-collision check"
    - "StudioCanvas public API extended with hasCollision/snapToNearest for cross-file access from studio.js"
    - "updateSectionVisibility(type) as a class method — single source of truth for all section show/hide logic"
    - "Pure helper functions in test helpers (snapToNearest, hasCollision) mirror browser globals for testability"

key-files:
  created: []
  modified:
    - public/js/studio-canvas.js
    - public/js/studio.js
    - tests/widget-config.test.js
    - tests/helpers/widget-config-helpers.js

key-decisions:
  - "Clamped desiredCol/desiredRow to grid boundaries before the no-collision fast-path check in _snapToNearest (bug fix: unclamped overflow position passed grid validation incorrectly)"
  - "Used inline DOM updates (document.getElementById) in position bind handlers instead of the local set() closure — set() is not accessible from bindWidgetPropListeners scope"
  - "Exposed _hasCollision and _snapToNearest on StudioCanvas public API rather than inlining in studio.js — avoids code duplication across two files"
  - "Added pure snapToNearest/hasCollision helpers to test helper file to test the algorithm without browser globals"

patterns-established:
  - "Pattern: updateSectionVisibility(type) class method as DRY replacement for inline section visibility blocks in two call sites"
  - "Pattern: StudioCanvas.snapToNearest(dash, col, row, colSpan, rowSpan, widgetId) for all position collision resolution"

requirements-completed: [WDGT-01, WDGT-02]

# Metrics
duration: 8min
completed: 2026-03-20
---

# Phase 1 Plan 02: JS Wiring — Subtitle/Format/Labels + Snap-to-Nearest Collision Summary

**Studio properties panel fully wired with subtitle/format/label fields; position inputs and drag-and-drop use snap-to-nearest collision resolution via StudioCanvas.snapToNearest()**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-20T14:16:36Z
- **Completed:** 2026-03-20T14:24:36Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- All 5 new fields (subtitle, format, xLabel, yLabel, legendLabels) populate on widget select and bind on input change
- Drag-and-drop snaps to nearest open slot instead of rejecting blocked drops
- Position inputs (col/row/colspan/rowspan) trigger snap-to-nearest via StudioCanvas.snapToNearest()
- Labels section appears/disappears based on widget type via updateSectionVisibility()
- Section visibility logic is now DRY — single updateSectionVisibility() method instead of inline blocks in two places
- 5 WDGT-02 snap test.todo() stubs filled in; test suite passes 11 tests, 3 todo (auto-match, for Plan 03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract hasCollision+snapToNearest to StudioCanvas public API; snap drop handler** - `85fb56b` (feat)
2. **Task 2: Wire subtitle/format/labels set()+bind(); updateSectionVisibility; position snap** - `be9392d` (feat)

## Files Created/Modified
- `public/js/studio-canvas.js` - Added _snapToNearest(); converted drop handler to snap; dragover updates colspan/rowspan inputs; exposed hasCollision+snapToNearest on return object
- `public/js/studio.js` - Added updateSectionVisibility() method; set()/bind() for 5 new fields; snap-aware position bind handlers
- `tests/widget-config.test.js` - Filled in 5 WDGT-02 snap test.todo() stubs with real tests
- `tests/helpers/widget-config-helpers.js` - Added pure hasCollision() and snapToNearest() helpers for test environment

## Decisions Made
- Clamped desiredCol/desiredRow to grid bounds before the no-collision fast-path check in _snapToNearest. Without this, an out-of-bounds desired position (e.g., col 4 with colSpan 2 on a 4-column grid) passed the collision check and was returned unclamped.
- Used inline `document.getElementById()` calls in position bind handlers instead of the `set()` closure — `set()` is defined inside `showWidgetProps()` and is not accessible from `bindWidgetPropListeners()`.
- Exposed `_hasCollision` and `_snapToNearest` on StudioCanvas public API to avoid duplicating the algorithm in studio.js.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed grid boundary clamping in _snapToNearest fast-path**
- **Found during:** Task 2 (test execution)
- **Issue:** `_snapToNearest` called `_hasCollision` with the unclamped desired position before clamping — so an out-of-bounds position (e.g., col 4, colSpan 2 on a 4-column grid) found no collision and was returned as-is, violating the grid boundary.
- **Fix:** Added `dc = Math.max(1, Math.min(dash.grid.columns - colSpan + 1, desiredCol))` clamping before the no-collision fast-path check in both `_snapToNearest` (studio-canvas.js) and the test helper `snapToNearest` (widget-config-helpers.js).
- **Files modified:** `public/js/studio-canvas.js`, `tests/helpers/widget-config-helpers.js`
- **Verification:** "snap clamps to grid boundaries" test passes; full suite: 11 pass, 3 todo, 0 fail.
- **Committed in:** be9392d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary correctness fix. Snap-to-nearest would silently return invalid positions without it. No scope creep.

## Issues Encountered
None beyond the boundary clamping bug (handled above).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All WDGT-01 and WDGT-02 fields are wired and functional in the properties panel
- Plan 03 can proceed with: type-switch auto-match query logic, config preservation on type change, mismatch warning display
- 3 WDGT-03 auto-match test.todo() stubs remain for Plan 03 to fill in

---
*Phase: 01-widget-control*
*Completed: 2026-03-20*
