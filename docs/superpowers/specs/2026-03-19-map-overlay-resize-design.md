# Map Overlay Resize Design

**Date:** 2026-03-19
**Status:** Approved (v2 — spec review fixes applied)

## Overview

Extend the existing drag-to-position system to also support resize. A single bottom-right (`se`) resize handle appears on each overlay in Studio mode. Resizing saves `width`/`height` alongside `top`/`left` in `mglConfig.overlayPositions`. TV display applies saved sizes at load time.

## Overlays

All four: leaderboard, total overlay, region panels, client logo.

## Data model

Extend the existing `overlayPositions` entries to include optional `width` and `height`:

```json
{
  "overlayPositions": {
    "leaderboard":  { "top": "20px", "left": "20px", "width": "420px", "height": "600px" },
    "totalOverlay": { "top": "750px", "left": "30px", "width": "280px" },
    "west":         { "top": "200px", "left": "80px", "width": "180px" },
    "central":      { "top": "320px", "left": "380px", "width": "180px" },
    "east":         { "top": "200px", "left": "700px", "width": "180px" },
    "clientLogo":   { "top": "18px",  "left": "18px",  "width": "200px", "height": "60px" }
  }
}
```

`width` and `height` are optional — if absent, CSS defaults apply.

## Single `se` resize handle

**Why `se` only:** The bottom-right corner is the most natural resize affordance and requires no simultaneous position adjustment — `top` and `left` stay fixed while `width` and `height` grow. Adding ne/nw/sw handles would require moving the element's origin as the opposite edge is dragged, significantly increasing complexity for little practical gain on a TV display.

## Resize handles (`public/js/mapbox-map.js`)

**`_addResizeHandles(el, key)`** — called in studio mode after `_makeDraggable()`:

```js
_addResizeHandles(el, key) {
  if (!document.body.classList.contains('studio-body')) return;

  const handle = document.createElement('div');
  handle.className = 'mgl-resize-handle mgl-resize-se';

  const self = this;
  let startW, startH, startX, startY;

  handle.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    e.stopPropagation();  // prevent drag from also firing on the parent
    handle.setPointerCapture(e.pointerId);
    startW = el.offsetWidth;
    startH = el.offsetHeight;
    startX = e.clientX;
    startY = e.clientY;
  });

  handle.addEventListener('pointermove', function (e) {
    if (e.buttons === 0) return;
    const cr = self._wrap.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    let nw = startW + (e.clientX - startX);
    let nh = startH + (e.clientY - startY);
    // Minimum dimensions
    nw = Math.max(80, nw);
    nh = Math.max(40, nh);
    // Clamp to container right/bottom edge
    nw = Math.min(nw, cr.width  - er.left + cr.left);
    nh = Math.min(nh, cr.height - er.top  + cr.top);
    el.style.width  = nw + 'px';
    el.style.height = nh + 'px';
  });

  handle.addEventListener('pointerup', function (e) {
    handle.releasePointerCapture(e.pointerId);
    self._saveOverlaySize(key, el);
    self._wrap.dispatchEvent(new CustomEvent('mgl-overlay-moved', {
      bubbles: true,
      detail: { positions: Object.assign({}, self._overlayPositions) },
    }));
  });

  el.appendChild(handle);
}
```

`e.stopPropagation()` on pointerdown prevents the parent overlay's drag handler from also activating when the handle is grabbed.

## `_saveOverlaySize(key, el)`

Merges `width`/`height` into the existing positions entry without overwriting `top`/`left`:

```js
_saveOverlaySize(key, el) {
  if (!this._overlayPositions) this._overlayPositions = {};
  if (!this._overlayPositions[key]) this._overlayPositions[key] = {};
  const pos = this._overlayPositions[key];
  if (el.style.width)  pos.width  = el.style.width;
  else                 delete pos.width;
  if (el.style.height) pos.height = el.style.height;
  else                 delete pos.height;
}
```

Uses `delete` (not `|| undefined`) for clean serialization — absent keys mean "use CSS default".

## Extend `_applyOverlayPosition`

In the existing `_applyOverlayPosition(el, key)`, after the `top`/`left`/`right`/`bottom` lines, add:

```js
if (pos.width)  el.style.width  = pos.width;
if (pos.height) el.style.height = pos.height;
```

This covers all four overlays since `_applyOverlayPosition` is already called for all of them.

## Logo image fix

Change `.mgl-client-logo img` in `public/css/mapbox-map.css`:

```css
.mgl-client-logo img {
  width:       100%;
  height:      100%;
  object-fit:  contain;
  display:     block;
  opacity:     0.9;
}
```

This fills the container without clipping, regardless of resize.

## `overflow: hidden` fix for leaderboard

The leaderboard's `overflow: hidden` prevents resize handles (positioned at the element boundary) from being visible. **Scope the override to studio mode only** — TV display must retain clipping for the scrolling rows animation:

```css
body.studio-body .mgl-leaderboard { overflow: visible; }
```

The existing `.mgl-leaderboard { overflow: hidden; }` rule stays unchanged.

## CSS for handle (`public/css/mapbox-map.css`)

```css
.mgl-resize-se {
  position:         absolute;
  bottom:           -6px;
  right:            -6px;
  width:            14px;
  height:           14px;
  background:       rgba(253,164,212,0.85);
  border-radius:    3px;
  cursor:           se-resize;
  pointer-events:   auto;
  z-index:          20;
  display:          none;   /* hidden on TV */
}
body.studio-body .mgl-resize-se { display: block; }
```

## Studio wiring

No new studio.js or studio-canvas.js changes. The existing `mgl-overlay-moved` listener in `studio-canvas.js` already writes `e.detail.positions` (including width/height merged by `_saveOverlaySize`) to `wc.mglConfig.overlayPositions` and calls `markDirty()`.

## Files changed

| File | Change |
|---|---|
| `public/js/mapbox-map.js` | Add `_addResizeHandles(el, key)`, `_saveOverlaySize(key, el)`; extend `_applyOverlayPosition`; call `_addResizeHandles` in `_buildLeaderboardDOM` and `_buildOverlayDOM` after `_makeDraggable` |
| `public/css/mapbox-map.css` | `.mgl-resize-se` handle styles; `.mgl-client-logo img` fill fix; `body.studio-body .mgl-leaderboard { overflow: visible; }` |
