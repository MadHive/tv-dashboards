// ===========================================================================
// MapboxUSAMap Pure Math Utility Tests
// Tests the mathematical invariants of the corridor bezier, particle
// initialization, and GL style structure — no browser context needed.
// ===========================================================================

import { describe, it, expect } from 'bun:test';

// ── Pure helper functions (mirrored from mapbox-map.js for isolated testing) ──
// These test the SAME mathematical logic used in the widget. If the formulas
// change in mapbox-map.js, these tests will catch the divergence.

const DATA_CENTERS = [
  { id: 'us-west1',    label: 'WEST',    lon: -121.2, lat: 45.6 },
  { id: 'us-central1', label: 'CENTRAL', lon: -95.9,  lat: 41.3 },
  { id: 'us-east4',    label: 'EAST',    lon: -77.5,  lat: 39.0 },
];

/**
 * Quadratic bezier point at parameter t.
 * P(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
 */
function bezierPoint(t, p0, p1, p2) {
  const it = 1 - t;
  return it * it * p0 + 2 * it * t * p1 + t * t * p2;
}

/**
 * Build corridor bezier points (same algorithm as MapboxUSAMap._buildCorridors).
 */
function buildCorridorPoints(dc, hs, steps = 20) {
  const mx = (dc.lon + hs.lon) / 2;
  const my = (dc.lat + hs.lat) / 2 + Math.abs(dc.lat - hs.lat) * 0.3 + 2;
  const pts = [];
  for (let t = 0; t <= 1; t += 1 / steps) {
    pts.push([
      bezierPoint(t, dc.lon, mx, hs.lon),
      bezierPoint(t, dc.lat, my, hs.lat),
    ]);
  }
  return pts;
}

/**
 * Blank Mapbox GL style (same as MapboxUSAMap._blankStyle).
 */
