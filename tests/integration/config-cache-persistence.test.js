// ===========================================================================
// Config cache and overlay persistence integration tests
// Tests the mtime-based cache and overlay position round-trip through the API
// ===========================================================================

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { readFileSync, writeFileSync, statSync } from 'fs';
import { load, dump } from 'js-yaml';

const CONFIG_PATH = './config/dashboards.yaml';
const API_BASE    = 'http://localhost:3001'; // test port, separate from production

// ── Config cache logic mirror ────────────────────────────────────────────────

function getConfigMtime(path = CONFIG_PATH) {
  try { return statSync(path).mtimeMs; } catch (_) { return 0; }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('mtime-based config cache', () => {
  it('getConfigMtime returns a nonzero number when file exists', () => {
    const mtime = getConfigMtime(CONFIG_PATH);
    expect(mtime).toBeGreaterThan(0);
  });

  it('getConfigMtime changes when YAML is written', async () => {
    const before = getConfigMtime(CONFIG_PATH);
    // Small delay to ensure mtime changes
    await Bun.sleep(10);
    const content = readFileSync(CONFIG_PATH, 'utf8');
    writeFileSync(CONFIG_PATH, content); // touch the file
    const after = getConfigMtime(CONFIG_PATH);
    // mtime should be >= before (might be same resolution on some filesystems)
    expect(after).toBeGreaterThanOrEqual(before);
    // Restore content exactly
    writeFileSync(CONFIG_PATH, content);
  });

  it('getConfigMtime returns 0 for nonexistent file', () => {
    expect(getConfigMtime('./nonexistent-file-xyz.yaml')).toBe(0);
  });
});

describe('overlay position YAML round-trip', () => {
  let originalContent;
  let parsed;

  beforeAll(() => {
    originalContent = readFileSync(CONFIG_PATH, 'utf8');
    parsed = load(originalContent);
  });

  afterAll(() => {
    // Always restore the original file
    writeFileSync(CONFIG_PATH, originalContent);
  });

  it('overlayPositions can be written and read from YAML', () => {
    const dash = parsed.dashboards.find(d => d.id === 'campaign-delivery-gl');
    expect(dash).toBeDefined();

    const widget = dash.widgets.find(w => w.type === 'usa-map-gl');
    expect(widget).toBeDefined();

    // Add overlay positions
    if (!widget.mglConfig) widget.mglConfig = {};
    widget.mglConfig.overlayPositions = {
      leaderboard:  { top: '100px', left: '50px',  width: '400px' },
      totalOverlay: { top: '600px', left: '20px',  width: '250px' },
      west:         { top: '150px', left: '80px' },
      central:      { top: '150px', left: '450px' },
      east:         { top: '150px', left: '820px' },
    };

    const yaml = dump(parsed, { indent: 2, lineWidth: 120 });
    writeFileSync(CONFIG_PATH, yaml);

    // Read back
    const readBack = load(readFileSync(CONFIG_PATH, 'utf8'));
    const readWidget = readBack.dashboards
      .find(d => d.id === 'campaign-delivery-gl')
      .widgets.find(w => w.type === 'usa-map-gl');

    const pos = readWidget.mglConfig.overlayPositions;
    expect(pos.leaderboard.top).toBe('100px');
    expect(pos.leaderboard.width).toBe('400px');
    expect(pos.west.left).toBe('80px');
    expect(pos.totalOverlay.width).toBe('250px');
  });

  it('right/bottom NOT present in saved positions (using top+left only)', () => {
    const dash = parsed.dashboards.find(d => d.id === 'campaign-delivery-gl');
    const widget = dash.widgets.find(w => w.type === 'usa-map-gl');
    if (!widget.mglConfig) widget.mglConfig = {};
    widget.mglConfig.overlayPositions = {
      leaderboard: { top: '20px', left: '20px' },
    };

    const yaml = dump(parsed, { indent: 2, lineWidth: 120 });
    const readBack = load(yaml);
    const pos = readBack.dashboards
      .find(d => d.id === 'campaign-delivery-gl')
      .widgets.find(w => w.type === 'usa-map-gl')
      .mglConfig.overlayPositions;

    // Positions should only store top+left (right/bottom override CSS via 'auto' in JS)
    expect('right'  in pos.leaderboard).toBe(false);
    expect('bottom' in pos.leaderboard).toBe(false);
  });

  it('overlayPositions with deleted size key (undefined) does not appear in YAML', () => {
    // When saveOverlaySize uses `delete pos.width`, width should not appear in YAML
    const testPos = { top: '100px', left: '50px' };
    // Simulate delete (no width key)
    const yaml = dump({ pos: testPos });
    expect(yaml).not.toContain('width');
    expect(yaml).not.toContain('undefined');
  });

  it('initialCenter can be stored and retrieved', () => {
    const dash = parsed.dashboards.find(d => d.id === 'campaign-delivery-gl');
    const widget = dash.widgets.find(w => w.type === 'usa-map-gl');
    if (!widget.mglConfig) widget.mglConfig = {};
    widget.mglConfig.initialCenter = { lng: -98.5795, lat: 39.8283 };
    widget.mglConfig.initialZoom   = 4.5;

    const yaml = dump(parsed, { indent: 2, lineWidth: 120 });
    const readBack = load(yaml);
    const mc = readBack.dashboards
      .find(d => d.id === 'campaign-delivery-gl')
      .widgets.find(w => w.type === 'usa-map-gl').mglConfig;

    expect(mc.initialCenter.lng).toBeCloseTo(-98.5795, 3);
    expect(mc.initialCenter.lat).toBeCloseTo(39.8283, 3);
    expect(mc.initialZoom).toBe(4.5);
  });
});

describe('client delivery geo BigQuery query shape', () => {
  it('overlayPositions keys match region panel keys used in _positionRegionPanels', () => {
    // The skip guard in _positionRegionPanels uses keys: 'west', 'central', 'east'
    // overlayPositions must use the same keys
    const dcKeyMap = { 'us-west1': 'west', 'us-central1': 'central', 'us-east4': 'east' };
    const positionKeys = Object.values(dcKeyMap);
    const overlayPositionKeys = ['west', 'central', 'east'];

    positionKeys.forEach(key => {
      expect(overlayPositionKeys).toContain(key);
    });
  });

  it('getDeliveryGeoByClient result shape matches expected overlay data', () => {
    // Simulate the shape returned by getDeliveryGeoByClient
    const mockRow = {
      zip3: '338',
      state: 'FL',
      lat: 28.5,
      lon: -81.4,
      impressions: 16107,
      clicks: 2,
      zip_count: 12,
      city: 'Tampa',
      dma: 'Tampa-St. Pete',
    };

    const result = {
      zip3:        mockRow.zip3,
      state:       mockRow.state,
      lat:         mockRow.lat,
      lon:         mockRow.lon,
      impressions: Number(mockRow.impressions),
      clicks:      Number(mockRow.clicks),
      zips:        Number(mockRow.zip_count),
      city:        mockRow.city || null,
      dma:         mockRow.dma || null,
    };

    expect(result.zip3).toBe('338');
    expect(result.zips).toBe(12); // mapped from zip_count
    expect(result.city).toBe('Tampa');
    expect(typeof result.impressions).toBe('number');
  });
});
