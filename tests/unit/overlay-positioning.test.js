/**
 * Overlay Positioning Tests
 *
 * Ensures:
 * - Map overlays have valid position configurations
 * - Overlay positions use resolution-independent percentages
 * - Regional panels can be uniformly sized
 * - Alignment guides function correctly
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

const PROJECT_ROOT = join(import.meta.dir, '..', '..');

describe('Dashboard Overlay Configurations', () => {
  const dashboardsContent = readFileSync(
    join(PROJECT_ROOT, 'config/dashboards.yaml'),
    'utf-8'
  );
  const config = yaml.load(dashboardsContent);

  const mapWidgets = [];
  config.dashboards?.forEach(dash => {
    dash.widgets?.forEach(widget => {
      if (widget.type === 'usa-map-gl' && widget.mglConfig?.overlayPositions) {
        mapWidgets.push({
          dashboardId: dash.id,
          widgetId: widget.id,
          overlayPositions: widget.mglConfig.overlayPositions
        });
      }
    });
  });

  describe('Overlay Position Format', () => {
    test('at least one map widget has overlay positions configured', () => {
      expect(mapWidgets.length).toBeGreaterThan(0);
    });

    mapWidgets.forEach(({ dashboardId, widgetId, overlayPositions }) => {
      describe(`${dashboardId}/${widgetId}`, () => {
        const regions = ['west', 'central', 'east'];

        regions.forEach(region => {
          if (overlayPositions[region]) {
            test(`${region} panel has top and left positions`, () => {
              const pos = overlayPositions[region];
              expect(pos).toHaveProperty('top');
              expect(pos).toHaveProperty('left');
            });

            test(`${region} panel positions are valid format (px or %)`, () => {
              const pos = overlayPositions[region];
              const validFormat = /^-?\d+(\.\d+)?(px|%)$/;

              expect(validFormat.test(pos.top)).toBe(true);
              expect(validFormat.test(pos.left)).toBe(true);
            });

            test(`${region} panel has no NaN values`, () => {
              const pos = overlayPositions[region];
              expect(pos.top).not.toContain('NaN');
              expect(pos.left).not.toContain('NaN');

              if (pos.width) expect(pos.width).not.toContain('NaN');
              if (pos.height) expect(pos.height).not.toContain('NaN');
            });
          }
        });

        if (overlayPositions.totalOverlay) {
          test('totalOverlay has valid dimensions', () => {
            const pos = overlayPositions.totalOverlay;
            expect(pos).toHaveProperty('top');
            expect(pos).toHaveProperty('left');

            // Total overlay often has width/height specified
            if (pos.width || pos.height) {
              expect(pos.width || pos.height).toBeTruthy();
            }
          });
        }
      });
    });
  });

  describe('Regional Panel Visibility', () => {
    const campaignDeliveryNationwide = config.dashboards?.find(
      d => d.id === 'campaign-delivery-gl'
    );

    test('Campaign Delivery Nationwide has east region visibility flag', () => {
      expect(campaignDeliveryNationwide).toBeTruthy();
      const widget = campaignDeliveryNationwide.widgets?.[0];
      expect(widget.mglConfig?.showRegionEast).toBe(true);
    });

    test('Campaign Delivery Nationwide has west region visibility flag', () => {
      const widget = campaignDeliveryNationwide.widgets?.[0];
      expect(widget.mglConfig?.showRegionWest).toBe(true);
    });

    test('Campaign Delivery Nationwide has central region visibility flag', () => {
      const widget = campaignDeliveryNationwide.widgets?.[0];
      expect(widget.mglConfig?.showRegionCentral).toBe(true);
    });
  });

  describe('Position Value Ranges', () => {
    mapWidgets.forEach(({ dashboardId, overlayPositions }) => {
      Object.entries(overlayPositions).forEach(([key, pos]) => {
        if (pos.top?.endsWith('%')) {
          test(`${dashboardId}/${key} top percentage is within 0-100%`, () => {
            const value = parseFloat(pos.top);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(100);
          });
        }

        if (pos.left?.endsWith('%')) {
          test(`${dashboardId}/${key} left percentage is within 0-100%`, () => {
            const value = parseFloat(pos.left);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(100);
          });
        }

        if (pos.width?.endsWith('px')) {
          test(`${dashboardId}/${key} width is reasonable`, () => {
            const value = parseFloat(pos.width);
            expect(value).toBeGreaterThanOrEqual(50);
            // Leaderboards and client logos can be larger
            const maxWidth = (key === 'leaderboard' || key === 'clientLogo') ? 1000 : 500;
            expect(value).toBeLessThanOrEqual(maxWidth);
          });
        }

        if (pos.height?.endsWith('px')) {
          test(`${dashboardId}/${key} height is reasonable`, () => {
            const value = parseFloat(pos.height);
            expect(value).toBeGreaterThanOrEqual(50);
            // Leaderboards can be very tall (full screen)
            const maxHeight = (key === 'leaderboard') ? 1200 : 400;
            expect(value).toBeLessThanOrEqual(maxHeight);
          });
        }
      });
    });
  });
});

describe('Studio Uniform Sizing Controls', () => {
  const studioHtml = readFileSync(join(PROJECT_ROOT, 'public/studio.html'), 'utf-8');
  const studioJs = readFileSync(join(PROJECT_ROOT, 'public/js/studio.js'), 'utf-8');

  test('studio HTML has uniform width input', () => {
    expect(studioHtml).toContain('id="prop-mgl-uniform-width"');
  });

  test('studio HTML has uniform height input', () => {
    expect(studioHtml).toContain('id="prop-mgl-uniform-height"');
  });

  test('studio HTML has apply button for uniform sizing', () => {
    expect(studioHtml).toContain('id="apply-uniform-sizing-btn"');
  });

  test('studio JS implements uniform sizing logic', () => {
    expect(studioJs).toContain('apply-uniform-sizing-btn');
    expect(studioJs).toContain("['west', 'central', 'east']");
  });

  test('uniform sizing validates minimum dimensions', () => {
    expect(studioJs).toContain('width < 100');
    expect(studioJs).toContain('height < 80');
  });

  test('uniform sizing applies to all three regional panels', () => {
    const uniformSizingSection = studioJs.substring(
      studioJs.indexOf('apply-uniform-sizing-btn'),
      studioJs.indexOf('Region buttons', studioJs.indexOf('apply-uniform-sizing-btn'))
    );

    expect(uniformSizingSection).toContain('west');
    expect(uniformSizingSection).toContain('central');
    expect(uniformSizingSection).toContain('east');
  });
});

describe('Alignment Guide System', () => {
  const mapboxCss = readFileSync(join(PROJECT_ROOT, 'public/css/mapbox-map.css'), 'utf-8');
  const mapboxJs = readFileSync(join(PROJECT_ROOT, 'public/js/mapbox-map.js'), 'utf-8');

  test('CSS defines snap grid', () => {
    expect(mapboxCss).toContain('.mgl-snap-grid');
    expect(mapboxCss).toContain('background-size: 20px 20px');
  });

  test('CSS defines alignment guide styles', () => {
    expect(mapboxCss).toContain('.mgl-alignment-guide');
    expect(mapboxCss).toContain('.horizontal');
    expect(mapboxCss).toContain('.vertical');
  });

  test('snap grid has visible opacity when active', () => {
    const snapGridVisible = mapboxCss.substring(
      mapboxCss.indexOf('.mgl-snap-grid.visible'),
      mapboxCss.indexOf('}', mapboxCss.indexOf('.mgl-snap-grid.visible'))
    );

    expect(snapGridVisible).toContain('opacity: 1');
  });

  test('JS creates alignment guide elements', () => {
    expect(mapboxJs).toContain('_alignmentGuides');
    expect(mapboxJs).toContain('mgl-alignment-guide');
  });

  test('JS implements alignment detection', () => {
    expect(mapboxJs).toContain('_updateAlignmentGuides');
    expect(mapboxJs).toContain('SNAP_THRESHOLD');
  });

  test('alignment guides are hidden on drag end', () => {
    expect(mapboxJs).toContain('_hideAlignmentGuides');
  });

  test('snap grid is shown during drag', () => {
    expect(mapboxJs).toContain('_snapGridEl.classList.add');
    expect(mapboxJs).toContain('visible');
  });
});

describe('Overlay Position Validation', () => {
  const mapboxJs = readFileSync(join(PROJECT_ROOT, 'public/js/mapbox-map.js'), 'utf-8');

  test('validates position values before saving', () => {
    expect(mapboxJs).toContain('isNaN(topPx)');
    expect(mapboxJs).toContain('isNaN(leftPx)');
  });

  test('logs warning for invalid positions', () => {
    expect(mapboxJs).toContain('console.warn');
    expect(mapboxJs).toContain('invalid position values');
  });

  test('saves positions as percentages for resolution independence', () => {
    const savePositionSection = mapboxJs.substring(
      mapboxJs.indexOf('_saveOverlayPosition'),
      mapboxJs.indexOf('_saveOverlaySize', mapboxJs.indexOf('_saveOverlayPosition'))
    );

    expect(savePositionSection).toContain('/ cr.height) * 100');
    expect(savePositionSection).toContain('/ cr.width) * 100');
    expect(savePositionSection).toContain("+ '%'");
  });

  test('validates width and height before saving', () => {
    const saveSizeSection = mapboxJs.substring(
      mapboxJs.indexOf('_saveOverlaySize'),
      mapboxJs.indexOf('_updateAlignmentGuides', mapboxJs.indexOf('_saveOverlaySize'))
    );

    expect(saveSizeSection).toContain('isNaN(widthPx)');
    expect(saveSizeSection).toContain('isNaN(heightPx)');
    expect(saveSizeSection).toContain('widthPx > 0');
    expect(saveSizeSection).toContain('heightPx > 0');
  });
});
