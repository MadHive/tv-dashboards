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
      this.selectedWidgetIds = new Set();
      this._widgetClipboard = [];
      this.isDirty = false;
      this.themes = [];
    }

    /* ─────────────────────────────────────────────
       Init
    ───────────────────────────────────────────── */

    async init() {
      try { this.metricBrowser = new MetricBrowser(this); } catch (e) { console.error('[studio] MetricBrowser init failed:', e); }
      try { this.queryExplorer = new window.QueryExplorer(this); } catch (e) { console.error('[studio] QueryExplorer init failed:', e); }
      await this.loadConfig();
      await this.loadThemes();
      this.renderSidebar();
      this.renderThemeSwatches();
      this.loadSettings();
      this.bindTopBar();
      this.bindSidebarActions();
      this.bindDashboardWizard();
      this.bindCollapsibles();
      this.bindSettings();
      this.bindWidgetPaletteModal();
      this.bindSidebarTabs();
      this.bindKeyboard();

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

      // Propagate clientBranding.logoImage to all usa-map-gl widget mglConfigs
      this.modifiedConfig.dashboards.forEach(dash => {
        const logoUrl = dash.clientBranding && dash.clientBranding.logoImage;
        if (!logoUrl) return;
        (dash.widgets || []).forEach(wc => {
          if (wc.type === 'usa-map-gl') {
            wc.mglConfig = Object.assign({}, wc.mglConfig || {}, { clientLogo: logoUrl });
          }
        });
      });

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

      // Search filter input (create once, preserve across re-renders)
      let searchWrap = document.getElementById('dash-search-wrap');
      if (!searchWrap) {
        searchWrap = document.createElement('div');
        searchWrap.id = 'dash-search-wrap';
        searchWrap.className = 'dash-search-wrap';
        const searchInput = document.createElement('input');
        searchInput.id = 'dash-search';
        searchInput.type = 'text';
        searchInput.className = 'dash-search-input';
        searchInput.placeholder = 'Filter dashboards\u2026';
        searchInput.addEventListener('input', () => this.renderSidebar());
        searchWrap.appendChild(searchInput);
        list.parentElement.insertBefore(searchWrap, list);
      }
      const filterText = (document.getElementById('dash-search')?.value || '').toLowerCase();

      const dashes = (this.modifiedConfig && this.modifiedConfig.dashboards) || [];
      dashes.forEach((dash, i) => {
        // Apply search filter
        if (filterText) {
          const haystack = (dash.name + ' ' + (dash.subtitle || '') + ' ' + (dash.id || '')).toLowerCase();
          if (!haystack.includes(filterText)) return;
        }

        const item = document.createElement('div');
        item.className = 'dashboard-nav-item'
          + (i === this.activeDashIdx ? ' active' : '')
          + (dash.excluded ? ' excluded' : '');
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

        const nameWrap = document.createElement('div');
        nameWrap.className = 'nav-name-wrap';

        const name = document.createElement('span');
        name.className = 'nav-name';
        name.textContent = dash.name;
        name.title = dash.name + (dash.subtitle ? ' — ' + dash.subtitle : '');
        nameWrap.appendChild(name);

        if (dash.subtitle) {
          const sub = document.createElement('span');
          sub.className = 'nav-subtitle';
          sub.textContent = dash.subtitle;
          nameWrap.appendChild(sub);
        }

        const count = document.createElement('span');
        count.className = 'nav-count';
        count.textContent = (dash.widgets ? dash.widgets.length : 0) + 'w';

        const delBtn = document.createElement('button');
        delBtn.className = 'nav-delete';
        delBtn.textContent = '\u2715';
        delBtn.title = 'Delete';

        const toggle = document.createElement('button');
        toggle.className = 'rot-toggle' + (dash.excluded ? ' rot-off' : '');
        toggle.title = dash.excluded ? 'Excluded from rotation' : 'In rotation';
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          dash.excluded = !dash.excluded;
          this.markDirty();
          this.renderSidebar();
        });

        const dupBtn = document.createElement('button');
        dupBtn.className = 'nav-duplicate';
        dupBtn.textContent = '\u29C9';
        dupBtn.title = 'Duplicate dashboard';
        dupBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.duplicateDashboard(dash.id, dash.name);
        });

        item.appendChild(handle);
        item.appendChild(thumb);
        item.appendChild(nameWrap);
        item.appendChild(count);
        item.appendChild(dupBtn);
        item.appendChild(toggle);
        item.appendChild(delBtn);

        item.addEventListener('click', (e) => {
          if (e.target === delBtn || e.target === dupBtn || e.target === handle) return;
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

      // Status counter
      let counter = document.getElementById('dash-rotation-count');
      if (!counter) {
        counter = document.createElement('div');
        counter.id = 'dash-rotation-count';
        counter.className = 'dash-rotation-count';
        list.parentElement.appendChild(counter);
      }
      const total    = dashes.length;
      const excluded = dashes.filter(d => d.excluded).length;
      const shown    = list.childElementCount;
      const filtered = filterText && shown < total;
      let label = `${total} dashboards`;
      if (excluded > 0) label += ` \u00b7 ${excluded} excluded`;
      if (filtered) label = `${shown} of ${total} shown`;
      counter.textContent = label;
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
      this.selectedWidgetIds = new Set();

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
      const widgetCount = (dash.widgets || []).length;
      const detail = widgetCount > 0
        ? `\n\nThis dashboard has ${widgetCount} widget${widgetCount > 1 ? 's' : ''} that will be permanently removed.`
        : '';
      if (!confirm(`Delete "${dash.name}"?${detail}`)) return;

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

      const title = document.createElement('div');
      title.textContent = 'Select a dashboard to edit';

      const steps = document.createElement('div');
      steps.className = 'canvas-onboard-steps';
      [
        'Pick a dashboard from the sidebar',
        'Click any widget to edit its properties',
        'Use + Add Widget to add new widgets',
      ].forEach((text, i) => {
        const step = document.createElement('div');
        step.className = 'canvas-onboard-step';
        const num = document.createElement('span');
        num.className = 'canvas-onboard-num';
        num.textContent = i + 1;
        const label = document.createElement('span');
        label.textContent = text;
        step.appendChild(num);
        step.appendChild(label);
        steps.appendChild(step);
      });

      placeholder.appendChild(title);
      placeholder.appendChild(steps);
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
      const multiProps = document.getElementById('multi-select-props');
      if (qe)  qe.style.display  = 'none';
      if (dse) dse.style.display = 'none';
      if (multiProps) multiProps.style.display = 'none';

      if (placeholder) placeholder.style.display = 'none';
      if (content) content.style.display = 'flex';
      if (dashProps) dashProps.style.display = 'block';
      if (widgetProps) widgetProps.style.display = 'none';

      // Breadcrumb: just "Dashboard"
      const bc = document.getElementById('props-breadcrumb');
      if (bc) {
        bc.style.display = 'flex';
        bc.textContent = '';
        const current = document.createElement('span');
        current.className = 'props-breadcrumb-current';
        current.textContent = 'Dashboard';
        bc.appendChild(current);
      }

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

      // Icon picker
      const iconGrid = document.getElementById('dash-icon-grid');
      if (iconGrid) {
        iconGrid.querySelectorAll('.dash-icon-opt').forEach(btn => {
          btn.classList.toggle('selected', btn.dataset.icon === (dash.icon || 'bolt'));
          btn.onclick = () => {
            iconGrid.querySelectorAll('.dash-icon-opt').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            this.applyDashboardProps();
          };
        });
      }

      // Rotation toggle (props panel)
      const rotBtn = document.getElementById('prop-dash-rotation');
      if (rotBtn) {
        rotBtn.className = 'rot-toggle' + (dash.excluded ? ' rot-off' : '');
        rotBtn.onclick = () => {
          dash.excluded = !dash.excluded;
          rotBtn.className = 'rot-toggle' + (dash.excluded ? ' rot-off' : '');
          this.markDirty();
          this.renderSidebar();
        };
      }

      // Branding
      const brand  = dash.clientBranding || {};
      const setVal = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
      setVal('prop-logo-url',    brand.logoImage || '');
      setVal('prop-logo-text',   brand.logoText  || '');
      setVal('prop-logo-sub',    brand.logoSub   || '');
      setVal('prop-color-bg',      brand.bg        || '#0E0320');
      setVal('prop-color-accent',  brand.accent    || '#FDA4D4');
      setVal('prop-color-bgcard',  brand.bgCard    || '#1A0B38');
      setVal('prop-color-border',  brand.border    || '#2E1860');
      setVal('prop-color-dot',     brand.dotColor  || '#2E1860');
      setVal('prop-color-surface', brand.bgSurface || '#160730');
      setVal('prop-color-borderlit',brand.borderLit|| '#4A2880');
      setVal('prop-color-t2',      brand.t2        || '#D0C4E4');
      setVal('prop-color-t3',      brand.t3        || '#8B75B0');

      // Logo preview
      const previewImg = document.getElementById('logo-preview-img');
      const logoPh     = document.getElementById('logo-drop-placeholder');
      if (previewImg && logoPh) {
        if (brand.logoImage) {
          previewImg.src = brand.logoImage;
          previewImg.style.display = '';
          logoPh.style.display = 'none';
        } else {
          previewImg.style.display = 'none';
          logoPh.style.display = '';
        }
      }

      // Logo file upload (bind once)
      const fileInput = document.getElementById('logo-file-input');
      const dropZone  = document.getElementById('logo-drop-zone');
      if (fileInput && !fileInput._bound) {
        fileInput._bound = true;
        fileInput.onchange = () => this._handleLogoUpload(fileInput.files[0]);
        if (dropZone) {
          dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
          dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
          dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const f = e.dataTransfer.files[0];
            if (f) this._handleLogoUpload(f);
          });
        }
      }

      // Bind branding inputs to applyDashboardProps
      ['prop-logo-url','prop-logo-text','prop-logo-sub',
       'prop-color-bg','prop-color-accent','prop-color-bgcard','prop-color-border','prop-color-dot',
       'prop-color-surface','prop-color-borderlit','prop-color-t2','prop-color-t3'
      ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = () => this.applyDashboardProps();
      });

      // Render widget inventory list
      this._renderWidgetList(dash);
    }

    _renderWidgetList(dash) {
      const list = document.getElementById('dash-widget-list');
      if (!list) return;
      list.textContent = '';

      const widgets = dash.widgets || [];
      if (widgets.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'dwl-empty';
        empty.textContent = 'No widgets yet — click + Add Widget';
        list.appendChild(empty);
        return;
      }

      // Widget type → icon map
      const ICONS = {
        'big-number': '🔢', 'stat-card': '📊', 'gauge': '⏲', 'gauge-row': '▭▭',
        'bar-chart': '📶', 'progress-bar': '▬', 'status-grid': '⊞', 'alert-list': '🔔',
        'service-heatmap': '🟩', 'pipeline-flow': '→', 'usa-map': '🗺', 'usa-map-gl': '🗺',
        'security-scorecard': '🛡', 'line-chart': '📈', 'table': '▦',
        'multi-metric-card': '⊠', 'stacked-bar-chart': '▐', 'sparkline': '≈',
        'donut-ring': '◎', 'globe': '🌍',
      };

      widgets.forEach(wc => {
        const item = document.createElement('div');
        item.className = 'dwl-item';
        if (wc.id === this.selectedWidgetId) item.classList.add('dwl-active');

        const icon = document.createElement('span');
        icon.className = 'dwl-icon';
        icon.textContent = ICONS[wc.type] || '◻';

        const name = document.createElement('span');
        name.className = 'dwl-name';
        name.textContent = wc.title || wc.type;
        name.title = wc.title || wc.type;

        const type = document.createElement('span');
        type.className = 'dwl-type';
        type.textContent = wc.type;

        item.appendChild(icon);
        item.appendChild(name);

        // Show warning if no data source
        if (!wc.queryId && !wc.query) {
          const warn = document.createElement('span');
          warn.className = 'dwl-no-data';
          warn.textContent = '⚠';
          warn.title = 'No data source assigned';
          item.appendChild(warn);
        }

        item.appendChild(type);

        item.addEventListener('click', () => {
          // Select this widget on the canvas + show its props
          this.selectedWidgetId = wc.id;
          this.selectedWidgetIds = new Set([wc.id]);
          this.renderCanvas();
          this.showWidgetProps(wc.id);
        });

        list.appendChild(item);
      });
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

      // Icon
      const iconGrid = document.getElementById('dash-icon-grid');
      const selIcon  = iconGrid && iconGrid.querySelector('.dash-icon-opt.selected');
      if (selIcon) dash.icon = selIcon.dataset.icon;

      // Branding
      if (!dash.clientBranding) dash.clientBranding = {};
      const gb = (id) => { const el = document.getElementById(id); return el ? (el.value || undefined) : undefined; };
      dash.clientBranding.logoImage = gb('prop-logo-url');
      dash.clientBranding.logoText  = gb('prop-logo-text');
      dash.clientBranding.logoSub   = gb('prop-logo-sub');
      dash.clientBranding.bg        = gb('prop-color-bg');
      dash.clientBranding.accent    = gb('prop-color-accent');
      dash.clientBranding.bgCard    = gb('prop-color-bgcard');
      dash.clientBranding.border    = gb('prop-color-border');
      dash.clientBranding.dotColor  = gb('prop-color-dot');

      // Live preview: apply brand colors immediately to the studio page
      this._previewBrandingInStudio(dash.clientBranding);

      this.markDirty();
      this.renderCanvas();
      this.renderSidebar();
    }

    _previewBrandingInStudio(brand) {
      const r = document.documentElement;
      if (brand && (brand.bg || brand.accent || brand.bgCard || brand.border || brand.dotColor)) {
        const set = (v, k) => v && r.style.setProperty(k, v);
        set(brand.bg,        '--bg');
        set(brand.bgCard,    '--bg-card');
        set(brand.bgCardAlt, '--bg-card-alt');
        set(brand.border,    '--border');
        set(brand.borderLit, '--border-lit');
        set(brand.accent,    '--accent');
        set(brand.dotColor,  '--dot-color');
        set(brand.bgSurface, '--bg-surface');
        set(brand.t2,        '--t2');
        set(brand.t3,        '--t3');
      } else {
        ['--bg','--bg-card','--bg-card-alt','--border','--border-lit','--accent','--dot-color']
          .forEach(v => r.style.removeProperty(v));
      }
    }

    async _handleLogoUpload(file) {
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res  = await fetch('/api/assets/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success && data.url) {
          const urlEl = document.getElementById('prop-logo-url');
          if (urlEl) { urlEl.value = data.url; urlEl.dispatchEvent(new Event('input')); }
          const previewImg = document.getElementById('logo-preview-img');
          const logoPh    = document.getElementById('logo-drop-placeholder');
          if (previewImg) { previewImg.src = data.url; previewImg.style.display = ''; }
          if (logoPh) logoPh.style.display = 'none';
        } else {
          alert('Upload failed: ' + (data.error || 'unknown error'));
        }
      } catch (err) {
        alert('Upload error: ' + err.message);
      }
    }

    /* ─────────────────────────────────────────────
       Query Picker Panel
    ───────────────────────────────────────────── */

    async showQueryPicker(wc) {
      const panel   = document.getElementById('query-picker-panel');
      const content = document.getElementById('properties-content');
      if (!panel || !content) return;

      content.style.display = 'none';
      panel.style.display   = 'flex';
      panel.style.flexDirection = 'column';

      const closeBtn = document.getElementById('qp-close');
      if (closeBtn) closeBtn.onclick = () => this._closeQueryPicker();

      let allQueries = [];
      try {
        const res     = await fetch('/api/queries/');
        const data    = await res.json();
        const grouped = data.queries || {};
        ['gcp', 'bigquery', 'computed', 'vulntrack'].forEach(src => {
          (grouped[src] || []).forEach(q => allQueries.push(Object.assign({}, q, { _source: src })));
        });
      } catch (_) { /* empty list is fine */ }

      const renderList = (filter) => {
        const list = document.getElementById('qp-list');
        if (!list) return;
        while (list.firstChild) list.removeChild(list.firstChild);

        const lower   = (filter || '').toLowerCase();
        const matches = allQueries.filter(q =>
          !lower
          || q.id.toLowerCase().includes(lower)
          || (q.name || '').toLowerCase().includes(lower)
          || (q.description || '').toLowerCase().includes(lower)
        );

        const sources = {};
        matches.forEach(q => {
          if (!sources[q._source]) sources[q._source] = [];
          sources[q._source].push(q);
        });

        Object.keys(sources).forEach(src => {
          const hdr = document.createElement('div');
          hdr.className   = 'qp-group-header';
          hdr.textContent = src.toUpperCase();
          list.appendChild(hdr);

          sources[src].forEach(q => {
            const row = document.createElement('div');
            row.className = 'qp-row' + (q.id === wc.queryId ? ' qp-row-selected' : '');

            const idEl = document.createElement('div');
            idEl.className   = 'qp-row-id';
            idEl.textContent = q.id;

            const nameEl = document.createElement('div');
            nameEl.className   = 'qp-row-name';
            nameEl.textContent = q.name || '';

            row.appendChild(idEl);
            row.appendChild(nameEl);

            row.addEventListener('click', () => {
              wc.queryId = q.id;
              wc.source  = q._source;
              this.markDirty();
              this._closeQueryPicker();
              this.showWidgetProps(wc.id);
            });
            list.appendChild(row);
          });
        });

        if (matches.length === 0) {
          const empty = document.createElement('div');
          empty.className   = 'qp-empty';
          empty.textContent = 'No queries match';
          list.appendChild(empty);
        }
      };

      renderList('');

      const searchEl = document.getElementById('qp-search');
      if (searchEl) {
        searchEl.value   = '';
        searchEl.oninput = () => renderList(searchEl.value);
        setTimeout(() => searchEl.focus(), 50);
      }
    }

    _closeQueryPicker() {
      const panel   = document.getElementById('query-picker-panel');
      const content = document.getElementById('properties-content');
      if (panel)   panel.style.display   = 'none';
      if (content) content.style.display = 'flex';
    }

    /* ─────────────────────────────────────────────
       Widget Properties Panel
    ───────────────────────────────────────────── */

    updateSectionVisibility(type) {
      const displaySection = document.getElementById('display-section');
      if (displaySection) {
        const showDisplayTypes = ['gauge', 'gauge-row', 'progress-bar', 'big-number', 'stat-card', 'line-chart', 'bar-chart'];
        displaySection.style.display = showDisplayTypes.includes(type) ? '' : 'none';
      }
      const mapSection = document.getElementById('map-config-section');
      if (mapSection) mapSection.style.display = type === 'usa-map' ? '' : 'none';
      const mglSection = document.getElementById('mgl-config-section');
      if (mglSection) mglSection.style.display = type === 'usa-map-gl' ? '' : 'none';
      const labelsSection = document.getElementById('labels-section');
      if (labelsSection) {
        const showLabelsTypes = ['bar-chart', 'line-chart', 'stacked-bar-chart', 'donut-ring', 'sankey', 'heatmap', 'treemap', 'pipeline-flow', 'multi-metric-card', 'status-grid', 'table'];
        labelsSection.style.display = showLabelsTypes.includes(type) ? '' : 'none';
      }
    }

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
      const multiProps = document.getElementById('multi-select-props');
      if (qe)  qe.style.display  = 'none';
      if (dse) dse.style.display = 'none';
      if (multiProps) multiProps.style.display = 'none';

      if (placeholder) placeholder.style.display = 'none';
      if (content) content.style.display = 'flex';
      if (dashProps) dashProps.style.display = 'none';
      if (widgetProps) widgetProps.style.display = 'block';

      // Breadcrumb: "Dashboard > Widget Title"
      const bc = document.getElementById('props-breadcrumb');
      if (bc) {
        bc.style.display = 'flex';
        bc.textContent = '';

        const link = document.createElement('button');
        link.className = 'props-breadcrumb-link';
        link.textContent = 'Dashboard';
        link.addEventListener('click', () => {
          this.selectedWidgetId = null;
          this.selectedWidgetIds = new Set();
          // Deselect on canvas
          document.querySelectorAll('.studio-canvas .widget').forEach(w => w.classList.remove('selected'));
          this.showDashboardProps();
        });

        const sep = document.createElement('span');
        sep.className = 'props-breadcrumb-sep';
        sep.textContent = '›';

        const current = document.createElement('span');
        current.className = 'props-breadcrumb-current';
        current.textContent = wc.title || wc.type || 'Widget';

        bc.appendChild(link);
        bc.appendChild(sep);
        bc.appendChild(current);
      }

      // Populate fields
      const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      };

      set('prop-title', wc.title || '');
      set('prop-subtitle', wc.subtitle || '');
      set('prop-format', wc.format || '');
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
      set('prop-x-label', wc.xLabel || '');
      set('prop-y-label', wc.yLabel || '');
      set('prop-legend', wc.legendLabels || '');
      if (wc.type === 'usa-map') {
        const mc = wc.mapConfig || {};
        set('prop-map-timewindow',     mc.timeWindow     !== undefined ? mc.timeWindow     : 7);
        set('prop-map-minimpressions', mc.minImpressions !== undefined ? mc.minImpressions : 100);
        set('prop-map-metric',         mc.metric         || 'impressions');
        set('prop-map-zoom',           mc.zoom           || 'on');
      }

      // Show/hide sections based on widget type
      this.updateSectionVisibility(wc.type);

      const mglSection = document.getElementById('mgl-config-section');
      if (mglSection) {
        if (wc.type === 'usa-map-gl') {
          const mgl = wc.mglConfig || {};
          set('prop-mgl-scheme',      mgl.colorScheme    || 'brand');
          set('prop-mgl-particles',   String(mgl.particleCount || 120));
          set('prop-mgl-speed',       String(mgl.particleSpeed  || 1.0));
          set('prop-mgl-leaderboard', String(mgl.showLeaderboard !== false));
          set('prop-mgl-mapstyle', mgl.mapStyle || 'brand');
          set('prop-mgl-zoomviz',  mgl.zoomViz  || 'dots');
          set('prop-mgl-logofit',   mgl.logoFit  || 'cover');
          const c = mgl.initialCenter;
          const centerLatEl = document.getElementById('prop-mgl-center-lat');
          const centerLngEl = document.getElementById('prop-mgl-center-lng');
          if (centerLatEl) centerLatEl.value = (c && c.lat != null) ? c.lat : '';
          if (centerLngEl) centerLngEl.value = (c && c.lng != null) ? c.lng : '';
          const pitchEl   = document.getElementById('prop-mgl-pitch');
          const bearingEl = document.getElementById('prop-mgl-bearing');
          if (pitchEl)   pitchEl.value   = (mgl.initialPitch   != null) ? mgl.initialPitch   : '';
          if (bearingEl) bearingEl.value = (mgl.initialBearing != null) ? mgl.initialBearing : '';
          // Region picker
          const regionGroup = document.getElementById('prop-region-group');
          if (regionGroup) {
            const currentRegion = (wc.mapConfig && wc.mapConfig.region) || '';
            regionGroup.querySelectorAll('.region-btn').forEach(btn =>
              btn.classList.toggle('selected', btn.dataset.region === currentRegion));
          }
          // Zoom slider
          const zoomSlider = document.getElementById('prop-mgl-zoom');
          const zoomVal    = document.getElementById('prop-mgl-zoom-val');
          if (zoomSlider) {
            const z = (wc.mglConfig && wc.mglConfig.initialZoom) || 4;
            zoomSlider.value = z;
            if (zoomVal) zoomVal.textContent = z;
          }
        }
      }

      // Populate query ID text input
      const queryEl = document.getElementById('prop-query');
      if (queryEl) queryEl.value = wc.queryId || '';
      this.updateDataSummary(wc.source || 'gcp', wc.queryId || '');
      // Always hide mismatch warning when selecting a widget (fresh state)
      const warningEl = document.getElementById('type-mismatch-warning');
      if (warningEl) warningEl.style.display = 'none';
      this.bindWidgetPropListeners(wc);
    }

    showMultiSelectProps() {
      const placeholder = document.getElementById('properties-placeholder');
      const content = document.getElementById('properties-content');
      const dashProps = document.getElementById('dashboard-props');
      const widgetProps = document.getElementById('widget-props');
      const qe  = document.getElementById('query-editor-panel');
      const dse = document.getElementById('datasource-editor-panel');
      const multiProps = document.getElementById('multi-select-props');
      if (qe)  qe.style.display  = 'none';
      if (dse) dse.style.display = 'none';
      if (placeholder) placeholder.style.display = 'none';
      if (content) content.style.display = 'flex';
      if (dashProps) dashProps.style.display = 'none';
      if (widgetProps) widgetProps.style.display = 'none';
      if (multiProps) { multiProps.style.display = 'block'; multiProps.textContent = ''; }

      const count = this.selectedWidgetIds.size;

      // Build multi-select panel using DOM, no innerHTML
      const container = document.createElement('div');
      container.style.padding = '16px';

      const header = document.createElement('h3');
      header.textContent = count + ' WIDGETS SELECTED';
      header.style.cssText = [
        'font-size:13px',
        'font-family:var(--font-display)',
        'font-weight:600',
        'letter-spacing:3px',
        'text-transform:uppercase',
        'color:var(--t1)',
        'margin:0 0 4px 0',
      ].join(';');

      const hint = document.createElement('p');
      hint.textContent = 'Ctrl+C to copy';
      hint.style.cssText = 'font-size:11px;font-family:var(--font-body);color:var(--t3);margin:0';

      container.appendChild(header);
      container.appendChild(hint);

      // Get selected widget configs
      const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
      const selectedWidgets = dash
        ? dash.widgets.filter(w => this.selectedWidgetIds.has(w.id))
        : [];

      // Source dropdown
      const sourceLabel = document.createElement('div');
      sourceLabel.textContent = 'SOURCE';
      sourceLabel.style.cssText = 'font-size:11px;font-family:var(--font-display);font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin:16px 0 4px 0';

      const sourceSelect = document.createElement('select');
      sourceSelect.style.cssText = 'width:100%;background:var(--bg-card);border:1px solid var(--border);border-radius:3px;color:var(--t1);font-size:12px;padding:4px 6px';
      ['gcp', 'bigquery', 'computed', 'vulntrack', 'mock'].forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        sourceSelect.appendChild(opt);
      });

      // Pre-select if all share same source
      var sourcesSet = new Set(selectedWidgets.map(w => w.source || 'gcp'));
      if (sourcesSet.size === 1) sourceSelect.value = Array.from(sourcesSet)[0];

      sourceSelect.onchange = () => {
        selectedWidgets.forEach(w => { w.source = sourceSelect.value; });
        this.markDirty();
      };

      // Type dropdown
      const typeLabel = document.createElement('div');
      typeLabel.textContent = 'TYPE';
      typeLabel.style.cssText = 'font-size:11px;font-family:var(--font-display);font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin:12px 0 4px 0';

      const typeSelect = document.createElement('select');
      typeSelect.style.cssText = 'width:100%;background:var(--bg-card);border:1px solid var(--border);border-radius:3px;color:var(--t1);font-size:12px;padding:4px 6px';
      [
        'big-number','stat-card','gauge','gauge-row','bar-chart','line-chart','stacked-bar-chart',
        'progress-bar','status-grid','alert-list','service-heatmap','pipeline-flow',
        'usa-map','usa-map-gl','security-scorecard','donut-ring','sankey','heatmap',
        'treemap','table','multi-metric-card','sparkline-grid','text-block',
      ].forEach(function (t) {
        var opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        typeSelect.appendChild(opt);
      });

      // Pre-select if all share same type
      var typesSet = new Set(selectedWidgets.map(w => w.type || 'big-number'));
      if (typesSet.size === 1) typeSelect.value = Array.from(typesSet)[0];

      typeSelect.onchange = () => {
        selectedWidgets.forEach(w => { w.type = typeSelect.value; });
        this.markDirty();
        this.renderCanvas();
      };

      container.appendChild(sourceLabel);
      container.appendChild(sourceSelect);
      container.appendChild(typeLabel);
      container.appendChild(typeSelect);

      // Populate the dedicated multi-select panel (preserves widget-props/dashboard-props DOM)
      if (multiProps) multiProps.appendChild(container);
    }

    _updateClipboardIndicator() {
      const footer = document.querySelector('.studio-canvas-footer');
      if (!footer) return;

      const existing = document.getElementById('clipboard-indicator');
      const n = this._widgetClipboard ? this._widgetClipboard.length : 0;

      if (n === 0) {
        if (existing) existing.parentNode.removeChild(existing);
        return;
      }

      var indicator = existing || document.createElement('span');
      indicator.id = 'clipboard-indicator';
      indicator.className = 'clipboard-indicator';
      indicator.textContent = n + ' widget' + (n !== 1 ? 's' : '') + ' copied \u2014 navigate to target dashboard, then Ctrl+V to paste';
      if (!existing) footer.insertBefore(indicator, footer.firstChild);
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
      bind('prop-subtitle', (v) => { wc.subtitle = v; });
      bind('prop-format', (v) => { wc.format = v; });
      bind('prop-x-label', (v) => { wc.xLabel = v; });
      bind('prop-y-label', (v) => { wc.yLabel = v; });
      bind('prop-legend', (v) => { wc.legendLabels = v; });
      bind('prop-type', (v) => {
        const oldType = wc.type;
        wc.type = v;

        // --- Config preservation/clearing ---
        // Clear map config when leaving usa-map
        if (oldType === 'usa-map' && v !== 'usa-map') {
          delete wc.mapConfig;
        }
        // Clear mgl config when leaving usa-map-gl
        if (oldType === 'usa-map-gl' && v !== 'usa-map-gl') {
          delete wc.mglConfig;
        }
        // Clear axis/legend labels when switching to a type that doesn't use them
        const labelsTypes = ['bar-chart', 'line-chart', 'stacked-bar-chart', 'donut-ring', 'sankey', 'heatmap', 'treemap', 'pipeline-flow', 'multi-metric-card', 'status-grid', 'table'];
        if (!labelsTypes.includes(v)) {
          delete wc.xLabel;
          delete wc.yLabel;
          delete wc.legendLabels;
          const xl = document.getElementById('prop-x-label');
          const yl = document.getElementById('prop-y-label');
          const lg = document.getElementById('prop-legend');
          if (xl) xl.value = '';
          if (yl) yl.value = '';
          if (lg) lg.value = '';
        }
        // Thresholds, unit, min, max, format — preserved across all types (no clearing)

        // --- Auto-match query / mismatch warning ---
        const warningEl = document.getElementById('type-mismatch-warning');
        if (wc.queryId && self.queries) {
          const sourceQueries = self.queries[wc.source || 'gcp'] || [];
          const found = sourceQueries.find(q => q.id === wc.queryId);
          if (!found && warningEl) {
            // Orphan query — can't verify compatibility
            warningEl.style.display = '';
          } else if (warningEl) {
            warningEl.style.display = 'none';
          }
        } else if (warningEl) {
          warningEl.style.display = 'none';
        }

        self.updateSectionVisibility(v);
        self.updateDataSummary(wc.source || 'gcp', wc.queryId || '');
      });
      bind('prop-col', (v) => {
        const desired = parseInt(v) || wc.position.col;
        const dash = self.modifiedConfig.dashboards[self.activeDashIdx];
        if (dash && window.StudioCanvas && window.StudioCanvas.snapToNearest) {
          const snapped = window.StudioCanvas.snapToNearest(
            dash, desired, wc.position.row,
            wc.position.colSpan || 1, wc.position.rowSpan || 1, wc.id
          );
          wc.position.col = snapped.col;
          wc.position.row = snapped.row;
          const colEl = document.getElementById('prop-col');
          if (colEl) colEl.value = wc.position.col;
          const rowEl = document.getElementById('prop-row');
          if (rowEl) rowEl.value = wc.position.row;
        } else {
          wc.position.col = desired;
        }
      });
      bind('prop-row', (v) => {
        const desired = parseInt(v) || wc.position.row;
        const dash = self.modifiedConfig.dashboards[self.activeDashIdx];
        if (dash && window.StudioCanvas && window.StudioCanvas.snapToNearest) {
          const snapped = window.StudioCanvas.snapToNearest(
            dash, wc.position.col, desired,
            wc.position.colSpan || 1, wc.position.rowSpan || 1, wc.id
          );
          wc.position.col = snapped.col;
          wc.position.row = snapped.row;
          const colEl = document.getElementById('prop-col');
          if (colEl) colEl.value = wc.position.col;
          const rowEl = document.getElementById('prop-row');
          if (rowEl) rowEl.value = wc.position.row;
        } else {
          wc.position.row = desired;
        }
      });
      bind('prop-colspan', (v) => {
        const desired = Math.max(1, parseInt(v) || 1);
        const dash = self.modifiedConfig.dashboards[self.activeDashIdx];
        if (dash && window.StudioCanvas && window.StudioCanvas.snapToNearest) {
          const snapped = window.StudioCanvas.snapToNearest(
            dash, wc.position.col, wc.position.row,
            desired, wc.position.rowSpan || 1, wc.id
          );
          wc.position.colSpan = desired;
          wc.position.col = snapped.col;
          wc.position.row = snapped.row;
          const colEl = document.getElementById('prop-col');
          if (colEl) colEl.value = wc.position.col;
          const rowEl = document.getElementById('prop-row');
          if (rowEl) rowEl.value = wc.position.row;
          const csEl = document.getElementById('prop-colspan');
          if (csEl) csEl.value = wc.position.colSpan;
        } else {
          wc.position.colSpan = desired;
        }
      });
      bind('prop-rowspan', (v) => {
        const desired = Math.max(1, parseInt(v) || 1);
        const dash = self.modifiedConfig.dashboards[self.activeDashIdx];
        if (dash && window.StudioCanvas && window.StudioCanvas.snapToNearest) {
          const snapped = window.StudioCanvas.snapToNearest(
            dash, wc.position.col, wc.position.row,
            wc.position.colSpan || 1, desired, wc.id
          );
          wc.position.rowSpan = desired;
          wc.position.col = snapped.col;
          wc.position.row = snapped.row;
          const colEl = document.getElementById('prop-col');
          if (colEl) colEl.value = wc.position.col;
          const rowEl = document.getElementById('prop-row');
          if (rowEl) rowEl.value = wc.position.row;
          const rsEl = document.getElementById('prop-rowspan');
          if (rsEl) rsEl.value = wc.position.rowSpan;
        } else {
          wc.position.rowSpan = desired;
        }
      });
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
          const qEl = document.getElementById('prop-query');
          if (qEl) qEl.value = '';
          self.updateDataSummary(wc.source, wc.queryId);
          self.markDirty();
        };
      }

      // Special: query ID text input + Browse button
      const queryEl   = document.getElementById('prop-query');
      const browseQueriesBtn = document.getElementById('browse-queries-btn');

      if (queryEl) {
        queryEl.oninput = () => {
          wc.queryId = queryEl.value.trim();
          this.updateDataSummary(wc.source || 'gcp', wc.queryId);
          this.markDirty();
        };
      }

      if (browseQueriesBtn) {
        browseQueriesBtn.onclick = () => this.showQueryPicker(wc);
      }

      // Delete widget button
      const deleteBtn = document.getElementById('delete-widget-btn');
      if (deleteBtn) {
        deleteBtn.onclick = () => this.deleteSelectedWidget();
      }

      // Widget management toolbar
      const dupWidget = document.getElementById('manage-dup-widget');
      if (dupWidget) {
        dupWidget.onclick = () => {
          if (!this.selectedWidgetId) return;
          const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
          if (!dash) return;
          const src = dash.widgets.find(w => w.id === this.selectedWidgetId);
          if (!src) return;
          const copy = JSON.parse(JSON.stringify(src));
          copy.id = src.type + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
          copy.title = (src.title || src.type) + ' (copy)';
          // Offset position so it doesn't overlap
          copy.position.col = Math.min(copy.position.col + 1, dash.grid.columns);
          dash.widgets.push(copy);
          this.markDirty();
          this.renderCanvas();
          this.showWidgetProps(copy.id);
          this.showToast('Widget duplicated', 'success');
        };
      }

      const moveUp = document.getElementById('manage-move-up');
      if (moveUp) {
        moveUp.onclick = () => {
          const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
          if (!dash || !this.selectedWidgetId) return;
          const idx = dash.widgets.findIndex(w => w.id === this.selectedWidgetId);
          if (idx <= 0) return;
          [dash.widgets[idx - 1], dash.widgets[idx]] = [dash.widgets[idx], dash.widgets[idx - 1]];
          this.markDirty();
          this.renderCanvas();
          this.showToast('Widget moved up', 'success');
        };
      }

      const moveDown = document.getElementById('manage-move-down');
      if (moveDown) {
        moveDown.onclick = () => {
          const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
          if (!dash || !this.selectedWidgetId) return;
          const idx = dash.widgets.findIndex(w => w.id === this.selectedWidgetId);
          if (idx < 0 || idx >= dash.widgets.length - 1) return;
          [dash.widgets[idx], dash.widgets[idx + 1]] = [dash.widgets[idx + 1], dash.widgets[idx]];
          this.markDirty();
          this.renderCanvas();
          this.showToast('Widget moved down', 'success');
        };
      }

      // Preview live data button
      const previewBtn = document.getElementById('preview-widget-data-btn');
      const previewPanel = document.getElementById('widget-data-preview');
      if (previewBtn && previewPanel) {
        previewBtn.onclick = async () => {
          const dash = self.modifiedConfig.dashboards[self.activeDashIdx];
          if (!dash) return;
          previewBtn.textContent = '\u23F3 Loading...';
          previewBtn.disabled = true;
          try {
            const res = await fetch('/api/metrics/' + dash.id);
            const all = await res.json();
            const data = all[wc.id];
            if (!data) {
              previewPanel.textContent = 'No data returned for this widget.';
              previewPanel.style.display = '';
              return;
            }
            previewPanel.textContent = '';
            previewPanel.style.display = '';
            const summary = document.createElement('div');
            summary.className = 'data-preview-summary';
            // Build a human-readable summary
            const entries = [];
            if (data.states)   entries.push('States: ' + Object.keys(data.states).length);
            if (data.hotspots) entries.push('Hotspots: ' + data.hotspots.length);
            if (data.totals)   entries.push('Impressions: ' + (data.totals.impressions || 0).toLocaleString());
            if (data.value !== undefined) entries.push('Value: ' + data.value);
            if (data.sparkline) entries.push('Sparkline: ' + data.sparkline.length + ' pts');
            if (entries.length === 0) entries.push('Data received (expand JSON below)');
            summary.textContent = entries.join('  \u00b7  ');
            const pre = document.createElement('pre');
            pre.className = 'data-preview-json';
            pre.textContent = JSON.stringify(data, null, 2).slice(0, 3000) + (JSON.stringify(data).length > 3000 ? '\n...(truncated)' : '');
            previewPanel.appendChild(summary);
            previewPanel.appendChild(pre);
          } catch (err) {
            previewPanel.textContent = 'Error: ' + err.message;
            previewPanel.style.display = '';
          } finally {
            previewBtn.textContent = '\u{1F50E} Preview Live Data';
            previewBtn.disabled = false;
          }
        };
      }

      // New query button — opens QueryExplorer modal for freestanding query creation
      const newQueryBtn = document.getElementById('new-query-btn');
      if (newQueryBtn) {
        newQueryBtn.onclick = () => {
          if (this.queryExplorer) {
            this.queryExplorer.open();
          } else {
            this.showToast('Query explorer not available', 'error');
          }
        };
      }

      // Build Query button — opens query editor pre-populated from this widget
      const buildQueryBtn = document.getElementById('build-query-btn');
      if (buildQueryBtn) {
        buildQueryBtn.onclick = () => {
          const widgetId = this.selectedWidgetId;
          if (!widgetId) return;
          const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
          const wc = dash && dash.widgets.find(w => w.id === widgetId);
          if (!wc) return;
          this._assignTargetWidgetId = widgetId;
          const query = {
            id: wc.queryId || '',
            name: wc.title || wc.queryId || 'New Query',
            metricType: wc.queryId || ''
          };
          const source = wc.source || 'gcp';
          this.openQueryEditor(query, source);
        };
      }

      // Map-specific config (usa-map type only)
      if (wc.type === 'usa-map') {
        function bindMap(id, applyFn) {
          const el = document.getElementById(id);
          if (!el) return;
          el.onchange = el.oninput = function() {
            if (!wc.mapConfig) wc.mapConfig = {};
            applyFn(el.value);
            self.markDirty();
          };
        }
        bindMap('prop-map-timewindow',     function(v) { wc.mapConfig.timeWindow = parseInt(v) || 7; });
        bindMap('prop-map-minimpressions', function(v) { wc.mapConfig.minImpressions = parseInt(v) || 0; });
        bindMap('prop-map-metric',         function(v) { wc.mapConfig.metric = v; });
        bindMap('prop-map-zoom',           function(v) { wc.mapConfig.zoom = v; });
      }
      bind('prop-mgl-scheme',      (v) => { wc.mglConfig = { ...(wc.mglConfig || {}), colorScheme: v }; });
      bind('prop-mgl-particles',   (v) => { wc.mglConfig = { ...(wc.mglConfig || {}), particleCount: parseInt(v, 10) }; });
      bind('prop-mgl-speed',       (v) => { wc.mglConfig = { ...(wc.mglConfig || {}), particleSpeed: parseFloat(v) }; });
      bind('prop-mgl-leaderboard', (v) => { wc.mglConfig = { ...(wc.mglConfig || {}), showLeaderboard: v === 'true' }; });
      bind('prop-mgl-mapstyle', (v) => { wc.mglConfig = { ...(wc.mglConfig || {}), mapStyle: v }; });
      bind('prop-mgl-zoomviz',  (v) => { wc.mglConfig = { ...(wc.mglConfig || {}), zoomViz: v }; });
      bind('prop-mgl-logofit',  (v) => { wc.mglConfig = { ...(wc.mglConfig || {}), logoFit: v }; });

      const bindCenter = () => {
        const lat = parseFloat(document.getElementById('prop-mgl-center-lat')?.value);
        const lng = parseFloat(document.getElementById('prop-mgl-center-lng')?.value);
        if (!isNaN(lat) && !isNaN(lng)) {
          wc.mglConfig = { ...(wc.mglConfig || {}), initialCenter: { lat, lng } };
        } else {
          const mc = Object.assign({}, wc.mglConfig || {});
          delete mc.initialCenter;
          wc.mglConfig = mc;
        }
        self.markDirty();
      };
      const cLatEl = document.getElementById('prop-mgl-center-lat');
      const cLngEl = document.getElementById('prop-mgl-center-lng');
      if (cLatEl) cLatEl.oninput = bindCenter;
      if (cLngEl) cLngEl.oninput = bindCenter;

      const pitchEl   = document.getElementById('prop-mgl-pitch');
      const bearingEl = document.getElementById('prop-mgl-bearing');
      if (pitchEl) pitchEl.oninput = () => {
        const v = parseFloat(pitchEl.value);
        wc.mglConfig = { ...(wc.mglConfig || {}), initialPitch: isNaN(v) ? null : Math.max(0, Math.min(60, v)) };
        self.markDirty();
      };
      if (bearingEl) bearingEl.oninput = () => {
        const v = parseFloat(bearingEl.value);
        wc.mglConfig = { ...(wc.mglConfig || {}), initialBearing: isNaN(v) ? null : v };
        self.markDirty();
      };
      const resetOverlayBtn = document.getElementById('reset-overlay-positions');
      if (resetOverlayBtn) {
        resetOverlayBtn.onclick = () => {
          if (wc.mglConfig) delete wc.mglConfig.overlayPositions;
          self.markDirty();
          self.renderCanvas();
        };
      }
      // Region buttons
      const regionGroup = document.getElementById('prop-region-group');
      if (regionGroup) {
        regionGroup.querySelectorAll('.region-btn').forEach(btn => {
          btn.onclick = () => {
            regionGroup.querySelectorAll('.region-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            if (!wc.mapConfig) wc.mapConfig = {};
            wc.mapConfig.region = btn.dataset.region || undefined;
            self.markDirty();
          };
        });
      }
      // Zoom slider
      const zoomSlider2 = document.getElementById('prop-mgl-zoom');
      const zoomVal2    = document.getElementById('prop-mgl-zoom-val');
      if (zoomSlider2) {
        zoomSlider2.oninput = () => {
          if (zoomVal2) zoomVal2.textContent = zoomSlider2.value;
          wc.mglConfig = Object.assign({}, wc.mglConfig || {}, { initialZoom: parseFloat(zoomSlider2.value) });
          self.markDirty();
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
        queryEl.textContent = queryId;
        queryEl.className   = 'data-summary-query';
      } else {
        queryEl.textContent = source === 'gcp' ? 'Built-in metrics (no saved query)' : 'No query selected';
        queryEl.className   = 'data-summary-query none';
      }
    }


    /* ─────────────────────────────────────────────
       Widget Deletion
    ───────────────────────────────────────────── */

    deleteSelectedWidget() {
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
      const addWidgetBtn = document.getElementById('add-widget-btn');

      // Open wizard on + button click
      if (newDashBtn) {
        newDashBtn.addEventListener('click', () => {
          this.openDashboardWizard();
        });
      }

      // Add widget button
      if (addWidgetBtn) {
        addWidgetBtn.addEventListener('click', () => this.openWidgetPalette());
      }
    }

    /* ─────────────────────────────────────────────
       Keyboard Shortcuts (Ctrl+C / Ctrl+V)
    ───────────────────────────────────────────── */

    bindKeyboard() {
      document.addEventListener('keydown', (e) => {
        // Do not intercept when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          e.preventDefault();
          this.handleCtrlC();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
          e.preventDefault();
          this.handleCtrlV();
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedWidgetId) {
          e.preventDefault();
          this.deleteSelectedWidget();
        }
        // Escape: deselect widget, return to dashboard props
        if (e.key === 'Escape' && this.selectedWidgetId) {
          e.preventDefault();
          this.selectedWidgetId = null;
          this.selectedWidgetIds = new Set();
          document.querySelectorAll('.studio-canvas .widget').forEach(w => w.classList.remove('selected'));
          this.renderCanvas();
          this.showDashboardProps();
        }
      });

      // Cmd/Ctrl+S: save (global, including when in inputs)
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          const saveBtn = document.getElementById('save-btn');
          if (saveBtn && !saveBtn.disabled) saveBtn.click();
        }
      });
    }

    handleCtrlC() {
      if (!this.selectedWidgetIds || this.selectedWidgetIds.size === 0) return;
      const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
      if (!dash) return;
      this._widgetClipboard = [...this.selectedWidgetIds]
        .map(id => dash.widgets.find(w => w.id === id))
        .filter(Boolean)
        .map(w => JSON.parse(JSON.stringify(w)));
      this._updateClipboardIndicator();
    }

    handleCtrlV() {
      if (!this._widgetClipboard || this._widgetClipboard.length === 0) return;
      const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
      if (!dash) return;
      if (!dash.widgets) dash.widgets = [];

      const pastedIds = [];
      let placementFailed = 0;

      this._widgetClipboard.forEach(w => {
        const clone = JSON.parse(JSON.stringify(w));
        clone.id = clone.type + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

        // Try original position first, then snap to nearest collision-free slot
        const snapped = window.StudioCanvas && window.StudioCanvas.snapToNearest
          ? window.StudioCanvas.snapToNearest(
              dash,
              clone.position.col,
              clone.position.row,
              clone.position.colSpan || 1,
              clone.position.rowSpan || 1,
              null
            )
          : { col: clone.position.col, row: clone.position.row };

        // Check if there is still a collision after snapping
        if (window.StudioCanvas && window.StudioCanvas.hasCollision &&
            window.StudioCanvas.hasCollision(dash, snapped.col, snapped.row, clone.position.colSpan || 1, clone.position.rowSpan || 1, clone.id)) {
          placementFailed++;
        }
        clone.position.col = snapped.col;
        clone.position.row = snapped.row;
        dash.widgets.push(clone);
        pastedIds.push(clone.id);
      });

      // Clear clipboard (one-shot paste)
      this._widgetClipboard = [];

      // Select pasted widgets
      this.selectedWidgetIds = new Set(pastedIds);
      this.selectedWidgetId = pastedIds.length === 1 ? pastedIds[0] : null;

      this.markDirty();
      this.renderCanvas();
      this._updateClipboardIndicator();

      if (placementFailed > 0 && placementFailed === pastedIds.length) {
        this.showToast('Paste failed -- dashboard may be full', 'error');
      } else {
        this.showToast(pastedIds.length + ' widget(s) pasted', 'success');
      }

      if (pastedIds.length >= 2) {
        this.showMultiSelectProps();
      } else if (pastedIds.length === 1) {
        this.showWidgetProps(pastedIds[0]);
      }
    }

    /* ─────────────────────────────────────────────
       Dashboard Creation Wizard
    ───────────────────────────────────────────── */

    openDashboardWizard() {
      const modal = document.getElementById('dashboard-wizard-modal');
      if (!modal) return;

      // Show modal
      modal.style.display = 'flex';

      // Reset to step 0
      const step0 = document.getElementById('wizard-step-0');
      const step1 = document.getElementById('wizard-step-1');
      const step2 = document.getElementById('wizard-step-2');
      if (step0) step0.style.display = '';
      if (step1) step1.style.display = 'none';
      if (step2) step2.style.display = 'none';

      // Reset step indicator
      const stepEls = modal.querySelectorAll('.wizard-step');
      stepEls.forEach((s, idx) => {
        s.classList.remove('active', 'completed');
        if (idx === 0) s.classList.add('active');
      });

      // Reset form fields
      const nameEl = document.getElementById('wiz-dash-name');
      const subtitleEl = document.getElementById('wiz-dash-subtitle');
      const colsEl = document.getElementById('wiz-dash-cols');
      const rowsEl = document.getElementById('wiz-dash-rows');
      if (nameEl) nameEl.value = '';
      if (subtitleEl) subtitleEl.value = '';
      if (colsEl) colsEl.value = '4';
      if (rowsEl) rowsEl.value = '3';

      // Reset icon selection
      const wizIconOpts = modal.querySelectorAll('.wizard-icon-opt');
      wizIconOpts.forEach((o, idx) => o.classList.toggle('selected', idx === 0));

      // Clear widget tile selections
      modal.querySelectorAll('.wizard-type-tile').forEach((t) => t.classList.remove('selected'));

      // Reset start mode
      modal.querySelectorAll('.wiz-start-card').forEach((c, i) => c.classList.toggle('selected', i === 0));
      const picker = document.getElementById('wiz-template-picker');
      if (picker) picker.style.display = 'none';

      // Reset footer nav
      const nextBtn = document.getElementById('wizard-next-btn');
      const backBtn = document.getElementById('wizard-back-btn');
      if (nextBtn) nextBtn.textContent = 'Next';
      if (backBtn) backBtn.style.display = 'none';

      // Clear template selection
      modal._wizardStep = 0;
      modal._selectedTemplate = null;
      modal._startMode = 'blank';

      // Load templates in background
      this._loadWizardTemplates();
    }

    async _loadWizardTemplates() {
      const picker = document.getElementById('wiz-template-picker');
      if (!picker) return;

      try {
        const res = await fetch('/api/templates');
        const data = await res.json();
        const templates = data.templates || data || [];

        // Filter to real templates (skip test ones)
        const real = templates.filter(t =>
          t.name && !t.name.toLowerCase().includes('test') && !t.name.toLowerCase().includes('update')
        );

        if (real.length === 0) {
          picker.innerHTML = '';
          const empty = document.createElement('div');
          empty.className = 'wiz-template-loading';
          empty.textContent = 'No templates available';
          picker.appendChild(empty);
          return;
        }

        picker.textContent = '';

        // Group by category
        const byCategory = {};
        real.forEach(t => {
          const cat = t.category || 'Other';
          if (!byCategory[cat]) byCategory[cat] = [];
          byCategory[cat].push(t);
        });

        for (const [, tpls] of Object.entries(byCategory)) {
          tpls.forEach(t => {
            const card = document.createElement('div');
            card.className = 'wiz-tpl-card';

            const name = document.createElement('div');
            name.className = 'wiz-tpl-name';
            name.textContent = t.name;

            const desc = document.createElement('div');
            desc.className = 'wiz-tpl-desc';
            desc.textContent = t.description || '';

            const meta = document.createElement('div');
            meta.className = 'wiz-tpl-meta';

            if (t.category) {
              const badge = document.createElement('span');
              badge.className = 'wiz-tpl-badge';
              badge.textContent = t.category;
              meta.appendChild(badge);
            }

            const widgetCount = t.dashboard && t.dashboard.widgets ? t.dashboard.widgets.length : 0;
            if (widgetCount > 0) {
              const wc = document.createElement('span');
              wc.textContent = widgetCount + ' widgets';
              meta.appendChild(wc);
            }

            card.append(name, desc, meta);

            card.addEventListener('click', () => {
              picker.querySelectorAll('.wiz-tpl-card').forEach(c => c.classList.remove('selected'));
              card.classList.add('selected');
              const modal = document.getElementById('dashboard-wizard-modal');
              if (modal) modal._selectedTemplate = t;
            });

            picker.appendChild(card);
          });
        }
      } catch (_) {
        if (picker) {
          picker.textContent = '';
          const err = document.createElement('div');
          err.className = 'wiz-template-loading';
          err.textContent = 'Failed to load templates';
          picker.appendChild(err);
        }
      }
    }

    closeWizard() {
      const modal = document.getElementById('dashboard-wizard-modal');
      if (modal) modal.style.display = 'none';
    }

    _wizardShowStep(stepNum) {
      const modal = document.getElementById('dashboard-wizard-modal');
      if (!modal) return;

      const step0 = document.getElementById('wizard-step-0');
      const step1 = document.getElementById('wizard-step-1');
      const step2 = document.getElementById('wizard-step-2');
      if (step0) step0.style.display = stepNum === 0 ? '' : 'none';
      if (step1) step1.style.display = stepNum === 1 ? '' : 'none';
      if (step2) step2.style.display = stepNum === 2 ? '' : 'none';

      const stepEls = modal.querySelectorAll('.wizard-step');
      stepEls.forEach((s, idx) => {
        s.classList.remove('active', 'completed');
        if (idx < stepNum) s.classList.add('completed');
        if (idx === stepNum) s.classList.add('active');
      });

      const nextBtn = document.getElementById('wizard-next-btn');
      const backBtn = document.getElementById('wizard-back-btn');

      if (stepNum === 0) {
        if (nextBtn) nextBtn.textContent = 'Next';
        if (backBtn) backBtn.style.display = 'none';
      } else if (stepNum === 1) {
        if (nextBtn) nextBtn.textContent = modal._startMode === 'template' ? 'Create Dashboard' : 'Next';
        if (backBtn) backBtn.style.display = '';
      } else {
        if (nextBtn) nextBtn.textContent = 'Create Dashboard';
        if (backBtn) backBtn.style.display = '';
      }

      modal._wizardStep = stepNum;

      if (stepNum === 1) {
        const nameEl = document.getElementById('wiz-dash-name');
        if (nameEl) setTimeout(() => nameEl.focus(), 50);
      }
    }

    wizardNext() {
      const modal = document.getElementById('dashboard-wizard-modal');
      if (!modal) return;
      const step = modal._wizardStep || 0;

      if (step === 0) {
        // Step 0 -> validate selection
        if (modal._startMode === 'template') {
          if (!modal._selectedTemplate) {
            this.showToast('Select a template first', 'error');
            return;
          }
          // Pre-fill from template
          const t = modal._selectedTemplate;
          const d = t.dashboard || {};
          const nameEl = document.getElementById('wiz-dash-name');
          const subtitleEl = document.getElementById('wiz-dash-subtitle');
          const colsEl = document.getElementById('wiz-dash-cols');
          const rowsEl = document.getElementById('wiz-dash-rows');
          if (nameEl) nameEl.value = d.name || t.name || '';
          if (subtitleEl) subtitleEl.value = '';
          if (colsEl) colsEl.value = d.gridColumns || d.grid?.columns || 4;
          if (rowsEl) rowsEl.value = d.gridRows || d.grid?.rows || 3;

          // Select icon
          if (d.icon) {
            modal.querySelectorAll('.wizard-icon-opt').forEach(o => {
              o.classList.toggle('selected', o.getAttribute('data-icon') === d.icon);
            });
          }
        }
        this._wizardShowStep(1);

      } else if (step === 1) {
        // Validate name
        const nameEl = document.getElementById('wiz-dash-name');
        const name = nameEl ? nameEl.value.trim() : '';
        if (!name) {
          if (nameEl) {
            nameEl.style.borderColor = '#ff4444';
            setTimeout(() => { nameEl.style.borderColor = ''; }, 600);
          }
          return;
        }

        if (modal._startMode === 'template') {
          // Template mode: skip widget picker, create directly
          this.wizardCreate();
        } else {
          // Blank mode: go to widget picker
          this._wizardShowStep(2);
        }

      } else {
        // Step 2 -> create
        this.wizardCreate();
      }
    }

    wizardBack() {
      const modal = document.getElementById('dashboard-wizard-modal');
      if (!modal) return;
      const step = modal._wizardStep || 0;

      if (step === 2) {
        this._wizardShowStep(1);
      } else if (step === 1) {
        this._wizardShowStep(0);
      }
    }

    async wizardCreate() {
      const modal = document.getElementById('dashboard-wizard-modal');
      if (!modal) return;

      const nameEl = document.getElementById('wiz-dash-name');
      const subtitleEl = document.getElementById('wiz-dash-subtitle');
      const colsEl = document.getElementById('wiz-dash-cols');
      const rowsEl = document.getElementById('wiz-dash-rows');
      const selectedIconEl = modal.querySelector('.wizard-icon-opt.selected');

      const name = nameEl ? nameEl.value.trim() : '';
      const subtitle = subtitleEl ? subtitleEl.value.trim() : '';
      const cols = parseInt(colsEl ? colsEl.value : '4') || 4;
      const rows = parseInt(rowsEl ? rowsEl.value : '3') || 3;
      const icon = selectedIconEl ? selectedIconEl.getAttribute('data-icon') : 'bolt';

      let widgets = [];

      if (modal._startMode === 'template' && modal._selectedTemplate) {
        // Use template widgets
        const tplDash = modal._selectedTemplate.dashboard || {};
        const tplWidgets = tplDash.widgets || [];
        widgets = tplWidgets.map(w => ({
          ...w,
          id: (w.type || 'widget') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        }));
      } else {
        // Gather selected widget types from tiles
        const selectedTiles = modal.querySelectorAll('.wizard-type-tile.selected');
        let col = 1;
        let row = 1;
        selectedTiles.forEach((tile) => {
          const type = tile.getAttribute('data-type');
          const id = type + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
          widgets.push({
            id,
            type,
            title: '',
            position: { col, row, colSpan: 1, rowSpan: 1 },
          });
          col++;
          if (col > cols) { col = 1; row++; }
        });
      }

      const dashId = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const newDash = {
        id: dashId,
        name,
        subtitle,
        icon,
        grid: { columns: cols, rows, gap: 14 },
        widgets,
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
        const created = await res.json();

        await this.loadConfig();
        this.renderSidebar();

        const newIdx = this.modifiedConfig.dashboards.findIndex(
          (d) => d.id === (created.dashboard ? created.dashboard.id : dashId)
        );
        if (newIdx >= 0) this.selectDashboard(newIdx);

        this.closeWizard();
        this.showToast('Dashboard created', 'success');
      } catch (err) {
        this.showToast('Failed to create dashboard: ' + err.message, 'error');
      }
    }

    bindDashboardWizard() {
      const modal = document.getElementById('dashboard-wizard-modal');
      if (!modal) return;

      // Close button
      const closeBtn = document.getElementById('wizard-close');
      if (closeBtn) closeBtn.addEventListener('click', () => this.closeWizard());

      // Backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeWizard();
      });

      // Next/create button
      const nextBtn = document.getElementById('wizard-next-btn');
      if (nextBtn) nextBtn.addEventListener('click', () => this.wizardNext());

      // Back button
      const backBtn = document.getElementById('wizard-back-btn');
      if (backBtn) backBtn.addEventListener('click', () => this.wizardBack());

      // Step 0: Blank vs Template start cards
      modal.querySelectorAll('.wiz-start-card').forEach(card => {
        card.addEventListener('click', () => {
          modal.querySelectorAll('.wiz-start-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          const mode = card.getAttribute('data-start');
          modal._startMode = mode;

          const picker = document.getElementById('wiz-template-picker');
          if (picker) picker.style.display = mode === 'template' ? '' : 'none';

          // Clear template selection when switching back to blank
          if (mode === 'blank') modal._selectedTemplate = null;
        });
      });

      // Wizard icon picker
      modal.addEventListener('click', (e) => {
        const iconOpt = e.target.closest('.wizard-icon-opt');
        if (iconOpt) {
          modal.querySelectorAll('.wizard-icon-opt').forEach((o) => o.classList.remove('selected'));
          iconOpt.classList.add('selected');
        }
      });

      // Widget type tile selection
      modal.addEventListener('click', (e) => {
        const tile = e.target.closest('.wizard-type-tile');
        if (tile) tile.classList.toggle('selected');
      });

      // Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display !== 'none') {
          this.closeWizard();
        }
      });
    }

    /* ─────────────────────────────────────────────
       Dashboard Duplication
    ───────────────────────────────────────────── */

    async duplicateDashboard(dashId, originalName) {
      try {
        const res = await fetch('/api/dashboards/' + dashId + '/duplicate', { method: 'POST' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: res.statusText }));
          throw new Error(err.message || res.statusText);
        }
        const newDash = await res.json();

        await this.loadConfig();
        this.renderSidebar();

        const newIdx = this.modifiedConfig.dashboards.findIndex(
          (d) => d.id === (newDash.dashboard ? newDash.dashboard.id : newDash.id)
        );
        if (newIdx < 0) return;

        // Override server name with "Copy of [original]" per user decision
        const copyName = 'Copy of ' + originalName;
        this.modifiedConfig.dashboards[newIdx].name = copyName;
        this.markDirty();

        this.selectDashboard(newIdx);
        this.showToast('Dashboard duplicated — rename it above', 'success');

        // Trigger inline rename on the new nav item
        const navItems = document.querySelectorAll('.dashboard-nav-item');
        const newItem = navItems[newIdx];
        if (!newItem) return;

        const nameSpan = newItem.querySelector('.nav-name');
        if (!nameSpan) return;

        const input = document.createElement('input');
        input.className = 'nav-name-edit';
        input.value = copyName;
        nameSpan.replaceWith(input);
        input.focus();
        input.select();

        const commitRename = () => {
          const val = input.value.trim() || copyName;
          this.modifiedConfig.dashboards[newIdx].name = val;
          this.markDirty();
          const newSpan = document.createElement('span');
          newSpan.className = 'nav-name';
          newSpan.textContent = val;
          input.replaceWith(newSpan);
        };

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitRename();
          }
          if (e.key === 'Escape') {
            const revertSpan = document.createElement('span');
            revertSpan.className = 'nav-name';
            revertSpan.textContent = copyName;
            input.replaceWith(revertSpan);
          }
        });
        input.addEventListener('blur', () => {
          // Only commit if still in DOM (not already replaced by Escape)
          if (input.parentNode) commitRename();
        });
      } catch (err) {
        this.showToast('Duplication failed — try again', 'error');
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
        { type: 'big-number',        icon: '\uD83D\uDD22', name: 'Big Number',       desc: 'Single large metric value with trend arrow' },
        { type: 'stat-card',         icon: '\uD83D\uDCCA', name: 'Stat Card',        desc: 'Metric with status, detail text, and trend' },
        { type: 'gauge',             icon: '\u23F2',        name: 'Gauge',            desc: 'Circular gauge with min/max thresholds' },
        { type: 'gauge-row',         icon: '\u25AD\u25AD', name: 'Gauge Row',         desc: 'Multiple horizontal gauges in a row' },
        { type: 'bar-chart',         icon: '\uD83D\uDCF6', name: 'Bar Chart',        desc: 'Vertical bars comparing categories' },
        { type: 'progress-bar',      icon: '\u25AC',        name: 'Progress Bar',    desc: 'Horizontal bar showing completion %' },
        { type: 'status-grid',       icon: '\u229E',        name: 'Status Grid',     desc: 'Grid of service health indicators' },
        { type: 'alert-list',        icon: '\uD83D\uDD14', name: 'Alert List',      desc: 'Scrolling list of active alerts' },
        { type: 'service-heatmap',   icon: '\uD83D\uDFE9', name: 'Heatmap',         desc: 'Color-coded grid of service metrics' },
        { type: 'pipeline-flow',     icon: '\u2192',        name: 'Pipeline',        desc: 'Stage-by-stage pipeline visualization' },
        { type: 'usa-map',           icon: '\uD83D\uDDFA', name: 'USA Map',         desc: 'SVG map with state-level data overlay' },
        { type: 'usa-map-gl',        icon: '\uD83D\uDDFA', name: 'USA Map (GL)',    desc: 'WebGL map with zip-level heatmap' },
        { type: 'security-scorecard',icon: '\uD83D\uDEE1', name: 'Security',        desc: 'Score breakdown across security categories' },
        { type: 'line-chart',        icon: '\uD83D\uDCC8', name: 'Line Chart',      desc: 'Time-series line chart with multiple series' },
        { type: 'table',             icon: '\u25A6',        name: 'Table',           desc: 'Rows and columns of tabular data' },
        { type: 'multi-metric-card', icon: '\u22A0',        name: 'Multi Metric',    desc: 'Multiple metrics in a single card' },
        { type: 'stacked-bar-chart', icon: '\u2590',        name: 'Stacked Bar',     desc: 'Stacked bar chart for part-to-whole' },
        { type: 'sparkline',         icon: '\u2248',        name: 'Sparkline',       desc: 'Compact inline trend line' },
        { type: 'donut-ring',        icon: '\u25CE',        name: 'Donut Ring',      desc: 'Ring chart showing proportions' },
        { type: 'globe',             icon: '\uD83C\uDF0D',  name: 'Globe',          desc: '3D spinning globe with data points' },
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

          const descEl = document.createElement('div');
          descEl.className = 'palette-type-desc';
          descEl.textContent = t.desc || '';

          card.appendChild(iconEl);
          card.appendChild(nameEl);
          card.appendChild(descEl);

          card.addEventListener('click', () => {
            // Remove selected from all cards
            typeGrid.querySelectorAll('.palette-type-card').forEach((c) => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedType = t;

            const selectedLabel = document.getElementById('palette-selected-type');
            if (selectedLabel) selectedLabel.textContent = t.name;

            if (addForm) addForm.style.display = 'flex';
            this.loadPaletteQueries(document.getElementById('aw-source')?.value || 'gcp');
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
        if (Array.isArray(queries) && queries.length > 0) {
          queries.forEach((q) => {
            const opt = document.createElement('option');
            opt.value = q.id;
            opt.textContent = q.name;
            sel.appendChild(opt);
          });
        } else {
          const emptyOpt = document.createElement('option');
          emptyOpt.value = '';
          emptyOpt.disabled = true;
          emptyOpt.textContent = 'No saved queries for this source';
          sel.appendChild(emptyOpt);
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
          if (name === 'datasources') {
            this.renderDatasourceList();
            this._startHealthPolling();
          } else {
            this._stopHealthPolling();
          }
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
      // Source-aware field visibility
      const gcpRow      = document.getElementById('qe-gcp-row');
      const metricLabel = document.getElementById('qe-metric-label');
      const metricInput = document.getElementById('qe-metric');
      const isGcp       = source === 'gcp';
      const isComputed  = source === 'computed';

      if (gcpRow) gcpRow.style.display = isGcp ? '' : 'none';

      if (metricLabel) {
        // Update only the text node (first child), not the input child
        const textNode = [...metricLabel.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
        if (textNode) {
          if (isComputed)  textNode.textContent = 'Function ID';
          else if (!isGcp) textNode.textContent = 'SQL Query';
          else             textNode.textContent = 'Metric Type';
        }
      }

      if (metricInput) {
        metricInput.readOnly   = isComputed;
        metricInput.style.opacity = isComputed ? '0.6' : '';
      }

      document.getElementById('qe-metric').value             = query.metricType || query.sql || query.queryId || '';
      document.getElementById('qe-time-window').value        = query.timeWindow || 60;
      document.getElementById('qe-aggregation').value        =
        (query.aggregation && query.aggregation.perSeriesAligner) || 'ALIGN_MEAN';

      this._bindQueryEditorActions();
    }

    _bindQueryEditorActions() {
      document.getElementById('qe-close').onclick = () => {
        document.getElementById('query-editor-panel').style.display = 'none';
        this._assignTargetWidgetId = null;
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
        if (this._assignTargetWidgetId) {
          this._assignQueryToWidgetDirect(this._assignTargetWidgetId);
        } else {
          this._assignQueryToWidget();
        }
      };

      const previewTypeSel = document.getElementById('qe-preview-type');
      if (previewTypeSel) {
        previewTypeSel.onchange = () => {
          if (this._lastPreviewData) {
            this._renderQueryPreview(this._lastPreviewData, previewTypeSel.value);
          }
        };
      }
    }

    /* ─────────────────────────────────────────────
       Query Run / Save / Assign
    ───────────────────────────────────────────── */

    async _runQuery() {
      const runBtn    = document.getElementById('qe-run');
      const statusEl  = document.getElementById('qe-run-status');
      const bodyEl    = document.getElementById('qe-results-body');
      const canvasCtr = document.getElementById('qe-preview-canvas-container');

      if (!this._activeQuery || !this._activeSource) return;

      runBtn.setAttribute('disabled', '');
      statusEl.textContent = 'Running\u2026';
      statusEl.style.color = 'var(--t3)';
      if (canvasCtr) canvasCtr.style.display = 'none';

      const previewType = document.getElementById('qe-preview-type')?.value || 'big-number';
      const t0 = Date.now();

      try {
        const res  = await fetch(
          '/api/queries/' + encodeURIComponent(this._activeSource) +
          '/' + encodeURIComponent(this._activeQuery.id) +
          '/preview?type=' + encodeURIComponent(previewType)
        );
        const data = await res.json();
        const ms   = Date.now() - t0;

        if (!data.success || !data.widgetData) {
          statusEl.textContent = 'No data';
          statusEl.style.color = 'var(--red)';
          bodyEl.textContent = '';
          const errDiv = document.createElement('div');
          errDiv.className = 'mb-status';
          errDiv.textContent = data.error || 'Query returned no data';
          bodyEl.appendChild(errDiv);
          return;
        }

        statusEl.textContent = ms + 'ms';
        statusEl.style.color = 'var(--green)';

        // Store for re-render on type change
        this._lastPreviewData = data.widgetData;

        // Render widget preview in canvas
        this._renderQueryPreview(data.widgetData, previewType);

        // Smart result format rendering
        const resultsBody = bodyEl;
        resultsBody.textContent = '';
        const rawData = data.rawData || data.widgetData || data;
        const fmt = this._selectResultFormat(rawData);
        if (fmt === 'empty') {
          const emptyDiv = document.createElement('div');
          emptyDiv.className = 'mb-status';
          emptyDiv.textContent = 'No results returned. Check your metric type and time range.';
          resultsBody.appendChild(emptyDiv);
        } else if (fmt === 'table') {
          this._renderResultTable(rawData, resultsBody);
        } else if (fmt === 'summary') {
          this._renderResultSummary(rawData, resultsBody);
        } else {
          const pre = document.createElement('pre');
          pre.className = 'qe-result-json';
          pre.textContent = JSON.stringify(rawData, null, 2);
          resultsBody.appendChild(pre);
        }
      } catch (e) {
        statusEl.textContent = 'Error';
        statusEl.style.color = 'var(--red)';
        bodyEl.textContent = '';
        const errDiv = document.createElement('div');
        errDiv.className = 'mb-status';
        errDiv.style.color = 'var(--red)';
        errDiv.textContent = 'Query failed: ' + e.message + '. Check the metric type and try again.';
        bodyEl.appendChild(errDiv);
      } finally {
        runBtn.removeAttribute('disabled');
      }
    }

    _selectResultFormat(data) {
      if (data === null || data === undefined) return 'empty';
      if (Array.isArray(data)) {
        if (data.length === 0) return 'empty';
        if (data[0] !== null && typeof data[0] === 'object' && !Array.isArray(data[0])) {
          if (data[0].timestamp !== undefined) return 'summary';
          return 'table';
        }
        return 'json';
      }
      if (typeof data === 'object' && (data.points !== undefined || data.timeSeries !== undefined)) {
        return 'summary';
      }
      return 'json';
    }

    _renderResultTable(data, container) {
      const MAX_ROWS = 100;
      const total = data.length;
      const rows = data.slice(0, MAX_ROWS);
      const cols = Object.keys(rows[0]);

      const table = document.createElement('table');
      table.className = 'qe-result-table';

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      cols.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      rows.forEach(row => {
        const tr = document.createElement('tr');
        cols.forEach(col => {
          const td = document.createElement('td');
          const v = row[col];
          if (v === null || v === undefined) {
            td.textContent = '';
          } else if (typeof v === 'object') {
            td.textContent = JSON.stringify(v);
          } else {
            td.textContent = v;
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);

      if (total > MAX_ROWS) {
        const truncated = document.createElement('div');
        truncated.className = 'results-truncated';
        truncated.textContent = 'Showing first 100 rows \u2014 ' + total + ' total returned.';
        container.appendChild(truncated);
      }
    }

    _renderResultSummary(data, container) {
      const points = data.points || data.timeSeries || (Array.isArray(data) ? data : []);
      const count = points.length;

      const summaryDiv = document.createElement('div');
      summaryDiv.className = 'qe-result-summary';

      function makeStat(label, value) {
        const stat = document.createElement('div');
        stat.className = 'summary-stat';
        const lbl = document.createElement('div');
        lbl.className = 'summary-label';
        lbl.textContent = label;
        const val = document.createElement('div');
        val.className = 'summary-value';
        val.textContent = value !== null && value !== undefined ? String(value) : '\u2014';
        stat.appendChild(lbl);
        stat.appendChild(val);
        return stat;
      }

      summaryDiv.appendChild(makeStat('Data Points', count));

      if (count > 0) {
        const first = points[0];
        const last  = points[count - 1];
        const firstTs = first.timestamp || first.startTime || '';
        const lastTs  = last.timestamp  || last.endTime   || '';
        const timeRange = firstTs && lastTs ? firstTs + ' \u2014 ' + lastTs : (firstTs || lastTs || '\u2014');
        summaryDiv.appendChild(makeStat('Time Range', timeRange));

        const lastVal = last.value !== undefined ? last.value
          : last.doubleValue !== undefined ? last.doubleValue
          : last.int64Value  !== undefined ? last.int64Value
          : null;
        summaryDiv.appendChild(makeStat('Last Value', lastVal));
      }

      container.appendChild(summaryDiv);
    }

    _renderQueryPreview(widgetData, widgetType) {
      const container = document.getElementById('qe-preview-canvas-container');
      const canvas    = document.getElementById('qe-preview-canvas');
      if (!container || !canvas || !window.Widgets) return;

      container.style.display = 'block';

      // Clear previous widget
      if (this._previewWidget && this._previewWidget.destroy) {
        this._previewWidget.destroy();
      }
      canvas.width  = canvas.offsetWidth  || 280;
      canvas.height = canvas.offsetHeight || 120;

      // Create a temporary container div for the widget
      const tmpDiv = document.createElement('div');
      tmpDiv.style.cssText = 'width:100%;height:120px;overflow:hidden;';

      try {
        this._previewWidget = window.Widgets.create(widgetType, tmpDiv, { type: widgetType });
        if (this._previewWidget && this._previewWidget.update) {
          this._previewWidget.update(widgetData);
        }
      } catch (e) {
        // Widget type not supported for preview — clear canvas
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
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

    _assignQueryToWidgetDirect(widgetId) {
      const q      = this._activeQuery;
      const source = this._activeSource;
      if (!q || !widgetId || this.activeDashIdx < 0) return;

      const dash = this.modifiedConfig.dashboards[this.activeDashIdx];
      const wc   = dash && dash.widgets.find(w => w.id === widgetId);
      if (!wc) return;

      wc.source  = source;
      wc.queryId = q.id;
      this.markDirty();
      this.renderCanvas();
      this.showWidgetProps(widgetId);
      this.showToast('Query assigned', 'success');

      document.getElementById('query-editor-panel').style.display = 'none';
      document.getElementById('properties-content').style.display = '';
      this._assignTargetWidgetId = null;
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

      document.getElementById('dse-name').textContent = src.name;
      const statusEl = document.getElementById('dse-status');
      statusEl.textContent = src.isConnected ? 'connected' : 'not connected';
      statusEl.style.color = src.isConnected ? 'var(--green)' : 'var(--red)';

      // Default view: query list
      this._showDseQueryView();
      await this._loadSourceQueries(src);

      // Close button
      document.getElementById('dse-close').onclick = () => {
        if (dse) dse.style.display = 'none';
        this.showDashboardProps();
      };

      // Toggle to credential form
      const editCredsBtn = document.getElementById('dse-edit-creds');
      if (editCredsBtn) {
        editCredsBtn.onclick = () => {
          this._showDseCredView();
          this._loadCredentialForm(src);
        };
      }

      // Back button
      const backBtn = document.getElementById('dse-back');
      if (backBtn) {
        backBtn.onclick = () => {
          this._showDseQueryView();
        };
      }
    }

    _showDseQueryView() {
      const qv = document.getElementById('dse-query-view');
      const cv = document.getElementById('dse-cred-view');
      if (qv) qv.style.display = 'flex';
      if (cv) cv.style.display = 'none';
    }

    _showDseCredView() {
      const qv = document.getElementById('dse-query-view');
      const cv = document.getElementById('dse-cred-view');
      if (qv) qv.style.display = 'none';
      if (cv) cv.style.display = 'flex';
    }

    async _loadSourceQueries(src) {
      const listEl = document.getElementById('dse-query-list');
      if (!listEl) return;
      listEl.textContent = '';

      try {
        const res  = await fetch('/api/queries/' + encodeURIComponent(src.name));
        const data = await res.json();
        const queries = data.queries || [];

        if (!queries.length) {
          const empty = document.createElement('div');
          empty.className = 'mb-status';
          empty.textContent = src.isConnected
            ? 'No saved queries for this source'
            : 'Configure credentials to enable queries';
          listEl.appendChild(empty);
          return;
        }

        queries.forEach(q => {
          const row    = document.createElement('div');
          row.className = 'dse-query-row';

          const nameEl = document.createElement('span');
          nameEl.className = 'dse-query-row-name';
          nameEl.textContent = q.name;

          const runBtn = document.createElement('button');
          runBtn.className = 'dse-query-row-run';
          runBtn.textContent = '\u25b6 Run';

          row.appendChild(nameEl);
          row.appendChild(runBtn);

          // Click row → open in query editor panel
          row.addEventListener('click', (e) => {
            if (e.target === runBtn) return;
            document.getElementById('datasource-editor-panel').style.display = 'none';
            this.openQueryEditor(q, src.name);
          });

          // Run button → open query editor and auto-run
          runBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('datasource-editor-panel').style.display = 'none';
            this.openQueryEditor(q, src.name);
            // Auto-run after a short delay so the panel is ready
            setTimeout(() => this._runQuery(), 200);
          });

          listEl.appendChild(row);
        });
      } catch (e) {
        const err = document.createElement('div');
        err.className = 'mb-status';
        err.textContent = 'Failed to load queries';
        listEl.appendChild(err);
      }
    }

    async _loadCredentialForm(src) {
      const fieldsEl = document.getElementById('dse-fields');
      if (!fieldsEl) return;
      fieldsEl.textContent = '';

      try {
        const schemaRes  = await fetch('/api/data-sources/schemas');
        const schemaData = await schemaRes.json().catch(() => ({ schemas: {} }));
        const schema = (schemaData.schemas && schemaData.schemas[src.name]) || { fields: [] };
        (schema.fields || []).forEach(field => {
          const label = document.createElement('label');
          label.className = 'qe-label';
          label.appendChild(document.createTextNode(field.description || field.name));
          const input = document.createElement('input');
          input.className         = 'qe-input';
          input.type              = field.secure ? 'password' : 'text';
          input.dataset.field     = field.name;
          input.dataset.key       = field.name;
          input.dataset.envVar    = field.envVar || '';
          input.dataset.required  = field.required ? 'true' : 'false';
          input.placeholder    = field.secure
            ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (stored)'
            : (field.default || '');
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

      // Wire test + save buttons
      const resultEl = document.getElementById('dse-test-result');

      document.getElementById('dse-test').onclick = async () => {
        const btn = document.getElementById('dse-test');
        btn.setAttribute('disabled', '');
        resultEl.textContent = 'Testing\u2026';
        resultEl.style.color = 'var(--t3)';
        const t0 = Date.now();
        try {
          const res  = await fetch('/api/data-sources/' + encodeURIComponent(src.name) + '/test', { method: 'POST' });
          const data = await res.json();
          const ms   = Date.now() - t0;
          if (data.connected || data.success) {
            resultEl.textContent = '\u2713 Connected (' + ms + 'ms)';
            resultEl.style.color = 'var(--green)';
          } else {
            resultEl.textContent = '\u2717 Failed \u2014 ' + (data.error || 'Unknown');
            resultEl.style.color = 'var(--red)';
          }
        } catch (e) {
          resultEl.textContent = '\u2717 ' + e.message;
          resultEl.style.color = 'var(--red)';
        } finally {
          btn.removeAttribute('disabled');
        }
      };

      document.getElementById('dse-save').onclick = async () => {
        const saveBtn = document.getElementById('dse-save');
        // Remove any existing error banner
        const existingBanner = document.getElementById('dse-fields') && document.getElementById('dse-fields').querySelector('.validation-banner');
        if (existingBanner) existingBanner.remove();
        // Client-side validation before network request
        if (!this._validateCredForm()) return;
        const inputs  = document.querySelectorAll('#dse-fields input[data-field]');
        const body    = {};
        inputs.forEach(inp => {
          if (inp.value.trim() && inp.dataset.envVar) body[inp.dataset.envVar] = inp.value.trim();
        });
        if (!Object.keys(body).length) {
          resultEl.textContent = 'No credentials entered';
          resultEl.style.color = 'var(--amber)';
          return;
        }
        saveBtn.disabled = true;
        resultEl.textContent = 'Saving\u2026';
        resultEl.style.color = 'var(--t3)';
        try {
          const res  = await fetch('/api/data-sources/' + encodeURIComponent(src.name) + '/credentials', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) {
            const banner = document.createElement('div');
            banner.className = 'validation-error validation-banner';
            banner.textContent = 'Could not save credentials: ' + (data.error || 'Unknown error') + '. Check your API key format.';
            document.getElementById('dse-fields').prepend(banner);
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
          inputs.forEach(inp => { if (inp.type === 'password') inp.value = ''; });
          this.renderDatasourceList();
        } catch (e) {
          resultEl.textContent = '\u2717 ' + e.message;
          resultEl.style.color = 'var(--red)';
        } finally {
          saveBtn.disabled = false;
        }
      };
    }

    /* ─────────────────────────────────────────────
       Credential Validation
    ───────────────────────────────────────────── */

    _validateCredForm() {
      const fieldsContainer = document.getElementById('dse-fields');
      if (!fieldsContainer) return true;
      const inputs = fieldsContainer.querySelectorAll('input[data-key]');
      let valid = true;
      inputs.forEach(input => {
        // Remove previous error
        const existingErr = input.parentElement.querySelector('.validation-error');
        if (existingErr) existingErr.remove();
        const val = input.value.trim();
        const required = input.hasAttribute('required') || input.dataset.required === 'true';
        if (required && !val) {
          const errEl = document.createElement('div');
          errEl.className = 'validation-error';
          errEl.textContent = 'Required.';
          input.parentElement.appendChild(errEl);
          valid = false;
        }
      });
      return valid;
    }

    /* ─────────────────────────────────────────────
       Health Section (Sources Tab)
    ───────────────────────────────────────────── */

    _formatRelativeTime(ts) {
      if (!ts) return 'never';
      const diff = Math.floor((Date.now() - ts) / 1000);
      if (diff < 60) return diff + 's ago';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return Math.floor(diff / 86400) + 'd ago';
    }

    async _renderHealthSection() {
      const content = document.getElementById('health-section-content');
      if (!content) return;
      content.textContent = '';
      try {
        const res  = await fetch('/api/data-sources/health');
        const data = await res.json();
        const health = data.health || {};
        Object.entries(health).forEach(([sourceName, src]) => {
          const row = document.createElement('div');
          row.className = 'health-row';

          const dot = document.createElement('span');
          dot.className = 'ds-status-dot ' + (
            src.isConnected ? 'green' :
            (src.isReady && !src.isConnected) ? 'amber' :
            src.lastError ? 'red' : 'grey'
          );

          const nameEl = document.createElement('span');
          nameEl.className   = 'ds-name';
          nameEl.textContent = sourceName;

          if (src.sessionErrorCount > 0) {
            const badge = document.createElement('span');
            badge.className   = 'health-error-badge';
            badge.textContent = src.sessionErrorCount;
            row.appendChild(dot);
            row.appendChild(nameEl);
            row.appendChild(badge);
          } else {
            row.appendChild(dot);
            row.appendChild(nameEl);
          }

          const ts = document.createElement('span');
          ts.className   = 'health-timestamp';
          ts.textContent = this._formatRelativeTime(src.lastSuccessAt);
          row.appendChild(ts);

          if (src.lastError) {
            const detail = document.createElement('div');
            detail.className   = 'health-error-detail';
            detail.textContent = src.lastError;
            detail.style.display = 'none';
            row.addEventListener('click', () => {
              if (detail.style.display === 'none') {
                detail.style.display = '';
                detail.classList.add('expanded');
              } else {
                detail.style.display = 'none';
                detail.classList.remove('expanded');
              }
            });
            content.appendChild(row);
            content.appendChild(detail);
          } else {
            content.appendChild(row);
          }
        });
        if (!Object.keys(health).length) {
          const msg = document.createElement('div');
          msg.className   = 'mb-status';
          msg.textContent = 'No sources found';
          content.appendChild(msg);
        }
      } catch (e) {
        const msg = document.createElement('div');
        msg.className   = 'mb-status';
        msg.textContent = 'Health check unavailable. Retrying in 30s.';
        content.appendChild(msg);
      }
    }

    _startHealthPolling() {
      if (this._healthPollInterval) return;
      this._renderHealthSection();
      this._healthPollInterval = setInterval(() => this._renderHealthSection(), 30000);
      const dot = document.getElementById('health-poll-dot');
      if (dot) dot.style.display = '';
    }

    _stopHealthPolling() {
      clearInterval(this._healthPollInterval);
      this._healthPollInterval = null;
      const dot = document.getElementById('health-poll-dot');
      if (dot) dot.style.display = 'none';
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

  // Static BigQuery table manifest for mad-data project
  const BQ_MANIFEST = [
    { name: 'mad-data.reporting.impressions', description: 'Ad impression events with campaign, device, and geo dimensions' },
    { name: 'mad-data.reporting.bid_requests', description: 'Bid request log with win rates, CPM, and auction metadata' },
    { name: 'mad-data.reporting.campaign_delivery', description: 'Campaign pacing, delivery stats, and budget utilization by day' },
    { name: 'mad-data.reporting.win_events', description: 'Auction win events with DSP, advertiser, and creative details' },
    { name: 'mad-data.reporting.segment_memberships', description: 'User segment membership counts and audience overlap' },
    { name: 'mad-data.analytics.daily_summary', description: 'Aggregated daily KPIs: impressions, clicks, spend, CPM' },
    { name: 'mad-data.analytics.client_performance', description: 'Per-client performance metrics: win rate, fill rate, eCPM' },
  ];

  // Static VulnTrack endpoint manifest
  const VT_MANIFEST = [
    { name: 'vulnerability-count', description: 'Total vulnerability count by severity' },
    { name: 'asset-inventory', description: 'Asset inventory summary' },
    { name: 'compliance-score', description: 'Overall compliance score' },
    { name: 'scan-status', description: 'Latest scan status and results' },
    { name: 'risk-score', description: 'Aggregated risk score across assets' },
  ];

  // Pure function: mirrors MetricBrowser._buildSourceTabs tab-building logic for testing
  function mirrorBuildSourceTabs(sources) {
    const BROWSABLE = ['bigquery', 'vulntrack'];
    const tabs = [{ name: 'gcp', disabled: false }];
    sources.forEach(src => {
      if (BROWSABLE.includes(src.name)) {
        tabs.push({ name: src.name, disabled: !src.isConnected });
      }
    });
    return tabs;
  }

  class MetricBrowser {
    constructor(studio) {
      this.studio             = studio;
      this.target             = null;
      this.allDescriptors     = [];
      this.activeNs           = null;
      this.selected           = null;
      this._activeSourceTab   = 'gcp';
      this._sourcesCache      = [];
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
      this.target             = widgetConfig;
      this.selected           = null;
      this.activeNs           = null;
      this._activeSourceTab   = 'gcp';

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
      this._buildSourceTabs().then(() => this._load());
    }

    close() {
      document.getElementById('metric-browser-modal').style.display = 'none';
    }

    async _buildSourceTabs() {
      const container = document.getElementById('mb-source-tabs');
      if (!container) return;
      container.textContent = '';
      this._sourcesCache = [];

      // Fetch live source status
      try {
        const res  = await fetch('/api/data-sources');
        const data = await res.json();
        this._sourcesCache = data.sources || [];
      } catch (_) {
        // If fetch fails, render GCP-only tab strip
      }

      const BROWSABLE = ['bigquery', 'vulntrack'];
      const SOURCE_LABELS = { gcp: 'GCP', bigquery: 'BigQuery', vulntrack: 'VulnTrack' };

      // Always add GCP tab first (always enabled)
      const gcpTab = document.createElement('div');
      gcpTab.className = 'mb-source-tab active';
      gcpTab.dataset.source = 'gcp';
      gcpTab.textContent = 'GCP';
      gcpTab.addEventListener('click', () => this._switchSourceTab('gcp'));
      container.appendChild(gcpTab);

      // Add tabs for browsable sources based on connection status
      this._sourcesCache.forEach(src => {
        if (!BROWSABLE.includes(src.name)) return;
        const tab = document.createElement('div');
        tab.className = 'mb-source-tab' + (src.isConnected ? '' : ' disabled');
        tab.dataset.source = src.name;
        tab.textContent = SOURCE_LABELS[src.name] || src.name;
        if (src.isConnected) {
          tab.addEventListener('click', () => this._switchSourceTab(src.name));
        }
        container.appendChild(tab);
      });

      this._activeSourceTab = 'gcp';
    }

    _switchSourceTab(sourceName) {
      // Update active tab visual state
      document.querySelectorAll('.mb-source-tab').forEach(el => {
        el.classList.toggle('active', el.dataset.source === sourceName);
      });
      this._activeSourceTab = sourceName;

      // Reset shared UI state
      document.getElementById('mb-services').textContent = '';
      document.getElementById('mb-list').textContent = '';
      document.getElementById('mb-config-panel').style.display = 'none';
      document.getElementById('mb-search').value = '';
      this.selected = null;

      const servicesPanel = document.querySelector('.mb-services-panel');
      const projectSel    = document.getElementById('mb-project');
      const titleEl       = document.querySelector('.mb-title');

      if (sourceName === 'gcp') {
        if (servicesPanel) servicesPanel.style.display = '';
        if (projectSel)    projectSel.style.display = '';
        if (titleEl)       titleEl.textContent = 'GCP Metrics';
        this._load();
      } else if (sourceName === 'bigquery') {
        if (servicesPanel) servicesPanel.style.display = 'none';
        if (projectSel)    projectSel.style.display = 'none';
        if (titleEl)       titleEl.textContent = 'BigQuery Tables';
        this._renderBigQueryManifest();
      } else if (sourceName === 'vulntrack') {
        if (servicesPanel) servicesPanel.style.display = 'none';
        if (projectSel)    projectSel.style.display = 'none';
        if (titleEl)       titleEl.textContent = 'VulnTrack Metrics';
        this._renderVulnTrackManifest();
      }
    }

    _renderBigQueryManifest() {
      if (!BQ_MANIFEST.length) {
        this._setStatus('No BigQuery tables available for this project.');
        return;
      }
      const q = (document.getElementById('mb-search').value || '').toLowerCase();
      const filtered = q
        ? BQ_MANIFEST.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
        : BQ_MANIFEST;
      this._renderManifestRows(filtered);

      // Wire search input for BigQuery filtering
      const searchEl = document.getElementById('mb-search');
      searchEl.onkeyup = () => {
        if (this._activeSourceTab !== 'bigquery') return;
        this._renderBigQueryManifest();
      };
    }

    _renderVulnTrackManifest() {
      const vtSrc = this._sourcesCache.find(s => s.name === 'vulntrack');
      if (!vtSrc || !vtSrc.isConnected) {
        this._setStatus('VulnTrack is not connected. Add credentials in the Sources tab.');
        return;
      }
      const q = (document.getElementById('mb-search').value || '').toLowerCase();
      const filtered = q
        ? VT_MANIFEST.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
        : VT_MANIFEST;
      this._renderManifestRows(filtered);

      // Wire search input for VulnTrack filtering
      const searchEl = document.getElementById('mb-search');
      searchEl.onkeyup = () => {
        if (this._activeSourceTab !== 'vulntrack') return;
        this._renderVulnTrackManifest();
      };
    }

    _renderManifestRows(items) {
      const list = document.getElementById('mb-list');
      list.textContent = '';
      if (!items.length) {
        this._setStatus('No results match your search.');
        return;
      }
      const frag = document.createDocumentFragment();
      items.forEach(item => {
        const card    = document.createElement('div');
        const nameEl  = document.createElement('div');
        const descEl  = document.createElement('div');
        card.className  = 'mb-card' + (this.selected && this.selected.type === item.name ? ' selected' : '');
        nameEl.className = 'mb-card-name';
        descEl.className = 'mb-card-desc';
        nameEl.textContent = item.name;
        descEl.textContent = item.description;
        card.appendChild(nameEl);
        card.appendChild(descEl);
        card.addEventListener('click', () => {
          document.querySelectorAll('#mb-list .mb-card').forEach(el => el.classList.remove('selected'));
          card.classList.add('selected');
          this.selected = { type: item.name, displayName: item.name, source: this._activeSourceTab };
          document.getElementById('mb-sel-type').textContent = item.name;
          document.getElementById('mb-sel-name').textContent = item.description || item.name;
          document.getElementById('mb-config-panel').style.display = 'flex';
        });
        frag.appendChild(card);
      });
      list.appendChild(frag);
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
      // Explorer mode: route metric type to callback instead of saving a query
      if (wc._explorerMode && typeof this._explorerCallback === 'function') {
        this._explorerCallback(descriptor.type);
        this.close();
        return;
      }

      // Non-GCP sources: assign directly without creating a server-side query
      if (this._activeSourceTab === 'bigquery' || this._activeSourceTab === 'vulntrack') {
        const queryId = descriptor.type.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        wc.source  = this._activeSourceTab;
        wc.queryId = queryId;
        this.studio.markDirty();
        this.studio.renderCanvas();
        this.studio.showWidgetProps(wc.id);
        this.close();
        this.studio.showToast('Metric applied: ' + (descriptor.displayName || descriptor.type), 'success');
        return;
      }

      // GCP: create a query entry server-side
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
