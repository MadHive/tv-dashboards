# Phase 1: Widget Control - Research

**Researched:** 2026-03-20
**Domain:** Vanilla JS studio editor — properties panel, widget config, canvas state sync
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Widget Labels & Subtitles**
- Add a Subtitle / description field below Title in the Basic section (second line of text displayed under the main title, e.g. "Last 24h", "GCP East")
- Add a Value format string field — controls how the metric value is rendered (e.g. `%.2f ms`, `${value}K`, `${value}%`)
- Add Chart axis labels (X/Y) as fields in type-specific sections (shown only when type is bar-chart, line-chart, etc.)
- Add Custom legend text fields in type-specific sections (gauge ticks, pipeline stage names, status grid cell labels where applicable)
- Layout structure: subtitle/format in Basic section; axis labels and legend text in per-type collapsible sections (following the existing pattern of map-config-section, mgl-config-section)

**Widget Type Switching**
- When type changes and the query may be incompatible: attempt to auto-match — look for a saved query with the same metric type but an appropriate data shape for the new widget type
- If no auto-match found: preserve the existing queryId and display a visual warning that the data shape may not match
- Config preservation: keep thresholds/unit/min-max across compatible types; clear type-specific config (map settings when leaving usa-map) when leaving that type
- Canvas re-renders immediately on type change (already implemented via `bind()` → `renderCanvas()`)

**Position Inputs vs Drag**
- Make col/row/colspan/rowspan inputs writable (currently have `bind()` handlers already; the CSS `input[readonly]` opacity and cursor rules are the only blocker)
- Both numeric inputs and drag are valid — numeric input takes effect on change, drag updates the inputs after drop
- Collision handling: snap to nearest open slot (not reject)
- Remove the "position inputs are read-only" MEMORY note — this is fixed in Phase 1

**Save Flow**
- Manual Save button model is correct — keep it
- No auto-save, no navigate-away warning, no Discard button
- Ensure new label/type/position fields are included in the save payload

**Properties Panel UX**
- Section priority order: Basic (title, subtitle, type) → Data (source, query) → Layout (col, row, spans) → Display (unit, format, min/max, warn/crit) → Labels (axis, legend) → Map Config → Map GL Config → Danger zone
- Field visibility: Claude decides per widget type what's relevant

**Unimplemented Widget Types**
- Keep all types in dropdown but mark unimplemented/partial types with a `(beta)` suffix
- Error UX for broken/empty widget renders: grey placeholder card with type name + small beta badge

### Claude's Discretion
- Auto-save timing (decided: no auto-save)
- Exact label for the format string field
- Which specific widget types get which type-specific label fields in Phase 1 vs later
- Error UX for broken/empty widget renders
- Snap-to-nearest-slot algorithm for collision resolution

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within Phase 1 scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WDGT-01 | User can edit a widget's title and display labels from the properties panel | `showWidgetProps()` already populates `prop-title`; subtitle/format/axis fields slot in using same `set()` + `bind()` pattern. TV display renders `wc.title` from `widget-title` div in both `app.js` and `studio-canvas.js` — subtitle needs a new `widget-subtitle` div injected in both render paths. |
| WDGT-02 | User can set numeric size (W×H) and position (X/Y) overrides for precise layout control | `prop-col`, `prop-row`, `prop-colspan`, `prop-rowspan` inputs have `bind()` handlers already wired in `bindWidgetPropListeners()`. The only blockers are: (1) the `readonly` attribute is NOT present in the HTML (inputs are already editable in DOM), (2) the `input[readonly]` CSS rule in studio.css applies dim styling; and (3) drag drop currently rejects collisions — must change to snap-to-nearest. |
| WDGT-03 | User can switch a widget's visualization type without recreating the widget | `prop-type` select already has a `bind()` handler that calls `renderCanvas()`. Gaps: section visibility toggle only handles display/map/mgl sections — Labels section visibility not yet toggled; auto-match query logic is absent; config preservation on type change is absent; `(beta)` suffix on unimplemented types not present. |
</phase_requirements>

