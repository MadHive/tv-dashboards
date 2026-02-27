// ===========================================================================
// Data Routes Tests — Following Elysia.js Testing Patterns
// Tests for widget data fetching and caching
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { createTestRequest } from '../../helpers/test-app.js';
import { testDashboard, testWidgetData } from '../../helpers/fixtures.js';

describe('Data Routes (Elysia Unit Tests)', () => {
  let app;
  let widgetCache;
  let fetchCount;

  beforeEach(() => {
    widgetCache = new Map();
    fetchCount = 0;

    // Mock getData function
    const getData = async (dashboardId) => {
      fetchCount++;
      return testWidgetData;
    };

    // Mock cache helpers
    const CACHE_DURATION = 10000; // 10 seconds

    const getCachedData = (key) => {
      const cached = widgetCache.get(key);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }
      return null;
    };

    const setCachedData = (key, data) => {
      widgetCache.set(key, { data, timestamp: Date.now() });
    };

    // Create test app with data routes
    app = new Elysia()
      .get('/api/metrics/:dashboardId', async ({ params }) => {
        return await getData(params.dashboardId);
      })
      .get('/api/data/:widgetId', async ({ params }) => {
        const { widgetId } = params;

        // Check cache first
        const cached = getCachedData(widgetId);
        if (cached) {
          return cached;
        }

        // Mock finding widget in dashboards
        const dashboards = [testDashboard];

        for (const dashboard of dashboards) {
          const widget = dashboard.widgets.find(w => w.id === widgetId);
          if (widget) {
            try {
              const dashboardData = await getData(dashboard.id);

              if (dashboardData && dashboardData[widgetId]) {
                const widgetData = {
                  ...dashboardData[widgetId],
                  timestamp: new Date().toISOString()
                };
                setCachedData(widgetId, widgetData);
                return widgetData;
              }
            } catch (error) {
              continue;
            }
          }
        }

        return new Response(
          JSON.stringify({ error: 'Widget not found' }),
          { status: 404, headers: { 'content-type': 'application/json' } }
        );
      });
  });

  describe('GET /api/metrics/:dashboardId', () => {
    it('should fetch metrics for dashboard', async () => {
      const request = createTestRequest('/api/metrics/test-dashboard');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toBeObject();
      expect(data['test-widget-1']).toBeDefined();
      expect(data['test-widget-2']).toBeDefined();
    });

    it('should return widget data with values', async () => {
      const request = createTestRequest('/api/metrics/test-dashboard');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data['test-widget-1'].value).toBe(1234);
      expect(data['test-widget-2'].value).toBe(75.5);
    });

    it('should include timestamps', async () => {
      const request = createTestRequest('/api/metrics/test-dashboard');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data['test-widget-1'].timestamp).toBeDefined();
      expect(data['test-widget-2'].timestamp).toBeDefined();
    });

    it('should handle multiple dashboards', async () => {
      const request1 = createTestRequest('/api/metrics/dashboard-1');
      const request2 = createTestRequest('/api/metrics/dashboard-2');

      const response1 = await app.handle(request1);
      const response2 = await app.handle(request2);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Should make separate fetch calls
      expect(fetchCount).toBe(2);
    });
  });

  describe('GET /api/data/:widgetId', () => {
    it('should return widget data for existing widget', async () => {
      const request = createTestRequest('/api/data/test-widget-1');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toBeObject();
      expect(data.value).toBe(1234);
      expect(data.timestamp).toBeDefined();
    });

    it('should return 404 for non-existent widget', async () => {
      const request = createTestRequest('/api/data/nonexistent-widget');
      const response = await app.handle(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toContain('Widget not found');
    });

    it('should cache widget data', async () => {
      const request1 = createTestRequest('/api/data/test-widget-1');
      const request2 = createTestRequest('/api/data/test-widget-1');

      await app.handle(request1);
      const initialFetchCount = fetchCount;

      await app.handle(request2);

      // Second request should use cache, no additional fetch
      expect(fetchCount).toBe(initialFetchCount);
    });

    it('should return cached data when available', async () => {
      const request1 = createTestRequest('/api/data/test-widget-1');
      const response1 = await app.handle(request1);
      const data1 = await response1.json();

      const request2 = createTestRequest('/api/data/test-widget-1');
      const response2 = await app.handle(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(200);
      expect(data2.value).toBe(data1.value);
    });

    it('should include timestamp in response', async () => {
      const request = createTestRequest('/api/data/test-widget-1');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.timestamp).toBeDefined();
      expect(new Date(data.timestamp)).toBeInstanceOf(Date);
    });

    it('should handle different widget types', async () => {
      const request1 = createTestRequest('/api/data/test-widget-1');
      const request2 = createTestRequest('/api/data/test-widget-2');

      const response1 = await app.handle(request1);
      const response2 = await app.handle(request2);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.value).toBe(1234);
      expect(data2.value).toBe(75.5);
    });
  });

  describe('Caching Behavior', () => {
    it('should populate cache on first request', async () => {
      expect(widgetCache.size).toBe(0);

      const request = createTestRequest('/api/data/test-widget-1');
      await app.handle(request);

      expect(widgetCache.size).toBeGreaterThan(0);
    });

    it('should use cache for subsequent requests', async () => {
      const request = createTestRequest('/api/data/test-widget-1');

      await app.handle(request);
      const initialFetchCount = fetchCount;

      await app.handle(request);
      await app.handle(request);

      // Should not fetch again
      expect(fetchCount).toBe(initialFetchCount);
    });

    it('should cache different widgets separately', async () => {
      const request1 = createTestRequest('/api/data/test-widget-1');
      const request2 = createTestRequest('/api/data/test-widget-2');

      await app.handle(request1);
      await app.handle(request2);

      expect(widgetCache.has('test-widget-1')).toBe(true);
      expect(widgetCache.has('test-widget-2')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle widget search across all dashboards', async () => {
      // Widget exists in one of the dashboards
      const request = createTestRequest('/api/data/test-widget-1');
      const response = await app.handle(request);

      expect(response.status).toBe(200);
    });

    it('should return proper error structure for missing widget', async () => {
      const request = createTestRequest('/api/data/missing-widget');
      const response = await app.handle(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toBeObject();
      expect(data.error).toBeDefined();
      expect(typeof data.error).toBe('string');
    });
  });
});
