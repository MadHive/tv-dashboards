// ===========================================================================
// Admin Components — Reusable UI Components
// ===========================================================================

export class DashboardForm {
  constructor(dashboard = null) {
    this.dashboard = dashboard;
    this.isEdit = !!dashboard;
  }

  render(container) {
    container.innerHTML = '';

    // Name field
    const nameGroup = this.createFormGroup(
      'dashboard-name',
      'Dashboard Name *',
      'input',
      {
        required: true,
        value: this.dashboard?.name || '',
        placeholder: 'e.g., Platform Overview'
      }
    );
    container.appendChild(nameGroup);

    // Subtitle field
    const subtitleGroup = this.createFormGroup(
      'dashboard-subtitle',
      'Subtitle',
      'input',
      {
        value: this.dashboard?.subtitle || '',
        placeholder: 'e.g., Real-Time Activity'
      }
    );
    container.appendChild(subtitleGroup);

    // Icon selector
    const iconGroup = this.createIconSelector();
    container.appendChild(iconGroup);

    // Grid preset selector
    const gridGroup = this.createGridSelector();
    container.appendChild(gridGroup);

    // Custom grid fields (hidden by default)
    const customGrid = this.createCustomGridFields();
    container.appendChild(customGrid);

    // Advanced options
    const advanced = this.createAdvancedOptions();
    container.appendChild(advanced);

    // Set up event listeners
    this.setupFormEvents();
  }

  createFormGroup(id, label, type, options = {}) {
    const group = document.createElement('div');
    group.className = 'form-group';

    const labelEl = document.createElement('label');
    labelEl.setAttribute('for', id);
    labelEl.textContent = label;
    group.appendChild(labelEl);

    const input = document.createElement(type === 'select' ? 'select' : 'input');
    input.id = id;
    if (type !== 'select') {
      input.type = type || 'text';
    }

    Object.entries(options).forEach(([key, value]) => {
      if (key === 'options') return; // Handle separately for select
      input[key] = value;
    });

    group.appendChild(input);

    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error';
    errorDiv.id = `${id}-error`;
    group.appendChild(errorDiv);

    return group;
  }

  createIconSelector() {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.setAttribute('for', 'dashboard-icon');
    label.textContent = 'Icon *';
    group.appendChild(label);

    const select = document.createElement('select');
    select.id = 'dashboard-icon';
    select.required = true;

    const icons = [
      { value: '', label: 'Select an icon' },
      { value: 'bolt', label: '⚡ Bolt' },
      { value: 'grid', label: '▦ Grid' },
      { value: 'map', label: '🗺️ Map' },
      { value: 'data', label: '📊 Data' },
      { value: 'flow', label: '🔄 Flow' },
      { value: 'shield', label: '🛡️ Shield' },
      { value: 'palette', label: '🎨 Palette' }
    ];

    icons.forEach(icon => {
      const option = document.createElement('option');
      option.value = icon.value;
      option.textContent = icon.label;
      if (this.dashboard?.icon === icon.value) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    group.appendChild(select);

    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error';
    errorDiv.id = 'dashboard-icon-error';
    group.appendChild(errorDiv);

    return group;
  }

  createGridSelector() {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.setAttribute('for', 'grid-preset');
    label.textContent = 'Grid Size *';
    group.appendChild(label);

    const select = document.createElement('select');
    select.id = 'grid-preset';

    const presets = [
      { value: 'small', label: 'Small (2×2)' },
      { value: 'medium', label: 'Medium (3×2)' },
      { value: 'large', label: 'Large (4×3)' },
      { value: 'custom', label: 'Custom' }
    ];

    presets.forEach(preset => {
      const option = document.createElement('option');
      option.value = preset.value;
      option.textContent = preset.label;
      if (preset.value === 'medium') {
        option.selected = true;
      }
      select.appendChild(option);
    });

    group.appendChild(select);

    return group;
  }

  createCustomGridFields() {
    const container = document.createElement('div');
    container.id = 'custom-grid';
    container.style.display = 'none';

    const columnsGroup = this.createFormGroup(
      'grid-columns',
      'Columns (1-6)',
      'number',
      {
        min: 1,
        max: 6,
        value: this.dashboard?.grid.columns || 3
      }
    );
    container.appendChild(columnsGroup);

    const rowsGroup = this.createFormGroup(
      'grid-rows',
      'Rows (1-6)',
      'number',
      {
        min: 1,
        max: 6,
        value: this.dashboard?.grid.rows || 2
      }
    );
    container.appendChild(rowsGroup);

    const gapGroup = this.createFormGroup(
      'grid-gap',
      'Gap (px)',
      'number',
      {
        min: 0,
        max: 30,
        value: this.dashboard?.grid.gap || 14
      }
    );
    container.appendChild(gapGroup);

    return container;
  }

  createAdvancedOptions() {
    const details = document.createElement('details');
    details.className = 'advanced-options';

    const summary = document.createElement('summary');
    summary.textContent = 'Advanced Options';
    details.appendChild(summary);

    const idGroup = this.createFormGroup(
      'dashboard-id',
      'Dashboard ID',
      'input',
      {
        value: this.dashboard?.id || '',
        placeholder: 'Auto-generated from name',
        disabled: this.isEdit
      }
    );

    const small = document.createElement('small');
    small.style.cssText = 'color: #6b7280; display: block; margin-top: 4px;';
    small.textContent = 'Lowercase, alphanumeric, and hyphens only';
    idGroup.appendChild(small);

    details.appendChild(idGroup);

    return details;
  }

  setupFormEvents() {
    const gridPreset = document.getElementById('grid-preset');
    const customGrid = document.getElementById('custom-grid');

    gridPreset.addEventListener('change', (e) => {
      customGrid.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
  }

  getFormData() {
    const gridPreset = document.getElementById('grid-preset').value;
    let grid;

    if (gridPreset === 'custom') {
      grid = {
        columns: parseInt(document.getElementById('grid-columns').value),
        rows: parseInt(document.getElementById('grid-rows').value),
        gap: parseInt(document.getElementById('grid-gap').value)
      };
    } else {
      const presets = {
        small: { columns: 2, rows: 2, gap: 14 },
        medium: { columns: 3, rows: 2, gap: 14 },
        large: { columns: 4, rows: 3, gap: 14 }
      };
      grid = presets[gridPreset];
    }

    const data = {
      name: document.getElementById('dashboard-name').value.trim(),
      subtitle: document.getElementById('dashboard-subtitle').value.trim(),
      icon: document.getElementById('dashboard-icon').value,
      grid
    };

    const customId = document.getElementById('dashboard-id').value.trim();
    if (customId && !this.isEdit) {
      data.id = customId;
    }

    return data;
  }

  validate() {
    const data = this.getFormData();
    const errors = {};

    if (!data.name) {
      errors.name = 'Name is required';
    } else if (data.name.length > 50) {
      errors.name = 'Name must be 50 characters or less';
    }

    if (!data.icon) {
      errors.icon = 'Icon is required';
    }

    return { valid: Object.keys(errors).length === 0, errors, data };
  }

  showErrors(errors) {
    // Clear previous errors
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    document.querySelectorAll('input, select').forEach(el => el.classList.remove('error'));

    // Show new errors
    Object.entries(errors).forEach(([field, message]) => {
      const errorEl = document.getElementById(`dashboard-${field}-error`);
      const inputEl = document.getElementById(`dashboard-${field}`);
      
      if (errorEl) {
        errorEl.textContent = message;
      }
      if (inputEl) {
        inputEl.classList.add('error');
      }
    });
  }
}