---

## Summary

Phase 1 is a pure frontend enhancement to `public/js/studio.js`, `public/studio.html`, `public/css/studio.css`, and `public/js/app.js` (TV subtitle rendering). The backend is not touched — all new widget config fields (`subtitle`, `format`, `xLabel`, `yLabel`, `legendLabels`) are stored in the widget config object inside `modifiedConfig` and persisted automatically by the existing `PUT /api/dashboards/:id` route via the full dashboard body save.

The properties panel skeleton is largely complete. The work is: (1) adding HTML fields for subtitle, format, and labels, (2) wiring them through `showWidgetProps()` + `bindWidgetPropListeners()` using existing `set()`/`bind()` helpers, (3) rendering subtitle in the TV display and canvas preview, (4) removing the position-inputs-readonly constraint and implementing snap-to-nearest collision resolution, (5) adding auto-query-match on type switch + mismatch warning, and (6) labeling beta types and rendering a placeholder for broken renderers.

No external libraries, no build step, no new files needed. All changes extend existing patterns (Vanilla JS, plain HTML inputs, inline CSS class toggles).

**Primary recommendation:** Work in three sequential waves: (1) HTML/CSS additions (new fields + beta labels + placeholder styles), (2) `showWidgetProps` + `bind` wiring for all new fields including section visibility, (3) position writability + collision snap + type-switch auto-match logic.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES2022 (Bun runtime) | All frontend logic | Project mandate — no frameworks |
| Plain HTML/CSS | — | Properties panel markup | Extends existing studio.html patterns |

No npm packages are added. Phase 1 is entirely frontend editing of existing files.

### No-Install Note

The project uses `bun` as runtime. No `bun install` is required for Phase 1 — zero new dependencies.

---

## Architecture Patterns

### Recommended File Touch Points

```
public/
├── studio.html          — Add new <input> fields; add Labels <details> section; add mismatch warning div; update Position hint text; add (beta) suffixes to type options
├── js/studio.js         — Extend showWidgetProps(): add set() calls for new fields; extend bindWidgetPropListeners(): add bind() calls; add section visibility logic for Labels; add type-switch auto-match; add snap-to-nearest collision
├── js/studio-canvas.js  — Add widget-subtitle div rendering in canvas preview; update drop handler to snap instead of reject; update prop-col/row/colspan/rowspan inputs after snap
├── js/app.js            — Add widget-subtitle div rendering in TV display (parallel to canvas render)
└── css/studio.css       — Add .type-mismatch-warning style; add .widget-placeholder style; update/remove input[readonly] opacity rule for position inputs
```

### Pattern 1: Add a new property field (the universal pattern for WDGT-01)

**What:** All property inputs follow the same three-step lifecycle.

**Step 1 — HTML** (`studio.html`): Add `<label>` + `<input id="prop-X">` inside the relevant `<details class="props-section">` div.

**Step 2 — Populate** (`showWidgetProps()` in `studio.js`): Call `set('prop-X', wc.X || '')`.

**Step 3 — Bind** (`bindWidgetPropListeners()` in `studio.js`): Call `bind('prop-X', (v) => { wc.X = v; })`.

The `bind()` helper already calls `markDirty()` + `renderCanvas()` on every input event. No additional wiring needed.

**Example (existing, HIGH confidence — read from source):**
```javascript
// Source: public/js/studio.js lines 727-732
const set = (id, val) => {
  const el = document.getElementById(id);
  if (el) el.value = val;
};
set('prop-title', wc.title || '');

// Source: public/js/studio.js lines 811-820
function bind(id, applyFn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.oninput = el.onchange = function () {
    applyFn(el.value);
    self.markDirty();
    self.renderCanvas();
  };
}
bind('prop-title', (v) => { wc.title = v; });
```

### Pattern 2: Type-specific section visibility

**What:** Each config section is a `<details class="props-section" id="X-section">` element. Its `style.display` is toggled in two places: once on `showWidgetProps()` load, and again inside the `bind('prop-type', ...)` handler.

