// public/js/components/template-browser.js

/**
 * TemplateBrowser - Searchable template gallery with category filters
 *
 * Features:
 * - Two-column layout (sidebar filters + template grid)
 * - Search by name and description
 * - Category-based filtering (multi-select)
 * - Template cards with preview and "Use Template" action
 * - Empty state when no matches
 * - Loading state during API fetch
 * - Keyboard accessibility
 */
export class TemplateBrowser {
  /**
   * Create a TemplateBrowser
   * @param {object} config - Configuration object
   * @param {HTMLElement} config.container - DOM element to render into
   * @param {Function} config.onSelect - Callback when template is selected (receives template object)
   */
  constructor(config) {
    this.container = config.container;
    this.onSelect = config.onSelect || (() => {});
    this.allTemplates = [];
    this.filteredTemplates = [];
    this.searchQuery = '';
    this.selectedCategories = new Set();
  }

  /**
   * Get unique categories from templates
   * @returns {Array} Array of unique category names
   */
  getCategories() {
    const categories = new Set();
    for (const template of this.allTemplates) {
      if (template.category) {
        categories.add(template.category);
      }
    }
    return Array.from(categories).sort();
  }

  /**
   * Render the template browser UI
   */
  render() {
    // Clear container - SAFE: using innerHTML='' only to clear, no untrusted content
    this.container.innerHTML = '';

    // Create wrapper with two-column layout
    const wrapper = document.createElement('div');
    wrapper.className = 'template-browser';

    // Create sidebar
    const sidebar = this.createSidebar();
    wrapper.appendChild(sidebar);

    // Create content area
    const content = document.createElement('div');
    content.className = 'template-content';

    // Create grid container
    const grid = document.createElement('div');
    grid.className = 'template-grid';

    // Render templates
    this.renderTemplates(grid);

    content.appendChild(grid);
    wrapper.appendChild(content);

    this.container.appendChild(wrapper);
  }

  /**
   * Create the sidebar with search and filters
   * @returns {HTMLElement} Sidebar element
   */
  createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.className = 'template-sidebar';

    // Search input
    const searchContainer = document.createElement('div');
    searchContainer.className = 'template-search-container';

