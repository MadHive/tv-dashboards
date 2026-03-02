# HotJar Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement complete HotJar API integration for user behavior analytics and feedback data

**Architecture:** HotJar client using official API, 5-minute metric caching, graceful fallback to mock data when credentials unavailable, transformation layer for all widget types

**Tech Stack:** node-fetch or axios, Elysia.js, Bun test

---

## Task 1: Install HotJar HTTP client

**Files:**
- Modify: `package.json` (dependencies section)

**Step 1: Install HTTP client**

Run: `bun add axios`
Expected: Package installed successfully

**Step 2: Verify installation**

Run: `bun pm ls | grep axios`
Expected: Shows axios@<version>

**Step 3: Commit dependency**

```bash
git add package.json bun.lock
git commit -m "chore: add axios for HotJar API client"
```

---

## Task 2: Create HotJar test suite skeleton

**Files:**
- Create: `tests/unit/data-sources/hotjar.test.js`

**Step 1: Write initial test structure**

```javascript
// ===========================================================================
// HotJar Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { HotJarDataSource } from '../../../server/data-sources/hotjar.js';

describe('HotJar Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new HotJarDataSource({});
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('hotjar');
      expect(dataSource.apiKey).toBeUndefined();
      expect(dataSource.siteId).toBeUndefined();
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

Run: `bun test tests/unit/data-sources/hotjar.test.js`
Expected: 2 tests passing

**Step 3: Commit test skeleton**

```bash
git add tests/unit/data-sources/hotjar.test.js
git commit -m "test: add HotJar data source test skeleton"
```

---

## Task 3: Implement HotJar client initialization

**Files:**
- Modify: `server/data-sources/hotjar.js`

**Step 1: Write test for initialization with credentials**

Add to `tests/unit/data-sources/hotjar.test.js` after constructor tests:

```javascript
  describe('initialize()', () => {
    it('should handle missing credentials gracefully', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(false);
    });

    it('should initialize with API key and site ID if provided', async () => {
      const ds = new HotJarDataSource({
        apiKey: 'test-api-key',
        siteId: '123456'
      });

      await ds.initialize();
      expect(ds.apiKey).toBe('test-api-key');
      expect(ds.siteId).toBe('123456');
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/data-sources/hotjar.test.js`
Expected: New tests FAIL (initialize method doesn't exist)

**Step 3: Implement initialization**

Replace `server/data-sources/hotjar.js` content:

```javascript
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

export const hotjarDataSource = new HotJarDataSource();
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/data-sources/hotjar.test.js`
Expected: All tests PASS

**Step 5: Commit initialization**

```bash
git add server/data-sources/hotjar.js tests/unit/data-sources/hotjar.test.js
git commit -m "feat(hotjar): implement client initialization"
```

---

## Task 4: Implement metric fetching

**Files:**
- Modify: `server/data-sources/hotjar.js` (fetchMetrics method)

**Step 1: Write test for metric fetching**

Add to test file:

```javascript
  describe('fetchMetrics() - without credentials', () => {
    it('should return mock data when client not initialized', async () => {
      const result = await dataSource.fetchMetrics({
        id: 'test-widget',
        type: 'big-number'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('data');
      expect(result.source).toBe('hotjar');
    });
  });
```

**Step 2: Run test to verify current behavior**

Run: `bun test tests/unit/data-sources/hotjar.test.js`
Expected: Test PASSES (already returning mock data)

**Step 3: Implement real metric fetching**

Replace `fetchMetrics` in `server/data-sources/hotjar.js`:

```javascript
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
```

**Step 4: Run tests**

Run: `bun test tests/unit/data-sources/hotjar.test.js`
Expected: All tests PASS

**Step 5: Commit metric fetching**

```bash
git add server/data-sources/hotjar.js
git commit -m "feat(hotjar): implement metric fetching with caching"
```

---

## Task 5: Implement data transformation

**Files:**
- Modify: `server/data-sources/hotjar.js` (transformData method)

**Step 1: Write transformation tests**

Add comprehensive transformation tests:

```javascript
  describe('transformData()', () => {
    it('should handle empty results', () => {
      const result = dataSource.transformData(null, 'big-number');
      expect(result).toBeDefined();
    });

    it('should transform pageview data for big-number', () => {
      const mockResponse = {
        pageviews: 125430,
        previous_pageviews: 112000
      };

      const result = dataSource.transformData(mockResponse, 'big-number');

      expect(result).toHaveProperty('value');
      expect(result.value).toBe(125430);
      expect(result).toHaveProperty('trend');
    });

    it('should transform time series data for line-chart', () => {
      const mockResponse = {
        data: [
          { date: '2024-01-01', value: 100 },
          { date: '2024-01-02', value: 150 },
          { date: '2024-01-03', value: 120 }
        ]
      };

      const result = dataSource.transformData(mockResponse, 'line-chart');

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('values');
      expect(result.labels.length).toBe(3);
      expect(result.values).toEqual([100, 150, 120]);
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/data-sources/hotjar.test.js`
Expected: Transformation tests FAIL

**Step 3: Implement transformation logic**

Replace `transformData` method:

```javascript
  /**
   * Transform HotJar API response to widget format
   */
  transformData(response, widgetType) {
    if (!response) {
      return this.getEmptyData(widgetType);
    }

    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        const value = response.pageviews || response.total || response.count || 0;
        const previous = response.previous_pageviews || response.previous_total || value;
        const trend = value > previous ? 'up' : value < previous ? 'down' : 'stable';

        return {
          value: Math.round(value),
          previous: Math.round(previous),
          trend,
          unit: ''
        };
      }

      case 'gauge':
      case 'gauge-row': {
        const value = response.percentage || response.rate || 0;
        return {
          value: Math.round(value * 100) / 100,
          min: 0,
          max: 100,
          unit: '%'
        };
      }

      case 'line-chart':
      case 'sparkline': {
        const data = response.data || [];
        return {
          labels: data.map(d => d.date || d.timestamp),
          values: data.map(d => d.value || d.count || 0),
          series: 'HotJar'
        };
      }

      case 'bar-chart': {
        const data = response.data || [];
        const lastN = Math.min(10, data.length);
        const recentData = data.slice(-lastN);

        return {
          values: recentData.map(d => ({
            label: d.label || d.date || d.name,
            value: d.value || d.count || 0
          }))
        };
      }

      default:
        return response;
    }
  }
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/data-sources/hotjar.test.js`
Expected: All transformation tests PASS

**Step 5: Commit transformation**

```bash
git add server/data-sources/hotjar.js tests/unit/data-sources/hotjar.test.js
git commit -m "feat(hotjar): implement data transformation for all widget types"
```

---

## Task 6: Implement connection testing

**Files:**
- Modify: `server/data-sources/hotjar.js` (testConnection method)

**Step 1: Write connection test**

Add to test file:

```javascript
  describe('testConnection()', () => {
    it('should return false when client not initialized', async () => {
      const result = await dataSource.testConnection();
      expect(result).toBe(false);
    });

    it('should return boolean with initialized client', async () => {
      const ds = new HotJarDataSource({
        apiKey: 'test-key',
        siteId: '123456'
      });

      await ds.initialize();

      const result = await ds.testConnection();
      expect(typeof result).toBe('boolean');
    });
  });
```

**Step 2: Run test**

Run: `bun test tests/unit/data-sources/hotjar.test.js`
Expected: Tests PASS

**Step 3: Implement connection testing**

Replace `testConnection` method:

```javascript
  /**
   * Test connection to HotJar API
   */
  async testConnection() {
    try {
      if (!this.apiKey || !this.siteId) {
        return false;
      }

      // Try to fetch site info
      const url = `${HOTJAR_API_BASE}/sites/${this.siteId}`;
      await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('[hotjar] Connection test successful');
      return true;
    } catch (error) {
      console.error('[hotjar] Connection test failed:', error.message);
      this.lastError = error;
      return false;
    }
  }
```

**Step 4: Run tests**

Run: `bun test tests/unit/data-sources/hotjar.test.js`
Expected: All tests PASS

**Step 5: Commit connection testing**

```bash
git add server/data-sources/hotjar.js tests/unit/data-sources/hotjar.test.js
git commit -m "feat(hotjar): implement connection testing"
```

---

## Task 7: Enhance mock data and metrics catalog

**Files:**
- Modify: `server/data-sources/hotjar.js` (getMockData and getAvailableMetrics)

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

    it('should include user behavior metrics', () => {
      const metrics = dataSource.getAvailableMetrics();
      const pageviewMetric = metrics.find(m => m.id === 'pageviews');

      expect(pageviewMetric).toBeDefined();
      expect(pageviewMetric).toHaveProperty('widgets');
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/data-sources/hotjar.test.js`
Expected: Some tests FAIL

**Step 3: Implement enhanced mock data and metrics**

Replace `getMockData` and `getAvailableMetrics`:

```javascript
  /**
   * Get mock data for testing when HotJar not available
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return {
          value: Math.round(Math.random() * 50000),
          unit: 'views'
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
            { label: 'Desktop', value: 12450 },
            { label: 'Mobile', value: 8920 },
            { label: 'Tablet', value: 2340 }
          ]
        };

      case 'line-chart':
      case 'sparkline': {
        const now = Date.now();
        return {
          labels: Array.from({ length: 7 }, (_, i) =>
            new Date(now - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          ),
          values: Array.from({ length: 7 }, () =>
            Math.round(Math.random() * 5000)
          ),
          series: 'Mock Page Views'
        };
      }

      default:
        return this.getEmptyData(widgetType);
    }
  }

  /**
   * Get available HotJar metrics
   */
  getAvailableMetrics() {
    return [
      {
        id: 'pageviews',
        name: 'Page Views',
        description: 'Total page views',
        metric: 'pageviews',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart']
      },
      {
        id: 'recordings',
        name: 'Session Recordings',
        description: 'Number of session recordings',
        metric: 'recordings',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'heatmap_clicks',
        name: 'Heatmap Clicks',
        description: 'Click tracking data',
        metric: 'heatmaps',
        type: 'number',
        widgets: ['big-number', 'bar-chart']
      },
      {
        id: 'feedback_responses',
        name: 'Feedback Responses',
        description: 'Survey and poll responses',
        metric: 'feedback',
        type: 'number',
        widgets: ['big-number', 'line-chart']
      },
      {
        id: 'conversion_rate',
        name: 'Conversion Rate',
        description: 'Goal conversion percentage',
        metric: 'conversions',
        type: 'percentage',
        widgets: ['gauge', 'gauge-row', 'big-number']
      },
      {
        id: 'bounce_rate',
        name: 'Bounce Rate',
        description: 'Percentage of single-page sessions',
        metric: 'bounces',
        type: 'percentage',
        widgets: ['gauge', 'line-chart']
      },
      {
        id: 'avg_session_duration',
        name: 'Average Session Duration',
        description: 'Mean session time in seconds',
        metric: 'sessions',
        type: 'duration',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'custom_metric',
        name: 'Custom Metric',
        description: 'User-defined custom metric',
        metric: '',
        type: 'number',
        widgets: ['big-number', 'gauge', 'line-chart', 'bar-chart']
      }
    ];
  }
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/data-sources/hotjar.test.js`
Expected: All tests PASS

**Step 5: Run full test suite**

Run: `bun test`
Expected: All tests PASS

**Step 6: Commit enhancements**

```bash
git add server/data-sources/hotjar.js tests/unit/data-sources/hotjar.test.js
git commit -m "feat(hotjar): enhance mock data and metrics catalog

- Add realistic mock data for all widget types
- Add 8 pre-configured HotJar metrics (pageviews, recordings, feedback)
- Include custom metric option for user-defined queries
"
```

---

## Task 8: Final integration verification

**Step 1: Verify all tests pass**

Run: `bun test`
Expected: All tests PASS

**Step 2: Check test count**

Run: `bun test | grep "pass"`
Expected: Shows increased test count from HotJar tests

**Step 3: Verify working tree is clean**

Run: `git status`
Expected: Clean working tree (all changes committed)

---

## Summary

**Total Tasks:** 8
**Estimated Time:** 90-120 minutes
**Test Coverage:** ~15-20 new tests
**Files Modified:** 2 (hotjar.js, hotjar.test.js)
**Dependencies Added:** 1 (axios)

**Key Milestones:**
1. ✅ HTTP client installed
2. ✅ Test skeleton created
3. ✅ Client initialization implemented
4. ✅ Metric fetching implemented
5. ✅ Data transformation implemented
6. ✅ Connection testing implemented
7. ✅ Mock data and metrics catalog enhanced
8. ✅ Final integration verified

**Success Criteria:**
- All existing tests continue to pass
- New HotJar tests all pass
- Can initialize with API key and site ID
- Mock data works when credentials unavailable
- Real API integration works with valid credentials
- Data transformation correct for all widget types
