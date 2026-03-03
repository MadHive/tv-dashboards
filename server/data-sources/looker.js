// ===========================================================================
// Looker Data Source Plugin — Business intelligence and analytics
// ===========================================================================

import { DataSource } from './base.js';
import logger from '../logger.js';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Looker data source for business intelligence and analytics
 *
 * Configuration:
 * - Set LOOKER_BASE_URL environment variable (e.g., https://yourinstance.looker.com:19999)
 * - Set LOOKER_CLIENT_ID environment variable (API client ID)
 * - Set LOOKER_CLIENT_SECRET environment variable (API client secret)
 *
 * Authentication: OAuth 2.0 Resource Owner Password Credentials Grant
 * - Login endpoint: POST /api/4.0/login
 * - Access token used in Authorization header: "Authorization: token {access_token}"
 */
export class LookerDataSource extends DataSource {
  constructor(config = {}) {
    super('looker', config);

    // Connection settings
    this.baseUrl = config.baseUrl || process.env.LOOKER_BASE_URL;
    this.clientId = config.clientId || process.env.LOOKER_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.LOOKER_CLIENT_SECRET;

    // Authentication state
    this.accessToken = null;
    this.tokenExpiry = null;

    // Cache
    this.metricCache = new Map();
  }

  /**
   * Initialize Looker connection and authenticate
   */
  async initialize() {
    try {
      // Normalize base URL (remove trailing slash) if present
      if (this.baseUrl) {
        this.baseUrl = this.baseUrl.replace(/\/$/, '');
      }

      // Check if credentials are available
      if (!this.baseUrl || !this.clientId || !this.clientSecret) {
        logger.warn('[looker] No Looker credentials found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      // Authenticate
      await this.authenticate();

      logger.info('[looker] Looker client initialized');
      this.isConnected = true;
    } catch (error) {
      logger.error('[looker] Failed to initialize:', error.message);
      this.lastError = error;
      this.isConnected = false;
    }
  }

  /**
   * Authenticate with Looker API and obtain access token
   */
  async authenticate() {
    try {
      const loginUrl = `${this.baseUrl}/api/4.0/login`;

      // Credentials can be sent as URL params or form-encoded body
      // Body is more secure than URL params
      const params = new URLSearchParams();
      params.append('client_id', this.clientId);
      params.append('client_secret', this.clientSecret);

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        throw new Error(`Looker authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;

      // Token expiry is in seconds, convert to timestamp
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);

      logger.info('[looker] Authentication successful');
    } catch (error) {
      logger.error('[looker] Authentication error:', error.message);
      throw error;
    }
  }

  /**
   * Ensure we have a valid access token
   */
  async ensureAuthenticated() {
    // Check if token is expired or will expire in next 60 seconds
    if (!this.accessToken || !this.tokenExpiry || Date.now() >= (this.tokenExpiry - 60000)) {
      await this.authenticate();
    }
  }

  /**
   * Make authenticated request to Looker API
   */
  async makeRequest(endpoint, options = {}) {
    await this.ensureAuthenticated();

    const url = `${this.baseUrl}/api/4.0${endpoint}`;
    const headers = {
      'Authorization': `token ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Looker API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Fetch metrics for a widget
   *
   * Widget config should include:
   * - metric: Metric type ('queries', 'dashboards', 'looks', 'running_queries', etc.)
   * - queryId: Query ID to run (optional)
   * - dashboardId: Dashboard ID (optional)
   * - lookId: Look ID (optional)
   * - resultFormat: Result format for query execution ('json', 'csv', etc.)
   */
  async fetchMetrics(widgetConfig) {
    try {
      if (!this.accessToken && !this.baseUrl) {
        logger.warn('[looker] Looker client not initialized - using mock data');
        return {
          timestamp: new Date().toISOString(),
          source: 'looker',
          data: this.getMockData(widgetConfig.type),
          widgetId: widgetConfig.id
        };
      }

      const {
        metric = 'dashboards',
        queryId,
        dashboardId,
        lookId,
        resultFormat = 'json'
      } = widgetConfig;

      // Build cache key
      const cacheKey = JSON.stringify({ metric, queryId, dashboardId, lookId, resultFormat });

      // Check cache
      if (this.metricCache.has(cacheKey)) {
        const cached = this.metricCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          logger.info('[looker] Cache hit for metric:', metric);
          return {
            timestamp: new Date().toISOString(),
            source: 'looker',
            data: this.transformData(cached.data, widgetConfig.type, metric),
            widgetId: widgetConfig.id,
            cached: true
          };
        }
      }

      // Fetch data based on metric type
      let data;
      switch (metric) {
        case 'queries':
          if (queryId) {
            data = await this.runQuery(queryId, resultFormat);
          } else {
            data = await this.makeRequest('/queries');
          }
          break;

        case 'dashboards':
          if (dashboardId) {
            data = await this.makeRequest(`/dashboards/${dashboardId}`);
          } else {
            data = await this.makeRequest('/dashboards');
          }
          break;

        case 'looks':
          if (lookId) {
            data = await this.makeRequest(`/looks/${lookId}`);
          } else {
            data = await this.makeRequest('/looks');
          }
          break;

        case 'running_queries':
          data = await this.makeRequest('/running_queries');
          break;

        case 'query_tasks':
          data = await this.makeRequest('/query_tasks');
          break;

        case 'scheduled_plans':
          data = await this.makeRequest('/scheduled_plans');
          break;

        case 'users':
          data = await this.makeRequest('/users');
          break;

        case 'models':
          data = await this.makeRequest('/lookml_models');
          break;

        case 'query_stats':
          // Get running queries for performance stats
          data = await this.makeRequest('/running_queries');
          break;

        default:
          throw new Error(`Unknown metric type: ${metric}`);
      }

      // Cache the result
      this.metricCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return {
        timestamp: new Date().toISOString(),
        source: 'looker',
        data: this.transformData(data, widgetConfig.type, metric),
        widgetId: widgetConfig.id
      };
    } catch (error) {
      logger.error('[looker] Fetch metrics error:', error.message);
      return this.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Run a Looker query
   */
  async runQuery(queryId, resultFormat = 'json') {
    const endpoint = `/queries/${queryId}/run/${resultFormat}`;
    return this.makeRequest(endpoint);
  }

  /**
   * Test connection to Looker API
   */
  async testConnection() {
    try {
      if (!this.baseUrl || !this.clientId || !this.clientSecret) {
        return false;
      }

      // Authenticate and fetch user info
      await this.ensureAuthenticated();
      await this.makeRequest('/user');

      logger.info('[looker] Connection test successful');
      return true;
    } catch (error) {
      logger.error('[looker] Connection test failed:', error.message);
      this.lastError = error;
      return false;
    }
  }

  /**
   * Get configuration schema
   */
  getConfigSchema() {
    return {
      name: 'Looker',
      description: 'Business intelligence and analytics from Looker',
      fields: [
        {
          name: 'baseUrl',
          type: 'string',
          required: true,
          description: 'Looker instance base URL',
          example: 'https://yourinstance.looker.com:19999',
          envVar: 'LOOKER_BASE_URL'
        },
        {
          name: 'clientId',
          type: 'string',
          required: true,
          description: 'API client ID',
          secure: true,
          envVar: 'LOOKER_CLIENT_ID'
        },
        {
          name: 'clientSecret',
          type: 'string',
          required: true,
          description: 'API client secret',
          secure: true,
          envVar: 'LOOKER_CLIENT_SECRET'
        },
        {
          name: 'metric',
          type: 'select',
          required: false,
          description: 'Metric type to fetch',
          options: [
            'queries',
            'dashboards',
            'looks',
            'running_queries',
            'scheduled_plans',
            'users',
            'models',
            'query_stats'
          ],
          default: 'dashboards'
        },
        {
          name: 'queryId',
          type: 'string',
          required: false,
          description: 'Query ID to execute'
        },
        {
          name: 'dashboardId',
          type: 'string',
          required: false,
          description: 'Dashboard ID to fetch'
        },
        {
          name: 'lookId',
          type: 'string',
          required: false,
          description: 'Look ID to fetch'
        }
      ]
    };
  }

  /**
   * Transform Looker API response to widget format
   */
  transformData(response, widgetType, metric) {
    if (!response) {
      return this.getEmptyData(widgetType);
    }

    // Handle array responses (lists)
    if (Array.isArray(response)) {
      return this.transformArrayData(response, widgetType, metric);
    }

    // Handle query result responses
    if (metric === 'queries' && Array.isArray(response)) {
      return this.transformQueryResults(response, widgetType);
    }

    // Handle single object responses
    return this.transformObjectData(response, widgetType, metric);
  }

  /**
   * Transform array data (lists of resources)
   */
  transformArrayData(data, widgetType, metric) {
    const count = data.length;

    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        let label = 'Items';
        if (metric === 'dashboards') label = 'Dashboards';
        else if (metric === 'looks') label = 'Looks';
        else if (metric === 'running_queries') label = 'Active Queries';
        else if (metric === 'users') label = 'Users';
        else if (metric === 'models') label = 'Models';
        else if (metric === 'scheduled_plans') label = 'Scheduled Reports';

        return {
          value: count,
          label,
          unit: ''
        };
      }

      case 'gauge':
      case 'gauge-row': {
        // For running queries, show as percentage of some limit
        let max = 100;
        if (metric === 'running_queries') {
          max = Math.max(count * 2, 10); // 2x current as max
        }

        return {
          value: count,
          min: 0,
          max,
          unit: metric === 'running_queries' ? 'queries' : 'items'
        };
      }

      case 'bar-chart': {
        // For dashboards/looks, group by folder or space
        const grouped = this.groupByProperty(data, 'folder', 'space');
        const values = Object.entries(grouped)
          .slice(0, 10)
          .map(([label, items]) => ({
            label: label || 'Uncategorized',
            value: items.length
          }));

        return { values };
      }

      case 'status-grid': {
        // For dashboards or looks, show as status items
        const items = data.slice(0, 20).map(item => ({
          name: item.title || item.name || item.id,
          status: this.getItemStatus(item),
          value: item.view_count || item.query_count || 0,
          label: item.folder?.name || item.space?.name || 'Default'
        }));

        return { items };
      }

      case 'table': {
        const rows = data.slice(0, 100).map(item => ({
          id: item.id,
          name: item.title || item.name,
          folder: item.folder?.name || item.space?.name || '-',
          views: item.view_count || 0,
          updated: item.updated_at || item.created_at || '-'
        }));

        return { rows };
      }

      default:
        return {
          count,
          items: data.slice(0, 100)
        };
    }
  }

  /**
   * Transform query results
   */
  transformQueryResults(results, widgetType) {
    if (!results || results.length === 0) {
      return this.getEmptyData(widgetType);
    }

    // Get first row for single-value widgets
    const firstRow = results[0];
    const firstValue = Object.values(firstRow)[0];

    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        return {
          value: typeof firstValue === 'number' ? firstValue : results.length,
          unit: ''
        };
      }

      case 'gauge':
      case 'gauge-row': {
        const value = typeof firstValue === 'number' ? firstValue : results.length;
        return {
          value,
          min: 0,
          max: value * 1.5,
          unit: ''
        };
      }

      case 'bar-chart': {
        // Take first two columns (label and value)
        const values = results.slice(0, 10).map(row => {
          const entries = Object.entries(row);
          return {
            label: String(entries[0]?.[1] || 'Unknown'),
            value: Number(entries[1]?.[1] || 0)
          };
        });

        return { values };
      }

      case 'line-chart':
      case 'sparkline': {
        const entries = Object.entries(firstRow);
        const labels = results.map(row => String(row[entries[0][0]]));
        const values = results.map(row => Number(row[entries[1]?.[0]] || 0));

        return {
          labels,
          values,
          series: 'Query Results'
        };
      }

      case 'table': {
        return { rows: results.slice(0, 100) };
      }

      default:
        return { results: results.slice(0, 100) };
    }
  }

  /**
   * Transform single object data
   */
  transformObjectData(data, widgetType, metric) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        // Extract a meaningful value
        const value = data.view_count || data.query_count || data.element_count || 0;
        return {
          value,
          label: data.title || data.name || 'Item',
          unit: ''
        };
      }

      default:
        return data;
    }
  }

  /**
   * Group items by property
   */
  groupByProperty(items, ...properties) {
    const grouped = {};

    for (const item of items) {
      let key = 'Uncategorized';

      for (const prop of properties) {
        if (item[prop]?.name) {
          key = item[prop].name;
          break;
        }
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    }

    return grouped;
  }

  /**
   * Get status for an item
   */
  getItemStatus(item) {
    // If item has explicit status, use it
    if (item.status) {
      return item.status.toLowerCase();
    }

    // For dashboards/looks, consider last update
    if (item.updated_at) {
      const daysSinceUpdate = (Date.now() - new Date(item.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 7) return 'healthy';
      if (daysSinceUpdate < 30) return 'warning';
      return 'stale';
    }

    return 'unknown';
  }

  /**
   * Get mock data for testing when Looker not available
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return {
          value: Math.round(Math.random() * 50) + 10,
          label: 'Dashboards',
          trend: Math.random() > 0.5 ? 'up' : 'down',
          unit: ''
        };

      case 'gauge':
      case 'gauge-row':
        return {
          value: Math.round(Math.random() * 20) + 5,
          min: 0,
          max: 50,
          unit: 'queries'
        };

      case 'bar-chart':
        return {
          values: [
            { label: 'Sales', value: 15 },
            { label: 'Marketing', value: 23 },
            { label: 'Finance', value: 8 },
            { label: 'Operations', value: 12 },
            { label: 'HR', value: 5 }
          ]
        };

      case 'status-grid':
        return {
          items: [
            { name: 'Sales Dashboard', status: 'healthy', value: 245, label: 'Sales' },
            { name: 'Marketing Analytics', status: 'healthy', value: 189, label: 'Marketing' },
            { name: 'Financial Reports', status: 'warning', value: 56, label: 'Finance' },
            { name: 'Operations KPIs', status: 'healthy', value: 134, label: 'Operations' }
          ]
        };

      case 'line-chart':
      case 'sparkline': {
        const now = Date.now();
        return {
          labels: Array.from({ length: 12 }, (_, i) =>
            new Date(now - (11 - i) * 3600000).toISOString()
          ),
          values: Array.from({ length: 12 }, () =>
            Math.round(Math.random() * 50) + 10
          ),
          series: 'Query Executions'
        };
      }

      case 'table':
        return {
          rows: [
            { id: '1', name: 'Sales Dashboard', folder: 'Sales', views: 245, updated: '2026-03-01' },
            { id: '2', name: 'Marketing Analytics', folder: 'Marketing', views: 189, updated: '2026-03-02' },
            { id: '3', name: 'Financial Reports', folder: 'Finance', views: 56, updated: '2026-02-28' },
            { id: '4', name: 'Operations KPIs', folder: 'Operations', views: 134, updated: '2026-03-01' }
          ]
        };

      default:
        return this.getEmptyData(widgetType);
    }
  }

  /**
   * Get available Looker metrics
   */
  getAvailableMetrics() {
    return [
      {
        id: 'dashboard_count',
        name: 'Total Dashboards',
        description: 'Total number of Looker dashboards',
        metric: 'dashboards',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'gauge']
      },
      {
        id: 'look_count',
        name: 'Total Looks',
        description: 'Total number of saved Looks',
        metric: 'looks',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'gauge']
      },
      {
        id: 'running_queries_count',
        name: 'Active Queries',
        description: 'Number of currently running queries',
        metric: 'running_queries',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'gauge', 'gauge-row']
      },
      {
        id: 'scheduled_plans_count',
        name: 'Scheduled Reports',
        description: 'Number of scheduled delivery plans',
        metric: 'scheduled_plans',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'active_users',
        name: 'Active Users',
        description: 'Number of active Looker users',
        metric: 'users',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'gauge']
      },
      {
        id: 'model_count',
        name: 'LookML Models',
        description: 'Number of LookML models',
        metric: 'models',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'bar-chart']
      },
      {
        id: 'dashboard_usage',
        name: 'Dashboard Usage',
        description: 'Dashboard usage by folder',
        metric: 'dashboards',
        type: 'distribution',
        widgets: ['bar-chart', 'status-grid']
      },
      {
        id: 'look_usage',
        name: 'Look Usage',
        description: 'Saved Look usage statistics',
        metric: 'looks',
        type: 'distribution',
        widgets: ['bar-chart', 'status-grid']
      },
      {
        id: 'query_performance',
        name: 'Query Performance',
        description: 'Active query performance metrics',
        metric: 'running_queries',
        type: 'performance',
        widgets: ['gauge', 'line-chart', 'status-grid']
      },
      {
        id: 'cache_stats',
        name: 'Cache Statistics',
        description: 'Query cache hit/miss statistics',
        metric: 'query_stats',
        type: 'percentage',
        widgets: ['gauge', 'gauge-row', 'big-number']
      }
    ];
  }

  /**
   * Validate widget configuration
   */
  validateWidgetConfig(widgetConfig) {
    const errors = super.validateWidgetConfig(widgetConfig);

    // Looker credentials are optional - will use mock data if not provided
    // This allows the dashboard to work without Looker access

    return errors;
  }
}

// Create singleton instance
export const lookerDataSource = new LookerDataSource();
