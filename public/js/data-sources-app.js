// ===========================================================================
// Data Sources Management UI — Frontend Application
// ===========================================================================

let dataSources = [];
let schemas = {};
let healthData = {};
let currentSourceName = null;

// ===========================================================================
// Initialization
// ===========================================================================

async function init() {
  await loadDataSources();
  setupEventListeners();
}

// ===========================================================================
// Data Loading
// ===========================================================================

async function loadDataSources() {
  try {
    // Fetch all data in parallel
    const [sourcesResp, schemasResp, healthResp] = await Promise.all([
      fetch('/api/data-sources'),
      fetch('/api/data-sources/schemas/detailed'),
      fetch('/api/data-sources/health')
    ]);

    const sourcesData = await sourcesResp.json();
    const schemasData = await schemasResp.json();
    const healthDataResp = await healthResp.json();

    if (!sourcesData.success || !schemasData.success || !healthDataResp.success) {
      throw new Error('Failed to load data sources');
    }

    dataSources = sourcesData.sources;
    schemas = schemasData.schemas;
    healthData = healthDataResp.health;

    renderDataSources();
  } catch (error) {
    console.error('Error loading data sources:', error);
    showToast('Failed to load data sources: ' + error.message, 'error');
  }
}

// ===========================================================================
// Rendering
// ===========================================================================

function renderDataSources() {
  const grid = document.getElementById('data-sources-grid');
  grid.innerHTML = ''; // Clear existing content

  if (!dataSources || dataSources.length === 0) {
    const message = document.createElement('div');
    message.className = 'loading-message';
    message.innerHTML = '<p>No data sources available</p>';
    grid.appendChild(message);
    return;
  }

  const searchTerm = document.getElementById('search-input').value.toLowerCase();

  const filteredSources = dataSources.filter(source => {
    const schema = schemas[source.name] || {};
    const name = (schema.name || source.name).toLowerCase();
    const description = (schema.description || '').toLowerCase();
    return name.includes(searchTerm) || description.includes(searchTerm);
  });

  if (filteredSources.length === 0) {
    const message = document.createElement('div');
    message.className = 'loading-message';
    message.innerHTML = '<p>No data sources match your search</p>';
    grid.appendChild(message);
    return;
  }

  filteredSources.forEach(source => {
    const card = createDataSourceCard(source);
    grid.appendChild(card);
  });
}

function createDataSourceCard(source) {
  const schema = schemas[source.name] || {};
  const health = healthData[source.name] || { enabled: false, connected: false };
  const displayName = schema.name || source.name;
  const description = schema.description || 'No description available';

  // Determine status
  let statusClass = 'status-disabled';
  let statusText = 'Disabled';

  if (health.enabled) {
    if (health.connected) {
      statusClass = 'status-connected';
      statusText = 'Connected';
    } else {
      statusClass = 'status-disconnected';
      statusText = 'Disconnected';
    }
  }

  // Create card element
  const card = document.createElement('div');
  card.className = 'data-source-card';
  card.dataset.source = source.name;

  // Create header
  const header = document.createElement('div');
  header.className = 'card-header';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'card-title';

  const h3 = document.createElement('h3');
  h3.textContent = displayName;

  const statusBadge = document.createElement('span');
  statusBadge.className = `status-badge ${statusClass}`;
  statusBadge.textContent = statusText;

  titleDiv.appendChild(h3);
  titleDiv.appendChild(statusBadge);

  const toggleDiv = document.createElement('div');
  toggleDiv.className = 'card-toggle';

  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'toggle-switch';

  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.checked = health.enabled;
  toggleInput.addEventListener('change', () => {
    window.toggleEnabled(source.name, toggleInput.checked);
  });

  const toggleSlider = document.createElement('span');
  toggleSlider.className = 'toggle-slider';

  toggleLabel.appendChild(toggleInput);
  toggleLabel.appendChild(toggleSlider);
  toggleDiv.appendChild(toggleLabel);

  header.appendChild(titleDiv);
  header.appendChild(toggleDiv);

  // Create body
  const body = document.createElement('div');
  body.className = 'card-body';

  const descP = document.createElement('p');
  descP.className = 'card-description';
  descP.textContent = description;

  body.appendChild(descP);

  // Create footer
  const footer = document.createElement('div');
  footer.className = 'card-footer';

  const configBtn = document.createElement('button');
  configBtn.className = 'btn btn-secondary btn-sm';
  configBtn.textContent = 'Configure';
  configBtn.addEventListener('click', () => {
    window.openConfigModal(source.name);
  });

  const testBtn = document.createElement('button');
  testBtn.className = 'btn btn-info btn-sm';
  testBtn.textContent = 'Test';
  testBtn.addEventListener('click', () => {
    window.testConnection(source.name);
  });

  footer.appendChild(configBtn);
  footer.appendChild(testBtn);

  // Assemble card
  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);

  return card;
}

