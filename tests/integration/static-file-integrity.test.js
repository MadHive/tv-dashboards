// ===========================================================================
// Integration: Static file integrity test
// Prevents file truncation by verifying that served JavaScript files match
// their on-disk size and are syntactically valid. This catches issues where
// the static plugin or response handling truncates files with multi-byte
// UTF-8 characters.
// ===========================================================================

import { describe, it, expect, beforeAll } from 'bun:test';
import { statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../../public');

let app;
beforeAll(async () => {
  const mod = await import('../../server/index.js');
  app = mod.app;
});

// Critical JavaScript files that must be served without truncation
const CRITICAL_JS_FILES = [
  '/js/app.js',
  '/js/charts.js',
  '/js/widgets.js',
  '/js/mapbox-map.js',
  '/js/studio.js',
  '/js/studio-canvas.js',
  '/js/importer.js',
];

describe('Static file integrity', () => {
  for (const path of CRITICAL_JS_FILES) {
    it(`${path} is served completely without truncation`, async () => {
      // Get file from server
      const res = await app.handle(new Request(`http://localhost${path}`));
      expect(res.status).toBe(200);

      const servedContent = await res.text();
      const servedBytes = new TextEncoder().encode(servedContent).length;

      // Get actual file size from disk
      const diskPath = join(publicDir, path);
      const diskStats = statSync(diskPath);
      const diskBytes = diskStats.size;

      // Verify sizes match
      expect(servedBytes).toBe(diskBytes);

      // Verify content is valid JavaScript (no truncation)
      expect(() => {
        new Function(servedContent); // Will throw if syntax is invalid
      }).not.toThrow();
    });
  }

  it('mapbox-map.js contains complete IIFE closure', async () => {
    const res = await app.handle(new Request('http://localhost/js/mapbox-map.js'));
    const content = await res.text();

    // Verify it starts with the IIFE pattern
    expect(content).toContain('window.MapboxUSAMap = (function ()');

    // Verify it ends with the IIFE closure
    expect(content).toContain('return { mapboxUsaMap };');
    expect(content).toContain('})();');

    // Verify the export function is defined
    expect(content).toContain('function mapboxUsaMap(container, config)');
  });

  it('all JavaScript files end with proper closure (not mid-line)', async () => {
    for (const path of CRITICAL_JS_FILES) {
      const res = await app.handle(new Request(`http://localhost${path}`));
      const content = await res.text();

      // Files should end with a newline or closing brace, not truncated mid-token
      const lastLine = content.split('\n').filter(l => l.trim()).pop();
      expect(lastLine).toBeDefined();

      // Should not end with incomplete tokens like "const end = targetTo"
      const incompletePatterns = [
        /const\s+\w+\s*=\s*$/,           // const x =
        /function\s+\w*\s*\(\s*$/,       // function foo(
        /=>\s*$/,                        // =>
        /\.\w*$/,                        // .prop (incomplete)
      ];

      for (const pattern of incompletePatterns) {
        expect(lastLine).not.toMatch(pattern);
      }
    }
  });

  it('CSS files are served without truncation', async () => {
    const cssFiles = [
      '/css/dashboard.css',
      '/css/studio.css',
      '/css/importer.css',
    ];

    for (const path of cssFiles) {
      const res = await app.handle(new Request(`http://localhost${path}`));
      expect(res.status).toBe(200);

      const servedContent = await res.text();
      const servedBytes = new TextEncoder().encode(servedContent).length;

      const diskPath = join(publicDir, path);
      const diskStats = statSync(diskPath);
      const diskBytes = diskStats.size;

      expect(servedBytes).toBe(diskBytes);
    }
  });

  it('versioned assets bypass cache correctly', async () => {
    // Test that version parameter doesn't break serving
    const res1 = await app.handle(new Request('http://localhost/js/mapbox-map.js?v=104'));
    const res2 = await app.handle(new Request('http://localhost/js/mapbox-map.js?v=105'));

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const content1 = await res1.text();
    const content2 = await res2.text();

    // Same content regardless of version param
    expect(content1).toBe(content2);

    // And still complete
    expect(content1).toContain('return { mapboxUsaMap };');
  });
});
