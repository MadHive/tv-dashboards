// tests/components/tv-preview.test.js
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { TVPreview } from '../../public/js/components/tv-preview.js';

// Simple DOM mock for testing
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.className = '';
    this.children = [];
    this._textContent = '';
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.eventListeners = {};
    this.value = '';
  }

  get textContent() {
    // Aggregate text from this element and all children
    let text = this._textContent;
    for (const child of this.children) {
      if (child.textContent) {
        text += child.textContent;
      }
    }
    return text;
  }

  set textContent(value) {
    this._textContent = value;
  }

  querySelector(selector) {
    // Simple selector support for testing
    if (selector.includes('.')) {
      // Handle compound selectors like '.tv-size-btn.active'
      const parts = selector.split('.');
      const classes = parts.filter(p => p).map(p => p.trim());

      // Find first element matching all classes
      const findMatch = (element) => {
        const elementClasses = element.className ? element.className.split(' ') : [];
        const matches = classes.every(cls => elementClasses.includes(cls));
        if (matches) return element;

        for (const child of element.children) {
          const found = findMatch(child);
          if (found) return found;
        }
        return null;
      };

      return findMatch(this);
    }
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return this.getElementById(id) || null;
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      results.push(...this.getElementsByClassName(className));
    }
    if (selector.startsWith('[data-size')) {
      // Handle data attribute selector
      const sizeMatch = selector.match(/\[data-size="([^"]+)"\]/);
      if (sizeMatch) {
        const size = sizeMatch[1];
        return this.children.filter(child => child.dataset.size === size);
      }
    }
    return results;
  }

  getElementsByClassName(className) {
    const results = [];
    if (this.className && this.className.split(' ').includes(className)) {
      results.push(this);
    }
    for (const child of this.children) {
      if (child.getElementsByClassName) {
        results.push(...child.getElementsByClassName(className));
      }
    }
    return results;
  }

  getElementById(id) {
    if (this.id === id) {
      return this;
    }
    for (const child of this.children) {
      if (child.getElementById) {
        const found = child.getElementById(id);
        if (found) return found;
      }
    }
    return null;
  }

  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
    if (name === 'id') {
      this.id = value;
    }
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  addEventListener(event, handler) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (!this.eventListeners[event]) return;
    const index = this.eventListeners[event].indexOf(handler);
    if (index !== -1) {
      this.eventListeners[event].splice(index, 1);
    }
  }

  dispatchEvent(event) {
    const handlers = this.eventListeners[event.type] || [];
    for (const handler of handlers) {
      const enrichedEvent = {
        ...event,
        target: this,
        currentTarget: this,
        preventDefault: event.preventDefault || (() => {})
      };
      handler.call(this, enrichedEvent);
    }
  }

  click() {
    this.dispatchEvent({ type: 'click' });
  }

  get classList() {
    const classes = this.className ? this.className.split(' ').filter(c => c) : [];
    return {
      add: (name) => {
        if (!classes.includes(name)) {
          classes.push(name);
          this.className = classes.join(' ');
        }
      },
      remove: (name) => {
        const index = classes.indexOf(name);
        if (index !== -1) {
          classes.splice(index, 1);
          this.className = classes.join(' ');
        }
      },
      contains: (name) => classes.includes(name),
      toggle: (name) => {
        if (classes.includes(name)) {
          classes.splice(classes.indexOf(name), 1);
        } else {
          classes.push(name);
        }
        this.className = classes.join(' ');
      }
    };
  }

  set innerHTML(value) {
    this.children = [];
    this._textContent = '';
  }

  remove() {
    if (this.parentElement) {
      const index = this.parentElement.children.indexOf(this);
      if (index !== -1) {
        this.parentElement.children.splice(index, 1);
      }
    }
  }

  contains(element) {
    if (this === element) return true;
    for (const child of this.children) {
      if (child === element || (child.contains && child.contains(element))) {
        return true;
      }
    }
    return false;
  }
}

class MockEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.key = options.key || null;
    this.target = null;
    this.currentTarget = null;
  }

  preventDefault() {}
}

class MockKeyboardEvent extends MockEvent {
  constructor(type, options = {}) {
    super(type, options);
  }
}

class MockDocument {
  constructor() {
    this.body = new MockElement('body');
    this.eventListeners = {};
  }

  createElement(tagName) {
    return new MockElement(tagName);
  }

  addEventListener(event, handler) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (!this.eventListeners[event]) return;
    const index = this.eventListeners[event].indexOf(handler);
    if (index !== -1) {
      this.eventListeners[event].splice(index, 1);
    }
  }

  dispatchEvent(event) {
    const handlers = this.eventListeners[event.type] || [];
    for (const handler of handlers) {
      handler.call(this, event);
    }
  }
}

// Save originals before any global pollution
const originalKeyboardEvent = global.KeyboardEvent;
const originalEvent = global.Event;
const originalRequestAnimationFrame = global.requestAnimationFrame;
const originalDocument = global.document;

