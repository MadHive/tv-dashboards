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
});
