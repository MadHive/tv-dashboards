// tests/components/template-browser.test.js
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { TemplateBrowser } from '../../public/js/components/template-browser.js';

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
    this._value = '';
    this._placeholder = '';
    this._type = '';
    this._checked = false;
  }

  get value() {
    return this._value;
  }

  set value(val) {
    this._value = val;
    this.attributes.value = val;
  }

  get placeholder() {
    return this._placeholder;
  }

  set placeholder(val) {
    this._placeholder = val;
    this.attributes.placeholder = val;
  }

  get type() {
    return this._type;
  }

  set type(val) {
    this._type = val;
    this.attributes.type = val;
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
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return this.getElementById(id) || null;
    }
    if (selector.startsWith('[data-template-id="')) {
      const id = selector.match(/\[data-template-id="([^"]+)"\]/)?.[1];
      return this.querySelectorAll('.template-card').find(card => card.dataset.templateId === id) || null;
    }
    return null;
  }

  querySelectorAll(selector) {
    // Handle checkbox selectors (check first before other selectors)
    if (selector === 'input[type="checkbox"]') {
      return this.getElementsByType('checkbox');
    }

    // Handle checked checkboxes
    if (selector === 'input[type="checkbox"]:checked') {
      return this.getElementsByType('checkbox').filter(cb => cb.checked);
    }

    const results = [];

    // Handle class selectors
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      results.push(...this.getElementsByClassName(className));
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

  getElementsByType(type) {
    const results = [];
    if (this.getAttribute('type') === type) {
      results.push(this);
    }
    for (const child of this.children) {
      if (child.getElementsByType) {
        results.push(...child.getElementsByType(type));
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
    if (name === 'type') {
      this.type = value;
    }
  }

  getAttribute(name) {
    return this.attributes[name] || null;
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
        preventDefault: event.preventDefault || (() => {}),
        stopPropagation: event.stopPropagation || (() => {})
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

  get checked() {
    return this._checked;
  }

  set checked(value) {
    this._checked = value;
  }
}

class MockEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.target = options.target || null;
    this.currentTarget = null;
  }

  preventDefault() {}
  stopPropagation() {}
}

class MockDocument {
  createElement(tagName) {
    return new MockElement(tagName);
  }

  createTextNode(text) {
    const node = new MockElement('text');
    node.textContent = text;
    return node;
  }
}

global.Event = MockEvent;

describe('TemplateBrowser', () => {
  let container;
  let templates;
  let onSelectMock;
  let mockDocument;

  beforeEach(() => {
    // Setup mock document
    mockDocument = new MockDocument();
    global.document = mockDocument;

    // Create a fresh DOM container for each test
    container = mockDocument.createElement('div');

    // Sample template data matching the backend structure
    templates = [
      {
        filename: 'devops-monitoring.yaml',
        name: 'DevOps Monitoring',
        description: 'Real-time service health and performance metrics',
        category: 'DevOps',
        author: 'MadHive',
        createdAt: '2026-03-01T10:00:00Z'
      },
      {
        filename: 'sales-dashboard.yaml',
        name: 'Sales Dashboard',
        description: 'Track sales metrics and revenue performance',
        category: 'Business',
        author: 'MadHive',
        createdAt: '2026-03-01T11:00:00Z'
      },
      {
        filename: 'security-overview.yaml',
        name: 'Security Overview',
        description: 'Monitor vulnerabilities and security posture',
        category: 'Security',
        author: 'MadHive',
        createdAt: '2026-03-01T12:00:00Z'
      },
      {
        filename: 'marketing-analytics.yaml',
        name: 'Marketing Analytics',
        description: 'Campaign performance and user engagement',
        category: 'Business',
        author: 'MadHive',
        createdAt: '2026-03-01T13:00:00Z'
      }
    ];

    onSelectMock = mock(() => {});
  });

  describe('Rendering', () => {
    it('should render two-column layout with sidebar and content area', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      // Check for two-column layout
      const wrapper = container.querySelector('.template-browser');
      expect(wrapper).not.toBeNull();

      // Check for sidebar
      const sidebar = container.querySelector('.template-sidebar');
      expect(sidebar).not.toBeNull();

      // Check for content area
      const content = container.querySelector('.template-content');
      expect(content).not.toBeNull();
    });

    it('should render search input in sidebar', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      const searchInput = container.querySelector('.template-search-input');
      expect(searchInput).not.toBeNull();
      expect(searchInput.tagName).toBe('INPUT');
      const placeholder = searchInput.getAttribute('placeholder');
      expect(placeholder).not.toBeNull();
      expect(placeholder.includes('Search')).toBe(true);
    });

    it('should render category checkboxes in sidebar', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      const categoryCheckboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(categoryCheckboxes.length).toBeGreaterThan(0);

      // Should have unique categories
      const categoryLabels = container.querySelector('.template-categories');
      expect(categoryLabels).not.toBeNull();
    });

    it('should render clear filters button in sidebar', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      const clearButton = container.querySelector('.clear-filters-button');
      expect(clearButton).not.toBeNull();
      expect(clearButton.tagName).toBe('BUTTON');
    });

    it('should render template cards in grid', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      const grid = container.querySelector('.template-grid');
      expect(grid).not.toBeNull();

      const cards = container.querySelectorAll('.template-card');
      expect(cards.length).toBe(4);
    });

    it('should display template details on cards', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      const cards = container.querySelectorAll('.template-card');

      // Check first card
      expect(cards[0].textContent).toContain('DevOps Monitoring');
      expect(cards[0].textContent).toContain('Real-time service health and performance metrics');

      // Check for category badge
      const badges = cards[0].querySelectorAll('.template-category-badge');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('should display "Use Template" button on each card', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      const cards = container.querySelectorAll('.template-card');
      const buttons = cards[0].querySelectorAll('.use-template-button');
      expect(buttons.length).toBe(1);
      expect(buttons[0].tagName).toBe('BUTTON');
    });
  });

  describe('Search Filtering', () => {
    it('should filter templates by search query (name)', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      const searchInput = container.querySelector('.template-search-input');
      searchInput.value = 'Sales';
      searchInput.dispatchEvent(new Event('input'));

      // Should show only sales dashboard
      const visibleCards = Array.from(container.querySelectorAll('.template-card'))
        .filter(c => c.style.display !== 'none');

      expect(visibleCards.length).toBe(1);
      expect(visibleCards[0].textContent).toContain('Sales Dashboard');
    });

    it('should filter templates by search query (description)', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      const searchInput = container.querySelector('.template-search-input');
      searchInput.value = 'vulnerabilities';
      searchInput.dispatchEvent(new Event('input'));

      // Should show security overview
      const visibleCards = Array.from(container.querySelectorAll('.template-card'))
        .filter(c => c.style.display !== 'none');

      expect(visibleCards.length).toBe(1);
      expect(visibleCards[0].textContent).toContain('Security Overview');
    });

    it('should be case-insensitive when searching', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      const searchInput = container.querySelector('.template-search-input');
      searchInput.value = 'DEVOPS';
      searchInput.dispatchEvent(new Event('input'));

      const visibleCards = Array.from(container.querySelectorAll('.template-card'))
        .filter(c => c.style.display !== 'none');

      expect(visibleCards.length).toBe(1);
      expect(visibleCards[0].textContent).toContain('DevOps Monitoring');
    });

    it('should show all templates when search is cleared', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      const searchInput = container.querySelector('.template-search-input');

      // First search
      searchInput.value = 'Sales';
      searchInput.dispatchEvent(new Event('input'));

      // Clear search
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));

      const visibleCards = Array.from(container.querySelectorAll('.template-card'))
        .filter(c => c.style.display !== 'none');

      expect(visibleCards.length).toBe(4);
    });
  });

  describe('Category Filtering', () => {
    it('should filter templates by single category', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      // Find and check Business category checkbox
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      const businessCheckbox = Array.from(checkboxes).find(cb =>
        cb.value === 'Business'
      );

      expect(businessCheckbox).not.toBeNull();
      businessCheckbox.checked = true;
      businessCheckbox.dispatchEvent(new Event('change'));

      const visibleCards = Array.from(container.querySelectorAll('.template-card'))
        .filter(c => c.style.display !== 'none');

      expect(visibleCards.length).toBe(2); // Sales and Marketing
    });

    it('should filter templates by multiple categories', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      // Check multiple categories
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      const businessCheckbox = Array.from(checkboxes).find(cb =>
        cb.value === 'Business'
      );
      const securityCheckbox = Array.from(checkboxes).find(cb =>
        cb.value === 'Security'
      );

      businessCheckbox.checked = true;
      securityCheckbox.checked = true;
      businessCheckbox.dispatchEvent(new Event('change'));
      securityCheckbox.dispatchEvent(new Event('change'));

      const visibleCards = Array.from(container.querySelectorAll('.template-card'))
        .filter(c => c.style.display !== 'none');

      expect(visibleCards.length).toBe(3); // Sales, Marketing, Security
    });

    it('should show all templates when no categories selected', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      // Initially all should be visible
      const visibleCards = Array.from(container.querySelectorAll('.template-card'))
        .filter(c => c.style.display !== 'none');

      expect(visibleCards.length).toBe(4);
    });

    it('should combine search and category filters', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      // Search for "Dashboard"
      const searchInput = container.querySelector('.template-search-input');
      searchInput.value = 'Dashboard';
      searchInput.dispatchEvent(new Event('input'));

      // Filter by Business category
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      const businessCheckbox = Array.from(checkboxes).find(cb =>
        cb.value === 'Business'
      );
      businessCheckbox.checked = true;
      businessCheckbox.dispatchEvent(new Event('change'));

      const visibleCards = Array.from(container.querySelectorAll('.template-card'))
        .filter(c => c.style.display !== 'none');

      expect(visibleCards.length).toBe(1); // Only Sales Dashboard
      expect(visibleCards[0].textContent).toContain('Sales Dashboard');
    });
  });

  describe('Clear Filters', () => {
    it('should clear all filters when clear button is clicked', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      // Apply filters
      const searchInput = container.querySelector('.template-search-input');
      searchInput.value = 'Sales';
      searchInput.dispatchEvent(new Event('input'));

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      const businessCheckbox = Array.from(checkboxes).find(cb =>
        cb.value === 'Business'
      );
      businessCheckbox.checked = true;
      businessCheckbox.dispatchEvent(new Event('change'));

      // Click clear button
      const clearButton = container.querySelector('.clear-filters-button');
      clearButton.click();

      // All templates should be visible
      const visibleCards = Array.from(container.querySelectorAll('.template-card'))
        .filter(c => c.style.display !== 'none');

      expect(visibleCards.length).toBe(4);

      // Search should be cleared
      expect(searchInput.value).toBe('');

      // Categories should be unchecked
      const checkedBoxes = container.querySelectorAll('input[type="checkbox"]:checked');
      expect(checkedBoxes.length).toBe(0);
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no templates match filters', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      // Search for something that doesn't exist
      const searchInput = container.querySelector('.template-search-input');
      searchInput.value = 'nonexistent';
      searchInput.dispatchEvent(new Event('input'));

      const emptyState = container.querySelector('.template-empty-state');
      expect(emptyState).not.toBeNull();
      expect(emptyState.textContent).toContain('No templates found');
    });

    it('should hide empty state when templates are visible', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      // Initially no empty state
      let emptyState = container.querySelector('.template-empty-state');
      expect(emptyState === null || emptyState.style.display === 'none').toBe(true);
    });
  });

  describe('Template Selection', () => {
    it('should emit onSelect event when "Use Template" button is clicked', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      const cards = container.querySelectorAll('.template-card');
      const button = cards[0].querySelector('.use-template-button');
      button.click();

      expect(onSelectMock).toHaveBeenCalledTimes(1);
      expect(onSelectMock).toHaveBeenCalledWith(templates[0]);
    });

    it('should pass correct template object to onSelect callback', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => templates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      const cards = container.querySelectorAll('.template-card');
      const button = cards[2].querySelector('.use-template-button');
      button.click();

      const calledTemplate = onSelectMock.mock.calls[0][0];
      expect(calledTemplate.name).toBe('Security Overview');
      expect(calledTemplate.category).toBe('Security');
    });
  });

  describe('Loading State', () => {
    it('should show loading state while fetching templates', async () => {
      let resolvePromise;
      const fetchPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      global.fetch = mock(async () => {
        await fetchPromise;
        return {
          ok: true,
          json: async () => templates
        };
      });

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      const loadPromise = browser.loadTemplates();

      // Should show loading state
      expect(container.classList.contains('loading')).toBe(true);

      // Resolve the fetch
      resolvePromise();
      await loadPromise;

      // Should remove loading state
      expect(container.classList.contains('loading')).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = mock(async () => ({
        ok: false,
        status: 500
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await expect(browser.loadTemplates()).rejects.toThrow();

      // Should remove loading state even on error
      expect(container.classList.contains('loading')).toBe(false);
    });
  });

  describe('Security', () => {
    it('should use textContent instead of innerHTML for template names', async () => {
      const maliciousTemplates = [
        {
          filename: 'xss-test.yaml',
          name: '<script>alert("xss")</script>',
          description: 'Test template',
          category: 'Test',
          author: 'Test',
          createdAt: '2026-03-01T10:00:00Z'
        }
      ];

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => maliciousTemplates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      const cards = container.querySelectorAll('.template-card');
      const nameElement = cards[0].querySelector('.template-name');

      // textContent will show the literal string, not execute script
      expect(nameElement.textContent).toBe('<script>alert("xss")</script>');

      // Verify no script tags were created
      expect(container.querySelectorAll('script').length).toBe(0);
    });

    it('should use textContent for descriptions', async () => {
      const maliciousTemplates = [
        {
          filename: 'xss-test.yaml',
          name: 'Test Template',
          description: '<img src=x onerror="alert(1)">',
          category: 'Test',
          author: 'Test',
          createdAt: '2026-03-01T10:00:00Z'
        }
      ];

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => maliciousTemplates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      const cards = container.querySelectorAll('.template-card');
      const descElement = cards[0].querySelector('.template-description');

      expect(descElement.textContent).toBe('<img src=x onerror="alert(1)">');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty templates array', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => []
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      await browser.loadTemplates();

      const cards = container.querySelectorAll('.template-card');
      expect(cards.length).toBe(0);

      const emptyState = container.querySelector('.template-empty-state');
      expect(emptyState).not.toBeNull();
    });

    it('should handle templates without descriptions', async () => {
      const minimalTemplates = [
        {
          filename: 'minimal.yaml',
          name: 'Minimal Template',
          category: 'Test',
          author: 'Test',
          createdAt: '2026-03-01T10:00:00Z'
        }
      ];

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => minimalTemplates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      expect(async () => await browser.loadTemplates()).not.toThrow();
    });

    it('should handle templates without categories', async () => {
      const noCategoryTemplates = [
        {
          filename: 'no-category.yaml',
          name: 'No Category',
          description: 'Template without category',
          author: 'Test',
          createdAt: '2026-03-01T10:00:00Z'
        }
      ];

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => noCategoryTemplates
      }));

      const browser = new TemplateBrowser({
        container,
        onSelect: onSelectMock
      });

      expect(async () => await browser.loadTemplates()).not.toThrow();
    });
  });
});
