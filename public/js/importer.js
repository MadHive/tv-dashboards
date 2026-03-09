/* ===========================================================================
   GCP Import Page — browse GCP dashboards, preview live data, add to TV
   =========================================================================== */

(function () {
  'use strict';

  class GcpImportPage {
    constructor() {
      this._project        = 'mad-master';
      this._tiles          = [];
      this._lastRaw        = null;
      this._previewTile    = null;
      this._widget         = null;
      this._dashboards_all = [];

      this._projectSel  = document.getElementById('imp-project');
      this._search      = document.getElementById('imp-search');
      this._dashList    = document.getElementById('imp-dash-list');
      this._dashName    = document.getElementById('imp-dash-name');
      this._selCount    = document.getElementById('imp-sel-count');
      this._tileList    = document.getElementById('imp-tile-list');
      this._previewArea = document.getElementById('imp-preview-area');
      this._previewCtrl = document.getElementById('imp-preview-controls');
      this._widgetType  = document.getElementById('imp-widget-type');
      this._timeWindow  = document.getElementById('imp-time-window');
      this._status      = document.getElementById('imp-status');
      this._targetDash  = document.getElementById('imp-target-dash');
      this._addBtn      = document.getElementById('imp-add-btn');

      this._bindEvents();
      this._loadDashboards();
      this._loadTargetDashboards();
    }

    _bindEvents() {
      this._projectSel?.addEventListener('change', () => {
        this._project = this._projectSel.value;
        this._loadDashboards();
      });
      this._search?.addEventListener('input', () => this._filterDashboards());
      this._widgetType?.addEventListener('change', () => this._onTypeChange());
      this._timeWindow?.addEventListener('change', () => {
        if (this._previewTile) this._runPreview(this._previewTile);
      });
      this._addBtn?.addEventListener('click', () => this._addToDashboard());
    }

    // ── Left panel ──────────────────────────────────────────────────────────

    async _loadDashboards() {
      this._showState(this._dashList, 'loading', 'Loading dashboards\u2026');
      try {
        const res  = await fetch('/api/gcp/dashboards?project=' + encodeURIComponent(this._project));
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Unknown error');
        this._dashboards_all = data.dashboards || [];
        this._renderDashList(this._dashboards_all);
      } catch (err) {
        this._showState(this._dashList, 'error', 'Could not load dashboards: ' + err.message.slice(0, 80));
      }
    }

    _filterDashboards() {
      const q = (this._search?.value || '').toLowerCase();
      const filtered = q
        ? this._dashboards_all.filter(d => d.displayName.toLowerCase().includes(q))
        : this._dashboards_all;
      this._renderDashList(filtered);
    }

    _renderDashList(dashboards) {
      if (!this._dashList) return;
      this._dashList.textContent = '';
      if (!dashboards.length) {
        this._showState(this._dashList, 'empty', 'No dashboards found.');
        return;
      }
      dashboards.forEach(d => {
        const row = document.createElement('div');
        row.className = 'imp-dash-row';

        const nameEl = document.createElement('span');
        nameEl.textContent = d.displayName;

        const countEl = document.createElement('span');
        countEl.className = 'imp-dash-tile-count';
        countEl.textContent = d.tileCount + ' charts';

        row.appendChild(nameEl);
        row.appendChild(countEl);
        row.addEventListener('click', () => {
          this._dashList.querySelectorAll('.imp-dash-row').forEach(r => r.classList.remove('active'));
          row.classList.add('active');
          this._selectDashboard(d);
        });
        this._dashList.appendChild(row);
      });
    }

    async _selectDashboard(dashboard) {
      if (this._dashName) this._dashName.textContent = dashboard.displayName;
      this._showState(this._tileList, 'loading', 'Loading tiles\u2026');
      this._clearPreview();

      const shortId = dashboard.name.split('/').pop();
      try {
        const res  = await fetch('/api/gcp/dashboards/' + encodeURIComponent(shortId) + '?project=' + encodeURIComponent(this._project));
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Unknown error');
        this._tiles = data.tiles || [];
        this._renderTileList(this._tiles);
      } catch (err) {
        this._showState(this._tileList, 'error', 'Failed to load tiles: ' + err.message.slice(0, 80));
      }
    }

    // ── Center panel ─────────────────────────────────────────────────────────

    _renderTileList(tiles) {
      if (!this._tileList) return;
      this._tileList.textContent = '';
      this._updateAddBtn();

      if (!tiles.length) {
        this._showState(this._tileList, 'empty', 'No importable chart tiles in this dashboard.');
        return;
      }

      tiles.forEach((tile, i) => {
        const row = document.createElement('div');
        row.className = 'imp-tile-row';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.idx = i;
        cb.addEventListener('change', () => this._updateAddBtn());

        const info = document.createElement('div');
        info.className = 'imp-tile-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'imp-tile-name';
        nameEl.textContent = tile.name;

        const metricEl = document.createElement('div');
        metricEl.className = 'imp-tile-metric';
        metricEl.textContent = tile.metricType;

        info.appendChild(nameEl);
        info.appendChild(metricEl);
        row.appendChild(cb);
        row.appendChild(info);

        if (tile.conflictId) {
          const badge = document.createElement('span');
          badge.className = 'imp-tile-conflict';
          badge.textContent = '\u26a0 exists';
          badge.title = 'Already saved as: ' + tile.conflictId;
          row.appendChild(badge);
        }

        row.addEventListener('click', (e) => {
          if (e.target === cb) return;
          this._tileList.querySelectorAll('.imp-tile-row').forEach(r => r.classList.remove('previewing'));
          row.classList.add('previewing');
          this._runPreview(tile);
        });

        this._tileList.appendChild(row);
      });
    }

    _updateAddBtn() {
      const n = this._tileList
        ? this._tileList.querySelectorAll('input[type="checkbox"]:checked').length
        : 0;
      if (this._selCount) this._selCount.textContent = n > 0 ? n + ' selected' : '';
      if (this._addBtn) {
        this._addBtn.disabled    = n === 0;
        this._addBtn.textContent = n > 0 ? 'Add ' + n + ' to Dashboard' : 'Add to Dashboard';
      }
    }

    // ── Right panel ──────────────────────────────────────────────────────────

    async _runPreview(tile) {
      this._previewTile = tile;
      this._lastRaw     = null;
      if (this._previewCtrl) this._previewCtrl.style.display = '';
      this._setStatus('querying');
      this._clearWidgetCanvas();

      // Auto-suggest widget type
      if (this._widgetType && tile.aggregation) {
        const reducer = tile.aggregation.crossSeriesReducer || '';
        this._widgetType.value = (!reducer || reducer === 'REDUCE_NONE') ? 'big-number' : 'bar-chart';
      }

      const timeWindow = parseInt(this._timeWindow?.value || '30', 10);
      const widgetType = this._widgetType?.value || 'big-number';

      try {
        const res  = await fetch('/api/explore/gcp', {
          method:  'POST',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify({
            metricType:  tile.metricType,
            project:     this._project,
            filters:     tile.filters || '',
            aggregation: tile.aggregation || {},
            timeWindow,
            widgetType,
          }),
        });
        const data = await res.json();

        if (!data.success) {
          this._setStatus('error', data.error || 'Query failed');
          this._showPreviewMessage('GCP error: ' + (data.error || 'Query failed'));
          return;
        }

        this._lastRaw = data.rawSeries || [];

        if (!this._lastRaw.length) {
          this._setStatus('warn', 'No data for this time window');
          this._showPreviewMessage('No data returned for this metric in the selected time window.\nTry a longer window or a different metric.');
        } else {
          this._setStatus('ok', data.seriesCount + ' series \u00b7 ' + data.executionMs + 'ms');
          this._renderPreviewWidget(data.widgetData, widgetType);
        }
      } catch (err) {
        this._setStatus('error', err.message);
        this._showPreviewMessage('Error: ' + err.message);
      }
    }

    _onTypeChange() {
      if (!this._lastRaw) return;
      const type = this._widgetType?.value || 'big-number';
      const vals = this._lastRaw.map(r => r.value);
      let widgetData = null;

      switch (type) {
        case 'big-number':
        case 'stat-card':
          widgetData = { value: vals[0], sparkline: vals.slice(0, 20), unit: '' }; break;
        case 'gauge':
          widgetData = { value: vals[0], min: 0, max: 100, unit: '' }; break;
        case 'line-chart':
          widgetData = { series: [{ label: 'Value', data: vals.slice(0, 30) }], timestamps: [] }; break;
        case 'bar-chart': {
          const lk = this._lastRaw[0] && Object.keys(this._lastRaw[0]).find(k => k !== 'timestamp' && k !== 'value');
          const seen = new Map();
          this._lastRaw.forEach(r => { const l = String(r[lk] || 'Value'); if (!seen.has(l)) seen.set(l, r.value); });
          widgetData = { bars: [...seen.entries()].slice(0, 10).map(([label, value]) => ({ label, value })) }; break;
        }
        case 'table': {
          if (this._lastRaw.length) {
            const cols = Object.keys(this._lastRaw[0]);
            widgetData = {
              columns: cols.map(k => ({ key: k, label: k, align: typeof this._lastRaw[0][k] === 'number' ? 'right' : 'left', format: typeof this._lastRaw[0][k] === 'number' ? 'number' : undefined })),
              rows: this._lastRaw.slice(0, 50),
            };
          }
          break;
        }
        default: widgetData = { value: vals[0], unit: '' };
      }
      this._renderPreviewWidget(widgetData, type);
    }

    _showPreviewMessage(text) {
      if (this._widget?.destroy) this._widget.destroy();
      this._widget = null;
      if (this._previewArea) {
        const p = document.createElement('div');
        p.className = 'imp-empty';
        p.style.whiteSpace = 'pre-line';
        p.textContent = text;
        this._previewArea.textContent = '';
        this._previewArea.appendChild(p);
      }
    }

    _renderPreviewWidget(widgetData, widgetType) {
      this._clearWidgetCanvas();
      if (!widgetData || !window.Widgets) {
        this._showPreviewMessage('No data available.');
        return;
      }

      const wrap = document.createElement('div');
      wrap.className = 'imp-preview-widget-wrap';
      if (this._previewArea) {
        this._previewArea.textContent = '';
        this._previewArea.appendChild(wrap);
      }

      try {
        this._widget = window.Widgets.create(widgetType, wrap, { type: widgetType });
        if (this._widget?.update) this._widget.update(widgetData);
      } catch (_) {
        const msg = document.createElement('div');
        msg.className = 'imp-empty';
        msg.textContent = 'Not supported for this data shape.';
        wrap.textContent = '';
        wrap.appendChild(msg);
      }
    }

    _clearWidgetCanvas() {
      if (this._widget?.destroy) this._widget.destroy();
      this._widget = null;
      if (this._previewArea) {
        const p = document.createElement('div');
        p.className = 'imp-empty';
        p.textContent = 'Loading preview\u2026';
        this._previewArea.textContent = '';
        this._previewArea.appendChild(p);
      }
    }

    _clearPreview() {
      if (this._widget?.destroy) this._widget.destroy();
      this._widget   = null;
      this._lastRaw  = null;
      this._previewTile = null;
      if (this._previewArea) {
        const p = document.createElement('div');
        p.className = 'imp-empty';
        p.textContent = 'Click a chart tile to preview its data.';
        this._previewArea.textContent = '';
        this._previewArea.appendChild(p);
      }
      if (this._previewCtrl) this._previewCtrl.style.display = 'none';
      if (this._status) { this._status.textContent = ''; this._status.className = 'imp-status'; }
    }

    _setStatus(state, message) {
      if (!this._status) return;
      const icons = { querying: '\u27f3 Querying GCP\u2026', ok: '\u2713 ', warn: '\u26a0 ', error: '\u2717 ' };
      this._status.textContent = (icons[state] || '') + (message || '');
      this._status.className   = 'imp-status' + (state === 'ok' ? ' ok' : state === 'warn' ? ' warn' : state === 'error' ? ' error' : '');
    }

    // ── Target dashboard ─────────────────────────────────────────────────────

    async _loadTargetDashboards() {
      if (!this._targetDash) return;
      try {
        const res  = await fetch('/api/config');
        const data = await res.json();
        const dbs  = data.dashboards || [];
        this._targetDash.textContent = '';
        const lastId = localStorage.getItem('lastActiveDash') || '';
        dbs.forEach(d => {
          const opt = document.createElement('option');
          opt.value       = d.id;
          opt.textContent = d.name || d.id;
          if (d.id === lastId) opt.selected = true;
          this._targetDash.appendChild(opt);
        });
      } catch (_) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Could not load dashboards';
        this._targetDash.appendChild(opt);
      }
    }

    // ── Add to Dashboard ─────────────────────────────────────────────────────

    async _addToDashboard() {
      const dashId = this._targetDash?.value;
      if (!dashId) { alert('Select a target dashboard first.'); return; }

      const checked = [...(this._tileList?.querySelectorAll('input[type="checkbox"]:checked') || [])];
      if (!checked.length) return;

      const tiles = checked
        .map(cb => this._tiles[parseInt(cb.dataset.idx, 10)])
        .filter(t => t?.metricType);
      if (!tiles.length) return;

      this._addBtn.disabled    = true;
      this._addBtn.textContent = 'Adding\u2026';

      try {
        // 1. Save new queries (skip if conflictId already exists)
        const queryIds = await Promise.all(tiles.map(async tile => {
          if (tile.conflictId) return tile.conflictId;
          const body = {
            id:          tile.id,
            name:        tile.name,
            metricType:  tile.metricType,
            project:     this._project,
            filters:     tile.filters || '',
            aggregation: tile.aggregation || {},
            timeWindow:  parseInt(this._timeWindow?.value || '30', 10),
            widgetTypes: [],
          };
          const res  = await fetch('/api/queries/gcp', {
            method:  'POST',
            headers: { 'content-type': 'application/json' },
            body:    JSON.stringify(body),
          });
          const data = await res.json();
          return data.query?.id || tile.id;
        }));

        // 2. Fetch current dashboard config
        const cfgRes  = await fetch('/api/config');
        const cfgData = await cfgRes.json();
        const dashboard = (cfgData.dashboards || []).find(d => d.id === dashId);
        if (!dashboard) throw new Error('Dashboard not found: ' + dashId);

        if (!dashboard.widgets) dashboard.widgets = [];
        const gridCols = dashboard.grid?.columns || 4;

        // Find next available grid position
        let col = 1, row = 1;
        if (dashboard.widgets.length > 0) {
          const last    = dashboard.widgets[dashboard.widgets.length - 1];
          const nextCol = (last.position?.col || 1) + 1;
          col = nextCol > gridCols ? 1 : nextCol;
          row = nextCol > gridCols ? (last.position?.row || 1) + 1 : (last.position?.row || 1);
        }

        // 3. Append widgets
        tiles.forEach((tile, i) => {
          dashboard.widgets.push({
            id:       tile.id + '-' + Date.now() + '-' + i,
            type:     this._widgetType?.value || 'big-number',
            title:    tile.name,
            source:   'gcp',
            queryId:  queryIds[i],
            position: { col, row, colSpan: 1, rowSpan: 1 },
          });
          col++;
          if (col > gridCols) { col = 1; row++; }
        });

        // 4. Save updated dashboard
        const putRes = await fetch('/api/dashboards/' + encodeURIComponent(dashId), {
          method:  'PUT',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify(dashboard),
        });
        if (!putRes.ok) {
          const errData = await putRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to save dashboard');
        }

        localStorage.setItem('lastActiveDash', dashId);

        const n = tiles.length;
        this._addBtn.textContent = '\u2713 ' + n + ' widget' + (n !== 1 ? 's' : '') + ' added! Returning\u2026';
        setTimeout(() => { window.location.href = '/admin'; }, 1200);
      } catch (err) {
        this._addBtn.disabled    = false;
        this._addBtn.textContent = 'Add to Dashboard';
        alert('Error: ' + err.message);
      }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    _showState(container, state, message) {
      if (!container) return;
      container.textContent = '';
      const el = document.createElement('div');
      el.className = state === 'error' ? 'imp-error-msg' : (state === 'loading' ? 'imp-loading' : 'imp-empty');
      el.textContent = message;
      container.appendChild(el);
    }
  }

  document.addEventListener('DOMContentLoaded', () => { new GcpImportPage(); });
})();
