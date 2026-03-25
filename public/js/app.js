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
      this.activeDashboards = [];  // Filtered list of non-excluded dashboards
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
      this.activeDashboards = this.config.dashboards.filter(d => !d.excluded);

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

      // Apply active theme if one is set
      if (this.config.global && this.config.global.activeTheme) {
        this.loadAndApplyTheme(this.config.global.activeTheme);
      }

      this.renderPages();
      this.renderNavDots();
      this.startClock();
      this.showPage(0);
      await this.refreshData();
      this.startRotation();
      this.startRefresh();
      this.startConfigRefresh();
      this.bindKeys();

      // Pause button in bottom bar
      const pauseBtn = document.getElementById('pause-btn');
      if (pauseBtn) {
        pauseBtn.addEventListener('click', () => this.togglePause());
      }

      // Note: removed "click anywhere to pause" — it caused the pause button to
      // immediately un-pause when clicking elsewhere on the dashboard.

    }

    // ---- render all dashboard pages ----
    renderPages() {
      const container = document.getElementById('dashboard-container');
      this.activeDashboards.forEach((dash) => {
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

          if (wc.subtitle) {
            const subtitle = document.createElement('div');
            subtitle.className = 'widget-subtitle';
            subtitle.textContent = wc.subtitle;
            card.appendChild(subtitle);
          }

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
      this.activeDashboards.forEach((dash, i) => {
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
      const dash = this.activeDashboards[index];
      document.getElementById('page-icon').textContent = ICONS[dash.icon] || '';
      document.getElementById('page-title').textContent = dash.name;
      document.getElementById('page-subtitle').textContent = dash.subtitle ? '/ ' + dash.subtitle : '';

      // apply theme if specified, otherwise fall back to clientBranding
      if (dash.theme && window.Themes) {
        window.Themes.applyTheme(dash.theme);
        if (window.Charts && window.Charts.setTheme) {
          window.Charts.setTheme(dash.theme);
        }
        // clientBranding is auto-populated from theme or can be manually specified
        this._applyClientBranding(dash.clientBranding || window.Themes.getTheme(dash.theme));
      } else {
        // Legacy: apply or restore client branding (colours + logo)
        this._applyClientBranding(dash.clientBranding || null);
        // Reset to default theme
        if (window.Themes) window.Themes.applyTheme('brand');
        if (window.Charts && window.Charts.setTheme) window.Charts.setTheme('brand');
      }

      // restart rotation progress bar
      this.resetRotationBar();

      // immediate data refresh for new page
      this.refreshData();
    }

    _applyClientBranding(brand) {
      const r = document.documentElement;
      const logoText = document.querySelector('.logo-text');
      const logoSub  = document.querySelector('.logo-sub');

      if (brand) {
        const set = (v, k) => v && r.style.setProperty(k, v);
        set(brand.bg,        '--bg');
        set(brand.bgSurface, '--bg-surface');
        set(brand.bgCard,    '--bg-card');
        set(brand.bgCardAlt, '--bg-card-alt');
        set(brand.border,    '--border');
        set(brand.borderLit, '--border-lit');
        set(brand.accent,    '--accent');
        set(brand.accentDim, '--accent-dim');
        set(brand.dotColor,  '--dot-color');

        // Text colors
        set(brand.text1 || brand.canvas?.text1, '--t1');
        set(brand.text2 || brand.t2, '--t2');
        set(brand.text3 || brand.t3, '--t3');

        // Also set MadHive-specific variables for full UI chrome theming
        // These map accent colors to the --mh-* variables used in top/bottom bars
        set(brand.accent,    '--mh-pink');
        set(brand.canvas?.hotPink || brand.accent, '--mh-hot-pink');
        if (logoText) logoText.textContent = brand.logoText || logoText.textContent;
        if (logoSub)  logoSub.textContent  = brand.logoSub  || logoSub.textContent;
        // Logo image in top-bar
        const logoWrap = document.querySelector('.top-left');
        if (logoWrap) {
          let logoImg = logoWrap.querySelector('.brand-logo-img');
          if (brand.logoImage) {
            if (!logoImg) {
              logoImg = document.createElement('img');
              logoImg.className = 'brand-logo-img';
              logoImg.alt = '';
              logoImg.style.cssText = 'height:48px;width:auto;opacity:0.95;margin-right:12px;object-fit:contain;';
              logoImg.onerror = () => logoImg.remove();
              logoWrap.prepend(logoImg);
            }
            logoImg.src = brand.logoImage;
          } else if (logoImg) {
            logoImg.remove();
          }
        }
        document.body.dataset.clientBrand = 'active';
      } else {
        ['--bg','--bg-surface','--bg-card','--bg-card-alt',
         '--border','--border-lit','--accent','--accent-dim',
         '--t1','--t2','--t3','--dot-color',
         '--mh-pink','--mh-hot-pink'].forEach(v => r.style.removeProperty(v));
        const logoWrap = document.querySelector('.top-left');
        if (logoWrap) {
          const logoImg = logoWrap.querySelector('.brand-logo-img');
          if (logoImg) logoImg.remove();
        }
        const t = this.config.global?.title || '';
        if (logoText) logoText.textContent = t.split(' ')[0] || 'MADHIVE';
        if (logoSub)  logoSub.textContent  = t.split(' ').slice(1).join(' ') || 'PLATFORM';
        delete document.body.dataset.clientBrand;
      }
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
      this.rotationTimer = null;
      if (!this.paused) {
        this.startRotation();
      }
      this.resetRotationBar();
    }

    resetRotationBar() {
      const bar = document.getElementById('rotation-progress');
      bar.classList.remove('running');
      bar.style.width = '0%';
      if (!this.paused) {
        // force reflow then animate
        void bar.offsetWidth;
        bar.classList.add('running');
        bar.style.transitionDuration = this.rotationMs + 'ms';
        bar.style.width = '100%';
      }
    }

    togglePause() {
      this.paused = !this.paused;
      const btn = document.getElementById('pause-btn');
      if (this.paused) {
        clearInterval(this.rotationTimer);
        this.rotationTimer = null;
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
        if (btn) { btn.textContent = '▶'; btn.classList.add('paused'); btn.title = 'Resume slideshow (Space)'; }
      } else {
        this.startRotation();
        this.startRefresh();
        this.resetRotationBar();
        if (btn) { btn.textContent = '⏸'; btn.classList.remove('paused'); btn.title = 'Pause slideshow (Space)'; }
      }
    }

    // ---- data refresh ----
    startRefresh() {
      const interval = (this.config.global.refresh_interval || 5) * 1000;
      this.refreshTimer = setInterval(() => this.refreshData(), interval);
    }

    startConfigRefresh() {
      // Re-fetch config every 30s to pick up studio branding/exclusion changes without a full reload
      setInterval(async () => {
        try {
          const res = await fetch('/api/config');
          if (!res.ok) return;
          const newConfig = await res.json();
          const newDashes = newConfig.dashboards;
          const oldDashes = this.config ? this.config.dashboards : [];
          let changed = oldDashes.length !== newDashes.length;
          if (!changed) {
            for (let i = 0; i < newDashes.length; i++) {
              const o = oldDashes[i] || {};
              const n = newDashes[i] || {};
              if (JSON.stringify(n.clientBranding) !== JSON.stringify(o.clientBranding)
                  || n.excluded !== o.excluded
                  || n.icon !== o.icon
                  || n.name !== o.name) {
                changed = true;
                break;
              }
            }
          }
          if (changed) {
            // Check if any map widget configs changed (positions, resize, mglConfig)
            // If so, reload the page so new MapboxUSAMap instances get the updated positions
            let mglChanged = false;
            newConfig.dashboards.forEach((d, i) => {
              const oldDash = oldDashes[i] || {};
              (d.widgets || []).forEach((w, j) => {
                const oldW = ((oldDash.widgets) || [])[j] || {};
                if (JSON.stringify(w.mglConfig) !== JSON.stringify(oldW.mglConfig)) {
                  mglChanged = true;
                }
              });
            });

            if (mglChanged) {
              // Map positions or config changed — full reload to reinit widget instances
              window.location.reload();
              return;
            }

            this.config = newConfig;
            this.activeDashboards = newConfig.dashboards.filter(d => !d.excluded);
            // Re-apply branding for whatever page is currently showing
            const dash = this.activeDashboards[this.currentPage];
            if (dash) this._applyClientBranding(dash.clientBranding || null);
          }
        } catch (_) { /* non-fatal */ }
      }, 30000);
    }

    async refreshData() {
      const dash = this.activeDashboards[this.currentPage];
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

    // ---- theme application ----
    async loadAndApplyTheme(themeId) {
      try {
        const res = await fetch('/api/themes/' + encodeURIComponent(themeId));
        if (!res.ok) return;
        const theme = await res.json();
        this.applyThemeCss(theme);
      } catch (_) {
        // Theme load failure is non-fatal — keep default brand theme
      }
    }

    applyThemeCss(theme) {
      const c = theme.colors || {};
      if (!c.background && !c.primary) return; // nothing to apply

      // Remove any previous theme style block
      const prev = document.getElementById('active-theme-vars');
      if (prev) prev.parentNode.removeChild(prev);

      // Map theme colors → CSS custom properties
      // background → surface colors, primary → brand accent, text → text colors
      const vars = [
        c.background ? `--bg: ${c.background};` : '',
        c.background ? `--bg-surface: ${c.background};` : '',
        c.primary    ? `--mh-pink: ${c.primary};` : '',
        c.primary    ? `--mh-hot-pink: ${c.primary};` : '',
        c.primary    ? `--accent: ${c.primary};` : '',
        c.secondary  ? `--cyan: ${c.secondary};` : '',
        c.text       ? `--t1: ${c.text};` : '',
      ].filter(Boolean).join('\n  ');

      if (!vars) return;

      const style = document.createElement('style');
      style.id = 'active-theme-vars';
      style.textContent = ':root {\n  ' + vars + '\n}';
      document.head.appendChild(style);
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
            this.togglePause();
            break;
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