**Example (existing, HIGH confidence — read from source):**
```javascript
// Source: public/js/studio.js lines 752-764
const displaySection = document.getElementById('display-section');
if (displaySection) {
  const showDisplayTypes = ['gauge', 'gauge-row', 'progress-bar', 'big-number', 'stat-card', 'line-chart', 'bar-chart'];
  displaySection.style.display = showDisplayTypes.includes(wc.type) ? '' : 'none';
}
const mapSection = document.getElementById('map-config-section');
if (mapSection) {
  mapSection.style.display = wc.type === 'usa-map' ? '' : 'none';
}
```

The new `labels-section` follows this exact pattern. Add it to both the initial populate block and the `bind('prop-type', ...)` handler.

**Labels section show/hide list (from UI-SPEC):**
- Show for: `bar-chart`, `line-chart`, `stacked-bar-chart`, `donut-ring`, `sankey`, `heatmap`, `treemap`, `pipeline-flow`, `multi-metric-card`, `status-grid`, `table`
- Hide for all others

### Pattern 3: TV display widget subtitle rendering

**What:** Both `app.js` and `studio-canvas.js` build widget cards identically. The title `<div class="widget-title">` is already rendered. A subtitle `<div class="widget-subtitle">` must be appended immediately after if `wc.subtitle` is set.

**Existing title rendering (HIGH confidence — read from source):**
```javascript
// Source: public/js/app.js lines 100-103
const title = document.createElement('div');
title.className = 'widget-title';
title.textContent = wc.title;
card.appendChild(title);
```

**New subtitle rendering (same pattern, both files):**
```javascript
if (wc.subtitle) {
  const subtitle = document.createElement('div');
  subtitle.className = 'widget-subtitle';
  subtitle.textContent = wc.subtitle;
  card.appendChild(subtitle);
}
```

**CSS for `.widget-subtitle`** — place in `dashboard.css` (not `studio.css`) so it applies to both TV and studio canvas:
```css
.widget-subtitle {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 1px;
  color: var(--t3);
  margin-top: -10px;   /* pulls up under the title margin */
  margin-bottom: 10px;
  flex-shrink: 0;
}
```

### Pattern 4: Position input writability (WDGT-02)

**What:** The position inputs (`prop-col`, `prop-row`, `prop-colspan`, `prop-rowspan`) are NOT readonly in the HTML — the `readonly` attribute does not appear in `studio.html`. The `bind()` handlers in `bindWidgetPropListeners()` are already wired (lines 835-838 of `studio.js`). The dim styling comes from `studio.css` `.studio-properties input[readonly]` which is only triggered by the `readonly` attribute.

**Conclusion:** The position inputs are already effectively writable. The only changes needed are:
1. Update the hint text from "Drag to reposition..." to "Enter values or drag widget on canvas — both stay in sync"
2. Implement snap-to-nearest collision resolution in the bind handlers (currently the bind just sets the value without collision checking)
3. Make the drag drop handler also update colspan/rowspan inputs (currently it only updates col/row — lines 270-273 of `studio-canvas.js`)

**Verified from source (studio.js lines 835-838):**
```javascript
bind('prop-col',     (v) => { wc.position.col     = parseInt(v) || wc.position.col; });
bind('prop-row',     (v) => { wc.position.row     = parseInt(v) || wc.position.row; });
bind('prop-colspan', (v) => { wc.position.colSpan = Math.max(1, parseInt(v) || 1); });
bind('prop-rowspan', (v) => { wc.position.rowSpan = Math.max(1, parseInt(v) || 1); });
```

### Pattern 5: Snap-to-nearest collision resolution

**What:** When a numeric position input fires and the target slot is occupied, find the nearest open slot instead of silently clamping to the prior value.

**Snap direction priority (from UI-SPEC):** right → down → left → up. Search in expanding rings from the target position until a free slot is found or the grid boundary is reached.

