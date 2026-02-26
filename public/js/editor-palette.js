// ===========================================================================
// Widget Palette — Draggable widget types for creating new widgets
// ===========================================================================

window.WidgetPalette = (function () {
  'use strict';

  // Widget type definitions with metadata
  const WIDGET_TYPES = [
    {
      type: 'big-number',
      name: 'Big Number',
      icon: '📊',
      description: 'Large numeric value display',
      defaultConfig: {
        title: 'New Metric',
        source: 'mock',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 }
      }
    },
    {
      type: 'stat-card',
      name: 'Stat Card',
      icon: '📈',
      description: 'Metric with sparkline',
      defaultConfig: {
        title: 'New Stat',
        source: 'mock',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 }
      }
    },
    {
      type: 'gauge',
      name: 'Gauge',
      icon: '⏲️',
      description: 'Circular gauge meter',
      defaultConfig: {
        title: 'New Gauge',
        source: 'mock',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
        min: 0,
        max: 100,
        unit: '%'
      }
    },
    {
      type: 'gauge-row',
      name: 'Gauge Row',
      icon: '📶',
      description: 'Horizontal gauge bars',
      defaultConfig: {
        title: 'New Gauge Row',
        source: 'mock',
        position: { col: 1, row: 1, colSpan: 3, rowSpan: 2 }
      }
    },
    {
      type: 'bar-chart',
      name: 'Bar Chart',
      icon: '📊',
      description: 'Vertical bar chart',
      defaultConfig: {
        title: 'New Chart',
        source: 'mock',
        position: { col: 1, row: 1, colSpan: 3, rowSpan: 2 }
      }
    },
    {
      type: 'progress-bar',
      name: 'Progress Bar',
      icon: '▬',
      description: 'Horizontal progress indicator',
      defaultConfig: {
        title: 'New Progress',
        source: 'mock',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 }
      }
    },
    {
      type: 'status-grid',
      name: 'Status Grid',
      icon: '🔲',
      description: 'Grid of status items',
      defaultConfig: {
        title: 'New Status Grid',
        source: 'mock',
        position: { col: 1, row: 1, colSpan: 4, rowSpan: 3 }
      }
    },
    {
      type: 'alert-list',
      name: 'Alert List',
      icon: '⚠️',
      description: 'List of alerts/notifications',
      defaultConfig: {
        title: 'New Alerts',
        source: 'mock',
        position: { col: 1, row: 1, colSpan: 3, rowSpan: 2 }
      }
    },
    {
      type: 'service-heatmap',
      name: 'Service Heatmap',
      icon: '🔥',
      description: 'Service health heatmap',
      defaultConfig: {
        title: 'New Heatmap',
        source: 'mock',
        position: { col: 1, row: 1, colSpan: 4, rowSpan: 3 }
      }
    },
    {
      type: 'pipeline-flow',
      name: 'Pipeline Flow',
      icon: '⚙️',
      description: 'Data pipeline visualization',
      defaultConfig: {
        title: 'New Pipeline',
        source: 'mock',
        position: { col: 1, row: 1, colSpan: 6, rowSpan: 2 }
      }
    },
    {
      type: 'usa-map',
      name: 'USA Map',
      icon: '🗺️',
      description: 'United States map visualization',
      defaultConfig: {
        title: 'New Map',
        source: 'mock',
        position: { col: 1, row: 1, colSpan: 6, rowSpan: 4 }
      }
    },
    {
      type: 'security-scorecard',
      name: 'Security Scorecard',
      icon: '🛡️',
      description: 'Security posture overview',
      defaultConfig: {
        title: 'Security Posture',
        source: 'vulntrack',
        position: { col: 1, row: 1, colSpan: 6, rowSpan: 4 }
      }
    }
  ];

  class WidgetPalette {
    constructor(editorApp) {
      this.editorApp = editorApp;
      this.paletteElement = null;
      this.isVisible = false;
      this.draggedWidgetType = null;

      this.init();
    }

    init() {
      this.createPalette();
      this.attachEventListeners();
    }

    createPalette() {
      // Create palette container
      this.paletteElement = document.createElement('div');
      this.paletteElement.className = 'widget-palette';
      this.paletteElement.style.display = 'none'; // Hidden by default

      // Create header
      const header = document.createElement('div');
      header.className = 'palette-header';
      header.innerHTML = `
        <span class="palette-title">Widget Palette</span>
        <button class="palette-close" title="Close Palette">&times;</button>
      `;
      this.paletteElement.appendChild(header);

      // Create widget type list
      const widgetList = document.createElement('div');
      widgetList.className = 'palette-widget-list';

      WIDGET_TYPES.forEach(widgetType => {
        const item = this.createPaletteItem(widgetType);
        widgetList.appendChild(item);
      });

      this.paletteElement.appendChild(widgetList);

      // Add to document
      document.body.appendChild(this.paletteElement);

      // Attach close button handler
      const closeBtn = header.querySelector('.palette-close');
      closeBtn.addEventListener('click', () => this.hide());
    }

    createPaletteItem(widgetType) {
      const item = document.createElement('div');
      item.className = 'palette-item';
      item.draggable = true;
      item.dataset.widgetType = widgetType.type;

      item.innerHTML = `
        <div class="palette-item-icon">${widgetType.icon}</div>
        <div class="palette-item-content">
          <div class="palette-item-name">${widgetType.name}</div>
          <div class="palette-item-description">${widgetType.description}</div>
        </div>
      `;

      // Drag events
      item.addEventListener('dragstart', (e) => this.onDragStart(e, widgetType));
      item.addEventListener('dragend', (e) => this.onDragEnd(e));

      return item;
    }

    attachEventListeners() {
      // Listen for editor state changes
      document.addEventListener('editorStateChanged', (e) => {
        if (e.detail.isActive) {
          this.show();
        } else {
          this.hide();
        }
      });
    }

    show() {
      if (!this.paletteElement) return;
      this.paletteElement.style.display = 'flex';
      this.isVisible = true;
    }

    hide() {
      if (!this.paletteElement) return;
      this.paletteElement.style.display = 'none';
      this.isVisible = false;
    }

    onDragStart(event, widgetType) {
      console.log('[Palette] Drag start:', widgetType.type);
      this.draggedWidgetType = widgetType;

      // Set drag data
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', widgetType.type);
      event.dataTransfer.setData('application/widget-palette', JSON.stringify(widgetType));

      // Create drag image
      const dragImage = document.createElement('div');
      dragImage.className = 'palette-drag-image';
      dragImage.innerHTML = `
        <div class="drag-icon">${widgetType.icon}</div>
        <div class="drag-name">${widgetType.name}</div>
      `;
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      document.body.appendChild(dragImage);
      event.dataTransfer.setDragImage(dragImage, 40, 20);

      // Remove drag image after a brief delay
      setTimeout(() => dragImage.remove(), 0);

      // Add dragging class
      event.target.classList.add('dragging');

      // Notify editor that palette drag started
      if (this.editorApp && this.editorApp.dragController) {
        this.editorApp.dragController.onPaletteDragStart(widgetType);
      }
    }

    onDragEnd(event) {
      console.log('[Palette] Drag end');
      event.target.classList.remove('dragging');
      this.draggedWidgetType = null;

      // Notify editor that palette drag ended
      if (this.editorApp && this.editorApp.dragController) {
        this.editorApp.dragController.onPaletteDragEnd();
      }
    }

    getWidgetType(type) {
      return WIDGET_TYPES.find(wt => wt.type === type);
    }

    getAllWidgetTypes() {
      return [...WIDGET_TYPES];
    }

    generateWidgetId(type) {
      // Generate unique widget ID based on type and timestamp
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      return `${type}-${timestamp}-${random}`;
    }

    createWidgetConfig(widgetType, position) {
      // Create new widget configuration
      const config = {
        id: this.generateWidgetId(widgetType.type),
        type: widgetType.type,
        title: widgetType.defaultConfig.title,
        source: widgetType.defaultConfig.source,
        position: {
          col: position.col,
          row: position.row,
          colSpan: widgetType.defaultConfig.position.colSpan,
          rowSpan: widgetType.defaultConfig.position.rowSpan
        }
      };

      // Add type-specific config
      if (widgetType.defaultConfig.min !== undefined) {
        config.min = widgetType.defaultConfig.min;
      }
      if (widgetType.defaultConfig.max !== undefined) {
        config.max = widgetType.defaultConfig.max;
      }
      if (widgetType.defaultConfig.unit !== undefined) {
        config.unit = widgetType.defaultConfig.unit;
      }

      return config;
    }
  }

  return WidgetPalette;
})();
