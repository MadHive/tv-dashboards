---
phase: 1
slug: widget-control
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (built-in) |
| **Config file** | none — bun discovers `*.test.js` files automatically |
| **Quick run command** | `bun test tests/widget-config.test.js` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test tests/widget-config.test.js`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| subtitle-storage | 01 | 1 | WDGT-01 | unit | `bun test tests/widget-config.test.js -t "subtitle"` | ❌ W0 | ⬜ pending |
| format-storage | 01 | 1 | WDGT-01 | unit | `bun test tests/widget-config.test.js -t "format"` | ❌ W0 | ⬜ pending |
| tv-subtitle-render | 01 | 2 | WDGT-01 | manual | Open TV display, verify subtitle shows below title | manual-only | ⬜ pending |
| position-input-write | 02 | 1 | WDGT-02 | unit | `bun test tests/widget-config.test.js -t "position"` | ❌ W0 | ⬜ pending |
| snap-collision | 02 | 1 | WDGT-02 | unit | `bun test tests/widget-config.test.js -t "snap"` | ❌ W0 | ⬜ pending |
| type-switch-auto-match | 03 | 1 | WDGT-03 | unit | `bun test tests/widget-config.test.js -t "auto-match"` | ❌ W0 | ⬜ pending |
| type-switch-config-preserve | 03 | 1 | WDGT-03 | unit | `bun test tests/widget-config.test.js -t "config preservation"` | ❌ W0 | ⬜ pending |
| type-switch-dom | 03 | 2 | WDGT-03 | manual | Studio: change type, verify Labels section shows/hides | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/widget-config.test.js` — covers WDGT-01 (subtitle/format field storage), WDGT-02 (position snap logic), WDGT-03 (type-switch auto-match + config preservation)
- [ ] `tests/helpers/widget-config-helpers.js` — shared fixtures: mock dash config, mock widget configs per type, mock queries object

*No test framework install needed — `bun test` is built-in.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TV display renders subtitle div when wc.subtitle is set | WDGT-01 | DOM rendering requires browser — no Playwright/Puppeteer in project | Open `/`, select a dashboard, verify subtitle text appears below widget title after save |
| Type switch section visibility (Labels show/hide) | WDGT-03 | DOM visibility toggling requires browser | Open `/admin`, select widget, change type, verify Labels section appears/disappears correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
