// ===========================================================================
// FullStory Data Source Plugin — Digital experience analytics
// ===========================================================================

import { DataSource } from './base.js';

export class FullStoryDataSource extends DataSource {
  constructor(config = {}) {
    super('fullstory', config);
    this.apiKey = config.apiKey || process.env.FULLSTORY_API_KEY;
  }

  async fetchMetrics(widgetConfig) {
    console.warn('[fullstory] Using mock data - FullStory API not yet implemented');
    return {
      timestamp: new Date().toISOString(),
      source: 'fullstory',
      data: this.getMockData(widgetConfig.type),
      widgetId: widgetConfig.id
    };
  }

  async testConnection() {
    return false;
  }

  getConfigSchema() {
    return {
      name: 'FullStory',
      description: 'Digital experience analytics and session replay',
      fields: [
        { name: 'apiKey', type: 'string', required: true, secure: true, envVar: 'FULLSTORY_API_KEY' }
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
      { id: 'rage_clicks', name: 'Rage Clicks', type: 'number', widgets: ['stat-card'] }
    ];
  }
}

export const fullStoryDataSource = new FullStoryDataSource();
