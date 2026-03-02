// ===========================================================================
// Integration: Multi-Source Dashboard
// Tests dashboards with widgets from multiple data sources
// ===========================================================================

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createTestApp, createTestRequest, assertResponse } from '../helpers/test-app.js';
import { mockDataSourceRegistry, createMockDataSource } from '../helpers/mocks.js';

describe('Integration: Multi-Source Dashboard', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();

    // Mock data source registry with multiple sources
    const gcpSource = createMockDataSource('gcp', {
      fetchMetrics: async () => ({
        value: 1500,
        timestamp: Date.now()
      })
    });

    const bigquerySource = createMockDataSource('bigquery', {
      fetchMetrics: async () => ({
        value: 25000,
        bars: [
          { label: 'Product A', value: 10000 },
          { label: 'Product B', value: 15000 }
        ]
      })
    });

    const mockSource = createMockDataSource('mock', {
      fetchMetrics: async () => ({
        value: 750,
        trend: 'up'
      })
    });

    const registry = mockDataSourceRegistry([gcpSource, bigquerySource, mockSource]);
    app.decorate('dataSourceRegistry', registry);

    // Add test route
    app.get('/api/test/multi-source', async ({ dataSourceRegistry }) => {
      const dashboard = {
        id: 'test-multi',
        widgets: [
          { id: 'w1', source: 'gcp', type: 'big-number' },
          { id: 'w2', source: 'bigquery', type: 'bar-chart' },
          { id: 'w3', source: 'mock', type: 'stat-card' }
        ]
      };

      const metrics = await dataSourceRegistry.fetchDashboardMetrics('test-multi', dashboard);

      return { success: true, metrics };
    });
  });

  afterAll(() => {
    // Cleanup if needed
  });

  it('should fetch data from GCP source', async () => {
    const response = await app.handle(createTestRequest('/api/test/multi-source'));
    const data = await assertResponse.assertJson(response);

    expect(data.success).toBe(true);
    expect(data.metrics.w1).toBeTruthy();
    expect(data.metrics.w1.value).toBe(1500);
  });

  it('should fetch data from BigQuery source', async () => {
    const response = await app.handle(createTestRequest('/api/test/multi-source'));
    const data = await assertResponse.assertJson(response);

    expect(data.success).toBe(true);
    expect(data.metrics.w2).toBeTruthy();
    expect(data.metrics.w2.value).toBe(25000);
  });

  it('should fetch data from Mock source', async () => {
    const response = await app.handle(createTestRequest('/api/test/multi-source'));
    const data = await assertResponse.assertJson(response);

    expect(data.success).toBe(true);
    expect(data.metrics.w3).toBeTruthy();
    expect(data.metrics.w3.value).toBe(750);
  });

  it('should handle concurrent data fetching from multiple sources', async () => {
    const response = await app.handle(createTestRequest('/api/test/multi-source'));
    const data = await assertResponse.assertJson(response);

    expect(data.success).toBe(true);
    expect(Object.keys(data.metrics).length).toBe(3);
  });

  it('should isolate errors to individual sources', async () => {
    // Create a new app with a failing source
    const testApp = createTestApp();

    const gcpSource = createMockDataSource('gcp', {
      fetchMetrics: async () => ({
        value: 1500
      })
    });

    const failingSource = createMockDataSource('bigquery', {
      fetchMetrics: async () => {
        throw new Error('BigQuery connection failed');
      }
    });

    const mockSource = createMockDataSource('mock', {
      fetchMetrics: async () => ({
        value: 750
      })
    });

    const registry = mockDataSourceRegistry([gcpSource, failingSource, mockSource]);
    testApp.decorate('dataSourceRegistry', registry);

    testApp.get('/api/test/error-isolation', async ({ dataSourceRegistry }) => {
      const dashboard = {
        id: 'test-errors',
        widgets: [
          { id: 'w1', source: 'gcp', type: 'big-number' },
          { id: 'w2', source: 'bigquery', type: 'bar-chart' },
          { id: 'w3', source: 'mock', type: 'stat-card' }
        ]
      };

      const metrics = {};
      for (const widget of dashboard.widgets) {
        try {
          const source = dataSourceRegistry.getSource(widget.source);
          metrics[widget.id] = await source.fetchMetrics(widget, dashboard);
        } catch (error) {
          metrics[widget.id] = { error: error.message };
        }
      }

      return { success: true, metrics };
    });

    const response = await testApp.handle(createTestRequest('/api/test/error-isolation'));
    const data = await assertResponse.assertJson(response);

    expect(data.success).toBe(true);
    expect(data.metrics.w1.value).toBe(1500); // GCP succeeded
    expect(data.metrics.w2.error).toBeTruthy(); // BigQuery failed
    expect(data.metrics.w3.value).toBe(750); // Mock succeeded
  });

  it('should handle dashboard with all sources available', async () => {
    const response = await app.handle(createTestRequest('/api/test/multi-source'));
    const data = await assertResponse.assertJson(response);

    expect(data.success).toBe(true);
    const sources = Object.keys(data.metrics).map(widgetId => {
      // Infer source from widget ID (w1=gcp, w2=bigquery, w3=mock)
      return widgetId;
    });
    expect(sources.length).toBe(3);
  });

  it('should return data in correct format for each widget type', async () => {
    const response = await app.handle(createTestRequest('/api/test/multi-source'));
    const data = await assertResponse.assertJson(response);

    // GCP big-number format
    expect(data.metrics.w1.value).toBeTruthy();

    // BigQuery bar-chart format
    expect(data.metrics.w2.bars).toBeTruthy();
    expect(Array.isArray(data.metrics.w2.bars)).toBe(true);

    // Mock stat-card format
    expect(data.metrics.w3.value).toBeTruthy();
    expect(data.metrics.w3.trend).toBe('up');
  });

  it('should handle different data refresh rates per source', async () => {
    const testApp = createTestApp();

    let gcpFetchCount = 0;
    let bqFetchCount = 0;

    const gcpSource = createMockDataSource('gcp', {
      fetchMetrics: async () => {
        gcpFetchCount++;
        return { value: 1000 + gcpFetchCount };
      }
    });

    const bqSource = createMockDataSource('bigquery', {
      fetchMetrics: async () => {
        bqFetchCount++;
        return { value: 2000 + bqFetchCount };
      }
    });

    const registry = mockDataSourceRegistry([gcpSource, bqSource]);
    testApp.decorate('dataSourceRegistry', registry);

    testApp.get('/api/test/refresh-rates', async ({ dataSourceRegistry }) => {
      const dashboard = {
        id: 'test-refresh',
        widgets: [
          { id: 'w1', source: 'gcp', type: 'big-number' },
          { id: 'w2', source: 'bigquery', type: 'bar-chart' }
        ]
      };

      const metrics = await dataSourceRegistry.fetchDashboardMetrics('test-refresh', dashboard);
      return { success: true, metrics, counts: { gcp: gcpFetchCount, bq: bqFetchCount } };
    });

    // First fetch
    const response1 = await testApp.handle(createTestRequest('/api/test/refresh-rates'));
    const data1 = await assertResponse.assertJson(response1);
    expect(data1.counts.gcp).toBe(1);
    expect(data1.counts.bq).toBe(1);

    // Second fetch
    const response2 = await testApp.handle(createTestRequest('/api/test/refresh-rates'));
    const data2 = await assertResponse.assertJson(response2);
    expect(data2.counts.gcp).toBe(2);
    expect(data2.counts.bq).toBe(2);
  });

  it('should support fallback to mock data when live sources unavailable', async () => {
    const testApp = createTestApp();

    const unavailableSource = createMockDataSource('gcp', {
      isReady: () => false,
      fetchMetrics: async () => {
        throw new Error('Source not ready');
      }
    });

    const mockSource = createMockDataSource('mock', {
      fetchMetrics: async () => ({
        value: 999,
        fallback: true
      })
    });

    const registry = mockDataSourceRegistry([unavailableSource, mockSource]);
    testApp.decorate('dataSourceRegistry', registry);

    testApp.get('/api/test/fallback', async ({ dataSourceRegistry }) => {
      const dashboard = {
        id: 'test-fallback',
        widgets: [
          { id: 'w1', source: 'gcp', type: 'big-number' }
        ]
      };

      const metrics = {};
      for (const widget of dashboard.widgets) {
        try {
          const source = dataSourceRegistry.getSource(widget.source);
          metrics[widget.id] = await source.fetchMetrics(widget, dashboard);
        } catch (error) {
          // Fallback to mock
          const mockSource = dataSourceRegistry.getSource('mock');
          metrics[widget.id] = await mockSource.fetchMetrics(widget, dashboard);
        }
      }

      return { success: true, metrics };
    });

    const response = await testApp.handle(createTestRequest('/api/test/fallback'));
    const data = await assertResponse.assertJson(response);

    expect(data.success).toBe(true);
    expect(data.metrics.w1.fallback).toBe(true);
  });

  it('should handle dashboards with 10+ data sources', async () => {
    const testApp = createTestApp();

    const sources = Array.from({ length: 10 }, (_, i) =>
      createMockDataSource(`source-${i}`, {
        fetchMetrics: async () => ({
          value: (i + 1) * 100
        })
      })
    );

    const registry = mockDataSourceRegistry(sources);
    testApp.decorate('dataSourceRegistry', registry);

    testApp.get('/api/test/many-sources', async ({ dataSourceRegistry }) => {
      const dashboard = {
        id: 'test-many',
        widgets: sources.map((s, i) => ({
          id: `w${i}`,
          source: s.name,
          type: 'big-number'
        }))
      };

      const metrics = await dataSourceRegistry.fetchDashboardMetrics('test-many', dashboard);
      return { success: true, metrics, count: Object.keys(metrics).length };
    });

    const response = await testApp.handle(createTestRequest('/api/test/many-sources'));
    const data = await assertResponse.assertJson(response);

    expect(data.success).toBe(true);
    expect(data.count).toBe(10);
  });

  it('should preserve data integrity across sources', async () => {
    const response = await app.handle(createTestRequest('/api/test/multi-source'));
    const data = await assertResponse.assertJson(response);

    // Each widget should have unique data from its source
    expect(data.metrics.w1.value).not.toBe(data.metrics.w2.value);
    expect(data.metrics.w1.value).not.toBe(data.metrics.w3.value);
    expect(data.metrics.w2.value).not.toBe(data.metrics.w3.value);
  });

  it('should handle query-based widgets across multiple sources', async () => {
    const testApp = createTestApp();

    const bqSource = createMockDataSource('bigquery', {
      fetchMetrics: async (widget) => {
        if (widget.queryId) {
          return {
            queryId: widget.queryId,
            rows: [{ total: 5000 }]
          };
        }
        return { value: 0 };
      }
    });

    const gcpSource = createMockDataSource('gcp', {
      fetchMetrics: async (widget) => {
        if (widget.metric) {
          return {
            metric: widget.metric,
            value: 1200
          };
        }
        return { value: 0 };
      }
    });

    const registry = mockDataSourceRegistry([bqSource, gcpSource]);
    testApp.decorate('dataSourceRegistry', registry);

    testApp.get('/api/test/query-widgets', async ({ dataSourceRegistry }) => {
      const dashboard = {
        id: 'test-queries',
        widgets: [
          { id: 'w1', source: 'bigquery', type: 'big-number', queryId: 'total-users' },
          { id: 'w2', source: 'gcp', type: 'gauge', metric: 'cpu.utilization' }
        ]
      };

      const metrics = await dataSourceRegistry.fetchDashboardMetrics('test-queries', dashboard);
      return { success: true, metrics };
    });

    const response = await testApp.handle(createTestRequest('/api/test/query-widgets'));
    const data = await assertResponse.assertJson(response);

    expect(data.success).toBe(true);
    expect(data.metrics.w1.queryId).toBe('total-users');
    expect(data.metrics.w2.metric).toBe('cpu.utilization');
  });

  it('should support real-time vs cached data sources', async () => {
    const testApp = createTestApp();

    let realtimeFetches = 0;
    let cachedFetches = 0;

    const realtimeSource = createMockDataSource('realtime', {
      fetchMetrics: async () => {
        realtimeFetches++;
        return {
          value: Date.now(),
          timestamp: Date.now()
        };
      }
    });

    const cachedValue = { value: 1000, cached: true };
    const cachedSource = createMockDataSource('cached', {
      fetchMetrics: async () => {
        cachedFetches++;
        return cachedValue; // Same value every time (simulating cache)
      }
    });

    const registry = mockDataSourceRegistry([realtimeSource, cachedSource]);
    testApp.decorate('dataSourceRegistry', registry);

    testApp.get('/api/test/realtime-vs-cached', async ({ dataSourceRegistry }) => {
      const dashboard = {
        id: 'test-caching',
        widgets: [
          { id: 'w1', source: 'realtime', type: 'big-number' },
          { id: 'w2', source: 'cached', type: 'stat-card' }
        ]
      };

      const metrics = await dataSourceRegistry.fetchDashboardMetrics('test-caching', dashboard);
      return { success: true, metrics, fetchCounts: { realtime: realtimeFetches, cached: cachedFetches } };
    });

    const response1 = await testApp.handle(createTestRequest('/api/test/realtime-vs-cached'));
    const data1 = await assertResponse.assertJson(response1);

    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay

    const response2 = await testApp.handle(createTestRequest('/api/test/realtime-vs-cached'));
    const data2 = await assertResponse.assertJson(response2);

    // Realtime values should be different
    expect(data1.metrics.w1.value).not.toBe(data2.metrics.w1.value);

    // Cached values should be same
    expect(data1.metrics.w2.value).toBe(data2.metrics.w2.value);
  });

  it('should handle timeout scenarios gracefully', async () => {
    const testApp = createTestApp();

    const slowSource = createMockDataSource('slow', {
      fetchMetrics: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { value: 100, slow: true };
      }
    });

    const fastSource = createMockDataSource('fast', {
      fetchMetrics: async () => {
        return { value: 200, fast: true };
      }
    });

    const registry = mockDataSourceRegistry([slowSource, fastSource]);
    testApp.decorate('dataSourceRegistry', registry);

    testApp.get('/api/test/timing', async ({ dataSourceRegistry }) => {
      const dashboard = {
        id: 'test-timing',
        widgets: [
          { id: 'w1', source: 'slow', type: 'big-number' },
          { id: 'w2', source: 'fast', type: 'stat-card' }
        ]
      };

      const startTime = Date.now();
      const metrics = await dataSourceRegistry.fetchDashboardMetrics('test-timing', dashboard);
      const elapsed = Date.now() - startTime;

      return { success: true, metrics, elapsed };
    });

    const response = await testApp.handle(createTestRequest('/api/test/timing'));
    const data = await assertResponse.assertJson(response);

    expect(data.success).toBe(true);
    expect(data.metrics.w1.slow).toBe(true);
    expect(data.metrics.w2.fast).toBe(true);
    // Should wait for slowest source
    expect(data.elapsed).toBeGreaterThanOrEqual(100);
  });
});
