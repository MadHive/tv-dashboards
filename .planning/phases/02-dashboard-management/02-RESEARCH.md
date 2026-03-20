# Phase 2: Dashboard Management - Research

**Researched:** 2026-03-20
**Domain:** Vanilla JS studio editor — modal wizard, duplicate button, multi-select canvas interaction
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dashboard Creation Wizard (DASH-01)**
- Upgrade the existing inline `new-dashboard-form` into a full modal wizard (multi-step, consistent with the existing `widget-palette-modal` pattern)
- Step 1: Name + icon + grid layout (preserve all existing fields: name, subtitle, cols, rows, icon picker)
- Step 2: Initial widget type selection — pick widget types from a palette to pre-populate the new dashboard
- New dashboards start with a blank canvas if user skips the widget step
- After creation: auto-select the new dashboard on the canvas (existing behavior to preserve)
- Save the new-dashboard-form HTML and replace with a modal trigger button (`+`)

**Dashboard Duplication (DASH-02)**
- API `POST /api/dashboards/:id/duplicate` already exists and is implemented — UI only
- Placement: hover-reveal duplicate button on dashboard list items (consistent with existing delete button pattern — appears next to the X)
- After duplication: auto-select the copy AND show the dashboard name field focused/editable so the user can rename immediately
- Duplicated dashboard name: `Copy of [original name]` (UI display; server returns `[name] (Copy)`)
- Triggers `loadConfig()` + `renderSidebar()` after successful API call (same pattern as delete/create)

**Multi-select Mechanism (DASH-03)**
- Shift+click: click first widget → shift+click adds/removes widgets from selection
- Rubber-band drag: click-drag on empty canvas area draws a selection rectangle; widgets inside are selected on mouseup
- Both mechanisms work simultaneously
- Selected widgets: blue dashed outline (`outline: 2px dashed #60A5FA`) distinct from single-select pink
- Properties panel with multi-selection: show only shared editable fields (source, type). Show "N WIDGETS SELECTED" header. Single-select restores normal panel.
- Ctrl+C: copies selected widgets to in-memory clipboard (deep-copies)
- Ctrl+V: pastes clipboard into the current active dashboard

**Cross-Dashboard Paste**
- Clipboard persists across dashboard switches
- Paste position: attempt original positions first → if collision, apply `StudioCanvas.snapToNearest()` for each widget
- Widget IDs are regenerated on paste
- After paste: mark dirty, re-render canvas, select pasted widgets
- Clipboard is cleared after paste (one-shot)

**Save Flow (carried from Phase 1)**
- Manual Save button model — no change
- All new dashboard management operations (create, duplicate, paste) stage changes in-memory and require Save to persist

### Claude's Discretion
- Exact rubber-band selection rectangle visual styling (dashed border, semi-transparent fill) — specified in UI-SPEC: `1px dashed #60A5FA`, `rgba(96,165,250,0.08)` fill
- Multi-select outline color/style — specified in UI-SPEC: `outline: 2px dashed #60A5FA` + `box-shadow: 0 0 0 2px rgba(96,165,250,0.10)`
- Whether to show a "Clipboard: N widgets" indicator in the UI — YES per UI-SPEC: in `.studio-canvas-footer`, 11px IBM Plex Mono
- Exact step 2 layout in the creation wizard — 3-column grid per UI-SPEC
- Duplicate button icon — `⧉` (U+29C9) per UI-SPEC

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within Phase 2 scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | User can create a new dashboard via a step-by-step wizard (name, layout, initial widgets) | Existing `widget-palette-modal` pattern, `new-dashboard-form` handler, and `POST /api/dashboards` route are all verified and ready |
| DASH-02 | User can duplicate an existing dashboard as a starting point for a new one | `POST /api/dashboards/:id/duplicate` is server-complete; UI is zero-cost addition to `renderSidebar()` |
| DASH-03 | User can multi-select widgets and copy/paste them across dashboards | `StudioCanvas.snapToNearest()` public API is confirmed; canvas click handler and `selectedWidgetId` single-select state are the extension points |
</phase_requirements>

---

## Summary

Phase 2 is a pure frontend feature phase — the server is already complete for all three requirements. `POST /api/dashboards/:id/duplicate` is live (line 534 of `server/index.js`), and `POST /api/dashboards` (line 462) handles creation. No server changes are needed. All work lands in three files: `public/studio.html`, `public/js/studio.js`, and `public/js/studio-canvas.js`, plus targeted additions to `public/css/studio.css`.

