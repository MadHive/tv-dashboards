/**
 * Studio Controls Tests
 *
 * Tests for uniform sizing controls, alignment guides,
 * and other studio UI features
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = join(import.meta.dir, '..', '..');

describe('Uniform Sizing Controls', () => {
  const studioHtml = readFileSync(join(PROJECT_ROOT, 'public/studio.html'), 'utf-8');
  const studioJs = readFileSync(join(PROJECT_ROOT, 'public/js/studio.js'), 'utf-8');

  describe('UI Elements', () => {
    test('has width input field', () => {
      expect(studioHtml).toContain('id="prop-mgl-uniform-width"');
      expect(studioHtml).toContain('type="number"');
    });

    test('has height input field', () => {
      expect(studioHtml).toContain('id="prop-mgl-uniform-height"');
      expect(studioHtml).toContain('type="number"');
    });

    test('has apply button', () => {
      expect(studioHtml).toContain('id="apply-uniform-sizing-btn"');
      expect(studioHtml).toContain('Apply to West/Central/East');
    });

    test('input fields have reasonable constraints', () => {
      expect(studioHtml).toContain('min="100"'); // Width min
      expect(studioHtml).toContain('min="80"');  // Height min
      expect(studioHtml).toContain('step="10"');
    });

    test('inputs have helpful placeholders', () => {
      expect(studioHtml).toContain('placeholder="160"'); // Width
      expect(studioHtml).toContain('placeholder="115"'); // Height
    });
  });

  describe('Validation Logic', () => {
    test('validates minimum width (100px)', () => {
      expect(studioJs).toContain('width < 100');
    });

    test('validates minimum height (80px)', () => {
      expect(studioJs).toContain('height < 80');
    });

    test('validates numeric input', () => {
      expect(studioJs).toContain('isNaN(width)');
      expect(studioJs).toContain('isNaN(height)');
    });

    test('shows error message for invalid input', () => {
      const btnSection = studioJs.substring(
        studioJs.indexOf('apply-uniform-sizing-btn'),
        studioJs.indexOf('Region buttons', studioJs.indexOf('apply-uniform-sizing-btn'))
      );

      expect(btnSection).toContain('alert');
      // Check for validation message about width/height
      expect(btnSection.toLowerCase()).toContain('width');
      expect(btnSection.toLowerCase()).toContain('height');
    });
  });

  describe('Application Logic', () => {
    test('applies sizing to all three regional panels', () => {
      const btnSection = studioJs.substring(
        studioJs.indexOf('apply-uniform-sizing-btn'),
        studioJs.indexOf('Region buttons', studioJs.indexOf('apply-uniform-sizing-btn'))
      );

      expect(btnSection).toContain('west');
      expect(btnSection).toContain('central');
      expect(btnSection).toContain('east');
    });

    test('sets width and height for each panel', () => {
      const btnSection = studioJs.substring(
        studioJs.indexOf('apply-uniform-sizing-btn'),
        studioJs.indexOf('Region buttons', studioJs.indexOf('apply-uniform-sizing-btn'))
      );

      expect(btnSection).toContain('.width');
      expect(btnSection).toContain('.height');
    });

    test('marks dashboard as dirty after applying', () => {
      const btnSection = studioJs.substring(
        studioJs.indexOf('apply-uniform-sizing-btn'),
        studioJs.indexOf('Region buttons', studioJs.indexOf('apply-uniform-sizing-btn'))
      );

      expect(btnSection).toContain('markDirty');
    });

    test('triggers canvas re-render', () => {
      const btnSection = studioJs.substring(
        studioJs.indexOf('apply-uniform-sizing-btn'),
        studioJs.indexOf('Region buttons', studioJs.indexOf('apply-uniform-sizing-btn'))
      );

      expect(btnSection).toContain('renderCanvas');
    });
  });

  describe('User Experience', () => {
    test('provides console feedback', () => {
      const btnSection = studioJs.substring(
        studioJs.indexOf('apply-uniform-sizing-btn'),
        studioJs.indexOf('Region buttons', studioJs.indexOf('apply-uniform-sizing-btn'))
      );

      expect(btnSection).toContain('console.log');
      expect(btnSection).toContain('uniform sizing');
    });

    test('section is clearly labeled', () => {
      expect(studioHtml).toContain('Uniform Panel Sizing');
    });
  });
});

describe('Alignment Guides', () => {
  const mapboxCss = readFileSync(join(PROJECT_ROOT, 'public/css/mapbox-map.css'), 'utf-8');
  const mapboxJs = readFileSync(join(PROJECT_ROOT, 'public/js/mapbox-map.js'), 'utf-8');

  describe('Snap Grid', () => {
    test('snap grid element is defined in CSS', () => {
      expect(mapboxCss).toContain('.mgl-snap-grid');
    });

    test('snap grid has 20px grid size', () => {
      expect(mapboxCss).toContain('background-size: 20px 20px');
    });

    test('snap grid is initially hidden', () => {
      const snapGridDef = mapboxCss.substring(
        mapboxCss.indexOf('.mgl-snap-grid {'),
        mapboxCss.indexOf('}', mapboxCss.indexOf('.mgl-snap-grid {'))
      );

      expect(snapGridDef).toContain('opacity:        0');
    });

    test('snap grid becomes visible on drag', () => {
      expect(mapboxCss).toContain('.mgl-snap-grid.visible');
      expect(mapboxCss).toContain('opacity: 1');
    });

    test('snap grid visibility is high enough (>= 0.15)', () => {
      const gridPattern = mapboxCss.match(/linear-gradient\(rgba\([^)]+,\s*([0-9.]+)\)/);
      if (gridPattern) {
        const opacity = parseFloat(gridPattern[1]);
        expect(opacity).toBeGreaterThanOrEqual(0.15);
      }
    });
  });

  describe('Alignment Guide Lines', () => {
    test('alignment guide CSS is defined', () => {
      expect(mapboxCss).toContain('.mgl-alignment-guide');
    });

    test('has horizontal and vertical variants', () => {
      expect(mapboxCss).toContain('.mgl-alignment-guide.horizontal');
      expect(mapboxCss).toContain('.mgl-alignment-guide.vertical');
    });

    test('guides are positioned absolutely', () => {
      const guideDef = mapboxCss.substring(
        mapboxCss.indexOf('.mgl-alignment-guide {'),
        mapboxCss.indexOf('}', mapboxCss.indexOf('.mgl-alignment-guide {'))
      );

      expect(guideDef).toContain('position: absolute');
    });

    test('guides are non-interactive', () => {
      const guideDef = mapboxCss.substring(
        mapboxCss.indexOf('.mgl-alignment-guide {'),
        mapboxCss.indexOf('}', mapboxCss.indexOf('.mgl-alignment-guide {'))
      );

      expect(guideDef).toContain('pointer-events: none');
    });

    test('guides have high z-index for visibility', () => {
      const guideDef = mapboxCss.substring(
        mapboxCss.indexOf('.mgl-alignment-guide {'),
        mapboxCss.indexOf('}', mapboxCss.indexOf('.mgl-alignment-guide {'))
      );

      expect(guideDef).toContain('z-index');
    });

    test('guides are initially hidden', () => {
      const guideDef = mapboxCss.substring(
        mapboxCss.indexOf('.mgl-alignment-guide {'),
        mapboxCss.indexOf('.mgl-alignment-guide.horizontal')
      );

      expect(guideDef).toContain('opacity: 0');
    });
  });

  describe('JavaScript Implementation', () => {
    test('creates alignment guide elements', () => {
      expect(mapboxJs).toContain('_alignmentGuides');
      expect(mapboxJs).toContain('mgl-alignment-guide');
      expect(mapboxJs).toContain('horizontal');
      expect(mapboxJs).toContain('vertical');
    });

    test('has update alignment function', () => {
      expect(mapboxJs).toContain('_updateAlignmentGuides');
    });

    test('has hide alignment function', () => {
      expect(mapboxJs).toContain('_hideAlignmentGuides');
    });

    test('defines snap threshold', () => {
      expect(mapboxJs).toContain('SNAP_THRESHOLD');
    });

    test('snap threshold is reasonable (5-15px)', () => {
      const thresholdMatch = mapboxJs.match(/SNAP_THRESHOLD\s*=\s*(\d+)/);
      if (thresholdMatch) {
        const threshold = parseInt(thresholdMatch[1]);
        expect(threshold).toBeGreaterThanOrEqual(5);
        expect(threshold).toBeLessThanOrEqual(15);
      }
    });

    test('shows guides during drag', () => {
      expect(mapboxJs).toContain('_updateAlignmentGuides');
      expect(mapboxJs).toContain('pointermove');
    });

    test('hides guides on drag end', () => {
      expect(mapboxJs).toContain('pointerup');
      expect(mapboxJs).toContain('_hideAlignmentGuides');
    });
  });

  describe('Grid Snapping', () => {
    test('defines grid size constant', () => {
      expect(mapboxJs).toContain('GRID');
    });

    test('grid size matches CSS (20px)', () => {
      const gridMatch = mapboxJs.match(/const GRID\s*=\s*(\d+)/);
      if (gridMatch) {
        const gridSize = parseInt(gridMatch[1]);
        expect(gridSize).toBe(20);
      }
    });

    test('has snap function', () => {
      expect(mapboxJs).toContain('snapGrid');
    });

    test('applies snapping during drag', () => {
      const dragSection = mapboxJs.substring(
        mapboxJs.indexOf('pointermove'),
        mapboxJs.indexOf('pointerup', mapboxJs.indexOf('pointermove'))
      );

      expect(dragSection).toContain('snapGrid');
    });
  });
});

describe('Overlay Reset Functionality', () => {
  const studioHtml = readFileSync(join(PROJECT_ROOT, 'public/studio.html'), 'utf-8');
  const studioJs = readFileSync(join(PROJECT_ROOT, 'public/js/studio.js'), 'utf-8');

  test('has reset overlay positions button', () => {
    expect(studioHtml).toContain('id="reset-overlay-positions"');
  });

  test('reset button has descriptive label', () => {
    expect(studioHtml).toContain('Reset Overlay Positions');
  });

  test('reset button deletes overlayPositions config', () => {
    const resetSection = studioJs.substring(
      studioJs.indexOf('reset-overlay-positions'),
      studioJs.indexOf('uniform-sizing-btn', studioJs.indexOf('reset-overlay-positions'))
    );

    expect(resetSection).toContain('delete');
    expect(resetSection).toContain('overlayPositions');
  });

  test('reset triggers re-render', () => {
    const resetSection = studioJs.substring(
      studioJs.indexOf('reset-overlay-positions'),
      studioJs.indexOf('uniform-sizing-btn', studioJs.indexOf('reset-overlay-positions'))
    );

    expect(resetSection).toContain('renderCanvas');
  });
});

describe('Studio Control Integration', () => {
  const studioJs = readFileSync(join(PROJECT_ROOT, 'public/js/studio.js'), 'utf-8');

  test('uniform sizing creates mglConfig if not exists', () => {
    const btnSection = studioJs.substring(
      studioJs.indexOf('apply-uniform-sizing-btn'),
      studioJs.indexOf('Region buttons', studioJs.indexOf('apply-uniform-sizing-btn'))
    );

    expect(btnSection).toContain('if (!wc.mglConfig)');
    expect(btnSection).toContain('wc.mglConfig = {}');
  });

  test('creates overlayPositions object if needed', () => {
    const btnSection = studioJs.substring(
      studioJs.indexOf('apply-uniform-sizing-btn'),
      studioJs.indexOf('Region buttons', studioJs.indexOf('apply-uniform-sizing-btn'))
    );

    expect(btnSection).toContain('overlayPositions');
  });

  test('preserves existing overlay positions', () => {
    const btnSection = studioJs.substring(
      studioJs.indexOf('apply-uniform-sizing-btn'),
      studioJs.indexOf('Region buttons', studioJs.indexOf('apply-uniform-sizing-btn'))
    );

    // Should check if position exists before creating
    expect(btnSection).toContain('if (!wc.mglConfig.overlayPositions[region])');
  });
});
