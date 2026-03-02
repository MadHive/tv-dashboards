// ===========================================================================
// DOM Helpers — JSDOM utilities for widget/chart testing
// ===========================================================================

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

/**
 * Initialize jsdom environment with test container
 * Creates a basic HTML document with necessary structure for widget testing
 *
 * @param {Object} options - DOM setup options
 * @param {string} options.html - Custom HTML string (default: basic structure with test-container)
 * @param {string} options.runScripts - JSDOM script execution mode (default: 'dangerously')
 * @param {string} options.resources - JSDOM resource loader (default: 'usable')
 * @param {string} options.url - Document URL (default: http://tv.madhive.local:3000)
 * @returns {Object} DOM environment with window, document, container, and cleanup function
 * @returns {Object} return.dom - JSDOM instance
 * @returns {Window} return.window - JSDOM window object
 * @returns {Document} return.document - JSDOM document object
 * @returns {HTMLElement} return.container - Test container element (#test-container)
 * @returns {Function} return.cleanup - Cleanup function to destroy DOM and clear globals
 *
 * @example
 * const { window, document, container, cleanup } = setupDOM();
 * container.innerHTML = '<div>Test content</div>';
 * // Run tests...
 * cleanup();
 */
export function setupDOM(options = {}) {
  const {
    html = '<!DOCTYPE html><html><body><div id="test-container"></div></body></html>',
    runScripts = 'dangerously',
    resources = 'usable',
    url = 'http://tv.madhive.local:3000'
  } = options;

  const dom = new JSDOM(html, {
    runScripts,
    resources,
    url,
    pretendToBeVisual: true,
    beforeParse(window) {
      // Setup canvas mock
      window.HTMLCanvasElement.prototype.getContext = function(type) {
        if (type === '2d') {
          return mockCanvasContext();
        }
        return null;
      };

      // Setup getBoundingClientRect for canvas
      window.HTMLCanvasElement.prototype.getBoundingClientRect = function() {
        return {
          width: this.width || 300,
          height: this.height || 150,
          top: 0,
          left: 0,
          right: this.width || 300,
          bottom: this.height || 150,
          x: 0,
          y: 0
        };
      };
    }
  });

  const { window } = dom;

  // JSDOM provides localStorage by default, but we can enhance it if needed
  // Note: localStorage is already available and functional in JSDOM

  // Add fetch mock to window (JSDOM doesn't provide fetch by default)
  window.fetch = mockFetch();

  // Expose globals
  global.window = window;
  global.document = window.document;
  global.navigator = window.navigator;
  global.HTMLElement = window.HTMLElement;

  const container = window.document.getElementById('test-container');

  return {
    dom,
    window,
    document: window.document,
    container,
    cleanup: () => {
      window.close();
      delete global.window;
      delete global.document;
      delete global.navigator;
      delete global.HTMLElement;
    }
  };
}

/**
 * Load JavaScript file into jsdom environment
 * Reads and executes a JavaScript file in the current window context
 *
 * @param {string} scriptPath - Path to JavaScript file (relative to project root or absolute)
 * @param {Window} windowContext - JSDOM window object (default: global.window)
 * @returns {Promise<void>} Resolves when script is loaded and executed
 * @throws {Error} If file cannot be read or script execution fails
 *
 * @example
 * const { window } = setupDOM();
 * await loadScript('public/js/widgets.js', window);
 * // window.Widgets is now available
 */
export function loadScript(scriptPath, windowContext = global.window) {
  if (!windowContext) {
    throw new Error('No window context available. Call setupDOM() first.');
  }

  try {
    // Handle both absolute and relative paths
    const fullPath = path.isAbsolute(scriptPath)
      ? scriptPath
      : path.join(process.cwd(), scriptPath);

    const scriptContent = fs.readFileSync(fullPath, 'utf-8');

    // Execute script in window context
    const scriptElement = windowContext.document.createElement('script');
    scriptElement.textContent = scriptContent;
    windowContext.document.head.appendChild(scriptElement);

    return Promise.resolve();
  } catch (error) {
    return Promise.reject(new Error(`Failed to load script ${scriptPath}: ${error.message}`));
  }
}

/**
 * Mock canvas for chart rendering tests
 * Creates a mock canvas element with getContext('2d') support
 *
 * @param {HTMLCanvasElement} canvas - Optional canvas element to enhance with mocking
 * @returns {Object} Mock canvas utilities
 * @returns {Function} return.getContext - Mock getContext function
 * @returns {Object} return.ctx - The mock 2D context
 *
 * @example
 * const canvas = document.createElement('canvas');
 * const { ctx } = mockCanvas(canvas);
 * ctx.fillRect(0, 0, 100, 100);
 * console.log(ctx._operations); // See recorded operations
 */
export function mockCanvas(canvas) {
  const ctx = mockCanvasContext();

  if (canvas) {
    // Enhance the canvas element
    canvas.getContext = function(type) {
      if (type === '2d') return ctx;
      return null;
    };

    // Mock getBoundingClientRect for layout calculations
    canvas.getBoundingClientRect = function() {
      return {
        width: canvas.width || 300,
        height: canvas.height || 150,
        top: 0,
        left: 0,
        right: canvas.width || 300,
        bottom: canvas.height || 150,
        x: 0,
        y: 0
      };
    };

    ctx.canvas = canvas;
  }

  return {
    getContext: (type) => type === '2d' ? ctx : null,
    ctx
  };
}

/**
 * Mock canvas 2D context
 * @returns {Object} Mock canvas context
 */