The codebase has strong, reusable patterns. The `widget-palette-modal` at HTML line 647 is a direct template for the creation wizard modal. The `renderSidebar()` method (studio.js line 144) already builds delete buttons with hover-reveal — adding a duplicate button is a parallel DOM addition. The `StudioCanvas` module (studio-canvas.js) exposes `render`, `hasCollision`, and `snapToNearest` as its public API (line 455), which is exactly what paste collision resolution needs.

The main risk area is the rubber-band selection interaction: `studio-canvas.js` currently owns all `mousedown`/`mousemove`/`mouseup` handlers for widget drag, and rubber-band must be surgically inserted to activate only when the mousedown target is empty canvas space. The existing drag-and-drop mechanism uses HTML5 `draggable`/`dragstart`/`dragend`, so mouse events on empty space are already handled by the canvas `click` handler (line 196) — rubber-band can piggyback without conflict.

**Primary recommendation:** Implement in three waves: (1) wizard modal + duplicate button, (2) multi-select shift+click + properties panel changes, (3) rubber-band + clipboard/paste. Each wave is independently verifiable.

---

## Standard Stack

### Core (no new dependencies — all existing)

| Library / API | Version | Purpose | Notes |
|---------------|---------|---------|-------|
| Vanilla JS DOM | browser native | All UI construction | `document.createElement`, `style.display`, event listeners |
| CSS custom properties | existing in `dashboard.css` | All color/spacing tokens | `--bg`, `--bg-surface`, `--bg-card`, `--mh-pink`, `--blue`, `--border`, `--border-lit` |
| HTML5 Drag and Drop API | browser native | Existing widget drag (do not change) | `draggable`, `dragstart`, `dragend`, `dragover`, `drop` |
| `bun:test` | Bun built-in | Server-side unit tests | Already used in `tests/dashboard-manager.test.js` |

No `npm install` needed. This phase adds zero new dependencies.

### Reusable Internal APIs

| API | Location | Signature | Purpose |
|-----|----------|-----------|---------|
| `StudioCanvas.snapToNearest` | studio-canvas.js line 267 | `(dash, desiredCol, desiredRow, colSpan, rowSpan, excludeId) → { col, row }` | Collision-free slot for paste |
| `StudioCanvas.hasCollision` | studio-canvas.js line 256 | `(dash, col, row, colSpan, rowSpan, excludeId) → boolean` | Collision check |
| `this.markDirty()` | studio.js line 74 | `() → void` | Sets dirty indicator + enables Save |
| `this.renderCanvas()` | studio.js (existing) | `() → void` | Calls `StudioCanvas.render(this)` |
| `this.renderSidebar()` | studio.js line 144 | `() → void` | Rebuilds dashboard nav list |
| `this.loadConfig()` | studio.js line 47 | `async () → void` | Fetches `/api/config`, resets `modifiedConfig` |
| `this.selectDashboard(idx)` | studio.js (existing) | `(idx: number) → void` | Sets `activeDashIdx`, renders canvas + props |
| `this.showToast(msg, type)` | studio.js (existing) | `(msg: string, type: 'success'|'error') → void` | User feedback |
| `this.showWidgetProps(id)` | studio.js line 719 | `(widgetId: string) → void` | Opens widget properties panel for one widget |

---

## Architecture Patterns

### Pattern 1: Modal Creation/Closure

The `widget-palette-modal` (studio.html line 647, studio.js lines 1556–1698) defines the canonical modal pattern:

```javascript
// Open
document.getElementById('my-modal').style.display = 'flex';

// Close
document.getElementById('my-modal').style.display = 'none';

// Escape key (already bound globally in bindWidgetPaletteModal)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.style.display !== 'none') {
    modal.style.display = 'none';
  }
});

// Backdrop click
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.style.display = 'none';
});
```

The creation wizard modal (id: `dashboard-wizard-modal`) follows this pattern exactly. It is a TWO-STEP modal with a step indicator strip inside `.studio-modal-body`.

### Pattern 2: Dashboard List Item DOM Construction

`renderSidebar()` builds each nav item via `document.createElement`. The duplicate button inserts between `count` and `toggle` in the existing append order (currently: handle → thumb → name → count → toggle → delBtn):

```javascript
// Current order (studio.js lines 194–199):
item.appendChild(handle);
item.appendChild(thumb);
item.appendChild(name);
item.appendChild(count);
item.appendChild(toggle);
item.appendChild(delBtn);

// Phase 2 — insert dupBtn between count and toggle:
item.appendChild(handle);
item.appendChild(thumb);
item.appendChild(name);
item.appendChild(count);
item.appendChild(dupBtn);   // NEW
item.appendChild(toggle);
item.appendChild(delBtn);
```

