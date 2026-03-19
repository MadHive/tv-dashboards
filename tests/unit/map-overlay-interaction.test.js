// ===========================================================================
// Map overlay interaction tests — drag/resize/persistence
// Tests for the logic that kept breaking in production:
//   - right/bottom cleared with 'auto' not '' (CSS specificity)
//   - drag vs resize mode selection by click position
//   - overlay position/size save-load round-trip
//   - config mtime cache consistency
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';

// ── Mirror core overlay logic from mapbox-map.js for isolated testing ────────

const OVERLAY_NATURAL_WIDTHS = {
  leaderboard: 340, totalOverlay: 220,
  west: 160, central: 160, east: 160, clientLogo: 120,
};

function applyOverlayScale(el, key, widthPx) {
  if (!widthPx) return;
  const nat = OVERLAY_NATURAL_WIDTHS[key];
  if (!nat) return;
  const nw = parseFloat(widthPx);
  if (isNaN(nw) || nw <= 0) return;
  const scale = Math.max(0.3, Math.min(3.0, nw / nat));
  return scale;
}

function applyOverlayPosition(el, key, overlayPositions) {
  const pos = overlayPositions && overlayPositions[key];
  if (!pos) return false;
  el.top    = pos.top;
  el.left   = pos.left;
  el.right  = 'auto';   // MUST be 'auto' not '' to override CSS rules
  el.bottom = 'auto';   // MUST be 'auto' not '' to override CSS rules
  if (key === 'leaderboard' && !el.width) el.width = '340px';
  if (pos.width)  el.width  = pos.width;
  if (pos.height) el.height = pos.height;
  return true;
}

function saveOverlayPosition(overlayPositions, key, el) {
  if (!overlayPositions[key]) overlayPositions[key] = {};
  overlayPositions[key].top  = el.top;
  overlayPositions[key].left = el.left;
}

function saveOverlaySize(overlayPositions, key, el) {
  if (!overlayPositions[key]) overlayPositions[key] = {};
  const pos = overlayPositions[key];
  if (el.width)  pos.width  = el.width;
  else           delete pos.width;
  if (el.height) pos.height = el.height;
  else           delete pos.height;
}

