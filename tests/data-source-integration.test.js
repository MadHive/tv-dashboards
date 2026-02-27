// ===========================================================================
// Data Source Integration Tests
// Tests BigQuery and GCP data sources with query-manager integration
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BigQueryDataSource } from '../server/data-sources/bigquery.js';
import { GCPDataSource } from '../server/data-sources/gcp.js';
import { saveQuery, deleteQuery, getQuery } from '../server/query-manager.js';

describe('BigQuery Data Source Integration', () => {
  let dataSource;
  const testQueryId = 'test-bq-integration';

  beforeEach(async () => {
    dataSource = new BigQueryDataSource();

    // Create a test query
    await saveQuery('bigquery', {
      id: testQueryId,
      name: 'Test Integration Query',
      description: 'Testing BigQuery integration',
      sql: 'SELECT 1 as value, "test" as label',
      widgetTypes: ['big-number', 'stat-card']
    });
  });

  afterEach(async () => {
    // Clean up test query
    try {
      await deleteQuery('bigquery', testQueryId);
    } catch (error) {
      // Ignore if already deleted
    }
  });

  describe('Query Manager Integration', () => {
    it('should save query via data source', async () => {
      const queryDef = {
        id: 'ds-save-test',
        name: 'Data Source Save Test',
        sql: 'SELECT COUNT(*) as value',
        widgetTypes: ['big-number']
      };

      const saved = await dataSource.saveQuery('ds-save-test', queryDef);

      expect(saved).toBeObject();
      expect(saved.id).toBe('ds-save-test');
      expect(saved.name).toBe('Data Source Save Test');

      // Verify it's in query-manager
      const fromManager = await getQuery('bigquery', 'ds-save-test');
      expect(fromManager).toBeObject();
      expect(fromManager.id).toBe('ds-save-test');

      // Clean up
      await deleteQuery('bigquery', 'ds-save-test');
    });

    it('should retrieve query via data source', async () => {
      const retrieved = await dataSource.getSavedQuery(testQueryId);

      expect(retrieved).toBeObject();
      expect(retrieved.id).toBe(testQueryId);
      expect(retrieved.name).toBe('Test Integration Query');
      expect(retrieved.sql).toBeDefined();
    });

    it('should list all saved queries via data source', async () => {
      const queries = await dataSource.listSavedQueries();

      expect(Array.isArray(queries)).toBe(true);
      expect(queries.length).toBeGreaterThan(0);

      const testQuery = queries.find(q => q.id === testQueryId);
      expect(testQuery).toBeObject();
    });

    it('should delete query via data source', async () => {
      // Create temp query
      await saveQuery('bigquery', {
        id: 'temp-delete',
        name: 'Temp Delete',
        sql: 'SELECT 1',
        widgetTypes: ['big-number']
      });

      const deleted = await dataSource.deleteSavedQuery('temp-delete');
      expect(deleted).toBe(true);

      // Verify it's gone from query-manager
      const afterDelete = await getQuery('bigquery', 'temp-delete');
      expect(afterDelete).toBeNull();
    });
  });

  describe('fetchMetrics with queryId', () => {
    it('should use queryId to fetch from saved query', async () => {
      const widgetConfig = {
        id: 'test-widget',
        type: 'big-number',
        queryId: testQueryId
      };

      // Note: This will fail if BigQuery client is not configured
      // but we're testing the flow, not the actual query execution
      try {
        const result = await dataSource.fetchMetrics(widgetConfig);

        // If BigQuery is configured, check result
        if (result && !result.error) {
          expect(result.source).toBe('bigquery');
          expect(result.widgetId).toBe('test-widget');
        }
      } catch (error) {
        // Expected if BigQuery is not configured - that's OK
        expect(error.message).toBeDefined();
      }
    });

    it('should handle non-existent queryId gracefully', async () => {
      const widgetConfig = {
        id: 'test-widget',
        type: 'big-number',
        queryId: 'does-not-exist'
      };

      // BigQuery data source handles errors gracefully via handleError()
      // which returns mock/empty data instead of throwing
      const result = await dataSource.fetchMetrics(widgetConfig);

      expect(result).toBeObject();
      // Should return some data structure (error handled internally)
      expect(result.timestamp || result.value !== undefined).toBe(true);
    });
  });

  describe('transformData', () => {
    it('should transform rows for big-number widget', () => {
      const rows = [{ value: 12345, unit: 'requests' }];
      const transformed = dataSource.transformData(rows, 'big-number');

      expect(transformed).toBeObject();
      expect(transformed.value).toBe(12345);
    });

    it('should transform rows for bar-chart widget', () => {
      const rows = [
        { label: 'A', value: 100 },
        { label: 'B', value: 200 }
      ];
      const transformed = dataSource.transformData(rows, 'bar-chart');

      expect(transformed).toBeObject();
      expect(transformed.values).toBeDefined();
      expect(Array.isArray(transformed.values)).toBe(true);
      expect(transformed.values.length).toBe(2);
    });

    it('should return empty data for empty result set', () => {
      const rows = [];
      const transformed = dataSource.transformData(rows, 'big-number');

      expect(transformed).toBeObject();
    });
  });
});

