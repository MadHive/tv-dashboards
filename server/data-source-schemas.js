// server/data-source-schemas.js

/**
 * Data Source Schema Definitions
 * Provides field schemas for each data source type
 */

export const dataSourceSchemas = {
  bigquery: {
    id: 'bigquery',
    name: 'Google BigQuery',
    description: 'Connect to Google BigQuery for SQL-based data queries',
    fields: [
      {
        id: 'name',
        type: 'text',
        label: 'Connection Name',
        required: true,
        placeholder: 'e.g., Production BigQuery',
        help: 'A friendly name for this connection'
      },
      {
        id: 'projectId',
        type: 'text',
        label: 'GCP Project ID',
        required: true,
        placeholder: 'my-gcp-project',
        help: 'Your Google Cloud Platform project ID',
        validate: (value) => {
          if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value)) {
            return 'Invalid GCP project ID format';
          }
          return null;
        }
      },
      {
        id: 'dataset',
        type: 'text',
        label: 'Default Dataset',
        placeholder: 'my_dataset',
        help: 'Optional default dataset for queries'
      },
      {
        id: 'location',
        type: 'select',
        label: 'Location',
        options: [
          { value: 'US', label: 'US (multi-region)' },
          { value: 'EU', label: 'EU (multi-region)' },
          { value: 'us-east1', label: 'us-east1' },
          { value: 'us-west1', label: 'us-west1' }
        ],
        help: 'BigQuery dataset location'
      }
    ]
  },

  'gcp-monitoring': {
    id: 'gcp-monitoring',
    name: 'GCP Cloud Monitoring',
    description: 'Connect to Google Cloud Monitoring for metrics and logs',
    fields: [
      {
        id: 'name',
        type: 'text',
        label: 'Connection Name',
        required: true,
        placeholder: 'e.g., Production Monitoring'
      },
      {
        id: 'projectId',
        type: 'text',
        label: 'GCP Project ID',
        required: true,
        placeholder: 'my-gcp-project',
        validate: (value) => {
          if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value)) {
            return 'Invalid GCP project ID format';
          }
          return null;
        }
      },
      {
        id: 'refreshInterval',
        type: 'number',
        label: 'Refresh Interval (seconds)',
        min: 30,
        max: 3600,
        placeholder: '60',
        help: 'How often to refresh metrics data'
      }
    ]
  },

  mock: {
    id: 'mock',
    name: 'Mock Data Source',
    description: 'Simulated data source for testing and development',
    fields: [
      {
        id: 'name',
        type: 'text',
        label: 'Connection Name',
        required: true,
        placeholder: 'e.g., Test Mock Data'
      },
      {
        id: 'delay',
        type: 'number',
        label: 'Simulated Delay (ms)',
        min: 0,
        max: 5000,
        placeholder: '100',
        help: 'Artificial delay to simulate network latency'
      },
      {
        id: 'errorRate',
        type: 'number',
        label: 'Error Rate (%)',
        min: 0,
        max: 100,
        placeholder: '0',
        help: 'Percentage of requests that should fail (for testing error handling)'
      }
    ]
  },

  checkly: {
    id: 'checkly',
    name: 'Checkly',
    description: 'API monitoring and synthetic checks platform',
    fields: [
      {
        id: 'name',
        type: 'text',
        label: 'Connection Name',
        required: true,
        placeholder: 'e.g., Production Checkly'
      },
      {
        id: 'apiKey',
        type: 'password',
        label: 'API Key',
        required: true,
        placeholder: 'cu_xxxxx',
        help: 'Your Checkly API key from Account Settings'
      },
      {
        id: 'accountId',
        type: 'text',
        label: 'Account ID',
        required: true,
        placeholder: 'abc123',
        help: 'Your Checkly account ID'
      }
    ]
  },

  chromatic: {
    id: 'chromatic',
    name: 'Chromatic',
    description: 'Visual testing and UI review platform',
    fields: [
      {
        id: 'name',
        type: 'text',
        label: 'Connection Name',
        required: true,
        placeholder: 'e.g., Production Chromatic'
      },
      {
        id: 'projectToken',
        type: 'password',
        label: 'Project Token',
        required: true,
        placeholder: 'chpt_xxxxx',
        help: 'Your Chromatic project token'
      },
      {
        id: 'projectId',
        type: 'text',
        label: 'Project ID',
        required: true,
        placeholder: '12345',
        help: 'Your Chromatic project ID'
      }
    ]
  },

  looker: {
    id: 'looker',
    name: 'Looker',
    description: 'Business intelligence and analytics platform',
    fields: [
      {
        id: 'name',
        type: 'text',
        label: 'Connection Name',
        required: true,
        placeholder: 'e.g., Production Looker'
      },
      {
        id: 'baseUrl',
        type: 'text',
        label: 'Looker Instance URL',
        required: true,
        placeholder: 'https://your-company.looker.com',
        help: 'Your Looker instance URL'
      },
      {
        id: 'clientId',
        type: 'text',
        label: 'Client ID',
        required: true,
        placeholder: 'xxxxx',
        help: 'API3 client ID from Admin > Users > Edit'
      },
      {
        id: 'clientSecret',
        type: 'password',
        label: 'Client Secret',
        required: true,
        help: 'API3 client secret'
      }
    ]
  },

  rollbar: {
    id: 'rollbar',
    name: 'Rollbar',
    description: 'Error tracking and monitoring platform',
    fields: [
      {
        id: 'name',
        type: 'text',
        label: 'Connection Name',
        required: true,
        placeholder: 'e.g., Production Rollbar'
      },
      {
        id: 'accessToken',
        type: 'password',
        label: 'Access Token',
        required: true,
        placeholder: 'xxxxx',
        help: 'Read access token from Project Settings > Project Access Tokens'
      },
      {
        id: 'projectName',
        type: 'text',
        label: 'Project Name',
        required: true,
        placeholder: 'my-project',
        help: 'Your Rollbar project name'
      }
    ]
  },

  rootly: {
    id: 'rootly',
    name: 'Rootly',
    description: 'Incident management and response platform',
    fields: [
      {
        id: 'name',
        type: 'text',
        label: 'Connection Name',
        required: true,
        placeholder: 'e.g., Production Rootly'
      },
      {
        id: 'apiKey',
        type: 'password',
        label: 'API Key',
        required: true,
        placeholder: 'xxxxx',
        help: 'Your Rootly API key from Settings > API Keys'
      },
      {
        id: 'baseUrl',
        type: 'text',
        label: 'Rootly Instance URL',
        required: true,
        placeholder: 'https://rootly.com',
        help: 'Your Rootly instance URL (default: https://rootly.com)'
      }
    ]
  },

  segment: {
    id: 'segment',
    name: 'Segment',
    description: 'Customer data platform and analytics',
    fields: [
      {
        id: 'name',
        type: 'text',
        label: 'Connection Name',
        required: true,
        placeholder: 'e.g., Production Segment'
      },
      {
        id: 'accessToken',
        type: 'password',
        label: 'Access Token',
        required: true,
        placeholder: 'xxxxx',
        help: 'Public API access token from Settings > Workspace Settings > Access Management'
      },
      {
        id: 'workspaceId',
        type: 'text',
        label: 'Workspace ID',
        required: true,
        placeholder: 'workspace-id',
        help: 'Your Segment workspace ID'
      }
    ]
  }
};

