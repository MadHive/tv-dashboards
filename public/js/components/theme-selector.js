// public/js/components/theme-selector.js

/**
 * ThemeSelector - Visual theme selection component with grid layout and category filtering
 *
 * Features:
 * - Grid layout for theme cards
 * - Category-based filtering
 * - Visual preview of theme colors
 * - Selected state highlighting
 * - Keyboard accessibility
 * - Event emission on selection
 */
export class ThemeSelector {
  /**
   * Create a ThemeSelector
   * @param {object} config - Configuration object
   * @param {HTMLElement} config.container - DOM element to render into
   * @param {Array} config.themes - Array of theme objects (optional, can load via API)
   * @param {string} config.currentTheme - Currently selected theme ID
   * @param {Function} config.onSelect - Callback when theme is selected (receives theme ID)
   */
  constructor(config) {
    this.container = config.container;
    this.themes = config.themes || [];
    this.currentTheme = config.currentTheme || null;
    this.onSelect = config.onSelect || (() => {});
    this.currentFilter = 'all';
  }

  /**
   * Get unique categories from themes
   * @returns {Array} Array of unique category names
   */
  getCategories() {
    const categories = new Set();
    for (const theme of this.themes) {
      if (theme.category) {
        categories.add(theme.category);
      }
    }
    return Array.from(categories).sort();
  }

  /**
   * Render the theme selector UI
   */
  render() {
    // Clear container (using empty string with innerHTML is safe for clearing)
    this.container.innerHTML = '';

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'theme-selector';

    // Add category filter if there are themes
    if (this.themes.length > 0) {
      const filterContainer = this.createCategoryFilter();
      wrapper.appendChild(filterContainer);
    }

    // Create grid container
    const grid = document.createElement('div');
    grid.className = 'theme-grid';

    // Create theme cards
    for (const theme of this.themes) {
      const card = this.createThemeCard(theme);
      grid.appendChild(card);
    }

    wrapper.appendChild(grid);
    this.container.appendChild(wrapper);

    // Apply current filter
    if (this.currentFilter !== 'all') {
      this.filterByCategory(this.currentFilter);
    }
  }

  /**
   * Create the category filter dropdown
   * @returns {HTMLElement} Filter container element
   */
  createCategoryFilter() {
    const container = document.createElement('div');
    container.className = 'theme-filter-container';

    const label = document.createElement('label');
    label.textContent = 'Category: ';
    label.htmlFor = 'theme-category-filter';

    const select = document.createElement('select');
    select.className = 'theme-category-filter';
    select.id = 'theme-category-filter';

    // Add "All Categories" option
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Categories';
    select.appendChild(allOption);

    // Add category options
    const categories = this.getCategories();
    for (const category of categories) {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    }

    // Set current filter value
    select.value = this.currentFilter;

    // Add change handler
    select.addEventListener('change', (e) => {
      this.filterByCategory(e.target.value);
    });

    container.appendChild(label);
    container.appendChild(select);

    return container;
  }

  /**
   * Create a theme card element
   * @param {object} theme - Theme object
   * @returns {HTMLElement} Theme card element
   */
  createThemeCard(theme) {
    const card = document.createElement('div');
    card.className = 'theme-card';
    card.dataset.themeId = theme.id;
    card.dataset.category = theme.category || '';

    // Add selected class if this is the current theme
    if (theme.id === this.currentTheme) {
      card.classList.add('selected');
    }

    // Accessibility attributes
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Select ${theme.name} theme`);

    // Theme name
    const name = document.createElement('div');
    name.className = 'theme-name';
    name.textContent = theme.name;
    card.appendChild(name);

    // Category badge
    if (theme.category) {
      const badge = document.createElement('div');
      badge.className = 'theme-category-badge';
      badge.textContent = theme.category;
      card.appendChild(badge);
    }

    // Color swatches container
    const swatchesContainer = document.createElement('div');
    swatchesContainer.className = 'theme-color-swatches';

    // Create swatches for background, primary, secondary
    if (theme.colors) {
      const colorKeys = ['background', 'primary', 'secondary'];
      for (const key of colorKeys) {
        if (theme.colors[key]) {
          const swatch = document.createElement('div');
          swatch.className = 'theme-color-swatch';
          swatch.style.backgroundColor = theme.colors[key];
          swatch.setAttribute('title', `${key}: ${theme.colors[key]}`);
          swatchesContainer.appendChild(swatch);
        }
      }
    }

    card.appendChild(swatchesContainer);

    // Description (if present)
    if (theme.description) {
      const description = document.createElement('div');
      description.className = 'theme-description';
      description.textContent = theme.description;
      card.appendChild(description);
    }

    // Click handler
    card.addEventListener('click', () => {
      this.selectTheme(theme.id);
    });

    // Keyboard handler
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.selectTheme(theme.id);
      }
    });

    return card;
  }

  /**
   * Select a theme by ID
   * @param {string} themeId - Theme ID to select
   */
  selectTheme(themeId) {
    // Update current theme
    this.currentTheme = themeId;

    // Update UI - remove selected from all cards
    const cards = this.container.querySelectorAll('.theme-card');
    for (const card of cards) {
      card.classList.remove('selected');
    }

    // Add selected to the chosen card
    const selectedCard = this.container.querySelector(`[data-theme-id="${themeId}"]`);
    if (selectedCard) {
      selectedCard.classList.add('selected');
    }

    // Emit onSelect event
    this.onSelect(themeId);
  }

  /**
   * Filter themes by category
   * @param {string} category - Category name or 'all' for all themes
   */
  filterByCategory(category) {
    this.currentFilter = category;

    // Update dropdown if it exists
    const select = this.container.querySelector('.theme-category-filter');
    if (select) {
      select.value = category;
    }

    // Filter cards
    const cards = this.container.querySelectorAll('.theme-card');
    for (const card of cards) {
      if (category === 'all' || card.dataset.category === category) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    }
  }

  /**
   * Load themes from API
   * @param {string} endpoint - API endpoint (default: /api/themes)
   * @returns {Promise<Array>} Array of theme objects
   */
  async loadThemes(endpoint = '/api/themes') {
    const response = await fetch(endpoint);

    if (!response.ok) {
      throw new Error(`Failed to load themes: ${response.status}`);
    }

    this.themes = await response.json();

    // Re-render with new themes
    this.render();

    return this.themes;
  }
}
