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

  /**
   * Fetch metrics for a widget
   *
   * Widget config should include:
   * - index: Index pattern (e.g., 'logs-*')
   * - query: Elasticsearch query DSL (optional)
   * - aggregation: Aggregation to perform (count, avg, sum, etc.)
   * - field: Field to aggregate on (for avg, sum, etc.)
   * - timeField: Time field name (default: '@timestamp')
   * - timeRange: Time range in seconds (default: 3600 = 1 hour)
   */
  async fetchMetrics(widgetConfig) {
    try {
      if (!this.client) {
        console.warn('[elasticsearch] Elasticsearch client not initialized - using mock data');
        return {
          timestamp: new Date().toISOString(),
          source: 'elasticsearch',
          data: this.getMockData(widgetConfig.type),
          widgetId: widgetConfig.id
        };
      }

      // Extract Elasticsearch parameters
      const {
        index = '_all',
        query = { match_all: {} },
        aggregation = 'count',
        field,
        timeField = '@timestamp',
        timeRange = 3600,
        interval = '5m'
      } = widgetConfig;

      // Build time range query
      const now = Date.now();
      const from = new Date(now - (timeRange * 1000));
      const to = new Date(now);

      // Check cache
      const cacheKey = JSON.stringify({ index, query, aggregation, field, from: from.toISOString(), to: to.toISOString() });
      if (this.metricCache.has(cacheKey)) {
        const cached = this.metricCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          console.log('[elasticsearch] Cache hit for query');
          return {
            timestamp: new Date().toISOString(),
            source: 'elasticsearch',
            data: this.transformData(cached.data, widgetConfig.type, aggregation),
            widgetId: widgetConfig.id,
            cached: true
          };
        }
      }

      // Build search request based on aggregation type
      let searchBody;

      if (aggregation === 'count') {
        searchBody = {
          query: {
            bool: {
              must: [query],
              filter: {
                range: {
                  [timeField]: {
                    gte: from.toISOString(),
                    lte: to.toISOString()
                  }
                }
              }
            }
          },
          size: 0
        };
      } else {
        // For time-series data (avg, sum, etc. over time)
        searchBody = {
          query: {
            bool: {
              must: [query],
              filter: {
                range: {
                  [timeField]: {
                    gte: from.toISOString(),
                    lte: to.toISOString()
                  }
                }
              }
            }
          },
          size: 0,
          aggs: {
            time_buckets: {
              date_histogram: {
                field: timeField,
                fixed_interval: interval
              },
              aggs: field ? {
                metric: {
                  [aggregation]: {
                    field: field
                  }
                }
              } : {}
            }
          }
        };
      }

      // Execute search
      const response = await this.client.search({
        index,
        body: searchBody
      });

      // Cache the result
      this.metricCache.set(cacheKey, {
        data: response,
        timestamp: Date.now()
      });

      return {
        timestamp: new Date().toISOString(),
        source: 'elasticsearch',
        data: this.transformData(response, widgetConfig.type, aggregation),
        widgetId: widgetConfig.id
      };
    } catch (error) {
      console.error('[elasticsearch] Fetch metrics error:', error.message);
      return this.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Test connection to Elasticsearch
   */
  async testConnection() {
    try {
      if (!this.client) {
        return false;
      }

      // Ping the cluster
      const response = await this.client.ping();

      if (response) {
        console.log('[elasticsearch] Connection test successful');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[elasticsearch] Connection test failed:', error.message);
      this.lastError = error;
      return false;
    }
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

  /**
   * Transform Elasticsearch response to widget format
   */
  transformData(response, widgetType, aggregation = 'count') {
    if (!response) {
      return this.getEmptyData(widgetType);
    }

    // Handle simple count aggregation
    if (aggregation === 'count' && !response.aggregations) {
      const count = response.hits?.total?.value || 0;

      switch (widgetType) {
        case 'big-number':
        case 'stat-card':
          return {
            value: count,
            unit: 'docs'
          };

        case 'gauge':
        case 'gauge-row':
          return {
            value: count,
            min: 0,
            max: count * 1.2, // 20% headroom
            unit: 'docs'
          };

        default:
          return { value: count };
      }
    }

    // Handle time-series aggregations
    if (response.aggregations?.time_buckets?.buckets) {
      const buckets = response.aggregations.time_buckets.buckets;

      if (buckets.length === 0) {
        return this.getEmptyData(widgetType);
      }

      switch (widgetType) {
        case 'big-number':
        case 'stat-card': {
          // Use latest value
          const latest = buckets[buckets.length - 1];
          const previous = buckets.length > 1 ? buckets[buckets.length - 2] : latest;

          const latestValue = latest.metric?.value || latest.doc_count;
          const previousValue = previous.metric?.value || previous.doc_count;
          const trend = latestValue > previousValue ? 'up' : latestValue < previousValue ? 'down' : 'stable';

          return {
            value: Math.round(latestValue * 100) / 100,
            previous: Math.round(previousValue * 100) / 100,
            trend
          };
        }

        case 'gauge':
        case 'gauge-row': {
          const latest = buckets[buckets.length - 1];
          const value = latest.metric?.value || latest.doc_count;

          return {
            value: Math.round(value * 100) / 100,
            min: 0,
            max: 100,
            unit: '%'
          };
        }

        case 'line-chart':
        case 'sparkline': {
          return {
            labels: buckets.map(b => new Date(b.key).toISOString()),
            values: buckets.map(b => {
              const val = b.metric?.value || b.doc_count;
              return Math.round(val * 100) / 100;
            }),
            series: 'Elasticsearch'
          };
        }

        case 'bar-chart': {
          const lastN = Math.min(10, buckets.length);
          const recentBuckets = buckets.slice(-lastN);

          return {
            values: recentBuckets.map(b => {
              const val = b.metric?.value || b.doc_count;
              return {
                label: new Date(b.key).toLocaleTimeString(),
                value: Math.round(val * 100) / 100
              };
            })
          };
        }

        default:
          return { buckets };
      }
    }

    // Return raw data for unsupported formats
    return response;
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
