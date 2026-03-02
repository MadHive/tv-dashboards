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

  /**
   * Test connection to DataDog API
   */
  async testConnection() {
    try {
      if (!this.metricsApi) {
        return false;
      }

      // Try to query a simple metric (last 5 minutes)
      const now = Math.floor(Date.now() / 1000);
      const params = {
        query: 'avg:system.load.1{*}',
        from: now - 300,
        to: now
      };

      await this.metricsApi.queryMetrics(params);
      console.log('[datadog] Connection test successful');
      return true;
    } catch (error) {
      console.error('[datadog] Connection test failed:', error.message);
      this.lastError = error;
      return false;
    }
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

  /**
   * Transform DataDog API response to widget format
   */
  transformData(response, widgetType) {
    if (!response || !response.series || response.series.length === 0) {
      return this.getEmptyData(widgetType);
    }

    const series = response.series[0];
    const pointlist = series.pointlist || [];

    if (pointlist.length === 0) {
      return this.getEmptyData(widgetType);
    }

    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        const latestValue = pointlist[pointlist.length - 1][1];
        const previousValue = pointlist.length > 1 ? pointlist[pointlist.length - 2][1] : latestValue;
        const trend = latestValue > previousValue ? 'up' : latestValue < previousValue ? 'down' : 'stable';

        return {
          value: Math.round(latestValue * 100) / 100,
          previous: Math.round(previousValue * 100) / 100,
          trend,
          unit: series.unit || ''
        };
      }

      case 'gauge':
      case 'gauge-row': {
        const latestValue = pointlist[pointlist.length - 1][1];
        return {
          value: Math.round(latestValue * 100) / 100,
          min: 0,
          max: 100,
          unit: '%'
        };
      }

      case 'line-chart':
      case 'sparkline': {
        return {
          labels: pointlist.map(p => new Date(p[0]).toISOString()),
          values: pointlist.map(p => Math.round(p[1] * 100) / 100),
          series: series.metric || 'Value'
        };
      }

      case 'bar-chart': {
        const lastN = Math.min(10, pointlist.length);
        const recentPoints = pointlist.slice(-lastN);

        return {
          values: recentPoints.map(p => ({
            label: new Date(p[0]).toLocaleTimeString(),
            value: Math.round(p[1] * 100) / 100
          }))
        };
      }

      default:
        return {
          pointlist,
          metric: series.metric
        };
    }
  }

  /**
   * Get mock data for testing when DataDog credentials not available
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return {
          value: Math.round(Math.random() * 1000),
          trend: Math.random() > 0.5 ? 'up' : 'down',
          unit: 'req/s'
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
            { label: 'web-1', value: 245 },
            { label: 'web-2', value: 312 },
            { label: 'api-1', value: 428 },
            { label: 'api-2', value: 391 }
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
            Math.round(Math.random() * 500)
          ),
          series: 'Mock Requests'
        };
      }

      default:
        return this.getEmptyData(widgetType);
    }
  }

  /**
   * Get available DataDog metrics
   */
  getAvailableMetrics() {
    return [
      {
        id: 'apm_requests_per_second',
        name: 'APM Requests Per Second',
        description: 'Application requests per second',
        query: 'avg:trace.web.request.hits{*}.as_count()',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart']
      },
      {
        id: 'apm_error_rate',
        name: 'APM Error Rate',
        description: 'Application error rate percentage',
        query: 'avg:trace.web.request.errors{*}.as_rate()',
        type: 'percentage',
        widgets: ['gauge', 'gauge-row', 'big-number']
      },
      {
        id: 'apm_latency_p95',
        name: 'APM Latency (p95)',
        description: '95th percentile response time',
        query: 'p95:trace.web.request.duration{*}',
        type: 'duration',
        widgets: ['gauge', 'line-chart', 'big-number']
      },
      {
        id: 'system_cpu_user',
        name: 'System CPU (User)',
        description: 'CPU usage in user space',
        query: 'avg:system.cpu.user{*}',
        type: 'percentage',
        widgets: ['gauge', 'line-chart']
      },
      {
        id: 'system_mem_used',
        name: 'System Memory Used',
        description: 'Memory usage percentage',
        query: 'avg:system.mem.used{*}',
        type: 'percentage',
        widgets: ['gauge', 'line-chart']
      },
      {
        id: 'system_load_1',
        name: 'System Load (1m)',
        description: 'System load average (1 minute)',
        query: 'avg:system.load.1{*}',
        type: 'number',
        widgets: ['gauge', 'line-chart', 'big-number']
      },
      {
        id: 'docker_containers_running',
        name: 'Docker Containers Running',
        description: 'Number of running Docker containers',
        query: 'avg:docker.containers.running{*}',
        type: 'number',
        widgets: ['big-number', 'bar-chart']
      },
      {
        id: 'custom_metric',
        name: 'Custom Metric',
        description: 'User-defined custom metric',
        query: '',
        type: 'number',
        widgets: ['big-number', 'gauge', 'line-chart', 'bar-chart']
      }
    ];
  }
}

export const dataDogDataSource = new DataDogDataSource();