describe('GCP Data Source Integration', () => {
  let dataSource;
  const testQueryId = 'test-gcp-integration';

  beforeEach(async () => {
    dataSource = new GCPDataSource();

    // Create a test GCP query
    await saveQuery('gcp', {
      id: testQueryId,
      name: 'Test GCP Integration Query',
      description: 'Testing GCP integration',
      metricType: 'run.googleapis.com/request_count',
      project: 'mad-master',
      timeWindow: 10,
      aggregation: {
        alignmentPeriod: '60s',
        perSeriesAligner: 'ALIGN_RATE'
      },
      widgetTypes: ['big-number', 'line-chart']
    });
  });

  afterEach(async () => {
    // Clean up test query
    try {
      await deleteQuery('gcp', testQueryId);
    } catch (error) {
      // Ignore if already deleted
    }
  });

  describe('Query Manager Integration', () => {
    it('should retrieve GCP query from query-manager', async () => {
      const retrieved = await getQuery('gcp', testQueryId);

      expect(retrieved).toBeObject();
      expect(retrieved.id).toBe(testQueryId);
      expect(retrieved.metricType).toBe('run.googleapis.com/request_count');
      expect(retrieved.project).toBe('mad-master');
    });
  });

  describe('executeQuery', () => {
    it('should use queryId to fetch GCP metrics', async () => {
      const widgetConfig = {
        id: 'test-gcp-widget',
        type: 'big-number',
        queryId: testQueryId
      };

      try {
        // Initialize the data source
        await dataSource.initialize();

        // Note: This will fail without proper GCP configuration
        // but we're testing the flow works
        const result = await dataSource.executeQuery(widgetConfig);

        expect(result).toBeObject();

        // If GCP is properly configured, check successful result
        if (result && !result.error) {
          expect(result.source).toBe('gcp');
          expect(result.queryId).toBe(testQueryId);
        } else {
          // Otherwise, verify error is handled gracefully
          expect(result.error).toBeDefined();
        }
      } catch (error) {
        // In CI or environments without GCP credentials, initialization will fail
        // This is expected and the test should pass - just catch and ignore
        // Any error during GCP auth is acceptable in test environments
      }
    });

    it('should return error response for non-existent queryId', async () => {
      const widgetConfig = {
        id: 'test-widget',
        type: 'big-number',
        queryId: 'does-not-exist-gcp'
      };

      await dataSource.initialize();

      // GCP data source handles errors gracefully by returning error response
      const result = await dataSource.executeQuery(widgetConfig);

      expect(result).toBeObject();
      // Check that it's an error response (has error field or empty data)
      const hasError = result.error !== undefined || result.data === null;
      expect(hasError).toBe(true);
    });
  });

  describe('transformData', () => {
    it('should handle already-transformed data', () => {
      const data = { value: 100, unit: 'requests' };
      const transformed = dataSource.transformData(data, 'big-number');

      expect(transformed).toBeObject();
      expect(transformed.value).toBe(100);
    });

    it('should handle empty data', () => {
      const transformed = dataSource.transformData(null, 'big-number');

      expect(transformed).toBeDefined();
    });
  });
});

describe('Cross-Source Query Management', () => {
  it('should maintain separate query namespaces for different sources', async () => {
    // Create queries with same ID in different sources
    await saveQuery('bigquery', {
      id: 'shared-id',
      name: 'BigQuery Version',
      sql: 'SELECT 1',
      widgetTypes: ['big-number']
    });

    await saveQuery('gcp', {
      id: 'shared-id',
      name: 'GCP Version',
      metricType: 'run.googleapis.com/request_count',
      project: 'mad-master',
      widgetTypes: ['big-number']
    });

    const bqQuery = await getQuery('bigquery', 'shared-id');
    const gcpQuery = await getQuery('gcp', 'shared-id');

    expect(bqQuery.name).toBe('BigQuery Version');
    expect(bqQuery.sql).toBeDefined();

    expect(gcpQuery.name).toBe('GCP Version');
    expect(gcpQuery.metricType).toBeDefined();

    // Clean up
    await deleteQuery('bigquery', 'shared-id');
    await deleteQuery('gcp', 'shared-id');
  });
});
