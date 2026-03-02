// ===========================================================================
// Salesforce Data Source Plugin — CRM analytics
// ===========================================================================

import { DataSource } from './base.js';
import jsforce from 'jsforce';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Salesforce data source for CRM analytics and sales metrics
 *
 * Configuration:
 * - Set SALESFORCE_INSTANCE_URL environment variable (e.g., https://yourinstance.salesforce.com)
 * - Set SALESFORCE_ACCESS_TOKEN or OAuth credentials
 */
export class SalesforceDataSource extends DataSource {
  constructor(config = {}) {
    super('salesforce', config);
    this.instanceUrl = config.instanceUrl || process.env.SALESFORCE_INSTANCE_URL;
    this.accessToken = config.accessToken || process.env.SALESFORCE_ACCESS_TOKEN;
    this.clientId = config.clientId || process.env.SALESFORCE_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.SALESFORCE_CLIENT_SECRET;
    this.username = config.username || process.env.SALESFORCE_USERNAME;
    this.password = config.password || process.env.SALESFORCE_PASSWORD;
    this.connection = null;
    this.metricCache = new Map();
  }

  /**
   * Initialize Salesforce connection
   */
  async initialize() {
    try {
      // Check if connection info is available
      if (!this.instanceUrl) {
        console.warn('[salesforce] No Salesforce instance URL found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      // Use access token if available, otherwise OAuth username/password flow
      if (this.accessToken) {
        this.connection = new jsforce.Connection({
          instanceUrl: this.instanceUrl,
          accessToken: this.accessToken
        });
      } else if (this.username && this.password) {
        this.connection = new jsforce.Connection({
          loginUrl: this.instanceUrl
        });

        // Login with OAuth credentials
        await this.connection.login(this.username, this.password);
      } else {
        console.warn('[salesforce] No authentication credentials found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      this.isConnected = true;
      console.log('[salesforce] Salesforce connection initialized for:', this.instanceUrl);
    } catch (error) {
      console.error('[salesforce] Failed to initialize:', error.message);
      this.lastError = error;
      this.isConnected = false;
    }
  }

  async fetchMetrics(widgetConfig) {
    console.warn('[salesforce] Using mock data - fetchMetrics not yet implemented');
    return {
      timestamp: new Date().toISOString(),
      source: 'salesforce',
      data: this.getMockData(widgetConfig.type),
      widgetId: widgetConfig.id
    };
  }

  async testConnection() {
    return false; // Not implemented
  }

  getConfigSchema() {
    return {
      name: 'Salesforce',
      description: 'CRM and sales analytics',
      fields: [
        {
          name: 'instanceUrl',
          type: 'string',
          required: true,
          description: 'Salesforce instance URL',
          example: 'https://yourinstance.salesforce.com',
          envVar: 'SALESFORCE_INSTANCE_URL'
        },
        {
          name: 'accessToken',
          type: 'string',
          required: false,
          description: 'Salesforce access token (preferred)',
          secure: true,
          envVar: 'SALESFORCE_ACCESS_TOKEN'
        },
        {
          name: 'clientId',
          type: 'string',
          required: false,
          description: 'OAuth client ID (if not using access token)',
          envVar: 'SALESFORCE_CLIENT_ID'
        },
        {
          name: 'clientSecret',
          type: 'string',
          required: false,
          description: 'OAuth client secret (if not using access token)',
          secure: true,
          envVar: 'SALESFORCE_CLIENT_SECRET'
        },
        {
          name: 'username',
          type: 'string',
          required: false,
          description: 'Salesforce username (if using OAuth)',
          envVar: 'SALESFORCE_USERNAME'
        },
        {
          name: 'password',
          type: 'string',
          required: false,
          description: 'Salesforce password (if using OAuth)',
          secure: true,
          envVar: 'SALESFORCE_PASSWORD'
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
      { id: 'leads', name: 'Leads', type: 'number', widgets: ['big-number'] },
      { id: 'opportunities', name: 'Opportunities', type: 'number', widgets: ['stat-card'] }
    ];
  }
}

export const salesforceDataSource = new SalesforceDataSource();