The click guard on the item click handler (line 202: `if (e.target === delBtn || e.target === handle) return`) must be extended to also guard `dupBtn`.

### Pattern 3: Single-Select → Multi-Select State Extension

Current state (studio.js constructor, line 14):
```javascript
this.selectedWidgetId = null;  // string | null
```

Phase 2 extension:
```javascript
this.selectedWidgetId = null;       // string | null — keep for backward compat
this.selectedWidgetIds = new Set(); // Set<string> — multi-select
this._widgetClipboard = [];         // Array<widget config deep-copies>
```

The canvas render in `studio-canvas.js` (line 101) sets `outline` based on `app.selectedWidgetId`. Phase 2 must update this to check `app.selectedWidgetIds` for blue dashed outline when `selectedWidgetIds.size >= 2`, and fall back to the existing pink solid outline when `selectedWidgetIds.size === 1`.

```javascript
// studio-canvas.js line 101 — current:
card.style.outline = '2px solid ' + (wc.id === app.selectedWidgetId ? '#FDA4D4' : 'transparent');

// Phase 2 replacement:
function getOutline(id) {
  if (app.selectedWidgetIds && app.selectedWidgetIds.size >= 2 && app.selectedWidgetIds.has(id)) {
    return '2px dashed #60A5FA';
  }
  if (id === app.selectedWidgetId) return '2px solid #FDA4D4';
  return '2px solid transparent';
}
card.style.outline = getOutline(wc.id);
```

The `mouseenter`/`mouseleave` hover handlers (lines 178–187) must also be updated to not clobber multi-select outlines.

### Pattern 4: Rubber-band Selection (Canvas Mousedown Routing)

The canvas `page` click handler (line 196) currently deselects on empty space click. Rubber-band replaces this with a mousedown → mousemove → mouseup sequence. The routing decision happens on `mousedown`:

```javascript
page.addEventListener('mousedown', function(e) {
  const widgetEl = e.target.closest('.widget');
  if (widgetEl) return; // widget drag will handle this
  // Begin rubber-band
  startRubberBand(e, page, dash);
});
```

The rubber-band rect element is an `position: absolute` overlay on the page (not the canvas container), drawn in real time:

```javascript
// Rubber-band element spec (from UI-SPEC):
// position: absolute, pointer-events: none, z-index: 50
// border: 1px dashed #60A5FA
// background: rgba(96,165,250,0.08)
// Minimum drag distance before drawing: 4px (avoid accidental trigger)
```

On `mouseup`, compute which widget cards intersect the rubber-band rect using `getBoundingClientRect()` comparisons, populate `selectedWidgetIds`, call `StudioCanvas.render(app)` (or update outlines without full re-render), and show multi-select properties panel.

### Pattern 5: Widget ID Generation on Paste

Current widget ID generation in `addWidget()` (studio.js line 1660):
```javascript
const id = type + '-' + Date.now();
```

Paste must regenerate IDs to avoid collisions across dashboards. The same pattern works:
```javascript
// For each pasted widget deep-copy:
widget.id = widget.type + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
```

The CONTEXT.md notes widget IDs can also use the `name.toLowerCase().replace(...)` pattern, but `type + timestamp` is what `addWidget()` already uses — stay consistent.

### Pattern 6: Inline Rename after Duplication

After `POST /api/dashboards/:id/duplicate` succeeds and `renderSidebar()` has run, find the new nav item and replace its `.nav-name` span with an auto-focused input:

```javascript
// After renderSidebar(), find the new dashboard's nav item by its index
const newIdx = this.modifiedConfig.dashboards.findIndex(d => d.id === newDash.id);
const navItems = document.querySelectorAll('.dashboard-nav-item');
const newItem = navItems[newIdx];
const nameSpan = newItem.querySelector('.nav-name');

const input = document.createElement('input');
input.className = 'nav-name-edit';
input.value = newDash.name;
nameSpan.replaceWith(input);
input.focus();
input.select();

// Commit on Enter or blur; revert on Escape
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') commitRename(input, newDash, newIdx);
  if (e.key === 'Escape') { input.replaceWith(nameSpan); }
});
input.addEventListener('blur', () => commitRename(input, newDash, newIdx));
```

Note: `commitRename` must update `this.modifiedConfig.dashboards[newIdx].name` and call `this.markDirty()` — the rename is an in-memory change that requires Save to persist.

### Recommended File Change Scope

