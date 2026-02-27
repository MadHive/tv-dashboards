// ===========================================================================
// Property Panel — Widget configuration UI
// ===========================================================================

window.PropertyPanel = (function () {
  'use strict';

  const WIDGET_TYPES = [
    'big-number',
    'stat-card',
    'gauge',
    'gauge-row',
    'bar-chart',
    'progress-bar',
    'status-grid',
    'alert-list',
    'service-heatmap',
    'pipeline-flow',
    'usa-map',
    'security-scorecard'
  ];

  const DATA_SOURCES = [
    'gcp',
    'bigquery',
    'aws',
    'datadog',
    'elasticsearch',
    'salesforce',
    'hotjar',
    'fullstory',
    'zendesk',
    'vulntrack',
    'mock'
  ];

  class PropertyPanel {
    constructor(editorApp) {
      this.editorApp = editorApp;
      this.currentWidget = null;
      this.currentElement = null;
      this.panel = null;

      this.createPanel();
    }

    createPanel() {
      // Create panel container
      this.panel = document.createElement('div');
      this.panel.className = 'property-panel';
      this.panel.style.display = 'none';
      this.panel.innerHTML = `
        <div class="property-panel-header">
          <h3>Widget Properties</h3>
          <button class="panel-close" title="Close (Esc)">&times;</button>
        </div>
        <div class="property-panel-content">
          <form id="widget-property-form">
            <!-- Basic Properties -->
            <div class="form-section">
              <h4>Basic</h4>

              <div class="form-group">
                <label for="prop-id">Widget ID</label>
                <input type="text" id="prop-id" readonly disabled>
              </div>

              <div class="form-group">
                <label for="prop-type">Type</label>
                <select id="prop-type">
                  ${WIDGET_TYPES.map(type => `<option value="${type}">${type}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label for="prop-title">Title</label>
                <input type="text" id="prop-title" placeholder="Widget Title">
              </div>
            </div>

            <!-- Data Source -->
            <div class="form-section">
              <h4>Data Source</h4>

              <div class="form-group">
                <label for="prop-source">Source</label>
                <select id="prop-source">
                  ${DATA_SOURCES.map(src => `<option value="${src}">${src.toUpperCase()}</option>`).join('')}
                </select>
              </div>

              <div class="form-group" id="prop-query-group" style="display: none;">
                <label for="prop-query">Saved Query</label>
                <select id="prop-query">
                  <option value="">-- None (use default metrics) --</option>
                </select>
                <button type="button" class="btn-link" id="btn-open-query-editor">
                  + Create New Query
                </button>
                <small class="help-text">Select a saved query to use as data source</small>
              </div>

              <div class="form-group" id="prop-project-group">
                <label for="prop-project">Project</label>
                <input type="text" id="prop-project" placeholder="e.g., mad-master">
              </div>
            </div>

            <!-- Position & Size -->
            <div class="form-section">
              <h4>Position & Size</h4>

              <div class="form-row">
                <div class="form-group">
                  <label for="prop-col">Column</label>
                  <input type="number" id="prop-col" min="1" value="1">
                </div>
                <div class="form-group">
                  <label for="prop-row">Row</label>
                  <input type="number" id="prop-row" min="1" value="1">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="prop-colspan">Column Span</label>
                  <input type="number" id="prop-colspan" min="1" value="1">
                </div>
                <div class="form-group">
                  <label for="prop-rowspan">Row Span</label>
                  <input type="number" id="prop-rowspan" min="1" value="1">
                </div>
              </div>
            </div>

            <!-- Type-Specific Options -->
            <div class="form-section" id="type-specific-options">
              <h4>Options</h4>

              <div class="form-group" id="prop-unit-group">
                <label for="prop-unit">Unit</label>
                <input type="text" id="prop-unit" placeholder="e.g., %, /s, ms">
              </div>

              <div class="form-group" id="prop-sparkline-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="prop-sparkline">
                  Show Sparkline
                </label>
              </div>

              <div class="form-row" id="prop-minmax-group">
                <div class="form-group">
                  <label for="prop-min">Min</label>
                  <input type="number" id="prop-min" placeholder="0">
                </div>
                <div class="form-group">
                  <label for="prop-max">Max</label>
                  <input type="number" id="prop-max" placeholder="100">
                </div>
              </div>
            </div>
          </form>
        </div>

        <div class="property-panel-footer">
          <button id="prop-delete" class="btn btn-danger" style="margin-right: auto;">Delete Widget</button>
          <button id="prop-save" class="btn btn-primary">Save Changes</button>
          <button id="prop-cancel" class="btn btn-secondary">Cancel</button>
        </div>
      `;

      document.body.appendChild(this.panel);

      // Attach event listeners
      this.attachEventListeners();
    }

    attachEventListeners() {
      // Close button
      this.panel.querySelector('.panel-close').addEventListener('click', () => {
        this.hide();
      });

      // Save button
      document.getElementById('prop-save').addEventListener('click', (e) => {
        e.preventDefault();
        this.saveChanges();
      });

      // Cancel button
      document.getElementById('prop-cancel').addEventListener('click', (e) => {
        e.preventDefault();
        this.cancel();
      });

      // Delete button
      document.getElementById('prop-delete').addEventListener('click', (e) => {
        e.preventDefault();
        this.deleteWidget();
      });

      // Type change - update visible options
      document.getElementById('prop-type').addEventListener('change', (e) => {
        this.updateTypeSpecificOptions(e.target.value);
      });

      // Source change - show/hide project field and load queries
      document.getElementById('prop-source').addEventListener('change', async (e) => {
        const source = e.target.value;
        const projectGroup = document.getElementById('prop-project-group');
        const queryGroup = document.getElementById('prop-query-group');

        // Only GCP needs project field
        projectGroup.style.display = source === 'gcp' ? 'block' : 'none';

        // Show query selector for sources that support queries
        if (source === 'bigquery' || source === 'gcp') {
          queryGroup.style.display = 'block';
          await this.loadQueriesForSource(source);
        } else {
          queryGroup.style.display = 'none';
        }
      });

      // Open query editor button
      document.getElementById('btn-open-query-editor').addEventListener('click', () => {
        if (window.queryEditor) {
          window.queryEditor.open();
        }
      });

      // Live preview on input
      const inputs = this.panel.querySelectorAll('input, select');
      inputs.forEach(input => {
        input.addEventListener('input', () => {
          this.updateLivePreview();
        });
      });
    }

    async loadQueriesForSource(source) {
      const querySelect = document.getElementById('prop-query');

      try {
        const response = await fetch(`/api/queries/${source}`);
        const data = await response.json();

        // Clear existing options
        querySelect.innerHTML = '<option value="">-- None (use default metrics) --</option>';

        // Populate with queries
        if (data.success && data.queries) {
          data.queries.forEach(q => {
            const option = document.createElement('option');
            option.value = q.id;
            option.textContent = `${q.name}${q.description ? ' — ' + q.description : ''}`;
            querySelect.appendChild(option);
          });
        }
      } catch (error) {
        console.error('[PropertyPanel] Failed to load queries:', error);
      }
    }

    async show(widgetConfig, widgetElement) {
      this.currentWidget = widgetConfig;
      this.currentElement = widgetElement;

      // Populate form with widget config
      await this.populateForm(widgetConfig);

      // Show panel
      this.panel.style.display = 'flex';

      // Update type-specific options
      this.updateTypeSpecificOptions(widgetConfig.type);
    }

    hide() {
      this.panel.style.display = 'none';
      this.currentWidget = null;
      this.currentElement = null;
    }

    async populateForm(config) {
      document.getElementById('prop-id').value = config.id || '';
      document.getElementById('prop-type').value = config.type || 'big-number';
      document.getElementById('prop-title').value = config.title || '';
      document.getElementById('prop-source').value = config.source || 'gcp';
      document.getElementById('prop-project').value = config.project || '';

      // Load queries for this source if applicable
      const source = config.source || 'gcp';
      const queryGroup = document.getElementById('prop-query-group');
      const querySelect = document.getElementById('prop-query');

      if (source === 'bigquery' || source === 'gcp') {
        queryGroup.style.display = 'block';
        await this.loadQueriesForSource(source);

        // Set selected query if one exists
        if (config.queryId) {
          querySelect.value = config.queryId;
        }
      } else {
        queryGroup.style.display = 'none';
      }

      // Position
      const pos = config.position || {};
      document.getElementById('prop-col').value = pos.col || 1;
      document.getElementById('prop-row').value = pos.row || 1;
      document.getElementById('prop-colspan').value = pos.colSpan || 1;
      document.getElementById('prop-rowspan').value = pos.rowSpan || 1;

      // Options
      document.getElementById('prop-unit').value = config.unit || '';
      document.getElementById('prop-sparkline').checked = config.sparkline || false;
      document.getElementById('prop-min').value = config.min !== undefined ? config.min : '';
      document.getElementById('prop-max').value = config.max !== undefined ? config.max : '';

      // Show/hide project field
      const projectGroup = document.getElementById('prop-project-group');
      projectGroup.style.display = config.source === 'gcp' ? 'block' : 'none';
    }

    updateTypeSpecificOptions(type) {
      // Show/hide options based on widget type
      const unitGroup = document.getElementById('prop-unit-group');
      const sparklineGroup = document.getElementById('prop-sparkline-group');
      const minmaxGroup = document.getElementById('prop-minmax-group');

      // Default: hide all
      unitGroup.style.display = 'none';
      sparklineGroup.style.display = 'none';
      minmaxGroup.style.display = 'none';

      // Show relevant options per type
      switch (type) {
        case 'big-number':
          unitGroup.style.display = 'block';
          sparklineGroup.style.display = 'block';
          break;
        case 'stat-card':
          unitGroup.style.display = 'block';
          break;
        case 'gauge':
        case 'gauge-row':
          unitGroup.style.display = 'block';
          minmaxGroup.style.display = 'flex';
          break;
        case 'progress-bar':
          unitGroup.style.display = 'block';
          break;
      }
    }

    getFormValues() {
      const type = document.getElementById('prop-type').value;
      const source = document.getElementById('prop-source').value;
      const queryId = document.getElementById('prop-query').value;

      const values = {
        type,
        title: document.getElementById('prop-title').value,
        source,
        position: {
          col: parseInt(document.getElementById('prop-col').value),
          row: parseInt(document.getElementById('prop-row').value),
          colSpan: parseInt(document.getElementById('prop-colspan').value),
          rowSpan: parseInt(document.getElementById('prop-rowspan').value)
        }
      };

      // Add query ID if selected
      if (queryId) {
        values.queryId = queryId;
      }

      // Add project if GCP
      if (source === 'gcp') {
        values.project = document.getElementById('prop-project').value;
      }

      // Add optional fields if set
      const unit = document.getElementById('prop-unit').value;
      if (unit) values.unit = unit;

      const sparkline = document.getElementById('prop-sparkline').checked;
      if (sparkline) values.sparkline = true;

      const min = document.getElementById('prop-min').value;
      if (min !== '') values.min = parseFloat(min);

      const max = document.getElementById('prop-max').value;
      if (max !== '') values.max = parseFloat(max);

      return values;
    }

    updateLivePreview() {
      if (!this.currentWidget || !this.currentElement) return;

      const values = this.getFormValues();

      // Update title immediately
      if (values.title !== this.currentWidget.title) {
        const titleEl = this.currentElement.querySelector('.widget-title');
        if (titleEl) titleEl.textContent = values.title;
      }

      // Update position
      const pos = values.position;
      if (pos.col !== this.currentWidget.position.col ||
          pos.row !== this.currentWidget.position.row ||
          pos.colSpan !== (this.currentWidget.position.colSpan || 1) ||
          pos.rowSpan !== (this.currentWidget.position.rowSpan || 1)) {
        this.currentElement.style.gridColumn = `${pos.col} / span ${pos.colSpan}`;
        this.currentElement.style.gridRow = `${pos.row} / span ${pos.rowSpan}`;
      }
    }

    saveChanges() {
      if (!this.currentWidget) return;

      const values = this.getFormValues();

      // Validate
      if (!values.title || values.title.trim() === '') {
        alert('Widget title is required');
        return;
      }

      if (values.position.col < 1 || values.position.row < 1) {
        alert('Position must be at least (1, 1)');
        return;
      }

      // Update widget config via EditorApp
      this.editorApp.updateWidgetConfig(this.currentWidget.id, values);

      // Update current widget reference
      Object.assign(this.currentWidget, values);

      // Show success message
      this.editorApp.showNotification('Widget updated', 'success');
    }

    cancel() {
      if (!this.currentWidget) {
        this.hide();
        return;
      }

      // Revert any live preview changes
      const titleEl = this.currentElement.querySelector('.widget-title');
      if (titleEl) titleEl.textContent = this.currentWidget.title;

      const pos = this.currentWidget.position;
      this.currentElement.style.gridColumn = `${pos.col} / span ${pos.colSpan || 1}`;
      this.currentElement.style.gridRow = `${pos.row} / span ${pos.rowSpan || 1}`;

      this.hide();
    }

    deleteWidget() {
      if (!this.currentWidget) return;

      const confirmDelete = confirm(`Delete widget "${this.currentWidget.title || this.currentWidget.id}"?`);
      if (!confirmDelete) return;

      console.log('[PropertyPanel] Deleting widget:', this.currentWidget.id);

      // Call editor to delete the widget
      this.editorApp.deleteWidget(this.currentWidget.id);

      // Hide panel
      this.hide();
    }
  }

  return PropertyPanel;
})();
