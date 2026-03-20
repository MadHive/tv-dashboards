---
phase: 2
slug: dashboard-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (built-in) |
| **Config file** | none — bun discovers `*.test.js` automatically |
| **Quick run command** | `bun test tests/dashboard-manager.test.js` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test tests/dashboard-manager.test.js`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| wizard-html | 02-01 | 1 | DASH-01 | manual | Open /admin, click +, verify 2-step modal | manual-only | ⬜ pending |
| wizard-create | 02-01 | 1 | DASH-01 | unit | `bun test tests/dashboard-manager.test.js -t "create"` | Yes | ⬜ pending |
| dup-button | 02-02 | 1 | DASH-02 | manual | Hover sidebar item, verify ⧉ button appears | manual-only | ⬜ pending |
| dup-api | 02-02 | 1 | DASH-02 | unit | `bun test tests/dashboard-manager.test.js -t "duplicate"` | Yes | ⬜ pending |
| clipboard-logic | 02-03 | 2 | DASH-03 | unit | `bun test tests/unit/studio-clipboard.test.js` | ❌ W0 | ⬜ pending |
| id-regen | 02-03 | 2 | DASH-03 | unit | `bun test tests/unit/studio-clipboard.test.js -t "ID"` | ❌ W0 | ⬜ pending |
| multiselect-dom | 02-03 | 2 | DASH-03 | manual | Shift+click 2 widgets, verify both outlined blue | manual-only | ⬜ pending |
| paste-snap | 02-03 | 2 | DASH-03 | unit | `bun test tests/widget-config.test.js -t "snap"` | Yes (Phase 1) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/studio-clipboard.test.js` — clipboard deep-copy and widget ID regeneration logic (pure functions, no DOM)

*No framework install needed — `bun test` is built-in.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Wizard modal opens/advances steps | DASH-01 | DOM interaction, no JSDOM | Open `/admin`, click `+`, verify Step 1 → Step 2 → Create flow |
| Duplicate hover button appears | DASH-02 | DOM hover state | Hover sidebar dashboard item, verify `⧉` button visible |
| Shift+click multi-select | DASH-03 | Canvas DOM events | Click widget, Shift+click second, verify both have blue dashed outline |
| Rubber-band selection | DASH-03 | Canvas mousemove/mouseup | Drag on empty canvas, verify enclosed widgets selected |
| Cross-dashboard Ctrl+V paste | DASH-03 | Full studio flow | Copy widgets on dash A, switch to dash B, Ctrl+V, verify widgets placed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
