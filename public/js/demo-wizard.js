import { WizardFramework } from '/js/components/wizard-framework.js';
import { FormBuilder } from '/js/components/form-builder.js';
import { LivePreview } from '/js/components/live-preview.js';

// Step 1: Dashboard Basic Info
class DashboardInfoStep {
  constructor(data) {
    this.data = data;
    this.form = new FormBuilder({
      fields: [
        {
          id: 'name',
          type: 'text',
          label: 'Dashboard Name',
          required: true,
          placeholder: 'e.g., Platform Overview',
          help: 'A descriptive name for your dashboard'
        },
        {
          id: 'subtitle',
          type: 'text',
          label: 'Subtitle',
          placeholder: 'e.g., Real-Time Activity',
          help: 'Optional subtitle to display below the name'
        },
        {
          id: 'icon',
          type: 'select',
          label: 'Icon',
          required: true,
          options: [
            { value: 'bolt', label: '⚡ Bolt' },
            { value: 'grid', label: '▦ Grid' },
            { value: 'data', label: '📊 Data' },
            { value: 'shield', label: '🛡️ Shield' }
          ]
        }
      ]
    });
  }

  render(container) {
    this.form.render(container);
    if (this.data.name) {
      this.form.setData(this.data);
    }

    // Sync form data to wizard data and update button state
    const syncData = () => {
      const formData = this.form.getData();
      Object.assign(this.data, formData);

      // Update Next button state
      const nextBtn = document.querySelector('.wizard-navigation .btn-primary');
      if (nextBtn) {
        const isValid = this.data.name && this.data.icon;
        nextBtn.disabled = !isValid;
      }
    };

    // Initial sync
    syncData();

    // Listen for changes
    container.addEventListener('input', syncData);
    container.addEventListener('change', syncData);
  }
}

// Step 2: Grid Configuration
class GridConfigStep {
  constructor(data) {
    this.data = data;
    this.form = new FormBuilder({
      fields: [
        {
          id: 'columns',
          type: 'number',
          label: 'Columns',
          required: true,
          min: 1,
          max: 6,
          placeholder: '3',
          help: 'Number of columns in the dashboard grid (1-6)'
        },
        {
          id: 'rows',
          type: 'number',
          label: 'Rows',
          required: true,
          min: 1,
          max: 6,
          placeholder: '2',
          help: 'Number of rows in the dashboard grid (1-6)'
        },
        {
          id: 'gap',
          type: 'number',
          label: 'Gap (pixels)',
          min: 0,
          max: 30,
          placeholder: '14',
          help: 'Spacing between grid items in pixels'
        }
      ]
    });
  }

  render(container) {
    this.form.render(container);
    const gridData = {
      columns: this.data.columns || 3,
      rows: this.data.rows || 2,
      gap: this.data.gap || 14
    };
    this.form.setData(gridData);

    // Sync form data to wizard data and update button state
    const syncData = () => {
      const formData = this.form.getData();
      Object.assign(this.data, formData);

      // Update Next button state
      const nextBtn = document.querySelector('.wizard-navigation .btn-primary');
      if (nextBtn) {
        const isValid = this.data.columns >= 1 && this.data.rows >= 1;
        nextBtn.disabled = !isValid;
      }
    };

    // Initial sync
    syncData();

    // Listen for changes
    container.addEventListener('input', syncData);
    container.addEventListener('change', syncData);
  }
}

// Step 3: Preview
class PreviewStep {
  constructor(data) {
    this.data = data;
    this.preview = new LivePreview({
      mode: 'sample',
      size: 'desktop',
      dashboardId: data.name || 'New Dashboard'
    });
  }

  render(container) {
    const title = document.createElement('h2');
    title.textContent = 'Dashboard Preview';
    title.style.cssText = 'font-size: 18px; font-weight: 600; margin-bottom: 20px;';
    container.appendChild(title);

    const info = document.createElement('div');
    info.style.cssText = 'margin-bottom: 20px; padding: 16px; background: #f9fafb; border-radius: 8px;';

    const createInfo = (label, value) => {
      const p = document.createElement('p');
      p.style.cssText = 'font-size: 14px; color: #374151; margin: 0 0 8px 0;';
      const strong = document.createElement('strong');
      strong.textContent = label + ': ';
      p.appendChild(strong);
      p.appendChild(document.createTextNode(value || 'None'));
      return p;
    };

    info.appendChild(createInfo('Name', this.data.name));
    info.appendChild(createInfo('Subtitle', this.data.subtitle));
    info.appendChild(createInfo('Icon', this.data.icon));
    info.appendChild(createInfo('Grid', `${this.data.columns}×${this.data.rows} with ${this.data.gap}px gap`));
    container.appendChild(info);

    const previewContainer = document.createElement('div');
    this.preview.render(previewContainer);
    container.appendChild(previewContainer);
  }
}

// Create and render wizard
const wizard = new WizardFramework({
  steps: [
    {
      id: 'info',
      title: 'Dashboard Info',
      component: DashboardInfoStep,
      validate: (data) => data.name && data.icon
    },
    {
      id: 'grid',
      title: 'Grid Layout',
      component: GridConfigStep,
      validate: (data) => data.columns >= 1 && data.rows >= 1
    },
    {
      id: 'preview',
      title: 'Preview',
      component: PreviewStep,
      validate: () => true
    }
  ],
  onComplete: (data) => {
    document.getElementById('result-data').textContent = JSON.stringify(data, null, 2);
    document.getElementById('result').classList.add('show');
    document.getElementById('wizard-mount').style.display = 'none';
  },
  onCancel: () => {
    if (confirm('Are you sure you want to cancel?')) {
      wizard.destroy();
      const msg = document.createElement('p');
      msg.textContent = 'Wizard cancelled. Refresh to start over.';
      msg.style.cssText = 'text-align: center; color: #6b7280; padding: 40px;';
      const wizardMount = document.getElementById('wizard-mount');
      wizardMount.textContent = '';
      wizardMount.appendChild(msg);
    }
  }
});

const wizardMount = document.getElementById('wizard-mount');
wizard.render(wizardMount);
