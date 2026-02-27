// ===========================================================================
// Dashboard Admin Application — Main Controller
// ===========================================================================

import { AdminAPI } from './admin-api.js';
import { DashboardForm } from './admin-components.js';

class AdminApp {
  constructor() {
    this.api = new AdminAPI();
    this.dashboards = [];
    this.selectedDashboards = new Set();
    this.currentForm = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadDashboards();
  }

  setupEventListeners() {
    // Create dashboard button
    document.getElementById('create-dashboard-btn').addEventListener('click', () => {
      this.openCreateModal();
    });

    // Search input
    document.getElementById('search-input').addEventListener('input', (e) => {
      this.filterDashboards(e.target.value);
    });

    // Icon filter
    document.getElementById('filter-icon').addEventListener('change', () => {
      this.applyFilters();
    });

    // Sort selector
    document.getElementById('sort-by').addEventListener('change', (e) => {
      this.sortDashboards(e.target.value);
    });

    // Modal controls
    document.getElementById('modal-close-btn').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('modal-cancel').addEventListener('click', () => {
      this.closeModal();
    });

    // Bulk action buttons
    document.getElementById('bulk-delete-btn').addEventListener('click', () => {
      this.bulkDeleteSelected();
    });

    // Listen for checkbox changes
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('dashboard-checkbox')) {
        this.updateSelection();
      }
    });
  }

  async loadDashboards() {
    const listContainer = document.getElementById('dashboard-list');
    listContainer.textContent = 'Loading dashboards...';
    Object.assign(listContainer.style, { textAlign: 'center', padding: '60px', color: '#6b7280' });

    try {
      this.dashboards = await this.api.listDashboards();
      this.renderDashboards();
    } catch (error) {
      listContainer.textContent = 'Failed to load dashboards';
      Object.assign(listContainer.style, { color: '#ef4444' });
      this.showToast('Failed to load dashboards', 'error');
    }
  }

  renderDashboards(dashboards = this.dashboards) {
    const listContainer = document.getElementById('dashboard-list');
    listContainer.innerHTML = ''; // Clear container
    listContainer.style.cssText = ''; // Reset styles

    if (dashboards.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.cssText = 'text-align: center; padding: 60px 20px; color: #6b7280;';
      const title = document.createElement('p');
      title.style.cssText = 'font-size: 18px; margin-bottom: 8px;';
      title.textContent = 'No dashboards found';
      const subtitle = document.createElement('p');
      subtitle.textContent = 'Create your first dashboard to get started';
      emptyDiv.appendChild(title);
      emptyDiv.appendChild(subtitle);
      listContainer.appendChild(emptyDiv);
      return;
    }

    // Create dashboard items using DOM methods (XSS-safe)
    dashboards.forEach(dashboard => {
      const item = this.createDashboardItem(dashboard);
      listContainer.appendChild(item);
    });
  }

  createDashboardItem(dashboard) {
    const item = document.createElement('div');
    item.className = 'dashboard-item';
    item.dataset.id = dashboard.id;

    // Left section
    const left = document.createElement('div');
    left.className = 'dashboard-item-left';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'dashboard-checkbox';
    checkbox.dataset.id = dashboard.id;

    const icon = document.createElement('div');
    icon.className = 'dashboard-icon';
    icon.textContent = this.getIconEmoji(dashboard.icon);

    const info = document.createElement('div');
    info.className = 'dashboard-info';
    const title = document.createElement('h3');
    title.textContent = dashboard.name;
    const subtitle = document.createElement('p');
    subtitle.textContent = dashboard.subtitle || 'No subtitle';
    info.appendChild(title);
    info.appendChild(subtitle);

    left.appendChild(checkbox);
    left.appendChild(icon);
    left.appendChild(info);

    // Meta section
    const meta = document.createElement('div');
    meta.className = 'dashboard-meta';
    const widgetSpan = document.createElement('span');
    widgetSpan.textContent = `${dashboard.widgetCount} widgets`;
    const gridSpan = document.createElement('span');
    gridSpan.textContent = `Grid: ${dashboard.grid.columns}×${dashboard.grid.rows}`;
    meta.appendChild(widgetSpan);
    meta.appendChild(gridSpan);

    // Actions section
    const actions = document.createElement('div');
    actions.className = 'dashboard-actions';

    const createActionBtn = (text, action) => {
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.textContent = text;
      btn.dataset.action = action;
      btn.dataset.id = dashboard.id;
      btn.addEventListener('click', (e) => {
        this.handleAction(e.target.dataset.action, e.target.dataset.id);
      });
      return btn;
    };

    actions.appendChild(createActionBtn('Edit Widgets', 'edit-widgets'));
    actions.appendChild(createActionBtn('Edit', 'edit'));
    actions.appendChild(createActionBtn('Duplicate', 'duplicate'));
    actions.appendChild(createActionBtn('Delete', 'delete'));

    item.appendChild(left);
    item.appendChild(meta);
    item.appendChild(actions);

    return item;
  }

  handleAction(action, id) {
    switch (action) {
      case 'edit-widgets':
        this.editWidgets(id);
        break;
      case 'edit':
        this.editDashboard(id);
        break;
      case 'duplicate':
        this.duplicateDashboard(id);
        break;
      case 'delete':
        this.deleteDashboard(id);
        break;
    }
  }

  getIconEmoji(icon) {
    const icons = {
      bolt: '⚡',
      grid: '▦',
      map: '🗺️',
      data: '📊',
      flow: '🔄',
      shield: '🛡️',
      palette: '🎨'
    };
    return icons[icon] || '📋';
  }

  filterDashboards(searchTerm) {
    const iconFilter = document.getElementById('filter-icon').value;

    let filtered = this.dashboards.filter(dashboard => {
      const matchesSearch = dashboard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (dashboard.subtitle && dashboard.subtitle.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesIcon = !iconFilter || dashboard.icon === iconFilter;
      return matchesSearch && matchesIcon;
    });

    this.renderDashboards(filtered);
  }

  applyFilters() {
    const searchTerm = document.getElementById('search-input').value;
    this.filterDashboards(searchTerm);
  }

  sortDashboards(sortBy) {
    const sorted = [...this.dashboards].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'widgets':
          return b.widgetCount - a.widgetCount;
        case 'order':
        default:
          return a.order - b.order;
      }
    });
    this.renderDashboards(sorted);
  }

  updateSelection() {
    const checkboxes = document.querySelectorAll('.dashboard-checkbox:checked');
    this.selectedDashboards = new Set(Array.from(checkboxes).map(cb => cb.dataset.id));

    const bulkActions = document.querySelector('.bulk-actions');
    bulkActions.style.display = this.selectedDashboards.size > 0 ? 'flex' : 'none';
  }

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'toast-message';
    messageDiv.textContent = message;

    toast.appendChild(messageDiv);
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  openCreateModal() {
    this.currentForm = new DashboardForm();
    this.openModal('Create Dashboard', this.currentForm);
  }

  async editDashboard(id) {
    try {
      const dashboard = await this.api.getDashboard(id);
      this.currentForm = new DashboardForm(dashboard);
      this.openModal('Edit Dashboard', this.currentForm);
    } catch (error) {
      this.showToast('Failed to load dashboard', 'error');
    }
  }

  openModal(title, form) {
    const modal = document.getElementById('dashboard-modal');
    const modalTitle = document.getElementById('modal-title');
    const formContainer = document.getElementById('dashboard-form');

    modalTitle.textContent = title;
    form.render(formContainer);

    modal.style.display = 'flex';

    // Set up save button
    const saveBtn = document.getElementById('modal-save');
    saveBtn.onclick = () => this.saveCurrentDashboard();
  }

  closeModal() {
    const modal = document.getElementById('dashboard-modal');
    modal.style.display = 'none';
    this.currentForm = null;
  }

  async saveCurrentDashboard() {
    const validation = this.currentForm.validate();

    if (!validation.valid) {
      this.currentForm.showErrors(validation.errors);
      return;
    }

    try {
      if (this.currentForm.isEdit) {
        await this.api.updateDashboard(this.currentForm.dashboard.id, validation.data);
        this.showToast('Dashboard updated successfully');
      } else {
        await this.api.createDashboard(validation.data);
        this.showToast('Dashboard created successfully');
      }

      this.closeModal();
      await this.loadDashboards();
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }

  editWidgets(id) {
    const dashboardIndex = this.dashboards.findIndex(d => d.id === id);
    if (dashboardIndex === -1) return;

    // Navigate to main dashboard with this page active and editor open
    window.location.href = `/?page=${dashboardIndex}&edit=true`;
  }

  async duplicateDashboard(id) {
    try {
      const duplicated = await this.api.duplicateDashboard(id);
      this.showToast(`Created "${duplicated.name}"`);
      await this.loadDashboards();
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }

  async deleteDashboard(id) {
    const dashboard = this.dashboards.find(d => d.id === id);
    if (!dashboard) return;

    const confirmed = confirm(
      `Delete "${dashboard.name}"?\n\n` +
      `This dashboard has ${dashboard.widgetCount} widget(s).\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await this.api.deleteDashboard(id);
      this.showToast('Dashboard deleted successfully');
      await this.loadDashboards();
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }

  async bulkDeleteSelected() {
    if (this.selectedDashboards.size === 0) return;

    const confirmed = confirm(
      `Delete ${this.selectedDashboards.size} dashboard(s)?\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    // For now, delete one by one (bulk API will be added later)
    try {
      for (const id of this.selectedDashboards) {
        await this.api.deleteDashboard(id);
      }
      this.showToast(`${this.selectedDashboards.size} dashboard(s) deleted`);
      this.selectedDashboards.clear();
      await this.loadDashboards();
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.adminApp = new AdminApp();
  });
} else {
  window.adminApp = new AdminApp();
}