// ===========================================================================
// Modal Management
// ===========================================================================

async function openConfigModal(sourceName) {
  currentSourceName = sourceName;
  const modal = document.getElementById('config-modal');
  const modalTitle = document.getElementById('modal-title');
  const schema = schemas[sourceName] || {};

  modalTitle.textContent = `Configure ${schema.name || sourceName}`;

  // Load current configuration
  try {
    const response = await fetch(`/api/data-sources/${sourceName}/config`);
    const data = await response.json();

    const currentConfig = data.success ? data.config : {};

    // Generate form fields
    const form = document.getElementById('config-form');
    form.innerHTML = ''; // Clear existing fields
    generateFormFields(schema, currentConfig, form);

    modal.style.display = 'flex';
  } catch (error) {
    console.error('Error loading configuration:', error);
    showToast('Failed to load configuration: ' + error.message, 'error');
  }
}

function closeConfigModal() {
  const modal = document.getElementById('config-modal');
  modal.style.display = 'none';
  currentSourceName = null;

  // Hide audit log section
  const auditSection = document.getElementById('audit-log-section');
  auditSection.style.display = 'none';
}

function generateFormFields(schema, currentConfig, form) {
  if (!schema.fields || schema.fields.length === 0) {
    const message = document.createElement('p');
    message.className = 'form-message';
    message.textContent = 'This data source has no configurable fields.';
    form.appendChild(message);
    return;
  }

  schema.fields.forEach(field => {
    const value = currentConfig[field.id] || field.default || '';
    const isSensitive = field.type === 'password' || field.id.toLowerCase().includes('key') ||
                       field.id.toLowerCase().includes('secret') || field.id.toLowerCase().includes('token');

    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    // Create label
    const label = document.createElement('label');
    label.htmlFor = field.id;
    label.textContent = field.label + (field.required ? ' *' : '');
    formGroup.appendChild(label);

    // Handle sensitive fields
    if (isSensitive) {
      const warning = document.createElement('div');
      warning.className = 'sensitive-field-warning';

      const icon = document.createElement('span');
      icon.className = 'warning-icon';
      icon.textContent = '⚠️';

      const text = document.createElement('span');
      text.textContent = 'Sensitive field - configure via .env file for security';

      warning.appendChild(icon);
      warning.appendChild(text);
      formGroup.appendChild(warning);

      const input = document.createElement('input');
      input.type = 'password';
      input.id = field.id;
      input.name = field.id;
      input.placeholder = field.placeholder || '';
      input.disabled = true;
      if (field.required) input.required = true;
      formGroup.appendChild(input);
    } else {
      // Create input based on type
      let inputElement;

      switch (field.type) {
        case 'select':
          inputElement = document.createElement('select');
          inputElement.id = field.id;
          inputElement.name = field.id;
          if (field.required) inputElement.required = true;

          // Add default option
          const defaultOpt = document.createElement('option');
          defaultOpt.value = '';
          defaultOpt.textContent = `Select ${field.label}`;
          inputElement.appendChild(defaultOpt);

          // Add field options
          (field.options || []).forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (value === opt.value) option.selected = true;
            inputElement.appendChild(option);
          });
          break;

        case 'number':
          inputElement = document.createElement('input');
          inputElement.type = 'number';
          inputElement.id = field.id;
          inputElement.name = field.id;
          inputElement.value = value;
          inputElement.placeholder = field.placeholder || '';
          if (field.min !== undefined) inputElement.min = field.min;
          if (field.max !== undefined) inputElement.max = field.max;
          if (field.required) inputElement.required = true;
          break;

        case 'textarea':
          inputElement = document.createElement('textarea');
          inputElement.id = field.id;
          inputElement.name = field.id;
          inputElement.value = value;
          inputElement.placeholder = field.placeholder || '';
          inputElement.rows = field.rows || 4;
          if (field.required) inputElement.required = true;
          break;

        default: // text
          inputElement = document.createElement('input');
          inputElement.type = 'text';
          inputElement.id = field.id;
          inputElement.name = field.id;
          inputElement.value = value;
          inputElement.placeholder = field.placeholder || '';
          if (field.required) inputElement.required = true;
      }

      formGroup.appendChild(inputElement);
    }

    // Add help text if available
    if (field.help) {
      const help = document.createElement('small');
      help.textContent = field.help;
      formGroup.appendChild(help);
    }

    form.appendChild(formGroup);
  });
}

// ===========================================================================
// Configuration Actions
// ===========================================================================

