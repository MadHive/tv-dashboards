// ===========================================================================
// Rollbar Data Source Plugin — Error tracking and monitoring
// ===========================================================================

import { DataSource } from './base.js';

const ROLLBAR_BASE_URL = 'https://api.rollbar.com/api/1';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX = 5000; // 5000 requests per hour

/**
 * Rollbar data source for error tracking and monitoring
 *
 * Configuration:
 * - Set ROLLBAR_ACCESS_TOKEN environment variable
 * - Set ROLLBAR_PROJECT_ID environment variable (optional, for project-specific queries)
 *
 * Rate Limits:
 * - 5000 requests per hour (configurable per token)
 * - Returns 429 status code when rate limit exceeded
 */
export class RollbarDataSource extends DataSource {
  constructor(config = {}) {
    super('rollbar', config);
    this.accessToken = config.accessToken || process.env.ROLLBAR_ACCESS_TOKEN;
    this.projectId = config.projectId || process.env.ROLLBAR_PROJECT_ID;
    this.baseUrl = config.baseUrl || ROLLBAR_BASE_URL;
    this.metricCache = new Map();
  }

  /**
   * Make authenticated request to Rollbar API
   */
  async makeRequest(endpoint, params = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
      } else if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    });

    const headers = {
      'X-Rollbar-Access-Token': this.accessToken,
      'Accept': 'application/json'
    };

    try {
      const response = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (response.status === 429) {
        throw new Error('Rate limit exceeded (5000 requests/hour)');
      }

      if (!response.ok) {
        throw new Error(`Rollbar API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.err !== 0 && data.err !== undefined) {
        throw new Error(data.message || 'Rollbar API returned error');
      }

      return data.result;
    } catch (error) {
      if (error.name === 'TimeoutError') {
        throw new Error('Rollbar API request timeout');
      }
      throw error;
    }
  }

  /**
   * Initialize Rollbar client
   */
  async initialize() {
    try {
      if (!this.accessToken) {
        console.warn('[rollbar] No access token found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      // Test connection on initialization
      this.isConnected = await this.testConnection();

      if (this.isConnected) {
        console.log('[rollbar] Rollbar client initialized');
      } else {
        console.warn('[rollbar] Connection test failed');
      }
    } catch (error) {
      console.error('[rollbar] Failed to initialize:', error.message);
      this.lastError = error;
      this.isConnected = false;
    }
  }

  /**
   * Fetch metrics for a widget
   *
   * Widget config should include:
   * - metricType: Type of metric to fetch (items, top_active, occurrence_counts, etc.)
   * - level: Filter by level (critical, error, warning, info, debug)
   * - environment: Filter by environment (production, staging, etc.)
   * - timeRange: Time range in seconds (default: 86400 = 24 hours)
   */
  async fetchMetrics(widgetConfig) {
    try {
      if (!this.accessToken) {
        console.warn('[rollbar] Access token not configured - using mock data');
        return {
          timestamp: new Date().toISOString(),
          source: 'rollbar',
          data: this.getMockData(widgetConfig.type),
          widgetId: widgetConfig.id,
          mock: true
        };
      }

      const {
        metricType = 'items',
        level,
        environment,
        timeRange = 86400, // 24 hours default
      } = widgetConfig;

      // Check cache
      const cacheKey = JSON.stringify({ metricType, level, environment, timeRange });
      if (this.metricCache.has(cacheKey)) {
        const cached = this.metricCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          console.log('[rollbar] Cache hit for metric:', metricType);
          return {
            timestamp: new Date().toISOString(),
            source: 'rollbar',
            data: this.transformData(cached.data, widgetConfig.type),
            widgetId: widgetConfig.id,
            cached: true
          };
        }
      }

      // Fetch data based on metric type
      let rawData;
      switch (metricType) {
        case 'top_active':
          rawData = await this.fetchTopActiveItems(environment, timeRange);
          break;

        case 'occurrence_counts':
          rawData = await this.fetchOccurrenceCounts(level, environment, timeRange);
          break;

        case 'items':
        default:
          rawData = await this.fetchItems(level, environment);
          break;
      }

      // Cache the result
      this.metricCache.set(cacheKey, {
        data: rawData,
        timestamp: Date.now()
      });

      return {
        timestamp: new Date().toISOString(),
        source: 'rollbar',
        data: this.transformData(rawData, widgetConfig.type),
        widgetId: widgetConfig.id
      };
    } catch (error) {
      console.error('[rollbar] Fetch metrics error:', error.message);
      return this.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Fetch error items from Rollbar
   */
  async fetchItems(level, environment) {
    const params = {
      status: 'active'
    };

    if (level) {
      params.level = level;
    }

    if (environment) {
      params.environment = environment;
    }

    const result = await this.makeRequest('/items/', params);

    return {
      items: result.items || [],
      total: result.total_count || result.items?.length || 0
    };
  }

  /**
   * Fetch top active items (top errors in last 24 hours)
   */
  async fetchTopActiveItems(environment, hours = 24) {
    const params = {
      hours
    };

    if (environment) {
      params.environment = environment;
    }

    const result = await this.makeRequest('/reports/top_active_items', params);

    return {
      items: result || [],
      total: result?.length || 0
    };
  }

  /**
   * Fetch occurrence counts (error trends over time)
   */
  async fetchOccurrenceCounts(level, environment, timeRange = 86400) {
    const now = Math.floor(Date.now() / 1000);
    const params = {
      bucket_size: 3600, // 1 hour buckets
      start_time: now - timeRange,
      end_time: now
    };

    if (level) {
      params.level = level;
    }

    if (environment) {
      params.environment = environment;
    }

    const result = await this.makeRequest('/reports/occurrence_counts', params);

    return {
      counts: result || [],
      total: result?.reduce((sum, [_, count]) => sum + count, 0) || 0
    };
  }

  /**
   * Test connection to Rollbar API
   */
  async testConnection() {
    try {
      if (!this.accessToken) {
        return false;
      }

      // Use the ping endpoint or try fetching projects
      await this.makeRequest('/status/ping');
      console.log('[rollbar] Connection test successful');
      return true;
    } catch (error) {
      // Fallback: try to fetch items as connection test
      try {
        await this.makeRequest('/items/', { status: 'active' });
        console.log('[rollbar] Connection test successful (via items endpoint)');
        return true;
      } catch (itemsError) {
        console.error('[rollbar] Connection test failed:', error.message);
        this.lastError = error;
        return false;
      }
    }
  }

  /**
   * Get configuration schema
   */
  getConfigSchema() {
    return {
      name: 'Rollbar',
      description: 'Error tracking and application monitoring',
      fields: [
        {
          name: 'accessToken',
          type: 'string',
          required: true,
          description: 'Rollbar Access Token (project or account token with read scope)',
          secure: true,
          envVar: 'ROLLBAR_ACCESS_TOKEN'
        },
        {
          name: 'projectId',
          type: 'string',
          required: false,
          description: 'Rollbar Project ID (optional)',
          envVar: 'ROLLBAR_PROJECT_ID'
        },
        {
          name: 'environment',
          type: 'string',
          required: false,
          description: 'Filter by environment (production, staging, etc.)',
          example: 'production'
        },
        {
          name: 'level',
          type: 'string',
          required: false,
          description: 'Filter by error level',
          options: ['critical', 'error', 'warning', 'info', 'debug']
        }
      ]
    };
  }

  /**
   * Transform Rollbar API response to widget format
   */
  transformData(response, widgetType) {
    if (!response) {
      return this.getEmptyData(widgetType);
    }

    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        const total = response.total || 0;
        const items = response.items || [];

        // Count by severity
        const critical = items.filter(item =>
          item.level === 'critical' || item.item?.level === 'critical'
        ).length;
        const errors = items.filter(item =>
          item.level === 'error' || item.item?.level === 'error'
        ).length;

        return {
          value: total,
          critical,
          errors,
          label: 'Active Errors',
          unit: 'errors'
        };
      }

      case 'gauge':
      case 'gauge-row': {
        // Calculate error rate or score
        const total = response.total || 0;
        const items = response.items || [];
        const critical = items.filter(item =>
          item.level === 'critical' || item.item?.level === 'critical'
        ).length;

        // Error rate score (lower is better)
        const errorRate = total > 0 ? Math.min(100, (critical / total) * 100) : 0;

        return {
          value: Math.round(errorRate),
          min: 0,
          max: 100,
          unit: '%',
          label: 'Critical Error Rate'
        };
      }

      case 'bar-chart': {
        const items = response.items || [];

        // Group by severity level
        const severityCounts = {
          critical: 0,
          error: 0,
          warning: 0,
          info: 0,
          debug: 0
        };

        items.forEach(item => {
          const level = item.level || item.item?.level || 'info';
          if (severityCounts.hasOwnProperty(level)) {
            severityCounts[level]++;
          }
        });

        return {
          values: [
            { label: 'Critical', value: severityCounts.critical, color: '#EF4444' },
            { label: 'Error', value: severityCounts.error, color: '#F59E0B' },
            { label: 'Warning', value: severityCounts.warning, color: '#FBBF24' },
            { label: 'Info', value: severityCounts.info, color: '#3B82F6' },
            { label: 'Debug', value: severityCounts.debug, color: '#6B7280' }
          ].filter(v => v.value > 0) // Only show non-zero values
        };
      }

      case 'alert-list': {
        const items = response.items || [];

        return {
          alerts: items.slice(0, 10).map(item => {
            const itemData = item.item || item;
            return {
              id: itemData.id || itemData.counter || 'unknown',
              title: itemData.title || 'Unknown Error',
              severity: itemData.level || 'error',
              timestamp: itemData.last_occurrence_timestamp ||
                         itemData.first_occurrence_timestamp ||
                         Date.now() / 1000,
              occurrences: itemData.total_occurrences || item.counts?.reduce((a, b) => a + b, 0) || 1
            };
          })
        };
      }

      case 'line-chart':
      case 'sparkline': {
        const counts = response.counts || [];

        if (counts.length === 0) {
          return this.getEmptyData(widgetType);
        }

        return {
          labels: counts.map(([timestamp]) => new Date(timestamp * 1000).toISOString()),
          values: counts.map(([_, count]) => count),
          series: 'Error Occurrences'
        };
      }

      default:
        return response;
    }
  }

  /**
   * Get mock data for testing when Rollbar credentials not available
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return {
          value: Math.floor(Math.random() * 50) + 10,
          critical: Math.floor(Math.random() * 5),
          errors: Math.floor(Math.random() * 20),
          label: 'Active Errors',
          unit: 'errors'
        };

      case 'gauge':
      case 'gauge-row':
        return {
          value: Math.floor(Math.random() * 30),
          min: 0,
          max: 100,
          unit: '%',
          label: 'Critical Error Rate'
        };

      case 'bar-chart':
        return {
          values: [
            { label: 'Critical', value: Math.floor(Math.random() * 10), color: '#EF4444' },
            { label: 'Error', value: Math.floor(Math.random() * 25), color: '#F59E0B' },
            { label: 'Warning', value: Math.floor(Math.random() * 40), color: '#FBBF24' },
            { label: 'Info', value: Math.floor(Math.random() * 30), color: '#3B82F6' }
          ]
        };

      case 'alert-list':
        return {
          alerts: [
            {
              id: '1',
              title: 'TypeError: Cannot read property of undefined',
              severity: 'critical',
              timestamp: Date.now() / 1000 - 300,
              occurrences: 47
            },
            {
              id: '2',
              title: 'Database connection timeout',
              severity: 'error',
              timestamp: Date.now() / 1000 - 600,
              occurrences: 23
            },
            {
              id: '3',
              title: 'API rate limit exceeded',
              severity: 'warning',
              timestamp: Date.now() / 1000 - 1200,
              occurrences: 12
            }
          ]
        };

      case 'line-chart':
      case 'sparkline': {
        const now = Date.now();
        const hours = 24;
        const labels = [];
        const values = [];

        for (let i = hours - 1; i >= 0; i--) {
          const timestamp = new Date(now - i * 3600000);
          labels.push(timestamp.toISOString());
          values.push(Math.floor(Math.random() * 50) + 5);
        }

        return {
          labels,
          values,
          series: 'Error Occurrences'
        };
      }

      default:
        return this.getEmptyData(widgetType);
    }
  }

  /**
   * Get available Rollbar metrics
   */
  getAvailableMetrics() {
    return [
      {
        id: 'total_occurrences',
        name: 'Total Occurrences',
        description: 'Total number of error occurrences',
        metricType: 'items',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'active_items',
        name: 'Active Items',
        description: 'Number of active error items',
        metricType: 'items',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'alert-list']
      },
      {
        id: 'errors_by_level',
        name: 'Errors by Level',
        description: 'Error count breakdown by severity level',
        metricType: 'items',
        type: 'distribution',
        widgets: ['bar-chart']
      },
      {
        id: 'critical_errors',
        name: 'Critical Errors',
        description: 'Number of critical severity errors',
        metricType: 'items',
        level: 'critical',
        type: 'number',
        widgets: ['big-number', 'gauge']
      },
      {
        id: 'error_rate',
        name: 'Error Rate',
        description: 'Percentage of critical errors out of total',
        metricType: 'items',
        type: 'percentage',
        widgets: ['gauge', 'gauge-row']
      },
      {
        id: 'top_errors',
        name: 'Top Errors',
        description: 'Most frequent errors in last 24 hours',
        metricType: 'top_active',
        type: 'list',
        widgets: ['alert-list', 'bar-chart']
      },
      {
        id: 'occurrence_trends',
        name: 'Occurrence Trends',
        description: 'Error occurrence counts over time',
        metricType: 'occurrence_counts',
        type: 'timeseries',
        widgets: ['line-chart', 'sparkline']
      },
      {
        id: 'new_items',
        name: 'New Items',
        description: 'Recently created error items',
        metricType: 'items',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'resolved_items',
        name: 'Resolved Items',
        description: 'Recently resolved error items',
        metricType: 'items',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'mttr',
        name: 'Mean Time to Resolution (MTTR)',
        description: 'Average time to resolve errors',
        metricType: 'items',
        type: 'duration',
        widgets: ['big-number', 'gauge']
      }
    ];
  }

  /**
   * Validate widget configuration
   */
  validateWidgetConfig(widgetConfig) {
    const errors = super.validateWidgetConfig(widgetConfig);

    // Note: We don't require access token in validation because the data source
    // will gracefully fall back to mock data if credentials aren't configured.
    // This allows dashboard development and testing without API credentials.

    // Validate metric type if specified
    const validMetricTypes = ['items', 'top_active', 'occurrence_counts'];
    if (widgetConfig.metricType && !validMetricTypes.includes(widgetConfig.metricType)) {
      errors.push(`Invalid metricType: ${widgetConfig.metricType}. Must be one of: ${validMetricTypes.join(', ')}`);
    }

    // Validate level if specified
    const validLevels = ['critical', 'error', 'warning', 'info', 'debug'];
    if (widgetConfig.level && !validLevels.includes(widgetConfig.level)) {
      errors.push(`Invalid level: ${widgetConfig.level}. Must be one of: ${validLevels.join(', ')}`);
    }

    return errors;
  }
}

// Create singleton instance
export const rollbarDataSource = new RollbarDataSource();