| File | Change Type | Scope |
|------|-------------|-------|
| `public/studio.html` | Replace + Add | Remove `new-dashboard-form` (lines 53–73), add `dashboard-wizard-modal` HTML after `widget-palette-modal` |
| `public/js/studio.js` | Extend | Replace `bindSidebarActions()` wizard logic; extend `renderSidebar()` for dupBtn; add `selectedWidgetIds`, `_widgetClipboard` state; add `showMultiSelectProps()`, `handleCtrlC()`, `handleCtrlV()`, `openDashboardWizard()`, `closeWizard()` methods |
| `public/js/studio-canvas.js` | Extend | Update widget outline logic; add rubber-band mousedown/mousemove/mouseup handlers; add `_rubberBandSelect()` intersection helper |
| `public/css/studio.css` | Add | Rubber-band rect CSS, `nav-duplicate` button CSS, step indicator CSS, multi-select box-shadow, clipboard indicator style |

### Anti-Patterns to Avoid

- **Re-rendering the full canvas for every outline change**: When shifting multi-select outlines, update `card.style.outline` directly on visible DOM cards rather than calling `StudioCanvas.render()` — which destroys and recreates all widget instances and triggers a fresh `/api/metrics` fetch.
- **Using the HTML5 drag API for rubber-band**: Rubber-band must use `mousedown/mousemove/mouseup` on the page element. The drag system uses the HTML5 Drag and Drop API (`dragstart/dragend/dragover/drop`) on individual widget cards — they coexist without conflict because rubber-band fires only when mousedown is on empty space.
- **Mutating `this.config` directly**: All in-memory changes go to `this.modifiedConfig`. The `this.config` reference is the last-saved server state and must only be updated after a successful `PUT /api/dashboards/...` response.
- **Clearing `selectedWidgetId` when adding multi-select**: Keep `this.selectedWidgetId` in sync. When `selectedWidgetIds.size === 1`, set `selectedWidgetId` to that one ID. When size is 0 or >= 2, set `selectedWidgetId` to null. Many existing methods check `selectedWidgetId` for things like hover outline state.
- **Pasting into a dashboard where all slots are full**: `snapToNearest` returns the original position unchanged when no open slot exists. After paste, validate that at least one widget was placed without collision — show a toast if not all could be placed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collision-free paste positioning | Custom grid search | `StudioCanvas.snapToNearest(dash, col, row, cs, rs, excludeId)` | Already implemented, tested, handles grid clamping + radius search |
| Duplicate ID collision on paste | Custom suffix generator | `type + '-' + Date.now()` (existing `addWidget` pattern) | Date.now() millisecond precision is sufficient; avoids new code surface |
| Post-API config refresh | Custom fetch + merge | `this.loadConfig()` + `this.renderSidebar()` | Exactly what delete/create/reorder already do |
| Widget deep copy for clipboard | Manual property copy | `JSON.parse(JSON.stringify(widget))` | Same pattern as `modifiedConfig` deep clone (studio.js line 52) |
| Modal backdrop blur | Custom CSS | `backdrop-filter: blur(12px)` already on `.studio-modal` in studio.css | Already declared |

---

## Common Pitfalls

### Pitfall 1: Rubber-band Fires on Widget Mousedown
**What goes wrong:** If rubber-band mousedown is attached to the `page` element without filtering `e.target`, it starts drawing a selection rect when the user clicks a widget, conflicting with the widget's own click-to-select behavior.
**Why it happens:** Events bubble. A mousedown on a widget card bubbles up to the page.
**How to avoid:** On `mousedown`, check `const widgetEl = e.target.closest('.widget')`. If truthy, return immediately. Only start rubber-band when the target is bare canvas.
**Warning signs:** Widget drag no longer works, or rubber-band appears when clicking on a widget.

### Pitfall 2: Outline Update Triggering Full Canvas Re-render
**What goes wrong:** Calling `this.renderCanvas()` to update selection outlines destroys all widget DOM instances, re-creates them, and fires a new `/api/metrics` fetch. This causes visible flicker and stale data loss.
**Why it happens:** `StudioCanvas.render()` does `canvas.textContent = ''` (line 68) before rebuilding.
**How to avoid:** For outline-only changes (shift+click toggle, rubber-band selection), directly mutate `card.style.outline` on existing DOM elements. Only call `renderCanvas()` when widget structure changes (add, remove, paste).
**Warning signs:** Canvas flickers on every shift+click, or metrics data disappears momentarily.

### Pitfall 3: Duplicate Button Click Bubbles to Dashboard Select
**What goes wrong:** Clicking the duplicate button triggers `selectDashboard(i)` because the item click handler fires after the button click.
**Why it happens:** The item click handler (studio.js line 201) uses `e.target === delBtn` to guard — if `dupBtn` is not in the guard, its click bubbles to the item handler.
**How to avoid:** In the item click handler guard: `if (e.target === delBtn || e.target === dupBtn || e.target === handle) return;`. And in the dupBtn click handler: `e.stopPropagation()`.
**Warning signs:** Dashboard switches unexpectedly when clicking duplicate.

