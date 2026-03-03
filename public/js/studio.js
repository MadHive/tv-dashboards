/* ==========================================================================
   MadHive Studio — Main StudioApp Controller
   Task 2: State management, sidebar, properties panel, widget palette
   ========================================================================== */

(function () {
  'use strict';

  class StudioApp {
    constructor() {
      this.config = null;
      this.modifiedConfig = null;
      this.activeDashIdx = -1;
      this.selectedWidgetId = null;
      this.isDirty = false;
      this.themes = [];
    }

    /* ─────────────────────────────────────────────
       Init
    ───────────────────────────────────────────── */

    async init() {
      try { this.metricBrowser = new MetricBrowser(this); } catch (e) { console.error('[studio] MetricBrowser init failed:', e); }
      await this.loadConfig();
      await this.loadThemes();
      this.renderSidebar();
      this.renderThemeSwatches();
      this.loadSettings();
      this.bindTopBar();
      this.bindSidebarActions();
      this.bindCollapsibles();
      this.bindSettings();
      this.bindWidgetPaletteModal();
      this.bindSidebarTabs();

      if (this.modifiedConfig && this.modifiedConfig.dashboards && this.modifiedConfig.dashboards.length > 0) {
        this.selectDashboard(0);
      }
    }

    /* ─────────────────────────────────────────────
       Data Loading
    ───────────────────────────────────────────── */

    async loadConfig() {
      try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        this.config = await res.json();
        this.modifiedConfig = JSON.parse(JSON.stringify(this.config));
      } catch (e) {
        this.showToast('Failed to load config: ' + e.message, 'error');
        this.config = { global: {}, dashboards: [] };
        this.modifiedConfig = { global: {}, dashboards: [] };
      }
    }

    async loadThemes() {
      try {
        const res = await fetch('/api/themes');
        this.themes = await res.json();
      } catch (_) {
        // Themes are optional — fail silently
        this.themes = [];
      }
    }

    /* ─────────────────────────────────────────────
       Dirty State
    ───────────────────────────────────────────── */

    markDirty() {
      this.isDirty = true;
      const indicator = document.getElementById('dirty-indicator');
      if (indicator) indicator.style.display = '';
      const saveBtn = document.getElementById('save-btn');
      if (saveBtn) saveBtn.removeAttribute('disabled');
      const discardBtn = document.getElementById('discard-btn');
      if (discardBtn) discardBtn.removeAttribute('disabled');
    }

    markClean() {
      this.isDirty = false;
      const indicator = document.getElementById('dirty-indicator');
      if (indicator) indicator.style.display = 'none';
      const saveBtn = document.getElementById('save-btn');
      if (saveBtn) saveBtn.setAttribute('disabled', '');
      const discardBtn = document.getElementById('discard-btn');
      if (discardBtn) discardBtn.setAttribute('disabled', '');
    }

    /* ─────────────────────────────────────────────
       Save / Discard
    ───────────────────────────────────────────── */

    async save() {
      if (this.activeDashIdx < 0) return;
      const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
      try {
        const res = await fetch('/api/dashboards/' + dash.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dash),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: res.statusText }));
          throw new Error(err.message || res.statusText);
        }
        this.config = JSON.parse(JSON.stringify(this.modifiedConfig));
        this.markClean();
        this.showToast('Saved!', 'success');
      } catch (e) {
        this.showToast('Save failed: ' + e.message, 'error');
      }
    }

    discard() {
      if (!confirm('Discard all unsaved changes?')) return;
      this.modifiedConfig = JSON.parse(JSON.stringify(this.config));
      this.markClean();
      const idx = this.activeDashIdx;
      this.activeDashIdx = -1;
      this.selectDashboard(idx);
    }

    /* ─────────────────────────────────────────────
       Sidebar Rendering
    ───────────────────────────────────────────── */

    renderSidebar() {
      const list = document.getElementById('dashboard-list');
      if (!list) return;
      list.textContent = '';

      const dashes = (this.modifiedConfig && this.modifiedConfig.dashboards) || [];
      dashes.forEach((dash, i) => {
        const item = document.createElement('div');
        item.className = 'dashboard-nav-item' + (i === this.activeDashIdx ? ' active' : '');
        item.setAttribute('draggable', 'true');
        item.dataset.idx = i;

        // Thumbnail
        const thumb = document.createElement('canvas');
        thumb.className = 'dash-thumb';
        thumb.width  = 40;
        thumb.height = 24;
        this._drawThumbnail(thumb, dash);

        // Drag handle
        const handle = document.createElement('span');
        handle.className   = 'nav-drag-handle';
        handle.textContent = '\u2807';
        handle.title       = 'Drag to reorder';

        const name = document.createElement('span');
        name.className = 'nav-name';
        name.textContent = dash.name;

        const count = document.createElement('span');
        count.className = 'nav-count';
        count.textContent = (dash.widgets ? dash.widgets.length : 0) + 'w';

        const delBtn = document.createElement('button');
        delBtn.className = 'nav-delete';
        delBtn.textContent = '\u2715';
        delBtn.title = 'Delete';

        item.appendChild(handle);
        item.appendChild(thumb);
        item.appendChild(name);
        item.appendChild(count);
        item.appendChild(delBtn);

        item.addEventListener('click', (e) => {
          if (e.target === delBtn || e.target === handle) return;
          this.selectDashboard(i);
        });

        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteDashboard(i);
        });

        item.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('dashIdx', String(i));
          item.classList.add('dragging');
        });
        item.addEventListener('dragend', () => item.classList.remove('dragging'));
        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          list.querySelectorAll('.dashboard-nav-item').forEach(el => el.classList.remove('drag-over'));
          item.classList.add('drag-over');
        });
        item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
        item.addEventListener('drop', (e) => {
          e.preventDefault();
          item.classList.remove('drag-over');
          const fromIdx = parseInt(e.dataTransfer.getData('dashIdx'));
          const toIdx   = parseInt(item.dataset.idx);
          if (fromIdx === toIdx || isNaN(fromIdx) || isNaN(toIdx)) return;
          this._reorderDashboard(fromIdx, toIdx);
        });

        list.appendChild(item);
      });
    }

    async _reorderDashboard(fromIdx, toIdx) {
      const dashes = this.modifiedConfig.dashboards;
      // Capture active dashboard ID BEFORE mutating the array
      const activeId = dashes[this.activeDashIdx] ? dashes[this.activeDashIdx].id : null;

      // Mutate in-memory array
      const moved = dashes.splice(fromIdx, 1)[0];
      dashes.splice(toIdx, 0, moved);
      const order = dashes.map(d => d.id);

      try {
        const res = await fetch('/api/dashboards/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order }),
        });
        if (!res.ok) throw new Error('Server returned ' + res.status);
        this.showToast('Dashboard order saved', 'success');
      } catch (e) {
        // Rollback: reverse the splice
        const rolledBack = dashes.splice(toIdx, 1)[0];
        dashes.splice(fromIdx, 0, rolledBack);
        this.showToast('Reorder failed: ' + e.message, 'error');
        this.renderSidebar();
        return;
      }

      // Update active index to track the same dashboard
      const newActive = activeId ? dashes.findIndex(d => d.id === activeId) : 0;
      this.activeDashIdx = newActive >= 0 ? newActive : 0;
      this.renderSidebar();
    }

    _drawThumbnail(canvas, dash) {
      const ctx  = canvas.getContext('2d');
      const w    = canvas.width;
      const h    = canvas.height;
      const cols = (dash.grid && dash.grid.columns) ? dash.grid.columns : 4;
      const rows = (dash.grid && dash.grid.rows)    ? dash.grid.rows    : 2;
      const cw   = w / cols;
      const rh   = h / rows;

      ctx.fillStyle = '#0E0320';
      ctx.fillRect(0, 0, w, h);

      const TYPE_COLORS = {
        'big-number':         '#FDA4D4',
        'stat-card':          '#FDA4D4',
        'gauge':              '#FBBF24',
        'gauge-row':          '#FBBF24',
        'bar-chart':          '#60A5FA',
        'progress-bar':       '#60A5FA',
        'status-grid':        '#4ADE80',
        'alert-list':         '#FB7185',
        'service-heatmap':    '#4ADE80',
        'pipeline-flow':      '#67E8F9',
        'usa-map':            '#4ADE80',
        'security-scorecard': '#FB7185',
      };

      (dash.widgets || []).forEach(wc => {
        const x  = (wc.position.col - 1) * cw;
        const y  = (wc.position.row - 1) * rh;
        const bw = (wc.position.colSpan || 1) * cw - 1;
        const bh = (wc.position.rowSpan || 1) * rh - 1;
        ctx.fillStyle   = TYPE_COLORS[wc.type] || '#8B75B0';
        ctx.globalAlpha = 0.75;
        ctx.fillRect(x + 1, y + 1, bw - 1, bh - 1);
        ctx.globalAlpha = 1;
      });
    }

    /* ─────────────────────────────────────────────
       Dashboard Selection
    ───────────────────────────────────────────── */

    selectDashboard(idx) {
      this.activeDashIdx = idx;
      this.selectedWidgetId = null;

      // Update active class
      const items = document.querySelectorAll('.dashboard-nav-item');
      items.forEach((el, i) => {
        el.classList.toggle('active', i === idx);
      });

      // Enable add-widget button
      const addWidgetBtn = document.getElementById('add-widget-btn');
      if (addWidgetBtn) addWidgetBtn.removeAttribute('disabled');

      this.renderCanvas();
      this.showDashboardProps();
    }

    /* ─────────────────────────────────────────────
       Dashboard Delete
    ───────────────────────────────────────────── */

    async deleteDashboard(idx) {
      const dash = this.modifiedConfig.dashboards[idx];
      if (!confirm('Delete "' + dash.name + '"?')) return;

      try {
        await fetch('/api/dashboards/' + dash.id, { method: 'DELETE' });
      } catch (_) {
        // Continue regardless — the local state still needs updating
      }

      await this.loadConfig();
      this.renderSidebar();

      if (this.activeDashIdx >= this.modifiedConfig.dashboards.length) {
        this.activeDashIdx = this.modifiedConfig.dashboards.length - 1;
      }

      if (this.activeDashIdx >= 0) {
        this.selectDashboard(this.activeDashIdx);
      } else {
        this.clearCanvas();
      }
    }

    /* ─────────────────────────────────────────────
       Canvas
    ───────────────────────────────────────────── */

    clearCanvas() {
      const canvas = document.getElementById('studio-canvas');
      if (!canvas) return;
      canvas.textContent = '';
      const placeholder = document.createElement('div');
      placeholder.className = 'canvas-placeholder';
      placeholder.textContent = 'Select a dashboard to edit';
      canvas.appendChild(placeholder);
    }

    renderCanvas() {
      if (window.StudioCanvas) window.StudioCanvas.render(this);
    }

    /* ─────────────────────────────────────────────
       Dashboard Properties Panel
    ───────────────────────────────────────────── */

    showDashboardProps() {
      const placeholder = document.getElementById('properties-placeholder');
      const content = document.getElementById('properties-content');
      const dashProps = document.getElementById('dashboard-props');
      const widgetProps = document.getElementById('widget-props');
      const qe  = document.getElementById('query-editor-panel');
      const dse = document.getElementById('datasource-editor-panel');
      if (qe)  qe.style.display  = 'none';
      if (dse) dse.style.display = 'none';

      if (placeholder) placeholder.style.display = 'none';
      if (content) content.style.display = 'flex';
      if (dashProps) dashProps.style.display = 'block';
      if (widgetProps) widgetProps.style.display = 'none';

      const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
      if (!dash) return;

      const nameEl = document.getElementById('prop-dash-name');
      const subtitleEl = document.getElementById('prop-dash-subtitle');
      const colsEl = document.getElementById('prop-dash-cols');
      const rowsEl = document.getElementById('prop-dash-rows');
      const gapEl = document.getElementById('prop-dash-gap');

      if (nameEl) nameEl.value = dash.name;
      if (subtitleEl) subtitleEl.value = dash.subtitle || '';
      if (colsEl) colsEl.value = dash.grid.columns;
      if (rowsEl) rowsEl.value = dash.grid.rows;
      if (gapEl) gapEl.value = dash.grid.gap !== undefined ? dash.grid.gap : 14;

      // Bind oninput
      if (nameEl) nameEl.oninput = () => this.applyDashboardProps();
      if (subtitleEl) subtitleEl.oninput = () => this.applyDashboardProps();
      if (colsEl) colsEl.oninput = () => this.applyDashboardProps();
      if (rowsEl) rowsEl.oninput = () => this.applyDashboardProps();
      if (gapEl) gapEl.oninput = () => this.applyDashboardProps();
    }

    applyDashboardProps() {
      const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
      if (!dash) return;

      const nameEl = document.getElementById('prop-dash-name');
      const subtitleEl = document.getElementById('prop-dash-subtitle');
      const colsEl = document.getElementById('prop-dash-cols');
      const rowsEl = document.getElementById('prop-dash-rows');
      const gapEl = document.getElementById('prop-dash-gap');

      if (nameEl) dash.name = nameEl.value;
      if (subtitleEl) dash.subtitle = subtitleEl.value;
      if (colsEl) dash.grid.columns = parseInt(colsEl.value) || dash.grid.columns;
      if (rowsEl) dash.grid.rows = parseInt(rowsEl.value) || dash.grid.rows;
      if (gapEl) dash.grid.gap = parseInt(gapEl.value) || 0;

      this.markDirty();
      this.renderCanvas();
      this.renderSidebar();
    }

    /* ─────────────────────────────────────────────
       Widget Properties Panel
    ───────────────────────────────────────────── */

    showWidgetProps(widgetId) {
      this.selectedWidgetId = widgetId;

      const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
      if (!dash) return;
      const wc = dash.widgets.find((w) => w.id === widgetId);
      if (!wc) return;

      const placeholder = document.getElementById('properties-placeholder');
      const content = document.getElementById('properties-content');
      const dashProps = document.getElementById('dashboard-props');
      const widgetProps = document.getElementById('widget-props');

      // Hide all alternate right-panel views before showing widget props
      const qe  = document.getElementById('query-editor-panel');
      const dse = document.getElementById('datasource-editor-panel');
      if (qe)  qe.style.display  = 'none';
      if (dse) dse.style.display = 'none';

      if (placeholder) placeholder.style.display = 'none';
      if (content) content.style.display = 'flex';
      if (dashProps) dashProps.style.display = 'none';
      if (widgetProps) widgetProps.style.display = 'block';

      // Populate fields
      const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      };

      set('prop-title', wc.title || '');
      set('prop-type', wc.type || 'big-number');
      set('prop-source', wc.source || 'gcp');
      set('prop-col', wc.position.col);
      set('prop-row', wc.position.row);
      set('prop-colspan', wc.position.colSpan || 1);
      set('prop-rowspan', wc.position.rowSpan || 1);
      set('prop-unit', wc.unit || '');
      set('prop-min', wc.min !== undefined ? wc.min : '');
      set('prop-max', wc.max !== undefined ? wc.max : '');
      set('prop-warn', wc.thresholds && wc.thresholds.warning !== undefined ? wc.thresholds.warning : '');
      set('prop-crit', wc.thresholds && wc.thresholds.critical !== undefined ? wc.thresholds.critical : '');

      // Show/hide Display section based on type
      const displaySection = document.getElementById('display-section');
      if (displaySection) {
        const showDisplayTypes = ['gauge', 'gauge-row', 'progress-bar', 'big-number', 'stat-card'];
        displaySection.style.display = showDisplayTypes.includes(wc.type) ? '' : 'none';
      }

      // Always load queries for current source (even if no queryId assigned yet)
      this.loadQueryOptions(wc.source || 'gcp', wc.queryId || '');
      this.updateDataSummary(wc.source, wc.queryId);
      this.bindWidgetPropListeners(wc);
    }

    bindWidgetPropListeners(wc) {
      const self = this;

      function bind(id, applyFn) {
        const el = document.getElementById(id);
        if (!el) return;
        el.oninput = el.onchange = function () {
          applyFn(el.value);
          self.markDirty();
          self.renderCanvas();
        };
      }

      bind('prop-title', (v) => { wc.title = v; });
      bind('prop-type', (v) => {
        wc.type = v;
        // Update display section visibility on type change
        const displaySection = document.getElementById('display-section');
        if (displaySection) {
          const showDisplayTypes = ['gauge', 'gauge-row', 'progress-bar', 'big-number', 'stat-card'];
          displaySection.style.display = showDisplayTypes.includes(v) ? '' : 'none';
        }
      });
      bind('prop-col', (v) => { wc.position.col = parseInt(v) || wc.position.col; });
      bind('prop-row', (v) => { wc.position.row = parseInt(v) || wc.position.row; });
      bind('prop-colspan', (v) => { wc.position.colSpan = Math.max(1, parseInt(v) || 1); });
      bind('prop-rowspan', (v) => { wc.position.rowSpan = Math.max(1, parseInt(v) || 1); });
      bind('prop-unit', (v) => { wc.unit = v; });
      bind('prop-min', (v) => { wc.min = v !== '' ? parseFloat(v) : undefined; });
      bind('prop-max', (v) => { wc.max = v !== '' ? parseFloat(v) : undefined; });
      bind('prop-warn', (v) => {
        wc.thresholds = wc.thresholds || {};
        wc.thresholds.warning = v !== '' ? parseFloat(v) : undefined;
      });
      bind('prop-crit', (v) => {
        wc.thresholds = wc.thresholds || {};
        wc.thresholds.critical = v !== '' ? parseFloat(v) : undefined;
      });

      // Show/hide Browse GCP Metrics button based on source
      const browseBtn = document.getElementById('browse-metrics-btn');
      if (browseBtn) {
        browseBtn.style.display = (wc.source === 'gcp') ? '' : 'none';
        browseBtn.onclick = () => self.metricBrowser.open(wc);
      }

      // Special: source change reloads queries + toggles Browse button
      const sourceEl = document.getElementById('prop-source');
      if (sourceEl) {
        sourceEl.onchange = async function () {
          wc.source = sourceEl.value;
          wc.queryId = '';
          if (browseBtn) browseBtn.style.display = (wc.source === 'gcp') ? '' : 'none';
          await self.loadQueryOptions(wc.source, '');
          self.updateDataSummary(wc.source, wc.queryId);
          self.markDirty();
        };
      }

      // Special: query selection
      const queryEl = document.getElementById('prop-query');
      if (queryEl) {
        queryEl.onchange = function () {
          wc.queryId = queryEl.value;
          self.updateDataSummary(wc.source, wc.queryId);
          self.markDirty();
        };
      }

      // Delete widget button
      const deleteBtn = document.getElementById('delete-widget-btn');
      if (deleteBtn) {
        deleteBtn.onclick = () => this.deleteSelectedWidget();
      }

      // New query button
      const newQueryBtn = document.getElementById('new-query-btn');
      if (newQueryBtn) {
        newQueryBtn.onclick = () => {
          if (window.queryEditor) window.queryEditor.open();
        };
      }
    }

    /* ─────────────────────────────────────────────
       Query Options
    ───────────────────────────────────────────── */

    updateDataSummary(source, queryId) {
      const SOURCE_LABELS = {
        'gcp':       'GCP Cloud Monitoring',
        'bigquery':  'BigQuery',
        'vulntrack': 'VulnTrack',
        'mock':      'Mock',
      };
      const srcEl   = document.getElementById('data-summary-source');
      const queryEl = document.getElementById('data-summary-query');
      if (!srcEl || !queryEl) return;

      srcEl.textContent = SOURCE_LABELS[source] || source || 'Unknown';

      if (queryId) {
        // Try to find query name in the loaded dropdown
        const sel = document.getElementById('prop-query');
        const opt = sel && sel.querySelector('option[value="' + queryId + '"]');
        queryEl.textContent   = opt ? opt.textContent : queryId;
        queryEl.className     = 'data-summary-query';
      } else {
        queryEl.textContent = source === 'gcp' ? 'Built-in metrics (no saved query)' : 'No query selected';
        queryEl.className   = 'data-summary-query none';
      }
    }

    async loadQueryOptions(source, selectedId) {
      const sel = document.getElementById('prop-query');
      if (!sel) return;

      // Clear and add default
      sel.textContent = '';
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '\u2014 select query \u2014';
      sel.appendChild(defaultOpt);

      try {
        const res = await fetch('/api/queries/' + source);
        const data = await res.json();
        const queries = data.queries || data;
        if (Array.isArray(queries)) {
          queries.forEach((q) => {
            const opt = document.createElement('option');
            opt.value = q.id;
            opt.textContent = q.name;
            if (q.id === selectedId) opt.selected = true;
            sel.appendChild(opt);
          });
        }
      } catch (_) {
        // Empty dropdown is fine
      }

      // Refresh summary now that query names are loaded in the dropdown
      const srcSelect = document.getElementById('prop-source');
      const currentSource = srcSelect ? srcSelect.value : source;
      this.updateDataSummary(currentSource, selectedId);
    }

    /* ─────────────────────────────────────────────
       Widget Deletion
    ───────────────────────────────────────────── */

    deleteSelectedWidget() {
      if (!confirm('Delete this widget?')) return;
      const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
      if (!dash) return;
      dash.widgets = dash.widgets.filter((w) => w.id !== this.selectedWidgetId);
      this.selectedWidgetId = null;

      const content = document.getElementById('properties-content');
      const placeholder = document.getElementById('properties-placeholder');
      if (content) content.style.display = 'none';
      if (placeholder) placeholder.style.display = '';

      this.markDirty();
      this.renderCanvas();
      this.renderSidebar();
    }

    /* ─────────────────────────────────────────────
       Top Bar Bindings
    ───────────────────────────────────────────── */

    bindTopBar() {
      const saveBtn = document.getElementById('save-btn');
      if (saveBtn) saveBtn.addEventListener('click', () => this.save());

      const discardBtn = document.getElementById('discard-btn');
      if (discardBtn) discardBtn.addEventListener('click', () => this.discard());
    }

    /* ─────────────────────────────────────────────
       Sidebar Action Bindings
    ───────────────────────────────────────────── */

    bindSidebarActions() {
      const newDashBtn = document.getElementById('new-dashboard-btn');
      const newDashForm = document.getElementById('new-dashboard-form');
      const cancelBtn = document.getElementById('cancel-new-dash-btn');
      const addWidgetBtn = document.getElementById('add-widget-btn');

      if (newDashBtn && newDashForm) {
        newDashBtn.addEventListener('click', () => {
          newDashForm.style.display = newDashForm.style.display === 'none' ? 'block' : 'none';
        });
      }

      if (cancelBtn && newDashForm) {
        cancelBtn.addEventListener('click', () => {
          newDashForm.style.display = 'none';
        });
      }

      // Icon picker
      const iconOpts = document.querySelectorAll('.icon-opt');
      iconOpts.forEach((opt) => {
        opt.addEventListener('click', () => {
          iconOpts.forEach((o) => o.classList.remove('selected'));
          opt.classList.add('selected');
        });
      });

      // New dashboard form submit
      if (newDashForm) {
        newDashForm.addEventListener('submit', async (e) => {
          e.preventDefault();

          const nameEl = document.getElementById('new-dash-name');
          const subtitleEl = document.getElementById('new-dash-subtitle');
          const colsEl = document.getElementById('new-dash-cols');
          const rowsEl = document.getElementById('new-dash-rows');
          const selectedIcon = document.querySelector('.icon-opt.selected');

          const name = nameEl ? nameEl.value.trim() : '';
          const subtitle = subtitleEl ? subtitleEl.value.trim() : '';
          const cols = parseInt(colsEl ? colsEl.value : '4') || 4;
          const rows = parseInt(rowsEl ? rowsEl.value : '2') || 2;
          const icon = selectedIcon ? selectedIcon.getAttribute('data-icon') : 'bolt';

          const id = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

          const newDash = {
            id,
            name,
            subtitle,
            icon,
            grid: { columns: cols, rows: rows, gap: 14 },
            widgets: [],
          };

          try {
            const res = await fetch('/api/dashboards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newDash),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({ message: res.statusText }));
              throw new Error(err.message || res.statusText);
            }

            await this.loadConfig();
            this.renderSidebar();
            newDashForm.style.display = 'none';
            newDashForm.reset();

            // Restore icon-opt selection after reset
            const firstIcon = document.querySelector('.icon-opt');
            if (firstIcon) {
              document.querySelectorAll('.icon-opt').forEach((o) => o.classList.remove('selected'));
              firstIcon.classList.add('selected');
            }

            const newIdx = this.modifiedConfig.dashboards.findIndex((d) => d.id === id);
            if (newIdx >= 0) this.selectDashboard(newIdx);
          } catch (err) {
            this.showToast('Error: ' + err.message, 'error');
          }
        });
      }

      // Add widget button
      if (addWidgetBtn) {
        addWidgetBtn.addEventListener('click', () => this.openWidgetPalette());
      }
    }

    /* ─────────────────────────────────────────────
       Collapsible Sections
    ───────────────────────────────────────────── */

    bindCollapsibles() {
      const headers = document.querySelectorAll('.sidebar-section-header.collapsible');
      headers.forEach((header) => {
        header.addEventListener('click', () => {
          const targetId = header.getAttribute('data-target');
          const content = document.getElementById(targetId);
          const chevron = header.querySelector('.collapse-arrow');
          if (!content) return;
          if (content.style.display === 'none') {
            content.style.display = 'block';
            if (chevron) chevron.textContent = '\u27C4';
          } else {
            content.style.display = 'none';
            if (chevron) chevron.textContent = '\u25B6';
          }
        });
      });
    }

    /* ─────────────────────────────────────────────
       Theme Swatches
    ───────────────────────────────────────────── */

    renderThemeSwatches() {
      const grid = document.getElementById('theme-swatches');
      if (!grid) return;

      if (!this.themes || this.themes.length === 0) {
        grid.textContent = 'No themes found';
        return;
      }

      grid.textContent = '';
      this.themes.forEach((theme) => {
        const swatch = document.createElement('div');
        swatch.className = 'theme-swatch';
        swatch.setAttribute('data-id', theme.id);

        // Color swatches
        const colors = document.createElement('div');
        colors.className = 'theme-swatch-colors';

        const colorKeys = ['background', 'primary', 'secondary'];
        colorKeys.forEach((key) => {
          const dot = document.createElement('div');
          dot.className = 'theme-swatch-dot';
          dot.style.backgroundColor = (theme.colors && theme.colors[key]) || '#333';
          colors.appendChild(dot);
        });

        // Theme name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'theme-swatch-name';
        nameSpan.textContent = theme.name;

        swatch.appendChild(colors);
        swatch.appendChild(nameSpan);

        swatch.addEventListener('click', () => this.applyTheme(theme.id));
        grid.appendChild(swatch);
      });
    }

    async applyTheme(themeId) {
      try {
        // Activate on server (persists to config)
        const res = await fetch('/api/themes/' + themeId + '/activate', { method: 'POST' });
        if (!res.ok) throw new Error(res.statusText);

        // Fetch full theme to get colors for live preview
        const themeRes = await fetch('/api/themes/' + encodeURIComponent(themeId));
        if (themeRes.ok) {
          const theme = await themeRes.json();
          this._applyThemeCss(theme);
        }

        // Toggle .active class on swatches
        document.querySelectorAll('.theme-swatch').forEach((s) => {
          s.classList.toggle('active', s.getAttribute('data-id') === themeId);
        });

        this.showToast('Theme applied — TV display will update on next load', 'success');
      } catch (e) {
        this.showToast('Theme error: ' + e.message, 'error');
      }
    }

    _applyThemeCss(theme) {
      const c = theme.colors || {};
      if (!c.background && !c.primary) return;

      const prev = document.getElementById('active-theme-vars');
      if (prev) prev.parentNode.removeChild(prev);

      const vars = [
        c.background ? '--bg: '          + c.background + ';' : '',
        c.background ? '--bg-surface: '  + c.background + ';' : '',
        c.primary    ? '--mh-pink: '     + c.primary    + ';' : '',
        c.primary    ? '--mh-hot-pink: ' + c.primary    + ';' : '',
        c.primary    ? '--accent: '      + c.primary    + ';' : '',
        c.secondary  ? '--cyan: '        + c.secondary  + ';' : '',
        c.text       ? '--t1: '          + c.text       + ';' : '',
      ].filter(Boolean).join('\n  ');

      if (!vars) return;
      const style = document.createElement('style');
      style.id = 'active-theme-vars';
      style.textContent = ':root {\n  ' + vars + '\n}';
      document.head.appendChild(style);
    }

    /* ─────────────────────────────────────────────
       Settings
    ───────────────────────────────────────────── */

    loadSettings() {
      const global = this.modifiedConfig && this.modifiedConfig.global;
      if (!global) return;

      const titleEl = document.getElementById('setting-title');
      const rotationEl = document.getElementById('setting-rotation');
      const refreshEl = document.getElementById('setting-refresh');

      if (titleEl) titleEl.value = global.title || '';
      if (rotationEl) rotationEl.value = global.rotation_interval !== undefined ? global.rotation_interval : '';
      if (refreshEl) refreshEl.value = global.refresh_interval !== undefined ? global.refresh_interval : '';
    }

    bindSettings() {
      const form = document.getElementById('settings-form');
      if (!form) return;

      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const titleEl = document.getElementById('setting-title');
        const rotationEl = document.getElementById('setting-rotation');
        const refreshEl = document.getElementById('setting-refresh');

        const title = titleEl ? titleEl.value.trim() : '';
        const rotation = parseInt(rotationEl ? rotationEl.value : '30') || 30;
        const refresh = parseInt(refreshEl ? refreshEl.value : '60') || 60;

        try {
          const res = await fetch('/api/config/global', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, rotation_interval: rotation, refresh_interval: refresh }),
          });
          if (!res.ok) throw new Error(res.statusText);
          this.showToast('Settings saved', 'success');
        } catch (_) {
          // Endpoint may not exist yet — update local state
          if (this.modifiedConfig && this.modifiedConfig.global) {
            this.modifiedConfig.global.title = title;
            this.modifiedConfig.global.rotation_interval = rotation;
            this.modifiedConfig.global.refresh_interval = refresh;
          }
          this.markDirty();
          this.showToast('Settings updated (save to persist)', 'success');
        }
      });
    }

    /* ─────────────────────────────────────────────
       Widget Palette Modal
    ───────────────────────────────────────────── */

    openWidgetPalette() {
      const TYPES = [
        { type: 'big-number',        icon: '\uD83D\uDD22', name: 'Big Number' },
        { type: 'stat-card',         icon: '\uD83D\uDCCA', name: 'Stat Card' },
        { type: 'gauge',             icon: '\u23F2',        name: 'Gauge' },
        { type: 'gauge-row',         icon: '\u25AD\u25AD', name: 'Gauge Row' },
        { type: 'bar-chart',         icon: '\uD83D\uDCF6', name: 'Bar Chart' },
        { type: 'progress-bar',      icon: '\u25AC',        name: 'Progress Bar' },
        { type: 'status-grid',       icon: '\u229E',        name: 'Status Grid' },
        { type: 'alert-list',        icon: '\uD83D\uDD14', name: 'Alert List' },
        { type: 'service-heatmap',   icon: '\uD83D\uDFE9', name: 'Heatmap' },
        { type: 'pipeline-flow',     icon: '\u2192',        name: 'Pipeline' },
        { type: 'usa-map',           icon: '\uD83D\uDDFA', name: 'USA Map' },
        { type: 'security-scorecard',icon: '\uD83D\uDEE1', name: 'Security' },
      ];

      const typeGrid = document.getElementById('palette-type-grid');
      const addForm = document.getElementById('add-widget-form');

      if (typeGrid) typeGrid.textContent = '';
      if (addForm) addForm.style.display = 'none';

      let selectedType = null;

      if (typeGrid) {
        TYPES.forEach((t) => {
          const card = document.createElement('div');
          card.className = 'palette-type-card';

          const iconEl = document.createElement('div');
          iconEl.className = 'palette-type-icon';
          iconEl.textContent = t.icon;

          const nameEl = document.createElement('div');
          nameEl.className = 'palette-type-name';
          nameEl.textContent = t.name;

          card.appendChild(iconEl);
          card.appendChild(nameEl);

          card.addEventListener('click', () => {
            // Remove selected from all cards
            typeGrid.querySelectorAll('.palette-type-card').forEach((c) => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedType = t;

            const selectedLabel = document.getElementById('palette-selected-type');
            if (selectedLabel) selectedLabel.textContent = t.name;

            if (addForm) addForm.style.display = 'flex';
            this.loadPaletteQueries('gcp');
          });

          typeGrid.appendChild(card);
        });
      }

      // Show modal
      const modal = document.getElementById('widget-palette-modal');
      if (modal) modal.style.display = 'flex';

      // Palette close button
      const closeBtn = document.getElementById('palette-close');
      if (closeBtn) {
        closeBtn.onclick = () => {
          if (modal) modal.style.display = 'none';
        };
      }

      // Back button
      const backBtn = document.getElementById('palette-back-btn');
      if (backBtn) {
        backBtn.onclick = () => {
          if (addForm) addForm.style.display = 'none';
          if (typeGrid) {
            typeGrid.querySelectorAll('.palette-type-card').forEach((c) => c.classList.remove('selected'));
          }
          selectedType = null;
        };
      }

      // Source change in palette
      const awSource = document.getElementById('aw-source');
      if (awSource) {
        awSource.onchange = () => this.loadPaletteQueries(awSource.value);
      }

      // Form submit — add widget
      if (addForm) {
        addForm.onsubmit = (e) => {
          e.preventDefault();
          if (!selectedType) return;

          const titleEl = document.getElementById('aw-title');
          const sourceEl = document.getElementById('aw-source');
          const queryEl = document.getElementById('aw-query');

          this.addWidget(
            selectedType.type,
            titleEl ? titleEl.value.trim() : '',
            sourceEl ? sourceEl.value : 'mock',
            queryEl ? queryEl.value : ''
          );

          if (modal) modal.style.display = 'none';
        };
      }
    }

    async loadPaletteQueries(source) {
      const sel = document.getElementById('aw-query');
      if (!sel) return;

      sel.textContent = '';
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '\u2014 select query \u2014';
      sel.appendChild(defaultOpt);

      try {
        const res = await fetch('/api/queries/' + source);
        const data = await res.json();
        const queries = data.queries || data;
        if (Array.isArray(queries)) {
          queries.forEach((q) => {
            const opt = document.createElement('option');
            opt.value = q.id;
            opt.textContent = q.name;
            sel.appendChild(opt);
          });
        }
      } catch (_) {
        // Empty dropdown is fine
      }
    }

    addWidget(type, title, source, queryId) {
      const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
      if (!dash) return;

      // Determine position
      let col = 1;
      let row = 1;
      if (dash.widgets && dash.widgets.length > 0) {
        const last = dash.widgets[dash.widgets.length - 1];
        const nextCol = (last.position.col || 1) + 1;
        if (nextCol > (dash.grid.columns || 4)) {
          col = 1;
          row = (last.position.row || 1) + 1;
        } else {
          col = nextCol;
          row = last.position.row || 1;
        }
      }

      const id = type + '-' + Date.now();
      const widget = {
        id,
        type,
        title: title || type,
        source: source || 'mock',
        queryId: queryId || '',
        position: { col, row, colSpan: 1, rowSpan: 1 },
      };

      if (!dash.widgets) dash.widgets = [];
      dash.widgets.push(widget);

      this.markDirty();
      this.renderCanvas();
      this.renderSidebar();
      this.showWidgetProps(id);
    }

    /* ─────────────────────────────────────────────
       Widget Palette Modal Bindings (called from init)
    ───────────────────────────────────────────── */

    bindWidgetPaletteModal() {
      const modal = document.getElementById('widget-palette-modal');
      const closeBtn = document.getElementById('palette-close');

      if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
          modal.style.display = 'none';
        });
      }

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
          modal.style.display = 'none';
        }
      });
    }

    /* ─────────────────────────────────────────────
       Sidebar Tabs
    ───────────────────────────────────────────── */

    bindSidebarTabs() {
      const tabs = document.querySelectorAll('.sidebar-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const name = tab.dataset.tab;
          document.querySelectorAll('.sidebar-panel').forEach(p => {
            p.style.display = p.id === 'panel-' + name ? 'flex' : 'none';
          });
          if (name === 'queries') this.renderQueryList();
          if (name === 'datasources') this.renderDatasourceList();
        });
      });
    }

    /* ─────────────────────────────────────────────
       Query List + Editor
    ───────────────────────────────────────────── */

    async renderQueryList() {
      const list = document.getElementById('query-list');
      if (!list) return;
      list.textContent = '';
      try {
        const res  = await fetch('/api/queries/');
        const data = await res.json();
        const all  = data.queries || {};
        const sources = Object.keys(all);
        if (!sources.length) {
          const empty = document.createElement('div');
          empty.className = 'mb-status';
          empty.textContent = 'No saved queries';
          list.appendChild(empty);
          return;
        }
        sources.forEach(source => {
          const queries = all[source] || [];
          const hdr = document.createElement('div');
          hdr.className = 'sidebar-section-header';
          hdr.textContent = source.toUpperCase();
          list.appendChild(hdr);
          queries.forEach(q => {
            const row = document.createElement('div');
            row.className = 'query-row';
            const nameEl = document.createElement('span');
            nameEl.className = 'query-row-name';
            nameEl.textContent = q.name;
            const badge = document.createElement('span');
            badge.className = 'query-row-badge';
            badge.textContent = source;
            row.appendChild(nameEl);
            row.appendChild(badge);
            row.addEventListener('click', () => this.openQueryEditor(q, source));
            list.appendChild(row);
          });
        });
      } catch (e) {
        this.showToast('Failed to load queries: ' + e.message, 'error');
      }
    }

    openQueryEditor(query, source) {
      // Show query editor, hide properties
      const props = document.getElementById('properties-placeholder');
      const content = document.getElementById('properties-content');
      const qe = document.getElementById('query-editor-panel');
      if (props)   props.style.display   = 'none';
      if (content) content.style.display = 'none';
      if (qe)      qe.style.display      = 'flex';

      this._activeQuery  = { ...query };
      this._activeSource = source;

      document.getElementById('qe-name').textContent         = query.name;
      document.getElementById('qe-source-badge').textContent = source;
      document.getElementById('qe-metric').value             = query.metricType || query.sql || '';
      document.getElementById('qe-time-window').value        = query.timeWindow || 60;
      document.getElementById('qe-aggregation').value        =
        (query.aggregation && query.aggregation.perSeriesAligner) || 'ALIGN_MEAN';

      this._bindQueryEditorActions();
    }

    _bindQueryEditorActions() {
      document.getElementById('qe-close').onclick = () => {
        document.getElementById('query-editor-panel').style.display = 'none';
        this.showDashboardProps();
      };

      document.getElementById('qe-run').onclick = () => this._runQuery();

      document.getElementById('qe-save').onclick = async () => {
        await this._saveQuery(false);
      };

      document.getElementById('qe-save-as-new').onclick = async () => {
        await this._saveQuery(true);
      };

      document.getElementById('qe-assign').onclick = () => {
        this._assignQueryToWidget();
      };
    }

    /* ─────────────────────────────────────────────
       Query Run / Save / Assign
    ───────────────────────────────────────────── */

    async _runQuery() {
      const runBtn    = document.getElementById('qe-run');
      const statusEl  = document.getElementById('qe-run-status');
      const bodyEl    = document.getElementById('qe-results-body');
      const source    = this._activeSource;
      const queryId   = this._activeQuery && this._activeQuery.id;

      runBtn.setAttribute('disabled', '');
      runBtn.textContent = 'Running\u2026';
      statusEl.textContent = '';
      bodyEl.textContent = '';

      const t0 = Date.now();
      try {
        // Build body from saved query fields — NOT just queryId
        const q    = this._activeQuery || {};
        const body = source === 'bigquery'
          ? { sql: q.sql }
          : source === 'gcp'
            ? { metric: q.metricType, metricType: q.metricType,
                project: q.project, timeWindow: q.timeWindow,
                aggregation: q.aggregation }
            : { queryId };

        const res = await fetch('/api/queries/' + source + '/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        const ms = Date.now() - t0;
        statusEl.textContent = ms + 'ms';

        if (!res.ok || !data.success) throw new Error(data.error || 'Query failed');

        // Render result rows
        const result = data.result || data.data || {};
        const entries = Object.entries(result).slice(0, 50);
        if (!entries.length) {
          const msg = document.createElement('div');
          msg.className = 'mb-status';
          msg.textContent = 'No data returned';
          bodyEl.appendChild(msg);
        } else {
          entries.forEach(([key, val]) => {
            const row = document.createElement('div');
            row.className = 'qe-result-row';
            const k = document.createElement('span');
            k.className   = 'qe-result-key';
            k.textContent = key;
            const v = document.createElement('span');
            v.className   = 'qe-result-value';
            v.textContent = typeof val === 'object' ? JSON.stringify(val) : String(val);
            row.appendChild(k);
            row.appendChild(v);
            bodyEl.appendChild(row);
          });
        }
      } catch (e) {
        statusEl.textContent = 'Error';
        statusEl.style.color = 'var(--red)';
        const err = document.createElement('div');
        err.style.color   = 'var(--red)';
        err.style.padding = '8px';
        err.style.fontFamily = 'var(--font-mono)';
        err.style.fontSize   = '11px';
        err.textContent = e.message;
        bodyEl.appendChild(err);
      } finally {
        runBtn.removeAttribute('disabled');
        runBtn.textContent = '\u25B6 Run';
      }
    }

    async _saveQuery(asNew) {
      const q      = this._activeQuery;
      const source = this._activeSource;
      if (!q) return;

      const metricOrSql = document.getElementById('qe-metric').value.trim();
      const timeWindow  = parseInt(document.getElementById('qe-time-window').value)  || 60;
      const aligner     = document.getElementById('qe-aggregation').value;

      const body = {
        id:   asNew ? (q.id + '-' + Date.now()) : q.id,
        name: asNew ? (q.name + ' (copy)') : q.name,
      };

      if (source === 'bigquery') {
        body.sql = metricOrSql;
      } else {
        body.metricType  = metricOrSql;
        body.timeWindow  = timeWindow;
        body.aggregation = { perSeriesAligner: aligner, crossSeriesReducer: 'REDUCE_MEAN' };
      }

      try {
        const url    = asNew ? ('/api/queries/' + source) : ('/api/queries/' + source + '/' + q.id);
        const method = asNew ? 'POST' : 'PUT';
        const res    = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error || res.statusText);
        this.showToast(asNew ? 'Saved as new query' : 'Query saved', 'success');
        this.renderQueryList();
      } catch (e) {
        this.showToast('Save failed: ' + e.message, 'error');
      }
    }

    _assignQueryToWidget() {
      const q      = this._activeQuery;
      const source = this._activeSource;
      if (!q || this.activeDashIdx < 0) return;

      // Dim canvas and highlight all widgets for selection
      const canvas = document.getElementById('studio-canvas');
      if (!canvas) return;
      canvas.classList.add('assign-mode');

      const widgets = canvas.querySelectorAll('.widget');
      widgets.forEach(card => {
        card.addEventListener('click', function handler(e) {
          e.stopPropagation();
          card.removeEventListener('click', handler);
          canvas.classList.remove('assign-mode');
          // Reset all card outlines
          canvas.querySelectorAll('.widget').forEach(c => c.style.outline = '2px solid transparent');

          const widgetId = card.dataset.widgetId;
          const dash = window.studio.modifiedConfig.dashboards[window.studio.activeDashIdx];
          const wc   = dash && dash.widgets.find(w => w.id === widgetId);
          if (wc) {
            wc.source  = source;
            wc.queryId = q.id;
            window.studio.markDirty();
            window.studio.renderCanvas();
            window.studio.showWidgetProps(widgetId);
            window.studio.showToast('Query assigned to ' + (wc.title || widgetId), 'success');
          }
        }, { once: true });
      });

      this.showToast('Click a widget to assign this query', 'info');
    }

    /* ─────────────────────────────────────────────
       Toast Notifications
    ───────────────────────────────────────────── */

    showToast(msg, type) {
      const toast = document.createElement('div');
      toast.className = 'studio-toast ' + (type || 'info');
      toast.textContent = msg;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
      }, 3000);
    }
  }

  /* ─────────────────────────────────────────────
     GCP Metric Browser
  ───────────────────────────────────────────── */

  // Human-friendly names for common GCP service namespaces
  const GCP_SERVICE_LABELS = {
    'run':                'Cloud Run',
    'bigquery':           'BigQuery',
    'pubsub':             'Pub/Sub',
    'compute':            'Compute Engine',
    'storage':            'Cloud Storage',
    'logging':            'Cloud Logging',
    'monitoring':         'Cloud Monitoring',
    'cloudsql':           'Cloud SQL',
    'kubernetes':         'Kubernetes',
    'container':          'GKE',
    'bigtable':           'Cloud Bigtable',
    'spanner':            'Cloud Spanner',
    'firestore':          'Firestore',
    'dataflow':           'Dataflow',
    'dataproc':           'Dataproc',
    'composer':           'Cloud Composer',
    'cloudfunctions':     'Cloud Functions',
    'appengine':          'App Engine',
    'loadbalancing':      'Load Balancing',
    'networking':         'Networking',
    'dns':                'Cloud DNS',
    'redis':              'Memorystore',
    'serviceruntime':     'API Usage',
    'custom':             'Custom Metrics',
    'agent':              'Ops Agent',
    'external':           'External',
  };

  // Priority order for the sidebar (most useful for MadHive first)
  const GCP_SERVICE_PRIORITY = [
    'run', 'bigquery', 'pubsub', 'storage', 'logging',
    'kubernetes', 'container', 'compute', 'bigtable',
    'cloudsql', 'spanner', 'dataflow', 'cloudfunctions',
    'appengine', 'monitoring', 'serviceruntime', 'custom',
  ];

  class MetricBrowser {
    constructor(studio) {
      this.studio         = studio;
      this.target         = null;
      this.allDescriptors = [];
      this.activeNs       = null;
      this.selected       = null;
      this._bindModal();
    }

    _bindModal() {
      const modal = document.getElementById('metric-browser-modal');
      document.getElementById('mb-close').addEventListener('click', () => this.close());
      modal.addEventListener('click', (e) => { if (e.target === modal) this.close(); });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display !== 'none') this.close();
      });
      document.getElementById('mb-project').addEventListener('change', () => this._load());
      document.getElementById('mb-search').addEventListener('input', () => {
        this.activeNs = null;
        document.querySelectorAll('.mb-svc-item').forEach(el => el.classList.remove('active'));
        this._filterAndRender();
      });
      document.getElementById('mb-apply').addEventListener('click', () => this._apply());
    }

    open(widgetConfig) {
      this.target   = widgetConfig;
      this.selected = null;
      this.activeNs = null;

      const projects = ['mad-master', 'mad-data', 'mad-audit', 'mad-looker-enterprise'];
      const sel = document.getElementById('mb-project');
      sel.textContent = '';
      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        sel.appendChild(opt);
      });

      document.getElementById('mb-search').value = '';
      document.getElementById('mb-config-panel').style.display = 'none';
      document.getElementById('mb-services').textContent = '';
      this._setStatus('Loading metrics\u2026');
      document.getElementById('metric-browser-modal').style.display = 'flex';
      this._load();
    }

    close() {
      document.getElementById('metric-browser-modal').style.display = 'none';
    }

    async _load() {
      const project = document.getElementById('mb-project').value;
      this._setStatus('Loading metrics\u2026');
      try {
        const res  = await fetch('/api/gcp/metrics/descriptors?project=' + encodeURIComponent(project));
        const data = await res.json();
        if (!data.success) throw new Error(data.hint || data.error);
        this.allDescriptors = data.descriptors || [];
        this._renderServiceSidebar();
        this._setStatus('Select a service or search to browse metrics');
      } catch (e) {
        this._setStatus('Error: ' + e.message);
      }
    }

    // Extract short service key from full GCP namespace (e.g. "run.googleapis.com" → "run")
    _svcKey(ns) {
      return ns.replace('.googleapis.com', '').replace('.google.com', '');
    }

    _renderServiceSidebar() {
      const container = document.getElementById('mb-services');
      container.textContent = '';

      // Build namespace → count map using short keys
      const counts = {};
      this.allDescriptors.forEach(d => {
        const ns = d.type.split('/')[0];
        const key = this._svcKey(ns);
        counts[key] = (counts[key] || 0) + 1;
      });

      // Render priority services first, then a divider, then the rest
      const priorityKeys = GCP_SERVICE_PRIORITY.filter(k => counts[k]);
      const otherKeys = Object.keys(counts)
        .filter(k => !GCP_SERVICE_PRIORITY.includes(k))
        .sort((a, b) => counts[b] - counts[a]);

      const addItem = (key, label) => {
        const item = document.createElement('div');
        item.className = 'mb-svc-item';
        const nameEl = document.createElement('span');
        nameEl.className = 'mb-svc-name';
        nameEl.textContent = label;
        const countEl = document.createElement('span');
        countEl.className = 'mb-svc-count';
        countEl.textContent = counts[key] || 0;
        item.appendChild(nameEl);
        item.appendChild(countEl);
        item.addEventListener('click', () => {
          document.querySelectorAll('.mb-svc-item').forEach(el => el.classList.remove('active'));
          item.classList.add('active');
          document.getElementById('mb-search').value = '';
          this.activeNs = key;
          this._filterAndRender();
        });
        container.appendChild(item);
      };

      priorityKeys.forEach(k => addItem(k, GCP_SERVICE_LABELS[k] || k));

      if (otherKeys.length) {
        const div = document.createElement('div');
        div.className = 'mb-svc-divider';
        div.textContent = 'Other Services';
        container.appendChild(div);
        otherKeys.forEach(k => addItem(k, GCP_SERVICE_LABELS[k] || k));
      }
    }

    _filterAndRender() {
      const q  = (document.getElementById('mb-search').value || '').toLowerCase();
      const ns = this.activeNs;
      const filtered = this.allDescriptors.filter(d => {
        const key = this._svcKey(d.type.split('/')[0]);
        if (ns && key !== ns) return false;
        if (q && !d.type.toLowerCase().includes(q) &&
                 !d.displayName.toLowerCase().includes(q) &&
                 !d.description.toLowerCase().includes(q)) return false;
        return true;
      });
      this._renderCards(filtered);
    }

    _renderCards(descriptors) {
      const list = document.getElementById('mb-list');
      list.textContent = '';
      if (!descriptors.length) { this._setStatus('No metrics match'); return; }

      // Limit render to 200 at a time for performance
      const toShow = descriptors.slice(0, 200);
      const frag = document.createDocumentFragment();

      toShow.forEach(d => {
        const card    = document.createElement('div');
        const header  = document.createElement('div');
        const nameEl  = document.createElement('span');
        const kindEl  = document.createElement('span');
        const typeEl  = document.createElement('div');
        const descEl  = document.createElement('div');

        card.className   = 'mb-card' + (this.selected && this.selected.type === d.type ? ' selected' : '');
        header.className = 'mb-card-header';
        nameEl.className = 'mb-card-name';
        kindEl.className = 'mb-card-kind';
        typeEl.className = 'mb-card-type';
        descEl.className = 'mb-card-desc';

        nameEl.textContent = d.displayName || d.type.split('/').pop();
        kindEl.textContent = d.metricKind || '';
        typeEl.textContent = d.type;
        descEl.textContent = d.description || '';

        header.appendChild(nameEl);
        if (d.metricKind) header.appendChild(kindEl);
        card.appendChild(header);
        card.appendChild(typeEl);
        if (d.description) card.appendChild(descEl);
        card.addEventListener('click', () => this._select(d, card));
        frag.appendChild(card);
      });

      list.appendChild(frag);

      if (descriptors.length > 200) {
        const more = document.createElement('div');
        more.className = 'mb-status';
        more.textContent = (descriptors.length - 200) + ' more — refine your search to see them';
        list.appendChild(more);
      }
    }

    _select(descriptor, cardEl) {
      document.querySelectorAll('#mb-list .mb-card').forEach(el => el.classList.remove('selected'));
      cardEl.classList.add('selected');
      this.selected = descriptor;
      document.getElementById('mb-sel-type').textContent = descriptor.type;
      document.getElementById('mb-sel-name').textContent = descriptor.displayName || descriptor.type.split('/').pop();
      document.getElementById('mb-config-panel').style.display = 'flex';
    }

    async _apply() {
      const wc = this.target, descriptor = this.selected;
      if (!wc || !descriptor) return;
      const project    = document.getElementById('mb-project').value;
      const timeWindow = parseInt(document.getElementById('mb-time-window').value) || 60;
      const aligner    = document.getElementById('mb-aggregation').value;
      const name       = descriptor.displayName || descriptor.type.split('/').pop();
      const id         = descriptor.type.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + Date.now();
      const applyBtn   = document.getElementById('mb-apply');
      applyBtn.textContent = 'Saving\u2026';
      applyBtn.setAttribute('disabled', '');
      try {
        const res = await fetch('/api/queries/gcp', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id, name, description: descriptor.description || '',
            metricType: descriptor.type, project, timeWindow,
            aggregation: { perSeriesAligner: aligner, crossSeriesReducer: 'REDUCE_MEAN' },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        const queryId = (data.query && data.query.id) || id;
        wc.queryId = queryId;
        wc.source  = 'gcp';
        this.studio.markDirty();
        this.studio.renderCanvas();
        this.studio.showWidgetProps(wc.id);
        this.close();
        this.studio.showToast('Metric applied: ' + name, 'success');
      } catch (e) {
        this.studio.showToast('Failed: ' + e.message, 'error');
      } finally {
        applyBtn.textContent = 'Apply to Widget';
        applyBtn.removeAttribute('disabled');
      }
    }

    /* ─────────────────────────────────────────────
       Data Source List + Editor
    ───────────────────────────────────────────── */

    async renderDatasourceList() {
      const list = document.getElementById('datasource-list');
      if (!list) return;
      list.textContent = '';
      try {
        const res  = await fetch('/api/data-sources');
        const data = await res.json();
        const sources = data.sources || [];
        if (!sources.length) {
          const empty = document.createElement('div');
          empty.className = 'mb-status';
          empty.textContent = 'No data sources configured';
          list.appendChild(empty);
          return;
        }
        sources.forEach(src => {
          const row  = document.createElement('div');
          row.className = 'ds-row';
          const dot  = document.createElement('span');
          dot.className = 'ds-status-dot ' + (src.isConnected ? 'green' : src.lastError ? 'red' : 'grey');
          const name = document.createElement('span');
          name.className   = 'ds-name';
          name.textContent = src.name;
          const type = document.createElement('span');
          type.className   = 'ds-type';
          type.textContent = src.isConnected ? 'connected' : (src.lastError ? 'error' : 'not configured');
          row.appendChild(dot);
          row.appendChild(name);
          row.appendChild(type);
          row.addEventListener('click', () => this.openDatasourceEditor(src));
          list.appendChild(row);
        });
      } catch (e) {
        this.showToast('Failed to load data sources: ' + e.message, 'error');
      }
    }

    async openDatasourceEditor(src) {
      const props   = document.getElementById('properties-placeholder');
      const content = document.getElementById('properties-content');
      const qe      = document.getElementById('query-editor-panel');
      const dse     = document.getElementById('datasource-editor-panel');
      [props, content, qe].forEach(el => { if (el) el.style.display = 'none'; });
      if (dse) dse.style.display = 'flex';

      document.getElementById('dse-name').textContent   = src.name;
      const statusEl = document.getElementById('dse-status');
      statusEl.textContent = src.isConnected ? 'connected' : 'not connected';
      statusEl.style.color = src.isConnected ? 'var(--green)' : 'var(--red)';

      // Load schema to know which fields to show
      const fieldsEl = document.getElementById('dse-fields');
      fieldsEl.textContent = '';
      try {
        const schemaRes  = await fetch('/api/data-sources/schemas');
        const schemaData = await schemaRes.json().catch(() => ({ schemas: {} }));
        // schemas is a dict keyed by source name; each value has .fields[]{name,secure,envVar}
        const schema = (schemaData.schemas && schemaData.schemas[src.name]) || { fields: [] };
        (schema.fields || []).forEach(field => {
          const label = document.createElement('label');
          label.className = 'qe-label';
          const titleEl = document.createTextNode(field.description || field.name);
          const input = document.createElement('input');
          input.className = 'qe-input';
          input.type = field.secure ? 'password' : 'text';
          input.dataset.field = field.name;
          input.dataset.envVar = field.envVar || '';
          input.placeholder = field.secure
            ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (stored)'
            : (field.default || '');
          label.appendChild(titleEl);
          label.appendChild(input);
          if (field.envVar) {
            const hint = document.createElement('div');
            hint.className   = 'props-hint';
            hint.textContent = 'env: ' + field.envVar;
            label.appendChild(hint);
          }
          fieldsEl.appendChild(label);
        });
      } catch (e) {
        const err = document.createElement('div');
        err.className   = 'mb-status';
        err.textContent = 'Schema unavailable';
        fieldsEl.appendChild(err);
      }

      document.getElementById('dse-close').onclick = () => {
        if (dse) dse.style.display = 'none';
        this.showDashboardProps();
      };

      document.getElementById('dse-test').onclick = async () => {
        const btn    = document.getElementById('dse-test');
        const result = document.getElementById('dse-test-result');
        btn.setAttribute('disabled', '');
        result.textContent = 'Testing\u2026';
        result.style.color = 'var(--t3)';
        const t0 = Date.now();
        try {
          const res  = await fetch('/api/data-sources/' + encodeURIComponent(src.name) + '/test', { method: 'POST' });
          const data = await res.json();
          const ms   = Date.now() - t0;
          if (data.connected || data.success) {
            result.textContent = '\u2713 Connected (' + ms + 'ms)';
            result.style.color = 'var(--green)';
          } else {
            result.textContent = '\u2717 Failed \u2014 ' + (data.error || 'Unknown error');
            result.style.color = 'var(--red)';
          }
        } catch (e) {
          result.textContent = '\u2717 ' + e.message;
          result.style.color = 'var(--red)';
        } finally {
          btn.removeAttribute('disabled');
        }
      };

    document.getElementById('dse-save').onclick = async () => {
      const saveBtn  = document.getElementById('dse-save');
      const resultEl = document.getElementById('dse-test-result');
      const inputs   = document.querySelectorAll('#dse-fields input[data-field]');

      const body = {};
      inputs.forEach(input => {
        if (input.value.trim() && input.dataset.envVar) {
          body[input.dataset.envVar] = input.value.trim();
        }
      });

      if (!Object.keys(body).length) {
        resultEl.textContent = 'No credentials entered';
        resultEl.style.color = 'var(--amber)';
        return;
      }

      saveBtn.setAttribute('disabled', '');
      resultEl.textContent = 'Saving\u2026';
      resultEl.style.color = 'var(--t3)';

      try {
        const res  = await fetch('/api/data-sources/' + encodeURIComponent(src.name) + '/credentials', {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
          resultEl.textContent = '\u2717 ' + (data.error || 'Save failed');
          resultEl.style.color = 'var(--red)';
          return;
        }

        if (data.connected) {
          resultEl.textContent = '\u2713 Saved and connected';
          resultEl.style.color = 'var(--green)';
        } else {
          resultEl.textContent = '\u2713 Saved \u2014 ' + (data.message || 'not yet connected');
          resultEl.style.color = 'var(--amber)';
        }

        inputs.forEach(input => {
          if (input.type === 'password') input.value = '';
        });

        this.renderDatasourceList();
      } catch (e) {
        resultEl.textContent = '\u2717 ' + e.message;
        resultEl.style.color = 'var(--red)';
      } finally {
        saveBtn.removeAttribute('disabled');
      }
    };
    }

    _setStatus(msg) {
      const list = document.getElementById('mb-list');
      list.textContent = '';
      const s = document.createElement('div');
      s.className = 'mb-status';
      s.textContent = msg;
      list.appendChild(s);
    }
  }

  /* ─────────────────────────────────────────────
     Boot
  ───────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    window.studio = new StudioApp();
    window.studio.init().catch(e => console.error('[studio] init failed:', e));
  });
})();
