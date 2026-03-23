---
phase: 4
slug: tv-display-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun:test (built into Bun runtime) |
| **Config file** | none — test runner auto-discovers |
| **Quick run command** | `bun test tests/unit/widgets/ tests/unit/charts/` |
| **Full suite command** | `bun test tests/unit tests/integration tests/helpers tests/components` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test tests/unit/widgets/ tests/unit/charts/`
- **After every plan wave:** Run `bun test tests/unit tests/integration tests/helpers tests/components`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | TVUX-01 | unit | `bun test tests/unit/widgets/gauge.test.js` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | TVUX-01 | unit | `bun test tests/unit/charts/chart-rendering.test.js` | ✅ | ⬜ pending |
| 04-01-03 | 01 | 1 | TVUX-01 | unit | `bun test tests/unit/widgets/gauge.test.js` | ✅ (extend) | ⬜ pending |
| 04-01-04 | 01 | 1 | TVUX-01 | manual | Visual inspection at TV distance | — | ⬜ pending |
| 04-02-01 | 02 | 1 | TVUX-02 | unit | `bun test tests/unit/widgets/client-branding.test.js` | ❌ Wave 0 | ⬜ pending |
| 04-02-02 | 02 | 1 | TVUX-02 | unit | `bun test tests/unit/widgets/client-branding.test.js` | ❌ Wave 0 | ⬜ pending |
| 04-02-03 | 02 | 1 | TVUX-02 | unit | `bun test tests/unit/widgets/client-branding.test.js` | ❌ Wave 0 | ⬜ pending |
| 04-02-04 | 02 | 1 | TVUX-02 | unit | `bun test tests/unit/gcp-dashboards.test.js` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/widgets/client-branding.test.js` — covers TVUX-02 font link injection, CSS var override, and logo image rendering (new file)
- [ ] Extend `tests/unit/gcp-dashboards.test.js` — assert all 12 client dashboards have `logoImage` and `logoFont` fields in parsed YAML

*Existing gauge, chart, and widget tests cover the canvas param changes without structural additions — extend them with assertions on the new `threshold-crit`/`threshold-warn` class toggling.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Leaderboard font sizes legible at TV distance | TVUX-01 | Requires human at 3m from 4K display | View map dashboards on TV; confirm market names readable without squinting |
| Mapbox delivery marker clarity at TV distance | TVUX-01 | Subjective rendering quality at distance | View campaign-delivery dashboards on TV; confirm markers visible and state-colored |
| Client font renders correctly with brand styling | TVUX-02 | Font loading and visual harmony requires human judgment | Switch to each client dashboard on TV; confirm font applies cleanly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
