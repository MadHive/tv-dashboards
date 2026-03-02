// ===========================================================================
// Browser Automation Helpers — Puppeteer utilities for E2E tests
// Provides common browser automation patterns with sensible defaults
// ===========================================================================

import puppeteer from 'puppeteer';

/**
 * Launch browser with default configuration for E2E tests
 *
 * @param {Object} options - Browser launch options
 * @param {boolean} options.headless - Run browser in headless mode (default: true)
 * @param {Object} options.viewport - Viewport dimensions (default: 1920x1080)
 * @param {number} options.viewport.width - Viewport width in pixels
 * @param {number} options.viewport.height - Viewport height in pixels
 * @param {boolean} options.devtools - Open DevTools automatically (default: false)
 * @param {number} options.slowMo - Slow down operations by milliseconds (default: 0)
 * @param {Array<string>} options.args - Additional Chrome arguments
 * @returns {Promise<{browser: Browser, page: Page}>} Browser and page instances
 *
 * @example
 * const { browser, page } = await setupBrowser();
 * try {
 *   await page.goto('http://tv.madhive.local:3000');
 *   // ... test operations
 * } finally {
 *   await browser.close();
 * }
 */
export async function setupBrowser(options = {}) {
  const {
    headless = true,
    viewport = { width: 1920, height: 1080 },
    devtools = false,
    slowMo = 0,
    args = []
  } = options;

  // Default Chrome arguments for better test stability
  const defaultArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu'
  ];

  const browser = await puppeteer.launch({
    headless,
    devtools,
    slowMo,
    args: [...defaultArgs, ...args]
  });

  const page = await browser.newPage();

  // Set viewport dimensions
  await page.setViewport(viewport);

  return { browser, page };
}

/**
 * Wait for a widget to render and become visible
 * Polls for widget element with custom timeout
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector for the widget
 * @param {number} timeout - Maximum wait time in milliseconds (default: 30000)
 * @returns {Promise<ElementHandle>} The widget element
 * @throws {Error} If widget doesn't appear within timeout
 *
 * @example
 * // Wait for metric widget with default timeout
 * await waitForWidget(page, '[data-widget-id="metric-1"]');
 *
 * // Wait with custom timeout
 * await waitForWidget(page, '.chart-widget', 10000);
 */
export async function waitForWidget(page, selector, timeout = 30000) {
  try {
    const element = await page.waitForSelector(selector, {
      visible: true,
      timeout
    });

    if (!element) {
      throw new Error(`Widget not found: ${selector}`);
    }

    return element;
  } catch (error) {
    // Enhance error message with page state for debugging
    const url = page.url();
    throw new Error(
      `Failed to find widget "${selector}" on ${url} within ${timeout}ms: ${error.message}`
    );
  }
}

/**
 * Capture screenshot for debugging test failures
 * Automatically creates directory if it doesn't exist
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} path - Output path for screenshot (relative or absolute)
 * @param {Object} options - Screenshot options
 * @param {boolean} options.fullPage - Capture full scrollable page (default: false)
 * @param {string} options.type - Image type: 'png' or 'jpeg' (default: 'png')
 * @returns {Promise<void>}
 *
 * @example
 * // Capture viewport screenshot
 * await takeScreenshot(page, 'tests/screenshots/widget-render.png');
 *
 * // Capture full page
 * await takeScreenshot(page, 'tests/screenshots/dashboard.png', { fullPage: true });
 */
export async function takeScreenshot(page, path, options = {}) {
  const {
    fullPage = false,
    type = 'png'
  } = options;

  try {
    await page.screenshot({
      path,
      fullPage,
      type
    });
  } catch (error) {
    // Non-fatal error - log but don't fail the test
    console.warn(`Failed to capture screenshot at ${path}:`, error.message);
  }
}

/**
 * Simulate drag and drop operation between two elements
 * Useful for testing widget reordering and layout changes
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} fromSelector - CSS selector for element to drag
 * @param {string} toSelector - CSS selector for drop target
 * @param {Object} options - Drag options
 * @param {number} options.delay - Delay between mouse events in ms (default: 100)
 * @returns {Promise<void>}
 * @throws {Error} If either element is not found
 *
 * @example
 * // Drag widget-1 to widget-2's position
 * await dragWidget(page, '[data-widget-id="1"]', '[data-widget-id="2"]');
 *
 * // Drag with slower animation for debugging
 * await dragWidget(page, '.source', '.target', { delay: 500 });
 */
export async function dragWidget(page, fromSelector, toSelector, options = {}) {
  const { delay = 100 } = options;

  try {
    // Wait for both elements to be present and visible
    const fromElement = await page.waitForSelector(fromSelector, { visible: true });
    const toElement = await page.waitForSelector(toSelector, { visible: true });

    if (!fromElement || !toElement) {
      throw new Error(`Drag elements not found: from="${fromSelector}", to="${toSelector}"`);
    }

    // Get bounding boxes for both elements
    const fromBox = await fromElement.boundingBox();
    const toBox = await toElement.boundingBox();

    if (!fromBox || !toBox) {
      throw new Error('Could not get element bounding boxes for drag operation');
    }

    // Calculate center points
    const fromX = fromBox.x + fromBox.width / 2;
    const fromY = fromBox.y + fromBox.height / 2;
    const toX = toBox.x + toBox.width / 2;
    const toY = toBox.y + toBox.height / 2;

    // Perform drag operation
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.waitForTimeout(delay);
    await page.mouse.move(toX, toY, { steps: 10 });
    await page.waitForTimeout(delay);
    await page.mouse.up();

  } catch (error) {
    throw new Error(
      `Drag operation failed from "${fromSelector}" to "${toSelector}": ${error.message}`
    );
  }
}

