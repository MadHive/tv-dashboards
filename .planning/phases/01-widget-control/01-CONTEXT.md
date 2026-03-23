# Phase 1: Widget Control - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable full widget configuration from the properties panel — title, labels/subtitles, value format strings, axis labels, legend text, size/position numeric overrides, and visualization type switching — without requiring YAML editing. The properties panel skeleton already exists in `public/js/studio.js` and `public/studio.html`; this phase closes the gaps and improves the UX.

</domain>

<decisions>
## Implementation Decisions

### Widget Labels & Subtitles
- Add a **Subtitle / description** field below Title in the Basic section (second line of text displayed under the main title, e.g. "Last 24h", "GCP East")
- Add a **Value format string** field — controls how the metric value is rendered (e.g. `%.2f ms`, `${value}K`, `${value}%`)
- Add **Chart axis labels** (X/Y) as fields in type-specific sections (shown only when type is bar-chart, line-chart, etc.)
- Add **Custom legend text** fields in type-specific sections (gauge ticks, pipeline stage names, status grid cell labels where applicable)
- **Layout structure**: Claude decides the appropriate placement — subtitle/format in Basic section; axis labels and legend text in per-type collapsible sections (following the existing pattern of map-config-section, mgl-config-section)

### Widget Type Switching
- When type changes and the query may be incompatible: **attempt to auto-match** — look for a saved query with the same metric type but an appropriate data shape for the new widget type
- If no auto-match found: preserve the existing queryId and display a visual warning that the data shape may not match
- **Config preservation**: Claude decides what's sensible to preserve per transition — general rule: keep thresholds/unit/min-max across compatible types; clear type-specific config (e.g. map settings when leaving usa-map) when leaving that type
- Canvas re-renders immediately on type change (already implemented via `bind()` → `renderCanvas()`)

### Position Inputs vs Drag
- **Make col/row/colspan/rowspan inputs writable** (currently read-only despite having `bind()` handlers — the UI note "Drag to reposition" was the blocker)
- Both numeric inputs and drag are valid — numeric input takes effect on change, drag updates the inputs after drop
- **Collision handling**: snap to nearest open slot (not reject)
- Remove the "position inputs are read-only" MEMORY note — this is fixed in Phase 1

### Save Flow
- Manual Save button model is correct — keep it
- No auto-save, no navigate-away warning, no Discard button
- The save flow is fine; no changes needed beyond ensuring new label/type/position fields are included in the payload

### Properties Panel UX
- **Section organization**: better grouping with clear headers — the existing `<details class="props-section">` pattern is good; apply it consistently to new field groups
- Priority order of sections: Basic (title, subtitle, type) → Data (source, query) → Layout (col, row, spans) → Display (unit, format, min/max, warn/crit) → Type-specific (map config, GL config, axis labels, etc.)
- **Field visibility**: Claude decides per widget type what's relevant — show only applicable fields, hide irrelevant ones (e.g. gauge shows min/max/warn/crit; sparkline hides them; pipeline shows stage config if implemented)

### Unimplemented Widget Types
- **Keep all types in dropdown** but mark unimplemented/partial types with a `(beta)` suffix in the option label
- When a widget type has no working renderer or renders empty: Claude decides appropriate error UX (suggested: grey placeholder card with type name + a small error badge — consistent with existing error handling patterns)
- Do NOT remove types from the dropdown; users can discover/test experimental types

### Claude's Discretion
- Auto-save timing (decided: no auto-save)
- Exact label for the format string field (e.g. "Format" vs "Value format")
- Which specific widget types get which type-specific label fields in Phase 1 vs later
- Error UX for broken/empty widget renders
- Snap-to-nearest-slot algorithm for collision resolution

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Properties Panel
- `public/studio.html` lines 260–420 — existing widget props HTML (Basic, Data, Position, Display, Map Config, MGL Config sections)
- `public/js/studio.js` lines 700–900 — `showWidgetProps()` and `bind()` logic — existing property binding

### Widget Types
- `public/js/widgets.js` — all widget renderers; use to determine which fields each type supports
- `public/studio.html` lines 273–295 — existing type dropdown options

### Styling Patterns
- `public/css/studio.css` — existing studio styles; new fields should follow `.props-section`, `details > summary`, `.props-grid-2` patterns

### Project Context
- `.planning/PROJECT.md` — constraints: Vanilla JS, no framework, no TypeScript, no build step
- `.planning/REQUIREMENTS.md` — WDGT-01, WDGT-02, WDGT-03 success criteria

No external specs — requirements are fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `showWidgetProps(widgetId)` in `public/js/studio.js` — existing function that populates and binds all property inputs; new fields slot in here
- `bind(id, applyFn)` helper — wires input changes to `markDirty()` + `renderCanvas()`; use for all new fields
- `.props-section details` pattern in `public/studio.html` — existing collapsible sections with `<details>/<summary>`; use for new type-specific label sections
- `set(id, val)` helper in `showWidgetProps()` — populates input values on widget selection

### Established Patterns
- Property fields are plain HTML inputs/selects in `studio.html`; JS in `studio.js` binds them in `showWidgetProps()`
- Type-specific sections use `style="display:none"` toggled by the type change handler (`prop-type` bind)
- `markDirty()` + `renderCanvas()` is the change propagation pattern — no reactive framework
- API error responses: `{ success: true/false, error: string }` envelope

### Integration Points
- Position inputs must also update `studio-canvas.js` drag state on numeric change (drag already writes back col/row)
- Type change must update `data-summary` div (source + query display) and section visibility
- Widget config saved to `config/dashboards.yaml` via `PUT /api/dashboards/:id` when Save button clicked

</code_context>

<specifics>
## Specific Ideas

- Section priority order: Basic → Data → Layout → Display → Type-specific (mirroring mental model of "what is this?" → "what data?" → "where on screen?" → "how does it look?" → "type-specific tweaks")
- Subtitle renders as a smaller secondary label beneath the main title on the TV display (not just in the admin)
- Format string should support simple token replacement: `${value}` for the metric value, `${unit}` for the unit field

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within Phase 1 scope

</deferred>

---

*Phase: 01-widget-control*
*Context gathered: 2026-03-20*
