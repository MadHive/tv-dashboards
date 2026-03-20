# Phase 4: TV Display Polish - Research

**Researched:** 2026-03-20
**Domain:** Vanilla JS frontend — Canvas 2D rendering, CSS custom properties, Google Fonts dynamic loading, Mapbox GL JS layer styling
**Confidence:** HIGH (all findings from direct source inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Client Logo Rollout**
- Logo image replaces the logoText/logoSub text when `logoImage` is set — text is the fallback when no image exists
- Connect all 6 clients: iHeart already done; FOX, Hearst, Nexstar, Scripps, Cox get their SVGs wired in dashboards.yaml (`logoImage` field)
- SVG files already exist in `/img/`: `fox-logo.svg`, `hearst-logo.svg`, `nexstar-logo.svg`, `scripps-logo.svg`, `cox-logo.svg`
- Both client dashboards per client (e.g. `iheart-delivery` and `iheart-metrics`) get the logo — applies to all 12 client dashboard entries
- Logo sizing: Claude decides the max-height and width constraints to fit the existing `.top-left` frame layout cleanly

**Per-Client Font Branding**
- Each client gets a distinct Google Font for their display typeface — stored as `logoFont` in the `clientBranding` object in dashboards.yaml
- Font applies to: dashboard name, logo area text, and widget titles. Canvas chart labels (gauge numbers, sparkline axis) stay in Space Grotesk — no canvas re-render required
- Font loaded dynamically via a `<link>` injected into `<head>` when `_applyClientBranding()` runs; removed when switching to a MadHive internal dashboard
- CSS variable `--font-display` is overridden per client to apply the loaded font
- Claude picks appropriate fonts per client based on brand aesthetic (stored in dashboards.yaml for review/edit)
- MadHive internal ops dashboards (non-client) retain Space Grotesk + DM Sans + IBM Plex Mono unchanged

**Widget Visual Sharpness — TV Distance Readability**
- Target: widgets legible from 3+ meters without squinting — focus on readability over crispness
- Specific improvements (Claude decides exact values):
  - Increase font sizes for big-number values, gauge center text, and widget subtitle labels
  - Bump line weights for sparklines and bar charts — thicker strokes read better at distance
  - Improve contrast ratios on secondary text (current `--t3` labels may be too dim)
  - Larger tick labels on pipeline stage counts
- Threshold/alert states should be unmissable: stronger glow on gauges in warn/crit state; pulsing animation for critical values (CSS keyframe animation, not canvas-based)
- DPR scaling is already implemented — this pass does not change the canvas setup logic, only the visual parameters (lineWidth, fontSize, shadow)

**Mapbox Map Styling**
- Keep the `dark-v11` Mapbox base style — focus effort on the delivery data overlay, not the base map
- Delivery marker treatment: Claude decides the approach that reads best at TV distance on dark-v11
- Leaderboard panel (top markets list) gets the same TV-distance readability pass: larger font, better spacing, cleaner accent styling
- No custom Mapbox Studio style required for this phase

### Claude's Discretion
- Logo sizing constraints (max-height/width values)
- Exact font choices per client (stored in dashboards.yaml — user can edit)
- Specific lineWidth/fontSize increments for canvas widget improvements
- Delivery marker visual treatment (dots vs heat vs hybrid)
- Pulsing animation timing for critical threshold states

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TVUX-01 | TV dashboard widget visuals are polished — sharper charts, gauges, and map styling | Canvas draw params in charts.js + Mapbox layer paint in mapbox-map.js identified; exact change sites documented below |
| TVUX-02 | Client dashboard frames display the client's logo, color scheme, and font | `_applyClientBranding()` extension pattern fully mapped; all 5 missing logoImage fields and the logoFont injection mechanism documented below |
</phase_requirements>

---

## Summary

Phase 4 is a pure frontend visual pass — no new data sources, routes, or YAML schema changes beyond adding two fields per client branding block. All complexity is in reading exactly where the current draw parameters live and what values to change.

The codebase is cleanly separated: `charts.js` holds Canvas 2D renderers with hardcoded draw parameters (lineWidth, fontSize, shadowBlur); `dashboard.css` holds HTML widget sizes (big-number: 88px, stat-card: 62px); `mapbox-map.css` holds leaderboard text sizes; `_applyClientBranding()` in `app.js` is the single integration point for all per-client overrides. Every change site has been read and is documented precisely below.

The validation architecture for this phase is browser-visual by nature (TV display UX). The test suite uses bun:test with a happy-dom environment via `tests/helpers/dom-helpers.js`. Existing widget unit tests (gauge, big-number, stat-card) verify DOM structure — the same pattern extends to verify CSS property values and new class presence for threshold animation. The only manual-only validation is the actual TV viewing experience.

**Primary recommendation:** Make all changes file-by-file in this order: (1) dashboards.yaml — add `logoImage` + `logoFont` to 10 client dashboard entries; (2) app.js — extend `_applyClientBranding()` for font link injection; (3) dashboard.css — font size / contrast bumps + keyframe animation; (4) charts.js — lineWidth / shadowBlur / fontSize draw params; (5) mapbox-map.css — leaderboard text sizes.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D API | Browser native | Gauge, sparkline, bar, pipeline rendering | Already used; DPR scaling implemented |
| Mapbox GL JS | v3.x (loaded from CDN) | GPU-accelerated map with GeoJSON layers | Already installed; dark-v11 style confirmed |
| Google Fonts | CSS @import + dynamic `<link>` | Per-client typeface delivery | Pattern already used in dashboard.css line 6 |
| CSS Custom Properties | Browser native | Per-client color + font overrides | `_applyClientBranding()` uses `setProperty()` today |
| bun:test | Bun runtime test runner | Unit + integration tests | Established project test framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| happy-dom | Via `tests/helpers/dom-helpers.js` | JS DOM simulation for canvas/widget unit tests | All widget renderer unit tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Google Fonts `<link>` injection | CSS `@font-face` self-hosted | Self-hosting eliminates FOUT risk but requires font file assets; Google Fonts with `display=swap` is simpler and all client fonts are web-standard |
| CSS keyframe pulsing | Canvas-based animation loop | Canvas animation would block the existing pipeline particle loop; CSS keyframes run on the compositor thread and cost nothing |

**Installation:** No new packages required — all changes are CSS, JS draw parameters, and YAML data.

---

## Architecture Patterns

### Recommended Project Structure

No structural changes needed. All edits are within existing files:

```
public/
├── css/
│   ├── dashboard.css        # font sizes, contrast, keyframe animation
│   └── mapbox-map.css       # leaderboard text sizes
├── js/
│   ├── app.js               # _applyClientBranding() font link injection
│   └── charts.js            # lineWidth, fontSize, shadowBlur draw params
config/
└── dashboards.yaml          # logoImage + logoFont fields per client
```

### Pattern 1: Logo Image — Current Implementation (iHeart reference)

`_applyClientBranding()` in `app.js` lines 186–203 already handles logo image insertion. The pattern: if `brand.logoImage` is set, create or reuse an `<img class="brand-logo-img">`, prepend it to `.top-left`, set `height:28px;width:auto`. On non-client dashboards the img is removed. The `onerror` handler removes broken images.

**Current img style (inline, line 195):**
```javascript
logoImg.style.cssText = 'height:28px;width:auto;opacity:0.9;margin-right:8px;';
```

The `.top-left` div uses `display:flex; align-items:baseline; gap:10px` (dashboard.css line 101). With the image at 28px height and `align-items:baseline`, SVG logos that have no text baseline will look fine — they float to the flex cross-axis.

**For this phase:** Add `logoImage` field to the 10 remaining client dashboard entries in dashboards.yaml. No code change needed for the insertion mechanism — it already works (confirmed by iHeart).

**Logo image paths confirmed present in `/img/`:**
- `fox-logo.svg`
- `hearst-logo.svg`
- `nexstar-logo.svg`
- `scripps-logo.svg`
- `cox-logo.svg`
- `iheart-logo.svg` (already wired via `rf2d7i-iheartmedia-vertical-logo-red.png`)

**YAML field to add (per client, in both delivery and metrics dashboard):**
```yaml
clientBranding:
  # ... existing fields ...
  logoImage: /img/fox-logo.svg   # example
  logoFont: Oswald               # example — Claude chooses per brand
```

### Pattern 2: Per-Client Font — Link Injection

`_applyClientBranding()` currently sets CSS variables but has no font link logic. The extension adds font link inject/remove inside the same function.

**Extension point — inside the `if (brand)` block after CSS variable sets (after line 204):**
```javascript
// Font link injection
const existingLink = document.getElementById('client-font-link');
if (brand.logoFont) {
  const fontFamily = brand.logoFont.replace(/ /g, '+');
  const href = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@400;500;600;700&display=swap`;
  if (!existingLink) {
    const link = document.createElement('link');
    link.id   = 'client-font-link';
    link.rel  = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  } else if (existingLink.href !== href) {
    existingLink.href = href;
  }
  r.style.setProperty('--font-display', `'${brand.logoFont}', sans-serif`);
} else if (existingLink) {
  existingLink.remove();
}
```

**In the `else` block (restore MadHive defaults, after line 217):**
```javascript
const cl = document.getElementById('client-font-link');
if (cl) cl.remove();
// --font-display was already cleared via removeProperty('--font-display') in the variable reset loop
```

**FOUT strategy:** `display=swap` is the correct choice for TV displays. The font loads asynchronously; the fallback (`sans-serif`) renders immediately. On a local network TV (no cold DNS), Google Fonts typically resolves in under 200ms. The swapgap is invisible at TV frame rate. The alternative (preload `<link rel="preload" as="style">`) requires knowing the font URL at page-load time, which defeats dynamic per-client loading. `display=swap` is correct here.

**`--font-display` is already consumed by:**
- `.widget-title` — `font-family: var(--font-display)` (dashboard.css line 245)
- `#top-bar` — `font-family: var(--font-display)` (dashboard.css line 90)
- `.logo-text`, `.logo-sub` inherit from top-bar
- `.big-number-value` — `font-family: var(--font-display)` (dashboard.css line 296)
- `.stat-card-value` — `font-family: var(--font-display)` (dashboard.css line 341)