// ===========================================================================
// Additional Helper Functions
// ===========================================================================

/**
 * Wait for dashboard to load and become active
 *
 * @param {Page} page - Puppeteer page instance
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<void>}
 */
export async function waitForDashboard(page, timeout = 10000) {
  await page.waitForSelector('.dashboard-page.active', {
    timeout,
    visible: true
  });
}

/**
 * Resize widget by dragging resize handle
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} widgetId - Widget ID to resize
 * @param {number} width - New width in pixels
 * @param {number} height - New height in pixels
 * @returns {Promise<void>}
 */
export async function resizeWidget(page, widgetId, width, height) {
  const widget = await page.$(`[data-widget-id="${widgetId}"]`);
  if (!widget) {
    throw new Error(`Widget ${widgetId} not found`);
  }

  const box = await widget.boundingBox();

  // Find resize handle (bottom-right)
  await page.mouse.move(box.x + box.width - 5, box.y + box.height - 5);
  await page.mouse.down();
  await page.mouse.move(box.x + width, box.y + height, { steps: 10 });
  await page.mouse.up();
}

/**
 * Navigate to specific dashboard
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} dashboardId - Dashboard ID to navigate to
 * @returns {Promise<void>}
 */
export async function navigateToDashboard(page, dashboardId) {
  await page.goto(`http://tv.madhive.local:3000/?dashboard=${dashboardId}`, {
    waitUntil: 'networkidle0'
  });
}

/**
 * Enter editor mode via keyboard shortcut
 *
 * @param {Page} page - Puppeteer page instance
 * @returns {Promise<void>}
 */
export async function enterEditorMode(page) {
  await page.keyboard.press('e');
  await page.waitForSelector('.editor-active', { timeout: 3000 });
}

/**
 * Exit editor mode
 *
 * @param {Page} page - Puppeteer page instance
 * @param {boolean} save - Whether to save changes (default: false)
 * @returns {Promise<void>}
 */
export async function exitEditorMode(page, save = false) {
  if (save) {
    await page.click('.editor-save-btn');
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForSelector('.editor-active', { hidden: true, timeout: 3000 });
}

/**
 * Get widget data attributes from DOM
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} widgetId - Widget ID to query
 * @returns {Promise<Object|null>} Widget data or null if not found
 */
export async function getWidgetData(page, widgetId) {
  return page.evaluate((id) => {
    const widget = document.querySelector(`[data-widget-id="${id}"]`);
    if (!widget) return null;

    return {
      id: widget.dataset.widgetId,
      type: widget.dataset.widgetType,
      source: widget.dataset.source,
      x: parseInt(widget.dataset.x),
      y: parseInt(widget.dataset.y),
      width: parseInt(widget.dataset.width),
      height: parseInt(widget.dataset.height)
    };
  }, widgetId);
}

/**
 * Click element by CSS selector
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector
 * @returns {Promise<void>}
 */
export async function clickElement(page, selector) {
  await page.waitForSelector(selector);
  await page.click(selector);
}

/**
 * Type text into input field (clears existing content first)
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector for input field
 * @param {string} text - Text to type
 * @returns {Promise<void>}
 */
export async function typeIntoInput(page, selector, text) {
  await page.waitForSelector(selector);
  await page.click(selector);
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type(selector, text);
}

/**
 * Wait for network to become idle (no requests for specified time)
 *
 * @param {Page} page - Puppeteer page instance
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<void>}
 */
export async function waitForNetworkIdle(page, timeout = 5000) {
  await page.waitForNetworkIdle({ timeout });
}

/**
 * Capture console logs from the page
 * Call this before page operations to start capturing
 *
 * @param {Page} page - Puppeteer page instance
 * @returns {Array} Array reference that will be populated with console messages
 *
 * @example
 * const logs = captureConsoleLogs(page);
 * await page.goto('http://tv.madhive.local:3000');
 * // logs array now contains all console messages
 */
export function captureConsoleLogs(page) {
  const logs = [];

  page.on('console', msg => {
    logs.push({
      type: msg.type(),
      text: msg.text()
    });
  });

  return logs;
}

/**
 * Clean up browser instance
 * Use in test cleanup/teardown to ensure browser is properly closed
 *
 * @param {Browser} browser - Puppeteer browser instance
 * @returns {Promise<void>}
 */
export async function cleanupBrowser(browser) {
  if (browser) {
    try {
      await browser.close();
    } catch (error) {
      console.warn('Error closing browser:', error.message);
    }
  }
}
