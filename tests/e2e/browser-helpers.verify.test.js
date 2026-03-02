// ===========================================================================
// Browser Helpers Verification Test
// Simple test to verify browser-helpers.js imports and functions work
// ===========================================================================

import { describe, it, expect } from 'bun:test';
import { setupBrowser, cleanupBrowser } from '../helpers/browser-helpers.js';

describe('Browser Helpers - Module Verification', () => {
  it('should import setupBrowser function', () => {
    expect(setupBrowser).toBeDefined();
    expect(typeof setupBrowser).toBe('function');
  });

  it('should launch browser with default configuration', async () => {
    const { browser, page } = await setupBrowser();

    expect(browser).toBeDefined();
    expect(page).toBeDefined();

    // Verify viewport dimensions (default: 1920x1080)
    const viewport = page.viewport();
    expect(viewport.width).toBe(1920);
    expect(viewport.height).toBe(1080);

    // Cleanup
    await cleanupBrowser(browser);
  });

  it('should launch browser with custom viewport', async () => {
    const { browser, page } = await setupBrowser({
      viewport: { width: 1280, height: 720 }
    });

    const viewport = page.viewport();
    expect(viewport.width).toBe(1280);
    expect(viewport.height).toBe(720);

    await cleanupBrowser(browser);
  });

  it('should navigate to a simple page', async () => {
    const { browser, page } = await setupBrowser();

    // Navigate to a blank page
    await page.goto('about:blank');

    const url = page.url();
    expect(url).toBe('about:blank');

    await cleanupBrowser(browser);
  });
});
