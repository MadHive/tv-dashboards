// public/js/components/live-preview.js

/**
 * LivePreview - Real-time dashboard preview component
 */
export class LivePreview {
  constructor(config = {}) {
    this.config = {
      mode: 'sample',
      size: 'desktop',
      theme: null,
      dashboardId: null,
      ...config
    };
    this.container = null;
  }

  async render(container) {
    if (!container) {
      console.error('LivePreview: container is required');
      return;
    }

    this.container = container;
    container.textContent = '';
    container.classList.add('live-preview', `live-preview-${this.config.size}`);

    const content = document.createElement('div');
    content.className = 'preview-content';

    const header = document.createElement('div');
    header.className = 'preview-header';

    const mode = document.createElement('span');
    mode.className = 'preview-mode';
    mode.textContent = this.config.mode === 'sample' ? 'Sample Data' : 'Live Data';
    header.appendChild(mode);

    const size = document.createElement('span');
    size.className = 'preview-size';
    size.textContent = this.config.size.toUpperCase();
    header.appendChild(size);

    content.appendChild(header);

    const dashboard = document.createElement('div');
    dashboard.className = 'preview-dashboard';

    const title = document.createElement('div');
    title.className = 'preview-title';
    title.textContent = this.config.dashboardId || 'New Dashboard';
    dashboard.appendChild(title);

    const placeholder = document.createElement('div');
    placeholder.className = 'preview-placeholder';
    placeholder.textContent = 'Dashboard preview will appear here';
    dashboard.appendChild(placeholder);

    content.appendChild(dashboard);
    container.appendChild(content);
  }

  setMode(mode) {
    if (!['sample', 'live'].includes(mode)) {
      console.warn(`Invalid mode: ${mode}. Must be 'sample' or 'live'`);
      return;
    }
    this.config.mode = mode;
    if (this.container) {
      this.render(this.container);
    }
  }

  setSize(size) {
    if (!['mobile', 'tablet', 'desktop', 'tv'].includes(size)) {
      console.warn(`Invalid size: ${size}`);
      return;
    }
    this.config.size = size;
    if (this.container) {
      this.render(this.container);
    }
  }

  destroy() {
    if (this.container) {
      this.container.textContent = '';
      this.container = null;
    }
  }
}
