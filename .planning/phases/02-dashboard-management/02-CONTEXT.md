# Phase 2: Dashboard Management - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable admin users to create new dashboards via a multi-step modal wizard, duplicate existing dashboards with a UI button, and multi-select widgets to copy/paste them across dashboards. All without YAML editing.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Creation Wizard (DASH-01)
- Upgrade the existing inline `new-dashboard-form` into a **full modal wizard** (multi-step, consistent with the existing `widget-palette-modal` pattern)
- **Step 1**: Name + icon + grid layout (preserve all existing fields: name, subtitle, cols, rows, icon picker)
- **Step 2**: Initial widget type selection — pick widget types from a palette to pre-populate the new dashboard
- New dashboards start with a blank canvas if user skips the widget step
- After creation: auto-select the new dashboard on the canvas (existing behavior to preserve)
- Save the new-dashboard-form HTML and replace with a modal trigger button (`+`)

### Dashboard Duplication (DASH-02)
- API `POST /api/dashboards/:id/duplicate` already exists and is implemented — UI only
- **Claude decides placement**: hover-reveal duplicate button on dashboard list items (consistent with existing delete button pattern — appears next to the X)
- **After duplication**: auto-select the copy AND show the dashboard name field focused/editable so the user can rename immediately
- Duplicated dashboard name: `Copy of [original name]`
- Triggers `loadConfig()` + `renderSidebar()` after successful API call (same pattern as delete/create)

### Multi-select Mechanism (DASH-03)
- **Shift+click**: click first widget → shift+click adds/removes widgets from selection
- **Rubber-band drag**: click-drag on empty canvas area draws a selection rectangle; widgets inside are selected on mouseup
- Both mechanisms work simultaneously — shift+click for additive, rubber-band for area
- Selected widgets: show a distinct selection outline (different from single-select pink — e.g. dashed or multi-select blue)
- **Properties panel with multi-selection**: show only shared editable fields (source, type) — editing applies to all selected. Show "N widgets selected" header. Single-select restores normal properties panel.
- **Ctrl+C**: copies selected widgets to an in-memory clipboard (array of widget config deep-copies)
- **Ctrl+V**: pastes clipboard into the current active dashboard

### Cross-Dashboard Paste
- **Clipboard persists across dashboard switches** — user navigates to target dashboard in the sidebar, then Ctrl+V (Claude's choice: simpler, no extra modal, consistent with OS clipboard model)
- **Paste position**: attempt original positions first → if collision, apply Phase 1 `StudioCanvas.snapToNearest()` for each widget
- Widget IDs are regenerated on paste (avoid duplicate IDs across dashboards)
- After paste: mark dirty, re-render canvas, select pasted widgets
- Clipboard is cleared after paste (one-shot paste, not sticky)

### Save Flow (carried from Phase 1)
- Manual Save button model — no change
- All new dashboard management operations (create, duplicate, paste) stage changes in-memory and require Save to persist

### Claude's Discretion
- Exact rubber-band selection rectangle visual styling (dashed border, semi-transparent fill)
- Multi-select outline color/style (distinct from single-select pink)
- Whether to show a "Clipboard: N widgets" indicator in the UI when clipboard is populated
- Exact step 2 layout in the creation wizard (grid of type buttons vs list)
- Duplicate button icon (e.g. ⧉ or 📋 or custom)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Dashboard Creation
- `public/studio.html` lines 50–75 — existing `new-dashboard-form` HTML (to be replaced by modal trigger)
- `public/js/studio.js` lines 1228–1320 — existing new-dashboard form JS handler (to be upgraded to modal)
- `public/js/studio.js` lines 144–230 — `renderSidebar()` — where duplicate button must be added

### Existing Modal Pattern
- `public/studio.html` lines 647+ — `widget-palette-modal` — reference for how to build the creation wizard modal
- `public/js/studio.js` lines 1556–1700 — widget palette modal JS (open/close/keyboard patterns to follow)

### API Routes
- `server/index.js` line 534 — `POST /api/dashboards/:id/duplicate` — ready, no server changes needed
- `server/index.js` line ~464 — `POST /api/dashboards` — creation endpoint (already works)

### Canvas/Selection Patterns (Phase 1 foundation)
- `public/js/studio-canvas.js` — drag, click handling, `StudioCanvas.snapToNearest()` public API (for paste positioning)
- `public/js/studio.js` — `showWidgetProps()`, `selectedWidgetId` — single-select state (extend to multi-select array)

### Project Constraints
- `.planning/PROJECT.md` — Vanilla JS, no frameworks, no TypeScript, no build step
- `.planning/REQUIREMENTS.md` — DASH-01, DASH-02, DASH-03 success criteria

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `widget-palette-modal` pattern — existing full-screen modal with close-on-backdrop and Escape key; use as template for creation wizard modal
- `StudioCanvas.snapToNearest(dash, col, row, colSpan, rowSpan, excludeId)` — Phase 1 public API; use for paste collision resolution
- `this.markDirty()` + `this.renderCanvas()` — change propagation pattern for all new operations
- `this.loadConfig()` + `this.renderSidebar()` — post-API-call refresh pattern (used by create, delete, reorder)
- `this.showToast(msg, type)` — feedback toasts for success/error states

### Established Patterns
- Dashboard list items built in `renderSidebar()` via `document.createElement` — add duplicate button here
- Single-select state: `this.selectedWidgetId` (string) — extend to `this.selectedWidgetIds` (Set) for multi-select
- All studio modals: `style.display = 'flex'` to show, `'none'` to hide; backdrop click closes
- Widget IDs: generated as `name.toLowerCase().replace(/[^a-z0-9]+/g, '-')` — regenerate on paste with suffix

### Integration Points
- Multi-select rubber-band: listen on canvas `mousedown`/`mousemove`/`mouseup` in `studio-canvas.js`; communicate selection back to `studio.js` via callback or `StudioCanvas` public method
- Clipboard: `this._widgetClipboard = []` on `StudioApp` — persists as instance state across dashboard switches
- Ctrl+C/V: global `keydown` handler in `studio.js` (existing `Escape` handler shows the pattern)

</code_context>

<specifics>
## Specific Ideas

- The creation wizard Step 2 widget palette should reuse the existing widget type list from `studio.html`'s `prop-type` select options — consistent type names, no duplication
- The rubber-band selection rectangle should NOT interfere with widget drag — start rubber-band only on mousedown on empty canvas space (no widget at target)
- Shift+click on a selected widget should deselect it (toggle behavior)
- The "N widgets selected" header in the properties panel should show a Ctrl+C hint: "N widgets selected — Ctrl+C to copy"

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within Phase 2 scope

</deferred>

---

*Phase: 02-dashboard-management*
*Context gathered: 2026-03-20*
