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

  describe('getMockData()', () => {
    it('should return mock data for big-number widget', () => {
      const data = dataSource.getMockData('big-number');
      expect(data).toHaveProperty('value');
    });
  });
});