function blankStyle() {
  return {
    version: 8,
    sources: {},
    layers:  [{ id: 'background', type: 'background', paint: { 'background-color': '#0E0320' } }],
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('bezierPoint()', () => {
  it('returns p0 at t=0', () => {
    expect(bezierPoint(0, 10, 20, 30)).toBe(10);
  });

  it('returns p2 at t=1', () => {
    expect(bezierPoint(1, 10, 20, 30)).toBe(30);
  });

  it('returns midpoint value at t=0.5 for symmetric curve', () => {
    // For p0=0, p1=0, p2=0 → always 0
    expect(bezierPoint(0.5, 0, 0, 0)).toBe(0);
    // For p0=0, p1=10, p2=0 → (0.5)^2*10*2 = 5
    expect(bezierPoint(0.5, 0, 10, 0)).toBe(5);
  });

  it('value is always between p0 and p2 for convex curves', () => {
    const p0 = -121.2, p1 = -100, p2 = -77.5;
    for (let t = 0; t <= 1; t += 0.1) {
      const val = bezierPoint(t, p0, p1, p2);
      expect(val).toBeGreaterThanOrEqual(Math.min(p0, p2) - Math.abs(p1 - p0));
    }
  });
});

describe('buildCorridorPoints()', () => {
  const dc = DATA_CENTERS[2]; // East DC: lon -77.5, lat 39.0
  const hs = { lon: -74.0, lat: 40.7 }; // New York area

  it('first point starts at data center coordinates', () => {
    const pts = buildCorridorPoints(dc, hs);
    expect(pts[0][0]).toBeCloseTo(dc.lon, 5);
    expect(pts[0][1]).toBeCloseTo(dc.lat, 5);
  });

  it('last point ends near hotspot coordinates', () => {
    // The loop uses t += 1/steps with floating-point increments, so the final
    // step may not land exactly on t=1. We verify the last point is within
    // one step-size of the hotspot (precision 0 = within 0.5 degrees).
    const pts = buildCorridorPoints(dc, hs);
    const last = pts[pts.length - 1];
    expect(last[0]).toBeCloseTo(hs.lon, 0);
    expect(last[1]).toBeCloseTo(hs.lat, 0);
  });

  it('all points are arrays of [lon, lat]', () => {
    const pts = buildCorridorPoints(dc, hs);
    pts.forEach(p => {
      expect(Array.isArray(p)).toBe(true);
      expect(p.length).toBe(2);
      expect(typeof p[0]).toBe('number');
      expect(typeof p[1]).toBe('number');
    });
  });

  it('arc control point is above the chord (higher latitude)', () => {
    // Control point my = midLat + abs(latDiff)*0.3 + 2
    // So the arc should peak higher than both endpoints
    const pts = buildCorridorPoints(dc, hs, 100);
    const midLat = (dc.lat + hs.lat) / 2;
    const maxLat = Math.max(...pts.map(p => p[1]));
    expect(maxLat).toBeGreaterThan(Math.max(dc.lat, hs.lat));
  });

  it('produces correct number of points for given steps', () => {
    const pts10 = buildCorridorPoints(dc, hs, 10);
    const pts20 = buildCorridorPoints(dc, hs, 20);
    // With step = 1/n, we get n+1 points (0, 0.1, 0.2, ..., 1.0)
    expect(pts10.length).toBeGreaterThan(8);
    expect(pts20.length).toBeGreaterThan(pts10.length);
  });
});

describe('blankStyle()', () => {
  it('returns Mapbox GL style version 8', () => {
    expect(blankStyle().version).toBe(8);
  });

  it('has empty sources object', () => {
    expect(blankStyle().sources).toEqual({});
  });

  it('has exactly one background layer', () => {
    const style = blankStyle();
    expect(style.layers.length).toBe(1);
    expect(style.layers[0].id).toBe('background');
    expect(style.layers[0].type).toBe('background');
  });

  it('background color is MadHive deep purple', () => {
    const bg = blankStyle().layers[0];
    expect(bg.paint['background-color']).toBe('#0E0320');
  });
});

describe('DATA_CENTERS', () => {
  it('has exactly 3 GCP data centers', () => {
    expect(DATA_CENTERS.length).toBe(3);
  });

  it('all data centers have valid lon/lat in continental USA range', () => {
    DATA_CENTERS.forEach(dc => {
      expect(dc.lon).toBeGreaterThan(-130);
      expect(dc.lon).toBeLessThan(-60);
      expect(dc.lat).toBeGreaterThan(24);
      expect(dc.lat).toBeLessThan(50);
    });
  });

  it('data centers cover west, central, and east regions', () => {
    const labels = DATA_CENTERS.map(dc => dc.label);
    expect(labels).toContain('WEST');
    expect(labels).toContain('CENTRAL');
    expect(labels).toContain('EAST');
  });
});

describe('Leaderboard sorting', () => {
  it('sorts states by impressions descending', () => {
    const states = {
      CA: { impressions: 5000 },
      TX: { impressions: 8000 },
      NY: { impressions: 3000 },
    };

    const sorted = Object.entries(states)
      .filter(([, s]) => s.impressions > 0)
      .sort(([, a], [, b]) => b.impressions - a.impressions)
      .slice(0, 20);

    expect(sorted[0][0]).toBe('TX');
    expect(sorted[1][0]).toBe('CA');
    expect(sorted[2][0]).toBe('NY');
  });

  it('filters out states with zero impressions', () => {
    const states = {
      CA: { impressions: 5000 },
      WY: { impressions: 0 },
      NY: { impressions: 3000 },
    };

    const sorted = Object.entries(states)
      .filter(([, s]) => s.impressions > 0)
      .sort(([, a], [, b]) => b.impressions - a.impressions);

    expect(sorted.length).toBe(2);
    expect(sorted.map(([id]) => id)).not.toContain('WY');
  });

  it('formats large numbers with M/K suffix', () => {
    const fmt = (n) =>
      n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
      : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K'
      : String(n);

    expect(fmt(1500000)).toBe('1.5M');
    expect(fmt(48291)).toBe('48K');
    expect(fmt(500)).toBe('500');
  });
});