### Pitfall 4: Server Duplicate Name Does Not Match UI-SPEC Copy
**What goes wrong:** The server `duplicateDashboard()` returns `name: "Platform Overview (Copy)"` but the UI-SPEC says post-duplication the inline rename starts with `"Copy of [original name]"`.
**Why it happens:** The user decisions and server implementation use different name formats.
**How to avoid:** After `loadConfig()` + `renderSidebar()`, do NOT rely on the server's returned name for the inline rename input. Instead, use the original dashboard's name to construct `"Copy of " + originalName` as the input's initial value, and commit it as the name when the user confirms. The server will persist whatever name the user saves via `markDirty()` + Save.
**Warning signs:** Inline rename input shows `"Platform Overview (Copy)"` instead of `"Copy of Platform Overview"`.

### Pitfall 5: Widget IDs Collide Across Dashboards After Paste
**What goes wrong:** Pasting widgets retains their original IDs. If the source and target dashboards are different and the user has not yet saved, `modifiedConfig` contains both the original and pasted widgets with the same ID. Metrics fetches key on widget ID — both return the same data slot.
**Why it happens:** Deep copy preserves the `id` field.
**How to avoid:** After deep-copying each widget for paste, immediately reassign `widget.id = widget.type + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)`.
**Warning signs:** Two widgets show identical live data on the canvas.

### Pitfall 6: Rubber-band Intersects with Resize Handles
**What goes wrong:** Mousedown on a resize handle (right/bottom handles on widget cards, positioned at `-4px` from card edge) starts a rubber-band instead of a resize.
**Why it happens:** Resize handles are inside `.widget` cards but at the edge. `e.target.closest('.widget')` correctly catches them if the handle is inside the card DOM. But if `pointer-events: none` is set on the handle parent and the handle overlaps empty canvas at the card edge, the event might land on the page.
**How to avoid:** Also check `e.target.closest('[style*="cursor:ew-resize"], [style*="cursor:ns-resize"]')` in the rubber-band guard, or give resize handles a class `resize-handle` and check `e.target.classList.contains('resize-handle')`.
**Warning signs:** Resize operations start a rubber-band rect instead of resizing.

### Pitfall 7: Ctrl+C Intercepts Browser Copy
**What goes wrong:** `document.addEventListener('keydown', ...)` for Ctrl+C fires even when the user is typing in a text input and wants to copy text.
**Why it happens:** Global keydown listener does not check if focus is in a form element.
**How to avoid:** In the keydown handler: `if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;`
**Warning signs:** Users cannot copy text from input fields in the properties panel.

---

## Code Examples

### Creating the Wizard Modal HTML Structure

```html
<!-- Source: studio.html pattern — widget-palette-modal (line 647) adapted for wizard -->
<div id="dashboard-wizard-modal" class="studio-modal" style="display:none">
  <div class="studio-modal-content" style="width:520px;max-width:90vw">
    <div class="studio-modal-header">
      <h2>NEW DASHBOARD</h2>
      <button class="modal-close" id="wizard-close">&#215;</button>
    </div>
    <div class="studio-modal-body">
      <!-- Step indicator -->
      <div class="wizard-step-indicator">
        <div class="wizard-step active" data-step="1">
          <div class="wizard-step-dot">1</div>
          <span class="wizard-step-label">CONFIGURE</span>
        </div>
        <div class="wizard-connector"></div>
        <div class="wizard-step" data-step="2">
          <div class="wizard-step-dot">2</div>
          <span class="wizard-step-label">ADD WIDGETS</span>
        </div>
      </div>
      <!-- Step 1 -->
      <div id="wizard-step-1" class="wizard-step-content">
        <!-- fields: name, subtitle, icon picker, cols, rows -->
      </div>
      <!-- Step 2 -->
      <div id="wizard-step-2" class="wizard-step-content" style="display:none">
        <!-- 3-column widget type grid -->
        <p class="wizard-skip-hint">Skip to create a blank dashboard</p>
      </div>
      <!-- Footer nav -->
      <div class="wizard-footer">
        <button id="wizard-back-btn" class="studio-btn secondary" style="display:none">Back</button>
        <button id="wizard-next-btn" class="studio-btn primary">Next</button>
      </div>
    </div>
  </div>
</div>
```

### Registering the Duplicate Button in renderSidebar()

