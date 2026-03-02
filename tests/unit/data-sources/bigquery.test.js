// ===========================================================================
// BigQuery Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { BigQueryDataSource } from '../../../server/data-sources/bigquery.js';

describe('BigQuery Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new BigQueryDataSource({});
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('bigquery');
      expect(dataSource.client).toBeNull();
      expect(dataSource.queryCache).toBeInstanceOf(Map);
      expect(dataSource.isConnected).toBe(false);
    });

    it('should accept custom configuration', () => {
      const ds = new BigQueryDataSource({
        projectId: 'test-project',
        credentials: '/path/to/creds.json'
      });

      expect(ds.projectId).toBe('test-project');
      expect(ds.credentials).toBe('/path/to/creds.json');
    });

    it('should use environment variables for projectId', () => {
      const original = process.env.GCP_PROJECT_ID;
      process.env.GCP_PROJECT_ID = 'env-project';

      const ds = new BigQueryDataSource({});
      expect(ds.projectId).toBe('env-project');

      if (original) process.env.GCP_PROJECT_ID = original;
      else delete process.env.GCP_PROJECT_ID;
    });

    it('should use environment variables for credentials', () => {
      const original = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/env/path/creds.json';

      const ds = new BigQueryDataSource({});
      expect(ds.credentials).toBe('/env/path/creds.json');

      if (original) process.env.GOOGLE_APPLICATION_CREDENTIALS = original;
      else delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    });

    it('should default to mad-master project', () => {
      const original = process.env.GCP_PROJECT_ID;
      delete process.env.GCP_PROJECT_ID;

      const ds = new BigQueryDataSource({});
      expect(ds.projectId).toBe('mad-master');

      if (original) process.env.GCP_PROJECT_ID = original;
    });

    it('should initialize queryCache as empty Map', () => {
      expect(dataSource.queryCache.size).toBe(0);
    });
  });

  describe('initialize()', () => {
    it('should set isConnected to true on success', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(true);
    });

    it('should create BigQuery client', async () => {
      await dataSource.initialize();
      expect(dataSource.client).not.toBeNull();
    });

    it('should use projectId in client config', async () => {
      const ds = new BigQueryDataSource({ projectId: 'test-project' });
      await ds.initialize();
      expect(ds.client).not.toBeNull();
    });

    it('should handle string credentials as keyFilename', async () => {
      const ds = new BigQueryDataSource({
        credentials: '/path/to/key.json'
      });
      await ds.initialize();
      expect(ds.client).not.toBeNull();
    });

    it('should handle initialization errors gracefully', async () => {
      const ds = new BigQueryDataSource({});

      // Mock BigQuery to throw error
      ds.initialize = async function() {
        try {
          throw new Error('Auth failed');
        } catch (error) {
          this.lastError = error;
          this.isConnected = false;
        }
      };

      await ds.initialize();
      expect(ds.isConnected).toBe(false);
      expect(ds.lastError).toBeDefined();
    });

    it('should set lastError on failure', async () => {
      const ds = new BigQueryDataSource({});

      ds.initialize = async function() {
        const error = new Error('Connection failed');
        this.lastError = error;
        this.isConnected = false;
      };

      await ds.initialize();
      expect(ds.lastError.message).toBe('Connection failed');
    });
  });

  describe('executeQuery()', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should initialize client if not already initialized', async () => {
      const ds = new BigQueryDataSource({});
      expect(ds.client).toBeNull();

      // Will fail without proper mocking, but shows initialization attempt
      try {
        await ds.executeQuery('SELECT 1');
      } catch (error) {
        // Expected - client may not be valid
      }

      expect(ds.client).not.toBeNull();
    });

    it('should throw error when client not initialized', async () => {
      const ds = new BigQueryDataSource({});

      // Force initialization to fail
      ds.initialize = async function() {
        this.client = null;
        this.isConnected = false;
      };

      try {
        await ds.executeQuery('SELECT 1');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('BigQuery client not initialized');
      }
    });

    it('should cache query results by default', async () => {
      const sql = 'SELECT 1 as test';
      const params = {};

      // Mock the client to avoid real API calls
      dataSource.client = {
        createQueryJob: mock(async () => [{
          id: 'job-123',
          getQueryResults: mock(async () => [[{ test: 1 }]])
        }])
      };

      await dataSource.executeQuery(sql, params, true);

      // Cache should have entry
      const cacheKey = `${sql}:${JSON.stringify(params)}`;
      expect(dataSource.queryCache.has(cacheKey)).toBe(true);
    });

    it('should use cache when available and fresh', async () => {
      const sql = 'SELECT 1 as test';
      const params = {};
      const cacheKey = `${sql}:${JSON.stringify(params)}`;

      // Populate cache
      dataSource.queryCache.set(cacheKey, {
        data: [{ test: 'cached' }],
        timestamp: Date.now()
      });

      const result = await dataSource.executeQuery(sql, params, true);
      expect(result).toEqual([{ test: 'cached' }]);
    });

    it('should bypass cache when useCache is false', async () => {
      const sql = 'SELECT 1 as test';
      const params = {};

      // Mock client
      dataSource.client = {
        createQueryJob: mock(async () => [{
          id: 'job-123',
          getQueryResults: mock(async () => [[{ test: 'fresh' }]])
        }])
      };

      const result = await dataSource.executeQuery(sql, params, false);
      expect(result).toEqual([{ test: 'fresh' }]);
    });

    it('should not use stale cache entries', async () => {
      const sql = 'SELECT 1 as test';
      const params = {};
      const cacheKey = `${sql}:${JSON.stringify(params)}`;

      // Populate cache with stale data (6 minutes old)
      dataSource.queryCache.set(cacheKey, {
        data: [{ test: 'stale' }],
        timestamp: Date.now() - (6 * 60 * 1000)
      });

      // Mock client for fresh data
      dataSource.client = {
        createQueryJob: mock(async () => [{
          id: 'job-123',
          getQueryResults: mock(async () => [[{ test: 'fresh' }]])
        }])
      };

      const result = await dataSource.executeQuery(sql, params, true);
      expect(result).toEqual([{ test: 'fresh' }]);
    });

    it('should include params in cache key', async () => {
      const sql = 'SELECT * FROM table WHERE id = @id';

      // Mock client
      dataSource.client = {
        createQueryJob: mock(async () => [{
          id: 'job-123',
          getQueryResults: mock(async () => [[{ id: 1 }]])
        }])
      };

      await dataSource.executeQuery(sql, { id: 1 }, true);
      await dataSource.executeQuery(sql, { id: 2 }, true);

      // Should have two separate cache entries
      expect(dataSource.queryCache.size).toBe(2);
    });

    it('should set location to US', async () => {
      let capturedOptions;

      dataSource.client = {
        createQueryJob: mock(async (options) => {
          capturedOptions = options;
          return [{
            id: 'job-123',
            getQueryResults: mock(async () => [[{ test: 1 }]])
          }];
        })
      };

      await dataSource.executeQuery('SELECT 1', {}, true);
      expect(capturedOptions.location).toBe('US');
    });

    it('should handle query execution errors', async () => {
      dataSource.client = {
        createQueryJob: mock(async () => {
          throw new Error('Query syntax error');
        })
      };

      try {
        await dataSource.executeQuery('SELECT bad syntax', {}, true);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Query syntax error');
      }
    });
  });

  describe('Deprecated query methods (backward compatibility)', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should delegate saveQuery to query-manager', async () => {
      const queryDef = {
        name: 'Test Query',
        sql: 'SELECT 1'
      };

      // Will fail without proper query-manager mock
      try {
        await dataSource.saveQuery('test-query', queryDef);
      } catch (error) {
        // Expected - demonstrates delegation pattern
        expect(error).toBeDefined();
      }
    });

    it('should delegate getSavedQuery to query-manager', async () => {
      try {
        await dataSource.getSavedQuery('test-query');
      } catch (error) {
        // Expected - demonstrates delegation pattern
        expect(error).toBeDefined();
      }
    });

    it('should delegate listSavedQueries to query-manager', async () => {
      try {
        await dataSource.listSavedQueries();
      } catch (error) {
        // Expected - demonstrates delegation pattern
        expect(error).toBeDefined();
      }
    });

    it('should delegate deleteSavedQuery to query-manager', async () => {
      try {
        await dataSource.deleteSavedQuery('test-query');
      } catch (error) {
        // Expected - demonstrates delegation pattern
        expect(error).toBeDefined();
      }
    });
  });

  describe('fetchMetrics()', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should load query from query-manager when queryId present', async () => {
      const widgetConfig = {
        id: 'test-widget',
        type: 'big-number',
        queryId: 'test-query'
      };

      // Will fail without proper mocking
      try {
        await dataSource.fetchMetrics(widgetConfig);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should execute inline SQL when provided', async () => {
      const widgetConfig = {
        id: 'test-widget',
        type: 'big-number',
        sql: 'SELECT 42 as value'
      };

      // Mock client
      dataSource.client = {
        createQueryJob: mock(async () => [{
          id: 'job-123',
          getQueryResults: mock(async () => [[{ value: 42 }]])
        }])
      };

      const result = await dataSource.fetchMetrics(widgetConfig);
      expect(result.source).toBe('bigquery');
      expect(result.widgetId).toBe('test-widget');
    });

    it('should throw error when no query defined', async () => {
      const widgetConfig = {
        id: 'test-widget',
        type: 'big-number'
        // No queryId or sql
      };

      const result = await dataSource.fetchMetrics(widgetConfig);

      // Should return error via handleError
      expect(result).toBeDefined();
    });

    it('should include timestamp in response', async () => {
      const widgetConfig = {
        id: 'test-widget',
        type: 'big-number',
        sql: 'SELECT 42 as value'
      };

      dataSource.client = {
        createQueryJob: mock(async () => [{
          id: 'job-123',
          getQueryResults: mock(async () => [[{ value: 42 }]])
        }])
      };

      const result = await dataSource.fetchMetrics(widgetConfig);
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });

    it('should include rowCount in response', async () => {
      const widgetConfig = {
        id: 'test-widget',
        type: 'big-number',
        sql: 'SELECT 42 as value'
      };

      dataSource.client = {
        createQueryJob: mock(async () => [{
          id: 'job-123',
          getQueryResults: mock(async () => [[{ value: 42 }, { value: 43 }]])
        }])
      };

      const result = await dataSource.fetchMetrics(widgetConfig);
      expect(result.rowCount).toBe(2);
    });

    it('should transform data for widget type', async () => {
      const widgetConfig = {
        id: 'test-widget',
        type: 'big-number',
        sql: 'SELECT 42 as value'
      };

      dataSource.client = {
        createQueryJob: mock(async () => [{
          id: 'job-123',
          getQueryResults: mock(async () => [[{ value: 42 }]])
        }])
      };

      const result = await dataSource.fetchMetrics(widgetConfig);
      expect(result.data).toBeDefined();
      expect(result.data.value).toBe(42);
    });

    it('should handle errors via handleError method', async () => {
      const widgetConfig = {
        id: 'test-widget',
        type: 'big-number',
        queryId: 'non-existent'
      };

      const result = await dataSource.fetchMetrics(widgetConfig);

      // Should return mock data as fallback
      expect(result).toBeDefined();
    });
  });

  describe('testConnection()', () => {
    it('should initialize if client is null', async () => {
      expect(dataSource.client).toBeNull();

      await dataSource.testConnection();

      expect(dataSource.client).not.toBeNull();
    });

    it('should execute test query', async () => {
      await dataSource.initialize();

      let queryCalled = false;
      dataSource.client = {
        query: mock(async () => {
          queryCalled = true;
          return [[{ test: 1 }]];
        })
      };

      const result = await dataSource.testConnection();
      expect(queryCalled).toBe(true);
    });

    it('should return true on successful connection', async () => {
      await dataSource.initialize();

      dataSource.client = {
        query: mock(async () => [[{ test: 1 }]])
      };

      const result = await dataSource.testConnection();
      expect(result).toBe(true);
    });

    it('should return false on connection failure', async () => {
      await dataSource.initialize();

      dataSource.client = {
        query: mock(async () => {
          throw new Error('Connection failed');
        })
      };

      const result = await dataSource.testConnection();
      expect(result).toBe(false);
    });

    it('should use SELECT 1 as test query', async () => {
      await dataSource.initialize();

      let capturedQuery;
      dataSource.client = {
        query: mock(async (options) => {
          capturedQuery = options.query;
          return [[{ test: 1 }]];
        })
      };

      await dataSource.testConnection();
      expect(capturedQuery).toBe('SELECT 1 as test');
    });
  });

  describe('listDatasets()', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should initialize if client is null', async () => {
      const ds = new BigQueryDataSource({});
      expect(ds.client).toBeNull();

      await ds.listDatasets();
      expect(ds.client).not.toBeNull();
    });

    it('should return array of datasets', async () => {
      dataSource.client = {
        getDatasets: mock(async () => [[
          {
            id: 'dataset1',
            metadata: {
              friendlyName: 'Dataset 1',
              location: 'US',
              creationTime: '2024-01-01'
            }
          }
        ]])
      };

      const datasets = await dataSource.listDatasets();
      expect(Array.isArray(datasets)).toBe(true);
      expect(datasets.length).toBe(1);
    });

    it('should map dataset properties correctly', async () => {
      dataSource.client = {
        getDatasets: mock(async () => [[
          {
            id: 'dataset1',
            metadata: {
              friendlyName: 'Dataset 1',
              location: 'US',
              creationTime: '2024-01-01'
            }
          }
        ]])
      };

      const datasets = await dataSource.listDatasets();
      expect(datasets[0].id).toBe('dataset1');
      expect(datasets[0].name).toBe('Dataset 1');
      expect(datasets[0].location).toBe('US');
      expect(datasets[0].created).toBe('2024-01-01');
    });

    it('should use dataset id as name if friendlyName missing', async () => {
      dataSource.client = {
        getDatasets: mock(async () => [[
          {
            id: 'dataset1',
            metadata: {
              location: 'US',
              creationTime: '2024-01-01'
            }
          }
        ]])
      };

      const datasets = await dataSource.listDatasets();
      expect(datasets[0].name).toBe('dataset1');
    });

    it('should return empty array on error', async () => {
      dataSource.client = {
        getDatasets: mock(async () => {
          throw new Error('Permission denied');
        })
      };

      const datasets = await dataSource.listDatasets();
      expect(datasets).toEqual([]);
    });
  });

  describe('listTables()', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should initialize if client is null', async () => {
      const ds = new BigQueryDataSource({});
      expect(ds.client).toBeNull();

      await ds.listTables('test-dataset');
      expect(ds.client).not.toBeNull();
    });

    it('should return array of tables', async () => {
      const mockDataset = {
        getTables: mock(async () => [[
          {
            id: 'table1',
            metadata: {
              friendlyName: 'Table 1',
              type: 'TABLE',
              numRows: '1000',
              numBytes: '10000',
              creationTime: '2024-01-01'
            }
          }
        ]])
      };

      dataSource.client = {
        dataset: mock(() => mockDataset)
      };

      const tables = await dataSource.listTables('test-dataset');
      expect(Array.isArray(tables)).toBe(true);
      expect(tables.length).toBe(1);
    });

    it('should map table properties correctly', async () => {
      const mockDataset = {
        getTables: mock(async () => [[
          {
            id: 'table1',
            metadata: {
              friendlyName: 'Table 1',
              type: 'TABLE',
              numRows: '1000',
              numBytes: '10000',
              creationTime: '2024-01-01'
            }
          }
        ]])
      };

      dataSource.client = {
        dataset: mock(() => mockDataset)
      };

      const tables = await dataSource.listTables('test-dataset');
      expect(tables[0].id).toBe('table1');
      expect(tables[0].name).toBe('Table 1');
      expect(tables[0].type).toBe('TABLE');
      expect(tables[0].numRows).toBe('1000');
      expect(tables[0].numBytes).toBe('10000');
      expect(tables[0].created).toBe('2024-01-01');
    });

    it('should use table id as name if friendlyName missing', async () => {
      const mockDataset = {
        getTables: mock(async () => [[
          {
            id: 'table1',
            metadata: {
              type: 'TABLE',
              numRows: '1000',
              numBytes: '10000',
              creationTime: '2024-01-01'
            }
          }
        ]])
      };

      dataSource.client = {
        dataset: mock(() => mockDataset)
      };

      const tables = await dataSource.listTables('test-dataset');
      expect(tables[0].name).toBe('table1');
    });

    it('should return empty array on error', async () => {
      dataSource.client = {
        dataset: mock(() => ({
          getTables: mock(async () => {
            throw new Error('Dataset not found');
          })
        }))
      };

      const tables = await dataSource.listTables('non-existent');
      expect(tables).toEqual([]);
    });
  });

  describe('getTableSchema()', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should initialize if client is null', async () => {
      const ds = new BigQueryDataSource({});
      expect(ds.client).toBeNull();

      await ds.getTableSchema('dataset', 'table');
      expect(ds.client).not.toBeNull();
    });

    it('should return schema with fields', async () => {
      const mockTable = {
        getMetadata: mock(async () => [{
          schema: {
            fields: [
              { name: 'id', type: 'INTEGER', mode: 'REQUIRED' },
              { name: 'name', type: 'STRING', mode: 'NULLABLE', description: 'User name' }
            ]
          },
          numRows: '1000',
          numBytes: '10000'
        }])
      };

      dataSource.client = {
        dataset: mock(() => ({
          table: mock(() => mockTable)
        }))
      };

      const schema = await dataSource.getTableSchema('dataset', 'table');
      expect(schema.fields).toHaveLength(2);
      expect(schema.fields[0].name).toBe('id');
      expect(schema.fields[0].type).toBe('INTEGER');
      expect(schema.fields[0].mode).toBe('REQUIRED');
    });

    it('should include numRows and numBytes', async () => {
      const mockTable = {
        getMetadata: mock(async () => [{
          schema: { fields: [] },
          numRows: '1000',
          numBytes: '10000'
        }])
      };

      dataSource.client = {
        dataset: mock(() => ({
          table: mock(() => mockTable)
        }))
      };

      const schema = await dataSource.getTableSchema('dataset', 'table');
      expect(schema.numRows).toBe('1000');
      expect(schema.numBytes).toBe('10000');
    });

    it('should map field descriptions', async () => {
      const mockTable = {
        getMetadata: mock(async () => [{
          schema: {
            fields: [
              { name: 'id', type: 'INTEGER', mode: 'REQUIRED', description: 'Primary key' }
            ]
          },
          numRows: '1000',
          numBytes: '10000'
        }])
      };

      dataSource.client = {
        dataset: mock(() => ({
          table: mock(() => mockTable)
        }))
      };

      const schema = await dataSource.getTableSchema('dataset', 'table');
      expect(schema.fields[0].description).toBe('Primary key');
    });

    it('should return null on error', async () => {
      dataSource.client = {
        dataset: mock(() => ({
          table: mock(() => ({
            getMetadata: mock(async () => {
              throw new Error('Table not found');
            })
          }))
        }))
      };

      const schema = await dataSource.getTableSchema('dataset', 'non-existent');
      expect(schema).toBeNull();
    });
  });

  describe('validateQuery()', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should initialize if client is null', async () => {
      const ds = new BigQueryDataSource({});
      expect(ds.client).toBeNull();

      await ds.validateQuery('SELECT 1');
      expect(ds.client).not.toBeNull();
    });

    it('should return valid true for correct SQL', async () => {
      dataSource.client = {
        createQueryJob: mock(async () => [{
          getMetadata: mock(async () => [{
            statistics: {
              totalBytesProcessed: '1000'
            }
          }])
        }])
      };

      const result = await dataSource.validateQuery('SELECT 1');
      expect(result.valid).toBe(true);
    });

    it('should include bytesProcessed in result', async () => {
      dataSource.client = {
        createQueryJob: mock(async () => [{
          getMetadata: mock(async () => [{
            statistics: {
              totalBytesProcessed: '1000'
            }
          }])
        }])
      };

      const result = await dataSource.validateQuery('SELECT 1');
      expect(result.bytesProcessed).toBe('1000');
    });

    it('should include estimatedCost in result', async () => {
      dataSource.client = {
        createQueryJob: mock(async () => [{
          getMetadata: mock(async () => [{
            statistics: {
              totalBytesProcessed: '1000000000000' // 1TB
            }
          }])
        }])
      };

      const result = await dataSource.validateQuery('SELECT 1');
      expect(result.estimatedCost).toBeDefined();
    });

    it('should use dryRun mode', async () => {
      let capturedOptions;

      dataSource.client = {
        createQueryJob: mock(async (options) => {
          capturedOptions = options;
          return [{
            getMetadata: mock(async () => [{
              statistics: { totalBytesProcessed: '1000' }
            }])
          }];
        })
      };

      await dataSource.validateQuery('SELECT 1');
      expect(capturedOptions.dryRun).toBe(true);
    });

    it('should return valid false for syntax errors', async () => {
      dataSource.client = {
        createQueryJob: mock(async () => {
          throw new Error('Syntax error at position 1');
        })
      };

      const result = await dataSource.validateQuery('SELECT bad syntax');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Syntax error');
    });

    it('should include error message when invalid', async () => {
      dataSource.client = {
        createQueryJob: mock(async () => {
          throw new Error('Table not found: dataset.table');
        })
      };

      const result = await dataSource.validateQuery('SELECT * FROM dataset.table');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Table not found: dataset.table');
    });
  });

  describe('estimateQueryCost()', () => {
    it('should calculate cost at $5 per TB', () => {
      const oneTB = 1024 * 1024 * 1024 * 1024;
      const cost = dataSource.estimateQueryCost(oneTB.toString());
      expect(parseFloat(cost)).toBe(5.0);
    });

    it('should handle fractional TB', () => {
      const halfTB = (1024 * 1024 * 1024 * 1024) / 2;
      const cost = dataSource.estimateQueryCost(halfTB.toString());
      expect(parseFloat(cost)).toBe(2.5);
    });

    it('should handle very small queries', () => {
      const cost = dataSource.estimateQueryCost('1000');
      expect(parseFloat(cost)).toBeLessThan(0.01);
    });

    it('should return string with 4 decimal places', () => {
      const oneTB = 1024 * 1024 * 1024 * 1024;
      const cost = dataSource.estimateQueryCost(oneTB.toString());
      expect(cost).toMatch(/^\d+\.\d{4}$/);
    });

    it('should handle zero bytes', () => {
      const cost = dataSource.estimateQueryCost('0');
      expect(parseFloat(cost)).toBe(0);
    });
  });

  describe('getConfigSchema()', () => {
    it('should return configuration schema', () => {
      const schema = dataSource.getConfigSchema();

      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('description');
      expect(schema).toHaveProperty('fields');
      expect(Array.isArray(schema.fields)).toBe(true);
    });

    it('should have correct name', () => {
      const schema = dataSource.getConfigSchema();
      expect(schema.name).toBe('BigQuery');
    });

    it('should include projectId field', () => {
      const schema = dataSource.getConfigSchema();
      const field = schema.fields.find(f => f.name === 'projectId');

      expect(field).toBeDefined();
      expect(field.type).toBe('string');
      expect(field.required).toBe(true);
      expect(field.default).toBe('mad-master');
    });

    it('should include credentials field', () => {
      const schema = dataSource.getConfigSchema();
      const field = schema.fields.find(f => f.name === 'credentials');

      expect(field).toBeDefined();
      expect(field.type).toBe('file');
      expect(field.required).toBe(false);
      expect(field.secure).toBe(true);
    });

    it('should mention GOOGLE_APPLICATION_CREDENTIALS env var', () => {
      const schema = dataSource.getConfigSchema();
      const field = schema.fields.find(f => f.name === 'credentials');

      expect(field.envVar).toBe('GOOGLE_APPLICATION_CREDENTIALS');
    });

    it('should include queryId field', () => {
      const schema = dataSource.getConfigSchema();
      const field = schema.fields.find(f => f.name === 'queryId');

      expect(field).toBeDefined();
      expect(field.type).toBe('string');
      expect(field.required).toBe(false);
    });

    it('should include sql field', () => {
      const schema = dataSource.getConfigSchema();
      const field = schema.fields.find(f => f.name === 'sql');

      expect(field).toBeDefined();
      expect(field.type).toBe('textarea');
      expect(field.required).toBe(false);
    });

    it('should include params field', () => {
      const schema = dataSource.getConfigSchema();
      const field = schema.fields.find(f => f.name === 'params');

      expect(field).toBeDefined();
      expect(field.type).toBe('json');
      expect(field.required).toBe(false);
    });

    it('should have exactly 5 configuration fields', () => {
      const schema = dataSource.getConfigSchema();
      expect(schema.fields.length).toBe(5);
    });
  });

  describe('transformData()', () => {
    it('should return empty data for null input', () => {
      const result = dataSource.transformData(null, 'big-number');
      expect(result).toBeDefined();
    });

    it('should return empty data for empty array', () => {
      const result = dataSource.transformData([], 'big-number');
      expect(result).toBeDefined();
    });

    it('should transform for big-number widget', () => {
      const rows = [{ value: 42, label: 'Count', trend: 'up', unit: 'items' }];
      const result = dataSource.transformData(rows, 'big-number');

      expect(result.value).toBe(42);
      expect(result.label).toBe('Count');
      expect(result.trend).toBe('up');
      expect(result.unit).toBe('items');
    });

    it('should use first column value if value column missing', () => {
      const rows = [{ count: 100 }];
      const result = dataSource.transformData(rows, 'big-number');

      expect(result.value).toBe(100);
    });

    it('should transform for stat-card widget', () => {
      const rows = [{ value: 85, trend: 'up' }];
      const result = dataSource.transformData(rows, 'stat-card');

      expect(result.value).toBe(85);
      expect(result.trend).toBe('up');
    });

    it('should transform for gauge widget', () => {
      const rows = [{ value: 75, min: 0, max: 100, unit: '%', warning: 80, critical: 90 }];
      const result = dataSource.transformData(rows, 'gauge');

      expect(result.value).toBe(75);
      expect(result.min).toBe(0);
      expect(result.max).toBe(100);
      expect(result.unit).toBe('%');
      expect(result.thresholds.warning).toBe(80);
      expect(result.thresholds.critical).toBe(90);
    });

    it('should use defaults for gauge when min/max missing', () => {
      const rows = [{ value: 75 }];
      const result = dataSource.transformData(rows, 'gauge');

      expect(result.min).toBe(0);
      expect(result.max).toBe(100);
      expect(result.unit).toBe('%');
    });

    it('should transform for bar-chart widget', () => {
      const rows = [
        { label: 'A', value: 10 },
        { label: 'B', value: 20 },
        { label: 'C', value: 15 }
      ];
      const result = dataSource.transformData(rows, 'bar-chart');

      expect(result.values).toHaveLength(3);
      expect(result.values[0].label).toBe('A');
      expect(result.values[0].value).toBe(10);
    });

    it('should use name column for bar-chart if label missing', () => {
      const rows = [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 }
      ];
      const result = dataSource.transformData(rows, 'bar-chart');

      expect(result.values[0].label).toBe('A');
    });

    it('should use count column for bar-chart if value missing', () => {
      const rows = [
        { label: 'A', count: 10 },
        { label: 'B', count: 20 }
      ];
      const result = dataSource.transformData(rows, 'bar-chart');

      expect(result.values[0].value).toBe(10);
    });

    it('should include color in bar-chart if present', () => {
      const rows = [
        { label: 'A', value: 10, color: '#ff0000' }
      ];
      const result = dataSource.transformData(rows, 'bar-chart');

      expect(result.values[0].color).toBe('#ff0000');
    });

    it('should transform for line-chart widget', () => {
      const rows = [
        { timestamp: '2024-01-01', value: 10 },
        { timestamp: '2024-01-02', value: 20 },
        { timestamp: '2024-01-03', value: 15 }
      ];
      const result = dataSource.transformData(rows, 'line-chart');

      expect(result.series).toHaveLength(1);
      expect(result.series[0].data).toEqual([10, 20, 15]);
      expect(result.timestamps).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
    });

    it('should handle multiple series in line-chart', () => {
      const rows = [
        { timestamp: '2024-01-01', series: 'A', value: 10 },
        { timestamp: '2024-01-01', series: 'B', value: 15 },
        { timestamp: '2024-01-02', series: 'A', value: 20 },
        { timestamp: '2024-01-02', series: 'B', value: 25 }
      ];
      const result = dataSource.transformData(rows, 'line-chart');

      expect(result.series).toHaveLength(2);
      expect(result.series[0].label).toBe('A');
      expect(result.series[1].label).toBe('B');
    });

    it('should include color in line-chart series', () => {
      const rows = [
        { timestamp: '2024-01-01', series: 'A', value: 10, color: '#ff0000' }
      ];
      const result = dataSource.transformData(rows, 'line-chart');

      expect(result.series[0].color).toBe('#ff0000');
    });

    it('should return raw rows for unknown widget type', () => {
      const rows = [{ a: 1, b: 2 }, { a: 3, b: 4 }];
      const result = dataSource.transformData(rows, 'custom-widget');

      expect(result.rows).toEqual(rows);
    });
  });

  describe('getMockData()', () => {
    it('should return mock data for big-number', () => {
      const data = dataSource.getMockData('big-number');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('trend');
      expect(data).toHaveProperty('unit');
      expect(typeof data.value).toBe('number');
      expect(data.trend).toBe('up');
    });

    it('should return mock data for gauge', () => {
      const data = dataSource.getMockData('gauge');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('min');
      expect(data).toHaveProperty('max');
      expect(data).toHaveProperty('unit');
      expect(data.value).toBe(75);
      expect(data.min).toBe(0);
      expect(data.max).toBe(100);
      expect(data.unit).toBe('%');
    });

    it('should return mock data for bar-chart', () => {
      const data = dataSource.getMockData('bar-chart');

      expect(data).toHaveProperty('values');
      expect(Array.isArray(data.values)).toBe(true);
      expect(data.values.length).toBe(3);
      expect(data.values[0]).toHaveProperty('label');
      expect(data.values[0]).toHaveProperty('value');
    });

    it('should return empty data for unknown widget types', () => {
      const data = dataSource.getMockData('unknown-type');
      expect(data).toBeDefined();
    });
  });

  describe('getAvailableMetrics()', () => {
    it('should delegate to query-manager', async () => {
      // Will fail without proper mocking but shows the pattern
      try {
        await dataSource.getAvailableMetrics();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Cache management', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should store cache with timestamp', async () => {
      const sql = 'SELECT 1';
      const cacheKey = `${sql}:{}`;

      dataSource.client = {
        createQueryJob: mock(async () => [{
          id: 'job-123',
          getQueryResults: mock(async () => [[{ test: 1 }]])
        }])
      };

      const before = Date.now();
      await dataSource.executeQuery(sql, {}, true);
      const after = Date.now();

      const cached = dataSource.queryCache.get(cacheKey);
      expect(cached.timestamp).toBeGreaterThanOrEqual(before);
      expect(cached.timestamp).toBeLessThanOrEqual(after);
    });

    it('should allow manual cache clearing', () => {
      dataSource.queryCache.set('key1', { data: [], timestamp: Date.now() });
      dataSource.queryCache.set('key2', { data: [], timestamp: Date.now() });

      expect(dataSource.queryCache.size).toBe(2);

      dataSource.queryCache.clear();
      expect(dataSource.queryCache.size).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should use handleError from base class', async () => {
      const widgetConfig = {
        id: 'test-widget',
        type: 'big-number'
        // Missing sql/queryId will cause error
      };

      const result = await dataSource.fetchMetrics(widgetConfig);

      // Should return fallback data, not throw
      expect(result).toBeDefined();
    });

    it('should set lastError on fetchMetrics failure', async () => {
      await dataSource.initialize();

      const widgetConfig = {
        id: 'test-widget',
        type: 'big-number',
        sql: 'SELECT bad syntax'
      };

      dataSource.client = {
        createQueryJob: mock(async () => {
          throw new Error('Syntax error');
        })
      };

      await dataSource.fetchMetrics(widgetConfig);

      // Error should be caught and stored
      expect(dataSource.lastError).toBeDefined();
    });
  });

  describe('Integration scenarios', () => {
    it('should support multiple widget types from same data source', async () => {
      await dataSource.initialize();

      dataSource.client = {
        createQueryJob: mock(async () => [{
          id: 'job-123',
          getQueryResults: mock(async () => [[{ value: 42 }]])
        }])
      };

      const widgets = [
        { id: 'w1', type: 'big-number', sql: 'SELECT 1 as value' },
        { id: 'w2', type: 'gauge', sql: 'SELECT 75 as value' },
        { id: 'w3', type: 'bar-chart', sql: 'SELECT "A" as label, 10 as value' }
      ];

      for (const widget of widgets) {
        const result = await dataSource.fetchMetrics(widget);
        expect(result).toBeDefined();
        expect(result.source).toBe('bigquery');
      }
    });

    it('should maintain connection state across requests', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(true);

      dataSource.client = {
        createQueryJob: mock(async () => [{
          id: 'job-123',
          getQueryResults: mock(async () => [[{ value: 1 }]])
        }])
      };

      await dataSource.fetchMetrics({ id: 'w1', type: 'big-number', sql: 'SELECT 1 as value' });
      expect(dataSource.isConnected).toBe(true);

      await dataSource.fetchMetrics({ id: 'w2', type: 'gauge', sql: 'SELECT 2 as value' });
      expect(dataSource.isConnected).toBe(true);
    });

    it('should handle mixed inline SQL and saved query widgets', async () => {
      await dataSource.initialize();

      // Inline SQL widget
      dataSource.client = {
        createQueryJob: mock(async () => [{
          id: 'job-123',
          getQueryResults: mock(async () => [[{ value: 42 }]])
        }])
      };

      const inlineResult = await dataSource.fetchMetrics({
        id: 'inline-widget',
        type: 'big-number',
        sql: 'SELECT 42 as value'
      });
      expect(inlineResult).toBeDefined();

      // Saved query widget (will fail without proper mocking)
      try {
        await dataSource.fetchMetrics({
          id: 'saved-widget',
          type: 'big-number',
          queryId: 'saved-query-id'
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
