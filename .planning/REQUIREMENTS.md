# Requirements: MadHive TV Dashboards v2

**Defined:** 2026-03-20
**Core Value:** Operators and clients can see mission-critical metrics at a glance — the admin must make it easy to configure exactly what's shown, and the TV display must be visually clear and client-branded.

## v1 Requirements

### Widget Configuration (Admin)

- [x] **WDGT-01**: User can edit a widget's title and display labels from the properties panel
- [x] **WDGT-02**: User can set numeric size (W×H) and position (X/Y) overrides for precise layout control
- [x] **WDGT-03**: User can switch a widget's visualization type (e.g. big-number → gauge) without recreating the widget

### Dashboard Management (Admin)

- [x] **DASH-01**: User can create a new dashboard via a step-by-step wizard (name, layout, initial widgets)
- [x] **DASH-02**: User can duplicate an existing dashboard as a starting point for a new one
- [x] **DASH-03**: User can multi-select widgets and copy/paste them across dashboards

### Query Builder (Admin)

- [x] **QRYX-01**: User can write and execute a query against any connected data source from within the admin UI
- [x] **QRYX-02**: User can preview live query results before assigning the query to a widget

### Data Source Management (Admin)

- [x] **DSRC-01**: User can view a health dashboard showing per-source status, last-success time, and recent errors
- [x] **DSRC-02**: User can validate credential format/auth before saving (client-side + server-side check)

### Multi-Source Metrics

- [x] **METR-01**: User can browse and search metrics across all connected data sources in a unified metric browser

### TV Display

- [ ] **TVUX-01**: TV dashboard widget visuals are polished — sharper charts, gauges, and map styling
- [ ] **TVUX-02**: Client dashboard frames display the client's logo, color scheme, and font

### Codebase Foundation

- [ ] **FOUN-01**: All 23 legacy hardcoded widgets are migrated to the query system (zero dual-system widgets remaining)
- [ ] **FOUN-02**: All ~60 API routes have test coverage — inputs, outputs, and error cases
- [ ] **FOUN-03**: Query→transform→widget data pipeline has test coverage
- [ ] **FOUN-04**: Widget renderer functions have unit test coverage
- [ ] **FOUN-05**: studio.js and app.js are split/lazy-loaded to reduce initial bundle size

## v2 Requirements

### Widget Configuration

- **WDGT-04**: User can set alert thresholds per widget with color rules when metric crosses a limit

### Query Builder

- **QRYX-03**: User can create, update, and delete saved queries across all sources from the admin UI

### Data Source Management

- **DSRC-03**: User can run a live connection test against a data source and see detailed error output

### Multi-Source Metrics (Future Integrations)

- **METR-02**: AWS CloudWatch metrics surfaced into the widget query system
- **METR-03**: Datadog metrics surfaced into the widget query system
- **METR-04**: Grafana instance metrics pulled into the widget query system

### New Dashboards

- **NWDB-01**: Dedicated AWS ops screen (EC2, RDS, Lambda, CloudWatch alarms)
- **NWDB-02**: Dedicated Datadog alerts screen (active monitors, service health)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time WebSocket push | Polling architecture is intentional and sufficient for TV displays |
| Mobile app | TV/desktop web first — no mobile viewport requirement |
| Multi-user auth / login | Network-based access control is current design intent |
| Salesforce/Zendesk/FullStory/Hotjar metric widgets | Low demand, defer to v3 |
| TypeScript migration | Not requested; pure JS + JSDoc is the established pattern |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WDGT-01 | Phase 1 | Complete |
| WDGT-02 | Phase 1 | Complete |
| WDGT-03 | Phase 1 | Complete |
| DASH-01 | Phase 2 | Complete |
| DASH-02 | Phase 2 | Complete |
| DASH-03 | Phase 2 | Complete |
| QRYX-01 | Phase 3 | Complete |
| QRYX-02 | Phase 3 | Complete |
| DSRC-01 | Phase 3 | Complete |
| DSRC-02 | Phase 3 | Complete |
| METR-01 | Phase 3 | Complete |
| TVUX-01 | Phase 4 | Pending |
| TVUX-02 | Phase 4 | Pending |
| FOUN-01 | Phase 5 | Pending |
| FOUN-02 | Phase 5 | Pending |
| FOUN-03 | Phase 5 | Pending |
| FOUN-04 | Phase 5 | Pending |
| FOUN-05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 — traceability complete after roadmap creation*
