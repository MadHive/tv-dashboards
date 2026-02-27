// public/js/components/form-builder.js

/**
 * FormBuilder - Dynamic form generation with validation
 */
export class FormBuilder {
  constructor(schema) {
    this.schema = schema;
    this.data = {};
    this.errors = {};
    this.container = null;
    this.eventListeners = [];
  }

  validate(data) {
    const errors = {};
    let valid = true;

    this.schema.fields.forEach(field => {
      const value = data[field.id];

      if (field.required && !value) {
        errors[field.id] = `${field.label} is required`;
        valid = false;
        return;
      }

      if (!value && !field.required) return;

      if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors[field.id] = 'Invalid email address';
          valid = false;
        }
      }

      if (field.type === 'number' && value) {
        if (isNaN(value)) {
          errors[field.id] = 'Must be a number';
          valid = false;
        }
      }

      if (field.validate && value) {
        try {
          const customError = field.validate(value);
          if (customError) {
            errors[field.id] = customError;
            valid = false;
          }
        } catch (error) {
          errors[field.id] = 'Validation error occurred';
          valid = false;
          console.error('Custom validator error:', error);
        }
      }
    });

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
      this.data[field.id] = input.value;
      this.validateField(field, input.value);
    };

    input.addEventListener('change', handleChange);
    this.eventListeners.push({ element: input, event: 'change', handler: handleChange });

    return input;
  }

  validateField(field, value) {
    const errorEl = document.getElementById(`${field.id}-error`);
    if (!errorEl) return;

    if (field.required && !value) {
      errorEl.textContent = `${field.label} is required`;
      errorEl.style.display = 'block';
      return false;
    }

    if (field.type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errorEl.textContent = 'Invalid email address';
        errorEl.style.display = 'block';
        return false;
      }
    }

    if (field.validate && value) {
      try {
        const error = field.validate(value);
        if (error) {
          errorEl.textContent = error;
          errorEl.style.display = 'block';
          return false;
        }
      } catch (e) {
        errorEl.textContent = 'Validation error occurred';
        errorEl.style.display = 'block';
        console.error('Custom validator error:', e);
        return false;
      }
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
    this.errors = {};

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
    this.errors = {};
  }
}
