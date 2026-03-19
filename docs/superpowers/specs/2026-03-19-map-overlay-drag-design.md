# Map Overlay Drag-to-Position Design

**Date:** 2026-03-19
**Status:** Approved

## Overview

Make all four map overlay types draggable in the Studio. Positions persist to `mglConfig.overlayPositions` in `dashboards.yaml` and are applied at load time on both the Studio and TV display.

## Draggable Overlays

| Overlay | DOM class | Current CSS anchor |
|---|---|---|
| Leaderboard | `.mgl-leaderboard` | `top:12px right:12px bottom:12px width:340px` |
| Total overlay | `.mgl-total-overlay` | `bottom:16px left:16px` |
| Region panels | `.mgl-region-panel` × 3 | inline absolute positioned |
| Client logo | `.mgl-client-logo` | `top:18px left:18px` |

## Position Storage

Positions are stored in `mglConfig.overlayPositions` (flat object on `mglConfig`):

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

All positions use `top` + `left` (converted from any anchor on first drag). This flows through the existing `mglConfig` path: saved to `dashboards.yaml` widget config, served by `/api/config`, read by `buildMapConfig()`.

## Drag Mechanics (`public/js/mapbox-map.js`)

**Studio detection:** `document.body.classList.contains('studio-body')`

**Enable dragging (studio only):**
- `pointer-events: auto` on each overlay element
- `cursor: grab` on hover, `cursor: grabbing` while dragging
- Subtle dashed border on hover to signal draggability

**Drag events:** `pointerdown` → `pointermove` (on `document`) → `pointerup`
- On `pointerdown`: record `startX = e.clientX - el.offsetLeft`, `startY = e.clientY - el.offsetTop`; call `el.setPointerCapture(e.pointerId)`
- On `pointermove`: `el.style.left = (e.clientX - startX) + 'px'`; `el.style.top = (e.clientY - startY) + 'px'`
- On `pointerup`: clamp to container bounds; dispatch `CustomEvent('mgl-overlay-moved', { detail: { positions } })` on `this._wrap`

**Converting anchors on first drag:** The leaderboard uses `right/top/bottom`; when dragging starts, compute equivalent `top/left` from `getBoundingClientRect()` relative to the container and switch to those.

**Clamp to bounds:** positions clamped so overlay stays within the `mgl-container` div (no dragging off-screen).

## Apply Saved Positions

In `_buildLeaderboardDOM()`, `_buildOverlayDOM()`, and `_buildLeaderboardDOM()` (client logo): after creating each element, check `this._cfg.overlayPositions[key]` and apply `el.style.top`/`el.style.left` if set.

## Studio Integration (`public/js/studio.js`)

In the `Widgets.create()` call path for `usa-map-gl` widgets in studio mode, attach a one-time listener on the map wrapper for `mgl-overlay-moved`. On fire:
1. Update `wc.mglConfig.overlayPositions = event.detail.positions`
2. Call `this.markDirty()`

The Studio Properties panel for Map GL Config gets a **"Reset Positions"** button that clears `mglConfig.overlayPositions` and re-renders the widget.

## CSS (`public/css/mapbox-map.css`)

```css
/* Studio drag affordances — only active when body.studio-body is present */
body.studio-body .mgl-leaderboard,
body.studio-body .mgl-total-overlay,
body.studio-body .mgl-region-panel,
body.studio-body .mgl-client-logo {
  pointer-events: auto;
  cursor: grab;
}
body.studio-body .mgl-leaderboard:hover,
body.studio-body .mgl-total-overlay:hover,
body.studio-body .mgl-region-panel:hover,
body.studio-body .mgl-client-logo:hover {
  outline: 1px dashed rgba(253,164,212,0.5);
}
```

The CSS `pointer-events: none` rules on individual overlays are already the default; the studio-body selector overrides them.

## Files Changed

| File | Change |
|---|---|
| `public/js/mapbox-map.js` | `_makeDraggable()` helper; apply positions in `_buildLeaderboardDOM` + `_buildOverlayDOM`; dispatch `mgl-overlay-moved` |
| `public/css/mapbox-map.css` | Studio drag affordance CSS; remove `pointer-events:none` from overlays (move to non-studio default) |
| `public/js/studio.js` | Listen for `mgl-overlay-moved`; update `wc.mglConfig.overlayPositions`; markDirty; add Reset Positions button binding |
| `public/studio.html` | Add "Reset Positions" button in Map GL Config section |
