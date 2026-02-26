// ===========================================================================
// Zendesk Data Source Plugin — Customer support analytics
// ===========================================================================

import { DataSource } from './base.js';

export class ZendeskDataSource extends DataSource {
  constructor(config = {}) {
    super('zendesk', config);
    this.subdomain = config.subdomain || process.env.ZENDESK_SUBDOMAIN;
    this.apiToken = config.apiToken || process.env.ZENDESK_API_TOKEN;
    this.email = config.email || process.env.ZENDESK_EMAIL;
  }

  async fetchMetrics(widgetConfig) {
    console.warn('[zendesk] Using mock data - Zendesk API not yet implemented');
    return {
      timestamp: new Date().toISOString(),
      source: 'zendesk',
      data: this.getMockData(widgetConfig.type),
      widgetId: widgetConfig.id
    };
  }

  async testConnection() {
    return false;
  }

  getConfigSchema() {
    return {
      name: 'Zendesk',
      description: 'Customer support and ticketing system',
      fields: [
        { name: 'subdomain', type: 'string', required: true, envVar: 'ZENDESK_SUBDOMAIN' },
        { name: 'email', type: 'string', required: true, envVar: 'ZENDESK_EMAIL' },
        { name: 'apiToken', type: 'string', required: true, secure: true, envVar: 'ZENDESK_API_TOKEN' }
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
      { id: 'open_tickets', name: 'Open Tickets', type: 'number', widgets: ['big-number'] },
      { id: 'response_time', name: 'Avg Response Time', type: 'duration', widgets: ['gauge'] }
    ];
  }
}

export const zendeskDataSource = new ZendeskDataSource();
