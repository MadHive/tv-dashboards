// ===========================================================================
// FullStory Data Source Plugin — Digital experience analytics
// ===========================================================================

import { DataSource } from './base.js';
import logger from '../logger.js';

const FULLSTORY_API_BASE = 'https://api.fullstory.com';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * FullStory data source for digital experience analytics and session replay
 *
 * Configuration:
 * - Set FULLSTORY_API_KEY environment variable (Admin or Architect level required)
 *
 * API Documentation:
 * - https://developer.fullstory.com/
 * - Authentication: Basic auth with API key
 */
export class FullStoryDataSource extends DataSource {
  constructor(config = {}) {
    super('fullstory', config);
    this.apiKey = config.apiKey || process.env.FULLSTORY_API_KEY;
    this.baseUrl = config.baseUrl || FULLSTORY_API_BASE;
    this.metricCache = new Map();
  }

  /**
   * Initialize FullStory client
   */
  async initialize() {
    try {
      if (!this.apiKey) {
        console.warn('[fullstory] No FullStory API key found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      // Test connection
      this.isConnected = await this.testConnection();

      if (this.isConnected) {
        console.log('[fullstory] FullStory client initialized');
      } else {
        console.warn('[fullstory] Connection test failed - will use mock data');
      }
    } catch (error) {
      console.error('[fullstory] Failed to initialize:', error.message);
      this.lastError = error;
      this.isConnected = false;
    }
  }

  /**
   * Make authenticated request to FullStory API
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Basic ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`FullStory API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Fetch metrics for a widget
   *
   * Widget config should include:
   * - metric: Metric type ('sessions', 'rage_clicks', 'errors', 'conversions', 'page_views')
   * - email: User email for user-specific queries (optional)
   * - uid: User ID for user-specific queries (optional)
   * - limit: Number of sessions to retrieve (default: 20)
   * - timeRange: Time range for queries (e.g., '1h', '24h', '7d')
   */
  async fetchMetrics(widgetConfig) {
    try {
      if (!this.apiKey) {
        console.warn('[fullstory] FullStory API key not configured - using mock data');
        return {
          timestamp: new Date().toISOString(),
          source: 'fullstory',
          data: this.getMockData(widgetConfig.type),
          widgetId: widgetConfig.id
        };
      }

      const {
        metric = 'sessions',
        email,
        uid,
        limit = 20,
        timeRange = '24h'
      } = widgetConfig;

      // Check cache
      const cacheKey = JSON.stringify({ metric, email, uid, limit, timeRange });
      if (this.metricCache.has(cacheKey)) {
        const cached = this.metricCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          console.log('[fullstory] Cache hit for metric:', metric);
          return {
            timestamp: new Date().toISOString(),
            source: 'fullstory',
            data: this.transformData(cached.data, widgetConfig.type),
            widgetId: widgetConfig.id,
            cached: true
          };
        }
      }

      // Fetch data based on metric type
      let rawData;
      switch (metric) {
        case 'sessions':
          rawData = await this.fetchSessions({ email, uid, limit });
          break;
        case 'rage_clicks':
        case 'errors':
        case 'conversions':
        case 'page_views':
          // For these metrics, we'll fetch sessions and aggregate
          rawData = await this.fetchSessionMetrics(metric, { email, uid, limit, timeRange });
          break;
        default:
          throw new Error(`Unknown metric type: ${metric}`);
      }

      // Cache the result
      this.metricCache.set(cacheKey, {
        data: rawData,
        timestamp: Date.now()
      });

      return {
        timestamp: new Date().toISOString(),
        source: 'fullstory',
        data: this.transformData(rawData, widgetConfig.type),
        widgetId: widgetConfig.id,
        metric
      };
    } catch (error) {
      console.error('[fullstory] Fetch metrics error:', error.message);
      return this.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Fetch sessions from FullStory API
   */
  async fetchSessions(params = {}) {
    const { email, uid, limit = 20 } = params;

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (email) queryParams.append('email', email);
    if (uid) queryParams.append('uid', uid);
    queryParams.append('limit', limit.toString());

    const endpoint = `/sessions/v2?${queryParams.toString()}`;
    const response = await this.request(endpoint);

    return {
      type: 'sessions',
      sessions: response.sessions || [],
      total: response.sessions?.length || 0
    };
  }

  /**
   * Fetch session metrics (aggregated from sessions)
   *
   * Note: FullStory's primary API is session-based. For metrics like rage clicks,
   * errors, etc., we would typically use the Data Export API or Segment Export API.
   * This implementation provides a simplified version using session data.
   */
  async fetchSessionMetrics(metric, params = {}) {
    const { limit = 100, timeRange = '24h' } = params;

    // In a real implementation, this would use the Segment Export API
    // or Data Export API to get detailed event-level data
    // For now, we'll return aggregated mock data based on sessions

    const sessions = await this.fetchSessions({ limit });

    // Simulate metric aggregation
    let value = 0;
    let history = [];

    switch (metric) {
      case 'rage_clicks':
        // Simulate rage click count (typically from event data)
        value = Math.floor(sessions.total * 0.15); // ~15% of sessions
        history = this.generateHistory(value, 12);
        break;
      case 'errors':
        // Simulate error count
        value = Math.floor(sessions.total * 0.08); // ~8% of sessions
        history = this.generateHistory(value, 12);
        break;
      case 'conversions':
        // Simulate conversion events
        value = Math.floor(sessions.total * 0.25); // ~25% conversion rate
        history = this.generateHistory(value, 12);
        break;
      case 'page_views':
        // Simulate page views (multiple per session)
        value = sessions.total * 4; // ~4 pages per session
        history = this.generateHistory(value, 12);
        break;
    }

    return {
      type: metric,
      value,
      total: sessions.total,
      history,
      timeRange
    };
  }

  /**
   * Generate historical data points for time-series metrics
   */
  generateHistory(currentValue, points = 12) {
    const history = [];
    const variation = 0.2; // 20% variation

    for (let i = 0; i < points; i++) {
      const factor = 0.7 + (i / points) * 0.3; // Gradual increase
      const noise = 1 + (Math.random() - 0.5) * variation;
      history.push(Math.round(currentValue * factor * noise));
    }

    return history;
  }

  /**
   * Test connection to FullStory API
   */
  async testConnection() {
    try {
      if (!this.apiKey) {
        return false;
      }

      // Try to fetch a small number of sessions
      await this.request('/sessions/v2?limit=1');
      console.log('[fullstory] Connection test successful');
      return true;
    } catch (error) {
      console.error('[fullstory] Connection test failed:', error.message);
      this.lastError = error;
      return false;
    }
  }

  /**
   * Get configuration schema
   */
  getConfigSchema() {
    return {
      name: 'FullStory',
      description: 'Digital experience analytics and session replay platform',
      fields: [
        {
          name: 'apiKey',
          type: 'string',
          required: true,
          description: 'FullStory API Key (Admin or Architect level required)',
          secure: true,
          envVar: 'FULLSTORY_API_KEY'
        },
        {
          name: 'metric',
          type: 'select',
          required: false,
          description: 'Metric to track',
          options: [
            { value: 'sessions', label: 'Total Sessions' },
            { value: 'rage_clicks', label: 'Rage Clicks' },
            { value: 'errors', label: 'Errors Encountered' },
            { value: 'conversions', label: 'Conversion Events' },
            { value: 'page_views', label: 'Page Views' }
          ]
        },
        {
          name: 'email',
          type: 'string',
          required: false,
          description: 'User email for user-specific queries'
        },
        {
          name: 'uid',
          type: 'string',
          required: false,
          description: 'User ID for user-specific queries'
        },
        {
          name: 'limit',
          type: 'number',
          required: false,
          description: 'Number of sessions to retrieve',
          default: 20
        }
      ]
    };
  }

  /**
   * Transform FullStory API response to widget format
   */
  transformData(response, widgetType) {
    if (!response) {
      return this.getEmptyData(widgetType);
    }

    const { type, value, total, sessions, history } = response;

    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        const currentValue = value || total || sessions?.length || 0;
        const previousValue = history?.[history.length - 2] || currentValue;
        const trend = currentValue > previousValue ? 'up' : currentValue < previousValue ? 'down' : 'stable';

        return {
          value: currentValue,
          previous: previousValue,
          trend,
          label: this.getMetricLabel(type),
          unit: this.getMetricUnit(type)
        };
      }

      case 'gauge':
      case 'gauge-row': {
        const currentValue = value || total || 0;
        // For gauges, normalize to percentage or suitable range
        const normalized = type === 'rage_clicks' || type === 'errors'
          ? Math.min(100, (currentValue / 100) * 100)
          : Math.min(100, (currentValue / 1000) * 100);

        return {
          value: Math.round(normalized),
          min: 0,
          max: 100,
          unit: '%',
          label: this.getMetricLabel(type)
        };
      }

      case 'line-chart':
      case 'sparkline': {
        const dataPoints = history || [value || total || 0];
        const now = Date.now();
        const interval = 300000; // 5 minutes

        return {
          labels: dataPoints.map((_, i) =>
            new Date(now - (dataPoints.length - 1 - i) * interval).toISOString()
          ),
          values: dataPoints,
          series: this.getMetricLabel(type)
        };
      }

      case 'bar-chart': {
        if (sessions && sessions.length > 0) {
          // Group sessions by some criteria (e.g., by hour)
          const grouped = this.groupSessionsByHour(sessions);
          return {
            values: Object.entries(grouped).map(([hour, count]) => ({
              label: hour,
              value: count
            }))
          };
        }

        // Fallback to history data
        const dataPoints = (history || []).slice(-10);
        return {
          values: dataPoints.map((val, i) => ({
            label: `T-${dataPoints.length - i}`,
            value: val
          }))
        };
      }

      default:
        return response;
    }
  }

  /**
   * Group sessions by hour for bar chart visualization
   */
  groupSessionsByHour(sessions) {
    const grouped = {};
    const now = new Date();

    sessions.forEach(session => {
      // Extract hour from session timestamp (if available)
      // This is a simplified version - actual implementation would depend on session data structure
      const sessionTime = session.createdTime ? new Date(session.createdTime) : now;
      const hour = sessionTime.getHours();
      const label = `${hour.toString().padStart(2, '0')}:00`;
      grouped[label] = (grouped[label] || 0) + 1;
    });

    return grouped;
  }

  /**
   * Get human-readable label for metric type
   */
  getMetricLabel(metricType) {
    const labels = {
      sessions: 'Total Sessions',
      rage_clicks: 'Rage Clicks',
      errors: 'Errors Encountered',
      conversions: 'Conversion Events',
      page_views: 'Page Views'
    };
    return labels[metricType] || metricType;
  }

  /**
   * Get unit for metric type
   */
  getMetricUnit(metricType) {
    const units = {
      sessions: 'sessions',
      rage_clicks: 'clicks',
      errors: 'errors',
      conversions: 'conversions',
      page_views: 'views'
    };
    return units[metricType] || '';
  }

  /**
   * Get mock data for testing when FullStory API not available
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return {
          value: Math.round(Math.random() * 1000 + 500),
          previous: Math.round(Math.random() * 900 + 400),
          trend: Math.random() > 0.5 ? 'up' : 'down',
          label: 'Total Sessions',
          unit: 'sessions'
        };

      case 'gauge':
      case 'gauge-row':
        return {
          value: Math.round(Math.random() * 100),
          min: 0,
          max: 100,
          unit: '%',
          label: 'Session Health'
        };

      case 'bar-chart':
        return {
          values: [
            { label: '00:00', value: 145 },
            { label: '04:00', value: 89 },
            { label: '08:00', value: 312 },
            { label: '12:00', value: 428 },
            { label: '16:00', value: 391 },
            { label: '20:00', value: 267 }
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
            Math.round(Math.random() * 500 + 200)
          ),
          series: 'Sessions Over Time'
        };
      }

      default:
        return this.getEmptyData(widgetType);
    }
  }

  /**
   * Get available FullStory metrics
   */
  getAvailableMetrics() {
    return [
      {
        id: 'sessions_total',
        name: 'Total Sessions',
        description: 'Total number of user sessions',
        metric: 'sessions',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart', 'bar-chart']
      },
      {
        id: 'rage_clicks',
        name: 'Rage Clicks',
        description: 'Rapid repeated clicks indicating user frustration',
        metric: 'rage_clicks',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'gauge', 'line-chart']
      },
      {
        id: 'errors_encountered',
        name: 'Errors Encountered',
        description: 'Number of errors encountered during sessions',
        metric: 'errors',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'gauge', 'line-chart']
      },
      {
        id: 'conversion_events',
        name: 'Conversion Events',
        description: 'Number of successful conversion events',
        metric: 'conversions',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart', 'bar-chart']
      },
      {
        id: 'page_views',
        name: 'Page Views by URL',
        description: 'Total page views across all sessions',
        metric: 'page_views',
        type: 'number',
        widgets: ['big-number', 'line-chart', 'bar-chart']
      },
      {
        id: 'session_duration_avg',
        name: 'Average Session Duration',
        description: 'Average duration of user sessions',
        metric: 'sessions',
        type: 'duration',
        widgets: ['gauge', 'big-number']
      },
      {
        id: 'user_sessions',
        name: 'User Sessions',
        description: 'Sessions for a specific user (by email or uid)',
        metric: 'sessions',
        type: 'number',
        widgets: ['big-number', 'line-chart']
      }
    ];
  }

  /**
   * Validate widget configuration for FullStory
   */
  validateWidgetConfig(widgetConfig) {
    const errors = super.validateWidgetConfig(widgetConfig);

    // FullStory-specific validation
    if (!this.apiKey && !process.env.FULLSTORY_API_KEY) {
      errors.push('FullStory API key required (set FULLSTORY_API_KEY environment variable)');
    }

    // Validate metric type if specified
    const validMetrics = ['sessions', 'rage_clicks', 'errors', 'conversions', 'page_views'];
    if (widgetConfig.metric && !validMetrics.includes(widgetConfig.metric)) {
      errors.push(`Invalid metric type: ${widgetConfig.metric}. Must be one of: ${validMetrics.join(', ')}`);
    }

    return errors;
  }
}

export const fullStoryDataSource = new FullStoryDataSource();
