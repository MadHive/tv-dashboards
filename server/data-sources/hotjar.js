// ===========================================================================
// HotJar Data Source Plugin — User behavior analytics
// ===========================================================================

import { DataSource } from './base.js';

export class HotJarDataSource extends DataSource {
  constructor(config = {}) {
    super('hotjar', config);
    this.apiKey = config.apiKey || process.env.HOTJAR_API_KEY;
    this.siteId = config.siteId || process.env.HOTJAR_SITE_ID;
  }

  async fetchMetrics(widgetConfig) {
    console.warn('[hotjar] Using mock data - HotJar API not yet implemented');
    return {
      timestamp: new Date().toISOString(),
      source: 'hotjar',
      data: this.getMockData(widgetConfig.type),
      widgetId: widgetConfig.id
    };
  }

  async testConnection() {
    return false;
  }

  getConfigSchema() {
    return {
      name: 'HotJar',
      description: 'User behavior and heatmap analytics',
      fields: [
        { name: 'apiKey', type: 'string', required: true, secure: true, envVar: 'HOTJAR_API_KEY' },
        { name: 'siteId', type: 'string', required: true, envVar: 'HOTJAR_SITE_ID' }
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
      { id: 'sessions', name: 'Sessions', type: 'number', widgets: ['big-number'] },
      { id: 'heatmap_clicks', name: 'Heatmap Clicks', type: 'number', widgets: ['stat-card'] }
    ];
  }
}

export const hotJarDataSource = new HotJarDataSource();
