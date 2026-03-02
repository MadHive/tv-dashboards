// ===========================================================================
// Metrics Collection Tests — Following Elysia.js Testing Patterns
// Tests for performance metrics collection system
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { MetricsCollector } from '../../server/metrics.js';

describe('MetricsCollector', () => {
  let collector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('Constructor', () => {
    it('should initialize with zero metrics', () => {
      expect(collector.requestCount).toBe(0);
      expect(collector.errorCount).toBe(0);
      expect(collector.endpoints.size).toBe(0);
      expect(collector.dataSourceQueries.size).toBe(0);
    });

    it('should initialize cache stats', () => {
      expect(collector.cacheStats.hits).toBe(0);
      expect(collector.cacheStats.misses).toBe(0);
      expect(collector.cacheStats.sets).toBe(0);
      expect(collector.cacheStats.evictions).toBe(0);
    });

    it('should set start time', () => {
      expect(collector.startTime).toBeDefined();
      expect(collector.startTime).toBeGreaterThan(0);
    });
  });

  describe('Request Tracking', () => {
    it('should record a successful request', () => {
      collector.recordRequest('/api/config', 50, 200);

      expect(collector.requestCount).toBe(1);
      expect(collector.errorCount).toBe(0);
    });

    it('should record multiple requests', () => {
      collector.recordRequest('/api/config', 50, 200);
      collector.recordRequest('/api/metrics', 30, 200);
      collector.recordRequest('/api/config', 45, 200);

      expect(collector.requestCount).toBe(3);
    });

    it('should track errors (4xx status codes)', () => {
      collector.recordRequest('/api/notfound', 10, 404);

      expect(collector.requestCount).toBe(1);
      expect(collector.errorCount).toBe(1);
    });

    it('should track errors (5xx status codes)', () => {
      collector.recordRequest('/api/error', 100, 500);

      expect(collector.requestCount).toBe(1);
      expect(collector.errorCount).toBe(1);
    });

    it('should not count 2xx/3xx as errors', () => {
      collector.recordRequest('/api/config', 50, 200);
      collector.recordRequest('/api/redirect', 10, 301);

      expect(collector.requestCount).toBe(2);
      expect(collector.errorCount).toBe(0);
    });

    it('should group requests by endpoint', () => {
      collector.recordRequest('/api/config', 50, 200);
      collector.recordRequest('/api/config', 60, 200);
      collector.recordRequest('/api/metrics', 30, 200);

      expect(collector.endpoints.size).toBe(2);
      expect(collector.endpoints.get('/api/config').count).toBe(2);
      expect(collector.endpoints.get('/api/metrics').count).toBe(1);
    });

    it('should track total response time per endpoint', () => {
      collector.recordRequest('/api/config', 50, 200);
      collector.recordRequest('/api/config', 60, 200);

      const metrics = collector.endpoints.get('/api/config');
      expect(metrics.totalTime).toBe(110);
    });

    it('should store response times for percentile calculation', () => {
      collector.recordRequest('/api/config', 50, 200);
      collector.recordRequest('/api/config', 100, 200);
      collector.recordRequest('/api/config', 75, 200);

      const metrics = collector.endpoints.get('/api/config');
      expect(metrics.responseTimes).toEqual([50, 100, 75]);
    });

    it('should limit stored response times to 1000', () => {
      // Record 1100 requests
      for (let i = 0; i < 1100; i++) {
        collector.recordRequest('/api/test', 10, 200);
      }

      const metrics = collector.endpoints.get('/api/test');
      expect(metrics.responseTimes.length).toBe(1000);
    });
  });

  describe('Endpoint Normalization', () => {
    it('should normalize dashboard IDs', () => {
      const normalized = collector.normalizeEndpoint('/api/dashboards/dashboard-1');
      expect(normalized).toBe('/api/dashboards/:id');
    });

    it('should normalize widget IDs', () => {
      const normalized = collector.normalizeEndpoint('/api/data/widget-123');
      expect(normalized).toBe('/api/data/:id');
    });

    it('should normalize UUIDs', () => {
      const normalized = collector.normalizeEndpoint('/api/dashboards/abc123def456');
      expect(normalized).toBe('/api/dashboards/:id');
    });

    it('should remove query parameters', () => {
      const normalized = collector.normalizeEndpoint('/api/config?refresh=true');
      expect(normalized).toBe('/api/config');
    });

    it('should normalize nested IDs', () => {
      const normalized = collector.normalizeEndpoint('/api/queries/bigquery/my-query');
      expect(normalized).toBe('/api/queries/:source/:id');
    });

    it('should not normalize static paths', () => {
      const normalized = collector.normalizeEndpoint('/api/config');
      expect(normalized).toBe('/api/config');
    });
  });

  describe('Data Source Query Tracking', () => {
    it('should record data source query', () => {
      collector.recordDataSourceQuery('bigquery', 250, false);

      expect(collector.dataSourceQueries.size).toBe(1);
      expect(collector.dataSourceQueries.get('bigquery').count).toBe(1);
    });

    it('should track query duration', () => {
      collector.recordDataSourceQuery('bigquery', 250, false);
      collector.recordDataSourceQuery('bigquery', 300, false);

      const metrics = collector.dataSourceQueries.get('bigquery');
      expect(metrics.totalTime).toBe(550);
    });

    it('should track query errors', () => {
      collector.recordDataSourceQuery('bigquery', 100, true);
      collector.recordDataSourceQuery('bigquery', 150, false);

      const metrics = collector.dataSourceQueries.get('bigquery');
      expect(metrics.errors).toBe(1);
      expect(metrics.count).toBe(2);
    });

    it('should support multiple data sources', () => {
      collector.recordDataSourceQuery('bigquery', 250, false);
      collector.recordDataSourceQuery('gcp', 150, false);
      collector.recordDataSourceQuery('aws', 200, false);

      expect(collector.dataSourceQueries.size).toBe(3);
    });

    it('should store response times for percentile calculation', () => {
      collector.recordDataSourceQuery('bigquery', 100, false);
      collector.recordDataSourceQuery('bigquery', 250, false);
      collector.recordDataSourceQuery('bigquery', 150, false);

      const metrics = collector.dataSourceQueries.get('bigquery');
      expect(metrics.responseTimes).toEqual([100, 250, 150]);
    });
  });

  describe('Cache Statistics', () => {
    it('should record cache hits', () => {
      collector.recordCacheHit();
      collector.recordCacheHit();

      expect(collector.cacheStats.hits).toBe(2);
    });

    it('should record cache misses', () => {
      collector.recordCacheMiss();
      collector.recordCacheMiss();
      collector.recordCacheMiss();

      expect(collector.cacheStats.misses).toBe(3);
    });

    it('should record cache sets', () => {
      collector.recordCacheSet();

      expect(collector.cacheStats.sets).toBe(1);
    });

    it('should record cache evictions', () => {
      collector.recordCacheEviction();
      collector.recordCacheEviction();

      expect(collector.cacheStats.evictions).toBe(2);
    });

    it('should track mixed cache operations', () => {
      collector.recordCacheHit();
      collector.recordCacheMiss();
      collector.recordCacheMiss();
      collector.recordCacheSet();
      collector.recordCacheHit();

      expect(collector.cacheStats.hits).toBe(2);
      expect(collector.cacheStats.misses).toBe(2);
      expect(collector.cacheStats.sets).toBe(1);
    });
  });

  describe('Error Tracking', () => {
    it('should record errors by source', () => {
      collector.recordError('bigquery');
      collector.recordError('gcp');
      collector.recordError('bigquery');

      expect(collector.errors.get('bigquery')).toBe(2);
      expect(collector.errors.get('gcp')).toBe(1);
    });

    it('should initialize error count to 1', () => {
      collector.recordError('new-source');

      expect(collector.errors.get('new-source')).toBe(1);
    });
  });

  describe('Percentile Calculation', () => {
    it('should calculate p50 (median)', () => {
      const values = [10, 20, 30, 40, 50];
      const p50 = collector.calculatePercentile(values, 50);

      expect(p50).toBe(30);
    });

    it('should calculate p95', () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const p95 = collector.calculatePercentile(values, 95);

      expect(p95).toBe(100);
    });

    it('should calculate p99', () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const p99 = collector.calculatePercentile(values, 99);

      expect(p99).toBe(100);
    });

    it('should handle empty array', () => {
      const p95 = collector.calculatePercentile([], 95);
      expect(p95).toBe(0);
    });

    it('should handle single value', () => {
      const p95 = collector.calculatePercentile([42], 95);
      expect(p95).toBe(42);
    });

    it('should sort values before calculation', () => {
      const values = [100, 10, 50, 30, 70];
      const p50 = collector.calculatePercentile(values, 50);

      expect(p50).toBe(50);
    });
  });

  describe('Uptime Tracking', () => {
    it('should calculate uptime in seconds', () => {
      const uptime = collector.getUptime();

      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(typeof uptime).toBe('number');
    });

    it('should format uptime as human-readable string', () => {
      expect(collector.formatUptime(0)).toBe('0s');
      expect(collector.formatUptime(30)).toBe('30s');
      expect(collector.formatUptime(90)).toBe('1m 30s');
      expect(collector.formatUptime(3661)).toBe('1h 1m 1s');
      expect(collector.formatUptime(7265)).toBe('2h 1m 5s');
    });
  });

  describe('getMetrics()', () => {
    beforeEach(() => {
      // Record some sample data
      collector.recordRequest('/api/config', 50, 200);
      collector.recordRequest('/api/config', 100, 200);
      collector.recordRequest('/api/metrics', 30, 200);
      collector.recordRequest('/api/error', 200, 500);

      collector.recordDataSourceQuery('bigquery', 250, false);
      collector.recordDataSourceQuery('bigquery', 350, false);
      collector.recordDataSourceQuery('gcp', 100, true); // This records datasource:gcp error

      collector.recordCacheHit();
      collector.recordCacheHit();
      collector.recordCacheMiss();
      collector.recordCacheSet();
    });

    it('should return complete metrics object', () => {
      const metrics = collector.getMetrics();

      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('requests');
      expect(metrics).toHaveProperty('endpoints');
      expect(metrics).toHaveProperty('dataSources');
      expect(metrics).toHaveProperty('cache');
      expect(metrics).toHaveProperty('errors');
    });

    it('should include timestamp in ISO format', () => {
      const metrics = collector.getMetrics();

      expect(metrics.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include uptime data', () => {
      const metrics = collector.getMetrics();

      expect(metrics.uptime.seconds).toBeGreaterThanOrEqual(0);
      expect(metrics.uptime.formatted).toBeDefined();
    });

    it('should include request statistics', () => {
      const metrics = collector.getMetrics();

      expect(metrics.requests.total).toBe(4);
      expect(metrics.requests.errors).toBe(1);
      expect(metrics.requests.errorRate).toBeDefined();
      expect(metrics.requests.requestsPerSecond).toBeDefined();
    });

    it('should calculate error rate', () => {
      const metrics = collector.getMetrics();

      expect(metrics.requests.errorRate).toBe('25.00%');
    });

    it('should include endpoint metrics', () => {
      const metrics = collector.getMetrics();

      expect(metrics.endpoints['/api/config']).toBeDefined();
      expect(metrics.endpoints['/api/config'].requests).toBe(2);
      expect(metrics.endpoints['/api/config'].avgResponseTime).toBe(75);
    });

    it('should calculate percentiles for endpoints', () => {
      const metrics = collector.getMetrics();

      expect(metrics.endpoints['/api/config']).toHaveProperty('p95');
      expect(metrics.endpoints['/api/config']).toHaveProperty('p99');
    });

    it('should include data source metrics', () => {
      const metrics = collector.getMetrics();

      expect(metrics.dataSources.bigquery).toBeDefined();
      expect(metrics.dataSources.bigquery.queries).toBe(2);
      expect(metrics.dataSources.bigquery.avgQueryTime).toBe(300);
    });

    it('should include data source errors', () => {
      const metrics = collector.getMetrics();

      expect(metrics.dataSources.gcp.errors).toBe(1);
    });

    it('should include cache statistics', () => {
      const metrics = collector.getMetrics();

      expect(metrics.cache.hits).toBe(2);
      expect(metrics.cache.misses).toBe(1);
      expect(metrics.cache.sets).toBe(1);
      expect(metrics.cache.totalRequests).toBe(3);
    });

    it('should calculate cache hit ratio', () => {
      const metrics = collector.getMetrics();

      expect(metrics.cache.hitRatio).toBe('66.67%');
    });

    it('should include error breakdown', () => {
      const metrics = collector.getMetrics();

      expect(metrics.errors['datasource:gcp']).toBe(1);
    });

    it('should handle zero requests gracefully', () => {
      const emptyCollector = new MetricsCollector();
      const metrics = emptyCollector.getMetrics();

      expect(metrics.requests.total).toBe(0);
      expect(metrics.requests.errorRate).toBe('0%');
      expect(metrics.requests.requestsPerSecond).toBe(0);
    });

    it('should handle zero cache requests', () => {
      const emptyCollector = new MetricsCollector();
      const metrics = emptyCollector.getMetrics();

      expect(metrics.cache.hitRatio).toBe('0%');
    });
  });

  describe('reset()', () => {
    it('should reset all metrics', () => {
      collector.recordRequest('/api/config', 50, 200);
      collector.recordDataSourceQuery('bigquery', 250, false);
      collector.recordCacheHit();
      collector.recordError('test');

      collector.reset();

      expect(collector.requestCount).toBe(0);
      expect(collector.errorCount).toBe(0);
      expect(collector.endpoints.size).toBe(0);
      expect(collector.dataSourceQueries.size).toBe(0);
      expect(collector.cacheStats.hits).toBe(0);
      expect(collector.errors.size).toBe(0);
    });

    it('should reset start time', async () => {
      const originalStart = collector.startTime;

      // Wait a tiny bit
      await new Promise(resolve => setTimeout(resolve, 10));

      collector.reset();

      expect(collector.startTime).toBeGreaterThan(originalStart);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle high request volume', () => {
      // Simulate 1000 requests
      for (let i = 0; i < 1000; i++) {
        collector.recordRequest('/api/config', Math.random() * 100, 200);
      }

      const metrics = collector.getMetrics();

      expect(metrics.requests.total).toBe(1000);
      expect(metrics.endpoints['/api/config'].requests).toBe(1000);
    });

    it('should track realistic dashboard workflow', () => {
      // Load dashboard config
      collector.recordRequest('/api/config', 45, 200);

      // Fetch dashboard data
      collector.recordRequest('/api/metrics/dashboard-1', 120, 200);
      collector.recordDataSourceQuery('bigquery', 200, false);

      // Fetch widget data (cache hit)
      collector.recordRequest('/api/data/widget-1', 15, 200);
      collector.recordCacheHit();

      // Update dashboard
      collector.recordRequest('/api/dashboards/dashboard-1', 80, 200);

      const metrics = collector.getMetrics();

      expect(metrics.requests.total).toBe(4);
      expect(metrics.dataSources.bigquery.queries).toBe(1);
      expect(metrics.cache.hits).toBe(1);
    });

    it('should handle error scenarios', () => {
      // Successful request
      collector.recordRequest('/api/config', 50, 200);

      // Not found
      collector.recordRequest('/api/dashboards/missing', 20, 404);

      // Server error
      collector.recordRequest('/api/data/widget-1', 150, 500);
      collector.recordDataSourceQuery('bigquery', 150, true);
      collector.recordError('bigquery');

      const metrics = collector.getMetrics();

      expect(metrics.requests.total).toBe(3);
      expect(metrics.requests.errors).toBe(2);
      expect(metrics.requests.errorRate).toBe('66.67%');
      expect(metrics.dataSources.bigquery.errors).toBe(1);
    });
  });
});
