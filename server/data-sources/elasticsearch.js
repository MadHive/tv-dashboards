// ===========================================================================
// Elasticsearch Data Source Plugin — Search and analytics
// ===========================================================================

import { DataSource } from './base.js';

export class ElasticsearchDataSource extends DataSource {
  constructor(config = {}) {
    super('elasticsearch', config);
    this.host = config.host || process.env.ELASTICSEARCH_HOST;
    this.apiKey = config.apiKey || process.env.ELASTICSEARCH_API_KEY;
  }

  async fetchMetrics(widgetConfig) {
    console.warn('[elasticsearch] Using mock data - Elasticsearch not yet implemented');
    return {
      timestamp: new Date().toISOString(),
      source: 'elasticsearch',
      data: this.getMockData(widgetConfig.type),
      widgetId: widgetConfig.id
    };
  }

  async testConnection() {
    return false;
  }

  getConfigSchema() {
    return {
      name: 'Elasticsearch',
      description: 'Search and analytics engine',
      fields: [
        { name: 'host', type: 'string', required: true, envVar: 'ELASTICSEARCH_HOST' },
        { name: 'apiKey', type: 'string', required: true, secure: true, envVar: 'ELASTICSEARCH_API_KEY' }
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
      { id: 'doc_count', name: 'Document Count', type: 'number', widgets: ['big-number'] },
      { id: 'index_size', name: 'Index Size', type: 'bytes', widgets: ['stat-card'] }
    ];
  }
}

export const elasticsearchDataSource = new ElasticsearchDataSource();