**Existing collision check function (HIGH confidence — read from source):**
```javascript
// Source: public/js/studio-canvas.js lines 238-247
function _hasCollision(dash, col, row, colSpan, rowSpan, excludeId) {
  return dash.widgets.some(function (w) {
    if (w.id === excludeId) return false;
    var wcs = w.position.colSpan || 1;
    var wrs = w.position.rowSpan || 1;
    var colOk = col < w.position.col + wcs && col + colSpan > w.position.col;
    var rowOk = row < w.position.row + wrs && row + rowSpan > w.position.row;
    return colOk && rowOk;
  });
}
```

This function is defined inside `enableDropZone`'s closure scope but is accessible as a module-level candidate if extracted. The snap logic in `studio.js` bind handlers will need to replicate or reference this — since `studio.js` cannot call `studio-canvas.js` internal functions directly, the snap algorithm should be inlined in the bind handler (it is short: ~15 lines).

**Alternative:** Extract `_hasCollision` to the `StudioCanvas` public API returned object (`return { render, ... }`). The planner should decide whether to extract or inline.

### Pattern 6: Type-switch auto-match query

**What:** When `prop-type` changes, attempt to find a saved query compatible with the new type. Queries are available via `this.queries` (cached in `StudioApp`).

**Query structure (from API docs in MEMORY.md):**
- `GET /api/queries/` returns `{ success, queries: { gcp: [...], bigquery: [...] } }`
- Each query has: `id`, `name`, `metricType`, `source`

**Auto-match algorithm:**
1. Get current `wc.queryId` → find its query object → extract `metricType`
2. Search all queries for same `metricType` where the query name or metricType suggests compatibility with the new widget type
3. If found and different from current: silently reassign `wc.queryId`, update `data-summary`
4. If not found: keep existing `wc.queryId`, show `#type-mismatch-warning`

**Practical note:** The auto-match heuristic will be simple in Phase 1 (same metricType = probably compatible). A more sophisticated shape-compatibility check is deferred to future phases.

### Pattern 7: Unimplemented widget placeholder

**What:** When `Widgets.create()` throws or the renderer produces no output, the existing `studio-canvas.js` fallback is:
```javascript
// Source: public/js/studio-canvas.js lines 142-144
} catch (e) {
  content.textContent = wc.type;
}
```

Replace this catch block with a proper placeholder element using the `.widget-placeholder` CSS class (new class, follows existing `.canvas-placeholder` model).

### Anti-Patterns to Avoid

- **Setting `el.value` in a bind handler that also calls `set()`**: The `bind()` helper uses `oninput`/`onchange`. Do not call `set()` from inside a bind callback — it creates feedback loops in some browsers.
- **Calling `renderCanvas()` redundantly**: `bind()` already calls `renderCanvas()` after every change. Do not add additional `renderCanvas()` calls in the same handler.
- **Modifying `config` instead of `modifiedConfig`**: Studio always works on `this.modifiedConfig`. The server copy is `this.config`. Only Save commits to the server.
- **Forgetting both render paths**: `app.js` and `studio-canvas.js` build widget cards independently. Any structural change to card DOM (e.g., adding subtitle) must be applied in both files.
- **Using `style.display = 'none'` on `<details>` directly**: The existing pattern uses `style.display = ''` to show and `style.display = 'none'` to hide — not class toggles. Stay consistent.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dirty state tracking | Custom mutation observer | Existing `markDirty()` function | Already triggers `#dirty-indicator` amber text |
| Canvas re-render trigger | Custom event system | Existing `renderCanvas()` / `this.renderCanvas()` | Already destroys and rebuilds canvas from `modifiedConfig` |
| Toast notifications | Custom toast system | Existing `showToast(message, type)` in `StudioApp` | Already handles success (green) and error (red) variants |
| YAML persistence | Custom serialization | Existing `PUT /api/dashboards/:id` route | Accepts full widget config object; no schema changes needed |
| Collision detection | New algorithm | Existing `_hasCollision()` in `studio-canvas.js` | Proven, handles colSpan/rowSpan correctly |
| Section toggle pattern | Custom visibility system | Existing `element.style.display` toggle pattern | Used consistently across all existing sections |

