// ===========================================================================
// Salesforce Data Source Plugin — CRM analytics
// ===========================================================================

import { DataSource } from './base.js';

export class SalesforceDataSource extends DataSource {
  constructor(config = {}) {
    super('salesforce', config);
    this.instanceUrl = config.instanceUrl || process.env.SALESFORCE_INSTANCE_URL;
    this.accessToken = config.accessToken || process.env.SALESFORCE_ACCESS_TOKEN;
  }

  async fetchMetrics(widgetConfig) {
    console.warn('[salesforce] Using mock data - Salesforce API not yet implemented');
    return {
      timestamp: new Date().toISOString(),
      source: 'salesforce',
      data: this.getMockData(widgetConfig.type),
      widgetId: widgetConfig.id
    };
  }

  async testConnection() {
    return false;
  }

  getConfigSchema() {
    return {
      name: 'Salesforce',
      description: 'CRM and sales analytics',
      fields: [
        { name: 'instanceUrl', type: 'string', required: true, envVar: 'SALESFORCE_INSTANCE_URL' },
        { name: 'accessToken', type: 'string', required: true, secure: true, envVar: 'SALESFORCE_ACCESS_TOKEN' }
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
      { id: 'leads', name: 'Leads', type: 'number', widgets: ['big-number'] },
      { id: 'opportunities', name: 'Opportunities', type: 'number', widgets: ['stat-card'] }
    ];
  }
}

export const salesforceDataSource = new SalesforceDataSource();
