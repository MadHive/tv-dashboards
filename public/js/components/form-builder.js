// public/js/components/form-builder.js

/**
 * FormBuilder - Dynamic form generation with validation
 */
export class FormBuilder {
  constructor(schema) {
    this.schema = schema;
    this.data = {};
    this.container = null;
    this.eventListeners = [];
  }

  /**
   * Validate a single field value against field rules
   * @private
   */
  _validateFieldValue(field, value) {
    // Check required - use strict comparison to allow 0 and false
    if (field.required && (value === '' || value === null || value === undefined)) {
      return `${field.label} is required`;
    }

    // Skip further validation if no value and not required
    if (!field.required && (value === '' || value === null || value === undefined)) {
      return null;
    }

    // Email validation
    if (field.type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Invalid email address';
      }
    }

    // Number validation (type and range)
    if (field.type === 'number' && value !== '') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return 'Must be a number';
      }
      if (field.min !== undefined && numValue < field.min) {
        return `Must be at least ${field.min}`;
      }
      if (field.max !== undefined && numValue > field.max) {
        return `Must be at most ${field.max}`;
      }
    }

    // Custom validator
    if (field.validate && value) {
      try {
        const error = field.validate(value);
        if (error) return error;
      } catch (err) {
        console.error('Custom validation error:', err);
        return 'Validation failed';
      }
    }

    return null;
  }

  validate(data) {
    const errors = {};

    this.schema.fields.forEach(field => {
      let value = data[field.id];

      // Trim string values before validation
      if (typeof value === 'string') {
        value = value.trim();
      }

      const error = this._validateFieldValue(field, value);

      if (error) {
        errors[field.id] = error;
      }
    });

    const valid = Object.keys(errors).length === 0;
    return { valid, errors, data };
  }

  render(container) {
    if (!container) {
      throw new Error('Container element is required');
    }

    this.container = container;
    container.textContent = '';
    container.classList.add('form-builder');

    const form = document.createElement('form');
    form.className = 'form-builder-form';

    const handleSubmit = (e) => {
      e.preventDefault();
    };
    form.addEventListener('submit', handleSubmit);
    this.eventListeners.push({ element: form, event: 'submit', handler: handleSubmit });

    this.schema.fields.forEach(field => {
      const fieldEl = this.createField(field);
      form.appendChild(fieldEl);
    });

    container.appendChild(form);
  }

  createField(field) {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.dataset.fieldId = field.id;

    const label = document.createElement('label');
    label.setAttribute('for', field.id);
    label.textContent = field.label;
    if (field.required) {
      const req = document.createElement('span');
      req.className = 'required';
      req.textContent = ' *';
      label.appendChild(req);
    }
    group.appendChild(label);

    const input = this.createInput(field);
    group.appendChild(input);

    if (field.help) {
      const help = document.createElement('small');
      help.className = 'form-help';
      help.textContent = field.help;
      group.appendChild(help);
    }

    const error = document.createElement('div');
    error.className = 'form-error';
    error.id = `${field.id}-error`;
    group.appendChild(error);

    return group;
  }

  createInput(field) {
    let input;

    switch (field.type) {
      case 'textarea':
        input = document.createElement('textarea');
        input.rows = field.rows || 4;
        break;

      case 'select':
        input = document.createElement('select');
        if (field.placeholder) {
          const ph = document.createElement('option');
          ph.value = '';
          ph.textContent = field.placeholder;
          ph.disabled = true;
          ph.selected = true;
          input.appendChild(ph);
        }
        (field.options || []).forEach(opt => {
          const option = document.createElement('option');
          option.value = typeof opt === 'string' ? opt : opt.value;
          option.textContent = typeof opt === 'string' ? opt : opt.label;
          input.appendChild(option);
        });
        break;

      default:
        input = document.createElement('input');
        input.type = field.type || 'text';
        if (field.placeholder) input.placeholder = field.placeholder;
        if (field.min !== undefined) input.min = field.min;
        if (field.max !== undefined) input.max = field.max;
    }

    input.id = field.id;
    input.name = field.id;
    input.required = field.required || false;

    if (this.data[field.id] !== undefined) {
      input.value = this.data[field.id];
    }

    const handleChange = () => {
      // Trim string values before storing
      let value = input.value;
      if (typeof value === 'string') {
        value = value.trim();
      }
      this.data[field.id] = value;
      this.validateField(field, value);
    };

    input.addEventListener('change', handleChange);
    this.eventListeners.push({ element: input, event: 'change', handler: handleChange });

    return input;
  }

  validateField(field, value) {
    const errorEl = document.getElementById(`${field.id}-error`);
    if (!errorEl) return true;

    const error = this._validateFieldValue(field, value);

    if (error) {
      errorEl.textContent = error;
      errorEl.style.display = 'block';
      return false;
    }

    errorEl.textContent = '';
    errorEl.style.display = 'none';
    return true;
  }

  showErrors(errors) {
    Object.entries(errors).forEach(([fieldId, message]) => {
      const errorEl = document.getElementById(`${fieldId}-error`);
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
      }
    });
  }

  getData() {
    return { ...this.data };
  }

  setData(data) {
    if (!data || typeof data !== 'object') {
      return;
    }

    this.data = { ...data };

    // Update rendered inputs if form is already rendered
    Object.entries(data).forEach(([fieldId, value]) => {
      const input = document.getElementById(fieldId);
      if (input) {
        input.value = value;
      }
    });
  }

  reset() {
    this.data = {};

    // Clear all inputs and errors if form is rendered
    this.schema.fields.forEach(field => {
      const input = document.getElementById(field.id);
      if (input) {
        input.value = '';
      }

      const errorEl = document.getElementById(`${field.id}-error`);
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
      }
    });
  }

  destroy() {
    // Remove all event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    // Clear container
    if (this.container) {
      this.container.textContent = '';
      this.container.classList.remove('form-builder');
      this.container = null;
    }

    // Clear data
    this.data = {};
  }
}
