import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';

const mockGcpQuery = mock(async () => [
  {
    resource: { labels: { service_name: 'bidder' } },
    metric:   { labels: {} },
    points: [
      { interval: { endTime: { seconds: 1709547600 } }, value: { doubleValue: 142.3 } },
      { interval: { endTime: { seconds: 1709547540 } }, value: { doubleValue: 138.7 } },
    ],
  },
]);

mock.module('../../../server/gcp-metrics.js', () => ({
  query:  mockGcpQuery,
  latest: (ts) => ts[0]?.points[0]?.value?.doubleValue ?? null,
  spark:  () => [],
}));

const mockBqExecute = mock(async () => [
  { zip3: '100', state: 'NY', impressions: 48291 },
  { zip3: '900', state: 'CA', impressions: 41033 },
]);

const mockComputedFetch = mock(async ({ queryId }) => ({
  source:  'computed',
  data:    { value: '1.2 TB', detail: 'BQ + BT + GCS' },
  rawData: [{ label: 'total', value: '1.2 TB' }],
  queryId,
}));

mock.module('../../../server/data-source-registry.js', () => ({
  dataSourceRegistry: {
    getSource: (name) => {
      if (name === 'bigquery') return { executeQuery: mockBqExecute };
      if (name === 'gcp')      return { transformData: (_ts, _type) => ({ value: 142.3, unit: '' }) };
      if (name === 'computed') return { fetchMetrics: mockComputedFetch };
    },
  },
}));

const { exploreRoutes } = await import('../../../server/explore-routes.js');

describe('Explore Routes', () => {
  let app;

  beforeEach(() => {
    app = new Elysia().use(exploreRoutes);
    mockGcpQuery.mockClear();
    mockBqExecute.mockClear();
    mockComputedFetch.mockClear();
  });

  describe('POST /api/explore/gcp', () => {
    it('returns rawSeries, widgetData and executionMs', async () => {
      const res = await app.handle(new Request('http://localhost/api/explore/gcp', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ metricType: 'custom.googleapis.com/foo', timeWindow: 10 }),
      }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.rawSeries)).toBe(true);
      expect(body.rawSeries[0]).toHaveProperty('timestamp');
      expect(body.rawSeries[0]).toHaveProperty('value');
      expect(body.rawSeries[0].service_name).toBe('bidder');
      expect(body.widgetData).toBeDefined();
      expect(typeof body.executionMs).toBe('number');
      expect(body.seriesCount).toBe(1);
      expect(body.pointCount).toBe(2);
    });

    it('returns 400 when metricType is missing', async () => {
      const res = await app.handle(new Request('http://localhost/api/explore/gcp', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ timeWindow: 10 }),
      }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('passes project, filters, aggregation, timeWindow to gcpQuery', async () => {
      await app.handle(new Request('http://localhost/api/explore/gcp', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          metricType:  'custom.googleapis.com/foo',
          project:     'mad-data',
          filters:     'resource.type="global"',
          timeWindow:  5,
          aggregation: { perSeriesAligner: 'ALIGN_DELTA' },
        }),
      }));
      expect(mockGcpQuery).toHaveBeenCalledWith(
        'mad-data',
        'custom.googleapis.com/foo',
        'resource.type="global"',
        5,
        { perSeriesAligner: 'ALIGN_DELTA' }
      );
    });

    it('returns empty rawSeries and null widgetData when no time series returned', async () => {
      mockGcpQuery.mockResolvedValueOnce([]);
      const res = await app.handle(new Request('http://localhost/api/explore/gcp', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ metricType: 'custom.googleapis.com/foo' }),
      }));
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.rawSeries).toEqual([]);
      expect(body.seriesCount).toBe(0);
    });
  });

  describe('POST /api/explore/bigquery', () => {
    it('returns rows, widgetData and executionMs', async () => {
      const res = await app.handle(new Request('http://localhost/api/explore/bigquery', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ sql: 'SELECT * FROM test' }),
      }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.rows)).toBe(true);
      expect(body.rows[0].zip3).toBe('100');
      expect(body.widgetData).toBeDefined();
      expect(typeof body.executionMs).toBe('number');
      expect(body.rowCount).toBe(2);
      expect(body.columnCount).toBe(3);
    });

    it('appends LIMIT 200 when SQL has no LIMIT clause', async () => {
      await app.handle(new Request('http://localhost/api/explore/bigquery', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ sql: 'SELECT * FROM test' }),
      }));
      const callSql = mockBqExecute.mock.calls[0][0];
      expect(callSql).toMatch(/LIMIT 200/i);
    });

    it('does not double-add LIMIT when SQL already has one', async () => {
      await app.handle(new Request('http://localhost/api/explore/bigquery', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ sql: 'SELECT * FROM test LIMIT 50' }),
      }));
      const callSql = mockBqExecute.mock.calls[0][0];
      expect((callSql.match(/LIMIT/gi) || []).length).toBe(1);
    });

    it('returns 400 when sql is missing', async () => {
      const res = await app.handle(new Request('http://localhost/api/explore/bigquery', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({}),
      }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/explore/computed', () => {
    it('returns widgetData, rawData and executionMs', async () => {
      const res = await app.handle(new Request('http://localhost/api/explore/computed', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ function: 'storage-volume' }),
      }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.widgetData).toBeDefined();
      expect(Array.isArray(body.rawData)).toBe(true);
      expect(typeof body.executionMs).toBe('number');
    });

    it('returns 400 when function is missing', async () => {
      const res = await app.handle(new Request('http://localhost/api/explore/computed', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({}),
      }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('calls fetchMetrics with queryId set to the function name', async () => {
      await app.handle(new Request('http://localhost/api/explore/computed', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ function: 'fleet-health' }),
      }));
      expect(mockComputedFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryId: 'fleet-health' })
      );
    });
  });
});
