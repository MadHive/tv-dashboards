# Map Overlay Drag-to-Position Design

**Date:** 2026-03-19
**Status:** Approved (v2 — spec review fixes applied)

## Overview

Make all four map overlay types draggable in the Studio. Positions persist to `mglConfig.overlayPositions` in `dashboards.yaml` and are applied at load time on both Studio and TV display.

## Draggable Overlays

| Overlay | DOM class | Built in | Default CSS anchor |
|---|---|---|---|
| Leaderboard | `.mgl-leaderboard` | `_buildLeaderboardDOM()` | `top:12px right:12px bottom:12px width:340px` |
| Total overlay | `.mgl-total-overlay` | `_buildLeaderboardDOM()` | `bottom:16px left:16px` |
| Region panels | `.mgl-region-panel` × 3 | `_buildOverlayDOM()` | inline absolute, set by `_positionRegionPanels()` |
| Client logo | `.mgl-client-logo` | `_buildLeaderboardDOM()` | `top:18px left:18px` |

## Position Storage

Stored in `mglConfig.overlayPositions` on the widget config:

```json
{
  "overlayPositions": {
    "leaderboard":  { "top": "12px",  "left": "12px" },
    "totalOverlay": { "top": "800px", "left": "16px" },
    "west":         { "top": "180px", "left": "60px" },
    "central":      { "top": "320px", "left": "420px" },
    "east":         { "top": "180px", "left": "780px" },
    "clientLogo":   { "top": "18px",  "left": "18px" }
  }
}
```

All positions use `top` + `left` exclusively (px values). If `overlayPositions` is absent or a key is missing, the CSS defaults apply (no inline style set). This flows through the existing `mglConfig` path: `buildMapConfig()` spreads it into `this._cfg`, saved by studio to `dashboards.yaml`, served by `/api/config`.

## Drag Mechanics (`public/js/mapbox-map.js`)

**Studio detection:** `document.body.classList.contains('studio-body')`

**Enable dragging (studio only):** call `this._makeDraggable(el, key)` for each overlay after creating it, where `key` is the `overlayPositions` key for that overlay.

**`_makeDraggable(el, key)` implementation:**

```js
_makeDraggable(el, key) {
  if (!document.body.classList.contains('studio-body')) return;
  el.style.pointerEvents = 'auto';
  el.style.cursor = 'grab';

  let startX, startY;

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.style.cursor = 'grabbing';

    // Convert right/bottom anchors to top/left before dragging
    const containerRect = this._wrap.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    el.style.top    = (elRect.top  - containerRect.top)  + 'px';
    el.style.left   = (elRect.left - containerRect.left) + 'px';
    el.style.right  = '';   // MUST clear to avoid double-constraining
    el.style.bottom = '';   // MUST clear to avoid double-constraining width/height
    el.style.width  = elRect.width + 'px';   // fix width after clearing right anchor

    startX = e.clientX - el.offsetLeft;
    startY = e.clientY - el.offsetTop;
  });

  // pointermove on el (not document) — setPointerCapture redirects events here
  el.addEventListener('pointermove', (e) => {
    if (e.buttons === 0) return;
    const containerRect = this._wrap.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    let newLeft = e.clientX - startX;
    let newTop  = e.clientY - startY;
    // Clamp within container
    newLeft = Math.max(0, Math.min(newLeft, containerRect.width  - elRect.width));
    newTop  = Math.max(0, Math.min(newTop,  containerRect.height - elRect.height));
    el.style.left = newLeft + 'px';
    el.style.top  = newTop  + 'px';
  });

  el.addEventListener('pointerup', (e) => {
    el.style.cursor = 'grab';
    el.releasePointerCapture(e.pointerId);
    this._saveOverlayPosition(key, el);
    this._wrap.dispatchEvent(new CustomEvent('mgl-overlay-moved', {
      bubbles: true,
      detail: { positions: this._overlayPositions },
    }));
  });
}
```

**`_saveOverlayPosition(key, el)`:** updates `this._overlayPositions[key] = { top: el.style.top, left: el.style.left }`. `this._overlayPositions` is initialised in the constructor as `{ ...((this._cfg.overlayPositions) || {}) }`.

## Apply Saved Positions on Load

