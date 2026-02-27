// public/js/components/data-source-connector.js

import { WizardFramework } from './wizard-framework.js';
import { FormBuilder } from './form-builder.js';

/**
 * DataSourceConnector - Guide users through connecting to data sources
 */
export class DataSourceConnector {
  constructor(config = {}) {
    this.config = {
      onConnect: config.onConnect || (() => {}),
      onCancel: config.onCancel || (() => {}),
      availableSources: config.availableSources || []
    };
    this.wizard = null;
    this.container = null;
  }

  render(container) {
    if (!container) {
      console.error('DataSourceConnector: container is required');
      return;
    }

    this.container = container;
    container.textContent = '';
    container.classList.add('data-source-connector');

    // Create wizard with steps
    this.wizard = new WizardFramework({
      steps: [
        {
          id: 'select-source',
          title: 'Select Data Source',
          component: this._createSelectSourceStep.bind(this),
          validate: (data) => !!data.sourceType
        },
        {
          id: 'configure',
          title: 'Configure Connection',
          component: this._createConfigureStep.bind(this),
          validate: (data) => this._validateConnection(data)
        },
        {
          id: 'test',
          title: 'Test Connection',
          component: this._createTestStep.bind(this),
          validate: () => true
        }
      ],
      onComplete: (data) => {
        try {
          this.config.onConnect(data);
        } catch (error) {
          console.error('Connection callback error:', error);
        }
      },
      onCancel: () => {
        try {
          this.config.onCancel();
        } catch (error) {
          console.error('Cancel callback error:', error);
        }
      }
    });

    this.wizard.render(container);
  }

  _createSelectSourceStep(data) {
    return {
      render: (container) => {
        const form = new FormBuilder({
          fields: [
            {
              id: 'sourceType',
              type: 'select',
              label: 'Data Source Type',
              required: true,
              placeholder: 'Choose a data source...',
              options: this.config.availableSources.length > 0
                ? this.config.availableSources.map(s => ({
                    value: s.id,
                    label: s.name
                  }))
                : [
                    { value: 'bigquery', label: 'Google BigQuery' },
                    { value: 'gcp-monitoring', label: 'GCP Cloud Monitoring' },
                    { value: 'mock', label: 'Mock Data (for testing)' }
                  ],
              help: 'Select the type of data source you want to connect'
            }
          ]
        });

        form.render(container);
        if (data.sourceType) {
          form.setData({ sourceType: data.sourceType });
        }
      }
    };
  }

  _createConfigureStep(data) {
    return {
      render: (container) => {
        const sourceType = data.sourceType;

        if (!sourceType) {
          const error = document.createElement('div');
          error.style.cssText = 'padding: 20px; text-align: center; color: #ef4444;';
          error.textContent = 'Please select a data source type first';
          container.appendChild(error);
          return;
        }

        const fields = this._getConfigFieldsForSource(sourceType);
        const form = new FormBuilder({ fields });
        form.render(container);

        // Pre-fill with existing data
        if (data.config) {
          form.setData(data.config);
        }
      }
    };
  }

  _createTestStep(data) {
    return {
      render: (container) => {
        const title = document.createElement('h3');
        title.textContent = 'Connection Configuration';
        title.style.cssText = 'font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #1f2937;';
        container.appendChild(title);

        const summary = document.createElement('div');
        summary.style.cssText = 'padding: 16px; background: #f9fafb; border-radius: 8px; margin-bottom: 20px;';

        const sourceLabel = document.createElement('p');
        sourceLabel.style.cssText = 'font-size: 14px; color: #374151; margin-bottom: 8px;';
        const sourceLabelStrong = document.createElement('strong');
        sourceLabelStrong.textContent = 'Source Type:';
        sourceLabel.appendChild(sourceLabelStrong);
        sourceLabel.appendChild(document.createTextNode(' ' + (data.sourceType || 'None')));
        summary.appendChild(sourceLabel);

        if (data.name) {
          const nameLabel = document.createElement('p');
          nameLabel.style.cssText = 'font-size: 14px; color: #374151;';
          const nameLabelStrong = document.createElement('strong');
          nameLabelStrong.textContent = 'Connection Name:';
          nameLabel.appendChild(nameLabelStrong);
          nameLabel.appendChild(document.createTextNode(' ' + data.name));
          summary.appendChild(nameLabel);
        }

        container.appendChild(summary);

        const message = document.createElement('div');
        message.style.cssText = 'padding: 16px; background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; color: #1e40af;';
        message.textContent = 'Click "Complete" to save this connection configuration.';
        container.appendChild(message);
      }
    };
  }

  _getConfigFieldsForSource(sourceType) {
    const commonFields = [
      {
        id: 'name',
        type: 'text',
        label: 'Connection Name',
        required: true,
        placeholder: 'e.g., Production BigQuery',
        help: 'A friendly name for this connection'
      }
    ];

    switch (sourceType) {
      case 'bigquery':
        return [
          ...commonFields,
          {
            id: 'projectId',
            type: 'text',
            label: 'GCP Project ID',
            required: true,
            placeholder: 'my-gcp-project',
            help: 'Your Google Cloud Platform project ID'
          },
          {
            id: 'dataset',
            type: 'text',
            label: 'BigQuery Dataset',
            placeholder: 'my_dataset (optional)'
          }
        ];

      case 'gcp-monitoring':
        return [
          ...commonFields,
          {
            id: 'projectId',
            type: 'text',
            label: 'GCP Project ID',
            required: true,
            placeholder: 'my-gcp-project'
          }
        ];

      case 'mock':
        return [
          ...commonFields,
          {
            id: 'delay',
            type: 'number',
            label: 'Simulated Delay (ms)',
            min: 0,
            max: 5000,
            placeholder: '100',
            help: 'Artificial delay to simulate network latency'
          }
        ];

      default:
        return commonFields;
    }
  }

  _validateConnection(data) {
    if (!data.name) return false;
    if (!data.sourceType) return false;

    switch (data.sourceType) {
      case 'bigquery':
      case 'gcp-monitoring':
        return !!data.projectId;
      case 'mock':
        return true;
      default:
        return false;
    }
  }

  destroy() {
    if (this.wizard) {
      this.wizard.destroy();
      this.wizard = null;
    }
    if (this.container) {
      this.container.textContent = '';
      this.container = null;
    }
  }
}
