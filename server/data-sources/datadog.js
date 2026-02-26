// ===========================================================================
// DataDog Data Source Plugin — Application monitoring and analytics
// ===========================================================================

import { DataSource } from './base.js';

export class DataDogDataSource extends DataSource {
  constructor(config = {}) {
    super('datadog', config);
    this.apiKey = config.apiKey || process.env.DATADOG_API_KEY;
    this.appKey = config.appKey || process.env.DATADOG_APP_KEY;
  }

  async fetchMetrics(widgetConfig) {
    console.warn('[datadog] Using mock data - DataDog API not yet implemented');
    return {
      timestamp: new Date().toISOString(),
      source: 'datadog',
      data: this.getMockData(widgetConfig.type),
      widgetId: widgetConfig.id
    };
  }

  async testConnection() {
    return false; // Not implemented
  }

  getConfigSchema() {
    return {
      name: 'DataDog',
      description: 'Application monitoring and analytics',
      fields: [
        { name: 'apiKey', type: 'string', required: true, secure: true, envVar: 'DATADOG_API_KEY' },
        { name: 'appKey', type: 'string', required: true, secure: true, envVar: 'DATADOG_APP_KEY' }
      ]
    };
  }

  transformData(raw, widgetType) {
    return raw;
  }

  getMockData(widgetType) {
    return this.getEmptyData(widgetType);
  }

  getAvailableMetrics() {
    return [
      { id: 'apm_requests', name: 'APM Requests', type: 'number', widgets: ['big-number', 'bar-chart'] },
      { id: 'error_rate', name: 'Error Rate', type: 'percentage', widgets: ['gauge'] }
    ];
  }
}

export const dataDogDataSource = new DataDogDataSource();
