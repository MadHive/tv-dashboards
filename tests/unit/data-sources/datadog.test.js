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

  describe('getMockData()', () => {
    it('should return mock data for big-number widget', () => {
      const data = dataSource.getMockData('big-number');
      expect(data).toHaveProperty('value');
    });
  });
});
