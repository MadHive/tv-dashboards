// ===========================================================================
// Main dashboard application — config loader, page rotation, data refresh
// ===========================================================================

(function () {
  'use strict';

  const ICONS = {
    bolt:   '\u26A1',
    grid:   '\u25A6',
    server: '\u2318',
    flow:   '\u21C4',
    data:   '\u2338',
    shield: '\u26E8',
    map:    '\u25CB',
  };

  class DashboardApp {
    constructor() {
      this.config      = null;
      this.currentPage = 0;
      this.pages       = [];
      this.widgets     = {};   // widgetId → { update(data) }
      this.rotationTimer  = null;
      this.refreshTimer   = null;
      this.rotationMs     = 30000;
      this.paused         = false;
    }

    // ---- bootstrap ----
    async init() {
      try {
        const res = await fetch('/api/config');
        this.config = await res.json();
      } catch (err) {
        document.getElementById('dashboard-container').textContent =
          'Failed to load config — is the server running?';
        return;
      }

      this.rotationMs = (this.config.global.rotation_interval || 30) * 1000;
      if (this.config.global.title) {
        document.querySelector('.logo-text').textContent =
          this.config.global.title.split(' ')[0] || 'MADHIVE';
        document.querySelector('.logo-sub').textContent =
          this.config.global.title.split(' ').slice(1).join(' ') || 'OPS';
      }

      // set data source label
      const srcEl = document.getElementById('data-source');
      if (this.config.dataMode === 'LIVE') {
        srcEl.textContent = 'GCP Cloud Monitoring';
      } else {
        srcEl.textContent = 'GCP Cloud Monitoring';
      }

      this.renderPages();
      this.renderNavDots();
      this.startClock();
      this.showPage(0);
      await this.refreshData();
      this.startRotation();
      this.startRefresh();
      this.bindKeys();

      // Initialize editor (if available)
      if (window.EditorApp) {
        this.editor = new window.EditorApp(this);
        this.setupEditorControls();
      }
    }

    // ---- render all dashboard pages ----
    renderPages() {
      const container = document.getElementById('dashboard-container');
      this.config.dashboards.forEach((dash) => {
        const page = document.createElement('div');
        page.className = 'dashboard-page';
        page.style.gridTemplateColumns = `repeat(${dash.grid.columns}, 1fr)`;
        page.style.gridTemplateRows    = `repeat(${dash.grid.rows}, 1fr)`;
        page.style.gap = (dash.grid.gap || 12) + 'px';

        dash.widgets.forEach(wc => {
          const card = document.createElement('div');
          card.className = `widget widget-${wc.type}`;
          card.dataset.widgetId = wc.id;  // Add widget ID for editor
          card.style.gridColumn = `${wc.position.col} / span ${wc.position.colSpan || 1}`;
          card.style.gridRow    = `${wc.position.row} / span ${wc.position.rowSpan || 1}`;

          const title = document.createElement('div');
          title.className = 'widget-title';
          title.textContent = wc.title;
          card.appendChild(title);

          const content = document.createElement('div');
          content.className = 'widget-content';
          card.appendChild(content);

          const widgetKey = dash.id + ':' + wc.id;
          this.widgets[widgetKey] = window.Widgets.create(wc.type, content, wc);
          page.appendChild(card);
        });

        container.appendChild(page);
        this.pages.push(page);
      });
    }

    // ---- navigation dots ----
    renderNavDots() {
      const dotsContainer = document.getElementById('nav-dots');
      this.config.dashboards.forEach((dash, i) => {
        const dot = document.createElement('button');
        dot.className = 'nav-dot';
        dot.title = dash.name;
        dot.addEventListener('click', () => {
          this.showPage(i);
          this.resetRotation();
        });
        dotsContainer.appendChild(dot);
      });
    }

    // ---- show a specific page ----
    showPage(index) {
      this.currentPage = index;
      this.pages.forEach((p, i) => p.classList.toggle('active', i === index));

      // update nav dots
      document.querySelectorAll('.nav-dot').forEach((d, i) =>
        d.classList.toggle('active', i === index));

      // update title + project subtitle
      const dash = this.config.dashboards[index];
      document.getElementById('page-icon').textContent = ICONS[dash.icon] || '';
      document.getElementById('page-title').textContent = dash.name;
      document.getElementById('page-subtitle').textContent = dash.subtitle ? '/ ' + dash.subtitle : '';

      // restart rotation progress bar
      this.resetRotationBar();

      // immediate data refresh for new page
      this.refreshData();
    }

    // ---- rotation ----
    startRotation() {
      this.rotationTimer = setInterval(() => {
        if (this.paused) return;
        const next = (this.currentPage + 1) % this.pages.length;
        this.showPage(next);
      }, this.rotationMs);
    }

    resetRotation() {
      clearInterval(this.rotationTimer);
      this.startRotation();
      this.resetRotationBar();
    }

    resetRotationBar() {
      const bar = document.getElementById('rotation-progress');
      bar.classList.remove('running');
      bar.style.width = '0%';
      // force reflow
      void bar.offsetWidth;
      bar.classList.add('running');
      bar.style.transitionDuration = this.rotationMs + 'ms';
      bar.style.width = '100%';
    }

    // ---- data refresh ----
    startRefresh() {
      const interval = (this.config.global.refresh_interval || 5) * 1000;
      this.refreshTimer = setInterval(() => this.refreshData(), interval);
    }

    async refreshData() {
      const dash = this.config.dashboards[this.currentPage];
      try {
        const res = await fetch(`/api/metrics/${dash.id}`);
        const data = await res.json();

        dash.widgets.forEach(wc => {
          const widgetKey = dash.id + ':' + wc.id;
          const widget = this.widgets[widgetKey];
          if (widget && data[wc.id]) {
            widget.update(data[wc.id]);
          }
        });

        // update last-refresh indicator
        this._lastRefreshTime = Date.now();
        const dot = document.querySelector('.refresh-dot');
        if (dot) {
          dot.classList.remove('pulse');
          void dot.offsetWidth;
          dot.classList.add('pulse');
        }
        document.getElementById('refresh-label').textContent = 'just now';
      } catch (err) {
        console.error('[app] refresh failed:', err);
      }
    }

    // ---- clock ----
    startClock() {
      const clockEl = document.getElementById('clock');
      const refreshLabel = document.getElementById('refresh-label');
      const tick = () => {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('en-US', {
          hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit'
        });
        // update relative freshness
        if (this._lastRefreshTime && refreshLabel) {
          const ago = Math.round((Date.now() - this._lastRefreshTime) / 1000);
          if (ago < 3) refreshLabel.textContent = 'just now';
          else refreshLabel.textContent = ago + 's ago';
        }
      };
      tick();
      setInterval(tick, 1000);
    }

    // ---- keyboard navigation ----
    bindKeys() {
      document.addEventListener('keydown', e => {
        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            this.showPage((this.currentPage + 1) % this.pages.length);
            this.resetRotation();
            break;
          case 'ArrowLeft':
          case 'ArrowUp':
            this.showPage((this.currentPage - 1 + this.pages.length) % this.pages.length);
            this.resetRotation();
            break;
          case ' ':
            e.preventDefault();
            this.paused = !this.paused;
            document.getElementById('rotation-progress').style.animationPlayState =
              this.paused ? 'paused' : 'running';
            break;
        }
      });
    }

    // ---- editor controls ----
    setupEditorControls() {
      // Editor toggle button
      const toggleBtn = document.getElementById('editor-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          if (this.editor) this.editor.toggle();
        });
      }

      // Editor action bar buttons
      const saveBtn = document.getElementById('editor-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          if (this.editor) this.editor.saveChanges();
        });
      }

      const discardBtn = document.getElementById('editor-discard');
      if (discardBtn) {
        discardBtn.addEventListener('click', () => {
          if (this.editor) this.editor.discardChanges();
        });
      }

      const exitBtn = document.getElementById('editor-exit');
      if (exitBtn) {
        exitBtn.addEventListener('click', () => {
          if (this.editor) this.editor.exit();
        });
      }

      // Show action bar when in edit mode
      document.addEventListener('editorStateChanged', (e) => {
        const actionBar = document.querySelector('.editor-action-bar');
        if (actionBar) {
          actionBar.style.display = e.detail.isActive ? 'flex' : 'none';
        }
      });
    }
  }

  // ---- launch ----
  document.addEventListener('DOMContentLoaded', () => {
    const app = new DashboardApp();
    app.init();
  });
})();