```javascript
// Source: studio.js renderSidebar() — extends existing pattern at line 179
const dupBtn = document.createElement('button');
dupBtn.className = 'nav-duplicate';
dupBtn.textContent = '\u29C9';  // ⧉
dupBtn.title = 'Duplicate dashboard';

dupBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  this.duplicateDashboard(dash.id, i);
});

// Insert between count and toggle in the append sequence
item.appendChild(handle);
item.appendChild(thumb);
item.appendChild(name);
item.appendChild(count);
item.appendChild(dupBtn);  // new
item.appendChild(toggle);
item.appendChild(delBtn);

// Update click guard:
item.addEventListener('click', (e) => {
  if (e.target === delBtn || e.target === dupBtn || e.target === handle) return;
  this.selectDashboard(i);
});
```

### Ctrl+C / Ctrl+V Global Handler

```javascript
// Source: extends existing Escape handler pattern in bindWidgetPaletteModal() (studio.js line 1693)
document.addEventListener('keydown', (e) => {
  // Ignore when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    e.preventDefault();
    this.handleCtrlC();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault();
    this.handleCtrlV();
  }
});

handleCtrlC() {
  if (!this.selectedWidgetIds || this.selectedWidgetIds.size === 0) return;
  const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
  if (!dash) return;
  this._widgetClipboard = [...this.selectedWidgetIds]
    .map(id => dash.widgets.find(w => w.id === id))
    .filter(Boolean)
    .map(w => JSON.parse(JSON.stringify(w)));
  this._updateClipboardIndicator();
}

handleCtrlV() {
  if (!this._widgetClipboard || this._widgetClipboard.length === 0) return;
  const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
  if (!dash) return;
  const pastedIds = [];
  this._widgetClipboard.forEach(w => {
    const clone = JSON.parse(JSON.stringify(w));
    clone.id = clone.type + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const snapped = StudioCanvas.snapToNearest(
      dash, clone.position.col, clone.position.row,
      clone.position.colSpan || 1, clone.position.rowSpan || 1, null
    );
    clone.position.col = snapped.col;
    clone.position.row = snapped.row;
    if (!dash.widgets) dash.widgets = [];
    dash.widgets.push(clone);
    pastedIds.push(clone.id);
  });
  this._widgetClipboard = [];
  this.selectedWidgetIds = new Set(pastedIds);
  this.selectedWidgetId = null;
  this.markDirty();
  this.renderCanvas();
  this._updateClipboardIndicator();
  this.showToast(`${pastedIds.length} widget(s) pasted`, 'success');
}
```

### Rubber-band Selection in studio-canvas.js

```javascript
// Source: added to render() function body in studio-canvas.js, after enableDropZone()
// Replace the existing 'click on empty canvas' handler with mousedown routing

var rubberBandEl = null;
var rbStartX = 0, rbStartY = 0;

page.addEventListener('mousedown', function(e) {
  // Only start rubber-band on empty canvas space
  if (e.target.closest('.widget')) return;
  if (e.target.closest('.resize-handle')) return;
  rbStartX = e.clientX;
  rbStartY = e.clientY;

  var moved = false;

  function onMove(ev) {
    var dx = ev.clientX - rbStartX;
    var dy = ev.clientY - rbStartY;
    if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    moved = true;

    if (!rubberBandEl) {
      rubberBandEl = document.createElement('div');
      rubberBandEl.className = 'rubber-band-rect';
      page.appendChild(rubberBandEl);
    }
    var rect = page.getBoundingClientRect();
    var x = Math.min(rbStartX, ev.clientX) - rect.left;
    var y = Math.min(rbStartY, ev.clientY) - rect.top;
    var w = Math.abs(dx);
    var h = Math.abs(dy);
    rubberBandEl.style.left   = x + 'px';
    rubberBandEl.style.top    = y + 'px';
    rubberBandEl.style.width  = w + 'px';
    rubberBandEl.style.height = h + 'px';
  }

  function onUp(ev) {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);

    if (rubberBandEl) {
      rubberBandEl.parentNode.removeChild(rubberBandEl);
      rubberBandEl = null;
    }

    if (!moved) {
      // Treat as deselect click
      app.selectedWidgetId = null;
      app.selectedWidgetIds = new Set();
      page.querySelectorAll('.widget').forEach(function(el) {
        el.style.outline = '2px solid transparent';
      });
      app.showDashboardProps();
      return;
    }

    // Compute selection intersection
    var selRect = {
      left: Math.min(rbStartX, ev.clientX),
      right: Math.max(rbStartX, ev.clientX),
      top: Math.min(rbStartY, ev.clientY),
      bottom: Math.max(rbStartY, ev.clientY)
    };
    var selected = new Set();
    page.querySelectorAll('.widget').forEach(function(card) {
      var cr = card.getBoundingClientRect();
      if (cr.left < selRect.right && cr.right > selRect.left &&
          cr.top < selRect.bottom && cr.bottom > selRect.top) {
        selected.add(card.dataset.widgetId);
      }
    });
    app.selectedWidgetIds = selected;
    app.selectedWidgetId = selected.size === 1 ? [...selected][0] : null;
    // Update outlines
    page.querySelectorAll('.widget').forEach(function(card) {
      card.style.outline = selected.has(card.dataset.widgetId)
        ? '2px dashed #60A5FA' : '2px solid transparent';
    });
    if (selected.size >= 2) {
      app.showMultiSelectProps();
    } else if (selected.size === 1) {
      app.showWidgetProps([...selected][0]);
    }
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
});
```

