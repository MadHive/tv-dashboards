// ===========================================================================
// Segment Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { SegmentDataSource } from '../../../server/data-sources/segment.js';

describe('Segment Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new SegmentDataSource({});
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('segment');
      expect(dataSource.accessToken).toBeUndefined();
      expect(dataSource.baseUrl).toBe('https://api.segmentapis.com');
    });

    it('should accept custom configuration', () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token',
        workspaceId: 'workspace-123',
        baseUrl: 'https://custom.segmentapis.com'
      });

      expect(ds.accessToken).toBe('test-token');
      expect(ds.workspaceId).toBe('workspace-123');
      expect(ds.baseUrl).toBe('https://custom.segmentapis.com');
    });
  });

  describe('initialize()', () => {
    it('should handle missing access token gracefully', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(false);
    });

    it('should set isConnected to true when access token is provided', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-access-token'
      });

      // Mock the request method to avoid actual API calls
      ds.request = mock(async () => ({ data: { workspaces: [] } }));

      await ds.initialize();
      expect(ds.isConnected).toBe(true);
    });

    it('should handle connection errors gracefully', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-access-token'
      });

      // Mock the request method to throw an error
      ds.request = mock(async () => {
        throw new Error('Connection failed');
      });

      await ds.initialize();
      expect(ds.isConnected).toBe(false);
    });
  });

  describe('request()', () => {
    it('should construct correct request with Bearer token', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token-abc123'
      });

      // Mock fetch to capture the request
      const originalFetch = global.fetch;
      let capturedRequest = null;

      global.fetch = mock(async (url, options) => {
        capturedRequest = { url, options };
        return {
          ok: true,
          json: async () => ({ data: { workspaces: [] } })
        };
      });

      try {
        await ds.request('/workspaces');

        expect(capturedRequest).not.toBeNull();
        expect(capturedRequest.url).toBe('https://api.segmentapis.com/workspaces');
        expect(capturedRequest.options.headers.Authorization).toBe('Bearer test-token-abc123');
        expect(capturedRequest.options.headers['Content-Type']).toBe('application/json');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle API errors', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token'
      });

      // Mock fetch to return error response
      const originalFetch = global.fetch;
      global.fetch = mock(async () => ({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      }));

      try {
        await expect(ds.request('/workspaces')).rejects.toThrow('Segment API error');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should enforce rate limiting', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token'
      });

      // Mock fetch
      const originalFetch = global.fetch;
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => ({ data: {} })
      }));

      try {
        // Make 51 requests (exceeds rate limit of 50 per second)
        const requests = [];
        for (let i = 0; i < 51; i++) {
          requests.push(ds.request('/workspaces').catch(e => e));
        }

        const results = await Promise.all(requests);

        // At least one should fail with rate limit error
        const rateLimitErrors = results.filter(r => r instanceof Error && r.message.includes('Rate limit'));
        expect(rateLimitErrors.length).toBeGreaterThan(0);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('fetchMetrics() - without access token', () => {
    it('should return mock data when access token not configured', async () => {
      const result = await dataSource.fetchMetrics({
        id: 'test-widget',
        type: 'big-number',
        metric: 'event_volume'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('data');
      expect(result.source).toBe('segment');
    });
  });

  describe('fetchMetrics() - with access token', () => {
    it('should fetch workspace metric successfully', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token',
        workspaceId: 'ws-123'
      });

      // Mock the request method
      ds.request = mock(async () => ({
        data: {
          workspace: {
            id: 'ws-123',
            name: 'Test Workspace'
          }
        }
      }));

      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'big-number',
        metric: 'workspace'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result.metric).toBe('workspace');
    });

    it('should cache metric results', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token',
        workspaceId: 'ws-123'
      });

      let requestCount = 0;
      ds.request = mock(async () => {
        requestCount++;
        return { data: { sources: [] } };
      });

      // First request
      await ds.fetchMetrics({
        id: 'widget-1',
        type: 'big-number',
        metric: 'sources'
      });

      // Second request with same parameters (should use cache)
      const result = await ds.fetchMetrics({
        id: 'widget-1',
        type: 'big-number',
        metric: 'sources'
      });

      expect(requestCount).toBe(1);
      expect(result.cached).toBe(true);
    });

    it('should handle sources metric', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token',
        workspaceId: 'ws-123'
      });

      ds.request = mock(async () => ({
        data: {
          sources: [
            { id: 's1', name: 'JavaScript', enabled: true },
            { id: 's2', name: 'iOS', enabled: true }
          ]
        }
      }));

      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'big-number',
        metric: 'sources'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result.metric).toBe('sources');
    });

    it('should handle destinations metric', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token',
        workspaceId: 'ws-123'
      });

      ds.request = mock(async () => ({
        data: {
          destinations: [
            { id: 'd1', name: 'Google Analytics', enabled: true },
            { id: 'd2', name: 'Mixpanel', enabled: true },
            { id: 'd3', name: 'Amplitude', enabled: false }
          ]
        }
      }));

      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'big-number',
        metric: 'destinations'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result.metric).toBe('destinations');
    });

    it('should handle event_volume metric', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token',
        workspaceId: 'ws-123'
      });

      // Mock to simulate source fetch for event volume calculation
      ds.request = mock(async () => ({
        data: {
          sources: Array(5).fill({}).map((_, i) => ({
            id: `s${i}`,
            name: `Source ${i}`,
            enabled: true
          }))
        }
      }));

      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'line-chart',
        metric: 'event_volume',
        period: '24h'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result.metric).toBe('event_volume');
    });

    it('should handle mtu metric', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token',
        workspaceId: 'ws-123'
      });

      ds.request = mock(async () => ({
        data: {
          sources: Array(3).fill({}).map((_, i) => ({
            id: `s${i}`,
            name: `Source ${i}`
          }))
        }
      }));

      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'gauge',
        metric: 'mtu',
        period: '30d'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result.metric).toBe('mtu');
    });
  });

  describe('fetchWorkspace()', () => {
    it('should fetch specific workspace when workspaceId provided', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token',
        workspaceId: 'ws-123'
      });

      let capturedEndpoint = null;
      ds.request = mock(async (endpoint) => {
        capturedEndpoint = endpoint;
        return {
          data: {
            workspace: { id: 'ws-123', name: 'Test Workspace' }
          }
        };
      });

      await ds.fetchWorkspace();

      expect(capturedEndpoint).toBe('/workspaces/ws-123');
    });

    it('should fetch and use first workspace when workspaceId not provided', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token'
      });

      ds.request = mock(async () => ({
        data: {
          workspaces: [
            { id: 'ws-first', name: 'First Workspace' },
            { id: 'ws-second', name: 'Second Workspace' }
          ]
        }
      }));

      const result = await ds.fetchWorkspace();

      expect(result.workspace.id).toBe('ws-first');
      expect(ds.workspaceId).toBe('ws-first');
    });
  });

  describe('fetchSources()', () => {
    it('should fetch sources successfully', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token',
        workspaceId: 'ws-123'
      });

      const mockSources = [
        { id: 's1', name: 'JavaScript', slug: 'js-web' },
        { id: 's2', name: 'iOS', slug: 'ios-app' }
      ];

      ds.request = mock(async () => ({
        data: { sources: mockSources }
      }));

      const result = await ds.fetchSources();

      expect(result.type).toBe('sources');
      expect(result.sources).toEqual(mockSources);
      expect(result.total).toBe(2);
    });
  });

  describe('fetchDestinations()', () => {
    it('should fetch destinations successfully', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token',
        workspaceId: 'ws-123'
      });

      const mockDestinations = [
        { id: 'd1', name: 'Google Analytics', slug: 'google-analytics' },
        { id: 'd2', name: 'Mixpanel', slug: 'mixpanel' }
      ];

      ds.request = mock(async () => ({
        data: { destinations: mockDestinations }
      }));

      const result = await ds.fetchDestinations();

      expect(result.type).toBe('destinations');
      expect(result.destinations).toEqual(mockDestinations);
      expect(result.total).toBe(2);
    });
  });

  describe('testConnection()', () => {
    it('should return false when access token not configured', async () => {
      const result = await dataSource.testConnection();
      expect(result).toBe(false);
    });

    it('should return true when connection successful', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token'
      });

      ds.request = mock(async () => ({ data: { workspaces: [] } }));

      const result = await ds.testConnection();
      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      const ds = new SegmentDataSource({
        accessToken: 'test-token'
      });

      ds.request = mock(async () => {
        throw new Error('Network error');
      });

      const result = await ds.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('transformData()', () => {
    it('should handle empty results', () => {
      const result = dataSource.transformData(null, 'big-number');
      expect(result).toBeDefined();
    });

    it('should transform big-number data correctly for sources', () => {
      const mockResponse = {
        type: 'sources',
        sources: [
          { id: 's1', name: 'Source 1' },
          { id: 's2', name: 'Source 2' }
        ],
        total: 2
      };

      const result = dataSource.transformData(mockResponse, 'big-number', 'sources');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('trend');
      expect(result.value).toBe(2);
      expect(result.label).toBe('Total Sources');
      expect(result.unit).toBe('sources');
    });

    it('should transform big-number data correctly for event_volume', () => {
      const mockResponse = {
        type: 'event_volume',
        value: 50000,
        history: [40000, 42000, 45000, 48000, 50000]
      };

      const result = dataSource.transformData(mockResponse, 'big-number', 'event_volume');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('previous');
      expect(result).toHaveProperty('trend');
      expect(result.value).toBe(50000);
      expect(result.previous).toBe(48000);
      expect(result.trend).toBe('up');
      expect(result.label).toBe('Event Volume');
    });

    it('should transform gauge data correctly for mtu', () => {
      const mockResponse = {
        type: 'mtu',
        value: 25000,
        history: [20000, 22000, 24000, 25000]
      };

      const result = dataSource.transformData(mockResponse, 'gauge', 'mtu');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('min');
      expect(result).toHaveProperty('max');
      expect(result.min).toBe(0);
      expect(result.max).toBe(100);
      expect(result.unit).toBe('%');
      expect(result.label).toBe('MTU Usage');
    });

    it('should transform line-chart data correctly', () => {
      const mockResponse = {
        type: 'event_volume',
        value: 50000,
        history: [40000, 42000, 45000, 48000, 50000]
      };

      const result = dataSource.transformData(mockResponse, 'line-chart', 'event_volume');

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('values');
      expect(result.labels.length).toBe(5);
      expect(result.values).toEqual([40000, 42000, 45000, 48000, 50000]);
      expect(result.series).toBe('Event Volume');
    });

    it('should transform bar-chart data with sources', () => {
      const mockResponse = {
        type: 'sources',
        sources: [
          { id: 's1', name: 'JavaScript', enabled: true },
          { id: 's2', name: 'iOS', enabled: false },
          { id: 's3', name: 'Android', enabled: true }
        ],
        total: 3
      };

      const result = dataSource.transformData(mockResponse, 'bar-chart', 'sources');

      expect(result).toHaveProperty('values');
      expect(Array.isArray(result.values)).toBe(true);
      expect(result.values.length).toBe(3);
      expect(result.values[0].label).toBe('JavaScript');
      expect(result.values[0].value).toBe(100);
    });

    it('should transform status-grid data with sources', () => {
      const mockResponse = {
        type: 'sources',
        sources: [
          { id: 's1', name: 'JavaScript', slug: 'js-web', enabled: true },
          { id: 's2', name: 'iOS', slug: 'ios-app', enabled: false }
        ],
        total: 2
      };

      const result = dataSource.transformData(mockResponse, 'status-grid', 'sources');

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBe(2);
      expect(result.items[0].status).toBe('healthy');
      expect(result.items[1].status).toBe('critical');
    });
  });

  describe('getMockData()', () => {
    it('should return realistic mock data for big-number', () => {
      const data = dataSource.getMockData('big-number');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('trend');
      expect(data).toHaveProperty('label');
      expect(typeof data.value).toBe('number');
      expect(data.value).toBeGreaterThan(0);
    });

    it('should return mock data for all widget types', () => {
      const types = ['big-number', 'gauge', 'line-chart', 'bar-chart', 'sparkline', 'stat-card', 'status-grid'];

      types.forEach(type => {
        const data = dataSource.getMockData(type);
        expect(data).toBeDefined();
      });
    });

    it('should return gauge mock data with correct structure', () => {
      const data = dataSource.getMockData('gauge');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('min');
      expect(data).toHaveProperty('max');
      expect(data.min).toBe(0);
      expect(data.max).toBe(100);
    });

    it('should return line-chart mock data with time series', () => {
      const data = dataSource.getMockData('line-chart');

      expect(data).toHaveProperty('labels');
      expect(data).toHaveProperty('values');
      expect(Array.isArray(data.labels)).toBe(true);
      expect(Array.isArray(data.values)).toBe(true);
      expect(data.labels.length).toBe(24);
      expect(data.values.length).toBe(24);
    });

    it('should return status-grid mock data with items', () => {
      const data = dataSource.getMockData('status-grid');

      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0]).toHaveProperty('label');
      expect(data.items[0]).toHaveProperty('status');
    });
  });

  describe('getAvailableMetrics()', () => {
    it('should return array of metrics', () => {
      const metrics = dataSource.getAvailableMetrics();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should include sources_count metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const sourcesMetric = metrics.find(m => m.id === 'sources_count');

      expect(sourcesMetric).toBeDefined();
      expect(sourcesMetric.name).toBe('Total Sources');
      expect(sourcesMetric.metric).toBe('sources');
      expect(sourcesMetric.type).toBe('number');
    });

    it('should include destinations_count metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const destinationsMetric = metrics.find(m => m.id === 'destinations_count');

      expect(destinationsMetric).toBeDefined();
      expect(destinationsMetric.name).toBe('Total Destinations');
      expect(destinationsMetric.metric).toBe('destinations');
    });

    it('should include event_volume_total metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const eventVolumeMetric = metrics.find(m => m.id === 'event_volume_total');

      expect(eventVolumeMetric).toBeDefined();
      expect(eventVolumeMetric.metric).toBe('event_volume');
    });

    it('should include monthly_tracked_users metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const mtuMetric = metrics.find(m => m.id === 'monthly_tracked_users');

      expect(mtuMetric).toBeDefined();
      expect(mtuMetric.metric).toBe('mtu');
      expect(mtuMetric.type).toBe('number');
    });

    it('all metrics should have required properties', () => {
      const metrics = dataSource.getAvailableMetrics();

      metrics.forEach(metric => {
        expect(metric).toHaveProperty('id');
        expect(metric).toHaveProperty('name');
        expect(metric).toHaveProperty('description');
        expect(metric).toHaveProperty('metric');
        expect(metric).toHaveProperty('type');
        expect(metric).toHaveProperty('widgets');
        expect(Array.isArray(metric.widgets)).toBe(true);
      });
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

    it('should include accessToken field', () => {
      const schema = dataSource.getConfigSchema();
      const tokenField = schema.fields.find(f => f.name === 'accessToken');

      expect(tokenField).toBeDefined();
      expect(tokenField.required).toBe(true);
      expect(tokenField.secure).toBe(true);
      expect(tokenField.envVar).toBe('SEGMENT_ACCESS_TOKEN');
    });

    it('should include workspaceId field', () => {
      const schema = dataSource.getConfigSchema();
      const workspaceField = schema.fields.find(f => f.name === 'workspaceId');

      expect(workspaceField).toBeDefined();
      expect(workspaceField.required).toBe(false);
      expect(workspaceField.envVar).toBe('SEGMENT_WORKSPACE_ID');
    });

    it('should include metric selection field', () => {
      const schema = dataSource.getConfigSchema();
      const metricField = schema.fields.find(f => f.name === 'metric');

      expect(metricField).toBeDefined();
      expect(metricField.type).toBe('select');
      expect(Array.isArray(metricField.options)).toBe(true);
    });
  });

  describe('validateWidgetConfig()', () => {
    it('should validate basic widget config', () => {
      const errors = dataSource.validateWidgetConfig({
        id: 'test-widget',
        type: 'big-number',
        metric: 'sources'
      });

      expect(Array.isArray(errors)).toBe(true);
    });

    it('should return error for invalid metric type', () => {
      const errors = dataSource.validateWidgetConfig({
        id: 'test-widget',
        type: 'big-number',
        metric: 'invalid_metric'
      });

      const metricError = errors.find(e => e.includes('Invalid metric type'));
      expect(metricError).toBeDefined();
    });

    it('should accept valid metric types', () => {
      const validMetrics = ['workspace', 'sources', 'destinations', 'tracking_plans', 'event_volume', 'mtu'];

      validMetrics.forEach(metric => {
        const ds = new SegmentDataSource({ accessToken: 'test-token' });
        const errors = ds.validateWidgetConfig({
          id: 'test-widget',
          type: 'big-number',
          metric
        });

        const metricError = errors.find(e => e.includes('Invalid metric type'));
        expect(metricError).toBeUndefined();
      });
    });

    it('should require sourceId for source_stats metric', () => {
      const ds = new SegmentDataSource({ accessToken: 'test-token' });
      const errors = ds.validateWidgetConfig({
        id: 'test-widget',
        type: 'big-number',
        metric: 'source_stats'
      });

      const sourceIdError = errors.find(e => e.includes('sourceId required'));
      expect(sourceIdError).toBeDefined();
    });

    it('should accept source_stats metric with sourceId', () => {
      const ds = new SegmentDataSource({ accessToken: 'test-token' });
      const errors = ds.validateWidgetConfig({
        id: 'test-widget',
        type: 'big-number',
        metric: 'source_stats',
        sourceId: 'source-123'
      });

      const sourceIdError = errors.find(e => e.includes('sourceId required'));
      expect(sourceIdError).toBeUndefined();
    });
  });

  describe('generateHistory()', () => {
    it('should generate history with correct number of points', () => {
      const history = dataSource.generateHistory(10000, 24);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(24);
    });

    it('should generate increasing trend', () => {
      const history = dataSource.generateHistory(10000, 24);

      // First value should be less than last value (general trend)
      const firstHalf = history.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
      const secondHalf = history.slice(12).reduce((a, b) => a + b, 0) / 12;

      expect(secondHalf).toBeGreaterThan(firstHalf);
    });

    it('should return all positive integers', () => {
      const history = dataSource.generateHistory(5000, 12);

      history.forEach(value => {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Helper methods', () => {
    it('getMetricLabel should return correct labels', () => {
      expect(dataSource.getMetricLabel('workspace')).toBe('Workspace Info');
      expect(dataSource.getMetricLabel('sources')).toBe('Sources');
      expect(dataSource.getMetricLabel('destinations')).toBe('Destinations');
      expect(dataSource.getMetricLabel('tracking_plans')).toBe('Tracking Plans');
      expect(dataSource.getMetricLabel('event_volume')).toBe('Event Volume');
      expect(dataSource.getMetricLabel('mtu')).toBe('Monthly Tracked Users');
      expect(dataSource.getMetricLabel('source_stats')).toBe('Source Statistics');
    });
  });
});
