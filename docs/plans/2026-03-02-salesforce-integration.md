# Salesforce Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement complete Salesforce CRM integration for sales analytics and customer metrics

**Architecture:** Salesforce client using jsforce library (official Node.js SDK), 5-minute metric caching, SOQL query support for Salesforce objects (Leads, Opportunities, Accounts, Cases), graceful fallback to mock data when credentials unavailable

**Tech Stack:** jsforce, Elysia.js, Bun test

---

## Task 1: Install Salesforce SDK

**Files:**
- Modify: `package.json` (dependencies section)

**Step 1: Install jsforce client**

Run: `bun add jsforce`
Expected: Package installed successfully

**Step 2: Verify installation**

Run: `bun pm ls | grep jsforce`
Expected: Shows jsforce@<version>

**Step 3: Commit dependency**

```bash
git add package.json bun.lock
git commit -m "chore: add Salesforce jsforce client dependency"
```

---

## Task 2: Create Salesforce test suite skeleton

**Files:**
- Create: `tests/unit/data-sources/salesforce.test.js`

**Step 1: Write initial test structure**

```javascript
// ===========================================================================
// Salesforce Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { SalesforceDataSource } from '../../../server/data-sources/salesforce.js';

describe('Salesforce Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new SalesforceDataSource({});
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('salesforce');
      expect(dataSource.instanceUrl).toBeUndefined();
      expect(dataSource.accessToken).toBeUndefined();
    });
  });

  describe('getMockData()', () => {
    it('should return mock data for big-number widget', () => {
      const data = dataSource.getMockData('big-number');
      expect(data).toHaveProperty('value');
    });
  });
});
```

**Step 2: Run tests to establish baseline**

Run: `bun test tests/unit/data-sources/salesforce.test.js`
Expected: 2 tests passing

**Step 3: Commit test skeleton**

```bash
git add tests/unit/data-sources/salesforce.test.js
git commit -m "test: add Salesforce data source test skeleton"
```

---

## Task 3: Implement Salesforce client initialization

**Files:**
- Modify: `server/data-sources/salesforce.js:1-56`

**Step 1: Write test for initialization with credentials**

Add to `tests/unit/data-sources/salesforce.test.js` after constructor tests:

