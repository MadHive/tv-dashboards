// ===========================================================================
// DOM Helpers Tests — Verify DOM testing utilities
// ===========================================================================

import { describe, it, beforeEach, afterEach } from 'bun:test';
import assert from 'assert';
import {
  setupDOM,
  loadScript,
  mockCanvas,
  simulateClick,
  simulateKeyboard,
  simulateInput,
  waitForElement,
  getCanvasOperations,
  clearCanvasOperations
} from './dom-helpers.js';

describe('DOM Helpers', () => {
  let domEnv;

  afterEach(() => {
    if (domEnv?.cleanup) {
      domEnv.cleanup();
    }
  });

  describe('setupDOM()', () => {
    it('should create DOM environment with window and document', () => {
      domEnv = setupDOM();

      assert.ok(domEnv.window, 'Should have window');
      assert.ok(domEnv.document, 'Should have document');
      assert.ok(domEnv.dom, 'Should have JSDOM instance');
      assert.strictEqual(typeof domEnv.cleanup, 'function', 'Should have cleanup function');
    });

    it('should expose test-container element', () => {
      domEnv = setupDOM();

      assert.ok(domEnv.container, 'Should have container');
      assert.strictEqual(domEnv.container.id, 'test-container', 'Container should have correct ID');
    });

    it('should set global window and document', () => {
      domEnv = setupDOM();

      assert.strictEqual(global.window, domEnv.window, 'Should set global.window');
      assert.strictEqual(global.document, domEnv.document, 'Should set global.document');
    });

    it('should cleanup globals on cleanup()', () => {
      domEnv = setupDOM();
      domEnv.cleanup();

      assert.strictEqual(global.window, undefined, 'Should clear global.window');
      assert.strictEqual(global.document, undefined, 'Should clear global.document');

      domEnv = null; // Prevent double cleanup
    });

    it('should accept custom HTML', () => {
      domEnv = setupDOM({
        html: '<!DOCTYPE html><html><body><div id="custom">Test</div></body></html>'
      });

      const custom = domEnv.document.getElementById('custom');
      assert.ok(custom, 'Should have custom element');
      assert.strictEqual(custom.textContent, 'Test', 'Should have custom content');
    });

    it('should include localStorage mock', () => {
      domEnv = setupDOM();

      assert.ok(domEnv.window.localStorage, 'Should have localStorage');
      domEnv.window.localStorage.setItem('test', 'value');
      assert.strictEqual(domEnv.window.localStorage.getItem('test'), 'value', 'localStorage should work');
    });

    it('should include fetch mock', () => {
      domEnv = setupDOM();

      assert.strictEqual(typeof domEnv.window.fetch, 'function', 'Should have fetch function');
    });
  });

  describe('loadScript()', () => {
    beforeEach(() => {
      domEnv = setupDOM();
    });

    it('should read and execute script in window context', async () => {
      // Test that loadScript reads file and executes it
      // loadScript uses Function constructor to execute scripts directly
      // rather than creating script elements (avoids Bun/JSDOM Proxy issues)

      const fs = await import('fs');
      const path = await import('path');

      // Use existing utils.js as a simple test file
      const utilsPath = path.join(process.cwd(), 'public/js/utils.js');

      if (fs.existsSync(utilsPath)) {
        // Before loading, these should not exist
        assert.ok(!domEnv.window.escapeHTML, 'escapeHTML should not exist before load');

        await loadScript(utilsPath, domEnv.window);

        // After loading, utils.js functions should be available
        assert.ok(typeof domEnv.window.escapeHTML === 'function', 'Should have escapeHTML function');
        assert.ok(typeof domEnv.window.setText === 'function', 'Should have setText function');
      } else {
        // Skip if utils.js doesn't exist
        assert.ok(true, 'Skipping - test file not found');
      }
    });

    it('should throw error for missing file', async () => {
      try {
        await loadScript('public/js/nonexistent-file-12345.js', domEnv.window);
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error.message.includes('Failed to load script'), 'Should have error message');
      }
    });

    it('should throw error if no window context', async () => {
      domEnv.cleanup();
      domEnv = null;

      try {
        await loadScript('public/js/utils.js');
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error.message.includes('No window context'), 'Should require window context');
      }
    });
  });

  describe('mockCanvas()', () => {
    beforeEach(() => {
      domEnv = setupDOM();
    });

    it('should create mock canvas context', () => {
      const canvas = domEnv.document.createElement('canvas');
      const { ctx } = mockCanvas(canvas);

      assert.ok(ctx, 'Should have context');
      assert.strictEqual(typeof ctx.fillRect, 'function', 'Should have fillRect method');
      assert.strictEqual(typeof ctx.arc, 'function', 'Should have arc method');
      assert.strictEqual(typeof ctx.beginPath, 'function', 'Should have beginPath method');
    });

    it('should track canvas operations', () => {
      const canvas = domEnv.document.createElement('canvas');
      const { ctx } = mockCanvas(canvas);

      ctx.fillRect(10, 20, 100, 50);
      ctx.arc(50, 50, 30, 0, Math.PI * 2);

      assert.ok(ctx._operations.length > 0, 'Should record operations');
      const fillRectOp = ctx._operations.find(op => op.type === 'fillRect');
      assert.ok(fillRectOp, 'Should record fillRect operation');
      assert.strictEqual(fillRectOp.x, 10, 'Should record correct x coordinate');
    });

    it('should provide getContext method', () => {
      const canvas = domEnv.document.createElement('canvas');
      const { getContext } = mockCanvas(canvas);

      const ctx = getContext('2d');
      assert.ok(ctx, 'Should return context for 2d');
      assert.strictEqual(getContext('webgl'), null, 'Should return null for webgl');
    });

    it('should mock getBoundingClientRect', () => {
      const canvas = domEnv.document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;

      mockCanvas(canvas);
      const rect = canvas.getBoundingClientRect();

      assert.strictEqual(rect.width, 800, 'Should return canvas width');
      assert.strictEqual(rect.height, 600, 'Should return canvas height');
    });

    it('should support canvas in setupDOM', () => {
      const canvas = domEnv.document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      assert.ok(ctx, 'Should get context from setupDOM mock');
      assert.strictEqual(typeof ctx.fillRect, 'function', 'Should have canvas methods');
    });
  });

  describe('simulateClick()', () => {
    beforeEach(() => {
      domEnv = setupDOM();
    });

    it('should dispatch click event', () => {
      const button = domEnv.document.createElement('button');
      let clicked = false;

      button.addEventListener('click', () => {
        clicked = true;
      });

      simulateClick(button);
      assert.strictEqual(clicked, true, 'Should trigger click handler');
    });

    it('should support custom coordinates', () => {
      const button = domEnv.document.createElement('button');
      let eventData = null;

      button.addEventListener('click', (e) => {
        eventData = { x: e.clientX, y: e.clientY };
      });

      simulateClick(button, { clientX: 100, clientY: 200 });
      assert.strictEqual(eventData.x, 100, 'Should have correct clientX');
      assert.strictEqual(eventData.y, 200, 'Should have correct clientY');
    });

    it('should throw error for missing element', () => {
      try {
        simulateClick(null);
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error.message.includes('Element is required'), 'Should require element');
      }
    });

    it('should bubble by default', () => {
      const parent = domEnv.document.createElement('div');
      const child = domEnv.document.createElement('button');
      parent.appendChild(child);

      let parentClicked = false;
      parent.addEventListener('click', () => {
        parentClicked = true;
      });

      simulateClick(child);
      assert.strictEqual(parentClicked, true, 'Should bubble to parent');
    });
  });

  describe('simulateKeyboard()', () => {
    beforeEach(() => {
      domEnv = setupDOM();
    });

    it('should dispatch keyboard event', () => {
      const input = domEnv.document.createElement('input');
      let keyPressed = null;

      input.addEventListener('keydown', (e) => {
        keyPressed = e.key;
      });

      simulateKeyboard(input, 'Enter');
      assert.strictEqual(keyPressed, 'Enter', 'Should trigger keydown with correct key');
    });

    it('should support different event types', () => {
      const input = domEnv.document.createElement('input');
      let eventType = null;

      input.addEventListener('keyup', () => {
        eventType = 'keyup';
      });

      simulateKeyboard(input, 'a', 'keyup');
      assert.strictEqual(eventType, 'keyup', 'Should trigger correct event type');
    });
  });

  describe('simulateInput()', () => {
    beforeEach(() => {
      domEnv = setupDOM();
    });

    it('should set value and dispatch input event', () => {
      const input = domEnv.document.createElement('input');
      let inputValue = null;

      input.addEventListener('input', (e) => {
        inputValue = e.target.value;
      });

      simulateInput(input, 'test value');
      assert.strictEqual(input.value, 'test value', 'Should set input value');
      assert.strictEqual(inputValue, 'test value', 'Should trigger input event');
    });
  });

  describe('waitForElement()', () => {
    beforeEach(() => {
      domEnv = setupDOM();
    });

    it('should resolve when element appears', async () => {
      setTimeout(() => {
        const div = domEnv.document.createElement('div');
        div.className = 'test-element';
        domEnv.container.appendChild(div);
      }, 50);

      const element = await waitForElement('.test-element', 1000);
      assert.ok(element, 'Should find element');
      assert.strictEqual(element.className, 'test-element', 'Should return correct element');
    });

    it('should reject on timeout', async () => {
      try {
        await waitForElement('.nonexistent', 100);
        assert.fail('Should have timed out');
      } catch (error) {
        assert.ok(error.message.includes('not found'), 'Should have timeout error');
      }
    });
  });

  describe('getCanvasOperations()', () => {
    beforeEach(() => {
      domEnv = setupDOM();
    });

    it('should return canvas operation history', () => {
      const canvas = domEnv.document.createElement('canvas');
      // Use mockCanvas to get proper mock context
      const { ctx } = mockCanvas(canvas);

      ctx.fillRect(0, 0, 10, 10);
      ctx.arc(5, 5, 3, 0, Math.PI * 2);

      const operations = getCanvasOperations(canvas);
      assert.strictEqual(operations.length, 2, 'Should have 2 operations');
      assert.strictEqual(operations[0].type, 'fillRect', 'First should be fillRect');
      assert.strictEqual(operations[1].type, 'arc', 'Second should be arc');
    });
  });

  describe('clearCanvasOperations()', () => {
    beforeEach(() => {
      domEnv = setupDOM();
    });

    it('should clear canvas operation history', () => {
      const canvas = domEnv.document.createElement('canvas');
      // Use mockCanvas to get proper mock context
      const { ctx } = mockCanvas(canvas);

      ctx.fillRect(0, 0, 10, 10);
      assert.ok(getCanvasOperations(canvas).length > 0, 'Should have operations');

      clearCanvasOperations(canvas);
      assert.strictEqual(getCanvasOperations(canvas).length, 0, 'Should clear operations');
    });
  });

  describe('Integration: Canvas and DOM', () => {
    beforeEach(() => {
      domEnv = setupDOM();
    });

    it('should create and manipulate DOM elements', () => {
      const div = domEnv.document.createElement('div');
      div.className = 'test-widget';
      div.textContent = 'Widget Content';

      domEnv.container.appendChild(div);

      const found = domEnv.container.querySelector('.test-widget');
      assert.ok(found, 'Should find element in container');
      assert.strictEqual(found.textContent, 'Widget Content', 'Should have correct content');
    });

    it('should use mock canvas for chart rendering', () => {
      const canvas = domEnv.document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 200;
      domEnv.container.appendChild(canvas);

      const { ctx } = mockCanvas(canvas);

      // Simulate chart drawing
      ctx.beginPath();
      ctx.moveTo(0, 100);
      ctx.lineTo(400, 100);
      ctx.stroke();

      const operations = getCanvasOperations(canvas);
      assert.ok(operations.length > 0, 'Should record canvas operations');
      assert.ok(operations.some(op => op.type === 'beginPath'), 'Should have beginPath');
      assert.ok(operations.some(op => op.type === 'stroke'), 'Should have stroke');
    });

    it('should handle canvas and DOM together', () => {
      // Create widget structure
      const widget = domEnv.document.createElement('div');
      widget.className = 'chart-widget';

      const canvas = domEnv.document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 150;
      widget.appendChild(canvas);

      domEnv.container.appendChild(widget);

      // Test DOM structure
      assert.strictEqual(domEnv.container.children.length, 1, 'Should have one child');
      assert.strictEqual(widget.children.length, 1, 'Widget should have canvas');

      // Test canvas mock
      const { ctx } = mockCanvas(canvas);
      ctx.fillRect(0, 0, 100, 100);

      const operations = getCanvasOperations(canvas);
      assert.strictEqual(operations.length, 1, 'Should have one operation');
      assert.strictEqual(operations[0].type, 'fillRect', 'Should be fillRect');
    });
  });
});