**Key insight:** Phase 1 is almost entirely wiring work against an existing, well-structured codebase. Every pattern needed already exists — the job is to apply these patterns to new fields, not invent new mechanisms.

---

## Common Pitfalls

### Pitfall 1: The `bind()` function closes over `wc` — must rebind on widget re-select

**What goes wrong:** `bindWidgetPropListeners(wc)` is called fresh each time `showWidgetProps(widgetId)` is called. Previous listeners on the DOM elements are replaced by the `el.oninput = ...` assignment. This is correct — but if a developer uses `el.addEventListener` instead of `el.oninput =`, listeners accumulate across widget selections, causing the wrong widget's config to be mutated.

**How to avoid:** Always use the `bind()` helper (or equivalent `el.oninput = ...` assignment), never `addEventListener`, for property panel inputs.

### Pitfall 2: `renderCanvas()` fully rebuilds the DOM — widget instances are destroyed

**What goes wrong:** After each property change, `renderCanvas()` tears down and rebuilds the entire canvas DOM. Any DOM references captured before the render are stale after. Widget instances in `widgetInstances` are replaced. The live data preview panel (`#widget-data-preview`) is not part of the canvas rebuild — it persists correctly.

**How to avoid:** Do not cache canvas DOM element references across renders. Always use `document.getElementById()` for panel inputs (which are outside the canvas DOM).

### Pitfall 3: Position bind handlers don't trigger canvas re-render after snap adjustment

**What goes wrong:** The `bind()` helper calls `renderCanvas()` with the raw input value. If the snap algorithm adjusts the position (e.g., target col=3 snaps to col=4), the input field shows 3 but the canvas renders at 4. The inputs must be updated after snap resolution.

**How to avoid:** In the position bind handlers, after computing the snapped position: update `wc.position.col/row`, then call `set('prop-col', wc.position.col)` to sync the input back to the resolved value, then call `renderCanvas()`.

### Pitfall 4: Section visibility must be updated in two places

**What goes wrong:** The `prop-type` bind handler updates section visibility on change. The `showWidgetProps()` initial populate also sets section visibility. If only one is updated, the panel shows wrong sections after widget re-selection.

**How to avoid:** The Labels section visibility logic must appear in both places — extract it as a named function `updateSectionVisibility(type)` called from both `showWidgetProps()` and the `prop-type` bind handler.

### Pitfall 5: Subtitle and format fields are not rendered by `Widgets.create()` — they are card-level

**What goes wrong:** The subtitle is a card-level div (outside `widget-content`), not something widget renderers know about. If a developer tries to pass `wc.subtitle` into `Widgets.create()` and render it inside the widget, it will conflict with widget-type-specific layouts.

**How to avoid:** Subtitle is rendered by the card-building code in `app.js` and `studio-canvas.js`, not by widget renderers. Format string (`wc.format`) is used by value-formatting logic internal to widget renderers — it must be consumed by `fmtNum()` or an equivalent formatter inside `widgets.js` if the format feature is to affect the TV display.

**Format string scope clarification:** If `wc.format` is to affect the rendered value on TV, the widget renderers (`bigNumber`, `statCard`, etc.) must read `config.format` and apply it. This is a non-trivial change to widget renderers. The planner should decide whether Phase 1 implements format rendering in widget renderers or only stores the field for future use.

### Pitfall 6: Drop handler rejects collisions — must change to snap

**What goes wrong:** The current `enableDropZone` drop handler in `studio-canvas.js` line 289 rejects blocked drops with an early `return`. The CONTEXT decision is to snap to nearest open slot instead. Changing this requires replacing the `return` with a snap resolution call.

**How to avoid:** Replace `if (_hasCollision(...)) return;` with a snap-to-nearest loop that finds the closest free position before committing the drop.

---

## Code Examples

Verified patterns from source code:

### Data-shape mismatch warning — HTML structure (from UI-SPEC)

```html
<!-- Insert directly after #data-summary div in studio.html -->
<div id="type-mismatch-warning" class="type-mismatch-warning" style="display:none">
  <span class="warning-icon">&#9888;</span>
  <span class="warning-text">Data shape may not match this widget type. Verify or reassign the query.</span>
</div>
```

