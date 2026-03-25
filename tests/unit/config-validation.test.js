/**
 * Configuration Validation Tests
 *
 * Validates dashboard and widget configurations
 * Ensures data integrity and proper structure
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

const PROJECT_ROOT = join(import.meta.dir, '..', '..');

describe('Dashboard Configuration Validation', () => {
  const dashboardsContent = readFileSync(
    join(PROJECT_ROOT, 'config/dashboards.yaml'),
    'utf-8'
  );
  const config = yaml.load(dashboardsContent);

  describe('Configuration Structure', () => {
    test('has dashboards array', () => {
      expect(config).toHaveProperty('dashboards');
      expect(Array.isArray(config.dashboards)).toBe(true);
    });

    test('has global settings', () => {
      expect(config).toHaveProperty('global');
      expect(config.global).toHaveProperty('rotation_interval');
      expect(config.global).toHaveProperty('refresh_interval');
    });

    test('rotation interval is reasonable (10-120 seconds)', () => {
      const interval = config.global.rotation_interval;
      expect(interval).toBeGreaterThanOrEqual(10);
      expect(interval).toBeLessThanOrEqual(120);
    });

    test('refresh interval is reasonable (5-60 seconds)', () => {
      const interval = config.global.refresh_interval;
      expect(interval).toBeGreaterThanOrEqual(5);
      expect(interval).toBeLessThanOrEqual(60);
    });
  });

  describe('Dashboard Properties', () => {
    config.dashboards?.forEach(dash => {
      describe(`Dashboard: ${dash.id}`, () => {
        test('has required properties', () => {
          expect(dash).toHaveProperty('id');
          expect(dash).toHaveProperty('name');
          expect(dash).toHaveProperty('grid');
          expect(dash).toHaveProperty('widgets');
        });

        test('id is non-empty string', () => {
          expect(typeof dash.id).toBe('string');
          expect(dash.id.length).toBeGreaterThan(0);
        });

        test('id uses kebab-case', () => {
          const kebabCase = /^[a-z0-9]+(-[a-z0-9]+)*$/;
          expect(kebabCase.test(dash.id)).toBe(true);
        });

        test('name is non-empty string', () => {
          expect(typeof dash.name).toBe('string');
          expect(dash.name.length).toBeGreaterThan(0);
        });

        test('grid has valid dimensions', () => {
          expect(dash.grid).toHaveProperty('columns');
          expect(dash.grid).toHaveProperty('rows');

          expect(dash.grid.columns).toBeGreaterThanOrEqual(1);
          expect(dash.grid.columns).toBeLessThanOrEqual(8);

          expect(dash.grid.rows).toBeGreaterThanOrEqual(1);
          expect(dash.grid.rows).toBeLessThanOrEqual(4);
        });

        test('widgets is an array', () => {
          expect(Array.isArray(dash.widgets)).toBe(true);
        });

        if (dash.theme) {
          test('theme is a valid theme name', () => {
            const validThemes = ['brand', 'fox', 'iheart', 'hearst', 'nexstar', 'scripps', 'cox', 'cool', 'warm'];
            expect(validThemes).toContain(dash.theme);
          });
        }
      });
    });
  });

  describe('Widget Configuration', () => {
    const allWidgets = config.dashboards?.flatMap(d => d.widgets || []) || [];

    test('has at least some widgets', () => {
      expect(allWidgets.length).toBeGreaterThan(0);
    });

    allWidgets.forEach((widget, index) => {
      describe(`Widget ${index}: ${widget.id}`, () => {
        test('has required properties', () => {
          expect(widget).toHaveProperty('id');
          expect(widget).toHaveProperty('type');
          expect(widget).toHaveProperty('position');
        });

        test('id is unique within dashboard', () => {
          const dashboard = config.dashboards?.find(d =>
            d.widgets?.some(w => w.id === widget.id)
          );

          if (dashboard) {
            const widgetIds = dashboard.widgets.map(w => w.id);
            const duplicates = widgetIds.filter(id => id === widget.id);
            expect(duplicates.length).toBe(1);
          }
        });

        test('type is non-empty string', () => {
          expect(typeof widget.type).toBe('string');
          expect(widget.type.length).toBeGreaterThan(0);
        });

        test('position has required fields', () => {
          expect(widget.position).toHaveProperty('col');
          expect(widget.position).toHaveProperty('row');
        });

        test('position values are positive integers', () => {
          expect(widget.position.col).toBeGreaterThanOrEqual(1);
          expect(widget.position.row).toBeGreaterThanOrEqual(1);
        });

        if (widget.position.colSpan) {
          test('colSpan is positive', () => {
            expect(widget.position.colSpan).toBeGreaterThan(0);
          });
        }

        if (widget.position.rowSpan) {
          test('rowSpan is positive', () => {
            expect(widget.position.rowSpan).toBeGreaterThan(0);
          });
        }
      });
    });
  });

  describe('Map Widget Configuration', () => {
    const mapWidgets = config.dashboards?.flatMap(d =>
      (d.widgets || []).filter(w => w.type === 'usa-map-gl')
    ) || [];

    mapWidgets.forEach(widget => {
      describe(`Map Widget: ${widget.id}`, () => {
        if (widget.mglConfig) {
          test('has overlay positions object', () => {
            if (widget.mglConfig.overlayPositions) {
              expect(typeof widget.mglConfig.overlayPositions).toBe('object');
            }
          });

          test('map style is valid', () => {
            if (widget.mglConfig.mapStyle) {
              const validStyles = ['brand', 'mapbox'];
              expect(validStyles).toContain(widget.mglConfig.mapStyle);
            }
          });

          test('zoom visualization is valid', () => {
            if (widget.mglConfig.zoomViz) {
              const validViz = ['dots', 'heatmap'];
              expect(validViz).toContain(widget.mglConfig.zoomViz);
            }
          });

          test('initial zoom is reasonable (2-10)', () => {
            if (widget.mglConfig.initialZoom) {
              expect(widget.mglConfig.initialZoom).toBeGreaterThanOrEqual(2);
              expect(widget.mglConfig.initialZoom).toBeLessThanOrEqual(10);
            }
          });

          test('initial center has valid lat/lng', () => {
            if (widget.mglConfig.initialCenter) {
              const { lat, lng } = widget.mglConfig.initialCenter;

              expect(lat).toBeGreaterThanOrEqual(-90);
              expect(lat).toBeLessThanOrEqual(90);

              expect(lng).toBeGreaterThanOrEqual(-180);
              expect(lng).toBeLessThanOrEqual(180);
            }
          });

          test('particle speed is reasonable (0.1-5)', () => {
            if (widget.mglConfig.particleSpeed) {
              expect(widget.mglConfig.particleSpeed).toBeGreaterThanOrEqual(0.1);
              expect(widget.mglConfig.particleSpeed).toBeLessThanOrEqual(5);
            }
          });

          test('boolean flags are actual booleans', () => {
            const boolFlags = [
              'showLeaderboard',
              'showRegionWest',
              'showRegionCentral',
              'showRegionEast',
              'showTotalOverlay',
              'showClientLogo'
            ];

            boolFlags.forEach(flag => {
              if (flag in widget.mglConfig) {
                expect(typeof widget.mglConfig[flag]).toBe('boolean');
              }
            });
          });
        }
      });
    });
  });

  describe('Client Branding Configuration', () => {
    const clientDashboards = config.dashboards?.filter(d => d.clientBranding) || [];

    clientDashboards.forEach(dash => {
      describe(`Client Dashboard: ${dash.id}`, () => {
        const branding = dash.clientBranding;

        test('has required branding properties', () => {
          expect(branding).toHaveProperty('logoText');
          expect(branding).toHaveProperty('bg');
          expect(branding).toHaveProperty('accent');
        });

        test('colors are valid hex format', () => {
          const hexPattern = /^#[0-9A-Fa-f]{6}$/;

          if (branding.bg) expect(hexPattern.test(branding.bg)).toBe(true);
          if (branding.accent) expect(hexPattern.test(branding.accent)).toBe(true);
          if (branding.border) expect(hexPattern.test(branding.border)).toBe(true);
        });

        test('accentDim uses rgba format', () => {
          if (branding.accentDim) {
            const rgbaPattern = /^rgba\(\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*0?\.\d+\)$/;
            expect(rgbaPattern.test(branding.accentDim)).toBe(true);
          }
        });

        test('logo image path is valid if present', () => {
          if (branding.logoImage) {
            expect(branding.logoImage.startsWith('/img/')).toBe(true);
            expect(branding.logoImage.endsWith('.svg') ||
                   branding.logoImage.endsWith('.png')).toBe(true);
          }
        });
      });
    });
  });

  describe('Configuration Consistency', () => {
    test('no duplicate dashboard IDs', () => {
      const ids = config.dashboards?.map(d => d.id) || [];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test('widget positions fit within grid', () => {
      config.dashboards?.forEach(dash => {
        dash.widgets?.forEach(widget => {
          const maxCol = widget.position.col + (widget.position.colSpan || 1) - 1;
          const maxRow = widget.position.row + (widget.position.rowSpan || 1) - 1;

          expect(maxCol).toBeLessThanOrEqual(dash.grid.columns);
          expect(maxRow).toBeLessThanOrEqual(dash.grid.rows);
        });
      });
    });

    test('excluded dashboards are boolean', () => {
      config.dashboards?.forEach(dash => {
        if ('excluded' in dash) {
          expect(typeof dash.excluded).toBe('boolean');
        }
      });
    });
  });
});

describe('Widget Type Validation', () => {
  const validWidgetTypes = [
    'big-number', 'stat-card', 'gauge', 'line-chart', 'bar-chart',
    'sparkline', 'usa-map-gl', 'pipeline-flow', 'donut-ring',
    'heatmap', 'table', 'treemap', 'sankey', 'stacked-bar-chart',
    'multi-metric-card', 'security-scorecard'
  ];

  const dashboardsContent = readFileSync(
    join(PROJECT_ROOT, 'config/dashboards.yaml'),
    'utf-8'
  );
  const config = yaml.load(dashboardsContent);

  test('all widget types are recognized', () => {
    const allWidgets = config.dashboards?.flatMap(d => d.widgets || []) || [];
    const usedTypes = new Set(allWidgets.map(w => w.type));

    usedTypes.forEach(type => {
      expect(validWidgetTypes).toContain(type);
    });
  });

  test('widgets have appropriate source configured', () => {
    const allWidgets = config.dashboards?.flatMap(d => d.widgets || []) || [];

    allWidgets.forEach(widget => {
      if (widget.source) {
        const validSources = ['gcp', 'computed', 'bigquery', 'static'];
        expect(validSources).toContain(widget.source);
      }
    });
  });
});

describe('YAML Syntax Validation', () => {
  const dashboardsContent = readFileSync(
    join(PROJECT_ROOT, 'config/dashboards.yaml'),
    'utf-8'
  );

  test('YAML file is valid', () => {
    expect(() => yaml.load(dashboardsContent)).not.toThrow();
  });

  test('no tab characters (YAML requires spaces)', () => {
    expect(dashboardsContent).not.toContain('\t');
  });

  test('consistent indentation (2 spaces)', () => {
    const lines = dashboardsContent.split('\n');
    const indentedLines = lines.filter(line => /^\s+/.test(line));

    indentedLines.forEach(line => {
      const match = line.match(/^(\s+)/);
      if (match) {
        const spaces = match[1].length;
        // Indentation should be multiples of 2
        expect(spaces % 2).toBe(0);
      }
    });
  });

  test('no trailing whitespace', () => {
    const lines = dashboardsContent.split('\n');

    lines.forEach((line, index) => {
      if (line.length > 0) {
        expect(line.endsWith(' ')).toBe(false);
      }
    });
  });
});

describe('Performance Considerations', () => {
  const dashboardsContent = readFileSync(
    join(PROJECT_ROOT, 'config/dashboards.yaml'),
    'utf-8'
  );
  const config = yaml.load(dashboardsContent);

  test('configuration file is not excessively large', () => {
    const sizeKB = dashboardsContent.length / 1024;
    expect(sizeKB).toBeLessThan(500); // < 500KB
  });

  test('total number of dashboards is reasonable', () => {
    const count = config.dashboards?.length || 0;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(100); // Not too many for rotation
  });

  test('total number of widgets is manageable', () => {
    const totalWidgets = config.dashboards?.reduce((sum, d) =>
      sum + (d.widgets?.length || 0), 0) || 0;

    expect(totalWidgets).toBeGreaterThan(0);
    expect(totalWidgets).toBeLessThan(500);
  });

  test('no excessively complex widget nesting', () => {
    // Check max depth of configuration objects
    const getDepth = (obj, depth = 0) => {
      if (typeof obj !== 'object' || obj === null) return depth;
      const depths = Object.values(obj).map(v => getDepth(v, depth + 1));
      return Math.max(depth, ...depths);
    };

    const maxDepth = getDepth(config);
    expect(maxDepth).toBeLessThan(10); // Not too deeply nested
  });
});