After creating each overlay element (in `_buildOverlayDOM` and `_buildLeaderboardDOM`), apply any saved position:

```js
_applyOverlayPosition(el, key) {
  const pos = this._overlayPositions && this._overlayPositions[key];
  if (!pos) return;
  el.style.top    = pos.top;
  el.style.left   = pos.left;
  el.style.right  = '';   // clear competing anchors
  el.style.bottom = '';
  // Fix width for leaderboard (CSS default is right-anchored)
  if (key === 'leaderboard' && !el.style.width) {
    el.style.width = '340px';
  }
}
```

Call `this._applyOverlayPosition(el, key)` immediately after `this._wrap.appendChild(el)` for each overlay.

## Region Panel Auto-Positioning Conflict

`_positionRegionPanels()` runs on map `moveend`/`render` and sets `panel.style.left` / `panel.style.top` continuously. This overwrites user drags. Fix: at the start of `_positionRegionPanels()`, skip any panel that has a saved position:

```js
_positionRegionPanels() {
  Object.entries(this._regionPanels).forEach(([key, { panel }]) => {
    if (this._overlayPositions && this._overlayPositions[key]) return; // user-positioned
    // existing positioning logic...
  });
}
```

## Studio Integration (`public/js/studio.js`)

### Attaching the event listener

The map widget is initialised in `renderCanvas()` via `window.Widgets.create(wc.type, content, wc)`. The map attaches to the `content` div. After `Widgets.create` returns, the `mgl-container` is a child of `content`. Attach the listener to `content`:

```js
if (wc.type === 'usa-map-gl') {
  // Listen for overlay position changes — persistent listener, removed on re-render
  const handler = (e) => {
    wc.mglConfig = Object.assign({}, wc.mglConfig || {}, {
      overlayPositions: e.detail.positions,
    });
    this.markDirty();
  };
  content._mglOverlayHandler = handler;
  content.addEventListener('mgl-overlay-moved', handler);
}
```

On re-render (`renderCanvas()` starts with `canvas.textContent = ''` which removes all children including `content`), the old listener is garbage-collected with the removed element. The new content div gets a fresh listener. No explicit removal needed.

### Reset Positions button

In `public/studio.html`, inside `<details id="mgl-config-section">`, add:

```html
<button type="button" id="reset-overlay-positions" class="studio-btn secondary small">Reset Overlay Positions</button>
```

In `studio.js`, bind in `showWidgetProps()`:

```js
const resetBtn = document.getElementById('reset-overlay-positions');
if (resetBtn) {
  resetBtn.onclick = () => {
    delete wc.mglConfig.overlayPositions;
    self.markDirty();
    self.renderCanvas();  // re-renders widget with CSS defaults
  };
}
```

## CSS (`public/css/mapbox-map.css`)

```css
/* Studio drag affordances — only when body.studio-body is present */
body.studio-body .mgl-leaderboard,
body.studio-body .mgl-total-overlay,
body.studio-body .mgl-region-panel,
body.studio-body .mgl-client-logo {
  outline: none;
  transition: outline 0.15s;
}
body.studio-body .mgl-leaderboard:hover,
body.studio-body .mgl-total-overlay:hover,
body.studio-body .mgl-region-panel:hover,
body.studio-body .mgl-client-logo:hover {
  outline: 1px dashed rgba(253,164,212,0.5);
}
```

The `pointer-events: auto` and `cursor: grab` are set inline by `_makeDraggable()` rather than via CSS, so they only apply when the JS explicitly enables dragging (i.e., after studio-body detection) — no risk of accidentally enabling on TV.

## Files Changed

| File | Change |
|---|---|
| `public/js/mapbox-map.js` | `_makeDraggable(el, key)`, `_applyOverlayPosition(el, key)`, `_saveOverlayPosition(key, el)`; `this._overlayPositions` init in constructor; call sites in `_buildLeaderboardDOM` and `_buildOverlayDOM`; skip logic in `_positionRegionPanels()` |
| `public/css/mapbox-map.css` | Drag hover outline CSS for studio mode |
| `public/js/studio.js` | `mgl-overlay-moved` listener in `renderCanvas()` after `Widgets.create`; Reset button binding in `showWidgetProps()` |
| `public/studio.html` | Reset Overlay Positions button in `#mgl-config-section` |
