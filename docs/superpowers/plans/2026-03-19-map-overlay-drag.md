# Map Overlay Drag-to-Position Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all map overlay elements (leaderboard, total counter, region panels, client logo) draggable in the Studio editor with positions persisted to `mglConfig.overlayPositions` in `dashboards.yaml`.

**Architecture:** A `_makeDraggable(el, key)` helper in `MapboxUSAMap` attaches pointer events only when `document.body.classList.contains('studio-body')`. On drop, a `mgl-overlay-moved` CustomEvent (bubbles) fires on `this._wrap`. `studio-canvas.js` listens on the `content` div after `Widgets.create`, writes positions to `wc.mglConfig.overlayPositions`, and calls `markDirty()`. Positions are read from `this._cfg.overlayPositions` at construction time and applied as inline `top`/`left` styles.

**Tech Stack:** Bun, vanilla JS (no frameworks), Pointer Events API, Mapbox GL JS, YAML config

---

## File Map

| File | Change |
|---|---|
| `public/js/mapbox-map.js` | `this._overlayPositions` init; `_makeDraggable()`; `_applyOverlayPosition()`; `_saveOverlayPosition()`; call sites in `_buildLeaderboardDOM` + `_buildOverlayDOM`; skip saved panels in `_positionRegionPanels()` |
| `public/css/mapbox-map.css` | Drag hover outline CSS scoped to `body.studio-body` |
| `public/js/studio-canvas.js` | `mgl-overlay-moved` listener after `Widgets.create` for `usa-map-gl` widgets |
| `public/studio.html` | Reset Overlay Positions button in `#mgl-config-section` |
| `public/js/studio.js` | Bind Reset button in `showWidgetProps()` |

---

## Chunk 1: mapbox-map.js — drag infrastructure

### Task 1: Initialize `_overlayPositions` in constructor

**Files:**
- Modify: `public/js/mapbox-map.js` (constructor, line ~121)

The constructor already sets many `this._xxx = null` vars. After `this._lastBounds = null;` add the overlay positions store.

- [ ] **Step 1: Add `_overlayPositions` to the constructor**

Find the line `this._lastBounds = null;` (inside the constructor). Add immediately after it:

```js
// Persisted overlay positions (from mglConfig.overlayPositions)
this._overlayPositions = Object.assign({}, (this._cfg && this._cfg.overlayPositions) || {});
```

- [ ] **Step 2: Verify no syntax error**

```bash
bun --eval "import('./public/js/mapbox-map.js').catch(()=>{})" 2>&1 | grep -i "error\|syntax" | head -5
```

Expected: no output.

---

### Task 2: Add `_makeDraggable()`, `_applyOverlayPosition()`, `_saveOverlayPosition()` methods

**Files:**
- Modify: `public/js/mapbox-map.js` (add three methods near the end of the class, before the closing `}` of `MapboxUSAMap`)

Find the line `_watchVisibility()` method (line ~794). Add these three methods **before** it:

- [ ] **Step 1: Add `_applyOverlayPosition(el, key)`**

```js
_applyOverlayPosition(el, key) {
  const pos = this._overlayPositions && this._overlayPositions[key];
  if (!pos) return;
  el.style.top    = pos.top;
  el.style.left   = pos.left;
  el.style.right  = '';
  el.style.bottom = '';
  // Leaderboard needs explicit width after right anchor is cleared
  if (key === 'leaderboard' && !el.style.width) {
    el.style.width = '340px';
  }
}
```

- [ ] **Step 2: Add `_saveOverlayPosition(key, el)`**

```js
_saveOverlayPosition(key, el) {
  if (!this._overlayPositions) this._overlayPositions = {};
  this._overlayPositions[key] = { top: el.style.top, left: el.style.left };
}
```

- [ ] **Step 3: Add `_makeDraggable(el, key)`**

```js
_makeDraggable(el, key) {
  if (!document.body.classList.contains('studio-body')) return;
  el.style.pointerEvents = 'auto';
  el.style.cursor = 'grab';

  const self = this;
  let startX = 0, startY = 0;

  el.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.style.cursor = 'grabbing';

    // Convert any right/bottom anchors to top/left so dragging works cleanly
    const cr = self._wrap.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    el.style.top    = (er.top  - cr.top)  + 'px';
    el.style.left   = (er.left - cr.left) + 'px';
    el.style.right  = '';
    el.style.bottom = '';
    if (key === 'leaderboard') el.style.width = er.width + 'px';

    startX = e.clientX - el.offsetLeft;
    startY = e.clientY - el.offsetTop;
  });

  // pointermove on el — setPointerCapture redirects captured events here
  el.addEventListener('pointermove', function (e) {
    if (e.buttons === 0) return;
    const cr  = self._wrap.getBoundingClientRect();
    const er  = el.getBoundingClientRect();
    let nx = e.clientX - startX;
    let ny = e.clientY - startY;
    // Clamp within container bounds
    nx = Math.max(0, Math.min(nx, cr.width  - er.width));
    ny = Math.max(0, Math.min(ny, cr.height - er.height));
    el.style.left = nx + 'px';
    el.style.top  = ny + 'px';
  });

  el.addEventListener('pointerup', function (e) {
    el.style.cursor = 'grab';
    el.releasePointerCapture(e.pointerId);
    self._saveOverlayPosition(key, el);
    self._wrap.dispatchEvent(new CustomEvent('mgl-overlay-moved', {
      bubbles: true,
      detail: { positions: Object.assign({}, self._overlayPositions) },
    }));
  });
}
```