### Data-shape mismatch warning — CSS (from UI-SPEC)

```css
.type-mismatch-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(251,191,36,0.08);
  border: 1px solid rgba(251,191,36,0.3);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--amber);
  font-family: var(--font-display);
  letter-spacing: 0.5px;
}
```

### Snap-to-nearest algorithm outline

```javascript
// Called from prop-col and prop-row bind handlers after computing desired col/row
function snapToNearestOpen(dash, desiredCol, desiredRow, colSpan, rowSpan, excludeId) {
  // Check desired position first
  if (!_hasCollision(dash, desiredCol, desiredRow, colSpan, rowSpan, excludeId)) {
    return { col: desiredCol, row: desiredRow };
  }
  // Search in direction order: right, down, left, up, expanding radius
  const maxR = Math.max(dash.grid.columns, dash.grid.rows);
  for (let d = 1; d <= maxR; d++) {
    const candidates = [
      { col: desiredCol + d, row: desiredRow },         // right
      { col: desiredCol,     row: desiredRow + d },     // down
      { col: desiredCol - d, row: desiredRow },         // left
      { col: desiredCol,     row: desiredRow - d },     // up
    ];
    for (const { col, row } of candidates) {
      const c = Math.max(1, Math.min(dash.grid.columns - colSpan + 1, col));
      const r = Math.max(1, Math.min(dash.grid.rows    - rowSpan + 1, row));
      if (!_hasCollision(dash, c, r, colSpan, rowSpan, excludeId)) {
        return { col: c, row: r };
      }
    }
  }
  // No open slot found — return original position unchanged
  return { col: desiredCol, row: desiredRow };
}
```

### Beta type option labels — HTML change in studio.html

```html
<!-- Before: -->
<option value="sankey">Sankey</option>
<!-- After: -->
<option value="sankey">Sankey (beta)</option>
```

Types requiring `(beta)` suffix: `sankey`, `heatmap`, `treemap`, `table`, `multi-metric-card`, `stacked-bar-chart`

### Widget placeholder for broken renderers — studio-canvas.js

