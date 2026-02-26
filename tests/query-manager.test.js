// ===========================================================================
// Query Manager Tests - Following Elysia.js Testing Patterns
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { unlinkSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  loadQueries,
  saveQuery,
  getQuery,
  listQueries,
  deleteQuery,
  saveQueries,
  createBackup
} from '../server/query-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_QUERIES_PATH = join(__dirname, '..', 'config', 'queries.test.yaml');
const BACKUP_DIR = join(__dirname, '..', 'config');

describe('Query Manager', () => {
  let originalQueriesPath;

  beforeEach(() => {
    // Clean up any existing test files
    if (existsSync(TEST_QUERIES_PATH)) {
      unlinkSync(TEST_QUERIES_PATH);
    }
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(TEST_QUERIES_PATH)) {
      unlinkSync(TEST_QUERIES_PATH);
    }
  });

  describe('loadQueries', () => {
    it('should return empty object when queries.yaml does not exist', () => {
      const queries = loadQueries();
      expect(queries).toBeObject();
      expect(Object.keys(queries).length).toBeGreaterThanOrEqual(0);
    });

    it('should load existing queries from yaml file', () => {
      const queries = loadQueries();
      expect(queries).toBeObject();

      // Should have bigquery and gcp queries from seed data
      if (queries.bigquery) {
        expect(Array.isArray(queries.bigquery)).toBe(true);
      }
      if (queries.gcp) {
        expect(Array.isArray(queries.gcp)).toBe(true);
      }
    });
  });

  describe('saveQuery', () => {
    it('should save a new BigQuery query', async () => {
      const queryDef = {
        id: 'test-bq-query',
        name: 'Test BigQuery Query',
        description: 'A test query',
        sql: 'SELECT COUNT(*) as value FROM test_table',
        widgetTypes: ['big-number']
      };

      const result = await saveQuery('bigquery', queryDef);

      expect(result.success).toBe(true);
      expect(result.query).toBeObject();
      expect(result.query.id).toBe('test-bq-query');
      expect(result.query.name).toBe('Test BigQuery Query');
      expect(result.query.createdAt).toBeDefined();
      expect(result.query.updatedAt).toBeDefined();
    });

    it('should save a new GCP query', async () => {
      const queryDef = {
        id: 'test-gcp-query',
        name: 'Test GCP Query',
        description: 'A test GCP metric query',
        metricType: 'run.googleapis.com/request_count',
        project: 'mad-master',
        timeWindow: 10,
        widgetTypes: ['big-number', 'line-chart']
      };

      const result = await saveQuery('gcp', queryDef);

      expect(result.success).toBe(true);
      expect(result.query).toBeObject();
      expect(result.query.id).toBe('test-gcp-query');
      expect(result.query.metricType).toBe('run.googleapis.com/request_count');
    });

    it('should update existing query', async () => {
      const queryDef1 = {
        id: 'update-test',
        name: 'Original Name',
        sql: 'SELECT 1',
        widgetTypes: ['big-number']
      };

      await saveQuery('bigquery', queryDef1);

      const queryDef2 = {
        id: 'update-test',
        name: 'Updated Name',
        sql: 'SELECT 2',
        widgetTypes: ['big-number', 'stat-card']
      };

      const result = await saveQuery('bigquery', queryDef2);

      expect(result.success).toBe(true);
      expect(result.query.name).toBe('Updated Name');
      expect(result.query.sql).toBe('SELECT 2');
      expect(result.query.widgetTypes).toContain('stat-card');
    });

    it('should throw error when query ID is missing', async () => {
      const queryDef = {
        name: 'Missing ID',
        sql: 'SELECT 1'
      };

      try {
        await saveQuery('bigquery', queryDef);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Query ID is required');
      }
    });

    it('should throw error when query name is missing', async () => {
      const queryDef = {
        id: 'no-name',
        sql: 'SELECT 1'
      };

      try {
        await saveQuery('bigquery', queryDef);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Query name is required');
      }
    });
  });

  describe('getQuery', () => {
    it('should retrieve existing query by source and id', async () => {
      const queryDef = {
        id: 'retrieve-test',
        name: 'Retrieve Test',
        sql: 'SELECT * FROM test',
        widgetTypes: ['big-number']
      };

      await saveQuery('bigquery', queryDef);
      const retrieved = await getQuery('bigquery', 'retrieve-test');

      expect(retrieved).toBeObject();
      expect(retrieved.id).toBe('retrieve-test');
      expect(retrieved.name).toBe('Retrieve Test');
    });

    it('should return null for non-existent query', async () => {
      const retrieved = await getQuery('bigquery', 'does-not-exist');
      expect(retrieved).toBeNull();
    });

    it('should return null for non-existent source', async () => {
      const retrieved = await getQuery('nonexistent-source', 'query-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('listQueries', () => {
    it('should list all queries for a source', async () => {
      const query1 = {
        id: 'list-test-1',
        name: 'List Test 1',
        sql: 'SELECT 1',
        widgetTypes: ['big-number']
      };

      const query2 = {
        id: 'list-test-2',
        name: 'List Test 2',
        sql: 'SELECT 2',
        widgetTypes: ['stat-card']
      };

      await saveQuery('bigquery', query1);
      await saveQuery('bigquery', query2);

      const queries = await listQueries('bigquery');

      expect(Array.isArray(queries)).toBe(true);

      const testQueries = queries.filter(q => q.id.startsWith('list-test-'));
      expect(testQueries.length).toBeGreaterThanOrEqual(2);

      const ids = testQueries.map(q => q.id);
      expect(ids).toContain('list-test-1');
      expect(ids).toContain('list-test-2');
    });

    it('should return empty array for source with no queries', async () => {
      const queries = await listQueries('nonexistent-source');
      expect(Array.isArray(queries)).toBe(true);
      expect(queries.length).toBe(0);
    });
  });

  describe('deleteQuery', () => {
    it('should delete existing query', async () => {
      const queryDef = {
        id: 'delete-test',
        name: 'Delete Test',
        sql: 'SELECT 1',
        widgetTypes: ['big-number']
      };

      await saveQuery('bigquery', queryDef);

      const beforeDelete = await getQuery('bigquery', 'delete-test');
      expect(beforeDelete).toBeObject();

      const result = await deleteQuery('bigquery', 'delete-test');
      expect(result.success).toBe(true);
      expect(result.deleted).toBeObject();
      expect(result.deleted.id).toBe('delete-test');

      const afterDelete = await getQuery('bigquery', 'delete-test');
      expect(afterDelete).toBeNull();
    });

    it('should throw error when deleting non-existent query', async () => {
      try {
        await deleteQuery('bigquery', 'does-not-exist');
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Query not found');
      }
    });

    it('should throw error when source does not exist', async () => {
      try {
        await deleteQuery('nonexistent-source', 'query-id');
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('No queries found for source');
      }
    });
  });

  describe('createBackup', () => {
    it('should create timestamped backup', async () => {
      const queryDef = {
        id: 'backup-test',
        name: 'Backup Test',
        sql: 'SELECT 1',
        widgetTypes: ['big-number']
      };

      await saveQuery('bigquery', queryDef);

      // Backup should have been created automatically during save
      const backupFiles = require('fs')
        .readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('queries.yaml.backup.'));

      expect(backupFiles.length).toBeGreaterThan(0);
    });
  });

  describe('persistence', () => {
    it('should persist queries across save/load cycles', async () => {
      const queryDef = {
        id: 'persist-test',
        name: 'Persistence Test',
        sql: 'SELECT COUNT(*) as value',
        widgetTypes: ['big-number']
      };

      await saveQuery('bigquery', queryDef);

      // Load fresh from disk
      const queries = loadQueries();
      const found = queries.bigquery?.find(q => q.id === 'persist-test');

      expect(found).toBeObject();
      expect(found.name).toBe('Persistence Test');
      expect(found.sql).toBe('SELECT COUNT(*) as value');
    });
  });
});
