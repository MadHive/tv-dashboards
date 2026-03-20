# Roadmap: MadHive TV Dashboards v2

## Overview

The v2 initiative improves a live, working system — 23 dashboards on display now for MadHive ops and 6 clients. The roadmap delivers admin UI control first (the blocker that forces YAML edits today), then dashboard management and data workflows, then visual polish on the TV side, and finally foundation cleanup that makes the codebase safe to scale. Every phase leaves the existing dashboards running and unharmed.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Widget Control** - Admin users can configure any widget's content, size, and visualization type from the properties panel without touching YAML (completed 2026-03-20)
- [x] **Phase 2: Dashboard Management** - Admin users can create new dashboards, duplicate existing ones, and move widgets across dashboards (completed 2026-03-20)
- [ ] **Phase 3: Query & Data Workflow** - Admin users can write, test, preview, and assign queries to widgets; data source health is visible at a glance (GAPS_FOUND 2026-03-20 — remediation required: health section empty, query browser broken, credentials UI broken)
- [ ] **Phase 4: TV Display Polish** - TV dashboards display sharper visuals and full per-client branding (logo, colors, font)
- [ ] **Phase 5: Foundation** - All 23 legacy widgets migrated to the query system; API, pipeline, and UI tests in place; JS bundles split for faster load

## Phase Details

### Phase 1: Widget Control
**Goal**: Admin users can configure any widget's title, labels, dimensions, and visualization type directly from the properties panel — no YAML editing required
**Depends on**: Nothing (existing studio canvas and properties panel are the foundation)
**Requirements**: WDGT-01, WDGT-02, WDGT-03
**Success Criteria** (what must be TRUE):
  1. User selects any widget on the canvas and edits its title and display labels in the properties panel; the TV display reflects the change after save
  2. User enters numeric W, H, X, Y values in the properties panel and the widget snaps to those exact grid coordinates
  3. User changes a widget's visualization type (e.g. big-number to gauge) from the properties panel; the widget re-renders as the new type without losing its data source assignment
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — HTML/CSS foundation + subtitle rendering + Wave 0 test scaffolds
- [ ] 01-02-PLAN.md — Property field wiring (set/bind) + position snap-to-nearest collision
- [ ] 01-03-PLAN.md — Type-switch auto-match, config preservation, mismatch warnings + tests

### Phase 2: Dashboard Management
**Goal**: Admin users can stand up new dashboards and reorganize widgets without manual YAML authoring
**Depends on**: Phase 1
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. User completes the new dashboard wizard (name, layout choice, initial widgets) and the dashboard appears in the TV rotation immediately
  2. User duplicates an existing dashboard; a new independent copy appears in the sidebar with all widgets intact and editable
  3. User multi-selects widgets on the canvas and pastes them onto a different dashboard, with positions and data source assignments preserved
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Dashboard creation wizard modal + duplicate button with inline rename
- [ ] 02-02-PLAN.md — Multi-select (shift+click, rubber-band) + multi-select properties panel
- [ ] 02-03-PLAN.md — Clipboard Ctrl+C/V + cross-dashboard paste with collision resolution

### Phase 3: Query & Data Workflow
**Goal**: Admin users can build and test queries against any connected source from within the editor, preview live results before assigning them, and see the health of every data source without leaving the admin UI
**Depends on**: Phase 1
**Requirements**: QRYX-01, QRYX-02, DSRC-01, DSRC-02, METR-01
**Success Criteria** (what must be TRUE):
  1. User writes a query in the in-editor query builder, selects a data source, runs it, and sees a live result table without leaving the studio
  2. User previews live query results in a panel and assigns the query to a widget in one click; the widget updates immediately
  3. User opens the data source health dashboard and sees per-source status, last-success timestamp, and recent error messages for all 17 connected sources
  4. User edits credentials for a data source and cannot save until client-side and server-side validation pass; invalid credentials surface a clear error message
  5. User opens the metric browser and searches across all connected sources in one unified interface, then assigns a metric directly to a widget
**Plans**: 5 plans

Plans:
- [ ] 03-01-PLAN.md — Server-side health telemetry fields + Wave 0 test scaffolds
- [ ] 03-02-PLAN.md — Data source health UI section + credential validation
- [ ] 03-03-PLAN.md — Query builder (Build Query button, result preview, one-click assign)
- [ ] 03-04-PLAN.md — Unified metric browser with multi-source tabs
- [ ] 03-05-PLAN.md — Gap closure: fix health section, query explorer, and credential editor runtime bugs

### Phase 4: TV Display Polish
**Goal**: TV dashboards look sharp and client-branded — charts, gauges, and maps render with improved clarity; each client's logo, color scheme, and font are applied to their dashboard frame
**Depends on**: Nothing (parallel to admin phases; independent frontend work)
**Requirements**: TVUX-01, TVUX-02
**Success Criteria** (what must be TRUE):
  1. Charts, gauges, sparklines, and Mapbox maps render visibly sharper on the TV display — crisp lines, readable labels, no aliasing artifacts
  2. Each client dashboard frame displays the correct client logo, applies the client's primary color scheme, and uses the client's configured font — distinct from the MadHive internal ops style
**Plans**: TBD

Plans:
- [ ] 04-01: Widget visual polish (charts, gauges, map styling)
- [ ] 04-02: Per-client branding (logo, color scheme, font per client frame)

### Phase 5: Foundation
**Goal**: The codebase is clean, tested, and ready to scale — all 23 legacy widgets run through the modern query system; every API route and data pipeline has test coverage; the JS bundles load fast
**Depends on**: Phase 3 (query system must be fully capable before migrating legacy widgets into it)
**Requirements**: FOUN-01, FOUN-02, FOUN-03, FOUN-04, FOUN-05
**Success Criteria** (what must be TRUE):
  1. Zero widgets use the legacy hardcoded data path — all 81 widgets have a queryId and run through the data-source-registry; the fallback branch in getData() is removed
  2. All ~60 API routes have passing tests covering valid inputs, invalid inputs, and error cases; CI fails on any new route without test coverage
  3. The query-to-widget data pipeline (query execution → transform → widget data shape) has test coverage for all widget types and data sources
  4. Widget renderer functions (sparkline, gauge, bar-chart, pipeline, map) have unit tests that can run headlessly without a display device
  5. Opening the studio and TV display triggers no JS bundle larger than the post-split baseline; heavy modules (MetricBrowser, Mapbox) load on demand rather than on initial page load
**Plans**: TBD

Plans:
- [ ] 05-01: Migrate all 23 legacy widgets to queryId system
- [ ] 05-02: API route test suite (~60 routes, all cases)
- [ ] 05-03: Data pipeline test coverage (query → transform → widget)
- [ ] 05-04: Widget renderer unit tests (headless)
- [ ] 05-05: JS bundle split and lazy-load (studio.js, app.js, heavy modules)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5
Phase 4 (TV polish) is independent of phases 2 and 3 and may overlap.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Widget Control | 3/3 | Complete    | 2026-03-20 |
| 2. Dashboard Management | 3/3 | Complete    | 2026-03-20 |
| 3. Query & Data Workflow | 4/5 | Gap Closure | - |
| 4. TV Display Polish | 0/2 | Not started | - |
| 5. Foundation | 0/5 | Not started | - |