/**
 * Get schema for a specific data source
 */
export function getSchema(sourceId) {
  return dataSourceSchemas[sourceId] || null;
}

/**
 * Get all available data source schemas
 */
export function getAllSchemas() {
  return Object.values(dataSourceSchemas);
}

/**
 * Validate connection data against schema
 */
export function validateConnection(sourceId, data) {
  const schema = getSchema(sourceId);
  if (!schema) {
    return { valid: false, errors: { _general: 'Unknown data source type' } };
  }

  const errors = {};

  schema.fields.forEach(field => {
    const value = data[field.id];

    // Required field validation
    if (field.required && (value === '' || value === null || value === undefined)) {
      errors[field.id] = `${field.label} is required`;
      return;
    }

    // Skip further validation if no value and not required
    if (!field.required && (value === '' || value === null || value === undefined)) {
      return;
    }

    // Type validation
    if (field.type === 'number' && value !== '') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        errors[field.id] = 'Must be a number';
        return;
      }
      if (field.min !== undefined && numValue < field.min) {
        errors[field.id] = `Must be at least ${field.min}`;
        return;
      }
      if (field.max !== undefined && numValue > field.max) {
        errors[field.id] = `Must be at most ${field.max}`;
        return;
      }
    }

    // Custom validation
    if (field.validate && value) {
      const error = field.validate(value);
      if (error) {
        errors[field.id] = error;
      }
    }
  });

  const valid = Object.keys(errors).length === 0;
  return { valid, errors };
}
