// tests/components/theme-selector.test.js
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { ThemeSelector } from '../../public/js/components/theme-selector.js';

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
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      return this.getElementsByClassName(className)[0] || null;
    }
    if (selector.startsWith('[data-theme-id="')) {
      const id = selector.match(/\[data-theme-id="([^"]+)"\]/)?.[1];
      return this.querySelectorAll('.theme-card').find(card => card.dataset.themeId === id) || null;
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    if (selector === 'option') {
      // Find all option elements
      for (const child of this.children) {
        if (child.tagName === 'OPTION') {
          results.push(child);
        }
        if (child.querySelectorAll) {
          results.push(...child.querySelectorAll(selector));
        }
      }
      return results;
    }

    // Handle attribute selectors like [style*="display: none"]
    if (selector.includes('[style*=')) {
      const baseSelector = selector.match(/^\.?([^\[]+)/)?.[1];
      const styleMatch = selector.match(/\[style\*="([^"]+)"\]/)?.[1];

      if (baseSelector && styleMatch) {
        const baseElements = this.getElementsByClassName(baseSelector);
        return Array.from(baseElements).filter(el => {
          const styleStr = Object.entries(el.style)
            .filter(([key, value]) => value)
            .map(([key, value]) => `${key}: ${value}`)
            .join('; ');
          return styleStr.includes(styleMatch);
        });
      }
    }

    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      results.push(...this.getElementsByClassName(className));
    }

    if (selector.includes(':not(')) {
      // Simple :not() support  - handle both :not() and selector after :not
      const baseSelector = selector.match(/^\.?([^:]+)/)?.[1];
      if (baseSelector) {
        // Get all matching elements of base class
        const baseElements = this.getElementsByClassName(baseSelector);
        // Filter out elements that match the :not() condition
        if (selector.includes('display: none') || selector.includes('display')) {
          return Array.from(baseElements).filter(el => el.style.display !== 'none');
        }
        return Array.from(baseElements);
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

  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
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
      contains: (name) => classes.includes(name)
    };
  }

  set innerHTML(value) {
    this.children = [];
    this._textContent = '';
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
  createElement(tagName) {
    return new MockElement(tagName);
  }
}

// Make KeyboardEvent available globally
global.KeyboardEvent = MockKeyboardEvent;
global.Event = MockEvent;

describe('ThemeSelector', () => {
  let container;
  let themes;
  let onSelectMock;
  let mockDocument;

  beforeEach(() => {
    // Setup mock document
    mockDocument = new MockDocument();
    global.document = mockDocument;

    // Create a fresh DOM container for each test
    container = mockDocument.createElement('div');

    // Sample theme data matching the backend structure
    themes = [
      {
        id: 'dark-high-contrast',
        name: 'Dark High Contrast',
        category: 'TV-Optimized',
        description: 'Maximum readability with vibrant colors',
        colors: {
          background: '#000000',
          primary: '#FF006E',
          secondary: '#00F5FF'
        }
      },
      {
        id: 'light-clean',
        name: 'Light Clean',
        category: 'TV-Optimized',
        description: 'Professional light theme',
        colors: {
          background: '#FFFFFF',
          primary: '#2563EB',
          secondary: '#7C3AED'
        }
      },
      {
        id: 'corporate-blue',
        name: 'Corporate Blue',
        category: 'Professional',
        description: 'Traditional corporate aesthetic',
        colors: {
          background: '#1e3a5f',
          primary: '#3B82F6',
          secondary: '#60A5FA'
        }
      }
    ];

    onSelectMock = mock(() => {});
  });

  describe('Rendering', () => {
    it('should render theme cards in a grid layout', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        onSelect: onSelectMock
      });
      selector.render();

      // Check for grid container
      const grid = container.querySelector('.theme-grid');
      expect(grid).not.toBeNull();

      // Check that all themes are rendered
      const cards = container.querySelectorAll('.theme-card');
      expect(cards.length).toBe(3);
    });

    it('should display theme name in each card', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        onSelect: onSelectMock
      });
      selector.render();

      const cards = container.querySelectorAll('.theme-card');
      expect(cards[0].textContent).toContain('Dark High Contrast');
      expect(cards[1].textContent).toContain('Light Clean');
      expect(cards[2].textContent).toContain('Corporate Blue');
    });

    it('should display category badge for each theme', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        onSelect: onSelectMock
      });
      selector.render();

      const badges = container.querySelectorAll('.theme-category-badge');
      expect(badges.length).toBe(3);
      expect(badges[0].textContent).toBe('TV-Optimized');
      expect(badges[2].textContent).toBe('Professional');
    });

    it('should display color swatches for each theme', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        onSelect: onSelectMock
      });
      selector.render();

      const cards = container.querySelectorAll('.theme-card');
      const firstCardSwatches = cards[0].querySelectorAll('.theme-color-swatch');

      // Should have 3 swatches (background, primary, secondary)
      expect(firstCardSwatches.length).toBe(3);
    });

    it('should render category filter dropdown', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        onSelect: onSelectMock
      });
      selector.render();

      const filterSelect = container.querySelector('.theme-category-filter');
      expect(filterSelect).not.toBeNull();
      expect(filterSelect.tagName).toBe('SELECT');

      // Should have "All Categories" option plus unique categories
      const options = filterSelect.querySelectorAll('option');
      expect(options.length).toBeGreaterThan(1);
      expect(options[0].textContent).toBe('All Categories');
    });
  });

  describe('Theme Selection', () => {
    it('should emit onSelect event when a theme is clicked', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        onSelect: onSelectMock
      });
      selector.render();

      const cards = container.querySelectorAll('.theme-card');
      cards[1].click();

      expect(onSelectMock).toHaveBeenCalledTimes(1);
      expect(onSelectMock).toHaveBeenCalledWith('light-clean');
    });

    it('should highlight the currently selected theme', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        currentTheme: 'dark-high-contrast',
        onSelect: onSelectMock
      });
      selector.render();

      const cards = container.querySelectorAll('.theme-card');
      expect(cards[0].classList.contains('selected')).toBe(true);
      expect(cards[1].classList.contains('selected')).toBe(false);
      expect(cards[2].classList.contains('selected')).toBe(false);
    });

    it('should update selected state when selectTheme is called', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        currentTheme: 'dark-high-contrast',
        onSelect: onSelectMock
      });
      selector.render();

      selector.selectTheme('corporate-blue');

      const cards = container.querySelectorAll('.theme-card');
      expect(cards[0].classList.contains('selected')).toBe(false);
      expect(cards[2].classList.contains('selected')).toBe(true);
    });

    it('should emit onSelect when selectTheme is called programmatically', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        onSelect: onSelectMock
      });
      selector.render();

      selector.selectTheme('light-clean');

      expect(onSelectMock).toHaveBeenCalledTimes(1);
      expect(onSelectMock).toHaveBeenCalledWith('light-clean');
    });
  });

  describe('Category Filtering', () => {
    it('should filter themes by category when filter is changed', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        onSelect: onSelectMock
      });
      selector.render();

      // Filter to "Professional" category
      selector.filterByCategory('Professional');

      const cards = container.querySelectorAll('.theme-card');
      const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
      const hiddenCards = Array.from(cards).filter(c => c.style.display === 'none');

      expect(visibleCards.length).toBe(1);
      expect(visibleCards[0].textContent).toContain('Corporate Blue');
      expect(hiddenCards.length).toBe(2);
    });

    it('should show all themes when "All Categories" is selected', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        onSelect: onSelectMock
      });
      selector.render();

      // First filter to a category
      selector.filterByCategory('Professional');

      // Then reset to all
      selector.filterByCategory('all');

      const cards = container.querySelectorAll('.theme-card');
      const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
      expect(visibleCards.length).toBe(3);
    });

    it('should update filter dropdown when filterByCategory is called', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        onSelect: onSelectMock
      });
      selector.render();

      selector.filterByCategory('TV-Optimized');

      const filterSelect = container.querySelector('.theme-category-filter');
      expect(filterSelect.value).toBe('TV-Optimized');
    });

    it('should call filterByCategory when dropdown changes', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        onSelect: onSelectMock
      });
      selector.render();

      const filterSelect = container.querySelector('.theme-category-filter');
      filterSelect.value = 'Professional';
      filterSelect.dispatchEvent(new Event('change'));

      const cards = container.querySelectorAll('.theme-card');
      const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
      expect(visibleCards.length).toBe(1);
    });
  });

  describe('Loading Themes from API', () => {
    it('should fetch themes from /api/themes endpoint', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => themes
      }));

      const selector = new ThemeSelector({
        container,
        onSelect: onSelectMock
      });

      await selector.loadThemes();

      expect(global.fetch).toHaveBeenCalledWith('/api/themes');
      expect(selector.themes.length).toBe(3);
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = mock(async () => ({
        ok: false,
        status: 500
      }));

      const selector = new ThemeSelector({
        container,
        onSelect: onSelectMock
      });

      await expect(selector.loadThemes()).rejects.toThrow();
    });

    it('should re-render after loading themes', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => themes
      }));

      const selector = new ThemeSelector({
        container,
        onSelect: onSelectMock
      });
      selector.render(); // Initial render with no themes

      await selector.loadThemes();

      const cards = container.querySelectorAll('.theme-card');
      expect(cards.length).toBe(3);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on theme cards', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        onSelect: onSelectMock
      });
      selector.render();

      const cards = container.querySelectorAll('.theme-card');
      cards.forEach(card => {
        expect(card.getAttribute('role')).toBe('button');
        expect(card.getAttribute('tabindex')).toBe('0');
        expect(card.getAttribute('aria-label')).not.toBeNull();
      });
    });

    it('should support keyboard navigation (Enter key)', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        onSelect: onSelectMock
      });
      selector.render();

      const cards = container.querySelectorAll('.theme-card');
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      cards[1].dispatchEvent(enterEvent);

      expect(onSelectMock).toHaveBeenCalledWith('light-clean');
    });

    it('should support keyboard navigation (Space key)', () => {
      const selector = new ThemeSelector({
        container,
        themes,
        onSelect: onSelectMock
      });
      selector.render();

      const cards = container.querySelectorAll('.theme-card');
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
      cards[0].dispatchEvent(spaceEvent);

      expect(onSelectMock).toHaveBeenCalledWith('dark-high-contrast');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty themes array', () => {
      const selector = new ThemeSelector({
        container,
        themes: [],
        onSelect: onSelectMock
      });

      expect(() => selector.render()).not.toThrow();

      const cards = container.querySelectorAll('.theme-card');
      expect(cards.length).toBe(0);
    });

    it('should handle themes without category', () => {
      const themesWithoutCategory = [
        {
          id: 'no-category',
          name: 'No Category Theme',
          colors: {
            background: '#000000',
            primary: '#FF006E',
            secondary: '#00F5FF'
          }
        }
      ];

      const selector = new ThemeSelector({
        container,
        themes: themesWithoutCategory,
        onSelect: onSelectMock
      });

      expect(() => selector.render()).not.toThrow();
    });

    it('should use textContent instead of innerHTML for theme names', () => {
      const themesWithHTML = [
        {
          id: 'xss-test',
          name: '<script>alert("xss")</script>',
          category: 'Test',
          colors: {
            background: '#000000',
            primary: '#FF006E',
            secondary: '#00F5FF'
          }
        }
      ];

      const selector = new ThemeSelector({
        container,
        themes: themesWithHTML,
        onSelect: onSelectMock
      });
      selector.render();

      const cards = container.querySelectorAll('.theme-card');
      // textContent will show the literal string, not execute script
      expect(cards[0].querySelector('.theme-name').textContent).toBe('<script>alert("xss")</script>');
      // Verify no script tags were created
      expect(container.querySelectorAll('script').length).toBe(0);
    });
  });
});