async function saveConfig(event) {
  if (event) {
    event.preventDefault();
  }

  if (!currentSourceName) {
    showToast('No data source selected', 'error');
    return;
  }

  const form = document.getElementById('config-form');
  const formData = new FormData(form);
  const config = {};

  // Build config object from form data
  for (const [key, value] of formData.entries()) {
    config[key] = value;
  }

  try {
    const response = await fetch(`/api/data-sources/${currentSourceName}/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to save configuration');
    }

    showToast('Configuration saved successfully', 'success');
    closeConfigModal();
    await loadDataSources(); // Refresh the list
  } catch (error) {
    console.error('Error saving configuration:', error);
    showToast('Failed to save configuration: ' + error.message, 'error');
  }
}

async function testConnection(sourceName) {
  try {
    showToast('Testing connection...', 'info');

    const response = await fetch(`/api/data-sources/${sourceName}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Connection test failed');
    }

    if (data.connected) {
      showToast('Connection test successful', 'success');
    } else {
      showToast('Connection test failed - check configuration', 'error');
    }

    // Refresh health data
    await loadDataSources();
  } catch (error) {
    console.error('Error testing connection:', error);
    showToast('Connection test failed: ' + error.message, 'error');
  }
}

async function toggleEnabled(sourceName, enabled) {
  try {
    const response = await fetch(`/api/data-sources/${sourceName}/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enabled })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to toggle data source');
    }

    showToast(`Data source ${enabled ? 'enabled' : 'disabled'} successfully`, 'success');

    // Refresh the list
    await loadDataSources();
  } catch (error) {
    console.error('Error toggling data source:', error);
    showToast('Failed to toggle data source: ' + error.message, 'error');

    // Refresh to reset the toggle
    await loadDataSources();
  }
}

// ===========================================================================
// Audit Log
// ===========================================================================

async function viewHistory() {
  if (!currentSourceName) {
    return;
  }

  const auditSection = document.getElementById('audit-log-section');
  const auditContent = document.getElementById('audit-log-content');
  auditContent.innerHTML = ''; // Clear existing content

  try {
    const response = await fetch(`/api/data-sources/${currentSourceName}/history?limit=20`);
    const data = await response.json();

    if (!data.success || !data.history || data.history.length === 0) {
      const message = document.createElement('p');
      message.className = 'form-message';
      message.textContent = 'No configuration history available';
      auditContent.appendChild(message);
      auditSection.style.display = 'block';
      return;
    }

    data.history.forEach(entry => {
      const auditEntry = document.createElement('div');
      auditEntry.className = 'audit-entry';

      const auditHeader = document.createElement('div');
      auditHeader.className = 'audit-header';

      const action = document.createElement('strong');
      action.textContent = entry.action;

      const time = document.createElement('span');
      time.className = 'audit-time';
      time.textContent = new Date(entry.timestamp).toLocaleString();

      auditHeader.appendChild(action);
      auditHeader.appendChild(time);

      const auditDetails = document.createElement('div');
      auditDetails.className = 'audit-details';

      const user = document.createElement('p');
      user.textContent = `By: ${entry.user}`;
      auditDetails.appendChild(user);

      if (entry.changes) {
        const changes = document.createElement('p');
        changes.textContent = `Changes: ${entry.changes}`;
        auditDetails.appendChild(changes);
      }

      auditEntry.appendChild(auditHeader);
      auditEntry.appendChild(auditDetails);
      auditContent.appendChild(auditEntry);
    });

    auditSection.style.display = 'block';
  } catch (error) {
    console.error('Error loading history:', error);
    showToast('Failed to load configuration history', 'error');
  }
}

// ===========================================================================
// Toast Notifications
// ===========================================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');

  toast.className = `toast toast-${type}`;

  const messageDiv = document.createElement('div');
  messageDiv.className = 'toast-message';
  messageDiv.textContent = message;

  toast.appendChild(messageDiv);
  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      container.removeChild(toast);
    }, 300);
  }, 4000);
}

// ===========================================================================
// Event Listeners
// ===========================================================================

function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', () => {
    renderDataSources();
  });

  // Modal close buttons
  const closeButton = document.querySelector('.close-button');
  const cancelButton = document.getElementById('cancel-button');

  closeButton.addEventListener('click', closeConfigModal);
  cancelButton.addEventListener('click', closeConfigModal);

  // Click outside modal to close
  const modal = document.getElementById('config-modal');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeConfigModal();
    }
  });

  // Form submit
  const form = document.getElementById('config-form');
  form.addEventListener('submit', saveConfig);

  // Test connection button
  const testButton = document.getElementById('test-connection-button');
  testButton.addEventListener('click', () => {
    if (currentSourceName) {
      testConnection(currentSourceName);
    }
  });

  // View history button
  const historyButton = document.getElementById('view-history-button');
  historyButton.addEventListener('click', viewHistory);
}

// ===========================================================================
// Export functions to window for inline event handlers
// ===========================================================================

window.openConfigModal = openConfigModal;
window.testConnection = testConnection;
window.toggleEnabled = toggleEnabled;

// ===========================================================================
// Start the app
// ===========================================================================

document.addEventListener('DOMContentLoaded', init);
