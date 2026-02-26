// ===========================================================================
// Widget Resize Controller — 8-handle resize with grid snapping
// ===========================================================================

window.ResizeController = (function () {
  'use strict';

  const Utils = window.EditorUtils;

  class ResizeController {
    constructor(editorApp) {
      this.editorApp = editorApp;
      this.isResizing = false;
      this.resizedWidget = null;
      this.resizedElement = null;
      this.resizeHandle = null;
      this.startMouseX = 0;
      this.startMouseY = 0;
      this.startCol = 0;
      this.startRow = 0;
      this.startColSpan = 1;
      this.startRowSpan = 1;
      this.currentColSpan = 1;
      this.currentRowSpan = 1;
    }

    /**
     * Attach resize handles to selected widget
     */
    attachHandles(widgetElement, widgetConfig) {
      // Remove existing handles
      this.removeHandles(widgetElement);

      // Create resize handles container
      const handlesContainer = document.createElement('div');
      handlesContainer.className = 'resize-handles';

      // Create 4 corner handles + 4 edge handles
      const handles = [
        { position: 'nw', cursor: 'nw-resize' },
        { position: 'n',  cursor: 'n-resize' },
        { position: 'ne', cursor: 'ne-resize' },
        { position: 'e',  cursor: 'e-resize' },
        { position: 'se', cursor: 'se-resize' },
        { position: 's',  cursor: 's-resize' },
        { position: 'sw', cursor: 'sw-resize' },
        { position: 'w',  cursor: 'w-resize' }
      ];

      handles.forEach(handleDef => {
        const handle = document.createElement('div');
        handle.className = `resize-handle resize-handle-${handleDef.position}`;
        handle.style.cursor = handleDef.cursor;
        handle.dataset.position = handleDef.position;

        handle.addEventListener('mousedown', (e) => {
          e.stopPropagation(); // Don't trigger widget drag
          this.startResize(widgetElement, widgetConfig, handleDef.position, e);
        });

        handlesContainer.appendChild(handle);
      });

      widgetElement.appendChild(handlesContainer);
    }

    /**
     * Remove resize handles from widget
     */
    removeHandles(widgetElement) {
      const existingHandles = widgetElement.querySelector('.resize-handles');
      if (existingHandles) {
        existingHandles.remove();
      }
    }

    /**
     * Start resizing operation
     */
    startResize(widgetElement, widgetConfig, handlePosition, event) {
      event.preventDefault();

      this.isResizing = true;
      this.resizedWidget = widgetConfig;
      this.resizedElement = widgetElement;
      this.resizeHandle = handlePosition;
      this.startMouseX = event.clientX;
      this.startMouseY = event.clientY;

      // Get current position and size
      const pos = widgetConfig.position;
      this.startCol = pos.col;
      this.startRow = pos.row;
      this.startColSpan = pos.colSpan || 1;
      this.startRowSpan = pos.rowSpan || 1;
      this.currentColSpan = this.startColSpan;
      this.currentRowSpan = this.startRowSpan;

      // Add resizing class
      widgetElement.classList.add('resizing');
      document.body.classList.add('is-resizing');

      // Attach global mouse move and up handlers
      document.addEventListener('mousemove', this.onResize);
      document.addEventListener('mouseup', this.onResizeEnd);
    }

    /**
     * Handle resize movement
     */
    onResize = (event) => {
      if (!this.isResizing) return;

      const deltaX = event.clientX - this.startMouseX;
      const deltaY = event.clientY - this.startMouseY;

      const cellSize = Utils.getCellSize(this.editorApp);
      if (!cellSize) return;

      // Calculate cell delta based on handle position
      const cellDeltaX = Math.round(deltaX / (cellSize.width + cellSize.gap));
      const cellDeltaY = Math.round(deltaY / (cellSize.height + cellSize.gap));

      let newCol = this.startCol;
      let newRow = this.startRow;
      let newColSpan = this.startColSpan;
      let newRowSpan = this.startRowSpan;

      // Adjust position and size based on which handle is being dragged
      switch (this.resizeHandle) {
        case 'nw':
          newCol = this.startCol + cellDeltaX;
          newRow = this.startRow + cellDeltaY;
          newColSpan = this.startColSpan - cellDeltaX;
          newRowSpan = this.startRowSpan - cellDeltaY;
          break;
        case 'n':
          newRow = this.startRow + cellDeltaY;
          newRowSpan = this.startRowSpan - cellDeltaY;
          break;
        case 'ne':
          newRow = this.startRow + cellDeltaY;
          newColSpan = this.startColSpan + cellDeltaX;
          newRowSpan = this.startRowSpan - cellDeltaY;
          break;
        case 'e':
          newColSpan = this.startColSpan + cellDeltaX;
          break;
        case 'se':
          newColSpan = this.startColSpan + cellDeltaX;
          newRowSpan = this.startRowSpan + cellDeltaY;
          break;
        case 's':
          newRowSpan = this.startRowSpan + cellDeltaY;
          break;
        case 'sw':
          newCol = this.startCol + cellDeltaX;
          newColSpan = this.startColSpan - cellDeltaX;
          newRowSpan = this.startRowSpan + cellDeltaY;
          break;
        case 'w':
          newCol = this.startCol + cellDeltaX;
          newColSpan = this.startColSpan - cellDeltaX;
          break;
      }

      // Enforce minimum size (1x1)
      newColSpan = Math.max(1, newColSpan);
      newRowSpan = Math.max(1, newRowSpan);

      // Check if new position/size is valid
      const isValid = Utils.isWithinBounds(newCol, newRow, newColSpan, newRowSpan, this.editorApp) &&
                      !Utils.checkCollision(newCol, newRow, newColSpan, newRowSpan, this.resizedWidget.id, this.editorApp);

      // Update preview if changed
      if (newColSpan !== this.currentColSpan || newRowSpan !== this.currentRowSpan ||
          newCol !== this.startCol || newRow !== this.startRow) {
        this.currentColSpan = newColSpan;
        this.currentRowSpan = newRowSpan;

        // Update widget DOM for live preview
        this.resizedElement.style.gridColumn = `${newCol} / span ${newColSpan}`;
        this.resizedElement.style.gridRow = `${newRow} / span ${newRowSpan}`;

        // Highlight cells
        Utils.highlightCells(newCol, newRow, newColSpan, newRowSpan, isValid);

        // Visual feedback
        this.resizedElement.classList.toggle('invalid-resize', !isValid);
      }
    };

    /**
     * End resize operation
     */
    onResizeEnd = (event) => {
      if (!this.isResizing) return;

      // Get final position/size from DOM
      const style = this.resizedElement.style;
      const gridColumn = style.gridColumn;
      const gridRow = style.gridRow;

      // Parse grid values
      const colMatch = gridColumn.match(/(\d+)\s*\/\s*span\s*(\d+)/);
      const rowMatch = gridRow.match(/(\d+)\s*\/\s*span\s*(\d+)/);

      if (colMatch && rowMatch) {
        const finalCol = parseInt(colMatch[1]);
        const finalRow = parseInt(rowMatch[1]);
        const finalColSpan = parseInt(colMatch[2]);
        const finalRowSpan = parseInt(rowMatch[2]);

        // Validate final position
        const isValid = Utils.isWithinBounds(finalCol, finalRow, finalColSpan, finalRowSpan, this.editorApp) &&
                        !Utils.checkCollision(finalCol, finalRow, finalColSpan, finalRowSpan, this.resizedWidget.id, this.editorApp);

        if (isValid && (finalCol !== this.startCol || finalRow !== this.startRow ||
                       finalColSpan !== this.startColSpan || finalRowSpan !== this.startRowSpan)) {
          // Update widget config
          this.editorApp.updateWidgetConfig(this.resizedWidget.id, {
            position: {
              col: finalCol,
              row: finalRow,
              colSpan: finalColSpan,
              rowSpan: finalRowSpan
            }
          });

          this.editorApp.showNotification(
            `Resized widget to ${finalColSpan}x${finalRowSpan} at (${finalCol}, ${finalRow})`,
            'success'
          );
        } else if (!isValid) {
          // Revert to original size
          this.resizedElement.style.gridColumn = `${this.startCol} / span ${this.startColSpan}`;
          this.resizedElement.style.gridRow = `${this.startRow} / span ${this.startRowSpan}`;

          this.editorApp.showNotification(
            'Cannot resize widget - position is blocked or out of bounds',
            'error'
          );
        }
      }

      // Clean up
      this.cleanup();
    };

    /**
     * Clean up after resize
     */
    cleanup() {
      // Remove classes
      if (this.resizedElement) {
        this.resizedElement.classList.remove('resizing', 'invalid-resize');
      }
      document.body.classList.remove('is-resizing');

      // Clear highlights
      Utils.clearCellHighlights();

      // Remove global event listeners
      document.removeEventListener('mousemove', this.onResize);
      document.removeEventListener('mouseup', this.onResizeEnd);

      // Reset state
      this.isResizing = false;
      this.resizedWidget = null;
      this.resizedElement = null;
      this.resizeHandle = null;
    }

    /**
     * Remove all resize handles
     */
    removeAll() {
      const handles = document.querySelectorAll('.resize-handles');
      handles.forEach(h => h.remove());
    }
  }

  return ResizeController;
})();
