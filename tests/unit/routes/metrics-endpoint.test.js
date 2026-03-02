// ===========================================================================
// Metrics Endpoint Tests — Following Elysia.js Testing Patterns
// Tests for /api/metrics endpoint
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { createTestRequest } from '../../helpers/test-app.js';
import { MetricsCollector } from '../../../server/metrics.js';

describe('Metrics Endpoint (Elysia Unit Tests)', () => {
  let app;
  let collector;

  beforeEach(() => {
    // Create fresh collector for each test
    collector = new MetricsCollector();

    // Create test app with metrics endpoint
    app = new Elysia()
      .get('/api/metrics', () => {
        try {
          return {
            success: true,
            metrics: collector.getMetrics()
          };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'content-type': 'application/json' } }
          );
        }
      });
  });

  describe('GET /api/metrics', () => {
    it('should return 200 OK', async () => {
      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      expect(response.status).toBe(200);
    });

    it('should return JSON content type', async () => {
      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('json');
    });

    it('should return success: true', async () => {
      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should include metrics object', async () => {
      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const data = await response.json();
      expect(data.metrics).toBeDefined();
      expect(typeof data.metrics).toBe('object');
    });

    it('should include all required metric fields', async () => {
      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const data = await response.json();
      const { metrics } = data;

      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('requests');
      expect(metrics).toHaveProperty('endpoints');
      expect(metrics).toHaveProperty('dataSources');
      expect(metrics).toHaveProperty('cache');
      expect(metrics).toHaveProperty('errors');
    });

    it('should include timestamp in ISO format', async () => {
      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const data = await response.json();
      const { metrics } = data;

      expect(metrics.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include uptime data', async () => {
      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const data = await response.json();
      const { metrics } = data;

      expect(metrics.uptime.seconds).toBeGreaterThanOrEqual(0);
      expect(metrics.uptime.formatted).toBeDefined();
    });

    it('should include request statistics', async () => {
      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const data = await response.json();
      const { metrics } = data;

      expect(metrics.requests).toHaveProperty('total');
      expect(metrics.requests).toHaveProperty('errors');
      expect(metrics.requests).toHaveProperty('errorRate');
      expect(metrics.requests).toHaveProperty('requestsPerSecond');
    });

    it('should include cache statistics', async () => {
      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const data = await response.json();
      const { metrics } = data;

      expect(metrics.cache).toHaveProperty('hits');
      expect(metrics.cache).toHaveProperty('misses');
      expect(metrics.cache).toHaveProperty('sets');
      expect(metrics.cache).toHaveProperty('hitRatio');
      expect(metrics.cache).toHaveProperty('totalRequests');
    });

    it('should return empty metrics on fresh server', async () => {
      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const data = await response.json();
      const { metrics } = data;

      expect(metrics.requests.total).toBe(0);
      expect(metrics.requests.errors).toBe(0);
      expect(metrics.cache.hits).toBe(0);
      expect(metrics.cache.misses).toBe(0);
    });

    it('should reflect recorded metrics', async () => {
      // Record some metrics
      collector.recordRequest('/api/config', 50, 200);
      collector.recordRequest('/api/config', 100, 200);
      collector.recordCacheHit();

      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const data = await response.json();
      const { metrics } = data;

      expect(metrics.requests.total).toBe(2);
      expect(metrics.cache.hits).toBe(1);
    });

    it('should include endpoint breakdown', async () => {
      // Record metrics for different endpoints
      collector.recordRequest('/api/config', 50, 200);
      collector.recordRequest('/api/metrics', 30, 200);
      collector.recordRequest('/api/config', 60, 200);

      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const data = await response.json();
      const { metrics } = data;

      expect(metrics.endpoints['/api/config']).toBeDefined();
      expect(metrics.endpoints['/api/config'].requests).toBe(2);
      expect(metrics.endpoints['/api/metrics']).toBeDefined();
      expect(metrics.endpoints['/api/metrics'].requests).toBe(1);
    });

    it('should include data source metrics', async () => {
      collector.recordDataSourceQuery('bigquery', 250, false);
      collector.recordDataSourceQuery('gcp', 150, false);

      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const data = await response.json();
      const { metrics } = data;

      expect(metrics.dataSources.bigquery).toBeDefined();
      expect(metrics.dataSources.bigquery.queries).toBe(1);
      expect(metrics.dataSources.gcp).toBeDefined();
      expect(metrics.dataSources.gcp.queries).toBe(1);
    });

    it('should be idempotent', async () => {
      collector.recordRequest('/api/test', 50, 200);

      const request1 = createTestRequest('/api/metrics');
      const request2 = createTestRequest('/api/metrics');

      const response1 = await app.handle(request1);
      const response2 = await app.handle(request2);

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.metrics.requests.total).toBe(data2.metrics.requests.total);
    });

    it('should respond quickly', async () => {
      const start = Date.now();

      const request = createTestRequest('/api/metrics');
      await app.handle(request);

      const duration = Date.now() - start;

      // Metrics endpoint should be fast (< 100ms)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Performance', () => {
    it('should handle high metric volume', async () => {
      // Record many metrics
      for (let i = 0; i < 1000; i++) {
        collector.recordRequest('/api/test', Math.random() * 100, 200);
      }

      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.metrics.requests.total).toBe(1000);
    });

    it('should not impact request handling', async () => {
      // The metrics endpoint should be lightweight
      const startMemory = process.memoryUsage().heapUsed;

      const request = createTestRequest('/api/metrics');
      await app.handle(request);

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      // Should use less than 1MB for the request
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });
  });

  describe('Monitoring Integration', () => {
    it('should provide machine-readable data', async () => {
      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const data = await response.json();

      // All numeric fields should be numbers or numeric strings
      expect(typeof data.metrics.requests.total).toBe('number');
      expect(typeof data.metrics.uptime.seconds).toBe('number');
    });

    it('should include percentiles for performance analysis', async () => {
      collector.recordRequest('/api/test', 50, 200);
      collector.recordRequest('/api/test', 100, 200);
      collector.recordRequest('/api/test', 75, 200);

      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const data = await response.json();
      const { metrics } = data;

      expect(metrics.endpoints['/api/test']).toHaveProperty('p95');
      expect(metrics.endpoints['/api/test']).toHaveProperty('p99');
    });

    it('should track cache efficiency', async () => {
      collector.recordCacheHit();
      collector.recordCacheHit();
      collector.recordCacheMiss();

      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const data = await response.json();
      const { metrics } = data;

      expect(metrics.cache.hitRatio).toBe('66.67%');
    });

    it('should provide error tracking by source', async () => {
      collector.recordError('bigquery');
      collector.recordError('gcp');
      collector.recordError('bigquery');

      const request = createTestRequest('/api/metrics');
      const response = await app.handle(request);

      const data = await response.json();
      const { metrics } = data;

      expect(metrics.errors.bigquery).toBe(2);
      expect(metrics.errors.gcp).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle collector errors gracefully', async () => {
      // Create app with broken collector
      const brokenApp = new Elysia()
        .get('/api/metrics', () => {
          throw new Error('Collector unavailable');
        });

      const request = createTestRequest('/api/metrics');
      const response = await brokenApp.handle(request);

      // Should return 500 but not crash
      expect(response.status).toBe(500);
    });
  });
});
