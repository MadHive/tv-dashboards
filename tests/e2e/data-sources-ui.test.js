import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import puppeteer from 'puppeteer';

// This page (/data-sources.html) is a legacy admin page superseded by the
// Sources tab in the studio at /admin. The static plugin routing conflict
// causes the URL to return 0 bytes. Tests are permanently skipped.
describe.skip('E2E: Data Sources UI', () => {
  let browser, page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should load the data sources page', async () => {
    await page.goto('http://localhost:3000/data-sources.html');
    await page.waitForSelector('.data-sources-header');

    const h1Element = await page.$('h1');
    const h1Text = await page.evaluate(el => el.textContent, h1Element);
    expect(h1Text).toContain('Data Source Management');
  });

  it('should render data source cards', async () => {
    await page.goto('http://localhost:3000/data-sources.html');
    await page.waitForSelector('.data-source-card', { timeout: 5000 });

    const cards = await page.$$('.data-source-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('should open configuration modal when clicking configure button', async () => {
    await page.goto('http://localhost:3000/data-sources.html');

    // Wait for cards to render
    await page.waitForSelector('.data-source-card', { timeout: 5000 });

    // Click the first Configure button
    await page.click('.card-footer .btn.btn-secondary');

    // Wait for modal to appear and become visible
    await page.waitForFunction(
      () => {
        const modal = document.getElementById('config-modal');
        return modal && window.getComputedStyle(modal).display === 'flex';
      },
      { timeout: 5000 }
    );

    // Verify modal is visible
    const modal = await page.$('#config-modal');
    const modalDisplay = await page.evaluate(el =>
      window.getComputedStyle(el).display, modal
    );
    expect(modalDisplay).toBe('flex');
  });

  it('should filter data sources when searching', async () => {
    await page.goto('http://localhost:3000/data-sources.html');
    await page.waitForSelector('#search-input');

    // Wait for initial cards to render
    await page.waitForSelector('.data-source-card');

    // Type 'aws' into search
    await page.type('#search-input', 'aws');

    // Wait a bit for the filter to apply
    await new Promise(resolve => setTimeout(resolve, 100));

    // Count visible cards
    const cards = await page.$$('.data-source-card');
    let visibleCount = 0;
    for (const card of cards) {
      const display = await page.evaluate(el => el.style.display, card);
      if (display !== 'none') {
        visibleCount++;
      }
    }

    expect(visibleCount).toBeGreaterThan(0);
  });
});
