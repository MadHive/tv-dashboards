// ===========================================================================
// Elasticsearch Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { ElasticsearchDataSource } from '../../../server/data-sources/elasticsearch.js';

describe('Elasticsearch Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new ElasticsearchDataSource({});
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('elasticsearch');
      expect(dataSource.host).toBeUndefined();
      expect(dataSource.apiKey).toBeUndefined();
    });
  });

  describe('initialize()', () => {
    it('should handle missing credentials gracefully', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(false);
    });

    it('should initialize with host and API key if provided', async () => {
      const ds = new ElasticsearchDataSource({
        host: 'https://localhost:9200',
        apiKey: 'test-api-key'
      });

      await ds.initialize();
      expect(ds.client).not.toBeNull();
    });

    it('should support basic auth credentials', async () => {
      const ds = new ElasticsearchDataSource({
        host: 'https://localhost:9200',
        username: 'elastic',
        password: 'test-password'
      });

      await ds.initialize();
      expect(ds.client).not.toBeNull();
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
      expect(result.source).toBe('elasticsearch');
    });
  });

  describe('transformData()', () => {
    it('should handle empty results', () => {
      const result = dataSource.transformData(null, 'big-number', 'count');
      expect(result).toBeDefined();
    });

    it('should transform count aggregation for big-number', () => {
      const mockResponse = {
        hits: {
          total: { value: 12543 }
        }
      };

      const result = dataSource.transformData(mockResponse, 'big-number', 'count');

      expect(result).toHaveProperty('value');
      expect(result.value).toBe(12543);
    });

    it('should transform time-series aggregation for line-chart', () => {
      const mockResponse = {
        aggregations: {
          time_buckets: {
            buckets: [
              { key: 1704110400000, doc_count: 100, metric: { value: 45.5 } },
              { key: 1704110700000, doc_count: 120, metric: { value: 50.2 } },
              { key: 1704111000000, doc_count: 110, metric: { value: 55.8 } }
            ]
          }
        }
      };

      const result = dataSource.transformData(mockResponse, 'line-chart', 'avg');

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('values');
      expect(result.labels.length).toBe(3);
      expect(result.values).toEqual([45.5, 50.2, 55.8]);
    });

    it('should transform time-series doc_count for bar-chart', () => {
      const mockResponse = {
        aggregations: {
          time_buckets: {
            buckets: [
              { key: 1704110400000, doc_count: 100 },
              { key: 1704110700000, doc_count: 120 },
              { key: 1704111000000, doc_count: 110 }
            ]
          }
        }
      };

      const result = dataSource.transformData(mockResponse, 'bar-chart', 'count');

      expect(result).toHaveProperty('values');
      expect(result.values.length).toBe(3);
      expect(result.values[0]).toHaveProperty('label');
      expect(result.values[0]).toHaveProperty('value');
    });
  });

  describe('testConnection()', () => {
    it('should return false when client not initialized', async () => {
      const result = await dataSource.testConnection();
      expect(result).toBe(false);
    });

    it('should return boolean with initialized client', async () => {
      const ds = new ElasticsearchDataSource({
        host: 'https://localhost:9200',
        apiKey: 'test-key'
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