### CSS for New Components

```css
/* Source: extends studio.css — follows existing patterns */

/* Duplicate button — matches nav-delete pattern */
.nav-duplicate {
  background: none;
  border: none;
  color: transparent;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 2px;
  transition: color 0.15s;
}
.dashboard-nav-item:hover .nav-duplicate {
  color: var(--t3);
}
.nav-duplicate:hover {
  color: #60A5FA !important;
}

/* Rubber-band selection rectangle */
.rubber-band-rect {
  position: absolute;
  border: 1px dashed #60A5FA;
  background: rgba(96, 165, 250, 0.08);
  pointer-events: none;
  z-index: 50;
}

/* Wizard step indicator */
.wizard-step-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
}
.wizard-step-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-card);
  color: var(--t3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-family: var(--font-display);
  font-weight: 600;
}
.wizard-step.active .wizard-step-dot {
  background: #60A5FA;
  color: #fff;
}
.wizard-step.completed .wizard-step-dot {
  background: #4ADE80;
  color: #fff;
}
.wizard-connector {
  flex: 1;
  height: 2px;
  background: var(--border);
}
.wizard-step-label {
  font-size: 10px;
  font-family: var(--font-display);
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--t3);
}

/* Clipboard indicator in canvas footer */
.clipboard-indicator {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--t3);
  letter-spacing: 0.5px;
}
```

---

## State of the Art

| Old Approach | Current Approach | Status | Impact |
|--------------|------------------|--------|--------|
| `new-dashboard-form` inline (below dashboard list) | `dashboard-wizard-modal` (full-screen modal) | Phase 2 replaces | Consistent UX with widget palette; no sidebar scroll needed |
| Single-select only (`selectedWidgetId: string`) | Multi-select Set (`selectedWidgetIds: Set<string>`) | Phase 2 adds | Enables cross-dashboard copy/paste workflow |
| No clipboard | In-memory `_widgetClipboard` array on StudioApp | Phase 2 adds | Clipboard survives dashboard switches |

**API already complete (no server work needed):**
- `POST /api/dashboards` — line 462 (`server/index.js`)
- `POST /api/dashboards/:id/duplicate` — line 534 (`server/index.js`) — returns `{ id, name: "[name] (Copy)", widgets: [...] }`
- `POST /api/dashboards/reorder` — line 550 (`server/index.js`)

**Confirmed server behavior (from `dashboard-manager.js`):**
- `duplicateDashboard('platform-overview')` → returns dashboard with `id: 'platform-overview-copy'`, `name: 'Platform Overview (Copy)'`
- Handles ID collision: appends `-copy-2`, `-copy-3`, etc.
- Deep clones widgets array (`JSON.parse(JSON.stringify(original.widgets))`)

---

## Open Questions

