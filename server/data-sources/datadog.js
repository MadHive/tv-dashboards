// ===========================================================================
// DataDog Data Source Plugin — Application monitoring and analytics
// ===========================================================================

import { DataSource } from './base.js';
import { client, v1 } from '@datadog/datadog-api-client';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * DataDog data source for application monitoring and analytics
 *
 * Configuration:
 * - Set DATADOG_API_KEY environment variable
 * - Set DATADOG_APP_KEY environment variable
 */
export class DataDogDataSource extends DataSource {
  constructor(config = {}) {
    super('datadog', config);
    this.apiKey = config.apiKey || process.env.DATADOG_API_KEY;
    this.appKey = config.appKey || process.env.DATADOG_APP_KEY;
    this.client = null;
    this.metricsApi = null;
    this.metricCache = new Map();
  }

  /**
   * Initialize DataDog client
   */
  async initialize() {
    try {
      // Check if credentials are available
      if (!this.apiKey || !this.appKey) {
        console.warn('[datadog] No DataDog credentials found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      // Configure DataDog client
      const configuration = client.createConfiguration({
        authMethods: {
          apiKeyAuth: this.apiKey,
          appKeyAuth: this.appKey
        }
      });

      this.client = configuration;
      this.metricsApi = new v1.MetricsApi(configuration);
      this.isConnected = true;

      console.log('[datadog] DataDog client initialized');
    } catch (error) {
      console.error('[datadog] Failed to initialize:', error.message);
      this.lastError = error;
      this.isConnected = false;
    }
  }

  /**
   * Fetch metrics for a widget
   *
   * Widget config should include:
   * - metric: Metric query (e.g., 'avg:system.cpu.user{*}')
   * - from: Start time (seconds since epoch, default: 1 hour ago)
   * - to: End time (seconds since epoch, default: now)
   */
  async fetchMetrics(widgetConfig) {
    try {
      if (!this.metricsApi) {
        console.warn('[datadog] DataDog client not initialized - using mock data');
        return {
          timestamp: new Date().toISOString(),
          source: 'datadog',
          data: this.getMockData(widgetConfig.type),
          widgetId: widgetConfig.id
        };
      }

      // Extract DataDog metric parameters
      const {
        metric = 'avg:system.cpu.user{*}',
        from: fromTime,
        to: toTime
      } = widgetConfig;

      // Default time range: last hour
      const to = toTime || Math.floor(Date.now() / 1000);
      const from = fromTime || (to - 3600);

      // Check cache
      const cacheKey = JSON.stringify({ metric, from, to });
      if (this.metricCache.has(cacheKey)) {
        const cached = this.metricCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          console.log('[datadog] Cache hit for metric:', metric);
          return {
            timestamp: new Date().toISOString(),
            source: 'datadog',
            data: this.transformData(cached.data, widgetConfig.type),
            widgetId: widgetConfig.id,
            cached: true
          };
        }
      }

      // Query DataDog API
      const params = {
        query: metric,
        from,
        to
      };

      const response = await this.metricsApi.queryMetrics(params);

      // Cache the result
      this.metricCache.set(cacheKey, {
        data: response,
        timestamp: Date.now()
      });

      return {
        timestamp: new Date().toISOString(),
        source: 'datadog',
        data: this.transformData(response, widgetConfig.type),
        widgetId: widgetConfig.id
      };
    } catch (error) {
      console.error('[datadog] Fetch metrics error:', error.message);
      return this.handleError(error, widgetConfig.type);
    }
  }

  async testConnection() {
    return false; // Not implemented
  }

  getConfigSchema() {
    return {
      name: 'DataDog',
      description: 'Application monitoring and analytics from DataDog',
      fields: [
        {
          name: 'apiKey',
          type: 'string',
          required: true,
          description: 'DataDog API Key',
          secure: true,
          envVar: 'DATADOG_API_KEY'
        },
        {
          name: 'appKey',
          type: 'string',
          required: true,
          description: 'DataDog Application Key',
          secure: true,
          envVar: 'DATADOG_APP_KEY'
        },
        {
          name: 'metric',
          type: 'string',
          required: false,
          description: 'DataDog metric name',
          example: 'system.cpu.user'
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
      { id: 'apm_requests', name: 'APM Requests', type: 'number', widgets: ['big-number', 'bar-chart'] },
      { id: 'error_rate', name: 'Error Rate', type: 'percentage', widgets: ['gauge'] }
    ];
  }
}

export const dataDogDataSource = new DataDogDataSource();
