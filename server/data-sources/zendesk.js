// ===========================================================================
// Zendesk Data Source Plugin — Customer support analytics
// ===========================================================================

import { DataSource } from './base.js';
import zendesk from 'node-zendesk';
import logger from '../logger.js';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_PER_MINUTE = 200; // Zendesk API rate limit

/**
 * Zendesk data source for customer support metrics
 *
 * Configuration:
 * - Set ZENDESK_SUBDOMAIN environment variable (e.g., 'mycompany' for mycompany.zendesk.com)
 * - Set ZENDESK_EMAIL environment variable (admin email)
 * - Set ZENDESK_API_TOKEN environment variable
 */
export class ZendeskDataSource extends DataSource {
  constructor(config = {}) {
    super('zendesk', config);
    this.subdomain = config.subdomain || process.env.ZENDESK_SUBDOMAIN;
    this.apiToken = config.apiToken || process.env.ZENDESK_API_TOKEN;
    this.email = config.email || process.env.ZENDESK_EMAIL;
    this.zendeskClient = null;
    this.cache = null;
    this.cacheTime = 0;
    this.requestCount = 0;
    this.requestWindowStart = Date.now();
  }

  /**
   * Initialize Zendesk client
   */
  async initialize() {
    try {
      // Check if credentials are available
      if (!this.subdomain || !this.apiToken || !this.email) {
        console.warn('No Zendesk credentials found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      // Initialize Zendesk client with API token authentication
      this.zendeskClient = zendesk.createClient({
        username: this.email,
        token: this.apiToken,
        remoteUri: `https://${this.subdomain}.zendesk.com/api/v2`
      });

      this.isConnected = true;
      console.log(`[zendesk] Client initialized for ${this.subdomain}`);
    } catch (error) {
      console.error('[zendesk] Failed to initialize:', error.message);
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

    // Reset counter every minute
    if (windowElapsed >= 60000) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }

    // Check if we've hit the rate limit
    if (this.requestCount >= RATE_LIMIT_PER_MINUTE) {
      const waitTime = 60000 - windowElapsed;
      throw new Error(`Rate limit exceeded. Wait ${Math.ceil(waitTime / 1000)}s`);
    }

    this.requestCount++;
  }

  /**
   * Fetch all Zendesk metrics with caching
   */
  async fetchAllMetrics() {
    const now = Date.now();

    // Return cached data if still fresh
    if (this.cache && now - this.cacheTime < CACHE_TTL) {
      console.debug('Cache hit for Zendesk metrics');
      // Using cached data
      return this.cache;
    }

    // Cache miss - fetching fresh data

    try {
      this.checkRateLimit();

      // Fetch tickets count by status
      const ticketCountsPromise = new Promise((resolve, reject) => {
        this.zendeskClient.tickets.count((err, req, result) => {
          if (err) reject(err);
          else resolve(result.count || {});
        });
      });

      // Fetch satisfaction ratings
      const satisfactionPromise = new Promise((resolve, reject) => {
        this.zendeskClient.satisfactionratings.list((err, req, result) => {
          if (err) reject(err);
          else resolve(result || []);
        });
      });

      const [ticketCounts, satisfaction] = await Promise.all([
        ticketCountsPromise,
        satisfactionPromise
      ]);

      // Calculate metrics
      const openTickets = ticketCounts.open || 0;
      const pendingTickets = ticketCounts.pending || 0;
      const newTickets = ticketCounts.new || 0;
      const solvedTickets = ticketCounts.solved || 0;
      const totalTickets = openTickets + pendingTickets + newTickets + solvedTickets;

      // Calculate satisfaction score
      let satisfactionScore = 0;
      if (satisfaction.length > 0) {
        const satisfied = satisfaction.filter(r => r.score === 'good' || r.score === 'great').length;
        satisfactionScore = Math.round((satisfied / satisfaction.length) * 100);
      }

      const metrics = {
        ticketCounts: {
          open: openTickets,
          pending: pendingTickets,
          new: newTickets,
          solved: solvedTickets,
          total: totalTickets
        },
        satisfaction: {
          score: satisfactionScore,
          ratings: satisfaction.length
        },
        timestamp: now
      };

      // Cache the result
      this.cache = metrics;
      this.cacheTime = now;
      // Metrics cached successfully

      return metrics;
    } catch (error) {
      console.error('[zendesk] Failed to fetch metrics:', error.message);
      // Return cached data if available, even if stale
      if (this.cache) {
        console.warn('Returning stale cached data due to fetch error');
        return this.cache;
      }
      throw error;
    }
  }

  /**
   * Fetch metrics for a widget
   */
  async fetchMetrics(widgetConfig) {
    try {
      if (!this.zendeskClient) {
        await this.initialize();
      }

      if (!this.zendeskClient) {
        console.warn('Zendesk client not initialized - using mock data');
        return {
          timestamp: new Date().toISOString(),
          source: 'zendesk',
          data: this.getMockData(widgetConfig.type),
          widgetId: widgetConfig.id
        };
      }

      const queryStart = Date.now();
      const metrics = await this.fetchAllMetrics();
      const queryDuration = Date.now() - queryStart;

      // Query completed successfully

      // Transform data for widget type
      const transformed = this.transformData(metrics, widgetConfig.type);

      return {
        timestamp: new Date().toISOString(),
        source: 'zendesk',
        data: transformed,
        widgetId: widgetConfig.id
      };
    } catch (error) {
      const queryDuration = Date.now() - (Date.now());
      console.error('[zendesk] Fetch metrics error:', error.message);
      return this.handleError(error, widgetConfig.type);
    }
    logger.warn('[zendesk] Using mock data - Zendesk API not yet implemented');
    return {
      timestamp: new Date().toISOString(),
      source: 'zendesk',
      data: this.getMockData(widgetConfig.type),
      widgetId: widgetConfig.id
    };
  }

  /**
   * Test connection to Zendesk API
   */
  async testConnection() {
    try {
      if (!this.zendeskClient) {
        await this.initialize();
      }

      if (!this.zendeskClient) {
        return false;
      }

      // Test connection by fetching ticket count
      return new Promise((resolve) => {
        this.zendeskClient.tickets.count((err, req, result) => {
          if (err) {
            console.error('[zendesk] Connection test failed:', err.message);
            this.lastError = err;
            resolve(false);
          } else {
            console.log('Zendesk connection test successful');
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('[zendesk] Connection test failed:', error.message);
      this.lastError = error;
      return false;
    }
  }

  /**
   * Get configuration schema
   */
  getConfigSchema() {
    return {
      name: 'Zendesk',
      description: 'Customer support and ticketing system',
      fields: [
        {
          name: 'subdomain',
          type: 'string',
          required: true,
          description: 'Zendesk subdomain (e.g., "mycompany" for mycompany.zendesk.com)',
          envVar: 'ZENDESK_SUBDOMAIN'
        },
        {
          name: 'email',
          type: 'string',
          required: true,
          description: 'Zendesk admin email address',
          envVar: 'ZENDESK_EMAIL'
        },
        {
          name: 'apiToken',
          type: 'string',
          required: true,
          description: 'Zendesk API token',
          secure: true,
          envVar: 'ZENDESK_API_TOKEN'
        }
      ]
    };
  }

  /**
   * Transform Zendesk metrics to widget format
   */
  transformData(metrics, widgetType) {
    if (!metrics || !metrics.ticketCounts) {
      return this.getEmptyData(widgetType);
    }

    const { ticketCounts, satisfaction } = metrics;

    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        return {
          value: ticketCounts.open,
          trend: ticketCounts.open > (ticketCounts.solved || 0) ? 'up' : 'down',
          unit: 'tickets'
        };
      }

      case 'gauge':
      case 'gauge-row': {
        return {
          value: satisfaction.score,
          min: 0,
          max: 100,
          unit: '%',
          label: 'Customer Satisfaction'
        };
      }

      case 'bar-chart': {
        return {
          values: [
            { label: 'New', value: ticketCounts.new, color: '#3B82F6' },
            { label: 'Open', value: ticketCounts.open, color: '#F59E0B' },
            { label: 'Pending', value: ticketCounts.pending, color: '#EF4444' },
            { label: 'Solved', value: ticketCounts.solved, color: '#10B981' }
          ]
        };
      }

      case 'line-chart':
      case 'sparkline': {
        // For time series, we'd need historical data
        // For now, return current snapshot
        return {
          labels: ['Current'],
          values: [ticketCounts.open],
          series: 'Open Tickets'
        };
      }

      default:
        // Return raw metrics for custom widget types
        return {
          ticketCounts,
          satisfaction
        };
    }
  }

  /**
   * Get mock data for testing when Zendesk credentials not available
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return {
          value: 42,
          trend: 'down',
          unit: 'tickets'
        };

      case 'gauge':
      case 'gauge-row':
        return {
          value: 87,
          min: 0,
          max: 100,
          unit: '%',
          label: 'Customer Satisfaction'
        };

      case 'bar-chart':
        return {
          values: [
            { label: 'New', value: 15, color: '#3B82F6' },
            { label: 'Open', value: 42, color: '#F59E0B' },
            { label: 'Pending', value: 8, color: '#EF4444' },
            { label: 'Solved', value: 125, color: '#10B981' }
          ]
        };

      case 'line-chart':
      case 'sparkline': {
        const now = Date.now();
        return {
          labels: Array.from({ length: 12 }, (_, i) =>
            new Date(now - (11 - i) * 3600000).toISOString()
          ),
          values: [65, 59, 80, 81, 56, 55, 40, 42, 38, 35, 32, 28],
          series: 'Open Tickets'
        };
      }

      default:
        return this.getEmptyData(widgetType);
    }
  }

  /**
   * Get available Zendesk metrics
   */
  getAvailableMetrics() {
    return [
      {
        id: 'open_tickets',
        name: 'Open Tickets',
        description: 'Number of open support tickets',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart']
      },
      {
        id: 'new_tickets',
        name: 'New Tickets',
        description: 'Number of new unassigned tickets',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart']
      },
      {
        id: 'pending_tickets',
        name: 'Pending Tickets',
        description: 'Number of pending tickets',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart']
      },
      {
        id: 'solved_tickets',
        name: 'Solved Tickets',
        description: 'Number of solved tickets',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart']
      },
      {
        id: 'customer_satisfaction',
        name: 'Customer Satisfaction Score',
        description: 'Customer satisfaction rating percentage',
        type: 'percentage',
        widgets: ['gauge', 'gauge-row', 'big-number']
      },
      {
        id: 'tickets_by_status',
        name: 'Tickets by Status',
        description: 'Breakdown of tickets by status',
        type: 'distribution',
        widgets: ['bar-chart', 'pie-chart']
      },
      {
        id: 'average_resolution_time',
        name: 'Average Resolution Time',
        description: 'Average time to resolve tickets',
        type: 'duration',
        widgets: ['big-number', 'gauge']
      },
      {
        id: 'agent_performance',
        name: 'Agent Performance',
        description: 'Tickets solved per agent',
        type: 'distribution',
        widgets: ['bar-chart', 'status-grid']
      }
    ];
  }

  /**
   * Validate widget configuration
   */
  validateWidgetConfig(widgetConfig) {
    const errors = super.validateWidgetConfig(widgetConfig);

    // Zendesk credentials are optional - will use mock data if not provided
    // This allows the dashboard to work without Zendesk access

    return errors;
  }
}

// Create singleton instance
export const zendeskDataSource = new ZendeskDataSource();
