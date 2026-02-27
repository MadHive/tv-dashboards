// ===========================================================================
// Data Source Routes Tests — Following Elysia.js Testing Patterns
// Tests for data source registry API endpoints
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { createTestRequest, createJsonPostRequest } from '../../helpers/test-app.js';
import { mockDataSourceRegistry, createMockDataSource } from '../../helpers/mocks.js';

describe('Data Source Routes (Elysia Unit Tests)', () => {
  let app;
  let registry;

  beforeEach(() => {
    // Create mock data sources
    const gcpSource = createMockDataSource('gcp', {
      fetchMetrics: async () => ({ value: 100 }),
      metrics: [
        { id: 'request_count', name: 'Request Count' },
        { id: 'response_time', name: 'Response Time' }
      ]
    });
    gcpSource.isConnected = true;

    const mockSource = createMockDataSource('mock', {
      fetchMetrics: async () => ({ value: 200 })
    });
    mockSource.isConnected = true;

    const bigquerySource = createMockDataSource('bigquery', {
      fetchMetrics: async () => ({ value: 300 })
    });
    bigquerySource.isConnected = false; // Not connected

    registry = mockDataSourceRegistry([gcpSource, mockSource, bigquerySource]);

    // Create test app with data source routes
    app = new Elysia()
      .get('/api/data-sources', () => {
        try {
          const sources = registry.getAllSources();
          return {
            success: true,
            sources: sources.map(s => ({
              name: s.name,
              isConnected: s.isConnected,
              isReady: s.isReady()
            }))
          };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .get('/api/data-sources/schemas', () => {
        try {
          return { success: true, schemas: registry.getSchemas() };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .get('/api/data-sources/health', () => {
        try {
          return { success: true, health: registry.getHealth() };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .get('/api/data-sources/:name/metrics', ({ params }) => {
        try {
          const metrics = registry.getAvailableMetrics(params.name);
          return { success: true, metrics };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 404, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .post('/api/data-sources/:name/test', async ({ params }) => {
        try {
          const connected = await registry.testConnection(params.name);
          return { success: true, connected };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'content-type': 'application/json' } }
          );
        }
      });
  });

  describe('GET /api/data-sources', () => {
    it('should list all registered sources', async () => {
      const request = createTestRequest('/api/data-sources');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.sources).toBeArray();
      expect(data.sources.length).toBe(3);
    });

    it('should include connection status', async () => {
      const request = createTestRequest('/api/data-sources');
      const response = await app.handle(request);

      const data = await response.json();
      const gcpSource = data.sources.find(s => s.name === 'gcp');

      expect(gcpSource).toBeDefined();
      expect(gcpSource.isConnected).toBe(true);
    });

    it('should include ready state', async () => {
      const request = createTestRequest('/api/data-sources');
      const response = await app.handle(request);

      const data = await response.json();
      const source = data.sources[0];

      expect(source.isReady).toBeDefined();
      expect(typeof source.isReady).toBe('boolean');
    });

    it('should show different connection states', async () => {
      const request = createTestRequest('/api/data-sources');
      const response = await app.handle(request);

      const data = await response.json();
      const connectedSource = data.sources.find(s => s.name === 'gcp');
      const disconnectedSource = data.sources.find(s => s.name === 'bigquery');

      expect(connectedSource.isConnected).toBe(true);
      expect(disconnectedSource.isConnected).toBe(false);
    });
  });

  describe('GET /api/data-sources/schemas', () => {
    it('should return config schemas for all sources', async () => {
      const request = createTestRequest('/api/data-sources/schemas');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.schemas).toBeObject();
    });

    it('should include schema for each registered source', async () => {
      const request = createTestRequest('/api/data-sources/schemas');
      const response = await app.handle(request);

      const data = await response.json();

      expect(data.schemas.gcp).toBeDefined();
      expect(data.schemas.mock).toBeDefined();
      expect(data.schemas.bigquery).toBeDefined();
    });

    it('should return valid schema structure', async () => {
      const request = createTestRequest('/api/data-sources/schemas');
      const response = await app.handle(request);

      const data = await response.json();
      const schema = data.schemas.gcp;

      expect(schema).toBeObject();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
    });
  });

  describe('GET /api/data-sources/health', () => {
    it('should return health status for all sources', async () => {
      const request = createTestRequest('/api/data-sources/health');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.health).toBeObject();
    });

    it('should include connection and ready status', async () => {
      const request = createTestRequest('/api/data-sources/health');
      const response = await app.handle(request);

      const data = await response.json();
      const gcpHealth = data.health.gcp;

      expect(gcpHealth).toBeDefined();
      expect(gcpHealth.connected).toBeDefined();
      expect(gcpHealth.ready).toBeDefined();
    });

    it('should show health for all sources', async () => {
      const request = createTestRequest('/api/data-sources/health');
      const response = await app.handle(request);

      const data = await response.json();

      expect(Object.keys(data.health).length).toBe(3);
      expect(data.health.gcp).toBeDefined();
      expect(data.health.mock).toBeDefined();
      expect(data.health.bigquery).toBeDefined();
    });
  });

  describe('GET /api/data-sources/:name/metrics', () => {
    it('should return available metrics for source', async () => {
      const request = createTestRequest('/api/data-sources/gcp/metrics');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.metrics).toBeArray();
      expect(data.metrics.length).toBeGreaterThan(0);
    });

    it('should include metric details', async () => {
      const request = createTestRequest('/api/data-sources/gcp/metrics');
      const response = await app.handle(request);

      const data = await response.json();
      const metric = data.metrics[0];

      expect(metric.id).toBeDefined();
      expect(metric.name).toBeDefined();
    });

    it('should return 404 for unknown source', async () => {
      const request = createTestRequest('/api/data-sources/nonexistent/metrics');
      const response = await app.handle(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should handle sources with default metrics', async () => {
      const request = createTestRequest('/api/data-sources/mock/metrics');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.metrics).toBeArray();
    });
  });

  describe('POST /api/data-sources/:name/test', () => {
    it('should test connection for source', async () => {
      const request = createJsonPostRequest('/api/data-sources/gcp/test', {});
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.connected).toBeDefined();
    });

    it('should return connection status', async () => {
      const request = createJsonPostRequest('/api/data-sources/gcp/test', {});
      const response = await app.handle(request);

      const data = await response.json();
      expect(typeof data.connected).toBe('boolean');
    });

    it('should handle connection failures', async () => {
      const request = createJsonPostRequest('/api/data-sources/bigquery/test', {});
      const response = await app.handle(request);

      const data = await response.json();
      // BigQuery source is not connected
      expect(data.connected).toBe(false);
    });

    it('should return error for unknown source', async () => {
      const request = createJsonPostRequest('/api/data-sources/unknown/test', {});
      const response = await app.handle(request);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle registry errors gracefully', async () => {
      // Simulate registry error by clearing sources
      registry.sources.clear();

      const request = createTestRequest('/api/data-sources');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.sources).toBeArray();
      expect(data.sources.length).toBe(0);
    });

    it('should validate source name in metrics endpoint', async () => {
      const request = createTestRequest('/api/data-sources/invalid-name-123/metrics');
      const response = await app.handle(request);

      expect(response.status).toBe(404);
    });

    it('should validate source name in test endpoint', async () => {
      const request = createJsonPostRequest('/api/data-sources/invalid-name/test', {});
      const response = await app.handle(request);

      expect(response.status).toBe(500);
    });
  });
});
