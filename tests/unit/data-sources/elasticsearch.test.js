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

  describe('getMockData()', () => {
    it('should return mock data for big-number widget', () => {
      const data = dataSource.getMockData('big-number');
      expect(data).toHaveProperty('value');
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
});
