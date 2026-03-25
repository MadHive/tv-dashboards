/**
 * Branding Enforcement Tests
 *
 * Ensures that:
 * - CSS files use themeable variables instead of hardcoded colors
 * - Client logos are displayed with correct dimensions
 * - Header and UI chrome properly apply theme colors
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = join(import.meta.dir, '..', '..');

describe('CSS Theming Enforcement', () => {
  const cssFiles = [
    'public/css/dashboard.css',
    'public/css/mapbox-map.css',
  ];

  cssFiles.forEach(cssFile => {
    describe(`File: ${cssFile}`, () => {
      const content = readFileSync(join(PROJECT_ROOT, cssFile), 'utf-8');

      test('should not use hardcoded MadHive pink (#FDA4D4 or #FF9BD3)', () => {
        // Allow these in :root definitions but not in actual styles
        const lines = content.split('\n');
        const violations = [];

        let inRootBlock = false;
        lines.forEach((line, index) => {
          if (line.includes(':root')) inRootBlock = true;
          if (inRootBlock && line.includes('}')) inRootBlock = false;

          // Skip :root block and comments
          if (inRootBlock || line.trim().startsWith('/*')) return;

          if (line.includes('#FDA4D4') || line.includes('#FF9BD3')) {
            violations.push(`Line ${index + 1}: ${line.trim()}`);
          }
        });

        if (violations.length > 0) {
          console.error(`Found hardcoded MadHive colors in ${cssFile}:`, violations);
        }
        expect(violations.length).toBe(0);
      });

      test('should use CSS variables for accent colors', () => {
        // Look for color properties that should use variables
        const colorProps = ['color:', 'background:', 'border-color:', 'box-shadow:'];
        const lines = content.split('\n');

        let hasThemeableColors = false;
        lines.forEach(line => {
          const trimmed = line.trim();
          colorProps.forEach(prop => {
            if (trimmed.includes(prop) && (
              trimmed.includes('var(--accent)') ||
              trimmed.includes('var(--border-lit)') ||
              trimmed.includes('var(--t1)') ||
              trimmed.includes('var(--t2)')
            )) {
              hasThemeableColors = true;
            }
          });
        });

        expect(hasThemeableColors).toBe(true);
      });

      test('should not have references to --mh-pink or --mh-hot-pink in non-:root declarations', () => {
        const lines = content.split('\n');
        const violations = [];

        let inRootBlock = false;
        lines.forEach((line, index) => {
          if (line.includes(':root')) inRootBlock = true;
          if (inRootBlock && line.includes('}')) inRootBlock = false;

          if (!inRootBlock && (line.includes('var(--mh-pink)') || line.includes('var(--mh-hot-pink)'))) {
            violations.push(`Line ${index + 1}: ${line.trim()}`);
          }
        });

        if (violations.length > 0) {
          console.error(`Found hardcoded --mh-pink/--mh-hot-pink usage in ${cssFile}:`, violations);
        }
        expect(violations.length).toBe(0);
      });
    });
  });
});

describe('Logo Display Requirements', () => {
  const appJsContent = readFileSync(join(PROJECT_ROOT, 'public/js/app.js'), 'utf-8');

  test('logo image should be displayed at correct height (48px)', () => {
    expect(appJsContent).toContain('height:48px');
  });

  test('logo image should have proper styling', () => {
    expect(appJsContent).toContain('width:auto');
    expect(appJsContent).toContain('object-fit:contain');
  });

  test('logo image should be inserted into .top-left element', () => {
    expect(appJsContent).toContain("querySelector('.top-left')");
    expect(appJsContent).toContain('brand-logo-img');
  });
});

describe('Header Branding Application', () => {
  const appJsContent = readFileSync(join(PROJECT_ROOT, 'public/js/app.js'), 'utf-8');

  test('should have theme application function', () => {
    // Check for either _applyClientBranding or applyThemeCss
    const hasThemeApplication = appJsContent.includes('_applyClientBranding') ||
                                 appJsContent.includes('applyThemeCss');
    expect(hasThemeApplication).toBe(true);
  });

  test('should apply CSS variable settings for theming', () => {
    // Should set CSS variables for theme colors
    expect(appJsContent).toContain('--bg');
    expect(appJsContent).toContain('--accent');
    expect(appJsContent).toContain('--mh-pink');
  });

  test('should update logo text', () => {
    expect(appJsContent).toContain('.logo-text');
    expect(appJsContent).toContain('.logo-sub');
  });
});

describe('Theme Consistency', () => {
  const dashboardCss = readFileSync(join(PROJECT_ROOT, 'public/css/dashboard.css'), 'utf-8');

  test('header bar should use themeable border gradient', () => {
    // Check that #top-bar::after uses var(--accent) not hardcoded pink
    const topBarAfterRegion = dashboardCss.substring(
      dashboardCss.indexOf('#top-bar::after'),
      dashboardCss.indexOf('}', dashboardCss.indexOf('#top-bar::after'))
    );

    expect(topBarAfterRegion).toContain('var(--accent)');
    expect(topBarAfterRegion).not.toContain('#FDA4D4');
  });

  test('nav dots should use themeable accent color', () => {
    const navDotRegion = dashboardCss.substring(
      dashboardCss.indexOf('.nav-dot.active'),
      dashboardCss.indexOf('}', dashboardCss.indexOf('.nav-dot.active'))
    );

    expect(navDotRegion).toContain('var(--accent)');
  });

  test('progress bars should use themeable gradient', () => {
    const progressRegion = dashboardCss.substring(
      dashboardCss.indexOf('#rotation-progress {'),
      dashboardCss.indexOf('}', dashboardCss.indexOf('#rotation-progress {'))
    );

    expect(progressRegion).toContain('var(--accent)');
    expect(progressRegion).toContain('var(--border-lit)');
  });
});
