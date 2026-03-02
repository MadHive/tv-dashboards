// public/js/components/tv-preview.js

/**
 * TVPreview - Fullscreen TV simulation modal for theme previewing
 *
 * Features:
 * - Fullscreen modal overlay with TV viewport simulation
 * - Three TV size presets (55", 65", 85") with accurate scaling
 * - Live theme application to sample dashboard
 * - Mock widgets showing theme colors in action
 * - ESC key support for quick closing
 * - Apply button to confirm theme selection
 */
export class TVPreview {
  /**
   * Create a TVPreview
   * @param {object} config - Configuration object
   * @param {HTMLElement} config.container - DOM element (not used for modal, but kept for consistency)
   * @param {object} config.theme - Theme object with colors
   * @param {object} config.dashboardConfig - Dashboard configuration with widgets
   * @param {Function} config.onApply - Callback when Apply is clicked (receives theme)
   */
  constructor(config) {
    this.container = config.container;
    this.theme = config.theme;
    this.dashboardConfig = config.dashboardConfig;
    this.onApply = config.onApply || (() => {});
    this.currentSize = '55'; // Default to 55" TV
    this.modal = null;
    this.escHandler = null;
  }

  /**
   * Open the preview modal
   */
  open() {
    // If modal already exists, don't create another one
    if (this.modal && document.body.contains(this.modal)) {
      this.modal.classList.add('open');
      return;
    }

    // Create modal
    this.modal = this.render();
    document.body.appendChild(this.modal);

    // Add ESC key listener
    this.escHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', this.escHandler);

    // Trigger open animation after a brief delay for smooth transition
    // Use requestAnimationFrame for better timing control
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.modal) {
          this.modal.classList.add('open');
        }
      });
    });
  }

  /**
   * Close the preview modal
   */
  close() {
    if (!this.modal) return;

    // Remove open class for closing animation
    this.modal.classList.remove('open');

    // Remove ESC key listener
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
      this.escHandler = null;
    }

    // Remove modal from DOM after animation completes (300ms)
    setTimeout(() => {
      if (this.modal && this.modal.parentElement) {
        this.modal.remove();
      }
    }, 300);
  }

  /**
   * Render the modal structure
   * @returns {HTMLElement} Modal element
   */
  render() {
    const modal = document.createElement('div');
    modal.className = 'tv-preview-modal';

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'tv-preview-overlay';
    modal.appendChild(overlay);

    // Controls container (top bar)
    const controls = this.renderControls();
    modal.appendChild(controls);

    // TV viewport container
    const viewportContainer = document.createElement('div');
    viewportContainer.className = 'tv-preview-container';

    const viewport = this.renderViewport();
    viewportContainer.appendChild(viewport);

    modal.appendChild(viewportContainer);

    return modal;
  }

  /**
   * Render controls (size buttons, close, apply)
   * @returns {HTMLElement} Controls container
   */
  renderControls() {
    const controls = document.createElement('div');
    controls.className = 'tv-preview-controls';

    // Size selector buttons
    const sizeSelector = document.createElement('div');
    sizeSelector.className = 'tv-size-selector';

    const sizes = ['55', '65', '85'];
    for (const size of sizes) {
      const btn = document.createElement('button');
      btn.className = 'tv-size-btn';
      btn.dataset.size = size;
      btn.textContent = `${size}"`;

      if (size === this.currentSize) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', () => {
        this.setSize(size);
      });

      sizeSelector.appendChild(btn);
    }

    controls.appendChild(sizeSelector);

    // Action buttons container
    const actions = document.createElement('div');
    actions.className = 'tv-preview-actions';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tv-preview-close';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => {
      this.close();
    });
    actions.appendChild(closeBtn);

    // Apply button
    const applyBtn = document.createElement('button');
    applyBtn.className = 'tv-preview-apply';
    applyBtn.textContent = 'Apply Theme';
    applyBtn.addEventListener('click', () => {
      this.onApply(this.theme);
      this.close();
    });
    actions.appendChild(applyBtn);

    controls.appendChild(actions);

    return controls;
  }

  /**
   * Render the TV viewport with dashboard preview
   * @returns {HTMLElement} Viewport element
   */
  renderViewport() {
    const viewport = document.createElement('div');
    viewport.className = `tv-preview-viewport size-${this.currentSize}`;

    // Validate and apply background color
    if (this.theme.colors && this.theme.colors.background) {
      const bgColor = this.validateColor(this.theme.colors.background);
      if (bgColor) {
        viewport.style.backgroundColor = bgColor;
      }
    }

    // Render dashboard
    const dashboard = this.renderDashboard();
    viewport.appendChild(dashboard);

    return viewport;
  }

  /**
   * Render the dashboard preview with theme applied
   * @returns {HTMLElement} Dashboard element
   */
  renderDashboard() {
    const dashboard = document.createElement('div');
    dashboard.className = 'preview-dashboard';

    // Dashboard header
    const header = document.createElement('div');
    header.className = 'preview-dashboard-header';

    const name = document.createElement('h1');
    name.className = 'preview-dashboard-name';
    // Use textContent to prevent XSS
    name.textContent = this.dashboardConfig.name || 'Dashboard Preview';

    // Apply text color if available
    if (this.theme.colors && this.theme.colors.text) {
      const textColor = this.validateColor(this.theme.colors.text);
      if (textColor) {
        name.style.color = textColor;
      }
    }

    header.appendChild(name);

    // Subtitle if available
    if (this.dashboardConfig.subtitle) {
      const subtitle = document.createElement('div');
      subtitle.className = 'preview-dashboard-subtitle';
      subtitle.textContent = this.dashboardConfig.subtitle;

      if (this.theme.colors && this.theme.colors.text) {
        const textColor = this.validateColor(this.theme.colors.text);
        if (textColor) {
          subtitle.style.color = textColor;
          subtitle.style.opacity = '0.7';
        }
      }

      header.appendChild(subtitle);
    }

    dashboard.appendChild(header);

    // Dashboard grid
    const grid = this.renderDashboardGrid();
    dashboard.appendChild(grid);

    return dashboard;
  }

  /**
   * Render dashboard grid with mock widgets
   * @returns {HTMLElement} Grid element
   */
  renderDashboardGrid() {
    const grid = document.createElement('div');
    grid.className = 'preview-dashboard-grid';

    // Apply grid configuration if available
    if (this.dashboardConfig.grid) {
      const { columns, rows, gap } = this.dashboardConfig.grid;
      if (columns) {
        grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
      }
      if (gap) {
        grid.style.gap = `${gap}px`;
      }
    }

    // Render widgets
    const widgets = this.renderMockWidgets();
    for (const widget of widgets) {
      grid.appendChild(widget);
    }

    return grid;
  }

  /**
   * Render mock widgets showing theme colors
   * @returns {Array<HTMLElement>} Array of widget elements
   */
  renderMockWidgets() {
    const widgets = [];

    if (!this.dashboardConfig.widgets || this.dashboardConfig.widgets.length === 0) {
      return widgets;
    }

    for (const widgetConfig of this.dashboardConfig.widgets) {
      const widget = document.createElement('div');
      widget.className = 'preview-widget';
      widget.dataset.widgetType = widgetConfig.type || 'unknown';

      // Apply grid position if available
      if (widgetConfig.position) {
        const { col, row, colSpan, rowSpan } = widgetConfig.position;
        if (col) widget.style.gridColumnStart = col;
        if (row) widget.style.gridRowStart = row;
        if (colSpan) widget.style.gridColumnEnd = `span ${colSpan}`;
        if (rowSpan) widget.style.gridRowEnd = `span ${rowSpan}`;
      }

      // Widget card with theme colors
      const card = document.createElement('div');
      card.className = 'preview-widget-card';

      // Apply theme colors to card
      if (this.theme.colors) {
        const primaryColor = this.validateColor(this.theme.colors.primary);
        const secondaryColor = this.validateColor(this.theme.colors.secondary);

        if (primaryColor) {
          card.style.borderColor = primaryColor;
        }

        // Alternating accent colors for visual interest
        const useSecondary = widgets.length % 2 === 1;
        const accentColor = useSecondary && secondaryColor ? secondaryColor : primaryColor;

        if (accentColor) {
          // Use data attribute for CSS variable (compatible with test mocks)
          card.dataset.accentColor = accentColor;
          // For real DOM, also set CSS custom property
          if (card.style.setProperty) {
            card.style.setProperty('--accent-color', accentColor);
          }
        }
      }

      // Widget title
      if (widgetConfig.title) {
        const title = document.createElement('div');
        title.className = 'preview-widget-title';
        title.textContent = widgetConfig.title;

        if (this.theme.colors && this.theme.colors.text) {
          const textColor = this.validateColor(this.theme.colors.text);
          if (textColor) {
            title.style.color = textColor;
          }
        }

        card.appendChild(title);
      }

      // Mock content area
      const content = document.createElement('div');
      content.className = 'preview-widget-content';

      // Create different mock content based on widget type
      const mockContent = this.createMockWidgetContent(widgetConfig.type || 'big-number');
      content.appendChild(mockContent);

      card.appendChild(content);
      widget.appendChild(card);
      widgets.push(widget);
    }

    return widgets;
  }

  /**
   * Create mock content for different widget types
   * @param {string} type - Widget type
   * @returns {HTMLElement} Mock content element
   */
  createMockWidgetContent(type) {
    const content = document.createElement('div');
    content.className = `mock-${type}`;

    const primaryColor = this.validateColor(this.theme.colors?.primary);
    const secondaryColor = this.validateColor(this.theme.colors?.secondary);
    const textColor = this.validateColor(this.theme.colors?.text);

    switch (type) {
      case 'big-number':
        const number = document.createElement('div');
        number.className = 'mock-big-number';
        number.textContent = '12,345';
        if (primaryColor) number.style.color = primaryColor;
        content.appendChild(number);
        break;

      case 'gauge':
        const gauge = document.createElement('div');
        gauge.className = 'mock-gauge';
        const arc = document.createElement('div');
        arc.className = 'mock-gauge-arc';
        if (secondaryColor) arc.style.borderColor = secondaryColor;
        gauge.appendChild(arc);
        content.appendChild(gauge);
        break;

      case 'stat-card':
        const stat = document.createElement('div');
        stat.className = 'mock-stat';
        stat.textContent = '85%';
        if (primaryColor) stat.style.color = primaryColor;
        content.appendChild(stat);
        break;

      default:
        // Generic placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'mock-placeholder';
        placeholder.textContent = '📊';
        if (textColor) placeholder.style.color = textColor;
        content.appendChild(placeholder);
    }

    return content;
  }

  /**
   * Switch TV size
   * @param {string} size - Size code ('55', '65', '85')
   */
  setSize(size) {
    this.currentSize = size;

    // Update button states
    const buttons = this.modal.querySelectorAll('.tv-size-btn');
    for (const btn of buttons) {
      if (btn.dataset.size === size) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }

    // Update viewport size class
    const viewport = this.modal.querySelector('.tv-preview-viewport');
    if (viewport) {
      viewport.className = `tv-preview-viewport size-${size}`;

      // Reapply background color (classes might reset styles)
      if (this.theme.colors && this.theme.colors.background) {
        const bgColor = this.validateColor(this.theme.colors.background);
        if (bgColor) {
          viewport.style.backgroundColor = bgColor;
        }
      }
    }
  }

  /**
   * Validate color format to prevent CSS injection
   * @param {string} color - Color value to validate
   * @returns {string|null} Validated color or null if invalid
   */
  validateColor(color) {
    if (!color || typeof color !== 'string') return null;

    // Allow hex colors, rgb/rgba, hsl/hsla, and named colors
    const colorRegex = /^(#[0-9A-Fa-f]{3,8}|rgba?\([\d\s,%.]+\)|hsla?\([\d\s,%.deg]+\)|[a-z]+)$/i;

    if (colorRegex.test(color)) {
      return color;
    }

    return null;
  }
}