---

### Task 3: Wire `_makeDraggable` and `_applyOverlayPosition` into `_buildLeaderboardDOM`

**Files:**
- Modify: `public/js/mapbox-map.js` (`_buildLeaderboardDOM`, line ~994)

`_buildLeaderboardDOM` creates three overlays: the leaderboard `lb`, the client logo `logoWrap`, and the total `overlay`. After each `this._wrap.appendChild(...)` call, apply saved position and make it draggable.

- [ ] **Step 1: After `this._wrap.appendChild(lb)` — leaderboard**

Find `this._lbEl = lb; this._wrap.appendChild(lb);` and add immediately after:

```js
this._applyOverlayPosition(lb, 'leaderboard');
this._makeDraggable(lb, 'leaderboard');
```

- [ ] **Step 2: After `this._wrap.appendChild(logoWrap)` — client logo**

Find the `if (this._cfg.clientLogo)` block and after `this._wrap.appendChild(logoWrap);` add:

```js
this._applyOverlayPosition(logoWrap, 'clientLogo');
this._makeDraggable(logoWrap, 'clientLogo');
```

- [ ] **Step 3: After `this._wrap.appendChild(overlay)` — total overlay**

Find the `overlay.className = 'mgl-total-overlay'` block and after `this._wrap.appendChild(overlay);` add:

```js
this._applyOverlayPosition(overlay, 'totalOverlay');
this._makeDraggable(overlay, 'totalOverlay');
```

---

### Task 4: Wire into `_buildOverlayDOM` for region panels

**Files:**
- Modify: `public/js/mapbox-map.js` (`_buildOverlayDOM`, line ~944)

The region panels loop creates `west`, `central`, `east` panels. After `this._wrap.appendChild(panel)` in that loop, apply position and make draggable.

- [ ] **Step 1: After `this._wrap.appendChild(panel)` in the region panel forEach**

Find the loop `[{ key: 'west'...}, ...]forEach(({ key, label }) => {`. After `this._wrap.appendChild(panel);` and before `this._regionPanels[key] = ...`, add:

```js
this._applyOverlayPosition(panel, key);
this._makeDraggable(panel, key);
```

---

### Task 5: Skip user-positioned panels in `_positionRegionPanels`

**Files:**
- Modify: `public/js/mapbox-map.js` (`_positionRegionPanels`, line ~744)

The method runs on every `moveend`/`render` and overwrites `panel.style.left`/`top`. Add a skip guard at the top of the `DATA_CENTERS.forEach` loop:

- [ ] **Step 1: Add skip guard inside `DATA_CENTERS.forEach`**

Find `DATA_CENTERS.forEach(dc => {` inside `_positionRegionPanels`. Add as the first line of the callback body:

```js
const key   = dcKeyMap[dc.id];
const entry = this._regionPanels[key];
```

Wait — `key` and `entry` are already declared later in that callback. Instead, add the skip guard **after** the existing `const key = dcKeyMap[dc.id];` and `const entry = ...` lines:

```js
// Skip panels that have been manually positioned by the user
if (this._overlayPositions && this._overlayPositions[key]) return;
```

Add this line immediately after `const entry = this._regionPanels[key];`.

- [ ] **Step 2: Commit Task 1-5**

```bash
git add public/js/mapbox-map.js
git commit -m "feat: draggable map overlays — _makeDraggable, _applyOverlayPosition, _positionRegionPanels skip"
```

---

## Chunk 2: CSS + studio wiring

### Task 6: Add drag affordance CSS

**Files:**
- Modify: `public/css/mapbox-map.css`

Append at the end of the file:

- [ ] **Step 1: Append CSS**

```css
/* ── Studio drag affordances ──────────────────────────────────────────────── */
/* pointer-events and cursor are set inline by _makeDraggable() in JS;        */
/* these rules only add the visual hover outline in studio mode                */
body.studio-body .mgl-leaderboard:hover,
body.studio-body .mgl-total-overlay:hover,
body.studio-body .mgl-region-panel:hover,
body.studio-body .mgl-client-logo:hover {
  outline: 1px dashed rgba(253,164,212,0.55);
  outline-offset: 3px;
}
```

---

### Task 7: Attach `mgl-overlay-moved` listener in `studio-canvas.js`

**Files:**
- Modify: `public/js/studio-canvas.js`

The `Widgets.create` call is around line 123. After it, for `usa-map-gl` widgets, attach a persistent listener on `content`.

- [ ] **Step 1: Read studio-canvas.js to find the exact insertion point**

The code looks like:
```js
widgetInstance = window.Widgets.create(wc.type, content, wc);
```

