// ===========================================================================
// Editor Utilities — Helper functions for grid calculations & positioning
// ===========================================================================

window.EditorUtils = (function () {
  'use strict';

  /**
   * Get grid configuration for current dashboard
   */
  function getGridConfig(dashboardAppOrEditor) {
    // Accept either dashboardApp or editorApp
    const dashboardApp = dashboardAppOrEditor.dashboardApp || dashboardAppOrEditor;
    const config = dashboardAppOrEditor.modifiedConfig || dashboardApp.config;
    const currentDash = config.dashboards[dashboardApp.currentPage];
    return currentDash ? currentDash.grid : { columns: 4, rows: 2, gap: 14 };
  }

  /**
   * Get the dashboard page element bounds
   */
  function getPageBounds() {
    const page = document.querySelector('.dashboard-page.active');
    if (!page) return null;
    return page.getBoundingClientRect();
  }

  /**
   * Calculate grid cell size based on page bounds and grid config
   */
  function getCellSize(dashboardAppOrEditor) {
    const bounds = getPageBounds();
    const grid = getGridConfig(dashboardAppOrEditor);
    if (!bounds || !grid) return null;

    const padding = 20; // Dashboard page padding
    const availableWidth = bounds.width - (padding * 2);
    const availableHeight = bounds.height - (padding * 2);

    const cellWidth = (availableWidth - (grid.gap * (grid.columns - 1))) / grid.columns;
    const cellHeight = (availableHeight - (grid.gap * (grid.rows - 1))) / grid.rows;

    return { width: cellWidth, height: cellHeight, gap: grid.gap };
  }

  /**
   * Convert mouse coordinates to grid cell position
   */
  function mouseToGridCell(mouseX, mouseY, dashboardAppOrEditor) {
    const bounds = getPageBounds();
    const cellSize = getCellSize(dashboardAppOrEditor);
    const grid = getGridConfig(dashboardAppOrEditor);
    if (!bounds || !cellSize || !grid) return null;

    const padding = 20;
    const relativeX = mouseX - bounds.left - padding;
    const relativeY = mouseY - bounds.top - padding;

    // Calculate which cell we're in
    let col = 1;
    let row = 1;
    let accumulatedWidth = 0;
    let accumulatedHeight = 0;

    // Find column
    for (let c = 1; c <= grid.columns; c++) {
      if (relativeX < accumulatedWidth + cellSize.width) {
        col = c;
        break;
      }
      accumulatedWidth += cellSize.width + cellSize.gap;
      col = c + 1;
    }

    // Find row
    for (let r = 1; r <= grid.rows; r++) {
      if (relativeY < accumulatedHeight + cellSize.height) {
        row = r;
        break;
      }
      accumulatedHeight += cellSize.height + cellSize.gap;
      row = r + 1;
    }

    // Clamp to grid bounds
    col = Math.max(1, Math.min(col, grid.columns));
    row = Math.max(1, Math.min(row, grid.rows));

    return { col, row };
  }

  /**
   * Get pixel position of a grid cell
   */
  function gridCellToPixels(col, row, dashboardAppOrEditor) {
    const bounds = getPageBounds();
    const cellSize = getCellSize(dashboardAppOrEditor);
    if (!bounds || !cellSize) return null;

    const padding = 20;
    const x = bounds.left + padding + ((col - 1) * (cellSize.width + cellSize.gap));
    const y = bounds.top + padding + ((row - 1) * (cellSize.height + cellSize.gap));

    return { x, y };
  }

  /**
   * Check if a position would cause a collision with existing widgets
   */
  function checkCollision(col, row, colSpan, rowSpan, excludeWidgetId, dashboardAppOrEditor) {
    // Accept either dashboardApp or editorApp
    const dashboardApp = dashboardAppOrEditor.dashboardApp || dashboardAppOrEditor;
    const config = dashboardAppOrEditor.modifiedConfig || dashboardApp.config;
    const currentDash = config.dashboards[dashboardApp.currentPage];
    if (!currentDash) return false;

    // Get all widget positions except the one being moved
    const widgets = currentDash.widgets.filter(w => w.id !== excludeWidgetId);

    for (const widget of widgets) {
      const pos = widget.position;
      const wCol = pos.col;
      const wRow = pos.row;
      const wColSpan = pos.colSpan || 1;
      const wRowSpan = pos.rowSpan || 1;

      // Check if rectangles overlap
      const colOverlap = col < wCol + wColSpan && col + colSpan > wCol;
      const rowOverlap = row < wRow + wRowSpan && row + rowSpan > wRow;

      if (colOverlap && rowOverlap) {
        return true; // Collision detected
      }
    }

    return false; // No collision
  }

  /**
   * Check if position is within grid bounds
   */
  function isWithinBounds(col, row, colSpan, rowSpan, dashboardAppOrEditor) {
    const grid = getGridConfig(dashboardAppOrEditor);
    if (!grid) return false;

    return col >= 1 &&
           row >= 1 &&
           (col + colSpan - 1) <= grid.columns &&
           (row + rowSpan - 1) <= grid.rows;
  }

  /**
   * Find nearest valid position (avoid collisions, stay in bounds)
   */
  function findNearestValidPosition(targetCol, targetRow, colSpan, rowSpan, excludeWidgetId, dashboardAppOrEditor) {
    const grid = getGridConfig(dashboardAppOrEditor);
    if (!grid) return { col: 1, row: 1 };

    // Try the target position first
    if (isWithinBounds(targetCol, targetRow, colSpan, rowSpan, dashboardAppOrEditor) &&
        !checkCollision(targetCol, targetRow, colSpan, rowSpan, excludeWidgetId, dashboardAppOrEditor)) {
      return { col: targetCol, row: targetRow };
    }

    // Search in a spiral pattern for the nearest valid position
    const maxDistance = Math.max(grid.columns, grid.rows);
    for (let distance = 1; distance <= maxDistance; distance++) {
      for (let dCol = -distance; dCol <= distance; dCol++) {
        for (let dRow = -distance; dRow <= distance; dRow++) {
          const col = targetCol + dCol;
          const row = targetRow + dRow;

          if (isWithinBounds(col, row, colSpan, rowSpan, dashboardAppOrEditor) &&
              !checkCollision(col, row, colSpan, rowSpan, excludeWidgetId, dashboardAppOrEditor)) {
            return { col, row };
          }
        }
      }
    }

    // Fallback: return original target (will show as invalid)
    return { col: targetCol, row: targetRow };
  }

  /**
   * Get all widgets in current dashboard
   */
  function getAllWidgets(dashboardAppOrEditor) {
    // Accept either dashboardApp or editorApp
    const dashboardApp = dashboardAppOrEditor.dashboardApp || dashboardAppOrEditor;
    const config = dashboardAppOrEditor.modifiedConfig || dashboardApp.config;
    const currentDash = config.dashboards[dashboardApp.currentPage];
    return currentDash ? currentDash.widgets : [];
  }

  /**
   * Get widget config by ID
   */
  function getWidgetConfig(widgetId, dashboardAppOrEditor) {
    const widgets = getAllWidgets(dashboardAppOrEditor);
    return widgets.find(w => w.id === widgetId);
  }

  /**
   * Get widget element by ID
   */
  function getWidgetElement(widgetId) {
    return document.querySelector(`.widget[data-widget-id="${widgetId}"]`);
  }

  /**
   * Highlight grid cells (for drop zone visualization)
   */
  function highlightCells(col, row, colSpan, rowSpan, isValid) {
    // Remove existing highlights
    document.querySelectorAll('.grid-cell').forEach(cell => {
      cell.classList.remove('highlight-valid', 'highlight-invalid');
    });

    // Add new highlights
    for (let c = col; c < col + colSpan; c++) {
      for (let r = row; r < row + rowSpan; r++) {
        const cell = document.querySelector(`.grid-cell[data-col="${c}"][data-row="${r}"]`);
        if (cell) {
          cell.classList.add(isValid ? 'highlight-valid' : 'highlight-invalid');
        }
      }
    }
  }

  /**
   * Clear cell highlights
   */
  function clearCellHighlights() {
    document.querySelectorAll('.grid-cell').forEach(cell => {
      cell.classList.remove('highlight-valid', 'highlight-invalid');
    });
  }

  /**
   * Clamp a value between min and max
   */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  return {
    getGridConfig,
    getPageBounds,
    getCellSize,
    mouseToGridCell,
    gridCellToPixels,
    checkCollision,
    isWithinBounds,
    findNearestValidPosition,
    getAllWidgets,
    getWidgetConfig,
    getWidgetElement,
    highlightCells,
    clearCellHighlights,
    clamp
  };
})();
