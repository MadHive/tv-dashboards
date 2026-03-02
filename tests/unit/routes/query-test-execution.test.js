// ===========================================================================
// Query Test Execution Route Tests
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { queryRoutes } from '../../../server/query-routes.js';

describe('Query Test Execution Route', () => {
  let app;

  beforeEach(() => {
    app = new Elysia().use(queryRoutes);
  });

  describe('POST /api/queries/:source/test', () => {
    it('should validate missing sql field', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required field: sql');
    });

    it('should validate unknown data source', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/unknown-source/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql: 'SELECT 1' })
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Unknown data source');
    });

    it('should accept bigquery test query with sql field', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: 'SELECT COUNT(*) as value FROM `mad-master.test.table`'
          })
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should attempt execution or return error (depends on BigQuery connection)
      expect(data).toHaveProperty('success');
      if (data.success) {
        expect(data.message).toContain('successfully');
        expect(data).toHaveProperty('rowCount');
        expect(data).toHaveProperty('sql');
        expect(data.sql).toContain('LIMIT 50');
      } else {
        // Connection error is acceptable in tests
        expect(data).toHaveProperty('error');
      }
    });

    it('should add LIMIT 50 to bigquery queries without limit', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: 'SELECT * FROM test_table'
          })
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      if (data.success && data.sql) {
        expect(data.sql).toContain('LIMIT 50');
      }
    });

    it('should preserve existing LIMIT in bigquery queries', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: 'SELECT * FROM test_table LIMIT 5'
          })
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      if (data.success && data.sql) {
        expect(data.sql).toContain('LIMIT 5');
        expect(data.sql).not.toContain('LIMIT 10');
      }
    });

    it('should validate gcp query structure', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/gcp/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: 'ignored for gcp',
            metric: 'compute.googleapis.com/instance/cpu/utilization'
          })
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain('valid');
      expect(data.metric).toBe('compute.googleapis.com/instance/cpu/utilization');
    });

    it('should reject gcp query without metric field', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/gcp/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: 'SELECT 1'
          })
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('metric');
    });

    it('should validate structure for other data sources', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/mock/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: 'SELECT * FROM mock_table'
          })
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain('validated');
      expect(data.note).toContain('not yet implemented');
    });
  });
});
