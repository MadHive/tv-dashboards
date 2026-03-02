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

  async fetchMetrics(widgetConfig) {
    console.warn('[hotjar] Using mock data - fetchMetrics not yet implemented');
    return {
      timestamp: new Date().toISOString(),
      source: 'hotjar',
      data: this.getMockData(widgetConfig.type),
      widgetId: widgetConfig.id
    };
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