Add immediately after (still inside the `if (window.Widgets && ...)` block):

```js
// For GL map widgets: listen for overlay position changes and mark the config dirty
if (wc.type === 'usa-map-gl') {
  content.addEventListener('mgl-overlay-moved', function (e) {
    if (!wc.mglConfig) wc.mglConfig = {};
    wc.mglConfig.overlayPositions = e.detail.positions;
    if (window._studioApp && window._studioApp.markDirty) {
      window._studioApp.markDirty();
    }
  });
}
```

Note: `window._studioApp` is the `StudioApp` instance. Verify this is how it's exposed by checking `studio.js` — look for `window._studioApp = ...` or similar. If the app instance is stored differently, use that pattern instead.

- [ ] **Step 2: Verify how StudioApp is exposed on window**

```bash
grep -n "window\._studioApp\|window\.studioApp\|studioApp\s*=" public/js/studio.js | head -5
grep -n "window\._studioApp\|window\.studioApp\|studioApp\s*=" public/js/studio-canvas.js | head -5
```

Use whatever pattern exists. If none, the canvas render function already has a reference to the app passed as argument — use that instead.

---

### Task 8: Reset Positions button in studio HTML + JS

**Files:**
- Modify: `public/studio.html`
- Modify: `public/js/studio.js`

- [ ] **Step 1: Add Reset button in `#mgl-config-section` in `public/studio.html`**

Find the closing `</div>` of the `<details id="mgl-config-section">` block (the one that wraps all the Map GL Config labels). Add before the closing `</details>`:

```html
<button type="button" id="reset-overlay-positions" class="studio-btn secondary small" style="margin-top:6px">
  ↺ Reset Overlay Positions
</button>
```

- [ ] **Step 2: Bind Reset button in `showWidgetProps()` in `public/js/studio.js`**

Find the block in `showWidgetProps()` where `mgl-config-section` controls are bound (around the `bind('prop-mgl-scheme', ...)` area). Add:

```js
const resetOverlayBtn = document.getElementById('reset-overlay-positions');
if (resetOverlayBtn) {
  resetOverlayBtn.onclick = () => {
    if (wc.mglConfig) delete wc.mglConfig.overlayPositions;
    self.markDirty();
    self.renderCanvas();
  };
}
```

---

### Task 9: Bump CSS/JS versions and verify end-to-end

**Files:**
- Modify: `public/studio.html` (bump `mapbox-map.js?v=` and `mapbox-map.css?v=`)
- Modify: `public/index.html` (bump `mapbox-map.js?v=`)

- [ ] **Step 1: Increment version numbers**

In `public/studio.html`: find `mapbox-map.js?v=20` → `v=21` and `mapbox-map.css?v=16` → `v=17`.
In `public/index.html`: find `mapbox-map.js?v=20` → `v=21`.

- [ ] **Step 2: Restart and smoke test**

```bash
sudo systemctl restart tv-dashboards && sleep 3
curl -s -o /dev/null -w "%{http_code}" http://tv:3000/admin
```

Expected: `200`

- [ ] **Step 3: Manual verification in studio**

Open `http://tv.madhive.local/admin`. Click a `usa-map-gl` widget:
- Map should be interactive (scroll to zoom)
- Leaderboard panel should show a dashed pink outline on hover
- Drag leaderboard to a new position → Save button activates (markDirty)
- Click Save → verify `dashboards.yaml` has `mglConfig.overlayPositions.leaderboard`
- Reload studio → overlay should be at saved position
- Click "↺ Reset Overlay Positions" → overlay returns to default position, Save activates

```bash
grep -A 8 "overlayPositions" config/dashboards.yaml | head -15
```

Expected: positions saved for the dragged widget.

- [ ] **Step 4: Commit all remaining changes**

```bash
git add public/css/mapbox-map.css public/js/studio-canvas.js public/studio.html public/js/studio.js public/index.html
git commit -m "feat: map overlay drag affordances, studio wiring, reset button, version bumps"
```

---

## Chunk 3: Ship

### Task 10: PR, merge, restart

- [ ] **Step 1: Create PR**

```bash
git checkout -b feat/map-overlay-drag
git push -u origin feat/map-overlay-drag
gh pr create \
  --title "feat: draggable map overlays persisted to mglConfig" \
  --body "Adds drag-to-reposition for all four map overlay types (leaderboard, total counter, region panels, client logo) in the Studio editor.

- Drag any overlay to avoid overlap — dashed pink outline on hover shows draggability
- Positions saved to mglConfig.overlayPositions on drop (markDirty)
- TV display reads saved positions and applies them at load time
- Region panel auto-positioning skips user-positioned panels
- Reset Overlay Positions button in Map GL Config props clears all positions" \
  --base main
```

- [ ] **Step 2: Merge**

```bash
gh pr merge --squash --delete-branch
git checkout main && git reset --hard origin/main
```

- [ ] **Step 3: Restart + refresh kiosk**

```bash
sudo systemctl restart tv-dashboards lightdm
sleep 5
DISPLAY=:0 xdotool key ctrl+shift+r
```
