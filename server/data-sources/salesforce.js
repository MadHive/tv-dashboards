// ===========================================================================
// Salesforce Data Source Plugin — CRM analytics
// ===========================================================================

import { DataSource } from './base.js';
import jsforce from 'jsforce';
import logger from '../logger.js';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Salesforce data source for CRM analytics
 *
 * Configuration:
 * OAuth 2.0:
 * - Set SALESFORCE_INSTANCE_URL environment variable (e.g., https://yourinstance.my.salesforce.com)
 * - Set SALESFORCE_CLIENT_ID environment variable (OAuth Connected App)
 * - Set SALESFORCE_CLIENT_SECRET environment variable
 * - Set SALESFORCE_USERNAME environment variable
 * - Set SALESFORCE_PASSWORD environment variable
 * - Set SALESFORCE_SECURITY_TOKEN environment variable (appended to password)
 *
 * OR Token-based:
 * - Set SALESFORCE_INSTANCE_URL environment variable
 * - Set SALESFORCE_ACCESS_TOKEN environment variable
 */
export class SalesforceDataSource extends DataSource {
  constructor(config = {}) {
    super('salesforce', config);

    // Connection settings
    this.instanceUrl = config.instanceUrl || process.env.SALESFORCE_INSTANCE_URL;
    this.isSandbox = config.isSandbox || process.env.SALESFORCE_SANDBOX === 'true';

    // OAuth credentials
    this.clientId = config.clientId || process.env.SALESFORCE_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.SALESFORCE_CLIENT_SECRET;
    this.username = config.username || process.env.SALESFORCE_USERNAME;
    this.password = config.password || process.env.SALESFORCE_PASSWORD;
    this.securityToken = config.securityToken || process.env.SALESFORCE_SECURITY_TOKEN;

    // Direct access token (alternative to OAuth)
    this.accessToken = config.accessToken || process.env.SALESFORCE_ACCESS_TOKEN;

    // Client instance
    this.connection = null;
    this.metricCache = new Map();
  }

  /**
   * Initialize Salesforce connection
   */
  async initialize() {
    try {
      // Check if we have credentials
      const hasOAuth = this.username && this.password;
      const hasToken = this.accessToken && this.instanceUrl;

      if (!hasOAuth && !hasToken) {
        console.warn('[salesforce] No Salesforce credentials found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      // Create connection with appropriate login URL
      const loginUrl = this.isSandbox
        ? 'https://test.salesforce.com'
        : 'https://login.salesforce.com';

      // Use access token if available
      if (hasToken) {
        this.connection = new jsforce.Connection({
          instanceUrl: this.instanceUrl,
          accessToken: this.accessToken
        });

        console.log({ instanceUrl: this.instanceUrl }, 'Salesforce connection initialized with access token');
      }
      // Otherwise use OAuth username/password flow
      else {
        this.connection = new jsforce.Connection({
          loginUrl,
          clientId: this.clientId,
          clientSecret: this.clientSecret
        });

        // Append security token to password if provided
        const fullPassword = this.securityToken
          ? this.password + this.securityToken
          : this.password;

        // Login
        const userInfo = await this.connection.login(this.username, fullPassword);

        console.log({
          userId: userInfo.id,
          orgId: userInfo.organizationId,
          isSandbox: this.isSandbox
        }, 'Salesforce connection initialized via OAuth');
      }

      this.isConnected = true;
    } catch (error) {
      console.error({ error: error.message }, 'Salesforce data source failed to initialize');
      this.lastError = error;
      this.isConnected = false;
    }
  }

  /**
   * Fetch metrics for a widget using SOQL queries
   *
   * Widget config should include:
   * - soql: SOQL query string (e.g., 'SELECT COUNT() FROM Lead WHERE Status = \'Open\'')
   * - object: Salesforce object name (e.g., 'Lead', 'Opportunity', 'Case')
   * - aggregation: Aggregation type (count, sum, avg)
   * - field: Field to aggregate (for sum, avg)
   * - where: WHERE clause (optional)
   * - groupBy: GROUP BY field (optional)
   * - timeField: Date field for time-based queries (default: 'CreatedDate')
   * - timeRange: Time range in days (default: 30)
   */
  async fetchMetrics(widgetConfig) {
    try {
      if (!this.connection) {
        console.warn('[salesforce] Salesforce connection not initialized - using mock data');
        return {
          timestamp: new Date().toISOString(),
          source: 'salesforce',
          data: this.getMockData(widgetConfig.type),
          widgetId: widgetConfig.id
        };
      }

      // Extract SOQL parameters
      const {
        soql,
        object: sfObject = 'Lead',
        aggregation = 'count',
        field,
        where,
        groupBy,
        timeField = 'CreatedDate',
        timeRange = 30
      } = widgetConfig;

      // Build SOQL query if not provided
      let query = soql;
      if (!query) {
        query = this.buildSOQLQuery({
          object: sfObject,
          aggregation,
          field,
          where,
          groupBy,
          timeField,
          timeRange
        });
      }

      // Check cache
      const cacheKey = JSON.stringify({ query });
      if (this.metricCache.has(cacheKey)) {
        const cached = this.metricCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          console.log({ query }, 'Cache hit for Salesforce query');
          return {
            timestamp: new Date().toISOString(),
            source: 'salesforce',
            data: this.transformData(cached.data, widgetConfig.type, aggregation),
            widgetId: widgetConfig.id,
            cached: true
          };
        }
      }

      // Execute SOQL query
      const queryStart = Date.now();
      const result = await this.connection.query(query);
      const queryDuration = Date.now() - queryStart;

      console.log({ query, duration: queryDuration }, 'Salesforce query executed');

      // Cache the result
      this.metricCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return {
        timestamp: new Date().toISOString(),
        source: 'salesforce',
        data: this.transformData(result, widgetConfig.type, aggregation),
        widgetId: widgetConfig.id
      };
    } catch (error) {
      console.error({ error: error.message }, 'Salesforce fetch metrics error');
      return this.handleError(error, widgetConfig.type);
    }
    logger.warn('[salesforce] Using mock data - Salesforce API not yet implemented');
    return {
      timestamp: new Date().toISOString(),
      source: 'salesforce',
      data: this.getMockData(widgetConfig.type),
      widgetId: widgetConfig.id
    };
  }

  /**
   * Build SOQL query from parameters
   */
  buildSOQLQuery({ object, aggregation, field, where, groupBy, timeField, timeRange }) {
    let query = 'SELECT ';

    // Build aggregation - handle groupBy first
    if (groupBy) {
      // For grouped queries, select the group field and aggregation
      if (aggregation === 'sum' && field) {
        query += `${groupBy}, SUM(${field})`;
      } else if (aggregation === 'avg' && field) {
        query += `${groupBy}, AVG(${field})`;
      } else {
        query += `${groupBy}, COUNT()`;
      }
    } else if (aggregation === 'count') {
      query += 'COUNT()';
    } else if (aggregation === 'sum' && field) {
      query += `SUM(${field})`;
    } else if (aggregation === 'avg' && field) {
      query += `AVG(${field})`;
    } else {
      // Default to all fields if no aggregation
      query += '*';
    }

    query += ` FROM ${object}`;

    // Build WHERE clause
    const whereClauses = [];

    if (where) {
      whereClauses.push(where);
    }

    // Add time range filter
    if (timeField && timeRange) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - timeRange);
      whereClauses.push(`${timeField} >= ${daysAgo.toISOString().split('.')[0]}Z`);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Add GROUP BY
    if (groupBy) {
      query += ` GROUP BY ${groupBy}`;
    }

    // Add ORDER BY for grouped queries
    if (groupBy) {
      query += ' ORDER BY COUNT() DESC';
    }

    // Limit results
    query += ' LIMIT 1000';

    return query;
  }

  /**
   * Test connection to Salesforce using a simple SOQL query
   */
  async testConnection() {
    try {
      if (!this.connection) {
        return false;
      }

      // Try a simple query
      await this.connection.query('SELECT Id FROM Organization LIMIT 1');

      console.log('[salesforce] Connection test successful');
      return true;
    } catch (error) {
      console.error({ error: error.message }, 'Salesforce connection test failed');
      this.lastError = error;
      return false;
    }
  }

  /**
   * Get configuration schema
   */
  getConfigSchema() {
    return {
      name: 'Salesforce',
      description: 'CRM and sales analytics from Salesforce',
      fields: [
        {
          name: 'instanceUrl',
          type: 'string',
          required: false,
          description: 'Salesforce instance URL',
          example: 'https://yourinstance.my.salesforce.com',
          envVar: 'SALESFORCE_INSTANCE_URL'
        },
        {
          name: 'isSandbox',
          type: 'boolean',
          required: false,
          description: 'Use Salesforce sandbox environment',
          default: false,
          envVar: 'SALESFORCE_SANDBOX'
        },
        {
          name: 'accessToken',
          type: 'string',
          required: false,
          description: 'Salesforce access token (alternative to OAuth)',
          secure: true,
          envVar: 'SALESFORCE_ACCESS_TOKEN'
        },
        {
          name: 'clientId',
          type: 'string',
          required: false,
          description: 'OAuth Connected App client ID',
          secure: true,
          envVar: 'SALESFORCE_CLIENT_ID'
        },
        {
          name: 'clientSecret',
          type: 'string',
          required: false,
          description: 'OAuth Connected App client secret',
          secure: true,
          envVar: 'SALESFORCE_CLIENT_SECRET'
        },
        {
          name: 'username',
          type: 'string',
          required: false,
          description: 'Salesforce username',
          envVar: 'SALESFORCE_USERNAME'
        },
        {
          name: 'password',
          type: 'string',
          required: false,
          description: 'Salesforce password',
          secure: true,
          envVar: 'SALESFORCE_PASSWORD'
        },
        {
          name: 'securityToken',
          type: 'string',
          required: false,
          description: 'Salesforce security token (appended to password)',
          secure: true,
          envVar: 'SALESFORCE_SECURITY_TOKEN'
        },
        {
          name: 'soql',
          type: 'string',
          required: false,
          description: 'Custom SOQL query',
          example: 'SELECT COUNT() FROM Lead WHERE Status = \'Open\''
        },
        {
          name: 'object',
          type: 'select',
          required: false,
          description: 'Salesforce object to query',
          options: ['Lead', 'Opportunity', 'Case', 'Account', 'Contact'],
          default: 'Lead'
        }
      ]
    };
  }

  /**
   * Transform Salesforce query results to widget format
   */
  transformData(result, widgetType, aggregation = 'count') {
    if (!result || !result.records || result.records.length === 0) {
      return this.getEmptyData(widgetType);
    }

    const records = result.records;

    // Handle simple aggregations (COUNT, SUM, AVG)
    if (records.length === 1 && records[0].expr0 !== undefined) {
      const value = records[0].expr0;

      switch (widgetType) {
        case 'big-number':
        case 'stat-card':
          return {
            value: Math.round(value * 100) / 100,
            unit: this.getUnitForAggregation(aggregation)
          };

        case 'gauge':
        case 'gauge-row':
          return {
            value: Math.round(value * 100) / 100,
            min: 0,
            max: value * 1.5, // 50% headroom
            unit: this.getUnitForAggregation(aggregation)
          };

        default:
          return { value };
      }
    }

    // Handle grouped results (for charts)
    if (records.length > 0 && records[0].expr0 !== undefined) {
      const labels = [];
      const values = [];

      records.forEach(record => {
        // First field is the group by value
        const groupValue = Object.values(record)[0];
        const aggValue = record.expr0;

        if (groupValue !== null && groupValue !== undefined) {
          labels.push(String(groupValue));
          values.push(aggValue);
        }
      });

      switch (widgetType) {
        case 'bar-chart':
          return {
            values: labels.slice(0, 10).map((label, i) => ({
              label,
              value: Math.round(values[i] * 100) / 100
            }))
          };

        case 'line-chart':
        case 'sparkline':
          return {
            labels,
            values: values.map(v => Math.round(v * 100) / 100),
            series: 'Salesforce'
          };

        case 'big-number':
        case 'stat-card': {
          // Use first value for single-number widgets
          const latestValue = values[0];
          const previousValue = values.length > 1 ? values[1] : latestValue;
          const trend = latestValue > previousValue ? 'up' : latestValue < previousValue ? 'down' : 'stable';

          return {
            value: Math.round(latestValue * 100) / 100,
            previous: Math.round(previousValue * 100) / 100,
            trend
          };
        }

        case 'gauge':
        case 'gauge-row': {
          const value = values[0];
          return {
            value: Math.round(value * 100) / 100,
            min: 0,
            max: Math.max(...values) * 1.2,
            unit: this.getUnitForAggregation(aggregation)
          };
        }

        default:
          return { labels, values };
      }
    }

    // Handle table data (list of records)
    if (widgetType === 'table') {
      return {
        rows: records.map(record => {
          const row = {};
          Object.keys(record).forEach(key => {
            if (key !== 'attributes') {
              row[key] = record[key];
            }
          });
          return row;
        })
      };
    }

    // Return raw data for unsupported formats
    return { records };
  }

  /**
   * Get unit label for aggregation type
   */
  getUnitForAggregation(aggregation) {
    switch (aggregation) {
      case 'count':
        return 'records';
      case 'sum':
        return 'total';
      case 'avg':
        return 'avg';
      default:
        return '';
    }
  }

  /**
   * Get mock data for testing when Salesforce not available
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return {
          value: Math.round(Math.random() * 500) + 100,
          trend: Math.random() > 0.5 ? 'up' : 'down',
          unit: 'leads'
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
            { label: 'Open', value: 145 },
            { label: 'Qualified', value: 89 },
            { label: 'Contacted', value: 234 },
            { label: 'Closed', value: 67 }
          ]
        };

      case 'line-chart':
      case 'sparkline': {
        const now = Date.now();
        return {
          labels: Array.from({ length: 12 }, (_, i) =>
            new Date(now - (11 - i) * 86400000).toISOString().split('T')[0]
          ),
          values: Array.from({ length: 12 }, () =>
            Math.round(Math.random() * 50) + 20
          ),
          series: 'Mock Leads'
        };
      }

      case 'table':
        return {
          rows: [
            { Name: 'Acme Corp', Status: 'Open', Amount: 50000 },
            { Name: 'TechStart Inc', Status: 'Qualified', Amount: 75000 },
            { Name: 'Global Systems', Status: 'Negotiation', Amount: 120000 }
          ]
        };

      default:
        return this.getEmptyData(widgetType);
    }
  }

  /**
   * Get available Salesforce metrics
   */
  getAvailableMetrics() {
    return [
      {
        id: 'open_opportunities_value',
        name: 'Open Opportunities Value',
        description: 'Total value of open opportunities',
        object: 'Opportunity',
        aggregation: 'sum',
        field: 'Amount',
        where: 'IsClosed = false',
        type: 'currency',
        widgets: ['big-number', 'stat-card', 'gauge']
      },
      {
        id: 'leads_created_this_month',
        name: 'Leads Created This Month',
        description: 'Number of leads created in the last 30 days',
        object: 'Lead',
        aggregation: 'count',
        timeField: 'CreatedDate',
        timeRange: 30,
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart']
      },
      {
        id: 'cases_by_status',
        name: 'Cases by Status',
        description: 'Count of cases grouped by status',
        object: 'Case',
        aggregation: 'count',
        groupBy: 'Status',
        type: 'number',
        widgets: ['bar-chart', 'pie-chart']
      },
      {
        id: 'win_rate',
        name: 'Opportunity Win Rate',
        description: 'Percentage of closed won opportunities',
        object: 'Opportunity',
        aggregation: 'count',
        where: 'IsWon = true AND IsClosed = true',
        type: 'percentage',
        widgets: ['gauge', 'gauge-row', 'big-number']
      },
      {
        id: 'average_deal_size',
        name: 'Average Deal Size',
        description: 'Average value of closed won opportunities',
        object: 'Opportunity',
        aggregation: 'avg',
        field: 'Amount',
        where: 'IsWon = true AND IsClosed = true',
        type: 'currency',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'open_cases',
        name: 'Open Cases',
        description: 'Total number of open support cases',
        object: 'Case',
        aggregation: 'count',
        where: 'IsClosed = false',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'gauge']
      },
      {
        id: 'leads_by_source',
        name: 'Leads by Source',
        description: 'Lead distribution by source',
        object: 'Lead',
        aggregation: 'count',
        groupBy: 'LeadSource',
        type: 'number',
        widgets: ['bar-chart', 'pie-chart']
      },
      {
        id: 'opportunities_by_stage',
        name: 'Opportunities by Stage',
        description: 'Pipeline breakdown by stage',
        object: 'Opportunity',
        aggregation: 'count',
        groupBy: 'StageName',
        where: 'IsClosed = false',
        type: 'number',
        widgets: ['bar-chart', 'pie-chart', 'line-chart']
      },
      {
        id: 'account_count',
        name: 'Total Accounts',
        description: 'Total number of accounts',
        object: 'Account',
        aggregation: 'count',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'contact_count',
        name: 'Total Contacts',
        description: 'Total number of contacts',
        object: 'Contact',
        aggregation: 'count',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'case_age_avg',
        name: 'Average Case Age',
        description: 'Average age of open cases in days',
        object: 'Case',
        aggregation: 'avg',
        field: 'Age__c',
        where: 'IsClosed = false',
        type: 'number',
        widgets: ['gauge', 'big-number']
      },
      {
        id: 'custom_query',
        name: 'Custom SOQL Query',
        description: 'User-defined SOQL query',
        type: 'number',
        widgets: ['big-number', 'gauge', 'line-chart', 'bar-chart', 'table']
      }
    ];
  }

  /**
   * Validate widget configuration
   */
  validateWidgetConfig(widgetConfig) {
    const errors = super.validateWidgetConfig(widgetConfig);

    // Salesforce credentials are optional - will use mock data if not provided
    // This allows the dashboard to work without Salesforce access

    return errors;
  }
}

// Create singleton instance
export const salesforceDataSource = new SalesforceDataSource();
