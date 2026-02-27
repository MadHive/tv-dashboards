// ===========================================================================
// Dashboard Editor — WYSIWYG editing for dashboards
// ===========================================================================

window.EditorApp = (function () {
  'use strict';

  class EditorApp {
    constructor(dashboardApp) {
      this.dashboardApp = dashboardApp;
      this.isActive = false;
      this.selectedWidget = null;
      this.selectedWidgetElement = null;
      this.propertyPanel = null;
      this.gridOverlay = null;
      this.modifiedConfig = null; // Track unsaved changes
      this.dragController = null;
      this.resizeController = null;

      this.init();
    }

    init() {
      // Create grid overlay (hidden by default)
      this.createGridOverlay();

      // Set up keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        // Ctrl+E or Cmd+E to toggle editor
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
          e.preventDefault();
          this.toggle();
        }

        // Escape to deselect widget
        if (e.key === 'Escape' && this.isActive) {
          this.deselectWidget();
        }
      });

      // Prevent page unload with unsaved changes
      window.addEventListener('beforeunload', (e) => {
        if (this.hasUnsavedChanges()) {
          e.preventDefault();
          e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
          return e.returnValue;
        }
      });
    }

    createGridOverlay() {
      this.gridOverlay = document.createElement('div');
      this.gridOverlay.className = 'editor-grid-overlay';
      this.gridOverlay.style.display = 'none';
      document.body.appendChild(this.gridOverlay);
    }

    toggle() {
      if (this.isActive) {
        this.exit();
      } else {
        this.enter();
      }
    }

    enter() {
      console.log('[Editor] Entering edit mode');
      this.isActive = true;

      // Debug: Check if widgets exist
      const activePage = document.querySelector('.dashboard-page.active');
      const widgets = activePage ? activePage.querySelectorAll('.widget') : [];
      console.log('[Editor] Active page:', activePage);
      console.log('[Editor] Widgets found:', widgets.length);

      // Add editor-active class to body
      document.body.classList.add('editor-active');

      // Stop dashboard rotation and auto-refresh
      if (this.dashboardApp.rotationTimer) {
        clearInterval(this.dashboardApp.rotationTimer);
        this.dashboardApp.rotationTimer = null;
      }
      if (this.dashboardApp.refreshTimer) {
        clearInterval(this.dashboardApp.refreshTimer);
        this.dashboardApp.refreshTimer = null;
      }

      // Clone current config for modification tracking (MUST BE FIRST!)
      this.modifiedConfig = JSON.parse(JSON.stringify(this.dashboardApp.config));
      console.log('[Editor] Modified config created, current page:', this.dashboardApp.currentPage);
      console.log('[Editor] Widgets in modified config:', this.modifiedConfig.dashboards[this.dashboardApp.currentPage]?.widgets?.length || 0);

      // Show grid overlay
      this.updateGridOverlay();
      this.gridOverlay.style.display = 'block';

      // Make widgets selectable (requires modifiedConfig to exist)
      this.attachWidgetHandlers();

      // Initialize property panel (lazy load)
      if (!this.propertyPanel && window.PropertyPanel) {
        this.propertyPanel = new window.PropertyPanel(this);
      }

      // Initialize drag and resize controllers
      if (!this.dragController && window.WidgetDragController) {
        this.dragController = new window.WidgetDragController(this);
      }
      if (!this.resizeController && window.ResizeController) {
        this.resizeController = new window.ResizeController(this);
      }

      // Initialize widget palette
      if (!this.palette && window.WidgetPalette) {
        this.palette = new window.WidgetPalette(this);
      }
      console.log('[Editor] Modified config created, current page:', this.dashboardApp.currentPage);
      console.log('[Editor] Widgets in modified config:', this.modifiedConfig.dashboards[this.dashboardApp.currentPage]?.widgets?.length || 0);

      // Show editor toggle button as "active"
      const toggleBtn = document.getElementById('editor-toggle');
      if (toggleBtn) toggleBtn.classList.add('active');

      // Show notification
      this.showNotification('Edit mode enabled. Press Ctrl+E to exit.');

      // Dispatch event
      document.dispatchEvent(new CustomEvent('editorStateChanged', { detail: { isActive: true } }));
    }

    exit() {
      console.log('[Editor] Exiting edit mode');

      // Check for unsaved changes
      if (this.hasUnsavedChanges()) {
        const confirmExit = confirm('You have unsaved changes. Discard changes and exit?');
        if (!confirmExit) return;
      }

      this.isActive = false;

      // Remove editor-active class
      document.body.classList.remove('editor-active');

      // Hide grid overlay
      this.gridOverlay.style.display = 'none';

      // Deselect widget
      this.deselectWidget();

      // Remove widget handlers
      this.detachWidgetHandlers();

      // Resume dashboard rotation and refresh
      this.dashboardApp.startRotation();
      this.dashboardApp.startRefresh();

      // Hide property panel
      if (this.propertyPanel) {
        this.propertyPanel.hide();
      }

      // Discard modified config
      this.modifiedConfig = null;

      // Update toggle button
      const toggleBtn = document.getElementById('editor-toggle');
      if (toggleBtn) toggleBtn.classList.remove('active');

      // Show notification
      this.showNotification('Edit mode disabled. Dashboard resumed.');

      // Dispatch event
      document.dispatchEvent(new CustomEvent('editorStateChanged', { detail: { isActive: false } }));
    }

    updateGridOverlay() {
      const currentDash = this.dashboardApp.config.dashboards[this.dashboardApp.currentPage];
      if (!currentDash) return;

      const { columns, rows, gap } = currentDash.grid;

      // Clear existing overlay content
      this.gridOverlay.innerHTML = '';

      // Create grid cells with labels
      for (let row = 1; row <= rows; row++) {
        for (let col = 1; col <= columns; col++) {
          const cell = document.createElement('div');
          cell.className = 'grid-cell';
          cell.dataset.col = col;
          cell.dataset.row = row;
          cell.textContent = `${col},${row}`;
          this.gridOverlay.appendChild(cell);
        }
      }

      // Apply grid layout matching dashboard
      this.gridOverlay.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
      this.gridOverlay.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
      this.gridOverlay.style.gap = `${gap || 12}px`;
      this.gridOverlay.style.padding = '20px';
    }

    attachWidgetHandlers() {
      const activePage = document.querySelector('.dashboard-page.active');
      if (!activePage) {
        console.log('[Editor] No active page found in attachWidgetHandlers');
        return;
      }

      const widgets = activePage.querySelectorAll('.widget');
      console.log('[Editor] attachWidgetHandlers - Found', widgets.length, 'widgets');
      widgets.forEach(widget => {
        widget.classList.add('editable');
        widget.style.cursor = 'move';

        const widgetId = widget.dataset.widgetId;
        const widgetConfig = this.modifiedConfig.dashboards[this.dashboardApp.currentPage].widgets.find(w => w.id === widgetId);

        if (widgetConfig && this.dragController) {
          // Attach drag handlers
          this.dragController.attachDragHandlers(widget, widgetConfig);
        }

        // Click to select
        widget.addEventListener('click', (e) => {
          // Don't select if we're in the middle of dragging/resizing
          if (document.body.classList.contains('is-dragging') ||
              document.body.classList.contains('is-resizing')) {
            return;
          }
          e.stopPropagation();
          this.selectWidget(widget);
        });
      });

      // Click outside to deselect
      document.addEventListener('click', (e) => {
        if (this.isActive && !e.target.closest('.widget') &&
            !e.target.closest('.property-panel') &&
            !e.target.closest('.resize-handle')) {
          this.deselectWidget();
        }
      });
    }

    detachWidgetHandlers() {
      const activePage = document.querySelector('.dashboard-page.active');
      if (!activePage) return;

      const widgets = activePage.querySelectorAll('.widget');
      widgets.forEach(widget => {
        widget.classList.remove('editable', 'selected');
        widget.style.cursor = '';

        // Remove event listeners by cloning (simple approach)
        const newWidget = widget.cloneNode(true);
        widget.parentNode.replaceChild(newWidget, widget);
      });
    }

    selectWidget(widgetElement) {
      // Deselect previous
      if (this.selectedWidgetElement) {
        this.selectedWidgetElement.classList.remove('selected');
        // Remove resize handles from previous widget
        if (this.resizeController) {
          this.resizeController.removeHandles(this.selectedWidgetElement);
        }
      }

      // Select new widget
      this.selectedWidgetElement = widgetElement;
      widgetElement.classList.add('selected');

      // Find widget config
      const widgetId = this.getWidgetIdFromElement(widgetElement);
      const currentDash = this.modifiedConfig.dashboards[this.dashboardApp.currentPage];
      this.selectedWidget = currentDash.widgets.find(w => w.id === widgetId);

      console.log('[Editor] Selected widget:', widgetId, this.selectedWidget);

      // Attach resize handles
      if (this.resizeController && this.selectedWidget) {
        this.resizeController.attachHandles(widgetElement, this.selectedWidget);
      }

      // Show property panel
      if (this.propertyPanel && this.selectedWidget) {
        this.propertyPanel.show(this.selectedWidget, widgetElement);
      }
    }

    deselectWidget() {
      if (this.selectedWidgetElement) {
        this.selectedWidgetElement.classList.remove('selected');
        // Remove resize handles
        if (this.resizeController) {
          this.resizeController.removeHandles(this.selectedWidgetElement);
        }
        this.selectedWidgetElement = null;
      }
      this.selectedWidget = null;

      // Hide property panel
      if (this.propertyPanel) {
        this.propertyPanel.hide();
      }
    }

    getWidgetIdFromElement(element) {
      // Extract widget ID from element's data attribute
      return element.dataset.widgetId || null;
    }

    updateWidgetConfig(widgetId, updates) {
      const currentDash = this.modifiedConfig.dashboards[this.dashboardApp.currentPage];
      const widget = currentDash.widgets.find(w => w.id === widgetId);

      if (widget) {
        Object.assign(widget, updates);
        console.log('[Editor] Updated widget config:', widgetId, updates);

        // Mark as modified
        this.markAsModified();

        // TODO: Apply changes to DOM for live preview
        this.applyWidgetChanges(widgetId, updates);
      }
    }

    applyWidgetChanges(widgetId, updates) {
      // Find the widget element by ID (not just selectedWidgetElement)
      const widgetElement = document.querySelector(`[data-widget-id="${widgetId}"]`);
      if (!widgetElement) return;

      // Apply changes to the DOM for live preview
      if (updates.title) {
        const titleEl = widgetElement.querySelector('.widget-title');
        if (titleEl) titleEl.textContent = updates.title;
      }

      // Position changes require grid updates
      if (updates.position) {
        this.updateWidgetPosition(widgetElement, updates.position);
      }
    }

    updateWidgetPosition(element, position) {
      const { col, row, colSpan, rowSpan } = position;
      element.style.gridColumn = `${col} / span ${colSpan || 1}`;
      element.style.gridRow = `${row} / span ${rowSpan || 1}`;
    }

    deleteWidget(widgetId) {
      console.log('[Editor] Deleting widget:', widgetId);

      const currentDash = this.modifiedConfig.dashboards[this.dashboardApp.currentPage];
      const widgetIndex = currentDash.widgets.findIndex(w => w.id === widgetId);

      if (widgetIndex === -1) {
        console.error('[Editor] Widget not found:', widgetId);
        return;
      }

      // Remove from config
      currentDash.widgets.splice(widgetIndex, 1);

      // Mark as modified
      this.markAsModified();

      // Remove from DOM
      const widgetElement = document.querySelector(`[data-widget-id="${widgetId}"]`);
      if (widgetElement) {
        widgetElement.remove();
      }

      // Deselect
      this.deselectWidget();

      this.showNotification('Widget deleted', 'success');
    }

    async saveChanges() {
      console.log('[Editor] Saving changes...');

      try {
        const currentDash = this.modifiedConfig.dashboards[this.dashboardApp.currentPage];

        // Send updated dashboard to server
        const response = await fetch(`/api/dashboards/${currentDash.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentDash)
        });

        if (!response.ok) {
          throw new Error(`Failed to save: ${response.statusText}`);
        }

        // Update main config
        this.dashboardApp.config = JSON.parse(JSON.stringify(this.modifiedConfig));

        // Clear modified flag
        this.modifiedConfig = JSON.parse(JSON.stringify(this.dashboardApp.config));

        this.showNotification('Changes saved successfully!', 'success');

        return true;
      } catch (error) {
        console.error('[Editor] Save failed:', error);
        this.showNotification('Failed to save changes: ' + error.message, 'error');
        return false;
      }
    }

    discardChanges() {
      if (!this.hasUnsavedChanges()) {
        this.showNotification('No changes to discard', 'info');
        return;
      }

      const confirmDiscard = confirm('Discard all unsaved changes?');
      if (!confirmDiscard) return;

      // Reset modified config
      this.modifiedConfig = JSON.parse(JSON.stringify(this.dashboardApp.config));

      // Deselect widget
      this.deselectWidget();

      // Reload current page
      this.dashboardApp.showPage(this.dashboardApp.currentPage);

      // Re-attach handlers
      this.attachWidgetHandlers();

      this.showNotification('Changes discarded', 'info');
    }

    hasUnsavedChanges() {
      if (!this.modifiedConfig) return false;

      // Compare modified config with original
      return JSON.stringify(this.modifiedConfig) !== JSON.stringify(this.dashboardApp.config);
    }

    markAsModified() {
      // Update UI to show unsaved changes indicator
      const saveBtn = document.getElementById('editor-save');
      if (saveBtn) saveBtn.classList.add('has-changes');
    }

    showNotification(message, type = 'info') {
      // Simple notification system
      const notification = document.createElement('div');
      notification.className = `editor-notification ${type}`;
      notification.textContent = message;
      document.body.appendChild(notification);

      // Auto-remove after 3 seconds
      setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }
  }

  return EditorApp;
})();