1. **Wizard Step 2 pre-populates or just configures widget types?**
   - What we know: CONTEXT.md says "pick widget types from a palette to pre-populate the new dashboard" — this means on "Create Dashboard", selected types are added as empty widgets (no title/query — just type + default position)
   - What's unclear: Whether they are added one per selected type at default positions, or whether the user can select count/multiples of a type
   - Recommendation: One widget per selected type, placed at sequential grid positions using the same logic as `addWidget()` (last widget's col+1, wrap row). This is the lowest-complexity interpretation and matches the CONTEXT wording.

2. **Multi-select shift+click: does it update properties panel immediately on each toggle?**
   - What we know: When size >= 2, show multi-select panel with shared fields only. When size === 1, show full widget props.
   - What's unclear: Whether the panel updates on every shift+click in real time, or only on mouse release.
   - Recommendation: Update immediately on each shift+click. The properties panel is lightweight DOM — real-time update is feasible without performance concern.

3. **Clipboard indicator placement in footer when canvas has no active dashboard**
   - What we know: `.studio-canvas-footer` contains only `#add-widget-btn`. The clipboard indicator goes left-aligned alongside it.
   - What's unclear: Does the indicator show even when no dashboard is active (add-widget-btn is disabled)?
   - Recommendation: Show indicator regardless of active dashboard state — clipboard is app-level state, not dashboard-level.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | bun:test (built-in) |
| Config file | none — `bun test tests/unit tests/integration tests/helpers tests/components` |
| Quick run command | `bun test tests/dashboard-manager.test.js` |
| Full suite command | `bun test tests/unit tests/integration tests/helpers tests/components` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | `POST /api/dashboards` creates dashboard with correct structure | unit (server) | `bun test tests/dashboard-manager.test.js` | Yes — `tests/dashboard-manager.test.js` covers `createDashboard()` |
| DASH-01 | Wizard modal opens/closes and advances steps | manual-only | n/a | ❌ Wave 0 — frontend DOM interaction, no JSDOM in bun:test |
| DASH-01 | Step 2 widget types pre-populate new dashboard | unit (server-side validation via existing test) | `bun test tests/dashboard-manager.test.js` | Yes — covers widget structure |
| DASH-02 | `POST /api/dashboards/:id/duplicate` returns correct copy | unit (server) | `bun test tests/dashboard-manager.test.js` | Yes — `duplicateDashboard` test at line 120 |
| DASH-02 | Duplicate button appears + triggers API | manual-only | n/a | ❌ Wave 0 — DOM test |
| DASH-03 | Widget clipboard deep-copies (no shared references) | unit (pure logic) | `bun test tests/unit/studio-clipboard.test.js` | ❌ Wave 0 |
| DASH-03 | Paste regenerates widget IDs (no collisions) | unit (pure logic) | `bun test tests/unit/studio-clipboard.test.js` | ❌ Wave 0 |
| DASH-03 | `snapToNearest` handles paste collision correctly | unit (existing API) | `bun test tests/dashboard-manager.test.js` | Partial — snapToNearest is tested indirectly; direct unit test in Phase 1 tests |

**Note on frontend tests:** This project has no JSDOM or browser test harness. Canvas interaction tests (wizard steps, rubber-band, shift+click) are manual-only. The test strategy focuses on server-side logic and pure JS utility functions that have no DOM dependencies.

### Sampling Rate

- **Per task commit:** `bun test tests/dashboard-manager.test.js`
- **Per wave merge:** `bun test tests/unit tests/integration tests/helpers tests/components`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/studio-clipboard.test.js` — covers DASH-03 clipboard deep-copy and ID regeneration logic (pure functions, no DOM required)
- [ ] No framework install needed — `bun:test` is already in use

---

## Sources

### Primary (HIGH confidence)
- Direct source read: `public/js/studio.js` — renderSidebar() line 144, StudioApp constructor, showWidgetProps(), bindSidebarActions() form handler, bindWidgetPaletteModal()
- Direct source read: `public/js/studio-canvas.js` — render(), enableDrag(), enableDropZone(), _hasCollision(), _snapToNearest(), public API at line 455
- Direct source read: `public/studio.html` — existing new-dashboard-form (lines 50–73), widget-palette-modal (line 647), prop-type select options (lines 282–306), canvas footer (line 141)
- Direct source read: `server/index.js` — POST /api/dashboards (line 462), POST /api/dashboards/:id/duplicate (line 534)
- Direct source read: `server/dashboard-manager.js` — duplicateDashboard() name/ID generation behavior
- Direct source read: `public/css/studio.css` — .studio-modal, .studio-modal-content, .studio-modal-header, .studio-modal-body, .modal-close patterns (lines 719–792)
- Direct source read: `.planning/phases/02-dashboard-management/02-CONTEXT.md` — all locked decisions
- Direct source read: `.planning/phases/02-dashboard-management/02-UI-SPEC.md` — all visual/interaction specifications

### Secondary (MEDIUM confidence)
- Direct source read: `tests/dashboard-manager.test.js` — confirmed test infrastructure and coverage scope
- Direct source read: `.planning/codebase/ARCHITECTURE.md` + `CONVENTIONS.md` — code style and pattern verification

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all reused from existing verified code
- Architecture: HIGH — all patterns verified by direct source code read
- API behavior: HIGH — server routes and manager confirmed by source read; test file confirms expected behavior
- Pitfalls: HIGH — identified from direct code analysis (event bubbling, rendering, state extension points)
- Frontend interaction patterns: MEDIUM — rubber-band and multi-select logic is new surface not yet present in codebase; code examples are designed patterns not yet tested

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable codebase — changes only via PRs)
