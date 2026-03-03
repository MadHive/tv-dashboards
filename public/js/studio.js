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

        item.appendChild(name);
        item.appendChild(count);
        item.appendChild(delBtn);

        item.addEventListener('click', (e) => {
          if (e.target === delBtn) return;
          this.selectDashboard(i);
        });

        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteDashboard(i);
        });

        list.appendChild(item);
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

      this.loadQueryOptions(wc.source, wc.queryId);
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

      // Special: source change reloads queries
      const sourceEl = document.getElementById('prop-source');
      if (sourceEl) {
        sourceEl.onchange = async function () {
          wc.source = sourceEl.value;
          wc.queryId = '';
          await self.loadQueryOptions(wc.source, '');
          self.markDirty();
        };
      }

      // Special: query selection
      const queryEl = document.getElementById('prop-query');
      if (queryEl) {
        queryEl.onchange = function () {
          wc.queryId = queryEl.value;
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
        const res = await fetch('/api/themes/' + themeId + '/activate', { method: 'POST' });
        if (!res.ok) throw new Error(res.statusText);

        // Toggle .active class
        const swatches = document.querySelectorAll('.theme-swatch');
        swatches.forEach((s) => {
          s.classList.toggle('active', s.getAttribute('data-id') === themeId);
        });

        this.showToast('Theme applied', 'success');
      } catch (e) {
        this.showToast('Theme error: ' + e.message, 'error');
      }
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
       Toast Notifications
    ───────────────────────────────────────────── */

    showToast(msg, type) {
      type = type || 'info';

      const colorMap = {
        success: '#1a7a3a',
        error: '#7a1a1a',
        info: '#1a3a7a',
      };

      const toast = document.createElement('div');
      toast.style.cssText = [
        'position:fixed',
        'bottom:24px',
        'right:24px',
        'padding:12px 20px',
        'border-radius:6px',
        'background:' + (colorMap[type] || colorMap.info),
        'color:#fff',
        'font-family:Rajdhani,sans-serif',
        'font-size:14px',
        'font-weight:600',
        'z-index:9999',
        'pointer-events:none',
        'box-shadow:0 4px 16px rgba(0,0,0,0.5)',
        'transition:opacity 0.3s',
      ].join(';');

      toast.textContent = msg;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
      }, 3000);
    }
  }

  /* ─────────────────────────────────────────────
     Boot
  ───────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    window.studio = new StudioApp();
    window.studio.init();
  });
})();
