# Map Overlay Resize Design

**Date:** 2026-03-19
**Status:** Approved

## Overview

Extend the existing drag-to-position system to also support resize. Corner handles appear on each overlay in Studio mode. Resizing saves `width`/`height` alongside `top`/`left` in `mglConfig.overlayPositions`. TV display applies saved sizes at load time.

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

## Resize handles (`public/js/mapbox-map.js`)

**`_addResizeHandles(el, key)`** — called in studio mode after `_makeDraggable()`, for each overlay.

Creates four corner handles (`se`, `sw`, `ne`, `nw`) as small `<div>` children. Each handle:
- `position: absolute`; positioned at the corner
- `width: 12px; height: 12px`
- `cursor: se-resize` (or appropriate corner cursor)
- `pointer-events: auto`; `z-index: 20`

**Resize drag mechanic** (pointer events on each handle):
- `pointerdown`: capture pointer; record `startW = el.offsetWidth`, `startH = el.offsetHeight`, `startX = e.clientX`, `startY = e.clientY`
- `pointermove`: compute delta; update `el.style.width` / `el.style.height`; clamp minimum 80px width, 40px height; clamp maximum to container bounds
- `pointerup`: release capture; call `_saveOverlaySize(key, el)`; dispatch `mgl-overlay-moved` (same event, same listener in studio-canvas.js — `e.detail.positions` already captures all stored positions including size)

**`_saveOverlaySize(key, el)`** — updates `this._overlayPositions[key]` by merging `width`/`height`:
```js
_saveOverlaySize(key, el) {
  if (!this._overlayPositions) this._overlayPositions = {};
  if (!this._overlayPositions[key]) this._overlayPositions[key] = {};
  this._overlayPositions[key].width  = el.style.width;
  this._overlayPositions[key].height = el.style.height || undefined;
}
```

## Apply saved sizes on load

Extend `_applyOverlayPosition(el, key)` — after setting `top`/`left`, also apply `width` and `height` if present:
```js
if (pos.width)  el.style.width  = pos.width;
if (pos.height) el.style.height = pos.height;
```

## Logo image fix

`.mgl-client-logo img` currently has `height: 32px; width: auto`. Change to:
```css
.mgl-client-logo img {
  width:  100%;
  height: 100%;
  object-fit: contain;
  display: block;
  opacity: 0.9;
}
```

This makes the image fill the container without clipping, regardless of how it's been resized.

Also remove `overflow: hidden` from `.mgl-leaderboard` so the resize handles (which sit outside the element's natural content area) are not clipped.

## CSS for handles (`public/css/mapbox-map.css`)

```css
.mgl-resize-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: rgba(253,164,212,0.8);
  border-radius: 2px;
  z-index: 20;
  pointer-events: auto;
}
.mgl-resize-handle.se { bottom: -6px; right:  -6px; cursor: se-resize; }
.mgl-resize-handle.sw { bottom: -6px; left:   -6px; cursor: sw-resize; }
.mgl-resize-handle.ne { top:    -6px; right:  -6px; cursor: ne-resize; }
.mgl-resize-handle.nw { top:    -6px; left:   -6px; cursor: nw-resize; }
/* Only visible in studio mode */
.mgl-resize-handle { display: none; }
body.studio-body .mgl-resize-handle { display: block; }
```

## Studio wiring

No new studio.js changes needed — the existing `mgl-overlay-moved` listener already picks up `e.detail.positions` which includes the updated width/height via `_saveOverlaySize`. The `markDirty()` call fires on every resize drop.

The existing `_applyOverlayPosition` extension handles the load-time application.

## Files changed

| File | Change |
|---|---|
| `public/js/mapbox-map.js` | `_addResizeHandles(el, key)`, `_saveOverlaySize(key, el)`; extend `_applyOverlayPosition` to apply width/height; call `_addResizeHandles` in `_buildLeaderboardDOM` and `_buildOverlayDOM` after `_makeDraggable` |
| `public/css/mapbox-map.css` | `.mgl-resize-handle` styles; fix `.mgl-client-logo img`; remove `overflow:hidden` from `.mgl-leaderboard` |