    const searchLabel = document.createElement('label');
    searchLabel.textContent = 'Search Templates';
    searchLabel.htmlFor = 'template-search';
    searchLabel.className = 'template-search-label';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'template-search';
    searchInput.className = 'template-search-input';
    searchInput.placeholder = 'Search by name or description...';
    searchInput.value = this.searchQuery;

    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.applyFilters();
    });

    searchContainer.appendChild(searchLabel);
    searchContainer.appendChild(searchInput);
    sidebar.appendChild(searchContainer);

    // Category filters
    const categories = this.getCategories();
    if (categories.length > 0) {
      const categoryContainer = document.createElement('div');
      categoryContainer.className = 'template-categories';

      const categoryHeading = document.createElement('h3');
      categoryHeading.className = 'template-categories-heading';
      categoryHeading.textContent = 'Categories';
      categoryContainer.appendChild(categoryHeading);

      for (const category of categories) {
        const checkboxContainer = document.createElement('label');
        checkboxContainer.className = 'template-category-label';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'template-category-checkbox';
        checkbox.value = category;
        checkbox.checked = this.selectedCategories.has(category);

        checkbox.addEventListener('change', (e) => {
          if (e.target.checked) {
            this.selectedCategories.add(category);
          } else {
            this.selectedCategories.delete(category);
          }
          this.applyFilters();
        });

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(document.createTextNode(` ${category}`));
        categoryContainer.appendChild(checkboxContainer);
      }

      sidebar.appendChild(categoryContainer);
    }

    // Clear filters button
    const clearButton = document.createElement('button');
    clearButton.className = 'clear-filters-button';
    clearButton.textContent = 'Clear Filters';
    clearButton.addEventListener('click', () => {
      this.clearFilters();
    });

    sidebar.appendChild(clearButton);

    return sidebar;
  }

  /**
   * Apply current search and category filters
   */
  applyFilters() {
    const query = this.searchQuery.toLowerCase();
    const hasCategories = this.selectedCategories.size > 0;

    this.filteredTemplates = this.allTemplates.filter(template => {
      // Search filter (name or description)
      const matchesSearch = !query ||
        (template.name && template.name.toLowerCase().includes(query)) ||
        (template.description && template.description.toLowerCase().includes(query));

      // Category filter
      const matchesCategory = !hasCategories ||
        this.selectedCategories.has(template.category);

      return matchesSearch && matchesCategory;
    });

    // Re-render template grid
    const grid = this.container.querySelector('.template-grid');
    if (grid) {
      this.renderTemplates(grid);
    }
  }

  /**
   * Clear all filters
   */
  clearFilters() {
    this.searchQuery = '';
    this.selectedCategories.clear();

    // Update search input
    const searchInput = this.container.querySelector('.template-search-input');
    if (searchInput) {
      searchInput.value = '';
    }

    // Update checkboxes
    const checkboxes = this.container.querySelectorAll('.template-category-checkbox');
    for (const checkbox of checkboxes) {
      checkbox.checked = false;
    }

    this.applyFilters();
  }

  /**
   * Render templates into grid
   * @param {HTMLElement} grid - Grid container element
   */
  renderTemplates(grid) {
    // Clear grid - SAFE: using innerHTML='' only to clear, no untrusted content
    grid.innerHTML = '';

    // Show empty state if no templates match
    if (this.filteredTemplates.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'template-empty-state';

      const emptyIcon = document.createElement('div');
      emptyIcon.className = 'template-empty-icon';
      emptyIcon.textContent = '📋';

      const emptyText = document.createElement('div');
      emptyText.className = 'template-empty-text';
      emptyText.textContent = this.allTemplates.length === 0
        ? 'No templates available'
        : 'No templates found';

      const emptyHint = document.createElement('div');
      emptyHint.className = 'template-empty-hint';
      emptyHint.textContent = this.allTemplates.length > 0
        ? 'Try adjusting your search or filters'
        : 'Create your first template to get started';

      emptyState.appendChild(emptyIcon);
      emptyState.appendChild(emptyText);
      emptyState.appendChild(emptyHint);

      grid.appendChild(emptyState);
      return;
    }

    // Render template cards
    for (const template of this.filteredTemplates) {
      const card = this.createTemplateCard(template);
      grid.appendChild(card);
    }
  }

  /**
   * Create a template card element
   * @param {object} template - Template object
   * @returns {HTMLElement} Template card element
   */
  createTemplateCard(template) {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.dataset.templateId = template.filename;

    // Template name - SAFE: using textContent for user data
    const name = document.createElement('div');
    name.className = 'template-name';
    name.textContent = template.name;
    card.appendChild(name);

    // Category badge (if present) - SAFE: using textContent for user data
    if (template.category) {
      const badge = document.createElement('div');
      badge.className = 'template-category-badge';
      badge.textContent = template.category;
      card.appendChild(badge);
    }

    // Description (if present) - SAFE: using textContent for user data
    if (template.description) {
      const description = document.createElement('div');
      description.className = 'template-description';
      description.textContent = template.description;
      card.appendChild(description);
    }

    // Metadata (author, date)
    const metadata = document.createElement('div');
    metadata.className = 'template-metadata';

    if (template.author) {
      const authorSpan = document.createElement('span');
      authorSpan.className = 'template-author';
      authorSpan.textContent = `By ${template.author}`;
      metadata.appendChild(authorSpan);
    }

    if (template.createdAt) {
      const dateSpan = document.createElement('span');
      dateSpan.className = 'template-date';
      const date = new Date(template.createdAt);
      dateSpan.textContent = date.toLocaleDateString();
      metadata.appendChild(dateSpan);
    }

    if (metadata.children.length > 0) {
      card.appendChild(metadata);
    }

    // "Use Template" button
    const button = document.createElement('button');
    button.className = 'use-template-button';
    button.textContent = 'Use Template';
    button.setAttribute('aria-label', `Use ${template.name} template`);

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onSelect(template);
    });

    card.appendChild(button);

    return card;
  }

  /**
   * Load templates from API
   * @param {string} endpoint - API endpoint (default: /api/templates)
   * @returns {Promise<Array>} Array of template objects
   */
  async loadTemplates(endpoint = '/api/templates') {
    this.container.classList.add('loading');

    try {
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Failed to load templates: ${response.status}`);
      }

      this.allTemplates = await response.json();
      this.filteredTemplates = [...this.allTemplates];

      // Render UI
      this.render();

      return this.allTemplates;
    } finally {
      this.container.classList.remove('loading');
    }
  }
}
