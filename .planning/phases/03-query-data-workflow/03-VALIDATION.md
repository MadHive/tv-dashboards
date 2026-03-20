---
phase: 3
slug: query-data-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun:test |
| **Config file** | package.json scripts |
| **Quick run command** | `bun test --timeout 10000` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test --timeout 10000`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | QRYX-01 | unit | `bun test tests/query-builder.test.js` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | QRYX-01 | integration | `bun test tests/studio-integration.test.js` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | QRYX-02 | unit | `bun test tests/query-assign.test.js` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | DSRC-01 | unit | `bun test tests/datasource-health.test.js` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | DSRC-02 | unit | `bun test tests/credential-validation.test.js` | ❌ W0 | ⬜ pending |
| 03-05-01 | 05 | 2 | METR-01 | unit | `bun test tests/metric-browser.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/query-builder.test.js` — stubs for QRYX-01 (query run, result display)
- [ ] `tests/query-assign.test.js` — stubs for QRYX-02 (assign to widget, immediate update)
- [ ] `tests/datasource-health.test.js` — stubs for DSRC-01 (health fields, 17 sources)
- [ ] `tests/credential-validation.test.js` — stubs for DSRC-02 (client + server validation)
- [ ] `tests/metric-browser.test.js` — stubs for METR-01 (unified search, multi-source)
- [ ] `tests/studio-integration.test.js` — shared integration fixtures

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Query builder opens in correct panel slot (widget vs freestanding) | QRYX-01 | DOM/visual layout | Open studio, select widget → click "Build Query"; verify panel slides in. Click Queries tab → "+ New Query"; verify modal opens |
| "Assign to Widget" closes panel and updates widget immediately | QRYX-02 | Canvas render timing | Run query, click "Assign to Widget"; confirm widget refreshes without full page reload |
| Health section collapsible default state | DSRC-01 | Initial render state | Open Sources tab fresh; verify HEALTH section is collapsed by default |
| Credential save blocked until validation passes | DSRC-02 | Form UX flow | Enter invalid API key format; verify Save Credentials button is disabled until format passes |
| Metric browser source selector tab switching | METR-01 | Tab interaction | Open metric browser; click BigQuery tab; verify results change to BigQuery metrics |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