describe('TVPreview', () => {
  let container;
  let theme;
  let dashboardConfig;
  let onApplyMock;
  let mockDocument;

  beforeEach(() => {
    // Make globals available for this test
    global.KeyboardEvent = MockKeyboardEvent;
    global.Event = MockEvent;
    global.requestAnimationFrame = (callback) => {
      callback();
      return 0;
    };

    // Setup mock document
    mockDocument = new MockDocument();
    global.document = mockDocument;

    // Create a fresh DOM container for each test
    container = mockDocument.createElement('div');

    // Sample theme data
    theme = {
      id: 'dark-high-contrast',
      name: 'Dark High Contrast',
      category: 'TV-Optimized',
      description: 'Maximum readability with vibrant colors',
      colors: {
        background: '#000000',
        primary: '#FF006E',
        secondary: '#00F5FF',
        text: '#FFFFFF',
        accent: '#FFD700'
      }
    };

    // Sample dashboard config
    dashboardConfig = {
      id: 'test-dashboard',
      name: 'Test Dashboard',
      subtitle: 'Sample Dashboard',
      grid: {
        columns: 4,
        rows: 2,
        gap: 14
      },
      widgets: [
        {
          id: 'widget-1',
          type: 'big-number',
          title: 'Total Revenue',
          position: { col: 1, row: 1, colSpan: 2 }
        },
        {
          id: 'widget-2',
          type: 'gauge',
          title: 'Performance',
          position: { col: 3, row: 1, colSpan: 1 }
        }
      ]
    };

    onApplyMock = mock(() => {});
  });

  afterEach(() => {
    // Clean up any global listeners
    if (global.document) {
      global.document.eventListeners = {};
    }

    // Restore original globals to prevent pollution
    global.document = originalDocument;
    global.requestAnimationFrame = originalRequestAnimationFrame;
    global.KeyboardEvent = originalKeyboardEvent;
    global.Event = originalEvent;
  });

  describe('Initialization', () => {
    it('should create TVPreview instance with required parameters', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      expect(preview).toBeDefined();
      expect(preview.container).toBe(container);
      expect(preview.theme).toBe(theme);
      expect(preview.dashboardConfig).toBe(dashboardConfig);
      expect(preview.onApply).toBe(onApplyMock);
    });

    it('should default to 55" TV size', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      expect(preview.currentSize).toBe('55');
    });

    it('should handle missing onApply callback gracefully', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig
      });

      expect(preview.onApply).toBeFunction();
    });
  });

  describe('Modal Opening and Closing', () => {
    it('should open modal and add it to document body', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const modal = document.body.querySelector('.tv-preview-modal');
      expect(modal).not.toBeNull();
      expect(modal.classList.contains('open')).toBe(true);
    });

    it('should close modal when close method is called', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();
      const modal = document.body.querySelector('.tv-preview-modal');
      expect(modal).not.toBeNull();

      preview.close();

      // Modal should have open class removed
      expect(modal.classList.contains('open')).toBe(false);
    });

    it('should close modal when ESC key is pressed', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);

      const modal = document.body.querySelector('.tv-preview-modal');
      expect(modal.classList.contains('open')).toBe(false);
    });

    it('should not close modal on non-ESC key press', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      document.dispatchEvent(enterEvent);

      const modal = document.body.querySelector('.tv-preview-modal');
      expect(modal.classList.contains('open')).toBe(true);
    });

    it('should remove ESC key listener when closed', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();
      preview.close();

      // Verify listener is removed by checking document listeners
      const keydownListeners = document.eventListeners['keydown'] || [];
      expect(keydownListeners.length).toBe(0);
    });

    it('should close modal when close button is clicked', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const closeBtn = document.body.querySelector('.tv-preview-close');
      expect(closeBtn).not.toBeNull();

      closeBtn.click();

      const modal = document.body.querySelector('.tv-preview-modal');
      expect(modal.classList.contains('open')).toBe(false);
    });
  });

  describe('TV Size Switching', () => {
    it('should render size buttons for 55", 65", and 85" TVs', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const sizeButtons = document.body.querySelectorAll('.tv-size-btn');
      expect(sizeButtons.length).toBe(3);

      const sizes = Array.from(sizeButtons).map(btn => btn.dataset.size);
      expect(sizes).toContain('55');
      expect(sizes).toContain('65');
      expect(sizes).toContain('85');
    });

    it('should highlight current size button as active', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const activeButton = document.body.querySelector('.tv-size-btn.active');
      expect(activeButton).not.toBeNull();
      expect(activeButton.dataset.size).toBe('55');
    });

    it('should switch to 65" when 65" button is clicked', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const button65 = Array.from(document.body.querySelectorAll('.tv-size-btn'))
        .find(btn => btn.dataset.size === '65');

      button65.click();

      expect(preview.currentSize).toBe('65');
      expect(button65.classList.contains('active')).toBe(true);
    });

    it('should switch to 85" when 85" button is clicked', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const button85 = Array.from(document.body.querySelectorAll('.tv-size-btn'))
        .find(btn => btn.dataset.size === '85');

      button85.click();

      expect(preview.currentSize).toBe('85');
      expect(button85.classList.contains('active')).toBe(true);
    });

    it('should update viewport scale when size changes', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const viewport = document.body.querySelector('.tv-preview-viewport');
      const initialClass = viewport.className;

      const button65 = Array.from(document.body.querySelectorAll('.tv-size-btn'))
        .find(btn => btn.dataset.size === '65');

      button65.click();

      expect(viewport.classList.contains('size-65')).toBe(true);
    });
  });

  describe('Theme Application', () => {
    it('should apply theme background color to viewport', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const viewport = document.body.querySelector('.tv-preview-viewport');
      expect(viewport.style.backgroundColor).toBe(theme.colors.background);
    });

    it('should display dashboard name with theme text color', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const dashboardName = document.body.querySelector('.preview-dashboard-name');
      expect(dashboardName).not.toBeNull();
      expect(dashboardName.textContent).toBe(dashboardConfig.name);
      expect(dashboardName.style.color).toBe(theme.colors.text);
    });

    it('should use textContent for dashboard name to prevent XSS', () => {
      const maliciousConfig = {
        ...dashboardConfig,
        name: '<script>alert("xss")</script>'
      };

      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig: maliciousConfig,
        onApply: onApplyMock
      });

      preview.open();

      const dashboardName = document.body.querySelector('.preview-dashboard-name');
      // Should display the literal string, not execute script
      expect(dashboardName.textContent).toBe('<script>alert("xss")</script>');
    });

    it('should validate color format before applying styles', () => {
      const invalidTheme = {
        ...theme,
        colors: {
          background: 'javascript:alert(1)',  // Invalid color
          primary: '#FF006E',
          secondary: '#00F5FF',
          text: '#FFFFFF'
        }
      };

      const preview = new TVPreview({
        container,
        theme: invalidTheme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const viewport = document.body.querySelector('.tv-preview-viewport');
      // Should not apply invalid color
      expect(viewport.style.backgroundColor).not.toBe('javascript:alert(1)');
    });

    it('should render mock widgets with theme colors', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const widgets = document.body.querySelectorAll('.preview-widget');
      expect(widgets.length).toBeGreaterThan(0);

      // Check that widgets have theme-based styling
      const firstWidget = widgets[0];
      expect(firstWidget).not.toBeNull();
    });
  });

  describe('Apply Button', () => {
    it('should render Apply button', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const applyBtn = document.body.querySelector('.tv-preview-apply');
      expect(applyBtn).not.toBeNull();
      expect(applyBtn.textContent).toContain('Apply');
    });

    it('should call onApply callback when Apply button is clicked', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const applyBtn = document.body.querySelector('.tv-preview-apply');
      applyBtn.click();

      expect(onApplyMock).toHaveBeenCalledTimes(1);
      expect(onApplyMock).toHaveBeenCalledWith(theme);
    });

    it('should close modal after Apply is clicked', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const applyBtn = document.body.querySelector('.tv-preview-apply');
      applyBtn.click();

      const modal = document.body.querySelector('.tv-preview-modal');
      expect(modal.classList.contains('open')).toBe(false);
    });
  });

  describe('Dashboard Rendering', () => {
    it('should create grid layout matching dashboard config', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const grid = document.body.querySelector('.preview-dashboard-grid');
      expect(grid).not.toBeNull();
    });

    it('should render widgets based on dashboard config', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const widgets = document.body.querySelectorAll('.preview-widget');
      expect(widgets.length).toBe(dashboardConfig.widgets.length);
    });

    it('should display widget titles', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();

      const widgetTitles = document.body.querySelectorAll('.preview-widget-title');
      const titles = Array.from(widgetTitles).map(el => el.textContent);

      expect(titles).toContain('Total Revenue');
      expect(titles).toContain('Performance');
    });
  });

  describe('Edge Cases', () => {
    it('should handle dashboard with no widgets', () => {
      const emptyDashboard = {
        ...dashboardConfig,
        widgets: []
      };

      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig: emptyDashboard,
        onApply: onApplyMock
      });

      expect(() => preview.open()).not.toThrow();
    });

    it('should handle theme with missing colors', () => {
      const incompleteTheme = {
        id: 'incomplete',
        name: 'Incomplete Theme',
        colors: {
          background: '#000000',
          primary: '#FF006E'
          // missing secondary, text, accent
        }
      };

      const preview = new TVPreview({
        container,
        theme: incompleteTheme,
        dashboardConfig,
        onApply: onApplyMock
      });

      expect(() => preview.open()).not.toThrow();
    });

    it('should prevent multiple modals from being created', () => {
      const preview = new TVPreview({
        container,
        theme,
        dashboardConfig,
        onApply: onApplyMock
      });

      preview.open();
      preview.open(); // Try to open again

      const modals = document.body.querySelectorAll('.tv-preview-modal');
      expect(modals.length).toBe(1);
    });
  });
});
