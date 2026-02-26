// ===========================================================================
// Query Editor — BigQuery SQL query builder and manager
// ===========================================================================

window.QueryEditor = (function () {
  'use strict';

  class QueryEditor {
    constructor() {
      this.modal = null;
      this.currentQuery = null;
      this.savedQueries = [];
      this.datasets = [];
      this.tables = [];

      this.createModal();
      this.loadSavedQueries();
    }

    createModal() {
      this.modal = document.createElement('div');
      this.modal.className = 'query-editor-modal';
      this.modal.style.display = 'none';
      this.modal.innerHTML = `
        <div class="query-editor-overlay" onclick="window.queryEditor.close()"></div>
        <div class="query-editor-container">
          <div class="query-editor-header">
            <h2>BigQuery Editor</h2>
            <button class="query-editor-close" onclick="window.queryEditor.close()">&times;</button>
          </div>

          <div class="query-editor-body">
            <!-- Left Panel: Saved Queries -->
            <div class="query-editor-sidebar">
              <div class="query-editor-section">
                <h3>Saved Queries</h3>
                <button class="btn btn-sm btn-primary" onclick="window.queryEditor.newQuery()">+ New Query</button>
              </div>
              <div id="saved-queries-list" class="query-list"></div>
            </div>

            <!-- Middle Panel: Query Editor -->
            <div class="query-editor-main">
              <div class="query-editor-tabs">
                <button class="query-tab active" data-tab="editor">Editor</button>
                <button class="query-tab" data-tab="schema">Schema Browser</button>
                <button class="query-tab" data-tab="results">Results</button>
              </div>

              <!-- Editor Tab -->
              <div class="query-editor-tab-content active" data-tab-content="editor">
                <div class="query-form">
                  <div class="form-group">
                    <label for="query-id">Query ID</label>
                    <input type="text" id="query-id" placeholder="my-query-id" required>
                  </div>

                  <div class="form-group">
                    <label for="query-name">Query Name</label>
                    <input type="text" id="query-name" placeholder="My Query" required>
                  </div>

                  <div class="form-group">
                    <label for="query-description">Description</label>
                    <textarea id="query-description" rows="2" placeholder="What does this query do?"></textarea>
                  </div>

                  <div class="form-group">
                    <label for="query-sql">SQL Query</label>
                    <textarea id="query-sql" rows="12" placeholder="SELECT * FROM \\`project.dataset.table\\` LIMIT 100" spellcheck="false"></textarea>
                  </div>

                  <div class="form-group">
                    <label for="query-widget-types">Widget Types</label>
                    <select id="query-widget-types" multiple>
                      <option value="big-number">Big Number</option>
                      <option value="stat-card">Stat Card</option>
                      <option value="gauge">Gauge</option>
                      <option value="bar-chart">Bar Chart</option>
                      <option value="line-chart">Line Chart</option>
                    </select>
                    <small>Hold Ctrl/Cmd to select multiple</small>
                  </div>

                  <div class="query-actions">
                    <button class="btn btn-secondary" onclick="window.queryEditor.validateQuery()">Validate</button>
                    <button class="btn btn-primary" onclick="window.queryEditor.runQuery()">Run Query</button>
                    <button class="btn btn-success" onclick="window.queryEditor.saveQuery()">Save Query</button>
                  </div>

                  <div id="query-validation-result"></div>
                </div>
              </div>

              <!-- Schema Browser Tab -->
              <div class="query-editor-tab-content" data-tab-content="schema">
                <div class="schema-browser">
                  <div class="form-group">
                    <label>Datasets</label>
                    <select id="schema-datasets" onchange="window.queryEditor.loadTables(this.value)">
                      <option value="">Select a dataset...</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label>Tables</label>
                    <select id="schema-tables" onchange="window.queryEditor.loadTableSchema(this.value)">
                      <option value="">Select a table...</option>
                    </select>
                  </div>

                  <div id="table-schema-display"></div>
                </div>
              </div>

              <!-- Results Tab -->
              <div class="query-editor-tab-content" data-tab-content="results">
                <div id="query-results"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(this.modal);

      // Tab switching
      this.modal.querySelectorAll('.query-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          const tabName = e.target.dataset.tab;
          this.switchTab(tabName);
        });
      });
    }

    async loadSavedQueries() {
      try {
        const response = await fetch('/api/bigquery/queries');
        const data = await response.json();
        if (data.success) {
          this.savedQueries = data.queries;
          this.renderSavedQueries();
        }
      } catch (error) {
        console.error('[QueryEditor] Failed to load saved queries:', error);
      }
    }

    renderSavedQueries() {
      const container = document.getElementById('saved-queries-list');
      if (!container) return;

      if (this.savedQueries.length === 0) {
        container.innerHTML = '<p class="text-muted">No saved queries</p>';
        return;
      }

      container.innerHTML = this.savedQueries.map(q => `
        <div class="query-list-item" onclick="window.queryEditor.loadQuery('${q.id}')">
          <div class="query-list-name">${q.name}</div>
          <div class="query-list-desc">${q.description || ''}</div>
          <div class="query-list-actions">
            <button class="btn-icon" onclick="event.stopPropagation(); window.queryEditor.deleteQuery('${q.id}')" title="Delete">
              🗑️
            </button>
          </div>
        </div>
      `).join('');
    }

    async loadDatasets() {
      try {
        const response = await fetch('/api/bigquery/datasets');
        const data = await response.json();
        if (data.success) {
          this.datasets = data.datasets;
          const select = document.getElementById('schema-datasets');
          select.innerHTML = '<option value="">Select a dataset...</option>' +
            this.datasets.map(ds => `<option value="${ds.id}">${ds.name || ds.id}</option>`).join('');
        }
      } catch (error) {
        console.error('[QueryEditor] Failed to load datasets:', error);
      }
    }

    async loadTables(datasetId) {
      if (!datasetId) {
        document.getElementById('schema-tables').innerHTML = '<option value="">Select a table...</option>';
        return;
      }

      try {
        const response = await fetch(`/api/bigquery/datasets/${datasetId}/tables`);
        const data = await response.json();
        if (data.success) {
          this.tables = data.tables;
          const select = document.getElementById('schema-tables');
          select.innerHTML = '<option value="">Select a table...</option>' +
            this.tables.map(t => `<option value="${t.id}">${t.name || t.id} (${t.numRows} rows)</option>`).join('');
        }
      } catch (error) {
        console.error('[QueryEditor] Failed to load tables:', error);
      }
    }

    async loadTableSchema(tableId) {
      if (!tableId) {
        document.getElementById('table-schema-display').innerHTML = '';
        return;
      }

      const datasetId = document.getElementById('schema-datasets').value;
      if (!datasetId) return;

      try {
        const response = await fetch(`/api/bigquery/datasets/${datasetId}/tables/${tableId}/schema`);
        const data = await response.json();
        if (data.success && data.schema) {
          this.displayTableSchema(data.schema);
        }
      } catch (error) {
        console.error('[QueryEditor] Failed to load table schema:', error);
      }
    }

    displayTableSchema(schema) {
      const container = document.getElementById('table-schema-display');
      container.innerHTML = `
        <h4>Schema</h4>
        <table class="schema-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Mode</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${schema.fields.map(f => `
              <tr>
                <td><code>${f.name}</code></td>
                <td>${f.type}</td>
                <td>${f.mode}</td>
                <td>${f.description || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="schema-stats">
          <p><strong>Rows:</strong> ${schema.numRows}</p>
          <p><strong>Size:</strong> ${this.formatBytes(schema.numBytes)}</p>
        </div>
      `;
    }

    formatBytes(bytes) {
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      if (bytes === 0) return '0 Bytes';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    switchTab(tabName) {
      // Update tab buttons
      this.modal.querySelectorAll('.query-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
      });

      // Update tab content
      this.modal.querySelectorAll('.query-editor-tab-content').forEach(content => {
        content.classList.toggle('active', content.dataset.tabContent === tabName);
      });

      // Load data for specific tabs
      if (tabName === 'schema' && this.datasets.length === 0) {
        this.loadDatasets();
      }
    }

    open(queryId = null) {
      this.modal.style.display = 'flex';

      if (queryId) {
        this.loadQuery(queryId);
      } else {
        this.newQuery();
      }
    }

    close() {
      this.modal.style.display = 'none';
      this.currentQuery = null;
      this.clearForm();
    }

    newQuery() {
      this.clearForm();
      this.currentQuery = null;
      this.switchTab('editor');
    }

    loadQuery(queryId) {
      const query = this.savedQueries.find(q => q.id === queryId);
      if (!query) return;

      this.currentQuery = query;
      document.getElementById('query-id').value = query.id;
      document.getElementById('query-name').value = query.name;
      document.getElementById('query-description').value = query.description || '';
      document.getElementById('query-sql').value = query.sql;

      // Set selected widget types
      const select = document.getElementById('query-widget-types');
      Array.from(select.options).forEach(option => {
        option.selected = query.widgetTypes && query.widgetTypes.includes(option.value);
      });

      this.switchTab('editor');
    }

    clearForm() {
      document.getElementById('query-id').value = '';
      document.getElementById('query-name').value = '';
      document.getElementById('query-description').value = '';
      document.getElementById('query-sql').value = '';
      document.getElementById('query-validation-result').innerHTML = '';
      document.getElementById('query-results').innerHTML = '';

      const select = document.getElementById('query-widget-types');
      Array.from(select.options).forEach(option => option.selected = false);
    }

    async validateQuery() {
      const sql = document.getElementById('query-sql').value.trim();
      if (!sql) {
        alert('Please enter a SQL query');
        return;
      }

      const resultDiv = document.getElementById('query-validation-result');
      resultDiv.innerHTML = '<div class="loading">Validating...</div>';

      try {
        const response = await fetch('/api/bigquery/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql })
        });

        const data = await response.json();

        if (data.success && data.valid) {
          resultDiv.innerHTML = `
            <div class="validation-success">
              ✓ Query is valid
              <div class="validation-details">
                <p>Bytes to process: ${this.formatBytes(data.bytesProcessed)}</p>
                <p>Estimated cost: $${data.estimatedCost}</p>
              </div>
            </div>
          `;
        } else {
          resultDiv.innerHTML = `
            <div class="validation-error">
              ✗ Query error: ${data.error}
            </div>
          `;
        }
      } catch (error) {
        resultDiv.innerHTML = `
          <div class="validation-error">
            ✗ Validation failed: ${error.message}
          </div>
        `;
      }
    }

    async runQuery() {
      const sql = document.getElementById('query-sql').value.trim();
      if (!sql) {
        alert('Please enter a SQL query');
        return;
      }

      this.switchTab('results');
      const resultsDiv = document.getElementById('query-results');
      resultsDiv.innerHTML = '<div class="loading">Executing query...</div>';

      try {
        const response = await fetch('/api/bigquery/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql })
        });

        const data = await response.json();

        if (data.success) {
          this.displayResults(data.rows);
        } else {
          resultsDiv.innerHTML = `<div class="error">Error: ${data.error}</div>`;
        }
      } catch (error) {
        resultsDiv.innerHTML = `<div class="error">Query failed: ${error.message}</div>`;
      }
    }

    displayResults(rows) {
      const resultsDiv = document.getElementById('query-results');

      if (!rows || rows.length === 0) {
        resultsDiv.innerHTML = '<p>No results</p>';
        return;
      }

      const columns = Object.keys(rows[0]);
      resultsDiv.innerHTML = `
        <div class="results-header">
          <p><strong>${rows.length}</strong> rows returned</p>
        </div>
        <div class="results-table-container">
          <table class="results-table">
            <thead>
              <tr>
                ${columns.map(col => `<th>${col}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.slice(0, 100).map(row => `
                <tr>
                  ${columns.map(col => `<td>${this.formatValue(row[col])}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${rows.length > 100 ? `<p class="results-truncated">Showing first 100 of ${rows.length} rows</p>` : ''}
      `;
    }

    formatValue(value) {
      if (value === null || value === undefined) return '<span class="null">NULL</span>';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    }

    async saveQuery() {
      const id = document.getElementById('query-id').value.trim();
      const name = document.getElementById('query-name').value.trim();
      const description = document.getElementById('query-description').value.trim();
      const sql = document.getElementById('query-sql').value.trim();

      if (!id || !name || !sql) {
        alert('Please fill in Query ID, Name, and SQL');
        return;
      }

      const select = document.getElementById('query-widget-types');
      const widgetTypes = Array.from(select.selectedOptions).map(opt => opt.value);

      const queryData = {
        id,
        name,
        description,
        sql,
        widgetTypes
      };

      try {
        const url = this.currentQuery ? `/api/bigquery/queries/${id}` : '/api/bigquery/queries';
        const method = this.currentQuery ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queryData)
        });

        const data = await response.json();

        if (data.success) {
          alert('Query saved successfully!');
          await this.loadSavedQueries();
          this.currentQuery = data.query;
        } else {
          alert(`Failed to save query: ${data.error}`);
        }
      } catch (error) {
        alert(`Failed to save query: ${error.message}`);
      }
    }

    async deleteQuery(queryId) {
      if (!confirm('Delete this query?')) return;

      try {
        const response = await fetch(`/api/bigquery/queries/${queryId}`, {
          method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
          await this.loadSavedQueries();
          if (this.currentQuery && this.currentQuery.id === queryId) {
            this.newQuery();
          }
        } else {
          alert(`Failed to delete query: ${data.error}`);
        }
      } catch (error) {
        alert(`Failed to delete query: ${error.message}`);
      }
    }
  }

  return QueryEditor;
})();

// Initialize query editor on page load
window.addEventListener('DOMContentLoaded', () => {
  window.queryEditor = new window.QueryEditor();
});
