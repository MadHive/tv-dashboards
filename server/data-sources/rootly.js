// ===========================================================================
// Rootly Data Source Plugin — Incident management and response
// ===========================================================================

import { DataSource } from './base.js';
import logger from '../logger.js';

const ROOTLY_API_URL = process.env.ROOTLY_API_URL || 'https://api.rootly.com/v1';
const ROOTLY_API_KEY = process.env.ROOTLY_API_KEY || '';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Rootly data source for incident management metrics
 *
 * Configuration:
 * - Set ROOTLY_API_KEY environment variable
 * - Optionally set ROOTLY_API_URL (defaults to https://api.rootly.com/v1)
 */
export class RootlyDataSource extends DataSource {
  constructor(config = {}) {
    super('rootly', config);
    this.apiUrl = config.apiUrl || process.env.ROOTLY_API_URL || 'https://api.rootly.com/v1';
    this.apiKey = config.apiKey || process.env.ROOTLY_API_KEY || '';
    this.cache = null;
    this.cacheTime = 0;
    this.requestCount = 0;
    this.requestWindowStart = Date.now();
  }

  /**
   * Check and enforce rate limiting (3000 requests/minute)
   */
  checkRateLimit() {
    const now = Date.now();
    const windowDuration = 60 * 1000; // 1 minute

    // Reset counter if window expired
    if (now - this.requestWindowStart > windowDuration) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }

    // Check limit
    if (this.requestCount >= 3000) {
      throw new Error('Rate limit exceeded: 3000 requests per minute');
    }

    this.requestCount++;
  }

  /**
   * Fetch data from Rootly API with caching
   */
  async fetchFromAPI() {
    const now = Date.now();
    if (this.cache && now - this.cacheTime < CACHE_TTL) {
      return this.cache;
    }

    if (!this.apiKey) {
      logger.warn('[rootly] No API key configured - using mock data');
      return null;
    }

    this.checkRateLimit();

    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json'
    };

    try {
      // Fetch incidents and services in parallel
      const [incidentsRes, servicesRes] = await Promise.all([
        fetch(`${this.apiUrl}/incidents`, { headers }),
        fetch(`${this.apiUrl}/services`, { headers }).catch(() => null)
      ]);

      if (!incidentsRes.ok) {
        logger.error(`[rootly] API error: incidents=${incidentsRes.status}`);
        return this.cache || null;
      }

      const incidents = await incidentsRes.json();
      const services = servicesRes?.ok ? await servicesRes.json() : null;

      // Process incidents data
      const incidentData = incidents.data || [];

      // Calculate metrics
      const metrics = this.calculateMetrics(incidentData);

      this.cache = {
        incidents: incidentData,
        services: services?.data || [],
        metrics
      };
      this.cacheTime = now;

      return this.cache;
    } catch (error) {
      logger.error('[rootly] Fetch error:', error.message);
      return this.cache || null;
    }
  }

  /**
   * Calculate incident metrics from raw data
   */
  calculateMetrics(incidents) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const metrics = {
      active: 0,
      mitigated: 0,
      resolved: 0,
      total: incidents.length,
      bySeverity: { sev1: 0, sev2: 0, sev3: 0, sev4: 0, sev5: 0 },
      byStatus: {},
      last24h: 0,
      last7d: 0,
      mttr: 0,
      mttrSamples: []
    };

    incidents.forEach(incident => {
      const attrs = incident.attributes || {};
      const status = attrs.status || 'unknown';
      const severity = attrs.severity || 'unknown';
      const createdAt = attrs.created_at ? new Date(attrs.created_at) : null;
      const resolvedAt = attrs.resolved_at ? new Date(attrs.resolved_at) : null;

      // Count by status
      if (status === 'started' || status === 'active') {
        metrics.active++;
      } else if (status === 'mitigated') {
        metrics.mitigated++;
      } else if (status === 'resolved') {
        metrics.resolved++;
      }

      // Count by status (detailed)
      metrics.byStatus[status] = (metrics.byStatus[status] || 0) + 1;

      // Count by severity
      const sevKey = severity.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
      if (sevKey in metrics.bySeverity) {
        metrics.bySeverity[sevKey]++;
      } else if (severity) {
        metrics.bySeverity.sev5++; // Default to lowest severity
      }

      // Count recent incidents
      if (createdAt) {
        if (createdAt >= oneDayAgo) metrics.last24h++;
        if (createdAt >= sevenDaysAgo) metrics.last7d++;

        // Calculate MTTR for resolved incidents
        if (resolvedAt && status === 'resolved') {
          const resolutionTime = (resolvedAt - createdAt) / 1000 / 60; // minutes
          metrics.mttrSamples.push(resolutionTime);
        }
      }
    });

    // Calculate mean MTTR
    if (metrics.mttrSamples.length > 0) {
      const sum = metrics.mttrSamples.reduce((a, b) => a + b, 0);
      metrics.mttr = Math.round(sum / metrics.mttrSamples.length);
    }

    return metrics;
  }

  /**
   * Fetch metrics for a widget
   */
  async fetchMetrics(widgetConfig) {
    try {
      const data = await this.fetchFromAPI();

      if (!data) {
        logger.warn('[rootly] Using mock data');
        return {
          timestamp: new Date().toISOString(),
          source: 'rootly',
          data: this.getMockData(widgetConfig.type),
          widgetId: widgetConfig.id
        };
      }

      // Transform data for widget type
      const transformed = this.transformData(data, widgetConfig.type);

      return {
        timestamp: new Date().toISOString(),
        source: 'rootly',
        data: transformed,
        widgetId: widgetConfig.id
      };
    } catch (error) {
      return this.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Test connection to Rootly API
   */
  async testConnection() {
    try {
      if (!this.apiKey) {
        logger.warn('[rootly] No API key configured');
        return false;
      }

      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json'
      };

      const response = await fetch(`${this.apiUrl}/incidents`, {
        headers,
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        logger.info('[rootly] Connection test successful');
        return true;
      }

      logger.error(`[rootly] Connection test failed: ${response.status}`);
      return false;
    } catch (error) {
      logger.error('[rootly] Connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get configuration schema
   */
  getConfigSchema() {
    return {
      name: 'Rootly',
      description: 'Incident management and response tracking',
      fields: [
        {
          name: 'apiUrl',
          type: 'string',
          required: false,
          description: 'Rootly API URL',
          default: 'https://api.rootly.com/v1',
          envVar: 'ROOTLY_API_URL'
        },
        {
          name: 'apiKey',
          type: 'string',
          required: true,
          description: 'Rootly API Key (Bearer token)',
          secure: true,
          envVar: 'ROOTLY_API_KEY'
        }
      ]
    };
  }

  /**
   * Transform raw Rootly data to widget format
   */
  transformData(raw, widgetType) {
    const { metrics } = raw;

    if (!metrics) {
      return this.getEmptyData(widgetType);
    }

    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        const trend = metrics.last24h > (metrics.last7d / 7) ? 'up' : 'down';
        return {
          value: metrics.active,
          trend,
          unit: 'incidents',
          label: 'Active Incidents'
        };
      }

      case 'gauge':
      case 'gauge-row': {
        // MTTR as gauge (0-240 minutes range)
        const maxMTTR = 240; // 4 hours
        const value = Math.min(metrics.mttr, maxMTTR);
        return {
          value,
          min: 0,
          max: maxMTTR,
          unit: 'min',
          label: 'Mean Time to Resolution'
        };
      }

      case 'bar-chart': {
        return {
          values: [
            { label: 'SEV-1', value: metrics.bySeverity.sev1, color: '#DC2626' },
            { label: 'SEV-2', value: metrics.bySeverity.sev2, color: '#EA580C' },
            { label: 'SEV-3', value: metrics.bySeverity.sev3, color: '#F59E0B' },
            { label: 'SEV-4', value: metrics.bySeverity.sev4, color: '#84CC16' },
            { label: 'SEV-5', value: metrics.bySeverity.sev5, color: '#10B981' }
          ]
        };
      }

      case 'alert-list': {
        const alerts = raw.incidents.slice(0, 10).map(incident => {
          const attrs = incident.attributes || {};
          return {
            id: incident.id,
            title: attrs.title || 'Unknown Incident',
            severity: attrs.severity || 'unknown',
            status: attrs.status || 'unknown',
            created_at: attrs.created_at,
            url: attrs.url
          };
        });

        return { alerts };
      }

      case 'status-grid': {
        const items = Object.entries(metrics.byStatus).map(([status, count]) => ({
          label: status.charAt(0).toUpperCase() + status.slice(1),
          value: count,
          status: status === 'resolved' ? 'success' : status === 'active' ? 'error' : 'warning'
        }));

        return { items };
      }

      default:
        return { metrics, incidents: raw.incidents };
    }
  }

  /**
   * Get mock data for fallback
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return {
          value: 3,
          trend: 'down',
          unit: 'incidents',
          label: 'Active Incidents'
        };

      case 'gauge':
      case 'gauge-row':
        return {
          value: 45,
          min: 0,
          max: 240,
          unit: 'min',
          label: 'Mean Time to Resolution'
        };

      case 'bar-chart':
        return {
          values: [
            { label: 'SEV-1', value: 2, color: '#DC2626' },
            { label: 'SEV-2', value: 5, color: '#EA580C' },
            { label: 'SEV-3', value: 12, color: '#F59E0B' },
            { label: 'SEV-4', value: 8, color: '#84CC16' },
            { label: 'SEV-5', value: 3, color: '#10B981' }
          ]
        };

      case 'alert-list':
        return {
          alerts: [
            {
              id: '1',
              title: 'Database connection timeout',
              severity: 'SEV-2',
              status: 'mitigated',
              created_at: new Date(Date.now() - 3600000).toISOString(),
              url: 'https://app.rootly.com/incidents/1'
            },
            {
              id: '2',
              title: 'API latency spike',
              severity: 'SEV-3',
              status: 'active',
              created_at: new Date(Date.now() - 1800000).toISOString(),
              url: 'https://app.rootly.com/incidents/2'
            },
            {
              id: '3',
              title: 'CDN cache issues',
              severity: 'SEV-4',
              status: 'resolved',
              created_at: new Date(Date.now() - 7200000).toISOString(),
              url: 'https://app.rootly.com/incidents/3'
            }
          ]
        };

      case 'status-grid':
        return {
          items: [
            { label: 'Active', value: 3, status: 'error' },
            { label: 'Mitigated', value: 2, status: 'warning' },
            { label: 'Resolved', value: 45, status: 'success' }
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
        id: 'active_incidents',
        name: 'Active Incidents',
        description: 'Number of currently active incidents',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'resolved_incidents',
        name: 'Resolved Incidents',
        description: 'Total number of resolved incidents',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'incidents_by_severity',
        name: 'Incidents by Severity',
        description: 'Breakdown of incidents by severity level',
        type: 'distribution',
        widgets: ['bar-chart', 'status-grid']
      },
      {
        id: 'mttr',
        name: 'Mean Time to Resolution',
        description: 'Average time to resolve incidents (minutes)',
        type: 'duration',
        widgets: ['gauge', 'gauge-row', 'big-number']
      },
      {
        id: 'incidents_by_service',
        name: 'Incidents by Service',
        description: 'Incidents grouped by affected service',
        type: 'distribution',
        widgets: ['bar-chart', 'status-grid']
      },
      {
        id: 'incident_timeline',
        name: 'Incident Timeline',
        description: 'Recent incident activity over time',
        type: 'timeseries',
        widgets: ['line-chart', 'alert-list']
      },
      {
        id: 'incidents_last_24h',
        name: 'Incidents (Last 24h)',
        description: 'Number of incidents in the last 24 hours',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'incidents_last_7d',
        name: 'Incidents (Last 7 days)',
        description: 'Number of incidents in the last 7 days',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'incident_status',
        name: 'Incident Status Overview',
        description: 'Count of incidents by current status',
        type: 'distribution',
        widgets: ['status-grid', 'bar-chart']
      },
      {
        id: 'on_call_status',
        name: 'On-Call Status',
        description: 'Current on-call team status and availability',
        type: 'status',
        widgets: ['status-grid', 'alert-list']
      }
    ];
  }

  /**
   * Validate widget configuration
   */
  validateWidgetConfig(widgetConfig) {
    const errors = super.validateWidgetConfig(widgetConfig);

    // Rootly can work without API key (uses mock data)
    // So we don't enforce API key requirement here

    return errors;
  }
}

// Create singleton instance
export const rootlyDataSource = new RootlyDataSource();