Canvas chart text (`ctx.font = "700 ${size}px 'Space Grotesk', sans-serif"`) is hardcoded in charts.js and stays Space Grotesk per the locked decision.

### Pattern 3: Canvas Draw Parameter Improvements (TVUX-01)

**DPR setup is at charts.js lines 28–38 — DO NOT TOUCH.** The `setup()` function is correct. Only change draw parameters.

**Current gauge parameters (charts.js lines 118–176):**
- `lineW = Math.max(10, radius * 0.18)` — arc track thickness
- Value arc: `lineWidth = lineW * 0.5` (glow layer) and `lineWidth = lineW` (main)
- `shadowBlur = 18` (only on glow layer — line 146)
- Center text: `fontSize = Math.max(20, radius * 0.55)` (line 164)
- Unit text: `Math.max(12, radius * 0.22)` (line 172)

**Recommended improvements (Claude's discretion):**
- `shadowBlur`: 18 → 32 for normal state, 56 for warn/crit (more visible glow at distance)
- `lineW` formula: `Math.max(12, radius * 0.22)` (slightly thicker track reads better at 3m)
- Center fontSize: `Math.max(24, radius * 0.62)` (bigger number for TV distance)

**Current sparkline parameters (charts.js lines 63–113):**
- `lineWidth = 3` (line 97)
- Last-point dot: `radius = 4` (line 106), glow ring: `radius = 9` (line 110)

**Recommended:** `lineWidth = 4`, dot radius 5, glow ring 12

**Critical threshold pulsing — CSS keyframe approach:**
The gauge widget sets `canvas.style.display = ''` on update — it does not set any class on the parent widget. The widget card element is `div.widget.widget-gauge` with `data-widget-id`. The cleanest approach is for the gauge widget update function to toggle a class on the container element based on threshold state.

```javascript
// In gaugeWidget.update(data) — after computing color:
const thresholdState = computeThresholdState(data.value, config.thresholds, config.invert);
container.closest('.widget')?.classList.toggle('threshold-warn', thresholdState === 'warn');
container.closest('.widget')?.classList.toggle('threshold-crit', thresholdState === 'crit');
```

Then CSS handles the animation:
```css
@keyframes critPulse {
  0%   { box-shadow: 0 0 0 0 rgba(251,113,133,0); }
  50%  { box-shadow: 0 0 24px 4px rgba(251,113,133,0.45); }
  100% { box-shadow: 0 0 0 0 rgba(251,113,133,0); }
}
.widget.threshold-crit {
  animation: critPulse 2.4s ease-in-out infinite;
  border-color: var(--red);
}
.widget.threshold-warn {
  border-color: var(--amber);
}
```

**`thresholdColor()` in charts.js already computes the color** — a parallel `computeThresholdState()` helper returning `'ok'|'warn'|'crit'` is the right pattern. The existing `thresholdColor()` cannot be reused as-is because it returns a color string, not a state.

### Pattern 4: Leaderboard TV Readability (TVUX-01)

Current leaderboard font sizes (mapbox-map.css):
- `.mgl-lb-table` font-size: 17px
- `thead th` font-size: 13px
- `.mgl-lb-lb-title` font-size: 17px
- `.mgl-lb-header-total` font-size: 17px
- `.mgl-lb-val` font-size: 9px
- `.mgl-lb-state` font-size: 11px
- `.mgl-lb-rank` font-size: 10px
- `.mgl-lb-bar-wrap` height: 4px

These are small for a 340px-wide overlay at 3m viewing distance. Recommended increases: table base 19–20px, header labels 15px, rank/state cells 13px, bar height 6px. The leaderboard is 340px wide with right: 12px — the width is fixed CSS so font increases may require row height adjustments.

**Total impressions overlay** (`.mgl-total-value`): already 72px font — adequate for TV. `.mgl-total-label` at 12px and `.mgl-total-sub` at 13px could go to 14px without layout impact.

### Pattern 5: Widget Title / Secondary Text Contrast

**`.widget-title`** (dashboard.css line 244): `font-size: 18px; color: var(--t2)` — `--t2` is `#D0C4E4` on MadHive and per-client overrides. This is reasonable. The 18px at TV distance is marginal — 19–20px would be safer.

**`.widget-subtitle`** (dashboard.css line 256): `font-size: 11px; color: var(--t3)` — `--t3` is `#8B75B0`, a dim purple. At TV distance this is likely invisible. Bump to 13px and lighten: consider `--t3` → `#A896C8` in :root, or use `color: var(--t2)` on subtitle elements. The locked decision says "improve contrast ratios on secondary text."

**`.big-number-value`** (dashboard.css line 296): `font-size: 88px` — already large, adequate.

**`.stat-card-value`** (dashboard.css line 341): `font-size: 62px` — adequate. The dynamic scaling in widgets.js (lines 110–112) reduces to 42px for long strings — this is the real bottleneck for TV readability with strings > 8 chars.

### Anti-Patterns to Avoid

- **Changing `setup()` in charts.js** — DPR scaling is correct; touching it will break all canvas renders.
- **Animating canvas elements with CSS keyframes** — canvas elements are replaced on each data refresh; keyframe animations on `<canvas>` reset on every `setup()` call. Animate the parent `.widget` card div instead.
- **Injecting a new `<link>` on every dashboard switch** — check `document.getElementById('client-font-link')` first; update `href` only if changed.
- **Using `font-display: block`** — this hides text until the font loads, causing invisible labels on TV. Use `display=swap`.
- **Setting `--font-display` without including a generic fallback** — always append `, sans-serif` so text renders during font swap.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TV-distance readability | Custom rendering engine | Increase CSS font sizes + canvas draw params | All rendering infrastructure exists; only values change |
| Per-client font delivery | Self-hosted font files | Google Fonts dynamic `<link>` with `display=swap` | Client fonts are web-standard; CDN is fastest delivery mechanism |
| Critical threshold animation | Canvas redraw animation loop | CSS `@keyframes` on parent `.widget` div | CSS animations run on compositor thread; canvas redraws compete with data refresh |
| Logo image format handling | Image conversion pipeline | SVG files already exist in `/img/` | All 5 client SVGs confirmed present; just add YAML field |

**Key insight:** Every visual improvement in this phase is a parameter change, not a structural change. The infrastructure is complete.

---

## Common Pitfalls

### Pitfall 1: Logo Sizing — SVG aspect ratio vs fixed height

**What goes wrong:** SVG logos with wide aspect ratios (FOX logo is very wide) overflow the `.top-left` flex container when only `height` is constrained. The `.top-left` has `gap: 10px` and sits next to `#page-icon` and `#page-title` in the top bar — overflow pushes the title off-center.

**Why it happens:** `height: 28px; width: auto` works for portrait logos; wide logos get unrestricted width.

**How to avoid:** Add `max-width: 120px` to the `.brand-logo-img` inline style (or a CSS class). At 28px height, most network TV client logos are narrower than 120px. Alternatively `max-height: 28px; max-width: 140px; width: auto; height: auto` gives the safest box.

**Warning signs:** Top bar title text wraps or disappears when a client logo loads.

### Pitfall 2: Font Link Accumulation on Rapid Dashboard Switch

**What goes wrong:** If `_applyClientBranding()` is called multiple times in quick succession (config refresh fires while rotation timer fires), multiple `<link>` elements are appended with different font URLs.

**Why it happens:** The guard `document.getElementById('client-font-link')` works only if the first link was appended before the second call begins.

**How to avoid:** Single `id="client-font-link"` on the link element; update `href` if the element exists. Remove the link only in the `else` (non-client) branch. This is a straightforward DOM guard — already described in Pattern 2 above.

**Warning signs:** `document.head` accumulates multiple `<link rel="stylesheet">` elements with Google Fonts URLs.

### Pitfall 3: Canvas Class Toggle on widget-gauge vs widget-big-number

**What goes wrong:** `container.closest('.widget')` traverses up the DOM. In `bigNumber`, the `container` is `.widget-content` which is a child of `.widget`. In `gaugeWidget`, same structure. But `closest('.widget')` may not find `.widget` if the DOM structure changes.

**Why it happens:** The widget card structure is built in `app.js renderPages()` — `.widget > .widget-title + .widget-content`. The chain is reliable.

**How to avoid:** Null-check: `container.closest?.('.widget')?.classList.toggle(...)`. The optional chaining prevents throws if the element is ever rendered outside the normal card structure (e.g., in tests with minimal DOM).

**Warning signs:** `Cannot read properties of null (reading 'classList')` in test runs.

### Pitfall 4: CSS Specificity — Client Font Override Being Ignored

**What goes wrong:** `r.style.setProperty('--font-display', ...)` sets an inline style on `:root`. This has higher specificity than the stylesheet `:root {}` declaration in dashboard.css. But if any element has an explicit `font-family` (not using the variable), the override has no effect on that element.

**Why it happens:** Canvas `ctx.font` is set as a string literal in charts.js — it bypasses CSS variables entirely. This is expected and is the locked decision (canvas text stays Space Grotesk).

**How to avoid:** Understand what uses `--font-display` (widget titles, big-number value, stat-card value, top-bar) vs what doesn't (canvas ctx.font strings). Verify the override is visible by inspecting `:root` computed styles.

**Warning signs:** Client font appears in widget titles but not in big-number values (or vice versa) — indicates a specific element has an explicit `font-family`.

### Pitfall 5: Leaderboard Font Increase Breaking Row Count

**What goes wrong:** The leaderboard is fixed at 340px width and `top: 12px; bottom: 12px`. Increasing `font-size` and `padding` in `.mgl-lb-table tbody td` increases row height, so fewer of the top-20 states fit before the list overflows.

**Why it happens:** The leaderboard scroll container (`mgl-lb-scroll`) is positioned within `mgl-lb-rows` which has `overflow: hidden`. The existing CSS has a soft-fade pseudo-element at the bottom to indicate overflow.

**How to avoid:** Increase font sizes conservatively (17px → 19px on table, not 24px). The scroll is intentional — it's animated via `transform`. The legibility improvement at 19px is significant; the reduced visible row count from ~12 to ~10 is acceptable for TV.

---

## Code Examples

Verified patterns from direct source inspection:

### `_applyClientBranding()` — current CSS variable set loop (app.js lines 172–183)
```javascript
const set = (v, k) => v && r.style.setProperty(k, v);
set(brand.bg,        '--bg');
set(brand.bgSurface, '--bg-surface');
// ... etc
```
Extension: add `set(brand.logoFont ? `'${brand.logoFont}', sans-serif` : null, '--font-display')` — but this requires careful handling of the `null` case (should remove, not set empty). Better to use the explicit block shown in Pattern 2.

### Gauge shadowBlur location (charts.js lines 144–153)
```javascript
ctx.save();
ctx.shadowColor = c;
ctx.shadowBlur = 18;        // <-- increase to 32 (normal) / 56 (crit)
ctx.beginPath();
ctx.arc(cx, cy, radius, startAngle, valAngle);
ctx.strokeStyle = c;
ctx.lineWidth = lineW * 0.5;  // glow layer (thinner)
ctx.lineCap = 'round';
ctx.stroke();
ctx.restore();
```

### Sparkline lineWidth (charts.js line 97)
```javascript
ctx.lineWidth = 3;   // <-- increase to 4
```

### Font size scaling for big-number in widgets.js (lines 110–112)
```javascript
if (len <= 5) valEl.style.fontSize = '62px';
else if (len <= 8) valEl.style.fontSize = '52px';
else valEl.style.fontSize = '42px';
```
These inline overrides take effect only for string-type values (status strings like "49/49"). For numeric values, the CSS class `.stat-card-value { font-size: 62px }` applies. The inline values should scale proportionally with any CSS base size change.

### Mapbox leaderboard table font size (mapbox-map.css line 183–188)
```css
.mgl-lb-table {
  font-size: 17px;     /* <-- increase to 19px */
  table-layout: fixed;
}
```

### Client branding YAML — iHeart reference (dashboards.yaml lines 693–707)
```yaml
clientBranding:
  logoText: iHEART
  logoSub: MEDIA
  bg: '#0d0005'
  # ... other fields ...
  logoImage: /img/rf2d7i-iheartmedia-vertical-logo-red.png
  # logoFont: <not yet set — add in this phase>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Canvas 2D USA map | Mapbox GL JS GPU map | Phase 3 | Map renders in WebGL; TV kiosk requires `--ignore-gpu-blocklist` Chromium flag |
| Hardcoded logo text | `logoImage` field with `<img>` insertion | iHeart rollout (prior) | Pattern proven; only 5 clients missing |
| No per-client font | `--font-display` CSS var override | This phase (new) | Requires dynamic `<link>` injection |

**Deprecated/outdated:**
- `clientLogo` in `mglConfig` (mapbox widget overlay): already implemented for map widget logo; the `clientBranding.logoImage` is the top-bar logo — these are separate mechanisms and both may coexist on client delivery dashboards.

---

## Open Questions

1. **iheart-metrics logo image missing**
   - What we know: `iheart-metrics` dashboard (line 708) has full `clientBranding` block but no `logoImage` field (only `iheart-delivery-map` has it at line 707)
   - What's unclear: Whether the locked decision "both client dashboards per client get the logo" means `iheart-metrics` should also get `logoImage: /img/rf2d7i-iheartmedia-vertical-logo-red.png` or the existing `iheart-logo.svg`
   - Recommendation: Add `logoImage: /img/iheart-logo.svg` to `iheart-metrics` — cleaner SVG than the PNG, consistent with SVG pattern for all other clients

2. **Scripps/Cox delivery map logos**
   - What we know: The `scripps-delivery-map` and `cox-delivery-map` entries do not have `mglConfig.clientLogo` set (unlike FOX, Hearst, Nexstar, iHeart which have it)
   - What's unclear: Whether the map overlay logo should be added for Scripps and Cox in this phase, or only the top-bar `clientBranding.logoImage`
   - Recommendation: The CONTEXT.md scope is `clientBranding.logoImage` (top bar). The `mglConfig.clientLogo` (map overlay) is a separate field. Align both for consistency but it is not strictly required by TVUX-02.

---

## Validation Architecture

> `nyquist_validation` is `true` in `.planning/config.json` — this section is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bun:test (built into Bun runtime) |
| Config file | none — test runner auto-discovers |
| Quick run command | `bun test tests/unit/widgets/ tests/unit/charts/` |
| Full suite command | `bun test tests/unit tests/integration tests/helpers tests/components` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TVUX-01 | Gauge shadowBlur increased (value parameter change) | unit | `bun test tests/unit/widgets/gauge.test.js` | ✅ |
| TVUX-01 | Sparkline lineWidth increased (draw param change) | unit | `bun test tests/unit/charts/chart-rendering.test.js` | ✅ |
| TVUX-01 | Widget threshold-crit/warn CSS class toggled | unit | `bun test tests/unit/widgets/gauge.test.js` | ✅ (extend) |
| TVUX-01 | Leaderboard font sizes increased | manual-only | Visual inspection at TV | — |
| TVUX-02 | `_applyClientBranding()` injects `<link>` when logoFont set | unit | `bun test tests/unit/widgets/` (new test file) | ❌ Wave 0 |
| TVUX-02 | `_applyClientBranding()` removes `<link>` when non-client | unit | same new test file | ❌ Wave 0 |
| TVUX-02 | `--font-display` CSS variable updated per client | unit | same new test file | ❌ Wave 0 |
| TVUX-02 | `logoImage` field renders `<img.brand-logo-img>` | unit | `bun test tests/unit/widgets/big-number.test.js` (extend) or new | ❌ Wave 0 |
| TVUX-02 | dashboards.yaml has logoImage for all 12 client entries | unit | `bun test tests/unit/gcp-dashboards.test.js` (extend) | ✅ (extend) |

**Manual-only justification:** TV viewing-distance readability (TVUX-01 map styling, leaderboard legibility) cannot be automated — requires a human at 3m from a 4K display. All structural changes (class toggles, CSS variable updates, DOM mutations) are automatable.

### Sampling Rate
- **Per task commit:** `bun test tests/unit/widgets/ tests/unit/charts/`
- **Per wave merge:** `bun test tests/unit tests/integration tests/helpers tests/components`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/widgets/client-branding.test.js` — covers TVUX-02 font link injection, CSS var override, and logo image rendering (new file)
- [ ] Extend `tests/unit/gcp-dashboards.test.js` — assert all 12 client dashboards have `logoImage` and `logoFont` fields in parsed YAML

*(Existing gauge, chart, and widget tests cover the canvas param changes without structural additions — extend them with assertions on the new `threshold-crit`/`threshold-warn` class toggling.)*

---

## Sources

### Primary (HIGH confidence)
- Direct source read: `public/js/app.js` lines 1–320 — `_applyClientBranding()`, `showPage()`, `startConfigRefresh()`
- Direct source read: `public/js/charts.js` lines 1–200 — `setup()`, `gauge()`, `sparkline()`, `thresholdColor()`, all draw params
- Direct source read: `public/js/widgets.js` lines 1–160 — `bigNumber()`, `gaugeWidget()`, `statCard()`, font scaling
- Direct source read: `public/js/mapbox-map.js` lines 150–520, 760–860, 1179–1340 — `_initMap()`, `_addLayers()`, `_buildLeaderboardDOM()`, `_renderLeaderboard()`
- Direct source read: `public/css/dashboard.css` lines 1–450 — full CSS variable palette, widget sizes, big-number/stat-card/gauge/bar styles
- Direct source read: `public/css/mapbox-map.css` lines 1–220 — leaderboard table sizes
- Direct source read: `config/dashboards.yaml` client branding blocks (iHeart confirmed, FOX/Hearst/Nexstar confirmed; Scripps/Cox checked)
- Direct source read: `tests/unit/widgets/gauge.test.js` — confirmed test framework pattern (bun:test + happy-dom)
- Direct source read: `.planning/config.json` — `nyquist_validation: true` confirmed

### Secondary (MEDIUM confidence)
- Google Fonts `display=swap` behavior: documented practice; TV network latency under 200ms makes swap gap imperceptible

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified by direct file inspection
- Architecture: HIGH — all extension points read from source; no inferences required
- Pitfalls: HIGH — identified from actual code patterns (inline style accumulation, canvas class topology, font override specificity)
- Validation: HIGH — test framework confirmed by reading existing test files

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable CSS/JS patterns; no external dependency version concerns)