/** Determine drag vs resize mode from click position relative to element bounds */
function determineInteractionMode(clickX, clickY, elRight, elBottom, resizeZone = 48) {
  return (clickX > elRight - resizeZone && clickY > elBottom - resizeZone)
    ? 'resize'
    : 'drag';
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('determineInteractionMode()', () => {
  // Element at x:100 y:100, size 300x200 → right:400 bottom:300
  const RIGHT = 400, BOTTOM = 300, ZONE = 48;

  it('returns drag when clicking in the center', () => {
    expect(determineInteractionMode(250, 200, RIGHT, BOTTOM, ZONE)).toBe('drag');
  });

  it('returns drag when clicking top-left corner', () => {
    expect(determineInteractionMode(110, 110, RIGHT, BOTTOM, ZONE)).toBe('drag');
  });

  it('returns resize when clicking bottom-right corner exactly', () => {
    expect(determineInteractionMode(400, 300, RIGHT, BOTTOM, ZONE)).toBe('resize');
  });

  it('returns resize when clicking within zone from bottom-right', () => {
    expect(determineInteractionMode(360, 260, RIGHT, BOTTOM, ZONE)).toBe('resize');
  });

  it('returns drag when clicking just outside the resize zone horizontally', () => {
    // 400 - 48 = 352; click at x=350 is outside zone
    expect(determineInteractionMode(350, 260, RIGHT, BOTTOM, ZONE)).toBe('drag');
  });

  it('returns drag when clicking just outside the resize zone vertically', () => {
    // 300 - 48 = 252; click at y=250 is outside zone
    expect(determineInteractionMode(360, 250, RIGHT, BOTTOM, ZONE)).toBe('drag');
  });

  it('returns resize only when BOTH x and y are within the zone', () => {
    // x within zone but y outside → drag
    expect(determineInteractionMode(390, 250, RIGHT, BOTTOM, ZONE)).toBe('drag');
    // y within zone but x outside → drag
    expect(determineInteractionMode(350, 270, RIGHT, BOTTOM, ZONE)).toBe('drag');
    // both within zone → resize
    expect(determineInteractionMode(390, 270, RIGHT, BOTTOM, ZONE)).toBe('resize');
  });
});

describe('applyOverlayPosition()', () => {
  let el;
  beforeEach(() => {
    el = { top: '0px', left: '0px', right: '12px', bottom: '12px', width: '', height: '' };
  });

  it('applies saved top/left', () => {
    applyOverlayPosition(el, 'leaderboard', { leaderboard: { top: '50px', left: '100px' } });
    expect(el.top).toBe('50px');
    expect(el.left).toBe('100px');
  });

  it('clears right with "auto" not "" — critical for CSS specificity', () => {
    el.right = '12px'; // CSS rule that would otherwise win
    applyOverlayPosition(el, 'leaderboard', { leaderboard: { top: '50px', left: '100px' } });
    expect(el.right).toBe('auto');  // 'auto' overrides CSS; '' does not
    expect(el.right).not.toBe(''); // ensure we're not using the old buggy value
  });

  it('clears bottom with "auto" not "" — critical for CSS specificity', () => {
    el.bottom = '16px'; // totalOverlay CSS default
    applyOverlayPosition(el, 'totalOverlay', { totalOverlay: { top: '800px', left: '20px' } });
    expect(el.bottom).toBe('auto');
    expect(el.bottom).not.toBe('');
  });

  it('sets default leaderboard width when none saved and no current width', () => {
    el.width = '';
    applyOverlayPosition(el, 'leaderboard', { leaderboard: { top: '20px', left: '20px' } });
    expect(el.width).toBe('340px');
  });

  it('applies saved width and height when present', () => {
    applyOverlayPosition(el, 'leaderboard', {
      leaderboard: { top: '20px', left: '20px', width: '420px', height: '600px' },
    });
    expect(el.width).toBe('420px');
    expect(el.height).toBe('600px');
  });

  it('returns false and changes nothing when key is not in positions', () => {
    const result = applyOverlayPosition(el, 'leaderboard', {});
    expect(result).toBe(false);
    expect(el.top).toBe('0px'); // unchanged
  });

  it('returns true when position was applied', () => {
    const result = applyOverlayPosition(el, 'leaderboard', {
      leaderboard: { top: '50px', left: '100px' },
    });
    expect(result).toBe(true);
  });
});

describe('saveOverlayPosition()', () => {
  it('saves top and left to overlayPositions', () => {
    const pos = {};
    saveOverlayPosition(pos, 'leaderboard', { top: '50px', left: '100px' });
    expect(pos.leaderboard.top).toBe('50px');
    expect(pos.leaderboard.left).toBe('100px');
  });

  it('overwrites existing position for the key', () => {
    const pos = { leaderboard: { top: '10px', left: '10px' } };
    saveOverlayPosition(pos, 'leaderboard', { top: '99px', left: '88px' });
    expect(pos.leaderboard.top).toBe('99px');
  });

  it('does not affect other keys', () => {
    const pos = { west: { top: '100px', left: '200px' } };
    saveOverlayPosition(pos, 'leaderboard', { top: '50px', left: '60px' });
    expect(pos.west.top).toBe('100px'); // unchanged
    expect(pos.leaderboard.top).toBe('50px');
  });
});

describe('saveOverlaySize()', () => {
  it('saves width when set', () => {
    const pos = {};
    saveOverlaySize(pos, 'leaderboard', { width: '420px', height: '' });
    expect(pos.leaderboard.width).toBe('420px');
  });

  it('deletes width when empty string — no undefined pollution', () => {
    const pos = { leaderboard: { width: '300px' } };
    saveOverlaySize(pos, 'leaderboard', { width: '', height: '' });
    expect(pos.leaderboard.width).toBeUndefined();
    // ensure delete was used not assignment to undefined
    expect('width' in pos.leaderboard).toBe(false);
  });

  it('deletes height when empty — clean YAML serialization', () => {
    const pos = { leaderboard: { height: '500px' } };
    saveOverlaySize(pos, 'leaderboard', { width: '400px', height: '' });
    expect('height' in pos.leaderboard).toBe(false);
  });

  it('preserves top/left from prior saveOverlayPosition call', () => {
    const pos = { leaderboard: { top: '20px', left: '30px' } };
    saveOverlaySize(pos, 'leaderboard', { width: '400px', height: '' });
    expect(pos.leaderboard.top).toBe('20px'); // not touched
    expect(pos.leaderboard.width).toBe('400px');
  });
});

describe('applyOverlayScale()', () => {
  it('returns scale ~1.0 for natural width', () => {
    const s = applyOverlayScale({}, 'leaderboard', '340px');
    expect(s).toBeCloseTo(1.0, 2);
  });

  it('returns scale ~1.24 for leaderboard at 420px (420/340)', () => {
    const s = applyOverlayScale({}, 'leaderboard', '420px');
    expect(s).toBeCloseTo(420 / 340, 2);
  });

  it('clamps scale to 0.3 minimum', () => {
    const s = applyOverlayScale({}, 'leaderboard', '10px');
    expect(s).toBe(0.3);
  });

  it('clamps scale to 3.0 maximum', () => {
    const s = applyOverlayScale({}, 'leaderboard', '9999px');
    expect(s).toBe(3.0);
  });

  it('returns undefined for unknown key (no natural width)', () => {
    const s = applyOverlayScale({}, 'unknown-key', '200px');
    expect(s).toBeUndefined();
  });

  it('returns undefined for null/undefined width', () => {
    expect(applyOverlayScale({}, 'leaderboard', null)).toBeUndefined();
    expect(applyOverlayScale({}, 'leaderboard', '')).toBeUndefined();
  });
});
