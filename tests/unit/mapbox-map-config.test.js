// ===========================================================================
// MapboxUSAMap config logic tests — TDD
// Pure functions mirrored from mapbox-map.js for isolated testing.
// ===========================================================================

import { describe, it, expect } from 'bun:test';

// ── Mirror of mapbox-map.js config logic ────────────────────────────────────

function buildMapConfig(userConfig) {
  return {
    particleCount:   120,
    particleSpeed:   1.0,
    colorScheme:     'brand',
    showLeaderboard: true,
    mapStyle:        'brand',
    zoomViz:         'dots',
    ...(userConfig || {}),
  };
}

const SCHEME_COLORS = {
  brand: { particleNormal: '#67E8F9', particleFast: '#FDA4D4', stateGlowHigh: '#FDA4D4' },
  cool:  { particleNormal: '#60A5FA', particleFast: '#FFFFFF', stateGlowHigh: '#e0f2fe' },
  warm:  { particleNormal: '#fbbf24', particleFast: '#FF6B35', stateGlowHigh: '#fef08a' },
};

function getColorScheme(name) {
  return SCHEME_COLORS[name] || SCHEME_COLORS.brand;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('buildMapConfig()', () => {
  it('returns all defaults when nothing provided', () => {
    const cfg = buildMapConfig(undefined);
    expect(cfg.particleCount).toBe(120);
    expect(cfg.particleSpeed).toBe(1.0);
    expect(cfg.colorScheme).toBe('brand');
    expect(cfg.showLeaderboard).toBe(true);
  });

  it('merges user values over defaults', () => {
    const cfg = buildMapConfig({ particleCount: 60, colorScheme: 'cool' });
    expect(cfg.particleCount).toBe(60);
    expect(cfg.colorScheme).toBe('cool');
    expect(cfg.particleSpeed).toBe(1.0);
    expect(cfg.showLeaderboard).toBe(true);
  });

  it('preserves all defaults when empty object provided', () => {
    const cfg = buildMapConfig({});
    expect(cfg.particleCount).toBe(120);
    expect(cfg.showLeaderboard).toBe(true);
  });

  it('accepts showLeaderboard: false', () => {
    const cfg = buildMapConfig({ showLeaderboard: false });
    expect(cfg.showLeaderboard).toBe(false);
  });

  it('accepts custom particleSpeed', () => {
    const cfg = buildMapConfig({ particleSpeed: 1.8 });
    expect(cfg.particleSpeed).toBe(1.8);
  });
});

describe('getColorScheme()', () => {
  it('brand has cyan normal particles and pink fast particles', () => {
    const s = getColorScheme('brand');
    expect(s.particleNormal).toBe('#67E8F9');
    expect(s.particleFast).toBe('#FDA4D4');
  });

  it('cool has blue normal particles and white fast particles', () => {
    const s = getColorScheme('cool');
    expect(s.particleNormal).toBe('#60A5FA');
    expect(s.particleFast).toBe('#FFFFFF');
  });

  it('warm has gold normal particles and orange fast particles', () => {
    const s = getColorScheme('warm');
    expect(s.particleNormal).toBe('#fbbf24');
    expect(s.particleFast).toBe('#FF6B35');
  });

  it('falls back to brand for unknown scheme name', () => {
    const s = getColorScheme('unknown');
    expect(s.particleNormal).toBe('#67E8F9');
    expect(s.particleFast).toBe('#FDA4D4');
  });

  it('all schemes define particleNormal, particleFast, stateGlowHigh', () => {
    ['brand', 'cool', 'warm'].forEach(name => {
      const s = getColorScheme(name);
      expect(typeof s.particleNormal).toBe('string');
      expect(typeof s.particleFast).toBe('string');
      expect(typeof s.stateGlowHigh).toBe('string');
    });
  });
});

describe('buildMapConfig() — new boundary fields', () => {
  it('defaults mapStyle to brand', () => {
    expect(buildMapConfig(undefined).mapStyle).toBe('brand');
  });

  it('defaults zoomViz to dots', () => {
    expect(buildMapConfig(undefined).zoomViz).toBe('dots');
  });

  it('accepts mapStyle: mapbox', () => {
    expect(buildMapConfig({ mapStyle: 'mapbox' }).mapStyle).toBe('mapbox');
  });

  it('accepts zoomViz: heatmap', () => {
    expect(buildMapConfig({ zoomViz: 'heatmap' }).zoomViz).toBe('heatmap');
  });
});
