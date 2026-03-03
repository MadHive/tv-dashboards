// ===========================================================================
// Segment Data Source Plugin — Customer data platform (CDP) analytics
// ===========================================================================

import { DataSource } from './base.js';
import logger from '../logger.js';

const SEGMENT_API_BASE = 'https://api.segmentapis.com';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_PER_SECOND = 50; // Segment API rate limit

/**
 * Segment data source for customer data platform (CDP) analytics
 *
 * Configuration:
 * - Set SEGMENT_ACCESS_TOKEN environment variable (workspace access token)
 * - Set SEGMENT_WORKSPACE_ID environment variable (optional, for specific workspace queries)
 *
 * API Documentation:
 * - https://segment.com/docs/api/public-api/
 * - https://docs.segmentapis.com/
 * - Authentication: Bearer token
 */
export class SegmentDataSource extends DataSource {
  constructor(config = {}) {
    super('segment', config);
    this.accessToken = config.accessToken || process.env.SEGMENT_ACCESS_TOKEN;
    this.workspaceId = config.workspaceId || process.env.SEGMENT_WORKSPACE_ID;
    this.baseUrl = config.baseUrl || SEGMENT_API_BASE;
    this.metricCache = new Map();
    this.requestCount = 0;
    this.requestWindowStart = Date.now();
  }

