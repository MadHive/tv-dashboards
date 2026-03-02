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

  async testConnection() {
    return false; // Not implemented
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

  transformData(raw, widgetType) {
    return raw;
  }

  getMockData(widgetType) {
    return this.getEmptyData(widgetType);
  }

  getAvailableMetrics() {
    return [
      { id: 'pageviews', name: 'Page Views', type: 'number', widgets: ['big-number'] },
      { id: 'recordings', name: 'Session Recordings', type: 'number', widgets: ['stat-card'] }
    ];
  }
}

export const hotJarDataSource = new HotJarDataSource();
