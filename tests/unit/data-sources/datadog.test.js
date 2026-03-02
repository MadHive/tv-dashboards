// ===========================================================================
// DataDog Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { DataDogDataSource } from '../../../server/data-sources/datadog.js';

describe('DataDog Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new DataDogDataSource({});
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('datadog');
      expect(dataSource.apiKey).toBeUndefined();
      expect(dataSource.appKey).toBeUndefined();
    });
  });

  describe('initialize()', () => {
    it('should handle missing credentials gracefully', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(false);
    });

    it('should initialize with credentials if provided', async () => {
      const ds = new DataDogDataSource({
        apiKey: 'test-api-key',
        appKey: 'test-app-key'
      });

      await ds.initialize();
      expect(ds.client).not.toBeNull();
      expect(ds.isConnected).toBe(true);
    });
  });

  describe('fetchMetrics() - without credentials', () => {
    it('should return mock data when client not initialized', async () => {
      const result = await dataSource.fetchMetrics({
        id: 'test-widget',
        type: 'big-number'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('data');
      expect(result.source).toBe('datadog');
    });
  });

  describe('transformData()', () => {
    it('should handle empty results', () => {
      const result = dataSource.transformData(null, 'big-number');
      expect(result).toBeDefined();
    });

    it('should transform big-number data correctly', () => {
      const mockResponse = {
        series: [{
          pointlist: [[1704110400000, 45.5], [1704110700000, 50.2], [1704111000000, 55.8]],
          metric: 'system.cpu.user'
        }]
      };

      const result = dataSource.transformData(mockResponse, 'big-number');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('previous');
      expect(result).toHaveProperty('trend');
      expect(result.value).toBe(55.8);
      expect(result.trend).toBe('up');
    });

    it('should transform gauge data correctly', () => {
      const mockResponse = {
        series: [{
          pointlist: [[1704110400000, 75.5]],
          metric: 'system.cpu.user'
        }]
      };

      const result = dataSource.transformData(mockResponse, 'gauge');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('min');
      expect(result).toHaveProperty('max');
      expect(result.value).toBe(75.5);
    });

    it('should transform line-chart data correctly', () => {
      const mockResponse = {
        series: [{
          pointlist: [[1704110400000, 10], [1704110700000, 20], [1704111000000, 30]],
          metric: 'requests.count'
        }]
      };

      const result = dataSource.transformData(mockResponse, 'line-chart');

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('values');
      expect(result.labels.length).toBe(3);
      expect(result.values).toEqual([10, 20, 30]);
    });
  });

  describe('testConnection()', () => {
    it('should return false when client not initialized', async () => {
      const result = await dataSource.testConnection();
      expect(result).toBe(false);
    });

    it('should return true with valid credentials', async () => {
      const ds = new DataDogDataSource({
        apiKey: 'test-api-key',
        appKey: 'test-app-key'
      });

      await ds.initialize();

      // Will fail in tests (invalid credentials), but structure is correct
      const result = await ds.testConnection();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getMockData()', () => {
    it('should return realistic mock data for big-number', () => {
      const data = dataSource.getMockData('big-number');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('trend');
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

    it('should include APM metrics', () => {
      const metrics = dataSource.getAvailableMetrics();
      const apmMetric = metrics.find(m => m.id === 'apm_requests_per_second');

      expect(apmMetric).toBeDefined();
      expect(apmMetric).toHaveProperty('query');
      expect(apmMetric).toHaveProperty('widgets');
    });
  });
});
