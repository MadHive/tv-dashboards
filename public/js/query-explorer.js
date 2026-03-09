/* ===========================================================================
   QueryExplorer — interactive ad-hoc query sandbox for Studio
   =========================================================================== */

window.QueryExplorer = (function () {
  'use strict';

  class QueryExplorer {
    constructor(studioApp) {
      this.app      = studioApp;
      this._lastRaw = null;
      this._widget  = null;

      this._modal          = null;
      this._source         = null;
      this._gcpFields      = null;
      this._bqFields       = null;
      this._runBtn         = null;
      this._runStatus      = null;
      this._results        = null;
      this._previewWrap    = null;
      this._previewConfig  = null;
      this._widgetType     = null;
      this._unit           = null;
      this._maxRow         = null;
      this._maxInput       = null;
      this._exportBtn      = null;
      this._saveBtn        = null;
      this._assignBtn      = null;
      this._bqDataset      = null;
      this._bqTable        = null;
      this._schemaCols     = null;

      this._bound = false;
      this._init(); // bind button listener immediately — DOM is ready by instantiation time
    }

    _init() {
      if (this._bound) return;
      this._modal         = document.getElementById('qx-modal');
      this._source        = document.getElementById('qx-source');
      this._gcpFields     = document.getElementById('qx-gcp-fields');
      this._bqFields      = document.getElementById('qx-bq-fields');
      this._runBtn        = document.getElementById('qx-run-btn');
      this._runStatus     = document.getElementById('qx-run-status');
      this._results       = document.getElementById('qx-results');
      this._previewWrap   = document.getElementById('qx-preview-canvas-wrap');
      this._previewConfig = document.getElementById('qx-preview-config');
      this._widgetType    = document.getElementById('qx-widget-type');
      this._unit          = document.getElementById('qx-unit');
      this._maxRow        = document.getElementById('qx-max-row');
      this._maxInput      = document.getElementById('qx-max');
      this._exportBtn     = document.getElementById('qx-export-csv-btn');
      this._saveBtn       = document.getElementById('qx-save-btn');
      this._assignBtn     = document.getElementById('qx-assign-btn');
      this._bqDataset     = document.getElementById('qx-bq-dataset');
      this._bqTable       = document.getElementById('qx-bq-table');
      this._schemaCols    = document.getElementById('qx-schema-cols');
      this._computedFields  = document.getElementById('qx-computed-fields');
      this._computedFn      = document.getElementById('qx-computed-fn');
      this._computedParams  = document.getElementById('qx-computed-params');

      if (!this._modal) return;

      document.getElementById('open-query-explorer-btn')
        ?.addEventListener('click', () => this.open());
      document.getElementById('qx-close-btn')
        ?.addEventListener('click', () => this.close());
      this._modal.addEventListener('click', (e) => {
        if (e.target === this._modal) this.close();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this._modal.style.display !== 'none') this.close();
      });

      this._source.addEventListener('change', () => this._onSourceChange());
      this._runBtn.addEventListener('click', () => this._runQuery());
      this._widgetType.addEventListener('change', () => this._onWidgetTypeChange());
      this._unit.addEventListener('input', () => this._onWidgetTypeChange());
      this._maxInput?.addEventListener('input', () => this._onWidgetTypeChange());
      this._exportBtn.addEventListener('click', () => this._exportCsv());
      this._saveBtn.addEventListener('click', () => this._saveAsQuery());
      this._assignBtn.addEventListener('click', () => this._assignToWidget());

      document.getElementById('qx-browse-btn')
        ?.addEventListener('click', () => this._openMetricBrowser());

      this._bqDataset?.addEventListener('change', () => this._loadBqTables());
      this._bqTable?.addEventListener('change', () => this._loadBqSchema());

      this._bound = true;
    }

    open() {
      this._init();
      if (!this._modal) return;
      this._modal.style.display = 'flex';
      this._onSourceChange();
    }

    close() {
      if (this._modal) this._modal.style.display = 'none';
    }

    _onSourceChange() {
      const src = this._source?.value;
      if (this._gcpFields) this._gcpFields.style.display = src === 'gcp'      ? '' : 'none';
      if (this._bqFields)  this._bqFields.style.display  = src === 'bigquery' ? '' : 'none';
      if (this._computedFields) this._computedFields.style.display = src === 'computed' ? '' : 'none';
      if (src === 'bigquery') this._loadBqDatasets();
      if (src === 'computed') this._loadComputedFunctions();
    }

    async _runQuery() {
      if (!this._runBtn) return;
      const src = this._source?.value;
      if (!src || src === 'logging' || src === 'trace' || src === 'otel') return;

      this._runBtn.setAttribute('disabled', '');
      this._runStatus.textContent = 'Running\u2026';
      this._runStatus.style.color = 'var(--t3)';
      this._setActionsDisabled(true);

      const t0 = Date.now();
      try {
        let body;
        if (src === 'gcp') {
          body = this._buildGcpBody();
          if (!body) {
            this._runStatus.textContent = 'Enter a metric type';
            this._runBtn.removeAttribute('disabled');
            if (this._lastRaw) this._setActionsDisabled(false);
            return;
          }
        } else if (src === 'computed') {
          body = this._buildComputedBody();
          if (!body) {
            this._runStatus.textContent = 'Select a function';
            this._runBtn.removeAttribute('disabled');
            if (this._lastRaw) this._setActionsDisabled(false);
            return;
          }
        } else {
          body = this._buildBqBody();
          if (!body) {
            this._runStatus.textContent = 'Enter a SQL query';
            this._runBtn.removeAttribute('disabled');
            if (this._lastRaw) this._setActionsDisabled(false);
            return;
          }
        }

        const res  = await fetch('/api/explore/' + src, {
          method:  'POST',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify(body),
        });
        const data = await res.json();
        const ms   = Date.now() - t0;

        if (!data.success) {
          this._showError(data.error || 'Unknown error');
          this._runStatus.textContent = 'Error';
          this._runStatus.style.color = 'var(--red, #ef4444)';
          return;
        }

        this._runStatus.textContent = ms + 'ms';
        this._runStatus.style.color = 'var(--green, #4ade80)';

        if (src === 'computed') {
          this._lastRaw = { type: 'computed', rows: data.rawData || [], meta: data };
          this._renderBqResults(data.rawData || [], (data.rawData || []).length, data.rawData?.length > 0 ? Object.keys(data.rawData[0] || {}).length : 0, ms);
        } else if (src === 'gcp') {
          this._lastRaw = { type: 'gcp', rawSeries: data.rawSeries, meta: data };
          this._renderGcpResults(data.rawSeries, data.seriesCount, data.pointCount, ms);
        } else {
          this._lastRaw = { type: 'bigquery', rows: data.rows, meta: data };
          this._renderBqResults(data.rows, data.rowCount, data.columnCount, ms);
        }

        this._renderWidgetPreview(data.widgetData, body.widgetType || 'big-number');
        this._setActionsDisabled(false);
      } catch (err) {
        this._showError(err.message);
        this._runStatus.textContent = 'Error';
        this._runStatus.style.color = 'var(--red, #ef4444)';
      } finally {
        this._runBtn.removeAttribute('disabled');
      }
    }

    _buildGcpBody() {
      const metricType = document.getElementById('qx-metric-type')?.value?.trim();
      if (!metricType) return null;
      return {
        metricType,
        project:     document.getElementById('qx-project')?.value || 'mad-master',
        timeWindow:  parseInt(document.getElementById('qx-time-window')?.value || '30', 10),
        aggregation: {
          perSeriesAligner:   document.getElementById('qx-aligner')?.value || 'ALIGN_MEAN',
          crossSeriesReducer: document.getElementById('qx-reducer')?.value || 'REDUCE_NONE',
          alignmentPeriod:    document.getElementById('qx-period')?.value  || '60s',
        },
        filters:    document.getElementById('qx-filters')?.value?.trim() || '',
        widgetType: this._widgetType?.value || 'big-number',
      };
    }

    _buildBqBody() {
      const sql = document.getElementById('qx-sql')?.value?.trim();
      if (!sql) return null;
      return { sql, widgetType: this._widgetType?.value || 'big-number' };
    }

    _showError(message) {
      this._results.textContent = '';
      const div = document.createElement('div');
      div.className = 'qx-error-banner';
      div.textContent = message;
      this._results.appendChild(div);
    }

    _renderGcpResults(rawSeries, seriesCount, pointCount, ms) {
      this._results.textContent = '';
      if (!rawSeries?.length) {
        const div = document.createElement('div');
        div.className = 'qx-empty-banner';
        div.textContent = 'Query returned no data for this time window.';
        this._results.appendChild(div);
        return;
      }
      this._results.appendChild(this._buildResultsHeader(seriesCount + ' series', pointCount + ' points', ms + 'ms'));
      this._results.appendChild(this._buildTable(rawSeries));
    }

    _renderBqResults(rows, rowCount, columnCount, ms) {
      this._results.textContent = '';
      if (!rows?.length) {
        const div = document.createElement('div');
        div.className = 'qx-empty-banner';
        div.textContent = 'Query returned no rows.';
        this._results.appendChild(div);
        return;
      }
      this._results.appendChild(this._buildResultsHeader(rowCount + ' rows', columnCount + ' columns', ms + 'ms'));
      this._results.appendChild(this._buildTable(rows));
    }

    _buildResultsHeader(a, b, c) {
      const hdr  = document.createElement('div');
      hdr.className = 'qx-results-header';
      const meta = document.createElement('span');
      meta.className = 'qx-results-meta';
      [a, b, c].forEach(text => {
        const s = document.createElement('span');
        s.textContent = text;
        meta.appendChild(s);
      });
      hdr.appendChild(meta);
      return hdr;
    }

    _buildTable(rows) {
      if (!rows?.length) return document.createTextNode('');
      const cols = Object.keys(rows[0]);

      const wrap  = document.createElement('div');
      wrap.className = 'qx-results-table-wrap';
      const table = document.createElement('table');
      table.className = 'qx-results-table';

      const thead = document.createElement('thead');
      const hrow  = document.createElement('tr');
      cols.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        hrow.appendChild(th);
      });
      thead.appendChild(hrow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      rows.forEach(row => {
        const tr = document.createElement('tr');
        cols.forEach(col => {
          const td  = document.createElement('td');
          const val = row[col];
          const str = val === null || val === undefined ? 'NULL' : String(val);
          td.textContent = str.length > 80 ? str.slice(0, 80) + '\u2026' : str;
          if (typeof val === 'number') td.classList.add('qx-td-num');
          if (str.length > 80) td.title = str;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      return wrap;
    }

    _renderWidgetPreview(widgetData, widgetType) {
      this._previewWrap.textContent = '';
      this._previewConfig.style.display = '';

      if (this._maxRow) {
        this._maxRow.style.display = widgetType === 'gauge' ? '' : 'none';
      }

      if (!widgetData || !window.Widgets) {
        const p = document.createElement('div');
        p.className = 'qx-results-placeholder';
        p.textContent = 'No data to preview';
        this._previewWrap.appendChild(p);
        return;
      }

      const unit = this._unit?.value?.trim() || '';
      const max  = parseFloat(this._maxInput?.value) || undefined;
      const data = { ...widgetData };
      if (unit)                                 data.unit = unit;
      if (max !== undefined && widgetType === 'gauge') data.max  = max;

      try {
        if (this._widget?.destroy) this._widget.destroy();
        this._widget = window.Widgets.create(widgetType, this._previewWrap, { type: widgetType });
        if (this._widget?.update) this._widget.update(data);
      } catch (_) {
        const p = document.createElement('div');
        p.className = 'qx-results-placeholder';
        p.textContent = 'Not supported for this data shape';
        this._previewWrap.textContent = '';
        this._previewWrap.appendChild(p);
      }
    }

    _onWidgetTypeChange() {
      if (!this._lastRaw) return;
      const type = this._widgetType?.value || 'big-number';
      let widgetData = null;
      if (this._lastRaw.type === 'gcp') {
        widgetData = this._transformGcpClientSide(this._lastRaw.rawSeries, type);
      } else {
        // computed rawData uses same [{label, value}] shape as BQ rows
        widgetData = this._transformBqClientSide(this._lastRaw.rows, type);
      }
      this._renderWidgetPreview(widgetData, type);
    }

    _transformGcpClientSide(rawSeries, widgetType) {
      if (!rawSeries?.length) return null;
      const vals = rawSeries.map(r => r.value);
      switch (widgetType) {
        case 'big-number':
        case 'stat-card':
          return { value: vals[0], sparkline: vals.slice(0, 20), unit: '' };
        case 'gauge':
          return { value: vals[0], min: 0, max: 100, unit: '' };
        case 'line-chart':
          return { series: [{ label: 'Value', values: vals.slice(0, 30) }], timestamps: [] };
        case 'bar-chart': {
          const labelKey = Object.keys(rawSeries[0]).find(k => k !== 'timestamp' && k !== 'value');
          if (!labelKey) return { bars: [{ label: 'Value', value: vals[0] }] };
          const seen = new Map();
          rawSeries.forEach(r => {
            const lbl = String(r[labelKey]);
            if (!seen.has(lbl)) seen.set(lbl, r.value);
          });
          return { bars: [...seen.entries()].slice(0, 10).map(([label, value]) => ({ label, value })) };
        }
        case 'table': {
          if (!rawSeries?.length) return null;
          const sample = rawSeries[0];
          const cols   = Object.keys(sample);
          return {
            columns: cols.map(k => ({
              key:    k,
              label:  k,
              align:  typeof sample[k] === 'number' ? 'right' : 'left',
              format: typeof sample[k] === 'number' ? 'number' : undefined,
            })),
            rows: rawSeries.slice(0, 200),
          };
        }
        case 'multi-metric-card': {
          if (!rawSeries?.length) return null;
          // Group by the first non-timestamp, non-value label key
          const labelKey = Object.keys(rawSeries[0]).find(k => k !== 'timestamp' && k !== 'value');
          if (!labelKey) return { metrics: [{ label: 'Value', value: rawSeries[0].value ?? 0, unit: '', trend: 'stable' }] };
          const seen = new Map();
          rawSeries.forEach(r => {
            const lbl = String(r[labelKey]);
            if (!seen.has(lbl)) seen.set(lbl, r.value);
          });
          return {
            metrics: [...seen.entries()].slice(0, 6).map(([label, value]) => ({ label, value, unit: '', trend: 'stable' })),
          };
        }
        default:
          return { value: vals[0], unit: '' };
      }
    }

    _transformBqClientSide(rows, widgetType) {
      if (!rows?.length) return null;
      const cols   = Object.keys(rows[0]);
      const numCol = cols.find(c => typeof rows[0][c] === 'number');
      const strCol = cols.find(c => typeof rows[0][c] === 'string');
      if (!numCol) return null;

      switch (widgetType) {
        case 'big-number':
        case 'stat-card':
          return { value: rows[0][numCol], sparkline: rows.slice(1, 21).map(r => r[numCol] || 0), unit: '' };
        case 'gauge':
          return { value: rows[0][numCol], min: 0, max: 100, unit: '' };
        case 'bar-chart':
          return { bars: rows.slice(0, 10).map(r => ({ label: strCol ? String(r[strCol]) : String(r[numCol]), value: r[numCol] || 0 })) };
        case 'line-chart':
          return { series: [{ label: numCol, values: rows.map(r => r[numCol] || 0) }], timestamps: [] };
        case 'table':
          // Use outer `cols` (already computed from rows[0]) — no shadow needed
          return {
            columns: cols.map(k => ({
              key:    k,
              label:  k,
              align:  typeof rows[0][k] === 'number' ? 'right' : 'left',
              format: typeof rows[0][k] === 'number' ? 'number' : undefined,
            })),
            rows: rows.slice(0, 200),
          };
        case 'multi-metric-card': {
          // Use outer `cols` and `rows[0]` — no shadow needed
          const mmNumCols = cols.filter(k => typeof rows[0][k] === 'number');
          if (!mmNumCols.length) return null;
          return {
            metrics: mmNumCols.slice(0, 6).map(k => ({ label: k, value: rows[0][k], unit: '', trend: 'stable' })),
          };
        }
        case 'stacked-bar-chart': {
          // Use outer `cols`, `numCol`, `strCol` — no shadow needed
          const sbNumCols = cols.filter(k => typeof rows[0][k] === 'number');
          if (!sbNumCols.length) return null;
          return {
            categories: rows.map(r => strCol ? String(r[strCol]) : ''),
            series: sbNumCols.map(k => ({
              label: k,
              data:  rows.map(r => r[k] || 0),
            })),
          };
        }
        default:
          return { value: rows[0][numCol], unit: '' };
      }
    }

    _exportCsv() {
      if (!this._lastRaw) return;
      const rows = this._lastRaw.type === 'gcp'
        ? this._lastRaw.rawSeries
        : this._lastRaw.rows;
      if (!rows?.length) return;

      const cols  = Object.keys(rows[0]);
      const lines = [
        cols.map(c => c.includes(',') || c.includes('"') ? '"' + c.replace(/"/g, '""') + '"' : c).join(','),
        ...rows.map(r => cols.map(c => {
          const v = r[c] ?? '';
          const s = String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')
            ? '"' + s.replace(/"/g, '""') + '"'
            : s;
        }).join(',')),
      ];

      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'query-explorer-' + Date.now() + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    }

    async _saveAsQuery() {
      const src = this._source?.value;
      if (!src) return;
      let body;
      if (src === 'gcp') {
        body = this._buildGcpBody();
        if (!body) { this.app.showToast('Enter a metric type first', 'error'); return; }
        body = {
          id:          body.metricType.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + Date.now(),
          name:        body.metricType.split('/').pop(),
          metricType:  body.metricType,
          project:     body.project,
          timeWindow:  body.timeWindow,
          aggregation: body.aggregation,
          filters:     body.filters,
          widgetTypes: [],
        };
      } else {
        body = this._buildBqBody();
        if (!body) { this.app.showToast('Enter a SQL query first', 'error'); return; }
        body = {
          id:          'bq-' + Date.now(),
          name:        'BigQuery Query ' + new Date().toLocaleTimeString(),
          sql:         body.sql,
          widgetTypes: [],
        };
      }

      try {
        const res = await fetch('/api/queries/' + src, {
          method:  'POST',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        this.app.showToast('Query saved: ' + body.name, 'success');
        this.app.renderQueryList();
      } catch (err) {
        this.app.showToast('Save failed: ' + err.message, 'error');
      }
    }

    _assignToWidget() {
      this.app.showToast('Open the widget properties panel and use "Assign to Widget" there', 'info');
    }

    _openMetricBrowser() {
      if (!this.app?.metricBrowser) return;
      this.app.metricBrowser._explorerCallback = (metricType) => {
        const input = document.getElementById('qx-metric-type');
        if (input) input.value = metricType;
        this.app.metricBrowser._explorerCallback = null;
      };
      this.app.metricBrowser.open({ _explorerMode: true });
    }

    async _loadBqDatasets() {
      if (!this._bqDataset) return;
      try {
        const res  = await fetch('/api/bigquery/datasets');
        const data = await res.json();
        if (!data.success) return;
        this._bqDataset.textContent = '';
        const dflt = document.createElement('option');
        dflt.value = '';
        dflt.textContent = 'Dataset\u2026';
        this._bqDataset.appendChild(dflt);
        (data.datasets || []).forEach(d => {
          const opt = document.createElement('option');
          const val = typeof d === 'string' ? d : (d.id || d.datasetId || '');
          opt.value = opt.textContent = val;
          this._bqDataset.appendChild(opt);
        });
      } catch (_) { /* silent */ }
    }

    async _loadBqTables() {
      if (!this._bqTable) return;
      const ds = this._bqDataset?.value;
      if (!ds) return;
      try {
        const res  = await fetch('/api/bigquery/datasets/' + encodeURIComponent(ds) + '/tables');
        const data = await res.json();
        this._bqTable.textContent = '';
        const dflt = document.createElement('option');
        dflt.value = '';
        dflt.textContent = 'Table\u2026';
        this._bqTable.appendChild(dflt);
        (data.tables || []).forEach(t => {
          const opt = document.createElement('option');
          const val = typeof t === 'string' ? t : (t.id || t.tableId || '');
          opt.value = opt.textContent = val;
          this._bqTable.appendChild(opt);
        });
      } catch (_) { /* silent */ }
    }

    async _loadBqSchema() {
      if (!this._schemaCols) return;
      const ds  = this._bqDataset?.value;
      const tbl = this._bqTable?.value;
      if (!ds || !tbl) return;
      try {
        const res    = await fetch('/api/bigquery/datasets/' + encodeURIComponent(ds) + '/tables/' + encodeURIComponent(tbl) + '/schema');
        const data   = await res.json();
        this._schemaCols.textContent = '';
        const fields = data.schema?.fields || data.fields || [];
        fields.forEach(f => {
          const row  = document.createElement('div');
          row.className = 'qx-schema-col';
          const name = document.createElement('span');
          name.className = 'qx-col-name';
          name.textContent = f.name;
          const type = document.createElement('span');
          type.className = 'qx-col-type';
          type.textContent = f.type;
          row.appendChild(name);
          row.appendChild(type);
          this._schemaCols.appendChild(row);
        });
      } catch (_) { /* silent */ }
    }

    async _loadComputedFunctions() {
      if (!this._computedFn) return;
      try {
        const res  = await fetch('/api/queries/computed');
        const data = await res.json();
        this._computedFn.textContent = '';
        const dflt = document.createElement('option');
        dflt.value = '';
        dflt.textContent = 'Select function\u2026';
        this._computedFn.appendChild(dflt);
        (data.queries || []).forEach(q => {
          const opt = document.createElement('option');
          opt.value       = q.id;
          opt.textContent = q.name + ' (' + q.id + ')';
          this._computedFn.appendChild(opt);
        });
      } catch (_) { /* silent */ }
    }

    _buildComputedBody() {
      const fnId = this._computedFn?.value?.trim();
      if (!fnId) return null;
      let params = {};
      try {
        const raw = this._computedParams?.value?.trim();
        if (raw && raw !== '{}') params = JSON.parse(raw);
      } catch (_) { /* ignore bad JSON */ }
      return { function: fnId, params, widgetType: this._widgetType?.value || 'big-number' };
    }

    _setActionsDisabled(disabled) {
      if (this._exportBtn) this._exportBtn.disabled = disabled;
      if (this._saveBtn)   this._saveBtn.disabled   = disabled;
      if (this._assignBtn) this._assignBtn.disabled  = disabled;
    }
  }

  return QueryExplorer;
})();
