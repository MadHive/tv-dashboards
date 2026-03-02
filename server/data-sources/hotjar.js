// ===========================================================================
// HotJar Data Source Plugin — User behavior analytics
// ===========================================================================

import { DataSource } from './base.js';
import axios from 'axios';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const HOTJAR_API_BASE = 'https://api.hotjar.com/v1';

/**
 * HotJar data source for user behavior analytics
 *
 * Configuration:
 * - Set HOTJAR_API_KEY environment variable
 * - Set HOTJAR_SITE_ID environment variable
 */
export class HotJarDataSource extends DataSource {
  constructor(config = {}) {
    super('hotjar', config);
    this.apiKey = config.apiKey || process.env.HOTJAR_API_KEY;
    this.siteId = config.siteId || process.env.HOTJAR_SITE_ID;
    this.metricCache = new Map();
  }

  /**
   * Initialize HotJar client
   */
  async initialize() {
    try {
      // Check if credentials are available
      if (!this.apiKey || !this.siteId) {
        console.warn('[hotjar] No HotJar credentials found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      this.isConnected = true;
      console.log('[hotjar] HotJar client initialized for site:', this.siteId);
    } catch (error) {
      console.error('[hotjar] Failed to initialize:', error.message);
      this.lastError = error;
      this.isConnected = false;
    }
  }

  /**
   * Fetch metrics for a widget
   *
   * Widget config should include:
   * - metric: Metric type (pageviews, heatmaps, recordings, etc.)
   * - dateFrom: Start date (YYYY-MM-DD, default: 7 days ago)
   * - dateTo: End date (YYYY-MM-DD, default: today)
   */
  async fetchMetrics(widgetConfig) {
    try {
      if (!this.apiKey || !this.siteId) {
        console.warn('[hotjar] HotJar client not initialized - using mock data');
        return {
          timestamp: new Date().toISOString(),
          source: 'hotjar',
          data: this.getMockData(widgetConfig.type),
          widgetId: widgetConfig.id
        };
      }

      // Extract HotJar metric parameters
      const {
        metric = 'pageviews',
        dateFrom,
        dateTo
      } = widgetConfig;

      // Default date range: last 7 days
      const to = dateTo || new Date().toISOString().split('T')[0];
      const from = dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Check cache
      const cacheKey = JSON.stringify({ metric, from, to, siteId: this.siteId });
      if (this.metricCache.has(cacheKey)) {
        const cached = this.metricCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          console.log('[hotjar] Cache hit for metric:', metric);
          return {
            timestamp: new Date().toISOString(),
            source: 'hotjar',
            data: this.transformData(cached.data, widgetConfig.type),
            widgetId: widgetConfig.id,
            cached: true
          };
        }
      }

      // Query HotJar API
      const url = `${HOTJAR_API_BASE}/sites/${this.siteId}/${metric}`;
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        params: {
          date_from: from,
          date_to: to
        }
      });

      // Cache the result
      this.metricCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });

      return {
        timestamp: new Date().toISOString(),
        source: 'hotjar',
        data: this.transformData(response.data, widgetConfig.type),
        widgetId: widgetConfig.id
      };
    } catch (error) {
      console.error('[hotjar] Fetch metrics error:', error.message);
      return this.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Test connection to HotJar API
   */
  async testConnection() {
    try {
      if (!this.apiKey || !this.siteId) {
        return false;
      }

      // Try to fetch site info
      const url = `${HOTJAR_API_BASE}/sites/${this.siteId}`;
      await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('[hotjar] Connection test successful');
      return true;
    } catch (error) {
      console.error('[hotjar] Connection test failed:', error.message);
      this.lastError = error;
      return false;
    }
  }

  getConfigSchema() {
    return {
      name: 'HotJar',
      description: 'User behavior and feedback analytics',
      fields: [
        {
          name: 'apiKey',
          type: 'string',
          required: true,
          description: 'HotJar API Key',
          secure: true,
          envVar: 'HOTJAR_API_KEY'
        },
        {
          name: 'siteId',
          type: 'string',
          required: true,
          description: 'HotJar Site ID',
          envVar: 'HOTJAR_SITE_ID'
        },
        {
          name: 'metric',
          type: 'string',
          required: false,
          description: 'Metric type (heatmaps, recordings, polls, surveys)',
          example: 'heatmaps'
        }
      ]
    };
  }

  /**
   * Transform HotJar API response to widget format
   */
  transformData(response, widgetType) {
    if (!response) {
      return this.getEmptyData(widgetType);
    }

    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        const value = response.pageviews || response.total || response.count || 0;
        const previous = response.previous_pageviews || response.previous_total || value;
        const trend = value > previous ? 'up' : value < previous ? 'down' : 'stable';

        return {
          value: Math.round(value),
          previous: Math.round(previous),
          trend,
          unit: ''
        };
      }

      case 'gauge':
      case 'gauge-row': {
        const value = response.percentage || response.rate || 0;
        return {
          value: Math.round(value * 100) / 100,
          min: 0,
          max: 100,
          unit: '%'
        };
      }

      case 'line-chart':
      case 'sparkline': {
        const data = response.data || [];
        return {
          labels: data.map(d => d.date || d.timestamp),
          values: data.map(d => d.value || d.count || 0),
          series: 'HotJar'
        };
      }

      case 'bar-chart': {
        const data = response.data || [];
        const lastN = Math.min(10, data.length);
        const recentData = data.slice(-lastN);

        return {
          values: recentData.map(d => ({
            label: d.label || d.date || d.name,
            value: d.value || d.count || 0
          }))
        };
      }

      default:
        return response;
    }
  }

  /**
   * Get mock data for testing when HotJar not available
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return {
          value: Math.round(Math.random() * 50000),
          unit: 'views'
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
            { label: 'Desktop', value: 12450 },
            { label: 'Mobile', value: 8920 },
            { label: 'Tablet', value: 2340 }
          ]
        };

      case 'line-chart':
      case 'sparkline': {
        const now = Date.now();
        return {
          labels: Array.from({ length: 7 }, (_, i) =>
            new Date(now - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          ),
          values: Array.from({ length: 7 }, () =>
            Math.round(Math.random() * 5000)
          ),
          series: 'Mock Page Views'
        };
      }

      default:
        return this.getEmptyData(widgetType);
    }
  }

  /**
   * Get available HotJar metrics
   */
  getAvailableMetrics() {
    return [
      {
        id: 'pageviews',
        name: 'Page Views',
        description: 'Total page views',
        metric: 'pageviews',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart']
      },
      {
        id: 'recordings',
        name: 'Session Recordings',
        description: 'Number of session recordings',
        metric: 'recordings',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'heatmap_clicks',
        name: 'Heatmap Clicks',
        description: 'Click tracking data',
        metric: 'heatmaps',
        type: 'number',
        widgets: ['big-number', 'bar-chart']
      },
      {
        id: 'feedback_responses',
        name: 'Feedback Responses',
        description: 'Survey and poll responses',
        metric: 'feedback',
        type: 'number',
        widgets: ['big-number', 'line-chart']
      },
      {
        id: 'conversion_rate',
        name: 'Conversion Rate',
        description: 'Goal conversion percentage',
        metric: 'conversions',
        type: 'percentage',
        widgets: ['gauge', 'gauge-row', 'big-number']
      },
      {
        id: 'bounce_rate',
        name: 'Bounce Rate',
        description: 'Percentage of single-page sessions',
        metric: 'bounces',
        type: 'percentage',
        widgets: ['gauge', 'line-chart']
      },
      {
        id: 'avg_session_duration',
        name: 'Average Session Duration',
        description: 'Mean session time in seconds',
        metric: 'sessions',
        type: 'duration',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'custom_metric',
        name: 'Custom Metric',
        description: 'User-defined custom metric',
        metric: '',
        type: 'number',
        widgets: ['big-number', 'gauge', 'line-chart', 'bar-chart']
      }
    ];
  }
}

export const hotJarDataSource = new HotJarDataSource();
