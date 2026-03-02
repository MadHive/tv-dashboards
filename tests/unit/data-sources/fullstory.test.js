// ===========================================================================
// FullStory Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { FullStoryDataSource } from '../../../server/data-sources/fullstory.js';

describe('FullStory Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new FullStoryDataSource({});
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('fullstory');
      expect(dataSource.apiKey).toBeUndefined();
      expect(dataSource.baseUrl).toBe('https://api.fullstory.com');
    });

    it('should accept custom configuration', () => {
      const ds = new FullStoryDataSource({
        apiKey: 'test-key',
        baseUrl: 'https://custom.fullstory.com'
      });

      expect(ds.apiKey).toBe('test-key');
      expect(ds.baseUrl).toBe('https://custom.fullstory.com');
    });
  });

  describe('initialize()', () => {
    it('should handle missing API key gracefully', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(false);
    });

    it('should set isConnected to true when API key is provided', async () => {
      const ds = new FullStoryDataSource({
        apiKey: 'test-api-key'
      });

      // Mock the request method to avoid actual API calls
      ds.request = mock(async () => ({ sessions: [] }));

      await ds.initialize();
      expect(ds.isConnected).toBe(true);
    });

    it('should handle connection errors gracefully', async () => {
      const ds = new FullStoryDataSource({
        apiKey: 'test-api-key'
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
    it('should construct correct request with auth headers', async () => {
      const ds = new FullStoryDataSource({
        apiKey: 'test-key-123'
      });

      // Mock fetch to capture the request
      const originalFetch = global.fetch;
      let capturedRequest = null;

      global.fetch = mock(async (url, options) => {
        capturedRequest = { url, options };
        return {
          ok: true,
          json: async () => ({ sessions: [] })
        };
      });

      try {
        await ds.request('/sessions/v2?limit=1');

        expect(capturedRequest).not.toBeNull();
        expect(capturedRequest.url).toBe('https://api.fullstory.com/sessions/v2?limit=1');
        expect(capturedRequest.options.headers.Authorization).toBe('Basic test-key-123');
        expect(capturedRequest.options.headers['Content-Type']).toBe('application/json');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle API errors', async () => {
      const ds = new FullStoryDataSource({
        apiKey: 'test-key'
      });

      // Mock fetch to return error response
      const originalFetch = global.fetch;
      global.fetch = mock(async () => ({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      }));

      try {
        await expect(ds.request('/sessions/v2')).rejects.toThrow('FullStory API error');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('fetchMetrics() - without API key', () => {
    it('should return mock data when API key not configured', async () => {
      const result = await dataSource.fetchMetrics({
        id: 'test-widget',
        type: 'big-number',
        metric: 'sessions'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('data');
      expect(result.source).toBe('fullstory');
    });
  });

  describe('fetchMetrics() - with API key', () => {
    it('should fetch sessions metric successfully', async () => {
      const ds = new FullStoryDataSource({
        apiKey: 'test-key'
      });

      // Mock the request method
      ds.request = mock(async () => ({
        sessions: [
          { id: '1', createdTime: '2026-03-02T10:00:00Z' },
          { id: '2', createdTime: '2026-03-02T11:00:00Z' }
        ]
      }));

      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'big-number',
        metric: 'sessions'
      });

      expect(result).toHaveProperty('data');
      expect(result.metric).toBe('sessions');
    });

    it('should cache metric results', async () => {
      const ds = new FullStoryDataSource({
        apiKey: 'test-key'
      });

      let requestCount = 0;
      ds.request = mock(async () => {
        requestCount++;
        return { sessions: [] };
      });

      // First request
      await ds.fetchMetrics({
        id: 'widget-1',
        type: 'big-number',
        metric: 'sessions'
      });

      // Second request with same parameters (should use cache)
      const result = await ds.fetchMetrics({
        id: 'widget-1',
        type: 'big-number',
        metric: 'sessions'
      });

      expect(requestCount).toBe(1);
      expect(result.cached).toBe(true);
    });

    it('should handle rage_clicks metric', async () => {
      const ds = new FullStoryDataSource({
        apiKey: 'test-key'
      });

      ds.request = mock(async () => ({
        sessions: Array(100).fill({}).map((_, i) => ({ id: i.toString() }))
      }));

      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'big-number',
        metric: 'rage_clicks'
      });

      expect(result).toHaveProperty('data');
      expect(result.metric).toBe('rage_clicks');
    });

    it('should handle errors metric', async () => {
      const ds = new FullStoryDataSource({
        apiKey: 'test-key'
      });

      ds.request = mock(async () => ({
        sessions: Array(50).fill({}).map((_, i) => ({ id: i.toString() }))
      }));

      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'gauge',
        metric: 'errors'
      });

      expect(result).toHaveProperty('data');
      expect(result.metric).toBe('errors');
    });
  });

  describe('fetchSessions()', () => {
    it('should construct correct API endpoint with parameters', async () => {
      const ds = new FullStoryDataSource({
        apiKey: 'test-key'
      });

      let capturedEndpoint = null;
      ds.request = mock(async (endpoint) => {
        capturedEndpoint = endpoint;
        return { sessions: [] };
      });

      await ds.fetchSessions({
        email: 'test@example.com',
        limit: 10
      });

      expect(capturedEndpoint).toContain('email=test%40example.com');
      expect(capturedEndpoint).toContain('limit=10');
    });

    it('should return sessions data', async () => {
      const ds = new FullStoryDataSource({
        apiKey: 'test-key'
      });

      const mockSessions = [
        { id: '1', userId: 'user1' },
        { id: '2', userId: 'user2' }
      ];

      ds.request = mock(async () => ({ sessions: mockSessions }));

      const result = await ds.fetchSessions({ limit: 20 });

      expect(result.type).toBe('sessions');
      expect(result.sessions).toEqual(mockSessions);
      expect(result.total).toBe(2);
    });
  });

  describe('testConnection()', () => {
    it('should return false when API key not configured', async () => {
      const result = await dataSource.testConnection();
      expect(result).toBe(false);
    });

    it('should return true when connection successful', async () => {
      const ds = new FullStoryDataSource({
        apiKey: 'test-key'
      });

      ds.request = mock(async () => ({ sessions: [] }));

      const result = await ds.testConnection();
      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      const ds = new FullStoryDataSource({
        apiKey: 'test-key'
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

    it('should transform big-number data correctly', () => {
      const mockResponse = {
        type: 'sessions',
        value: 1250,
        total: 1250,
        history: [1000, 1050, 1100, 1150, 1200, 1250]
      };

      const result = dataSource.transformData(mockResponse, 'big-number');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('previous');
      expect(result).toHaveProperty('trend');
      expect(result.value).toBe(1250);
      expect(result.trend).toBe('up');
      expect(result.label).toBe('Total Sessions');
    });

    it('should transform gauge data correctly', () => {
      const mockResponse = {
        type: 'rage_clicks',
        value: 45,
        total: 100,
        history: [40, 42, 44, 45]
      };

      const result = dataSource.transformData(mockResponse, 'gauge');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('min');
      expect(result).toHaveProperty('max');
      expect(result.min).toBe(0);
      expect(result.max).toBe(100);
      expect(result.label).toBe('Rage Clicks');
    });

    it('should transform line-chart data correctly', () => {
      const mockResponse = {
        type: 'sessions',
        value: 500,
        history: [100, 200, 300, 400, 500]
      };

      const result = dataSource.transformData(mockResponse, 'line-chart');

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('values');
      expect(result.labels.length).toBe(5);
      expect(result.values).toEqual([100, 200, 300, 400, 500]);
    });

    it('should transform bar-chart data with sessions', () => {
      const mockResponse = {
        type: 'sessions',
        sessions: [
          { id: '1', createdTime: '2026-03-02T10:00:00Z' },
          { id: '2', createdTime: '2026-03-02T10:30:00Z' },
          { id: '3', createdTime: '2026-03-02T11:00:00Z' }
        ],
        total: 3
      };

      const result = dataSource.transformData(mockResponse, 'bar-chart');

      expect(result).toHaveProperty('values');
      expect(Array.isArray(result.values)).toBe(true);
    });

    it('should transform bar-chart data with history', () => {
      const mockResponse = {
        type: 'page_views',
        value: 500,
        history: [100, 150, 200, 250, 300, 350, 400, 450, 500]
      };

      const result = dataSource.transformData(mockResponse, 'bar-chart');

      expect(result).toHaveProperty('values');
      expect(Array.isArray(result.values)).toBe(true);
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
      const types = ['big-number', 'gauge', 'line-chart', 'bar-chart', 'sparkline', 'stat-card'];

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
      expect(data.labels.length).toBe(data.values.length);
    });
  });

  describe('getAvailableMetrics()', () => {
    it('should return array of metrics', () => {
      const metrics = dataSource.getAvailableMetrics();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should include sessions metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const sessionsMetric = metrics.find(m => m.id === 'sessions_total');

      expect(sessionsMetric).toBeDefined();
      expect(sessionsMetric.name).toBe('Total Sessions');
      expect(sessionsMetric.metric).toBe('sessions');
      expect(sessionsMetric.type).toBe('number');
    });

    it('should include rage_clicks metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const rageClicksMetric = metrics.find(m => m.id === 'rage_clicks');

      expect(rageClicksMetric).toBeDefined();
      expect(rageClicksMetric.name).toBe('Rage Clicks');
      expect(rageClicksMetric.description).toContain('frustration');
    });

    it('should include errors_encountered metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const errorsMetric = metrics.find(m => m.id === 'errors_encountered');

      expect(errorsMetric).toBeDefined();
      expect(errorsMetric.metric).toBe('errors');
    });

    it('should include conversion_events metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const conversionMetric = metrics.find(m => m.id === 'conversion_events');

      expect(conversionMetric).toBeDefined();
      expect(conversionMetric.metric).toBe('conversions');
    });

    it('should include page_views metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const pageViewsMetric = metrics.find(m => m.id === 'page_views');

      expect(pageViewsMetric).toBeDefined();
      expect(pageViewsMetric.metric).toBe('page_views');
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

    it('should include API key field', () => {
      const schema = dataSource.getConfigSchema();
      const apiKeyField = schema.fields.find(f => f.name === 'apiKey');

      expect(apiKeyField).toBeDefined();
      expect(apiKeyField.required).toBe(true);
      expect(apiKeyField.secure).toBe(true);
      expect(apiKeyField.envVar).toBe('FULLSTORY_API_KEY');
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
        metric: 'sessions'
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
      const validMetrics = ['sessions', 'rage_clicks', 'errors', 'conversions', 'page_views'];

      validMetrics.forEach(metric => {
        const ds = new FullStoryDataSource({ apiKey: 'test-key' });
        const errors = ds.validateWidgetConfig({
          id: 'test-widget',
          type: 'big-number',
          metric
        });

        const metricError = errors.find(e => e.includes('Invalid metric type'));
        expect(metricError).toBeUndefined();
      });
    });
  });

  describe('generateHistory()', () => {
    it('should generate history with correct number of points', () => {
      const history = dataSource.generateHistory(100, 10);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(10);
    });

    it('should generate increasing trend', () => {
      const history = dataSource.generateHistory(100, 12);

      // First value should be less than last value (general trend)
      const firstHalf = history.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
      const secondHalf = history.slice(6).reduce((a, b) => a + b, 0) / 6;

      expect(secondHalf).toBeGreaterThan(firstHalf);
    });

    it('should return all positive integers', () => {
      const history = dataSource.generateHistory(50, 8);

      history.forEach(value => {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Helper methods', () => {
    it('getMetricLabel should return correct labels', () => {
      expect(dataSource.getMetricLabel('sessions')).toBe('Total Sessions');
      expect(dataSource.getMetricLabel('rage_clicks')).toBe('Rage Clicks');
      expect(dataSource.getMetricLabel('errors')).toBe('Errors Encountered');
      expect(dataSource.getMetricLabel('conversions')).toBe('Conversion Events');
      expect(dataSource.getMetricLabel('page_views')).toBe('Page Views');
    });

    it('getMetricUnit should return correct units', () => {
      expect(dataSource.getMetricUnit('sessions')).toBe('sessions');
      expect(dataSource.getMetricUnit('rage_clicks')).toBe('clicks');
      expect(dataSource.getMetricUnit('errors')).toBe('errors');
      expect(dataSource.getMetricUnit('conversions')).toBe('conversions');
      expect(dataSource.getMetricUnit('page_views')).toBe('views');
    });
  });
});
