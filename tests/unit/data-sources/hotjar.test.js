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

  describe('getMockData()', () => {
    it('should return mock data for big-number widget', () => {
      const data = dataSource.getMockData('big-number');
      expect(data).toHaveProperty('value');
    });
  });
});
