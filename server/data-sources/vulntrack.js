// ===========================================================================
// VulnTrack Data Source Plugin — Vulnerability tracking system
// ===========================================================================

import { DataSource } from './base.js';

const VULNTRACK_URL = process.env.VULNTRACK_API_URL || 'https://vulntrack.madhive.dev';
const VULNTRACK_KEY = process.env.VULNTRACK_API_KEY || '';
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

/**
 * VulnTrack data source for security metrics
 */
export class VulnTrackDataSource extends DataSource {
  constructor(config = {}) {
    super('vulntrack', config);
    this.cache = null;
    this.cacheTime = 0;
    this.apiUrl = config.apiUrl || VULNTRACK_URL;
    this.apiKey = config.apiKey || VULNTRACK_KEY;
  }

  /**
   * Fetch data from VulnTrack API with caching
   */
  async fetchFromAPI() {
    const now = Date.now();
    if (this.cache && now - this.cacheTime < CACHE_TTL) {
      return this.cache;
    }

    const headers = {
      'X-API-Key': this.apiKey,
      'Accept': 'application/json'
    };

    try {
      const [dashRes, statsRes] = await Promise.all([
        fetch(`${this.apiUrl}/api/reports/dashboard?teamIds=global`, { headers }),
        fetch(`${this.apiUrl}/api/vulnerabilities/stats?teamIds=global`, { headers }),
      ]);

      if (!dashRes.ok || !statsRes.ok) {
        console.error(`[vulntrack] API error: dashboard=${dashRes.status} stats=${statsRes.status}`);
        return this.cache || null;
      }

      const dash = await dashRes.json();
      const stats = await statsRes.json();

      this.cache = { dash, stats };
      this.cacheTime = now;

      return this.cache;
    } catch (error) {
      console.error('[vulntrack] Fetch error:', error.message);
      return this.cache || null;
    }
  }

  /**
   * Fetch metrics for a widget
   */
  async fetchMetrics(widgetConfig) {
    try {
      const data = await this.fetchFromAPI();

      if (!data) {
        throw new Error('Failed to fetch VulnTrack data');
      }

      // Transform data for widget type
      const transformed = this.transformData(data, widgetConfig.type);

      return {
        timestamp: new Date().toISOString(),
        source: 'vulntrack',
        data: transformed,
        widgetId: widgetConfig.id
      };
    } catch (error) {
      return this.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Test connection to VulnTrack API
   */
  async testConnection() {
    try {
      const headers = {
        'X-API-Key': this.apiKey,
        'Accept': 'application/json'
      };

      const response = await fetch(`${this.apiUrl}/api/reports/dashboard?teamIds=global`, {
        headers,
        signal: AbortSignal.timeout(5000)
      });

      return response.ok;
    } catch (error) {
      console.error('[vulntrack] Connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get configuration schema
   */
  getConfigSchema() {
    return {
      name: 'VulnTrack',
      description: 'Vulnerability tracking and security posture monitoring',
      fields: [
        {
          name: 'apiUrl',
          type: 'string',
          required: false,
          description: 'VulnTrack API URL',
          default: 'https://vulntrack.madhive.dev'
        },
        {
          name: 'apiKey',
          type: 'string',
          required: true,
          description: 'VulnTrack API Key',
          secure: true,
          envVar: 'VULNTRACK_API_KEY'
        },
        {
          name: 'teamIds',
          type: 'string',
          required: false,
          description: 'Comma-separated team IDs to filter',
          default: 'global'
        }
      ]
    };
  }

  /**
   * Transform raw VulnTrack data to widget format
   */
  transformData(raw, widgetType) {
    const { dash, stats } = raw;
    const s = dash.stats || {};

    switch (widgetType) {
      case 'security-scorecard': {
        // Calculate security score
        const total = s.total || 0;
        const critical = s.critical || 0;
        const high = s.high || 0;
        const medium = s.medium || 0;

        // Score formula: 100 - weighted severity impact
        const score = Math.max(0, 100 - (critical * 10 + high * 3 + medium * 1));

        // Source breakdown
        const bySource = {};
        if (stats.bySource) {
          Object.entries(stats.bySource).forEach(([k, v]) => {
            const label = k.replace('github_', '').replace('_', ' ')
              .replace(/\b\w/g, c => c.toUpperCase());
            bySource[label] = v;
          });
        }

        return {
          score: Math.round(score),
          total: total,
          critical: critical,
          high: high,
          medium: medium,
          low: s.low || 0,
          bySource: bySource,
          history: (dash.history || []).map(h => h.total || 0),
          trend: total < (dash.history?.[dash.history.length - 2]?.total || total) ? 'down' : 'up'
        };
      }

      case 'big-number':
      case 'stat-card':
        return {
          value: s.total || 0,
          critical: s.critical || 0,
          high: s.high || 0,
          trend: s.total < (dash.history?.[dash.history.length - 2]?.total || s.total) ? 'down' : 'up'
        };

      case 'bar-chart': {
        return {
          values: [
            { label: 'Critical', value: s.critical || 0, color: '#EF4444' },
            { label: 'High', value: s.high || 0, color: '#F59E0B' },
            { label: 'Medium', value: s.medium || 0, color: '#FBBF24' },
            { label: 'Low', value: s.low || 0, color: '#10B981' }
          ]
        };
      }

      default:
        return { dash, stats };
    }
  }

  /**
   * Get mock data for fallback
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'security-scorecard':
        return {
          score: 85,
          total: 42,
          critical: 2,
          high: 8,
          medium: 18,
          low: 14,
          bySource: {
            'GitHub': 25,
            'Docker': 10,
            'NPM': 7
          },
          history: [50, 48, 45, 43, 42],
          trend: 'down'
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
        id: 'vulnerabilities_total',
        name: 'Total Vulnerabilities',
        description: 'Total number of vulnerabilities',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'vulnerabilities_critical',
        name: 'Critical Vulnerabilities',
        description: 'Number of critical severity vulnerabilities',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'security_score',
        name: 'Security Score',
        description: 'Overall security posture score',
        type: 'percentage',
        widgets: ['gauge', 'security-scorecard']
      },
      {
        id: 'vulnerabilities_by_severity',
        name: 'Vulnerabilities by Severity',
        description: 'Breakdown of vulnerabilities by severity level',
        type: 'distribution',
        widgets: ['bar-chart', 'security-scorecard']
      }
    ];
  }

  /**
   * Validate widget configuration
   */
  validateWidgetConfig(widgetConfig) {
    const errors = super.validateWidgetConfig(widgetConfig);

    // VulnTrack-specific validation
    if (!this.apiKey && !process.env.VULNTRACK_API_KEY) {
      errors.push('VulnTrack API key required (set VULNTRACK_API_KEY environment variable)');
    }

    return errors;
  }
}

// Create singleton instance
export const vulnTrackDataSource = new VulnTrackDataSource();
