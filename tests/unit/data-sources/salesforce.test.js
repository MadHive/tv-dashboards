// ===========================================================================
// Salesforce Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { SalesforceDataSource } from '../../../server/data-sources/salesforce.js';

describe('Salesforce Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new SalesforceDataSource({});
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('salesforce');
      expect(dataSource.instanceUrl).toBeUndefined();
      expect(dataSource.accessToken).toBeUndefined();
    });
  });

  describe('initialize()', () => {
    it('should handle missing credentials gracefully', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(false);
    });

    it('should initialize with instance URL and access token if provided', async () => {
      const ds = new SalesforceDataSource({
        instanceUrl: 'https://test.salesforce.com',
        accessToken: 'test-access-token'
      });

      await ds.initialize();
      expect(ds.connection).not.toBeNull();
    });

    it('should support OAuth credentials', async () => {
      const ds = new SalesforceDataSource({
        instanceUrl: 'https://test.salesforce.com',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        username: 'test@example.com',
        password: 'test-password'
      });

      await ds.initialize();
      expect(ds.connection).not.toBeNull();
    });
  });

  describe('getMockData()', () => {
    it('should return mock data for big-number widget', () => {
      const data = dataSource.getMockData('big-number');
      expect(data).toHaveProperty('value');
    });
  });
});