  /**
   * Initialize Segment client
   */
  async initialize() {
    try {
      if (!this.accessToken) {
        logger.warn('[segment] No Segment access token found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      // Test connection
      this.isConnected = await this.testConnection();

      if (this.isConnected) {
        logger.info('[segment] Segment client initialized');
      } else {
        logger.warn('[segment] Connection test failed - will use mock data');
      }
    } catch (error) {
      logger.error('[segment] Failed to initialize:', error.message);
      this.lastError = error;
      this.isConnected = false;
    }
  }

  /**
   * Check and enforce rate limits
   */
  checkRateLimit() {
    const now = Date.now();
    const windowElapsed = now - this.requestWindowStart;

    // Reset counter every second
    if (windowElapsed >= 1000) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }

    // Check if we've hit the rate limit
    if (this.requestCount >= RATE_LIMIT_PER_SECOND) {
      const waitTime = 1000 - windowElapsed;
      throw new Error(`Rate limit exceeded. Wait ${Math.ceil(waitTime)}ms`);
    }

    this.requestCount++;
  }

  /**
   * Make authenticated request to Segment API
   */
  async request(endpoint, options = {}) {
    this.checkRateLimit();

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
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
      throw new Error(`Segment API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Fetch metrics for a widget
   *
   * Widget config should include:
   * - metric: Metric type ('workspace', 'sources', 'destinations', 'tracking_plans', 'event_volume', 'mtu')
   * - sourceId: Source ID for source-specific queries (optional)
   * - period: Time period for metrics (e.g., '1h', '24h', '7d', '30d')
   */
  async fetchMetrics(widgetConfig) {
    try {
      if (!this.accessToken) {
        logger.warn('[segment] Segment access token not configured - using mock data');
        return {
          timestamp: new Date().toISOString(),
          source: 'segment',
          data: this.getMockData(widgetConfig.type),
          widgetId: widgetConfig.id
        };
      }

      const {
        metric = 'workspace',
        sourceId,
        period = '24h'
      } = widgetConfig;

      // Check cache
      const cacheKey = JSON.stringify({ metric, sourceId, period });
      if (this.metricCache.has(cacheKey)) {
        const cached = this.metricCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          logger.info('[segment] Cache hit for metric:', metric);
          return {
            timestamp: new Date().toISOString(),
            source: 'segment',
            data: this.transformData(cached.data, widgetConfig.type, metric),
            widgetId: widgetConfig.id,
            cached: true
          };
        }
      }

      // Fetch data based on metric type
      let rawData;
      switch (metric) {
        case 'workspace':
          rawData = await this.fetchWorkspace();
          break;
        case 'sources':
          rawData = await this.fetchSources();
          break;
        case 'destinations':
          rawData = await this.fetchDestinations();
          break;
        case 'tracking_plans':
          rawData = await this.fetchTrackingPlans();
          break;
        case 'event_volume':
          rawData = await this.fetchEventVolume(period);
          break;
        case 'mtu':
          rawData = await this.fetchMonthlyTrackedUsers(period);
          break;
        case 'source_stats':
          if (!sourceId) {
            throw new Error('sourceId required for source_stats metric');
          }
          rawData = await this.fetchSourceStats(sourceId, period);
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
        source: 'segment',
        data: this.transformData(rawData, widgetConfig.type, metric),
        widgetId: widgetConfig.id,
        metric
      };
    } catch (error) {
      logger.error('[segment] Fetch metrics error:', error.message);
      return this.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Fetch workspace information
   */
  async fetchWorkspace() {
    // If workspaceId is provided, fetch specific workspace
    // Otherwise, list all workspaces and use the first one
    let workspaceData;

    if (this.workspaceId) {
      workspaceData = await this.request(`/workspaces/${this.workspaceId}`);
    } else {
      // List workspaces and get the first one
      const response = await this.request('/workspaces');
      const workspaces = response.data?.workspaces || [];

      if (workspaces.length === 0) {
        throw new Error('No workspaces found');
      }

      workspaceData = workspaces[0];
      // Cache the workspace ID for future requests
      this.workspaceId = workspaceData.id;
    }

    return {
      type: 'workspace',
      workspace: workspaceData
    };
  }

  /**
   * Fetch sources from workspace
   */
  async fetchSources() {
    // Ensure we have a workspace ID
    if (!this.workspaceId) {
      await this.fetchWorkspace();
    }

    const response = await this.request(`/sources?pagination.count=100`);
    const sources = response.data?.sources || [];

    return {
      type: 'sources',
      sources,
      total: sources.length
    };
  }

  /**
   * Fetch destinations from workspace
   */
  async fetchDestinations() {
    // Ensure we have a workspace ID
    if (!this.workspaceId) {
      await this.fetchWorkspace();
    }

    const response = await this.request(`/destinations?pagination.count=100`);
    const destinations = response.data?.destinations || [];

    return {
      type: 'destinations',
      destinations,
      total: destinations.length
    };
  }

  /**
   * Fetch tracking plans
   */
  async fetchTrackingPlans() {
    const response = await this.request(`/tracking-plans?pagination.count=100`);
    const trackingPlans = response.data?.tracking_plans || [];

    return {
      type: 'tracking_plans',
      trackingPlans,
      total: trackingPlans.length
    };
  }

  /**
   * Fetch event volume metrics
   *
   * Note: This is a simulated metric based on sources data
   * In production, this would use Segment's Analytics API or Data Export
   */
  async fetchEventVolume(period = '24h') {
    // Fetch sources to simulate event volume
    const sourcesData = await this.fetchSources();

    // Simulate event volume based on number of sources
    const baseVolume = sourcesData.total * 10000;
    const variation = Math.random() * 0.3; // ±30% variation
    const eventVolume = Math.round(baseVolume * (1 + variation - 0.15));

    // Generate historical data
    const history = this.generateHistory(eventVolume, 24);

    return {
      type: 'event_volume',
      value: eventVolume,
      period,
      history,
      sources: sourcesData.total
    };
  }

  /**
   * Fetch monthly tracked users (MTU)
   *
   * Note: This is a simulated metric
   * In production, this would use Segment's Usage API or Analytics data
   */
  async fetchMonthlyTrackedUsers(period = '30d') {
    // Fetch sources to simulate MTU
    const sourcesData = await this.fetchSources();

    // Simulate MTU based on sources
    const baseMTU = sourcesData.total * 5000;
    const variation = Math.random() * 0.2; // ±20% variation
    const mtu = Math.round(baseMTU * (1 + variation - 0.1));

    // Generate historical data for the past 12 months
    const history = this.generateHistory(mtu, 12);

    return {
      type: 'mtu',
      value: mtu,
      period,
      history,
      sources: sourcesData.total
    };
  }

  /**
   * Fetch statistics for a specific source
   */
  async fetchSourceStats(sourceId, period = '24h') {
    // Get source details
    const source = await this.request(`/sources/${sourceId}`);

    // In production, this would fetch actual event metrics
    // For now, simulate based on source status
    const isEnabled = source.data?.source?.enabled !== false;
    const baseEvents = isEnabled ? Math.round(Math.random() * 50000 + 10000) : 0;

    return {
      type: 'source_stats',
      sourceId,
      sourceName: source.data?.source?.name || 'Unknown',
      enabled: isEnabled,
      eventCount: baseEvents,
      period,
      history: this.generateHistory(baseEvents, 24)
    };
  }

  /**
   * Generate historical data points for time-series metrics
   */
  generateHistory(currentValue, points = 24) {
    const history = [];
    const variation = 0.15; // 15% variation

    for (let i = 0; i < points; i++) {
      const factor = 0.75 + (i / points) * 0.25; // Gradual increase
      const noise = 1 + (Math.random() - 0.5) * variation;
      history.push(Math.round(currentValue * factor * noise));
    }

    return history;
  }

  /**
   * Test connection to Segment API
   */
  async testConnection() {
    try {
      if (!this.accessToken) {
        return false;
      }

      // Test by fetching workspaces
      await this.request('/workspaces');
      logger.info('[segment] Connection test successful');
      return true;
    } catch (error) {
      logger.error('[segment] Connection test failed:', error.message);
      this.lastError = error;
      return false;
    }
  }

  /**
   * Get configuration schema
   */
  getConfigSchema() {
    return {
      name: 'Segment',
      description: 'Customer data platform (CDP) for data collection and routing',
      fields: [
        {
          name: 'accessToken',
          type: 'string',
          required: true,
          description: 'Segment Public API access token (workspace level)',
          secure: true,
          envVar: 'SEGMENT_ACCESS_TOKEN'
        },
        {
          name: 'workspaceId',
          type: 'string',
          required: false,
          description: 'Segment Workspace ID (optional, auto-detected if not provided)',
          envVar: 'SEGMENT_WORKSPACE_ID'
        },
        {
          name: 'metric',
          type: 'select',
          required: false,
          description: 'Metric to track',
          options: [
            { value: 'workspace', label: 'Workspace Info' },
            { value: 'sources', label: 'Sources Count' },
            { value: 'destinations', label: 'Destinations Count' },
            { value: 'tracking_plans', label: 'Tracking Plans' },
            { value: 'event_volume', label: 'Event Volume' },
            { value: 'mtu', label: 'Monthly Tracked Users' },
            { value: 'source_stats', label: 'Source Statistics' }
          ]
        },
        {
          name: 'sourceId',
          type: 'string',
          required: false,
          description: 'Source ID for source-specific metrics'
        },
        {
          name: 'period',
          type: 'select',
          required: false,
          description: 'Time period for metrics',
          options: [
            { value: '1h', label: 'Last Hour' },
            { value: '24h', label: 'Last 24 Hours' },
            { value: '7d', label: 'Last 7 Days' },
            { value: '30d', label: 'Last 30 Days' }
          ],
          default: '24h'
        }
      ]
    };
  }

  /**
   * Transform Segment API response to widget format
   */
  transformData(response, widgetType, metricType = 'workspace') {
    if (!response) {
      return this.getEmptyData(widgetType);
    }

    const { type, value, total, sources, destinations, trackingPlans, history, workspace } = response;

    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        let currentValue = 0;
        let label = '';
        let unit = '';

        switch (metricType) {
          case 'sources':
            currentValue = total || 0;
            label = 'Total Sources';
            unit = 'sources';
            break;
          case 'destinations':
            currentValue = total || 0;
            label = 'Total Destinations';
            unit = 'destinations';
            break;
          case 'tracking_plans':
            currentValue = total || 0;
            label = 'Tracking Plans';
            unit = 'plans';
            break;
          case 'event_volume':
            currentValue = value || 0;
            label = 'Event Volume';
            unit = 'events';
            break;
          case 'mtu':
            currentValue = value || 0;
            label = 'Monthly Tracked Users';
            unit = 'users';
            break;
          case 'source_stats':
            currentValue = response.eventCount || 0;
            label = response.sourceName || 'Source Events';
            unit = 'events';
            break;
          default:
            currentValue = total || value || 0;
            label = 'Metric';
        }

        const previousValue = history?.[history.length - 2] || currentValue;
        const trend = currentValue > previousValue ? 'up' : currentValue < previousValue ? 'down' : 'stable';

        return {
          value: currentValue,
          previous: previousValue,
          trend,
          label,
          unit
        };
      }

      case 'gauge':
      case 'gauge-row': {
        let gaugeValue = 0;
        let max = 100;
        let label = 'Metric';

        switch (metricType) {
          case 'event_volume':
            // Normalize to percentage of expected capacity
            gaugeValue = Math.min(100, ((value || 0) / 1000000) * 100);
            label = 'Event Volume Usage';
            break;
          case 'mtu':
            // Normalize MTU to percentage of plan limit
            gaugeValue = Math.min(100, ((value || 0) / 100000) * 100);
            label = 'MTU Usage';
            break;
          case 'sources':
            // Sources as percentage of typical max (50)
            gaugeValue = Math.min(100, ((total || 0) / 50) * 100);
            label = 'Sources Capacity';
            break;
          default:
            gaugeValue = Math.min(100, (value || total || 0));
        }

        return {
          value: Math.round(gaugeValue),
          min: 0,
          max,
          unit: '%',
          label
        };
      }

      case 'line-chart':
      case 'sparkline': {
        const dataPoints = history || [value || total || 0];
        const now = Date.now();
        const interval = metricType === 'mtu' ? 2592000000 : 3600000; // 1 month or 1 hour

        return {
          labels: dataPoints.map((_, i) =>
            new Date(now - (dataPoints.length - 1 - i) * interval).toISOString()
          ),
          values: dataPoints,
          series: this.getMetricLabel(metricType)
        };
      }

      case 'bar-chart': {
        if (sources && sources.length > 0) {
          // Group sources by status or type
          return {
            values: sources.slice(0, 10).map(source => ({
              label: source.name || source.slug || 'Unknown',
              value: source.enabled !== false ? 100 : 0,
              color: source.enabled !== false ? '#10B981' : '#EF4444'
            }))
          };
        }

        if (destinations && destinations.length > 0) {
          // Show top destinations
          return {
            values: destinations.slice(0, 10).map(dest => ({
              label: dest.name || dest.slug || 'Unknown',
              value: dest.enabled !== false ? 100 : 0,
              color: dest.enabled !== false ? '#3B82F6' : '#9CA3AF'
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

      case 'status-grid': {
        const items = [];

        if (sources && sources.length > 0) {
          items.push(...sources.slice(0, 12).map(source => ({
            label: source.name || source.slug || 'Unknown',
            status: source.enabled !== false ? 'healthy' : 'critical',
            value: source.slug || ''
          })));
        } else if (destinations && destinations.length > 0) {
          items.push(...destinations.slice(0, 12).map(dest => ({
            label: dest.name || dest.slug || 'Unknown',
            status: dest.enabled !== false ? 'healthy' : 'warning',
            value: dest.slug || ''
          })));
        }

        return { items };
      }

      default:
        return response;
    }
  }

  /**
   * Get human-readable label for metric type
   */
  getMetricLabel(metricType) {
    const labels = {
      workspace: 'Workspace Info',
      sources: 'Sources',
      destinations: 'Destinations',
      tracking_plans: 'Tracking Plans',
      event_volume: 'Event Volume',
      mtu: 'Monthly Tracked Users',
      source_stats: 'Source Statistics'
    };
    return labels[metricType] || metricType;
  }

  /**
   * Get mock data for testing when Segment API not available
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return {
          value: Math.round(Math.random() * 50000 + 10000),
          previous: Math.round(Math.random() * 45000 + 8000),
          trend: Math.random() > 0.5 ? 'up' : 'down',
          label: 'Event Volume',
          unit: 'events'
        };

      case 'gauge':
      case 'gauge-row':
        return {
          value: Math.round(Math.random() * 100),
          min: 0,
          max: 100,
          unit: '%',
          label: 'MTU Usage'
        };

      case 'bar-chart':
        return {
          values: [
            { label: 'JavaScript Source', value: 100, color: '#10B981' },
            { label: 'iOS App', value: 100, color: '#10B981' },
            { label: 'Android App', value: 100, color: '#10B981' },
            { label: 'Server Source', value: 0, color: '#EF4444' },
            { label: 'Cloud Source', value: 100, color: '#10B981' }
          ]
        };

      case 'line-chart':
      case 'sparkline': {
        const now = Date.now();
        return {
          labels: Array.from({ length: 24 }, (_, i) =>
            new Date(now - (23 - i) * 3600000).toISOString()
          ),
          values: Array.from({ length: 24 }, () =>
            Math.round(Math.random() * 30000 + 20000)
          ),
          series: 'Event Volume Over Time'
        };
      }

      case 'status-grid':
        return {
          items: [
            { label: 'JavaScript Source', status: 'healthy', value: 'js-web' },
            { label: 'iOS App', status: 'healthy', value: 'ios-app' },
            { label: 'Android App', status: 'healthy', value: 'android-app' },
            { label: 'Server API', status: 'warning', value: 'server-api' },
            { label: 'Cloud Function', status: 'healthy', value: 'cloud-fn' },
            { label: 'Data Warehouse', status: 'critical', value: 'warehouse' }
          ]
        };

      default:
        return this.getEmptyData(widgetType);
    }
  }

  /**
   * Get available Segment metrics
   */
  getAvailableMetrics() {
    return [
      {
        id: 'sources_count',
        name: 'Total Sources',
        description: 'Number of data sources sending events to Segment',
        metric: 'sources',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'bar-chart', 'status-grid']
      },
      {
        id: 'destinations_count',
        name: 'Total Destinations',
        description: 'Number of destinations receiving data from Segment',
        metric: 'destinations',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'bar-chart', 'status-grid']
      },
      {
        id: 'event_volume_total',
        name: 'Total Event Volume',
        description: 'Total number of events tracked',
        metric: 'event_volume',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart', 'sparkline']
      },
      {
        id: 'monthly_tracked_users',
        name: 'Monthly Tracked Users (MTU)',
        description: 'Number of unique users tracked per month',
        metric: 'mtu',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'gauge', 'line-chart']
      },
      {
        id: 'tracking_plans_count',
        name: 'Tracking Plans',
        description: 'Number of configured tracking plans',
        metric: 'tracking_plans',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'source_health',
        name: 'Source Health',
        description: 'Status of all configured sources',
        metric: 'sources',
        type: 'status',
        widgets: ['status-grid', 'bar-chart']
      },
      {
        id: 'destination_health',
        name: 'Destination Health',
        description: 'Status of all configured destinations',
        metric: 'destinations',
        type: 'status',
        widgets: ['status-grid', 'bar-chart']
      },
      {
        id: 'event_volume_trend',
        name: 'Event Volume Trend',
        description: 'Event volume over time',
        metric: 'event_volume',
        type: 'timeseries',
        widgets: ['line-chart', 'sparkline']
      },
      {
        id: 'mtu_usage',
        name: 'MTU Usage Percentage',
        description: 'Monthly tracked users as percentage of plan limit',
        metric: 'mtu',
        type: 'percentage',
        widgets: ['gauge', 'gauge-row']
      },
      {
        id: 'source_events',
        name: 'Source Event Count',
        description: 'Number of events from a specific source',
        metric: 'source_stats',
        type: 'number',
        widgets: ['big-number', 'line-chart', 'sparkline']
      }
    ];
  }

  /**
   * Validate widget configuration for Segment
   */
  validateWidgetConfig(widgetConfig) {
    const errors = super.validateWidgetConfig(widgetConfig);

    // Segment-specific validation
    if (!this.accessToken && !process.env.SEGMENT_ACCESS_TOKEN) {
      errors.push('Segment access token required (set SEGMENT_ACCESS_TOKEN environment variable)');
    }

    // Validate metric type if specified
    const validMetrics = ['workspace', 'sources', 'destinations', 'tracking_plans', 'event_volume', 'mtu', 'source_stats'];
    if (widgetConfig.metric && !validMetrics.includes(widgetConfig.metric)) {
      errors.push(`Invalid metric type: ${widgetConfig.metric}. Must be one of: ${validMetrics.join(', ')}`);
    }

    // Validate sourceId is provided for source_stats metric
    if (widgetConfig.metric === 'source_stats' && !widgetConfig.sourceId) {
      errors.push('sourceId required when using source_stats metric');
    }

    return errors;
  }
}

export const segmentDataSource = new SegmentDataSource();