export function mockCanvasContext() {
  const context = {
    // Drawing state
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,

    // Transformation matrix
    _transform: [1, 0, 0, 1, 0, 0],

    // Drawing methods
    fillRect: function(x, y, width, height) {
      this._operations.push({ type: 'fillRect', x, y, width, height, fillStyle: this.fillStyle });
    },
    strokeRect: function(x, y, width, height) {
      this._operations.push({ type: 'strokeRect', x, y, width, height, strokeStyle: this.strokeStyle });
    },
    clearRect: function(x, y, width, height) {
      this._operations.push({ type: 'clearRect', x, y, width, height });
    },
    fillText: function(text, x, y) {
      this._operations.push({ type: 'fillText', text, x, y, font: this.font, fillStyle: this.fillStyle });
    },
    strokeText: function(text, x, y) {
      this._operations.push({ type: 'strokeText', text, x, y, font: this.font, strokeStyle: this.strokeStyle });
    },
    measureText: function(text) {
      return { width: text.length * 8 }; // Simple approximation
    },

    // Path methods
    beginPath: function() {
      this._operations.push({ type: 'beginPath' });
    },
    closePath: function() {
      this._operations.push({ type: 'closePath' });
    },
    moveTo: function(x, y) {
      this._operations.push({ type: 'moveTo', x, y });
    },
    lineTo: function(x, y) {
      this._operations.push({ type: 'lineTo', x, y });
    },
    arc: function(x, y, radius, startAngle, endAngle, anticlockwise) {
      this._operations.push({ type: 'arc', x, y, radius, startAngle, endAngle, anticlockwise });
    },
    stroke: function() {
      this._operations.push({ type: 'stroke', strokeStyle: this.strokeStyle, lineWidth: this.lineWidth });
    },
    fill: function() {
      this._operations.push({ type: 'fill', fillStyle: this.fillStyle });
    },

    // Transform methods
    save: function() {
      this._operations.push({ type: 'save' });
    },
    restore: function() {
      this._operations.push({ type: 'restore' });
    },
    translate: function(x, y) {
      this._operations.push({ type: 'translate', x, y });
    },
    scale: function(x, y) {
      this._operations.push({ type: 'scale', x, y });
    },
    rotate: function(angle) {
      this._operations.push({ type: 'rotate', angle });
    },

    // Track operations for testing
    _operations: [],

    // Reset for next test
    reset: function() {
      this._operations = [];
      this.fillStyle = '#000000';
      this.strokeStyle = '#000000';
      this.lineWidth = 1;
      this.globalAlpha = 1;
    }
  };

  return context;
}

/**
 * Mock localStorage
 * @returns {Object} Mock localStorage
 */
export function mockLocalStorage() {
  const storage = new Map();

  return {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
    get length() { return storage.size; },
    key: (index) => Array.from(storage.keys())[index] || null
  };
}

/**
 * Mock fetch API
 * @param {Object} responses - Custom responses map
 * @returns {Function} Mock fetch function
 */
export function mockFetch(responses = {}) {
  return async function fetch(url, options = {}) {
    // Check for custom response
    if (responses[url]) {
      return {
        ok: true,
        status: 200,
        json: async () => responses[url],
        text: async () => JSON.stringify(responses[url])
      };
    }

    // Default mock response
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: {} }),
      text: async () => '{"success":true,"data":{}}'
    };
  };
}

/**
 * Simulate user click event on element
 * Creates and dispatches a click event with proper properties
 *
 * @param {HTMLElement} element - Element to click
 * @param {Object} options - Event options
 * @param {number} options.clientX - X coordinate (default: 0)
 * @param {number} options.clientY - Y coordinate (default: 0)
 * @param {boolean} options.bubbles - Event bubbles (default: true)
 * @param {boolean} options.cancelable - Event cancelable (default: true)
 * @returns {boolean} True if event was not cancelled
 *
 * @example
 * const button = document.querySelector('button');
 * simulateClick(button);
 * // Click event handler will be triggered
 */
export function simulateClick(element, options = {}) {
  if (!element) {
    throw new Error('Element is required for simulateClick');
  }

  const {
    clientX = 0,
    clientY = 0,
    bubbles = true,
    cancelable = true
  } = options;

  const win = element.ownerDocument?.defaultView || window;
  const event = new win.MouseEvent('click', {
    bubbles,
    cancelable,
    view: win,
    clientX,
    clientY,
    button: 0 // Left mouse button
  });

  return element.dispatchEvent(event);
}

/**
 * Simulate keyboard event
 * @param {Element} element - DOM element
 * @param {string} key - Key name
 * @param {string} type - Event type (keydown, keyup, keypress)
 */
export function simulateKeyboard(element, key, type = 'keydown') {
  const event = new window.KeyboardEvent(type, {
    key,
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(event);
}

/**
 * Simulate input event
 * @param {Element} element - Input element
 * @param {string} value - Input value
 */
export function simulateInput(element, value) {
  element.value = value;
  const event = new window.Event('input', {
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(event);
}

/**
 * Wait for element to appear
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Element>} Element when found
 */
export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      } else {
        setTimeout(check, 100);
      }
    };

    check();
  });
}

/**
 * Get canvas operations (for testing)
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {Array} List of canvas operations
 */
export function getCanvasOperations(canvas) {
  const ctx = canvas.getContext('2d');
  return ctx._operations || [];
}

/**
 * Clear canvas operations
 * @param {HTMLCanvasElement} canvas - Canvas element
 */
export function clearCanvasOperations(canvas) {
  const ctx = canvas.getContext('2d');
  if (ctx.reset) {
    ctx.reset();
  }
}
