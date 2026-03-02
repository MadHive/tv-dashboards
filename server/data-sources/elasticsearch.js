// ===========================================================================
// Elasticsearch Data Source Plugin — Search and analytics
// ===========================================================================

import { DataSource } from './base.js';
import { Client } from '@elastic/elasticsearch';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Elasticsearch data source for search analytics and cluster metrics
 *
 * Configuration:
 * - Set ELASTICSEARCH_HOST environment variable (e.g., https://localhost:9200)
 * - Set ELASTICSEARCH_API_KEY or ELASTICSEARCH_USERNAME/PASSWORD
 */
export class ElasticsearchDataSource extends DataSource {
  constructor(config = {}) {
    super('elasticsearch', config);
    this.host = config.host || process.env.ELASTICSEARCH_HOST;
    this.apiKey = config.apiKey || process.env.ELASTICSEARCH_API_KEY;
    this.username = config.username || process.env.ELASTICSEARCH_USERNAME;
    this.password = config.password || process.env.ELASTICSEARCH_PASSWORD;
    this.client = null;
    this.metricCache = new Map();
  }

  /**
   * Initialize Elasticsearch client
   */
  async initialize() {
    try {
      // Check if connection info is available
      if (!this.host) {
        console.warn('[elasticsearch] No Elasticsearch host found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      // Build client configuration
      const clientConfig = {
        node: this.host
      };

      // Use API key if available, otherwise basic auth
      if (this.apiKey) {
        clientConfig.auth = {
          apiKey: this.apiKey
        };
      } else if (this.username && this.password) {
        clientConfig.auth = {
          username: this.username,
          password: this.password
        };
      } else {
        console.warn('[elasticsearch] No authentication credentials found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      this.client = new Client(clientConfig);
      this.isConnected = true;

      console.log('[elasticsearch] Elasticsearch client initialized for:', this.host);
    } catch (error) {
      console.error('[elasticsearch] Failed to initialize:', error.message);
      this.lastError = error;
      this.isConnected = false;
    }
  }

  async fetchMetrics(widgetConfig) {
    console.warn('[elasticsearch] Using mock data - fetchMetrics not yet implemented');
    return {
      timestamp: new Date().toISOString(),
      source: 'elasticsearch',
      data: this.getMockData(widgetConfig.type),
      widgetId: widgetConfig.id
    };
  }

  async testConnection() {
    return false; // Not implemented
  }

  getConfigSchema() {
    return {
      name: 'Elasticsearch',
      description: 'Search and analytics engine',
      fields: [
        {
          name: 'host',
          type: 'string',
          required: true,
          description: 'Elasticsearch host URL',
          example: 'https://localhost:9200',
          envVar: 'ELASTICSEARCH_HOST'
        },
        {
          name: 'apiKey',
          type: 'string',
          required: false,
          description: 'Elasticsearch API Key (preferred)',
          secure: true,
          envVar: 'ELASTICSEARCH_API_KEY'
        },
        {
          name: 'username',
          type: 'string',
          required: false,
          description: 'Elasticsearch username (if not using API key)',
          envVar: 'ELASTICSEARCH_USERNAME'
        },
        {
          name: 'password',
          type: 'string',
          required: false,
          description: 'Elasticsearch password (if not using API key)',
          secure: true,
          envVar: 'ELASTICSEARCH_PASSWORD'
        },
        {
          name: 'index',
          type: 'string',
          required: false,
          description: 'Index pattern to query',
          example: 'logs-*'
        }
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