```javascript
// Replace existing catch block (line 142-144):
} catch (e) {
  content.textContent = wc.type;
}

// With:
} catch (e) {
  const ph = document.createElement('div');
  ph.className = 'widget-placeholder';
  const typeName = document.createElement('div');
  typeName.className = 'widget-placeholder-type';
  typeName.textContent = wc.type;
  const badge = document.createElement('span');
  badge.className = 'widget-placeholder-badge';
  badge.textContent = 'beta';
  ph.appendChild(typeName);
  ph.appendChild(badge);
  content.appendChild(ph);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Position inputs read-only (drag-only) | Position inputs writable + drag both valid | Phase 1 | Precise grid positioning without drag |
| No subtitle field per widget | subtitle field + TV rendering | Phase 1 | Secondary context line under title |
| No format string | format field stored in widget config | Phase 1 | Value display customization (rendering TBD) |
| Collision → reject drop | Collision → snap to nearest open slot | Phase 1 | Better drag UX, never loses widget |
| All types unlabeled | Beta types marked `(beta)` in dropdown | Phase 1 | User expectation management |

---

## Open Questions

1. **Does `wc.format` affect TV rendering in Phase 1?**
   - What we know: `wc.format` is a new field added to widget config. Widget renderers use `fmtNum()` internally.
   - What's unclear: Whether Phase 1 threads `wc.format` into `fmtNum()` inside `widgets.js`, or only stores it for a future phase.
   - Recommendation: Store the field now; wire rendering only for `big-number` and `stat-card` in Phase 1 as a contained change. Other types in later phases.

2. **Should `_hasCollision` be extracted to StudioCanvas public API?**
   - What we know: It is currently inside `enableDropZone` closure. The snap-to-nearest algorithm in `studio.js` bind handlers needs it.
   - What's unclear: Whether inlining it in `studio.js` is cleaner than exposing it from `StudioCanvas`.
   - Recommendation: Extract it to `StudioCanvas` return object (e.g., `StudioCanvas.hasCollision(dash, ...)`) — avoids code duplication across two files.

3. **What is the `updateSectionVisibility` extraction boundary?**
   - What we know: Section visibility logic currently lives inline in `showWidgetProps()` and duplicated in the `prop-type` bind handler.
   - What's unclear: Whether to extract as a named function or leave inline (risk: drift between the two copies).
   - Recommendation: Extract as `updateSectionVisibility(type)` called from both sites.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun test (built-in) |
| Config file | none — bun discovers `*.test.js` files automatically |
| Quick run command | `bun test --timeout 5000` |
| Full suite command | `bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WDGT-01 | subtitle + format fields stored in widget config and persisted in YAML | unit | `bun test tests/widget-config.test.js -t "subtitle"` | ❌ Wave 0 |
| WDGT-01 | TV display renders widget-subtitle div when wc.subtitle is set | manual | Open TV display, verify subtitle shows below title | manual-only (DOM rendering) |
| WDGT-02 | Numeric position input updates widget position in modifiedConfig | unit | `bun test tests/widget-config.test.js -t "position"` | ❌ Wave 0 |
| WDGT-02 | Snap-to-nearest collision resolution returns valid slot | unit | `bun test tests/widget-config.test.js -t "snap"` | ❌ Wave 0 |
| WDGT-03 | Type switch updates wc.type and triggers section visibility | manual | Studio: change type, verify Labels section shows/hides | manual-only (DOM) |
| WDGT-03 | Type switch auto-match attempts query reassignment | unit | `bun test tests/widget-config.test.js -t "auto-match"` | ❌ Wave 0 |
| WDGT-03 | Type switch preserves thresholds across compatible types | unit | `bun test tests/widget-config.test.js -t "config preservation"` | ❌ Wave 0 |

**Manual-only justification:** DOM rendering tests for the TV display and studio canvas require a browser environment. The project has no browser test harness (no Playwright/Puppeteer). These are verified via the existing `/admin` and `/` pages.

### Sampling Rate

- **Per task commit:** `bun test tests/widget-config.test.js` (unit tests for new logic only)
- **Per wave merge:** `bun test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/widget-config.test.js` — covers WDGT-01 (subtitle/format field storage), WDGT-02 (position snap logic), WDGT-03 (type-switch auto-match + config preservation)
- [ ] `tests/helpers/widget-config-helpers.js` — shared test fixtures: mock dash config, mock widget configs for each type, mock queries object

*(No test framework install needed — `bun test` is built-in)*

---

## Sources

### Primary (HIGH confidence)

- `public/js/studio.js` lines 700-1032 — `showWidgetProps()` and `bindWidgetPropListeners()` — read directly from source
- `public/studio.html` lines 260-490 — existing properties panel HTML — read directly from source
- `public/js/studio-canvas.js` lines 1-300 — drag/drop, collision detection, canvas render — read directly from source
- `public/js/widgets.js` lines 1-720 — widget factory and all renderers — read directly from source
- `public/js/app.js` lines 90-120 — TV display widget card building — read directly from source
- `public/css/studio.css` — all studio panel styles — read directly from source
- `.planning/phases/01-widget-control/01-CONTEXT.md` — all locked decisions
- `.planning/phases/01-widget-control/01-UI-SPEC.md` — visual contract, copywriting, interaction contracts

### Secondary (MEDIUM confidence)

- `.planning/codebase/ARCHITECTURE.md` — layer descriptions and data flow
- `.planning/codebase/CONVENTIONS.md` — naming, style, module patterns

### Tertiary (LOW confidence)

None — all findings are from direct source inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns read directly from source
- Architecture: HIGH — all integration points identified from code; no assumptions
- Pitfalls: HIGH — all pitfalls derived from actual code behavior (e.g., bind() override pattern, renderCanvas() rebuild, dual render path in app.js vs studio-canvas.js)

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (stable codebase — 90-day validity)
