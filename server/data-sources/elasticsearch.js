// ===========================================================================
// Elasticsearch Data Source Plugin — Search and analytics
// ===========================================================================

import { DataSource } from './base.js';
import { Client } from '@elastic/elasticsearch';
import logger from '../logger.js';

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
        logger.warn('[elasticsearch] No Elasticsearch host found - data source will use mock data');
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
        logger.warn('[elasticsearch] No authentication credentials found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      this.client = new Client(clientConfig);
      this.isConnected = true;

      logger.info({ host: this.host }, 'Elasticsearch client initialized');
    } catch (error) {
      logger.error({ error: error.message }, 'Elasticsearch data source failed to initialize');
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
        logger.warn('[elasticsearch] Elasticsearch client not initialized - using mock data');
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
          logger.info('[elasticsearch] Cache hit for query');
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
      logger.error({ error: error.message }, 'Elasticsearch fetch metrics error');
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
        logger.info('[elasticsearch] Connection test successful');
        return true;
      }

      return false;
    } catch (error) {
      logger.error({ error: error.message }, 'Elasticsearch connection test failed');
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

  /**
   * Get mock data for testing when Elasticsearch not available
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return {
          value: Math.round(Math.random() * 100000),
          unit: 'docs'
        };

      case 'gauge':
      case 'gauge-row':
        return {
          value: Math.round(Math.random() * 100),
          min: 0,
          max: 100,
          unit: '%'
        };

      case 'bar-chart':
        return {
          values: [
            { label: 'errors', value: 145 },
            { label: 'warnings', value: 312 },
            { label: 'info', value: 4280 },
            { label: 'debug', value: 8910 }
          ]
        };

      case 'line-chart':
      case 'sparkline': {
        const now = Date.now();
        return {
          labels: Array.from({ length: 12 }, (_, i) =>
            new Date(now - (11 - i) * 300000).toISOString()
          ),
          values: Array.from({ length: 12 }, () =>
            Math.round(Math.random() * 1000)
          ),
          series: 'Mock Documents'
        };
      }

      default:
        return this.getEmptyData(widgetType);
    }
  }

  /**
   * Get available Elasticsearch metrics
   */
  getAvailableMetrics() {
    return [
      {
        id: 'log_count',
        name: 'Log Count',
        description: 'Total number of log documents',
        index: 'logs-*',
        aggregation: 'count',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart']
      },
      {
        id: 'error_rate',
        name: 'Error Rate',
        description: 'Percentage of error-level logs',
        index: 'logs-*',
        query: { match: { level: 'error' } },
        aggregation: 'count',
        type: 'percentage',
        widgets: ['gauge', 'gauge-row', 'big-number']
      },
      {
        id: 'response_time_avg',
        name: 'Average Response Time',
        description: 'Average API response time',
        index: 'metrics-*',
        aggregation: 'avg',
        field: 'response_time_ms',
        type: 'duration',
        widgets: ['gauge', 'line-chart', 'big-number']
      },
      {
        id: 'request_rate',
        name: 'Request Rate',
        description: 'Requests per time interval',
        index: 'metrics-*',
        aggregation: 'count',
        type: 'number',
        widgets: ['line-chart', 'bar-chart', 'big-number']
      },
      {
        id: 'unique_users',
        name: 'Unique Users',
        description: 'Unique user count',
        index: 'events-*',
        aggregation: 'cardinality',
        field: 'user_id',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'disk_usage',
        name: 'Index Disk Usage',
        description: 'Total disk space used by indices',
        aggregation: 'sum',
        field: 'store.size_in_bytes',
        type: 'bytes',
        widgets: ['big-number', 'gauge']
      },
      {
        id: 'search_latency_p95',
        name: 'Search Latency (p95)',
        description: '95th percentile search latency',
        aggregation: 'percentiles',
        field: 'search_time_ms',
        type: 'duration',
        widgets: ['gauge', 'line-chart']
      },
      {
        id: 'custom_aggregation',
        name: 'Custom Aggregation',
        description: 'User-defined custom aggregation',
        aggregation: 'count',
        type: 'number',
        widgets: ['big-number', 'gauge', 'line-chart', 'bar-chart']
      }
    ];
  }
}

export const elasticsearchDataSource = new ElasticsearchDataSource();
