// ===========================================================================
// Query Routes Tests - Following Elysia.js Testing Patterns
// Uses .handle() method for unit testing without network overhead
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { queryRoutes } from '../server/query-routes.js';
import { saveQuery, deleteQuery } from '../server/query-manager.js';

describe('Query Routes (Elysia Unit Tests)', () => {
  let app;

  beforeEach(() => {
    // Create fresh Elysia instance with query routes
    app = new Elysia().use(queryRoutes);
  });

  describe('GET /api/queries/', () => {
    it('should return all queries grouped by source', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/')
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.queries).toBeObject();

      // Should have bigquery and gcp from seed data
      expect(data.queries.bigquery).toBeDefined();
      expect(data.queries.gcp).toBeDefined();
    });
  });

  describe('GET /api/queries/:source', () => {
    it('should return queries for bigquery source', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery')
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.source).toBe('bigquery');
      expect(Array.isArray(data.queries)).toBe(true);
    });

    it('should return queries for gcp source', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/gcp')
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.source).toBe('gcp');
      expect(Array.isArray(data.queries)).toBe(true);
    });

    it('should return empty array for non-existent source', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/nonexistent')
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.queries)).toBe(true);
      expect(data.queries.length).toBe(0);
    });
  });

  describe('GET /api/queries/:source/:id', () => {
    it('should return specific query by id', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery/example-count')
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.query).toBeObject();
      expect(data.query.id).toBe('example-count');
    });

    it('should return 404 for non-existent query', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery/does-not-exist')
      );

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Query not found');
    });
  });

  describe('POST /api/queries/:source', () => {
    it('should create new BigQuery query with valid data', async () => {
      const queryData = {
        id: 'test-api-create',
        name: 'Test API Create',
        description: 'Testing query creation via API',
        sql: 'SELECT 1 as value',
        widgetTypes: ['big-number']
      };

      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(queryData)
        })
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.query).toBeObject();
      expect(data.query.id).toBe('test-api-create');
      expect(data.query.sql).toBe('SELECT 1 as value');

      // Clean up
      await deleteQuery('bigquery', 'test-api-create');
    });

    it('should create new GCP query with valid data', async () => {
      const queryData = {
        id: 'test-gcp-api-create',
        name: 'Test GCP API Create',
        description: 'Testing GCP query creation',
        metricType: 'run.googleapis.com/request_count',
        project: 'mad-master',
        timeWindow: 10,
        widgetTypes: ['big-number']
      };

      const response = await app.handle(
        new Request('http://localhost/api/queries/gcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(queryData)
        })
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.query).toBeObject();
      expect(data.query.id).toBe('test-gcp-api-create');
      expect(data.query.metricType).toBe('run.googleapis.com/request_count');

      // Clean up
      await deleteQuery('gcp', 'test-gcp-api-create');
    });

    it('should return 400 when id is missing', async () => {
      const queryData = {
        name: 'Missing ID',
        sql: 'SELECT 1'
      };

      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(queryData)
        })
      );

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields: id, name');
    });

    it('should return 400 when name is missing', async () => {
      const queryData = {
        id: 'missing-name',
        sql: 'SELECT 1'
      };

      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(queryData)
        })
      );

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields: id, name');
    });

    it('should return 400 when BigQuery query missing sql field', async () => {
      const queryData = {
        id: 'missing-sql',
        name: 'Missing SQL'
      };

      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(queryData)
        })
      );

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('BigQuery queries require sql field');
    });

    it('should return 400 when GCP query missing metricType field', async () => {
      const queryData = {
        id: 'missing-metric',
        name: 'Missing Metric Type',
        project: 'mad-master'
      };

      const response = await app.handle(
        new Request('http://localhost/api/queries/gcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(queryData)
        })
      );

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('GCP queries require metricType field');
    });
  });

  describe('PUT /api/queries/:source/:id', () => {
    it('should update existing query', async () => {
      // Create initial query
      await saveQuery('bigquery', {
        id: 'test-update',
        name: 'Original Name',
        sql: 'SELECT 1',
        widgetTypes: ['big-number']
      });

      // Update it
      const updateData = {
        name: 'Updated Name',
        sql: 'SELECT 2'
      };

      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery/test-update', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        })
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.query.name).toBe('Updated Name');
      expect(data.query.sql).toBe('SELECT 2');

      // Clean up
      await deleteQuery('bigquery', 'test-update');
    });

    it('should return 404 when updating non-existent query', async () => {
      const updateData = {
        name: 'Updated Name'
      };

      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery/does-not-exist', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        })
      );

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Query not found');
    });
  });

  describe('DELETE /api/queries/:source/:id', () => {
    it('should delete existing query', async () => {
      // Create query to delete
      await saveQuery('bigquery', {
        id: 'test-delete-route',
        name: 'Delete Me',
        sql: 'SELECT 1',
        widgetTypes: ['big-number']
      });

      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery/test-delete-route', {
          method: 'DELETE'
        })
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.deleted).toBeObject();
      expect(data.deleted.id).toBe('test-delete-route');
    });

    it('should return 500 when deleting non-existent query', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery/does-not-exist', {
          method: 'DELETE'
        })
      );

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in POST request', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/bigquery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: '{invalid json}'
        })
      );

      // Elysia should handle this gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
