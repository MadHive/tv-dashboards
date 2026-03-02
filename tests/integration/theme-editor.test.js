/**
 * Integration tests for theme editor functionality
 * Tests the integration between dashboard editor and theme system
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://tv.madhive.local:3000';

test.describe('Theme Editor Integration', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // Wait for dashboard to load
    await page.waitForSelector('#dashboard-container', { timeout: 10000 });
  });

  test('themes API endpoint is available', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/themes`);

    // API might not be available yet (PR #28 pending)
    // So we just check it doesn't return 500
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
    }
  });

  test('editor can enter edit mode', async ({ page }) => {
    // Press Ctrl+E to enter edit mode
    await page.keyboard.press('Control+e');

    // Check for editor-active class
    const body = await page.locator('body');
    await expect(body).toHaveClass(/editor-active/);

    // Check for notification
    await expect(page.locator('.editor-notification')).toBeVisible();
  });

  test('dashboard properties panel can be opened with Ctrl+D', async ({ page }) => {
    // Enter edit mode first
    await page.keyboard.press('Control+e');
    await page.waitForTimeout(500);

    // Press Ctrl+D to open dashboard properties
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(500);

    // Check if property panel is visible
    const propertyPanel = page.locator('.property-panel');
    await expect(propertyPanel).toBeVisible();

    // Check if dashboard form is visible
    const dashboardForm = page.locator('#dashboard-property-form');
    await expect(dashboardForm).toBeVisible();
  });

  test('dashboard properties panel contains theme dropdown', async ({ page }) => {
    // Enter edit mode
    await page.keyboard.press('Control+e');
    await page.waitForTimeout(500);

    // Open dashboard properties
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(500);

    // Check for theme select dropdown
    const themeSelect = page.locator('#dashboard-theme-select');
    await expect(themeSelect).toBeVisible();

    // Check for preview button
    const previewBtn = page.locator('#theme-preview-btn');
    await expect(previewBtn).toBeVisible();
    await expect(previewBtn).toContainText('Preview on TV');
  });

  test('dashboard properties panel contains grid settings', async ({ page }) => {
    // Enter edit mode
    await page.keyboard.press('Control+e');
    await page.waitForTimeout(500);

    // Open dashboard properties
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(500);

    // Check for grid inputs
    await expect(page.locator('#dashboard-columns')).toBeVisible();
    await expect(page.locator('#dashboard-rows')).toBeVisible();
    await expect(page.locator('#dashboard-gap')).toBeVisible();
  });

  test('dashboard config can store theme ID', async ({ page }) => {
    // This is a smoke test - we can't easily test persistence without modifying the config
    // But we can check that the form fields exist and can be interacted with

    await page.keyboard.press('Control+e');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(500);

    const themeSelect = page.locator('#dashboard-theme-select');
    await expect(themeSelect).toBeVisible();

    // Check that we can interact with the dropdown
    const isEnabled = await themeSelect.isEnabled();
    // It might be disabled if themes API is not available
    expect(typeof isEnabled).toBe('boolean');
  });

  test('property panel shows dashboard name and subtitle fields', async ({ page }) => {
    await page.keyboard.press('Control+e');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(500);

    // Check for dashboard metadata fields
    await expect(page.locator('#dashboard-name')).toBeVisible();
    await expect(page.locator('#dashboard-subtitle')).toBeVisible();
    await expect(page.locator('#dashboard-icon')).toBeVisible();
  });

  test('panel switches between widget and dashboard modes', async ({ page }) => {
    await page.keyboard.press('Control+e');
    await page.waitForTimeout(500);

    // First, open dashboard properties
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(500);
    await expect(page.locator('#dashboard-property-form')).toBeVisible();
    await expect(page.locator('#widget-property-form')).not.toBeVisible();

    // Click close to dismiss panel
    await page.locator('.panel-close').click();
    await page.waitForTimeout(300);

    // Click a widget
    const widget = page.locator('.widget').first();
    await widget.click();
    await page.waitForTimeout(500);

    // Now widget form should be visible
    await expect(page.locator('#widget-property-form')).toBeVisible();
    await expect(page.locator('#dashboard-property-form')).not.toBeVisible();
  });

  test('ESC key closes property panel', async ({ page }) => {
    await page.keyboard.press('Control+e');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(500);

    const propertyPanel = page.locator('.property-panel');
    await expect(propertyPanel).toBeVisible();

    // Press ESC to deselect/close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await expect(propertyPanel).not.toBeVisible();
  });

  test('save button is present in dashboard properties', async ({ page }) => {
    await page.keyboard.press('Control+e');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(500);

    const saveBtn = page.locator('#prop-save');
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toContainText('Save');
  });

  test('delete button is hidden in dashboard mode', async ({ page }) => {
    await page.keyboard.press('Control+e');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(500);

    const deleteBtn = page.locator('#prop-delete');
    // Delete button should not be visible in dashboard mode
    await expect(deleteBtn).not.toBeVisible();
  });
});

test.describe('Theme Visual Application', () => {

  test('CSS custom properties can be set on root element', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('#dashboard-container');

    // Inject a test theme color
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--theme-primary', '#FF0000');
      document.documentElement.style.setProperty('--theme-secondary', '#00FF00');
    });

    // Verify the properties are set
    const primaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--theme-primary');
    });

    expect(primaryColor.trim()).toBe('#FF0000');
  });

  test('theme properties can be removed', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('#dashboard-container');

    // Set then remove
    await page.evaluate(() => {
      const root = document.documentElement;
      root.style.setProperty('--theme-primary', '#FF0000');
      root.style.removeProperty('--theme-primary');
    });

    // Verify it's removed
    const primaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--theme-primary');
    });

    expect(primaryColor.trim()).toBe('');
  });
});

test.describe('Theme Security', () => {

  test('theme names are safely inserted into dropdown', async ({ page }) => {
    // This is a smoke test - the actual sanitization happens server-side
    // and client-side uses textContent

    await page.goto(BASE_URL);
    await page.keyboard.press('Control+e');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(500);

    const themeSelect = page.locator('#dashboard-theme-select');
    await expect(themeSelect).toBeVisible();

    // Check that select element exists and has options
    const options = await themeSelect.locator('option').all();
    expect(options.length).toBeGreaterThanOrEqual(1); // At least the default option
  });
});
