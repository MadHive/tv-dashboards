// ===========================================================================
// HotJar Data Source Plugin — User behavior analytics
// ===========================================================================

import { DataSource } from './base.js';

const HOTJAR_API_BASE = 'https://api.hotjar.io/v1';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * HotJar data source for user behavior and website analytics
 *
 * Configuration:
 * - Set HOTJAR_CLIENT_ID environment variable
 * - Set HOTJAR_CLIENT_SECRET environment variable
 * - Set HOTJAR_SITE_ID environment variable
 */
export class HotJarDataSource extends DataSource {
  constructor(config = {}) {
    super('hotjar', config);
    this.clientId = config.clientId || process.env.HOTJAR_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.HOTJAR_CLIENT_SECRET;
    this.siteId = config.siteId || process.env.HOTJAR_SITE_ID;
    this.accessToken = null;
    this.tokenExpiry = 0;
    this.cache = new Map();
  }

  /**
   * Initialize HotJar client by obtaining OAuth token
   */
  async initialize() {
    try {
      // Check if credentials are available
      if (!this.clientId || !this.clientSecret) {
        console.warn('[hotjar] No HotJar credentials found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      // Obtain OAuth access token
      await this.refreshAccessToken();

      if (this.accessToken) {
        console.log('[hotjar] HotJar client initialized');
        this.isConnected = true;
      } else {
        this.isConnected = false;
      }
    } catch (error) {
      console.error({ error: error.message }, 'HotJar data source failed to initialize');
      this.lastError = error;
      this.isConnected = false;
    }
  }

  /**
   * Obtain OAuth access token using client credentials flow
   */
  async refreshAccessToken() {
    try {
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      const response = await fetch(`${HOTJAR_API_BASE}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error({ status: response.status, error: errorText }, 'HotJar OAuth token request failed');
        return;
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + ((data.expires_in || 3600) * 1000);

      console.log('[hotjar] OAuth access token obtained');
    } catch (error) {
      console.error({ error: error.message }, 'Failed to refresh HotJar access token');
      throw error;
    }
  }

  /**
   * Ensure valid access token exists
   */
  async ensureValidToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry - 60000) {
      await this.refreshAccessToken();
    }
  }

  /**
   * Make authenticated request to HotJar API
   */
  async makeRequest(endpoint, options = {}) {
    await this.ensureValidToken();

    if (!this.accessToken) {
      throw new Error('No valid access token available');
    }

    const url = `${HOTJAR_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HotJar API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Fetch data from HotJar API with caching
   */
  async fetchFromAPI(endpoint, cacheKey) {
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    if (cached && now - cached.timestamp < CACHE_TTL) {
      console.debug({ endpoint }, 'Cache hit for HotJar endpoint');
      return cached.data;
    }

    const data = await this.makeRequest(endpoint);
    this.cache.set(cacheKey, { data, timestamp: now });

    return data;
  }

  /**
   * Fetch metrics for a widget
   *
   * Widget config should include:
   * - metricType: Type of metric to fetch ('sites', 'surveys', 'heatmaps', 'polls')
   */
  async fetchMetrics(widgetConfig) {
    try {
      if (!this.accessToken) {
        console.warn('[hotjar] HotJar client not initialized - using mock data');
        return {
          timestamp: new Date().toISOString(),
          source: 'hotjar',
          data: this.getMockData(widgetConfig.type),
          widgetId: widgetConfig.id
        };
      }

      const { metricType = 'sites' } = widgetConfig;
      let data;

      switch (metricType) {
        case 'sites':
          data = await this.fetchSites();
          break;
        case 'surveys':
          data = await this.fetchSurveys();
          break;
        case 'heatmaps':
          data = await this.fetchHeatmaps();
          break;
        case 'polls':
          data = await this.fetchPolls();
          break;
        default:
          data = await this.fetchSites();
      }

      return {
        timestamp: new Date().toISOString(),
        source: 'hotjar',
        data: this.transformData(data, widgetConfig.type, metricType),
        widgetId: widgetConfig.id
      };
    } catch (error) {
      console.error({ error: error.message }, 'HotJar fetch metrics error');
      return this.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Fetch sites data
   */
  async fetchSites() {
    if (!this.siteId) {
      throw new Error('HOTJAR_SITE_ID not configured');
    }

    const cacheKey = `sites-${this.siteId}`;
    return this.fetchFromAPI(`/sites/${this.siteId}`, cacheKey);
  }

  /**
   * Fetch surveys for a site
   */
  async fetchSurveys() {
    if (!this.siteId) {
      throw new Error('HOTJAR_SITE_ID not configured');
    }

    const cacheKey = `surveys-${this.siteId}`;
    return this.fetchFromAPI(`/sites/${this.siteId}/surveys`, cacheKey);
  }

  /**
   * Fetch heatmaps for a site
   */
  async fetchHeatmaps() {
    if (!this.siteId) {
      throw new Error('HOTJAR_SITE_ID not configured');
    }

    const cacheKey = `heatmaps-${this.siteId}`;
    return this.fetchFromAPI(`/sites/${this.siteId}/heatmaps`, cacheKey);
  }

  /**
   * Fetch polls for a site
   */
  async fetchPolls() {
    if (!this.siteId) {
      throw new Error('HOTJAR_SITE_ID not configured');
    }

    const cacheKey = `polls-${this.siteId}`;
    return this.fetchFromAPI(`/sites/${this.siteId}/polls`, cacheKey);
  }

  /**
   * Test connection to HotJar API
   */
  async testConnection() {
    try {
      if (!this.clientId || !this.clientSecret) {
        console.warn('[hotjar] Missing credentials for connection test');
        return false;
      }

      await this.ensureValidToken();

      if (!this.accessToken) {
        return false;
      }

      // Test with a simple API call
      if (this.siteId) {
        await this.makeRequest(`/sites/${this.siteId}`, {
          signal: AbortSignal.timeout(5000)
        });
      } else {
        // If no site ID, just verify token is valid by checking a generic endpoint
        // This may need adjustment based on actual HotJar API capabilities
        console.log('[hotjar] Connection test successful (token obtained)');
      }

      return true;
    } catch (error) {
      console.error({ error: error.message }, 'HotJar connection test failed');
      this.lastError = error;
      return false;
    }
  }

  getConfigSchema() {
    return {
      name: 'HotJar',
      description: 'User behavior and heatmap analytics',
      fields: [
        {
          name: 'clientId',
          type: 'string',
          required: true,
          description: 'HotJar OAuth Client ID',
          secure: true,
          envVar: 'HOTJAR_CLIENT_ID'
        },
        {
          name: 'clientSecret',
          type: 'string',
          required: true,
          description: 'HotJar OAuth Client Secret',
          secure: true,
          envVar: 'HOTJAR_CLIENT_SECRET'
        },
        {
          name: 'siteId',
          type: 'string',
          required: true,
          description: 'HotJar Site ID',
          envVar: 'HOTJAR_SITE_ID'
        },
        {
          name: 'metricType',
          type: 'string',
          required: false,
          description: 'Type of metric to fetch (sites, surveys, heatmaps, polls)',
          default: 'sites'
        }
      ]
    };
  }

  /**
   * Transform HotJar API response to widget format
   */
  transformData(raw, widgetType, metricType = 'sites') {
    if (!raw) {
      return this.getEmptyData(widgetType);
    }

    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        // Extract count-based metrics
        if (metricType === 'surveys' && Array.isArray(raw)) {
          return {
            value: raw.length,
            label: 'Total Surveys',
            trend: 'stable'
          };
        } else if (metricType === 'heatmaps' && Array.isArray(raw)) {
          return {
            value: raw.length,
            label: 'Active Heatmaps',
            trend: 'stable'
          };
        } else if (metricType === 'polls' && Array.isArray(raw)) {
          return {
            value: raw.length,
            label: 'Active Polls',
            trend: 'stable'
          };
        } else if (raw.page_views_count !== undefined) {
          return {
            value: raw.page_views_count,
            label: 'Page Views',
            trend: 'stable'
          };
        }
        return {
          value: 0,
          label: 'No Data',
          trend: 'stable'
        };
      }

      case 'bar-chart': {
        // Transform survey responses or poll data
        if (Array.isArray(raw)) {
          return {
            values: raw.slice(0, 10).map((item, index) => ({
              label: item.name || item.title || `Item ${index + 1}`,
              value: item.response_count || item.responses || 0
            }))
          };
        }
        return { values: [] };
      }

      case 'gauge':
      case 'gauge-row': {
        // Calculate engagement rate or similar percentage metrics
        if (raw.page_views_count && raw.sessions_count) {
          const rate = (raw.sessions_count / raw.page_views_count) * 100;
          return {
            value: Math.round(rate * 100) / 100,
            min: 0,
            max: 100,
            unit: '%',
            label: 'Engagement Rate'
          };
        }
        return {
          value: 0,
          min: 0,
          max: 100,
          unit: '%'
        };
      }

      case 'status-grid': {
        // Transform surveys or polls into status items
        if (Array.isArray(raw)) {
          return {
            items: raw.slice(0, 12).map(item => ({
              label: item.name || item.title || 'Unknown',
              status: item.status === 'active' ? 'healthy' : 'warning',
              value: item.response_count || 0
            }))
          };
        }
        return { items: [] };
      }

      default:
        return raw;
    }
  }

  /**
   * Get mock data for testing when HotJar credentials not available
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return {
          value: 12458,
          label: 'Page Views',
          trend: 'up',
          change: '+12%'
        };

      case 'bar-chart':
        return {
          values: [
            { label: 'Homepage', value: 3245 },
            { label: 'Product Page', value: 2891 },
            { label: 'Pricing', value: 1456 },
            { label: 'About', value: 892 },
            { label: 'Contact', value: 634 }
          ]
        };

      case 'gauge':
      case 'gauge-row':
        return {
          value: 67.5,
          min: 0,
          max: 100,
          unit: '%',
          label: 'Engagement Rate'
        };

      case 'status-grid':
        return {
          items: [
            { label: 'Customer Survey', status: 'healthy', value: 342 },
            { label: 'NPS Survey', status: 'healthy', value: 289 },
            { label: 'Product Feedback', status: 'warning', value: 156 },
            { label: 'Exit Poll', status: 'healthy', value: 98 }
          ]
        };

      default:
        return this.getEmptyData(widgetType);
    }
  }

  /**
   * Get available metrics
   */
  getAvailableMetrics() {
    return [
      {
        id: 'page_views',
        name: 'Page Views',
        description: 'Total page views tracked by HotJar',
        type: 'number',
        metricType: 'sites',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'sessions',
        name: 'Sessions',
        description: 'Total user sessions',
        type: 'number',
        metricType: 'sites',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'surveys_total',
        name: 'Total Surveys',
        description: 'Number of active surveys',
        type: 'number',
        metricType: 'surveys',
        widgets: ['big-number', 'stat-card', 'bar-chart']
      },
      {
        id: 'survey_responses',
        name: 'Survey Responses',
        description: 'Total survey responses',
        type: 'number',
        metricType: 'surveys',
        widgets: ['big-number', 'bar-chart', 'status-grid']
      },
      {
        id: 'heatmaps_total',
        name: 'Active Heatmaps',
        description: 'Number of active heatmaps',
        type: 'number',
        metricType: 'heatmaps',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'polls_total',
        name: 'Active Polls',
        description: 'Number of active polls',
        type: 'number',
        metricType: 'polls',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'poll_responses',
        name: 'Poll Responses',
        description: 'Total poll responses',
        type: 'number',
        metricType: 'polls',
        widgets: ['big-number', 'bar-chart', 'status-grid']
      },
      {
        id: 'engagement_rate',
        name: 'Engagement Rate',
        description: 'User engagement rate percentage',
        type: 'percentage',
        metricType: 'sites',
        widgets: ['gauge', 'gauge-row']
      }
    ];
  }

  /**
   * Validate widget configuration
   */
  validateWidgetConfig(widgetConfig) {
    const errors = super.validateWidgetConfig(widgetConfig);

    // HotJar-specific validation
    if (!this.clientId || !this.clientSecret) {
      errors.push('HotJar credentials required (set HOTJAR_CLIENT_ID and HOTJAR_CLIENT_SECRET environment variables)');
    }

    if (!this.siteId) {
      errors.push('HotJar site ID required (set HOTJAR_SITE_ID environment variable)');
    }

    return errors;
  }
}

export const hotJarDataSource = new HotJarDataSource();
