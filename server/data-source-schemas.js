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
