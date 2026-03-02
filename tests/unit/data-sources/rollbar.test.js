// ===========================================================================
// Rollbar Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { RollbarDataSource } from '../../../server/data-sources/rollbar.js';

describe('Rollbar Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new RollbarDataSource({});
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('rollbar');
      expect(dataSource.accessToken).toBeUndefined();
      expect(dataSource.baseUrl).toBe('https://api.rollbar.com/api/1');
    });

    it('should accept configuration overrides', () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-token',
        projectId: 'test-project',
        baseUrl: 'https://custom.rollbar.com/api/1'
      });

      expect(ds.accessToken).toBe('test-token');
      expect(ds.projectId).toBe('test-project');
      expect(ds.baseUrl).toBe('https://custom.rollbar.com/api/1');
    });
  });

  describe('initialize()', () => {
    it('should handle missing credentials gracefully', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(false);
    });

    it('should set isConnected to true with valid credentials', async () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-access-token'
      });

      // Mock the testConnection method
      ds.testConnection = mock(async () => true);

      await ds.initialize();
      expect(ds.isConnected).toBe(true);
    });

    it('should handle initialization errors', async () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-access-token'
      });

      // Mock testConnection to throw error
      ds.testConnection = mock(async () => {
        throw new Error('Connection failed');
      });

      await ds.initialize();
      expect(ds.isConnected).toBe(false);
      expect(ds.lastError).toBeDefined();
    });
  });

  describe('makeRequest()', () => {
    it('should construct URL with query parameters correctly', async () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-token'
      });

      // Mock fetch to inspect the request
      global.fetch = mock(async (url) => {
        expect(url).toContain('/items/');
        expect(url).toContain('status=active');
        expect(url).toContain('level=error');

        return {
          ok: true,
          status: 200,
          json: async () => ({ err: 0, result: { items: [] } })
        };
      });

      await ds.makeRequest('/items/', { status: 'active', level: 'error' });
    });

    it('should handle rate limit errors', async () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-token'
      });

      global.fetch = mock(async () => ({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      }));

      await expect(ds.makeRequest('/items/')).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle API errors', async () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-token'
      });

      global.fetch = mock(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ err: 1, message: 'Invalid request' })
      }));

      await expect(ds.makeRequest('/items/')).rejects.toThrow('Invalid request');
    });
  });

  describe('fetchMetrics() - without credentials', () => {
    it('should return mock data when access token not configured', async () => {
      const result = await dataSource.fetchMetrics({
        id: 'test-widget',
        type: 'big-number'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('mock');
      expect(result.source).toBe('rollbar');
      expect(result.mock).toBe(true);
    });
  });

  describe('fetchMetrics() - with credentials', () => {
    it('should fetch items by default', async () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-token'
      });

      ds.fetchItems = mock(async () => ({
        items: [
          { id: 1, level: 'error', title: 'Test Error' }
        ],
        total: 1
      }));

      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'big-number',
        metricType: 'items'
      });

      expect(result.source).toBe('rollbar');
      expect(result.data).toBeDefined();
    });

    it('should fetch top active items', async () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-token'
      });

      ds.fetchTopActiveItems = mock(async () => ({
        items: [
          { item: { id: 1, level: 'critical' }, counts: [10, 20, 30] }
        ],
        total: 1
      }));

      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'alert-list',
        metricType: 'top_active'
      });

      expect(result.source).toBe('rollbar');
      expect(ds.fetchTopActiveItems).toHaveBeenCalled();
    });

    it('should fetch occurrence counts', async () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-token'
      });

      ds.fetchOccurrenceCounts = mock(async () => ({
        counts: [
          [1704067200, 10],
          [1704070800, 15],
          [1704074400, 8]
        ],
        total: 33
      }));

      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'line-chart',
        metricType: 'occurrence_counts'
      });

      expect(result.source).toBe('rollbar');
      expect(ds.fetchOccurrenceCounts).toHaveBeenCalled();
    });

    it('should use cache for repeated requests', async () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-token'
      });

      let callCount = 0;
      ds.fetchItems = mock(async () => {
        callCount++;
        return { items: [], total: 0 };
      });

      // First call
      await ds.fetchMetrics({
        id: 'widget-1',
        type: 'big-number',
        metricType: 'items'
      });

      // Second call with same parameters - should use cache
      const result = await ds.fetchMetrics({
        id: 'widget-2',
        type: 'big-number',
        metricType: 'items'
      });

      expect(callCount).toBe(1); // Only called once
      expect(result.cached).toBe(true);
    });
  });

  describe('fetchItems()', () => {
    it('should fetch items with filters', async () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-token'
      });

      global.fetch = mock(async (url) => {
        expect(url).toContain('status=active');
        expect(url).toContain('level=critical');
        expect(url).toContain('environment=production');

        return {
          ok: true,
          status: 200,
          json: async () => ({
            err: 0,
            result: {
              items: [{ id: 1, level: 'critical' }],
              total_count: 1
            }
          })
        };
      });

      const result = await ds.fetchItems('critical', 'production');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('testConnection()', () => {
    it('should return false when access token not configured', async () => {
      const result = await dataSource.testConnection();
      expect(result).toBe(false);
    });

    it('should test connection using ping endpoint', async () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-token'
      });

      global.fetch = mock(async (url) => {
        if (url.includes('/status/ping')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ err: 0, result: 'pong' })
          };
        }
        throw new Error('Unexpected URL');
      });

      const result = await ds.testConnection();
      expect(result).toBe(true);
    });

    it('should fallback to items endpoint if ping fails', async () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-token'
      });

      let pingCalled = false;
      global.fetch = mock(async (url) => {
        if (url.includes('/status/ping')) {
          pingCalled = true;
          throw new Error('Ping failed');
        }
        if (url.includes('/items/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ err: 0, result: { items: [] } })
          };
        }
        throw new Error('Unexpected URL');
      });

      const result = await ds.testConnection();
      expect(pingCalled).toBe(true);
      expect(result).toBe(true);
    });
  });

  describe('transformData()', () => {
    it('should handle null/empty response', () => {
      const result = dataSource.transformData(null, 'big-number');
      expect(result).toBeDefined();
    });

    it('should transform big-number data correctly', () => {
      const mockResponse = {
        items: [
          { level: 'critical', title: 'Error 1' },
          { level: 'error', title: 'Error 2' },
          { level: 'error', title: 'Error 3' }
        ],
        total: 3
      };

      const result = dataSource.transformData(mockResponse, 'big-number');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('critical');
      expect(result).toHaveProperty('errors');
      expect(result.value).toBe(3);
      expect(result.critical).toBe(1);
      expect(result.errors).toBe(2);
    });

    it('should transform gauge data correctly', () => {
      const mockResponse = {
        items: [
          { level: 'critical', title: 'Error 1' },
          { level: 'error', title: 'Error 2' },
          { level: 'warning', title: 'Error 3' }
        ],
        total: 3
      };

      const result = dataSource.transformData(mockResponse, 'gauge');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('min');
      expect(result).toHaveProperty('max');
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.max).toBe(100);
    });

    it('should transform bar-chart data correctly', () => {
      const mockResponse = {
        items: [
          { level: 'critical' },
          { level: 'critical' },
          { level: 'error' },
          { level: 'warning' },
          { level: 'info' }
        ],
        total: 5
      };

      const result = dataSource.transformData(mockResponse, 'bar-chart');

      expect(result).toHaveProperty('values');
      expect(Array.isArray(result.values)).toBe(true);
      expect(result.values.some(v => v.label === 'Critical' && v.value === 2)).toBe(true);
      expect(result.values.some(v => v.label === 'Error' && v.value === 1)).toBe(true);
    });

    it('should transform alert-list data correctly', () => {
      const mockResponse = {
        items: [
          {
            item: {
              id: 1,
              title: 'TypeError: undefined',
              level: 'critical',
              last_occurrence_timestamp: 1704067200,
              total_occurrences: 42
            }
          },
          {
            id: 2,
            title: 'Connection timeout',
            level: 'error',
            last_occurrence_timestamp: 1704070800,
            total_occurrences: 15
          }
        ],
        total: 2
      };

      const result = dataSource.transformData(mockResponse, 'alert-list');

      expect(result).toHaveProperty('alerts');
      expect(Array.isArray(result.alerts)).toBe(true);
      expect(result.alerts).toHaveLength(2);
      expect(result.alerts[0]).toHaveProperty('id');
      expect(result.alerts[0]).toHaveProperty('title');
      expect(result.alerts[0]).toHaveProperty('severity');
      expect(result.alerts[0]).toHaveProperty('occurrences');
    });

    it('should transform line-chart data correctly', () => {
      const mockResponse = {
        counts: [
          [1704067200, 10],
          [1704070800, 15],
          [1704074400, 8]
        ],
        total: 33
      };

      const result = dataSource.transformData(mockResponse, 'line-chart');

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('values');
      expect(result.labels).toHaveLength(3);
      expect(result.values).toEqual([10, 15, 8]);
    });
  });

  describe('getMockData()', () => {
    it('should return realistic mock data for big-number', () => {
      const data = dataSource.getMockData('big-number');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('critical');
      expect(data).toHaveProperty('errors');
      expect(typeof data.value).toBe('number');
    });

    it('should return mock data for all widget types', () => {
      const types = [
        'big-number',
        'stat-card',
        'gauge',
        'gauge-row',
        'bar-chart',
        'alert-list',
        'line-chart',
        'sparkline'
      ];

      types.forEach(type => {
        const data = dataSource.getMockData(type);
        expect(data).toBeDefined();
      });
    });

    it('should return alert-list with realistic error data', () => {
      const data = dataSource.getMockData('alert-list');

      expect(data).toHaveProperty('alerts');
      expect(Array.isArray(data.alerts)).toBe(true);
      expect(data.alerts.length).toBeGreaterThan(0);
      expect(data.alerts[0]).toHaveProperty('title');
      expect(data.alerts[0]).toHaveProperty('severity');
      expect(data.alerts[0]).toHaveProperty('occurrences');
    });

    it('should return line-chart with 24 hours of data', () => {
      const data = dataSource.getMockData('line-chart');

      expect(data).toHaveProperty('labels');
      expect(data).toHaveProperty('values');
      expect(data.labels).toHaveLength(24);
      expect(data.values).toHaveLength(24);
    });
  });

  describe('getAvailableMetrics()', () => {
    it('should return array of metrics', () => {
      const metrics = dataSource.getAvailableMetrics();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThanOrEqual(8);
    });

    it('should include required error tracking metrics', () => {
      const metrics = dataSource.getAvailableMetrics();

      const requiredMetrics = [
        'total_occurrences',
        'active_items',
        'errors_by_level',
        'critical_errors',
        'error_rate',
        'top_errors',
        'occurrence_trends',
        'mttr'
      ];

      requiredMetrics.forEach(metricId => {
        const metric = metrics.find(m => m.id === metricId);
        expect(metric).toBeDefined();
        expect(metric).toHaveProperty('name');
        expect(metric).toHaveProperty('description');
        expect(metric).toHaveProperty('type');
        expect(metric).toHaveProperty('widgets');
      });
    });

    it('should include metricType for each metric', () => {
      const metrics = dataSource.getAvailableMetrics();

      metrics.forEach(metric => {
        expect(metric).toHaveProperty('metricType');
        expect(['items', 'top_active', 'occurrence_counts']).toContain(metric.metricType);
      });
    });
  });

  describe('validateWidgetConfig()', () => {
    it('should not require access token (allows mock data fallback)', () => {
      const errors = dataSource.validateWidgetConfig({
        id: 'test-widget',
        type: 'big-number'
      });

      // Should not have access token error (data source will use mock data)
      expect(errors.some(e => e.includes('access token'))).toBe(false);
    });

    it('should validate metricType', () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-token'
      });

      const errors = ds.validateWidgetConfig({
        id: 'test-widget',
        type: 'big-number',
        metricType: 'invalid_type'
      });

      expect(errors.some(e => e.includes('Invalid metricType'))).toBe(true);
    });

    it('should validate level parameter', () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-token'
      });

      const errors = ds.validateWidgetConfig({
        id: 'test-widget',
        type: 'big-number',
        level: 'invalid_level'
      });

      expect(errors.some(e => e.includes('Invalid level'))).toBe(true);
    });

    it('should accept valid configuration', () => {
      const ds = new RollbarDataSource({
        accessToken: 'test-token'
      });

      const errors = ds.validateWidgetConfig({
        id: 'test-widget',
        type: 'big-number',
        metricType: 'items',
        level: 'critical'
      });

      expect(errors).toHaveLength(0);
    });
  });

  describe('getConfigSchema()', () => {
    it('should return configuration schema', () => {
      const schema = dataSource.getConfigSchema();

      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('description');
      expect(schema).toHaveProperty('fields');
      expect(Array.isArray(schema.fields)).toBe(true);
    });

    it('should include required fields', () => {
      const schema = dataSource.getConfigSchema();
      const fieldNames = schema.fields.map(f => f.name);

      expect(fieldNames).toContain('accessToken');
      expect(fieldNames).toContain('projectId');
      expect(fieldNames).toContain('level');
    });

    it('should mark accessToken as secure', () => {
      const schema = dataSource.getConfigSchema();
      const accessTokenField = schema.fields.find(f => f.name === 'accessToken');

      expect(accessTokenField.secure).toBe(true);
      expect(accessTokenField.required).toBe(true);
    });
  });
});
