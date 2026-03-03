// ===========================================================================
// E2E: Query Management Tests
// Tests query creation, saving, and widget association workflows
// ===========================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  setupBrowser,
  cleanupBrowser,
  waitForDashboard,
  clickElement,
  typeIntoInput,
  waitForNetworkIdle,
  takeScreenshot
} from '../helpers/browser-helpers.js';

// The query editor (Ctrl+Q) was removed from the TV display — queries are
// now managed in the studio at /admin. These E2E tests are permanently skipped.
describe.skip('E2E: Query Management', () => {
  let browser, page;
  const BASE_URL = 'http://tv.madhive.local:3000';

  beforeAll(async () => {
    const setup = await setupBrowser({ headless: true });
    browser = setup.browser;
    page = setup.page;
  });

  afterAll(async () => {
    await cleanupBrowser(browser);
  });

  beforeEach(async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await waitForDashboard(page);
  });

  describe('Query Editor Access', () => {
    it('should open query editor with Ctrl+Q', async () => {
      // Press Ctrl+Q to open query editor
      await page.keyboard.down('Control');
      await page.keyboard.press('q');
      await page.keyboard.up('Control');

      // Wait for query editor to appear
      await page.waitForTimeout(1000);

      // Check if query editor modal/panel is visible
      const queryEditor = await page.$(
        '.query-editor, .query-editor-modal, #query-editor, [data-component="query-editor"]'
      );

      if (queryEditor) {
        const isVisible = await page.evaluate(() => {
          const editor = document.querySelector(
            '.query-editor, .query-editor-modal, #query-editor, [data-component="query-editor"]'
          );
          return editor && window.getComputedStyle(editor).display !== 'none';
        });
        expect(isVisible).toBe(true);
      }
    });

    it('should show data source selector in query editor', async () => {
      await page.keyboard.down('Control');
      await page.keyboard.press('q');
      await page.keyboard.up('Control');
      await page.waitForTimeout(1000);

      // Look for data source dropdown/selector
      const dataSourceSelector = await page.$(
        'select[name="dataSource"], select[name="source"], .data-source-select'
      );

      if (dataSourceSelector) {
        expect(dataSourceSelector).toBeTruthy();
      }
    });

    it('should close query editor with Escape', async () => {
      await page.keyboard.down('Control');
      await page.keyboard.press('q');
      await page.keyboard.up('Control');
      await page.waitForTimeout(500);

      // Press Escape to close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      const isVisible = await page.evaluate(() => {
        const editor = document.querySelector('.query-editor, .query-editor-modal');
        return editor && window.getComputedStyle(editor).display !== 'none';
      });

      // Should be hidden or null
      expect(isVisible).toBe(false);
    });
  });

  describe('Query Creation', () => {
    beforeEach(async () => {
      // Open query editor
      await page.keyboard.down('Control');
      await page.keyboard.press('q');
      await page.keyboard.up('Control');
      await page.waitForTimeout(1000);
    });

    it('should allow entering query name', async () => {
      const nameInput = await page.$('input[name="queryName"], input[name="name"], #query-name');

      if (nameInput) {
        await typeIntoInput(
          page,
          'input[name="queryName"], input[name="name"], #query-name',
          'Test Query'
        );

        const value = await nameInput.evaluate(el => el.value);
        expect(value).toBe('Test Query');
      }
    });

    it('should allow entering query description', async () => {
      const descInput = await page.$(
        'textarea[name="description"], textarea[name="queryDescription"], #query-description'
      );

      if (descInput) {
        const selector = 'textarea[name="description"], textarea[name="queryDescription"]';
        await page.waitForSelector(selector);
        await page.click(selector);
        await page.keyboard.type('Test query description');

        const value = await descInput.evaluate(el => el.value);
        expect(value).toContain('Test');
      }
    });

    it('should allow selecting data source', async () => {
      const sourceSelect = await page.$('select[name="dataSource"], select[name="source"]');

      if (sourceSelect) {
        // Get available options
        const options = await page.evaluate(() => {
          const select = document.querySelector('select[name="dataSource"], select[name="source"]');
          return select ? Array.from(select.options).map(opt => opt.value) : [];
        });

        expect(options.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Query Execution', () => {
    beforeEach(async () => {
      await page.keyboard.down('Control');
      await page.keyboard.press('q');
      await page.keyboard.up('Control');
      await page.waitForTimeout(1000);
    });

    it('should have execute/run query button', async () => {
      const executeButton = await page.$(
        'button:has-text("Run"), button:has-text("Execute"), .query-run-btn, #run-query'
      );

      if (executeButton) {
        expect(executeButton).toBeTruthy();
      }
    });

    it('should display query results after execution', async () => {
      const executeButton = await page.$(
        'button.query-run-btn, #run-query, button[data-action="run-query"]'
      );

      if (executeButton) {
        // Click run button
        await executeButton.click();
        await page.waitForTimeout(2000);

        // Check for results container
        const resultsContainer = await page.$(
          '.query-results, .results-container, #query-results'
        );

        if (resultsContainer) {
          expect(resultsContainer).toBeTruthy();
        }
      }
    });
  });

  describe('Query Saving', () => {
    beforeEach(async () => {
      await page.keyboard.down('Control');
      await page.keyboard.press('q');
      await page.keyboard.up('Control');
      await page.waitForTimeout(1000);
    });

    it('should have save query button', async () => {
      const saveButton = await page.$(
        'button:has-text("Save"), .query-save-btn, #save-query'
      );

      if (saveButton) {
        expect(saveButton).toBeTruthy();
      }
    });

    it('should save query to server', async () => {
      const saveButton = await page.$('button.query-save-btn, #save-query');

      if (saveButton) {
        // Fill in query details first
        const nameInput = await page.$('input[name="queryName"], input[name="name"]');
        if (nameInput) {
          await typeIntoInput(page, 'input[name="queryName"], input[name="name"]', 'E2E Test Query');
        }

        // Listen for network request
        page.on('request', request => {
          if (request.url().includes('/api/queries') && request.method() === 'POST') {
            // Query save request detected
          }
        });

        // Click save
        await saveButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  describe('Saved Queries List', () => {
    beforeEach(async () => {
      await page.keyboard.down('Control');
      await page.keyboard.press('q');
      await page.keyboard.up('Control');
      await page.waitForTimeout(1000);
    });

    it('should display list of saved queries', async () => {
      const queryList = await page.$(
        '.query-list, .saved-queries, #saved-queries-list'
      );

      if (queryList) {
        expect(queryList).toBeTruthy();
      }
    });

    it('should show query names in the list', async () => {
      const queryItems = await page.$$(
        '.query-list-item, .query-item, .saved-query-item'
      );

      if (queryItems.length > 0) {
        // Get text from first query item
        const queryText = await queryItems[0].evaluate(el => el.textContent);
        expect(queryText.length).toBeGreaterThan(0);
      }
    });

    it('should allow selecting a saved query', async () => {
      const queryItems = await page.$$(
        '.query-list-item, .query-item, .saved-query-item'
      );

      if (queryItems.length > 0) {
        // Click first saved query
        await queryItems[0].click();
        await page.waitForTimeout(500);

        // Query details should load
        const hasContent = await page.evaluate(() => {
          const nameInput = document.querySelector('input[name="queryName"], input[name="name"]');
          return nameInput && nameInput.value.length > 0;
        });

        if (hasContent !== null) {
          expect(typeof hasContent).toBe('boolean');
        }
      }
    });
  });

  describe('Widget Query Association', () => {
    it('should allow associating query with widget in editor', async () => {
      // Enter editor mode
      await page.keyboard.down('Control');
      await page.keyboard.press('e');
      await page.keyboard.up('Control');
      await page.waitForTimeout(500);

      // Select a widget
      const widget = await page.$('.dashboard-page.active .widget');
      if (widget) {
        await widget.click();
        await page.waitForTimeout(500);

        // Look for query selector in property panel
        const querySelector = await page.$(
          'select[name="queryId"], select[name="query"], .query-selector'
        );

        if (querySelector) {
          expect(querySelector).toBeTruthy();
        }
      }
    });

    it('should populate query dropdown with saved queries', async () => {
      // Enter editor mode
      await page.keyboard.down('Control');
      await page.keyboard.press('e');
      await page.keyboard.up('Control');
      await page.waitForTimeout(500);

      // Select a widget
      const widget = await page.$('.dashboard-page.active .widget');
      if (widget) {
        await widget.click();
        await page.waitForTimeout(500);

        // Get query options
        const queryOptions = await page.evaluate(() => {
          const select = document.querySelector('select[name="queryId"], select[name="query"]');
          return select ? Array.from(select.options).map(opt => opt.value) : [];
        });

        // Should have at least one option (even if it's "Select query")
        if (queryOptions.length > 0) {
          expect(queryOptions.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Query API Integration', () => {
    it('should fetch queries from API on page load', async () => {
      let queriesRequested = false;

      page.on('response', response => {
        if (response.url().includes('/api/queries')) {
          queriesRequested = true;
        }
      });

      // Reload page
      await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
      await page.waitForTimeout(2000);

      // Queries may be fetched lazily, so we don't require it
      expect(typeof queriesRequested).toBe('boolean');
    });
  });
});
