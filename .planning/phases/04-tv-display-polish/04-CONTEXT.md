# Phase 4: TV Display Polish - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

TV dashboards look sharp and client-branded — charts, gauges, sparklines, and maps render with improved clarity at TV viewing distance; each client's logo image, color scheme, and font are applied to their dashboard frame. No new data sources, admin features, or dashboard creation — this is purely a visual quality and branding pass on the TV display at `/`.

</domain>

<decisions>
## Implementation Decisions

### Client Logo Rollout
- Logo image **replaces** the logoText/logoSub text when `logoImage` is set — text is the fallback when no image exists
- Connect all 6 clients: iHeart already done; FOX, Hearst, Nexstar, Scripps, Cox get their SVGs wired in dashboards.yaml (`logoImage` field)
- SVG files already exist in `/img/`: `fox-logo.svg`, `hearst-logo.svg`, `nexstar-logo.svg`, `scripps-logo.svg`, `cox-logo.svg`
- Both client dashboards per client (e.g. `iheart-delivery` and `iheart-metrics`) get the logo — applies to all 12 client dashboard entries
- Logo sizing: Claude decides the max-height and width constraints to fit the existing `.top-left` frame layout cleanly

### Per-Client Font Branding
- Each client gets a distinct Google Font for their display typeface — stored as `logoFont` in the `clientBranding` object in dashboards.yaml
- Font applies to: dashboard name, logo area text, and widget titles. Canvas chart labels (gauge numbers, sparkline axis) stay in Space Grotesk — no canvas re-render required
- Font loaded dynamically via a `<link>` injected into `<head>` when `_applyClientBranding()` runs; removed when switching to a MadHive internal dashboard
- CSS variable `--font-display` is overridden per client to apply the loaded font
- Claude picks appropriate fonts per client based on brand aesthetic (stored in dashboards.yaml for review/edit)
- MadHive internal ops dashboards (non-client) retain Space Grotesk + DM Sans + IBM Plex Mono unchanged

### Widget Visual Sharpness — TV Distance Readability
- Target: widgets legible from 3+ meters without squinting — focus on readability over crispness
- Specific improvements (Claude decides exact values):
  - Increase font sizes for big-number values, gauge center text, and widget subtitle labels
  - Bump line weights for sparklines and bar charts — thicker strokes read better at distance
  - Improve contrast ratios on secondary text (current `--t3` labels may be too dim)
  - Larger tick labels on pipeline stage counts
- Threshold/alert states should be unmissable: stronger glow on gauges in warn/crit state; pulsing animation for critical values (CSS keyframe animation, not canvas-based)
- DPR scaling is already implemented — this pass does not change the canvas setup logic, only the visual parameters (lineWidth, fontSize, shadow)

### Mapbox Map Styling
- Keep the `dark-v11` Mapbox base style — focus effort on the delivery data overlay, not the base map
- Delivery marker treatment: Claude decides the approach that reads best at TV distance on dark-v11 (current glowing dot approach may be enhanced, or a mixed dot+heatmap used)
- Leaderboard panel (top markets list) gets the same TV-distance readability pass: larger font, better spacing, cleaner accent styling
- No custom Mapbox Studio style required for this phase

### Claude's Discretion
- Logo sizing constraints (max-height/width values)
- Exact font choices per client (stored in dashboards.yaml — user can edit)
- Specific lineWidth/fontSize increments for canvas widget improvements
- Delivery marker visual treatment (dots vs heat vs hybrid)
- Pulsing animation timing for critical threshold states

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Relevant code to read before planning
- `public/js/app.js` — `_applyClientBranding()` at line 166; dashboard switch logic at line 156
- `public/js/charts.js` — gauge rendering (~line 115), sparkline rendering (~line 60), DPR setup (~line 29)
- `public/js/widgets.js` — widget type dispatch at line 756; big-number font scaling at line 110
- `public/js/mapbox-map.js` — map style config at line 175; leaderboard panel at line 578
- `public/css/dashboard.css` — MadHive brand palette CSS variables (lines 9–55); font imports (line 6)
- `config/dashboards.yaml` — all 12 client dashboard entries with existing `clientBranding` blocks

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_applyClientBranding(brand)` in `app.js`: already handles CSS variable injection, logoText/logoSub swap, and logoImage `<img>` insertion — extend it to also handle `logoFont` by injecting a `<link>` tag
- `clientBranding` YAML blocks: already present and populated for all 6 clients with full color palettes — only `logoImage` (5 clients) and `logoFont` (all 6 clients) fields are missing
- `public/img/`: all 6 client SVG/PNG logos already exist — just need wiring
- DPR-aware canvas `setup()` in charts.js: already scales correctly — visual improvements only need to change draw parameters (lineWidth, font strings, shadow values)

### Established Patterns
- CSS variable overrides: `_applyClientBranding()` uses `document.documentElement.style.setProperty()` — same pattern for `--font-display` override
- Logo image handling: already implemented for iHeart — duplicating the `logoImage` field pattern for other clients is the entire rollout task
- Canvas font strings: currently hardcoded as `'Space Grotesk', sans-serif` in charts.js — for frame-header-only fonts, no chart changes needed
- Threshold coloring: `thresholdColor()` in charts.js returns the color; gauge uses `ctx.shadowColor` + `ctx.shadowBlur` — increasing these values is the "pop" improvement

### Integration Points
- `_applyClientBranding()` called at dashboard switch (line 157) and on data refresh if branding changed (line 289) — font injection here covers all cases
- `--font-display` CSS variable already used by `.dashboard-title`, widget title elements — overriding it cascades correctly
- Leaderboard styled via inline styles in `mapbox-map.js` — readability pass touches font sizes and spacing there

</code_context>

<specifics>
## Specific Ideas

- No specific design references given — Claude has latitude on font choices and marker treatment
- Key constraint: client font must load without FOUT (flash of unstyled text) — preload or font-display:swap approach needed
- Pulsing animation for critical states should be subtle enough not to distract operators watching other widgets

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-tv-display-polish*
*Context gathered: 2026-03-20*
