// ===========================================================================
// Widget Drag Controller — Native mouse events with grid snapping
// ===========================================================================

window.WidgetDragController = (function () {
  'use strict';

  const Utils = window.EditorUtils;

  class WidgetDragController {
    constructor(editorApp) {
      this.editorApp = editorApp;
      this.isDragging = false;
      this.draggedWidget = null;
      this.draggedElement = null;
      this.ghostElement = null;
      this.startMouseX = 0;
      this.startMouseY = 0;
      this.startCol = 0;
      this.startRow = 0;
      this.currentCol = 0;
      this.currentRow = 0;
      this.offsetX = 0;
      this.offsetY = 0;
    }

    /**
     * Attach drag handlers to a widget element
     */
    attachDragHandlers(widgetElement, widgetConfig) {
      // Add drag handle indicator
      if (!widgetElement.querySelector('.drag-handle')) {
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.title = 'Drag to move';
        dragHandle.innerHTML = '⋮⋮';
        widgetElement.appendChild(dragHandle);
      }

      // Mouse down on widget starts drag
      const onMouseDown = (e) => {
        // Only drag from widget background or title, not from content
        const target = e.target;
        if (target.closest('.widget-content') && !target.classList.contains('widget')) {
          return; // Don't drag when clicking inside widget content
        }

        // Prevent text selection during drag
        e.preventDefault();

        this.startDrag(widgetElement, widgetConfig, e);
      };

      widgetElement.addEventListener('mousedown', onMouseDown);

      // Store handler for later removal
      widgetElement._dragHandler = onMouseDown;
    }

    /**
     * Remove drag handlers from a widget element
     */
    detachDragHandlers(widgetElement) {
      if (widgetElement._dragHandler) {
        widgetElement.removeEventListener('mousedown', widgetElement._dragHandler);
        delete widgetElement._dragHandler;
      }

      // Remove drag handle
      const dragHandle = widgetElement.querySelector('.drag-handle');
      if (dragHandle) dragHandle.remove();
    }

    /**
     * Start dragging a widget
     */
    startDrag(widgetElement, widgetConfig, event) {
      this.isDragging = true;
      this.draggedWidget = widgetConfig;
      this.draggedElement = widgetElement;
      this.startMouseX = event.clientX;
      this.startMouseY = event.clientY;

      // Get current position
      const pos = widgetConfig.position;
      this.startCol = pos.col;
      this.startRow = pos.row;
      this.currentCol = pos.col;
      this.currentRow = pos.row;

      // Calculate mouse offset within widget
      const rect = widgetElement.getBoundingClientRect();
      this.offsetX = event.clientX - rect.left;
      this.offsetY = event.clientY - rect.top;

      // Create ghost element
      this.createGhost(widgetElement);

      // Add dragging class
      widgetElement.classList.add('dragging');
      document.body.classList.add('is-dragging');

      // Attach global mouse move and up handlers
      document.addEventListener('mousemove', this.onDrag);
      document.addEventListener('mouseup', this.onDragEnd);

      // Show initial cell highlights
      const colSpan = pos.colSpan || 1;
      const rowSpan = pos.rowSpan || 1;
      const isValid = Utils.isWithinBounds(this.currentCol, this.currentRow, colSpan, rowSpan, this.editorApp) &&
                      !Utils.checkCollision(this.currentCol, this.currentRow, colSpan, rowSpan, widgetConfig.id, this.editorApp);
      Utils.highlightCells(this.currentCol, this.currentRow, colSpan, rowSpan, isValid);
    }

    /**
     * Create ghost element that follows cursor
     */
    createGhost(widgetElement) {
      this.ghostElement = widgetElement.cloneNode(true);
      this.ghostElement.classList.add('widget-ghost');
      this.ghostElement.classList.remove('selected', 'editable');
      this.ghostElement.style.position = 'fixed';
      this.ghostElement.style.pointerEvents = 'none';
      this.ghostElement.style.zIndex = '10003';
      this.ghostElement.style.opacity = '0.7';

      // Copy dimensions
      const rect = widgetElement.getBoundingClientRect();
      this.ghostElement.style.width = rect.width + 'px';
      this.ghostElement.style.height = rect.height + 'px';

      document.body.appendChild(this.ghostElement);
    }

    /**
     * Handle drag movement
     */
    onDrag = (event) => {
      if (!this.isDragging) return;

      // Update ghost position to follow cursor
      if (this.ghostElement) {
        this.ghostElement.style.left = (event.clientX - this.offsetX) + 'px';
        this.ghostElement.style.top = (event.clientY - this.offsetY) + 'px';
      }

      // Calculate which grid cell the cursor is over
      const cell = Utils.mouseToGridCell(event.clientX, event.clientY, this.editorApp);
      if (!cell) return;

      // Update current position if changed
      if (cell.col !== this.currentCol || cell.row !== this.currentRow) {
        this.currentCol = cell.col;
        this.currentRow = cell.row;

        // Check if this position is valid
        const pos = this.draggedWidget.position;
        const colSpan = pos.colSpan || 1;
        const rowSpan = pos.rowSpan || 1;

        const isValid = Utils.isWithinBounds(this.currentCol, this.currentRow, colSpan, rowSpan, this.editorApp) &&
                        !Utils.checkCollision(this.currentCol, this.currentRow, colSpan, rowSpan, this.draggedWidget.id, this.editorApp);

        // Highlight cells
        Utils.highlightCells(this.currentCol, this.currentRow, colSpan, rowSpan, isValid);

        // Update ghost appearance
        if (this.ghostElement) {
          this.ghostElement.classList.toggle('invalid-position', !isValid);
        }
      }
    };

    /**
     * End drag operation
     */
    onDragEnd = (event) => {
      if (!this.isDragging) return;

      // Check if final position is valid
      const pos = this.draggedWidget.position;
      const colSpan = pos.colSpan || 1;
      const rowSpan = pos.rowSpan || 1;

      const isValid = Utils.isWithinBounds(this.currentCol, this.currentRow, colSpan, rowSpan, this.editorApp) &&
                      !Utils.checkCollision(this.currentCol, this.currentRow, colSpan, rowSpan, this.draggedWidget.id, this.editorApp);

      if (isValid && (this.currentCol !== this.startCol || this.currentRow !== this.startRow)) {
        // Update widget position
        this.editorApp.updateWidgetConfig(this.draggedWidget.id, {
          position: {
            col: this.currentCol,
            row: this.currentRow,
            colSpan: colSpan,
            rowSpan: rowSpan
          }
        });

        this.editorApp.showNotification(
          `Moved widget to (${this.currentCol}, ${this.currentRow})`,
          'success'
        );
      } else if (!isValid) {
        // Position is invalid, revert
        this.editorApp.showNotification(
          'Cannot move widget there - position is blocked or out of bounds',
          'error'
        );
      }

      // Clean up
      this.cleanup();
    };

    /**
     * Clean up after drag
     */
    cleanup() {
      // Remove ghost
      if (this.ghostElement) {
        this.ghostElement.remove();
        this.ghostElement = null;
      }

      // Remove classes
      if (this.draggedElement) {
        this.draggedElement.classList.remove('dragging');
      }
      document.body.classList.remove('is-dragging');

      // Clear highlights
      Utils.clearCellHighlights();

      // Remove global event listeners
      document.removeEventListener('mousemove', this.onDrag);
      document.removeEventListener('mouseup', this.onDragEnd);

      // Reset state
      this.isDragging = false;
      this.draggedWidget = null;
      this.draggedElement = null;
    }

    /**
     * Palette drag started - handle dragging new widget from palette
     */
    onPaletteDragStart(widgetType) {
      console.log('[Drag] Palette drag start:', widgetType.type);
      this.isPaletteDragging = true;
      this.paletteWidgetType = widgetType;

      // Add body class for styling
      document.body.classList.add('is-palette-dragging');

      // Listen for dragover and drop events on dashboard
      const dashboardPage = document.querySelector('.dashboard-page.active');
      if (dashboardPage) {
        dashboardPage.addEventListener('dragover', this.onPaletteDragOver);
        dashboardPage.addEventListener('drop', this.onPaletteDrop);
      }

      // Highlight grid cells
      this.highlightGridForPalette(widgetType);
    }

    /**
     * Palette drag ended
     */
    onPaletteDragEnd() {
      console.log('[Drag] Palette drag end');
      document.body.classList.remove('is-palette-dragging');
      Utils.clearCellHighlights();

      const dashboardPage = document.querySelector('.dashboard-page.active');
      if (dashboardPage) {
        dashboardPage.removeEventListener('dragover', this.onPaletteDragOver);
        dashboardPage.removeEventListener('drop', this.onPaletteDrop);
      }

      this.isPaletteDragging = false;
      this.paletteWidgetType = null;
    }

    /**
     * Handle dragover on dashboard when dragging from palette
     */
    onPaletteDragOver = (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';

      if (!this.paletteWidgetType) return;

      // Get grid cell from mouse position
      const cell = Utils.mouseToGridCell(event.clientX, event.clientY);
      if (!cell) return;

      // Check if widget fits at this position
      const widgetSize = {
        colSpan: this.paletteWidgetType.defaultConfig.position.colSpan,
        rowSpan: this.paletteWidgetType.defaultConfig.position.rowSpan
      };

      const isValid = this.checkPalettePlacement(cell, widgetSize);

      // Update cell highlights
      this.highlightPaletteDropZone(cell, widgetSize, isValid);
    }

    /**
     * Handle drop on dashboard when dragging from palette
     */
    onPaletteDrop = (event) => {
      event.preventDefault();

      if (!this.paletteWidgetType) return;

      // Get drop position
      const cell = Utils.mouseToGridCell(event.clientX, event.clientY);
      if (!cell) {
        this.editorApp.showNotification('Invalid drop location', 'error');
        return;
      }

      // Check if widget fits
      const widgetSize = {
        colSpan: this.paletteWidgetType.defaultConfig.position.colSpan,
        rowSpan: this.paletteWidgetType.defaultConfig.position.rowSpan
      };

      if (!this.checkPalettePlacement(cell, widgetSize)) {
        this.editorApp.showNotification('Cannot place widget here - overlaps with existing widget', 'error');
        return;
      }

      // Create new widget
      this.createWidgetFromPalette(this.paletteWidgetType, cell);
    }

    /**
     * Check if palette widget can be placed at position
     */
    checkPalettePlacement(position, size) {
      // Check bounds
      const currentDash = this.editorApp.modifiedConfig.dashboards[this.editorApp.dashboardApp.currentPage];
      const isWithinBounds = Utils.isWithinBounds(position, size, currentDash.grid);

      if (!isWithinBounds) return false;

      // Check collisions with existing widgets
      const hasCollision = Utils.checkCollision(position, size, currentDash.widgets, null);

      return !hasCollision;
    }

    /**
     * Highlight grid cells for palette drop
     */
    highlightGridForPalette(widgetType) {
      Utils.clearCellHighlights();
      // Grid cells will be highlighted on dragover
    }

    /**
     * Highlight drop zone for palette widget
     */
    highlightPaletteDropZone(position, size, isValid) {
      Utils.clearCellHighlights();

      const className = isValid ? 'valid-drop' : 'invalid-drop';

      for (let r = 0; r < size.rowSpan; r++) {
        for (let c = 0; c < size.colSpan; c++) {
          const col = position.col + c;
          const row = position.row + r;
          const cell = document.querySelector(`.grid-cell[data-col="${col}"][data-row="${row}"]`);
          if (cell) {
            cell.classList.add(className);
          }
        }
      }
    }

    /**
     * Create new widget from palette
     */
    createWidgetFromPalette(widgetType, position) {
      console.log('[Drag] Creating widget from palette:', widgetType.type, 'at', position);

      // Get palette instance to create widget config
      const palette = this.editorApp.palette;
      if (!palette) {
        console.error('[Drag] Palette not available');
        return;
      }

      // Create widget configuration
      const widgetConfig = palette.createWidgetConfig(widgetType, position);

      // Add widget to dashboard
      const currentDash = this.editorApp.modifiedConfig.dashboards[this.editorApp.dashboardApp.currentPage];
      currentDash.widgets.push(widgetConfig);

      // Mark as modified
      this.editorApp.markAsModified();

      // Refresh dashboard display
      this.editorApp.dashboardApp.showPage(this.editorApp.dashboardApp.currentPage);

      // Re-attach editor handlers
      this.editorApp.attachWidgetHandlers();

      // Show notification
      this.editorApp.showNotification(`${widgetType.name} widget added`, 'success');

      // Select the new widget
      setTimeout(() => {
        const newWidgetElement = document.querySelector(`[data-widget-id="${widgetConfig.id}"]`);
        if (newWidgetElement) {
          this.editorApp.selectWidget(newWidgetElement);
        }
      }, 100);
    }

    /**
     * Detach all drag handlers
     */
    detachAll() {
      const widgets = document.querySelectorAll('.widget.editable');
      widgets.forEach(widget => this.detachDragHandlers(widget));
    }
  }

  return WidgetDragController;
})();