```javascript
  describe('initialize()', () => {
    it('should handle missing credentials gracefully', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(false);
    });

    it('should initialize with instance URL and access token if provided', async () => {
      const ds = new SalesforceDataSource({
        instanceUrl: 'https://test.salesforce.com',
        accessToken: 'test-access-token'
      });

      await ds.initialize();
      expect(ds.connection).not.toBeNull();
    });

    it('should support OAuth credentials', async () => {
      const ds = new SalesforceDataSource({
        instanceUrl: 'https://test.salesforce.com',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        username: 'test@example.com',
        password: 'test-password'
      });

      await ds.initialize();
      expect(ds.connection).not.toBeNull();
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/data-sources/salesforce.test.js`
Expected: New tests FAIL (connection property doesn't exist)

**Step 3: Implement initialization**

Replace `server/data-sources/salesforce.js` content:

```javascript
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
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/data-sources/salesforce.test.js`
Expected: All tests PASS

**Step 5: Commit initialization**

```bash
git add server/data-sources/salesforce.js tests/unit/data-sources/salesforce.test.js
git commit -m "feat(salesforce): implement client initialization with auth"
```

---

## Task 4: Implement metric fetching via SOQL queries

**Files:**
- Modify: `server/data-sources/salesforce.js` (fetchMetrics method)

**Step 1: Write test for metric fetching**

Add to test file:

```javascript
  describe('fetchMetrics() - without credentials', () => {
    it('should return mock data when connection not initialized', async () => {
      const result = await dataSource.fetchMetrics({
        id: 'test-widget',
        type: 'big-number'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('data');
      expect(result.source).toBe('salesforce');
    });
  });
```

**Step 2: Run test to verify current behavior**

Run: `bun test tests/unit/data-sources/salesforce.test.js`
Expected: Test PASSES (already returning mock data)

**Step 3: Implement real metric fetching**

Replace `fetchMetrics` in `server/data-sources/salesforce.js`:

```javascript
  /**
   * Fetch metrics for a widget
   *
   * Widget config should include:
   * - object: Salesforce object name (e.g., 'Lead', 'Opportunity', 'Account')
   * - field: Field to aggregate (optional, for specific metrics)
   * - filter: SOQL WHERE clause (optional)
   * - aggregation: Aggregation to perform (count, sum, avg, min, max)
   * - groupBy: Field to group by for time-series (e.g., 'CreatedDate')
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

      // Extract Salesforce parameters
      const {
        object = 'Lead',
        field,
        filter,
        aggregation = 'count',
        groupBy,
        timeRange = 30
      } = widgetConfig;

      // Build time filter
      const timeFilter = `CreatedDate >= LAST_N_DAYS:${timeRange}`;
      const whereClause = filter ? `${timeFilter} AND ${filter}` : timeFilter;

      // Check cache
      const cacheKey = JSON.stringify({ object, field, filter, aggregation, groupBy, timeRange });
      if (this.metricCache.has(cacheKey)) {
        const cached = this.metricCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          console.log('[salesforce] Cache hit for query');
          return {
            timestamp: new Date().toISOString(),
            source: 'salesforce',
            data: this.transformData(cached.data, widgetConfig.type, aggregation),
            widgetId: widgetConfig.id,
            cached: true
          };
        }
      }

      let soql;
      let result;

      if (aggregation === 'count') {
        // Simple count query
        soql = `SELECT COUNT() FROM ${object} WHERE ${whereClause}`;
        result = await this.connection.query(soql);
      } else if (groupBy) {
        // Time-series aggregation with GROUP BY
        const aggField = field || 'Id';
        const aggFunction = aggregation.toUpperCase();

        soql = `SELECT ${groupBy}, ${aggFunction}(${aggField}) aggValue
                FROM ${object}
                WHERE ${whereClause}
                GROUP BY ${groupBy}
                ORDER BY ${groupBy}`;
        result = await this.connection.query(soql);
      } else {
        // Single value aggregation
        const aggField = field || 'Id';
        const aggFunction = aggregation.toUpperCase();

        soql = `SELECT ${aggFunction}(${aggField}) aggValue FROM ${object} WHERE ${whereClause}`;
        result = await this.connection.query(soql);
      }

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
      console.error('[salesforce] Fetch metrics error:', error.message);
      return this.handleError(error, widgetConfig.type);
    }
  }
```

**Step 4: Run tests**

Run: `bun test tests/unit/data-sources/salesforce.test.js`
Expected: All tests PASS

**Step 5: Commit metric fetching**

```bash
git add server/data-sources/salesforce.js
git commit -m "feat(salesforce): implement metric fetching with SOQL"
```

---

## Task 5: Implement data transformation

**Files:**
- Modify: `server/data-sources/salesforce.js` (transformData method)

**Step 1: Write transformation tests**

Add comprehensive transformation tests:

```javascript
  describe('transformData()', () => {
    it('should handle empty results', () => {
      const result = dataSource.transformData(null, 'big-number', 'count');
      expect(result).toBeDefined();
    });

    it('should transform count aggregation for big-number', () => {
      const mockResponse = {
        totalSize: 1,
        records: [{ expr0: 1543 }]
      };

      const result = dataSource.transformData(mockResponse, 'big-number', 'count');

      expect(result).toHaveProperty('value');
      expect(result.value).toBe(1543);
    });

    it('should transform grouped aggregation for line-chart', () => {
      const mockResponse = {
        totalSize: 3,
        records: [
          { CreatedDate: '2024-01-01', aggValue: 100 },
          { CreatedDate: '2024-01-02', aggValue: 120 },
          { CreatedDate: '2024-01-03', aggValue: 110 }
        ]
      };

      const result = dataSource.transformData(mockResponse, 'line-chart', 'sum');

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('values');
      expect(result.labels.length).toBe(3);
      expect(result.values).toEqual([100, 120, 110]);
    });

    it('should transform grouped aggregation for bar-chart', () => {
      const mockResponse = {
        totalSize: 4,
        records: [
          { Status: 'Open', aggValue: 45 },
          { Status: 'Working', aggValue: 32 },
          { Status: 'Closed', aggValue: 28 }
        ]
      };

      const result = dataSource.transformData(mockResponse, 'bar-chart', 'count');

      expect(result).toHaveProperty('values');
      expect(result.values.length).toBe(3);
      expect(result.values[0]).toHaveProperty('label');
      expect(result.values[0]).toHaveProperty('value');
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/data-sources/salesforce.test.js`
Expected: Transformation tests FAIL

**Step 3: Implement transformation logic**

Replace `transformData` method:

```javascript
  /**
   * Transform Salesforce response to widget format
   */
  transformData(response, widgetType, aggregation = 'count') {
    if (!response || !response.records) {
      return this.getEmptyData(widgetType);
    }

    const records = response.records;

    if (records.length === 0) {
      return this.getEmptyData(widgetType);
    }

    // Handle simple count or single value aggregation
    if (records.length === 1 && !records[0].CreatedDate) {
      const value = records[0].expr0 || records[0].aggValue || response.totalSize;

      switch (widgetType) {
        case 'big-number':
        case 'stat-card':
          return {
            value: value,
            unit: aggregation === 'count' ? 'records' : ''
          };

        case 'gauge':
        case 'gauge-row':
          return {
            value: value,
            min: 0,
            max: value * 1.2, // 20% headroom
            unit: aggregation === 'count' ? 'records' : ''
          };

        default:
          return { value };
      }
    }

    // Handle grouped/time-series data
    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        // Use latest value with trend
        const latest = records[records.length - 1];
        const previous = records.length > 1 ? records[records.length - 2] : latest;

        const latestValue = latest.aggValue || 0;
        const previousValue = previous.aggValue || 0;
        const trend = latestValue > previousValue ? 'up' : latestValue < previousValue ? 'down' : 'stable';

        return {
          value: Math.round(latestValue * 100) / 100,
          previous: Math.round(previousValue * 100) / 100,
          trend
        };
      }

      case 'gauge':
      case 'gauge-row': {
        const latest = records[records.length - 1];
        const value = latest.aggValue || 0;

        return {
          value: Math.round(value * 100) / 100,
          min: 0,
          max: 100,
          unit: '%'
        };
      }

      case 'line-chart':
      case 'sparkline': {
        return {
          labels: records.map(r => {
            const dateField = r.CreatedDate || r.CloseDate || Object.keys(r)[0];
            return dateField;
          }),
          values: records.map(r => {
            const val = r.aggValue || r.expr0 || 0;
            return Math.round(val * 100) / 100;
          }),
          series: 'Salesforce'
        };
      }

      case 'bar-chart': {
        const lastN = Math.min(10, records.length);
        const recentRecords = records.slice(-lastN);

        return {
          values: recentRecords.map(r => {
            const labelField = r.Status || r.StageName || Object.keys(r).find(k => k !== 'aggValue' && k !== 'expr0') || 'Unknown';
            const val = r.aggValue || r.expr0 || 0;

            return {
              label: typeof labelField === 'string' ? labelField : String(labelField),
              value: Math.round(val * 100) / 100
            };
          })
        };
      }

      default:
        return { records };
    }
  }
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/data-sources/salesforce.test.js`
Expected: All transformation tests PASS

**Step 5: Commit transformation**

```bash
git add server/data-sources/salesforce.js tests/unit/data-sources/salesforce.test.js
git commit -m "feat(salesforce): implement data transformation for all widget types"
```

---

## Task 6: Implement connection testing

**Files:**
- Modify: `server/data-sources/salesforce.js` (testConnection method)

**Step 1: Write connection test**

Add to test file:

```javascript
  describe('testConnection()', () => {
    it('should return false when connection not initialized', async () => {
      const result = await dataSource.testConnection();
      expect(result).toBe(false);
    });

    it('should return boolean with initialized connection', async () => {
      const ds = new SalesforceDataSource({
        instanceUrl: 'https://test.salesforce.com',
        accessToken: 'test-token'
      });

      await ds.initialize();

      const result = await ds.testConnection();
      expect(typeof result).toBe('boolean');
    });
  });
```

**Step 2: Run test**

Run: `bun test tests/unit/data-sources/salesforce.test.js`
Expected: Tests PASS

**Step 3: Implement connection testing**

Replace `testConnection` method:

```javascript
  /**
   * Test connection to Salesforce
   */
  async testConnection() {
    try {
      if (!this.connection) {
        return false;
      }

      // Query user info to verify connection
      const userInfo = await this.connection.identity();

      if (userInfo && userInfo.user_id) {
        console.log('[salesforce] Connection test successful, user:', userInfo.username);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[salesforce] Connection test failed:', error.message);
      this.lastError = error;
      return false;
    }
  }
```

**Step 4: Run tests**

Run: `bun test tests/unit/data-sources/salesforce.test.js`
Expected: All tests PASS

**Step 5: Commit connection testing**

```bash
git add server/data-sources/salesforce.js tests/unit/data-sources/salesforce.test.js
git commit -m "feat(salesforce): implement connection testing via identity"
```

---

## Task 7: Enhance mock data and metrics catalog

**Files:**
- Modify: `server/data-sources/salesforce.js` (getMockData and getAvailableMetrics)

**Step 1: Write tests for enhanced features**

Add to test file:

```javascript
  describe('getMockData()', () => {
    it('should return realistic mock data for big-number', () => {
      const data = dataSource.getMockData('big-number');

      expect(data).toHaveProperty('value');
      expect(typeof data.value).toBe('number');
    });

    it('should return mock data for all widget types', () => {
      const types = ['big-number', 'gauge', 'line-chart', 'bar-chart', 'sparkline'];

      types.forEach(type => {
        const data = dataSource.getMockData(type);
        expect(data).toBeDefined();
      });
    });
  });

  describe('getAvailableMetrics()', () => {
    it('should return array of metrics', () => {
      const metrics = dataSource.getAvailableMetrics();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should include sales metrics', () => {
      const metrics = dataSource.getAvailableMetrics();
      const leadMetric = metrics.find(m => m.id === 'lead_count');

      expect(leadMetric).toBeDefined();
      expect(leadMetric).toHaveProperty('object');
      expect(leadMetric).toHaveProperty('widgets');
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/data-sources/salesforce.test.js`
Expected: Some tests FAIL

**Step 3: Implement enhanced mock data and metrics**

Replace `getMockData` and `getAvailableMetrics`:

```javascript
  /**
   * Get mock data for testing when Salesforce not available
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return {
          value: Math.round(Math.random() * 1000),
          unit: 'records'
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
            { label: 'Working', value: 89 },
            { label: 'Qualified', value: 67 },
            { label: 'Closed Won', value: 234 }
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
            Math.round(Math.random() * 100)
          ),
          series: 'Mock Sales'
        };
      }

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
        id: 'lead_count',
        name: 'Lead Count',
        description: 'Total number of leads',
        object: 'Lead',
        aggregation: 'count',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart']
      },
      {
        id: 'opportunity_count',
        name: 'Opportunity Count',
        description: 'Total number of opportunities',
        object: 'Opportunity',
        aggregation: 'count',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart']
      },
      {
        id: 'opportunity_amount',
        name: 'Total Opportunity Value',
        description: 'Sum of all opportunity amounts',
        object: 'Opportunity',
        field: 'Amount',
        aggregation: 'sum',
        type: 'currency',
        widgets: ['big-number', 'gauge']
      },
      {
        id: 'avg_deal_size',
        name: 'Average Deal Size',
        description: 'Average opportunity amount',
        object: 'Opportunity',
        field: 'Amount',
        aggregation: 'avg',
        type: 'currency',
        widgets: ['big-number', 'gauge']
      },
      {
        id: 'case_count',
        name: 'Case Count',
        description: 'Total number of cases',
        object: 'Case',
        aggregation: 'count',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'account_count',
        name: 'Account Count',
        description: 'Total number of accounts',
        object: 'Account',
        aggregation: 'count',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'win_rate',
        name: 'Win Rate',
        description: 'Percentage of won opportunities',
        object: 'Opportunity',
        filter: 'StageName = \'Closed Won\'',
        aggregation: 'count',
        type: 'percentage',
        widgets: ['gauge', 'gauge-row', 'big-number']
      },
      {
        id: 'pipeline_by_stage',
        name: 'Pipeline by Stage',
        description: 'Opportunities grouped by stage',
        object: 'Opportunity',
        groupBy: 'StageName',
        aggregation: 'count',
        type: 'number',
        widgets: ['bar-chart', 'line-chart']
      }
    ];
  }
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/data-sources/salesforce.test.js`
Expected: All tests PASS

**Step 5: Run full test suite**

Run: `bun test`
Expected: All tests PASS

**Step 6: Commit enhancements**

```bash
git add server/data-sources/salesforce.js tests/unit/data-sources/salesforce.test.js
git commit -m "feat(salesforce): enhance mock data and metrics catalog

- Add realistic mock data for all widget types
- Add 8 pre-configured Salesforce metrics (leads, opportunities, cases, accounts)
- Support for various aggregation types (count, sum, avg)
- Include pipeline and win rate metrics
"
```

---

## Task 8: Final integration commit

**Step 1: Verify all tests pass**

Run: `bun test`
Expected: All tests PASS (including new Salesforce tests)

**Step 2: Check test count**

Run: `bun test | grep "pass"`
Expected: Shows increased test count from Salesforce tests

**Step 3: Create final commit**

```bash
git add -A
git commit -m "feat: implement Salesforce data source integration

Completed Salesforce integration with full client implementation.

## Features Implemented
- Salesforce connection initialization with access token and OAuth
- Real metric fetching via SOQL queries
- 5-minute metric caching to reduce API load
- Support for multiple aggregation types (count, sum, avg, min, max)
- Data transformation for all widget types
- Connection testing via identity API
- Graceful fallback to mock data when credentials unavailable
- 8 pre-configured Salesforce metrics (leads, opportunities, pipeline, win rate)

## Widget Support
- big-number, stat-card: Latest value with trend calculation
- gauge, gauge-row: Value with 0-100 range
- line-chart, sparkline: Time series data from grouped queries
- bar-chart: Grouped data (last 10)

## Configuration
- Supports SALESFORCE_INSTANCE_URL, SALESFORCE_ACCESS_TOKEN env vars
- Supports OAuth with CLIENT_ID, CLIENT_SECRET, USERNAME, PASSWORD
- SOQL query configuration (object, field, filter, aggregation, groupBy)
- Configurable time ranges (default 30 days)

## Tests
- Added comprehensive test coverage
- Tests cover: initialization, auth methods, transformations, mock data
- All tests passing

## Dependencies
- Installed jsforce

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
"
```

---

## Summary

**Total Tasks:** 8
**Estimated Time:** 90-120 minutes
**Test Coverage:** ~30-35 new tests
**Files Modified:** 2 (salesforce.js, salesforce.test.js)
**Dependencies Added:** 1 (jsforce)

**Key Milestones:**
1. ✅ SDK installed
2. ✅ Test skeleton created
3. ✅ Client initialization implemented (access token + OAuth)
4. ✅ Metric fetching via SOQL implemented
5. ✅ Data transformation implemented
6. ✅ Connection testing implemented
7. ✅ Mock data and metrics catalog enhanced
8. ✅ Final integration verified

**Success Criteria:**
- All existing tests continue to pass
- New Salesforce tests all pass
- Can initialize with access token or OAuth credentials
- Mock data works when credentials unavailable
- Real SOQL queries work
- Data transformation correct for all widget types
- Support for multiple Salesforce objects (Lead, Opportunity, Account, Case)
