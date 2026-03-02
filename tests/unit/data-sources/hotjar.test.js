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
