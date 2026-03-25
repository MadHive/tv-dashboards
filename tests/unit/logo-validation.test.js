/**
 * Logo File Validation Tests
 *
 * Ensures logo files exist and are properly configured
 * Validates logo dimensions and formats
 */

import { describe, test, expect } from 'bun:test';
import { existsSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = join(import.meta.dir, '..', '..');

describe('Logo File Validation', () => {
  const clientLogos = [
    { client: 'FOX', path: 'public/img/fox-logo.svg', format: 'svg' },
    { client: 'iHeart', path: 'public/img/rf2d7i-iheartmedia-vertical-logo-red.png', format: 'png' },
    { client: 'Hearst', path: 'public/img/hearst-logo.svg', format: 'svg' },
    { client: 'Nexstar', path: 'public/img/nexstar-logo.png', format: 'png' },
    { client: 'Scripps', path: 'public/img/scripps-logo.png', format: 'png' },
    { client: 'Cox', path: 'public/img/cox-logo.svg', format: 'svg' }
  ];

  describe('Logo Files Exist', () => {
    clientLogos.forEach(({ client, path }) => {
      test(`${client} logo file exists at ${path}`, () => {
        const fullPath = join(PROJECT_ROOT, path);
        expect(existsSync(fullPath)).toBe(true);
      });
    });
  });

  describe('Logo File Sizes', () => {
    clientLogos.forEach(({ client, path, format }) => {
      test(`${client} logo file is not empty`, () => {
        const fullPath = join(PROJECT_ROOT, path);
        if (existsSync(fullPath)) {
          const stats = statSync(fullPath);
          expect(stats.size).toBeGreaterThan(0);

          // Logo files should be reasonable size (not corrupt)
          if (format === 'svg') {
            expect(stats.size).toBeLessThan(100000); // < 100KB for SVG
          } else {
            expect(stats.size).toBeLessThan(500000); // < 500KB for PNG
          }
        }
      });
    });
  });

  describe('SVG Logo Validation', () => {
    const svgLogos = clientLogos.filter(l => l.format === 'svg');

    svgLogos.forEach(({ client, path }) => {
      test(`${client} SVG logo has valid structure`, () => {
        const fullPath = join(PROJECT_ROOT, path);
        if (existsSync(fullPath)) {
          const content = readFileSync(fullPath, 'utf-8');

          // Should contain SVG tags
          expect(content).toContain('<svg');
          expect(content).toContain('</svg>');

          // Should have viewBox or width/height
          const hasViewBox = content.includes('viewBox');
          const hasSize = content.includes('width=') && content.includes('height=');
          expect(hasViewBox || hasSize).toBe(true);
        }
      });

      test(`${client} SVG logo doesn't contain scripts (security)`, () => {
        const fullPath = join(PROJECT_ROOT, path);
        if (existsSync(fullPath)) {
          const content = readFileSync(fullPath, 'utf-8');

          // SVG shouldn't contain scripts for security
          expect(content.toLowerCase()).not.toContain('<script');
          expect(content.toLowerCase()).not.toContain('javascript:');
          expect(content.toLowerCase()).not.toContain('onerror=');
        }
      });
    });
  });

  describe('PNG Logo Validation', () => {
    const pngLogos = clientLogos.filter(l => l.format === 'png');

    pngLogos.forEach(({ client, path }) => {
      test(`${client} PNG logo has correct magic bytes`, () => {
        const fullPath = join(PROJECT_ROOT, path);
        if (existsSync(fullPath)) {
          const buffer = readFileSync(fullPath);

          // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
          expect(buffer[0]).toBe(0x89);
          expect(buffer[1]).toBe(0x50);
          expect(buffer[2]).toBe(0x4E);
          expect(buffer[3]).toBe(0x47);
        }
      });
    });
  });

  describe('Logo Path Configuration', () => {
    test('all logo paths start with /img/', () => {
      clientLogos.forEach(({ client, path }) => {
        const webPath = '/' + path.replace('public/', '');
        expect(webPath.startsWith('/img/')).toBe(true);
      });
    });

    test('logo paths match theme configuration', () => {
      const themesJs = readFileSync(join(PROJECT_ROOT, 'public/js/themes.js'), 'utf-8');

      // Check that logo paths in themes.js match actual files
      clientLogos.forEach(({ client, path }) => {
        const webPath = '/' + path.replace('public/', '');
        if (client !== 'MadHive') { // MadHive has null logo
          expect(themesJs).toContain(webPath);
        }
      });
    });
  });

  describe('Logo File Naming', () => {
    test('logo files use lowercase with hyphens', () => {
      clientLogos.forEach(({ client, path }) => {
        const filename = path.split('/').pop();

        // Allow alphanumeric, hyphens, underscores, and dots
        const validPattern = /^[a-z0-9-_.]+\.(svg|png)$/;
        expect(validPattern.test(filename)).toBe(true);
      });
    });

    test('logo files have correct extensions', () => {
      clientLogos.forEach(({ path, format }) => {
        expect(path.endsWith(`.${format}`)).toBe(true);
      });
    });
  });
});

describe('Logo Display Configuration', () => {
  const dashboardsCss = readFileSync(join(PROJECT_ROOT, 'public/css/dashboard.css'), 'utf-8');

  test('CSS defines logo styling', () => {
    expect(dashboardsCss).toContain('.brand-logo-img');
  });

  test('logo image has correct height', () => {
    expect(dashboardsCss).toContain('height: 48px');
  });

  test('logo image uses object-fit contain', () => {
    expect(dashboardsCss).toContain('object-fit: contain');
  });

  test('logo image has drop shadow for visibility', () => {
    expect(dashboardsCss).toContain('drop-shadow');
  });
});

describe('Logo Accessibility', () => {
  const appJs = readFileSync(join(PROJECT_ROOT, 'public/js/app.js'), 'utf-8');

  test('logo images should have alt text defined', () => {
    // Check that logo creation includes alt attribute
    if (appJs.includes('brand-logo-img')) {
      expect(appJs).toContain('alt');
    }
  });

  test('logo images should handle load errors', () => {
    // Check for error handling
    expect(appJs).toContain('onerror');
  });
});

describe('Logo File Performance', () => {
  const svgLogos = [
    'public/img/fox-logo.svg',
    'public/img/hearst-logo.svg',
    'public/img/cox-logo.svg'
  ];

  test('SVG logos are optimized (no excessive whitespace)', () => {
    svgLogos.forEach(path => {
      const fullPath = join(PROJECT_ROOT, path);
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        // Optimized SVGs shouldn't have too many blank lines
        const blankLines = lines.filter(l => l.trim() === '').length;
        const totalLines = lines.length;

        expect(blankLines / totalLines).toBeLessThan(0.3); // < 30% blank lines
      }
    });
  });

  test('SVG logos use path compression where possible', () => {
    svgLogos.forEach(path => {
      const fullPath = join(PROJECT_ROOT, path);
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, 'utf-8');

        // Check for path data (indicates vector graphics)
        const hasPath = content.includes('<path') || content.includes('<polygon');
        if (hasPath) {
          expect(content).toContain('d=');
        }
      }
    });
  });
});
