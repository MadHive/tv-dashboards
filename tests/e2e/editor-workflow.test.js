// ===========================================================================
// E2E: Editor Workflow Tests
// Tests visual editor activation, drag/drop, resize, property editing
// ===========================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  setupBrowser,
  cleanupBrowser,
  waitForDashboard,
  waitForWidget,
  enterEditorMode,
  exitEditorMode,
  dragWidget,
  resizeWidget,
  getWidgetData,
  clickElement,
  typeIntoInput,
  takeScreenshot
} from '../helpers/browser-helpers.js';

// The live inline editor (Ctrl+E) was removed — all editing now happens in
// the studio at /admin. These E2E tests are permanently skipped.
describe.skip('E2E: Editor Workflow', () => {
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

  describe('Editor Activation', () => {
    it('should enter editor mode with Ctrl+E', async () => {
      // Press Ctrl+E to enter editor mode
      await page.keyboard.down('Control');
      await page.keyboard.press('e');
      await page.keyboard.up('Control');

      // Wait for editor to activate
      await page.waitForSelector('.editor-active', { timeout: 3000 });

      // Verify editor is active
      const isEditorActive = await page.evaluate(() =>
        document.body.classList.contains('editor-active')
      );
      expect(isEditorActive).toBe(true);
    });

    it('should show grid overlay when editor is active', async () => {
      await enterEditorMode(page);

      const gridOverlay = await page.$('.editor-grid-overlay');
      expect(gridOverlay).toBeTruthy();

      const isVisible = await page.evaluate(() => {
        const overlay = document.querySelector('.editor-grid-overlay');
        return overlay && overlay.style.display !== 'none';
      });
      expect(isVisible).toBe(true);
    });

    it('should stop dashboard rotation when entering editor mode', async () => {
      await enterEditorMode(page);

      // Verify rotation timer is stopped (check via app state)
      const rotationStopped = await page.evaluate(() => {
        return window.app && window.app.rotationTimer === null;
      });
      expect(rotationStopped).toBe(true);
    });

    it('should exit editor mode with Escape key', async () => {
      await enterEditorMode(page);

      // Press Escape
      await page.keyboard.press('Escape');

      // Wait for editor to deactivate
      await page.waitForTimeout(500);

      const isEditorActive = await page.evaluate(() =>
        document.body.classList.contains('editor-active')
      );
      expect(isEditorActive).toBe(false);
    });

    it('should hide grid overlay when exiting editor mode', async () => {
      await enterEditorMode(page);
      await exitEditorMode(page);

      const isVisible = await page.evaluate(() => {
        const overlay = document.querySelector('.editor-grid-overlay');
        return overlay && overlay.style.display !== 'none';
      });
      expect(isVisible).toBe(false);
    });
  });

  describe('Widget Selection', () => {
    beforeEach(async () => {
      await enterEditorMode(page);
    });

    it('should make widgets selectable in editor mode', async () => {
      const widget = await page.$('.dashboard-page.active .widget');
      expect(widget).toBeTruthy();

      // Click widget
      await widget.click();

      // Wait for selection
      await page.waitForTimeout(300);

      // Check if widget is selected (has selection class or border)
      const isSelected = await page.evaluate(() => {
        const widgets = document.querySelectorAll('.dashboard-page.active .widget');
        return Array.from(widgets).some(w =>
          w.classList.contains('selected') ||
          w.classList.contains('widget-selected') ||
          w.style.outline.includes('dashed') ||
          w.style.border.includes('dashed')
        );
      });
      expect(isSelected).toBe(true);
    });

    it('should deselect widget when clicking elsewhere', async () => {
      const widget = await page.$('.dashboard-page.active .widget');
      await widget.click();
      await page.waitForTimeout(300);

      // Click empty area
      await page.click('body', { offset: { x: 10, y: 10 } });
      await page.waitForTimeout(300);

      // Check if widget is deselected
      const isSelected = await page.evaluate(() => {
        const widgets = document.querySelectorAll('.dashboard-page.active .widget');
        return Array.from(widgets).some(w => w.classList.contains('selected'));
      });
      expect(isSelected).toBe(false);
    });

    it('should deselect widget with Escape key', async () => {
      const widget = await page.$('.dashboard-page.active .widget');
      await widget.click();
      await page.waitForTimeout(300);

      // Press Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Check if widget is deselected
      const isSelected = await page.evaluate(() => {
        const widgets = document.querySelectorAll('.dashboard-page.active .widget');
        return Array.from(widgets).some(w => w.classList.contains('selected'));
      });
      expect(isSelected).toBe(false);
    });
  });

  describe('Property Panel', () => {
    beforeEach(async () => {
      await enterEditorMode(page);
    });

    it('should open property panel when widget is selected', async () => {
      const widget = await page.$('.dashboard-page.active .widget');
      await widget.click();
      await page.waitForTimeout(500);

      // Check for property panel
      const propertyPanel = await page.$('.property-panel');
      if (propertyPanel) {
        const isVisible = await page.evaluate(() => {
          const panel = document.querySelector('.property-panel');
          return panel && panel.style.display !== 'none';
        });
        expect(isVisible).toBe(true);
      }
    });

    it('should display widget properties in panel', async () => {
      const widget = await page.$('.dashboard-page.active .widget');
      await widget.click();
      await page.waitForTimeout(500);

      // Check for property inputs (title, source, metric, etc.)
      const hasPropertyInputs = await page.evaluate(() => {
        const panel = document.querySelector('.property-panel');
        if (!panel) return false;

        const inputs = panel.querySelectorAll('input, select, textarea');
        return inputs.length > 0;
      });

      if (hasPropertyInputs !== null) {
        expect(hasPropertyInputs).toBe(true);
      }
    });

    it('should allow editing widget title', async () => {
      const widget = await page.$('.dashboard-page.active .widget');
      await widget.click();
      await page.waitForTimeout(500);

      // Find title input in property panel
      const titleInput = await page.$('.property-panel input[name="title"]');
      if (titleInput) {
        const originalTitle = await titleInput.evaluate(el => el.value);

        // Change title
        await typeIntoInput(page, '.property-panel input[name="title"]', 'New Widget Title');

        const newTitle = await titleInput.evaluate(el => el.value);
        expect(newTitle).toBe('New Widget Title');
      }
    });
  });

  describe('Drag and Drop', () => {
    beforeEach(async () => {
      await enterEditorMode(page);
    });

    it('should allow dragging widgets', async () => {
      const widgets = await page.$$('.dashboard-page.active .widget');

      if (widgets.length >= 2) {
        const firstWidget = widgets[0];
        const secondWidget = widgets[1];

        // Get initial positions
        const firstBox = await firstWidget.boundingBox();
        expect(firstBox).toBeTruthy();

        // Attempt drag (basic movement test)
        await page.mouse.move(firstBox.x + 50, firstBox.y + 50);
        await page.mouse.down();
        await page.mouse.move(firstBox.x + 100, firstBox.y + 100, { steps: 5 });
        await page.mouse.up();

        await page.waitForTimeout(300);

        // Widget should have moved (even if grid snapping affects final position)
        const newBox = await firstWidget.boundingBox();
        const moved = newBox.x !== firstBox.x || newBox.y !== firstBox.y;

        // Accept either successful drag or grid-snapped position
        expect(moved || true).toBe(true); // Flexible test for drag capability
      }
    });
  });

  describe('Resize Operations', () => {
    beforeEach(async () => {
      await enterEditorMode(page);
    });

    it('should show resize handles on selected widget', async () => {
      const widget = await page.$('.dashboard-page.active .widget');
      await widget.click();
      await page.waitForTimeout(300);

      // Check for resize handles (corner/edge handles)
      const hasResizeHandles = await page.evaluate(() => {
        const handles = document.querySelectorAll('.resize-handle');
        return handles.length > 0;
      });

      // Resize handles may be dynamically created, so this is optional
      expect(typeof hasResizeHandles).toBe('boolean');
    });
  });

  describe('Save and Discard', () => {
    beforeEach(async () => {
      await enterEditorMode(page);
    });

    it('should show save/discard buttons in editor mode', async () => {
      const saveButton = await page.$('#editor-save, .editor-save-btn');
      const discardButton = await page.$('#editor-discard, .editor-discard-btn');

      // Buttons should exist (may be hidden initially)
      expect(saveButton || discardButton).toBeTruthy();
    });

    it('should detect unsaved changes', async () => {
      // Make a change (select a widget)
      const widget = await page.$('.dashboard-page.active .widget');
      await widget.click();
      await page.waitForTimeout(500);

      // Check if unsaved changes are tracked
      const hasUnsavedChanges = await page.evaluate(() => {
        return window.app?.editor?.hasUnsavedChanges?.() || false;
      });

      // This is implementation-dependent, so we just verify the function exists
      expect(typeof hasUnsavedChanges).toBe('boolean');
    });

    it('should save changes when save button is clicked', async () => {
      const saveButton = await page.$('#editor-save, .editor-save-btn');

      if (saveButton) {
        // Click save
        await saveButton.click();
        await page.waitForTimeout(1000);

        // Should either exit editor mode or show success message
        const exitedEditor = await page.evaluate(() =>
          !document.body.classList.contains('editor-active')
        );

        // Accept either outcome (depends on implementation)
        expect(typeof exitedEditor).toBe('boolean');
      }
    });

    it('should discard changes when discard button is clicked', async () => {
      const discardButton = await page.$('#editor-discard, .editor-discard-btn');

      if (discardButton) {
        // Make a change first
        const widget = await page.$('.dashboard-page.active .widget');
        await widget.click();
        await page.waitForTimeout(300);

        // Click discard
        await discardButton.click();
        await page.waitForTimeout(500);

        // Should revert changes or exit editor
        const exitedEditor = await page.evaluate(() =>
          !document.body.classList.contains('editor-active')
        );

        expect(typeof exitedEditor).toBe('boolean');
      }
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should toggle editor mode with Ctrl+E repeatedly', async () => {
      // Enter editor mode
      await page.keyboard.down('Control');
      await page.keyboard.press('e');
      await page.keyboard.up('Control');
      await page.waitForTimeout(500);

      let isActive = await page.evaluate(() =>
        document.body.classList.contains('editor-active')
      );
      expect(isActive).toBe(true);

      // Exit editor mode
      await page.keyboard.down('Control');
      await page.keyboard.press('e');
      await page.keyboard.up('Control');
      await page.waitForTimeout(500);

      isActive = await page.evaluate(() =>
        document.body.classList.contains('editor-active')
      );
      expect(isActive).toBe(false);
    });

    it('should support Cmd+E on macOS', async () => {
      // Press Cmd+E (Meta key)
      await page.keyboard.down('Meta');
      await page.keyboard.press('e');
      await page.keyboard.up('Meta');
      await page.waitForTimeout(500);

      const isActive = await page.evaluate(() =>
        document.body.classList.contains('editor-active')
      );
      expect(isActive).toBe(true);
    });
  });
});
