// ===========================================================================
// Checkly Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { ChecklyDataSource } from '../../../server/data-sources/checkly.js';

describe('Checkly Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new ChecklyDataSource({});
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('checkly');
      expect(dataSource.apiKey).toBeUndefined();
      expect(dataSource.accountId).toBeUndefined();
      expect(dataSource.baseUrl).toBe('https://api.checklyhq.com');
    });

    it('should accept custom configuration', () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-api-key',
        accountId: 'acc-123',
        baseUrl: 'https://custom.checklyhq.com'
      });

      expect(ds.apiKey).toBe('test-api-key');
      expect(ds.accountId).toBe('acc-123');
      expect(ds.baseUrl).toBe('https://custom.checklyhq.com');
    });
  });

  describe('initialize()', () => {
    it('should handle missing credentials gracefully', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(false);
    });

    it('should set isConnected to true when credentials are provided', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-api-key',
        accountId: 'acc-123'
      });

      // Mock the request method to avoid actual API calls
      ds.request = mock(async () => []);

      await ds.initialize();
      expect(ds.isConnected).toBe(true);
    });

    it('should handle connection errors gracefully', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-api-key',
        accountId: 'acc-123'
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
    it('should construct correct request with Bearer token and account ID', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key-abc123',
        accountId: 'account-xyz789'
      });

      // Mock fetch to capture the request
      const originalFetch = global.fetch;
      let capturedRequest = null;

      global.fetch = mock(async (url, options) => {
        capturedRequest = { url, options };
        return {
          ok: true,
          json: async () => []
        };
      });

      try {
        await ds.request('/v1/checks');

        expect(capturedRequest).not.toBeNull();
        expect(capturedRequest.url).toBe('https://api.checklyhq.com/v1/checks');
        expect(capturedRequest.options.headers.Authorization).toBe('Bearer test-key-abc123');
        expect(capturedRequest.options.headers['X-Checkly-Account']).toBe('account-xyz789');
        expect(capturedRequest.options.headers['Content-Type']).toBe('application/json');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle API errors', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      // Mock fetch to return error response
      const originalFetch = global.fetch;
      global.fetch = mock(async () => ({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      }));

      try {
        await expect(ds.request('/v1/checks')).rejects.toThrow('Checkly API error');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should enforce rate limiting', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      // Mock fetch
      const originalFetch = global.fetch;
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => []
      }));

      try {
        // Make 601 requests (exceeds rate limit of 600 per minute)
        const requests = [];
        for (let i = 0; i < 601; i++) {
          requests.push(ds.request('/v1/checks').catch(e => e));
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

  describe('fetchMetrics() - without credentials', () => {
    it('should return mock data when credentials not configured', async () => {
      const result = await dataSource.fetchMetrics({
        id: 'test-widget',
        type: 'big-number',
        metric: 'checks'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('data');
      expect(result.source).toBe('checkly');
    });
  });

  describe('fetchMetrics() - with credentials', () => {
    it('should fetch checks metric successfully', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      // Mock the request method
      ds.request = mock(async () => [
        { id: 'check-1', name: 'API Check', activated: true, degraded: false, checkType: 'api' },
        { id: 'check-2', name: 'Browser Check', activated: true, degraded: false, checkType: 'browser' }
      ]);

      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'big-number',
        metric: 'checks'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result.metric).toBe('checks');
    });

    it('should cache metric results', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      let requestCount = 0;
      ds.request = mock(async () => {
        requestCount++;
        return [];
      });

      // First request
      await ds.fetchMetrics({
        id: 'widget-1',
        type: 'big-number',
        metric: 'checks'
      });

      // Second request with same parameters (should use cache)
      const result = await ds.fetchMetrics({
        id: 'widget-1',
        type: 'big-number',
        metric: 'checks'
      });

      expect(requestCount).toBe(1);
      expect(result.cached).toBe(true);
    });

    it('should handle uptime metric', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      ds.request = mock(async () => [
        { id: 'check-1', activated: true, degraded: false },
        { id: 'check-2', activated: true, degraded: false },
        { id: 'check-3', activated: true, degraded: true }
      ]);

      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'gauge',
        metric: 'uptime'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result.metric).toBe('uptime');
    });

    it('should handle failing_checks metric', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      ds.request = mock(async () => [
        { id: 'check-1', name: 'Check 1', activated: true, degraded: false },
        { id: 'check-2', name: 'Check 2', activated: true, degraded: true },
        { id: 'check-3', name: 'Check 3', activated: true, degraded: true }
      ]);

      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'big-number',
        metric: 'failing_checks'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result.metric).toBe('failing_checks');
    });

    it('should handle checks_by_type metric', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      ds.request = mock(async () => [
        { id: 'check-1', checkType: 'api', activated: true },
        { id: 'check-2', checkType: 'browser', activated: true },
        { id: 'check-3', checkType: 'api', activated: true },
        { id: 'check-4', checkType: 'tcp', activated: true }
      ]);

      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'bar-chart',
        metric: 'checks_by_type'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result.metric).toBe('checks_by_type');
    });
  });

  describe('fetchChecks()', () => {
    it('should fetch checks successfully', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      const mockChecks = [
        { id: 'check-1', name: 'API Check', activated: true, degraded: false, checkType: 'api' },
        { id: 'check-2', name: 'Browser Check', activated: true, degraded: false, checkType: 'browser' }
      ];

      ds.request = mock(async () => mockChecks);

      const result = await ds.fetchChecks();

      expect(result.type).toBe('checks');
      expect(result.total).toBe(2);
      expect(result.passing).toBe(2);
      expect(result.failing).toBe(0);
    });

    it('should filter checks by type', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      const mockChecks = [
        { id: 'check-1', checkType: 'api', activated: true, degraded: false },
        { id: 'check-2', checkType: 'browser', activated: true, degraded: false },
        { id: 'check-3', checkType: 'api', activated: true, degraded: false }
      ];

      ds.request = mock(async () => mockChecks);

      const result = await ds.fetchChecks('api');

      expect(result.total).toBe(2);
      expect(result.checks.every(c => c.checkType === 'api')).toBe(true);
    });

    it('should count failing checks correctly', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      const mockChecks = [
        { id: 'check-1', activated: true, degraded: false },
        { id: 'check-2', activated: true, degraded: true },
        { id: 'check-3', activated: true, degraded: true }
      ];

      ds.request = mock(async () => mockChecks);

      const result = await ds.fetchChecks();

      expect(result.passing).toBe(1);
      expect(result.failing).toBe(2);
    });
  });

  describe('fetchCheckResults()', () => {
    it('should fetch check results successfully', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      const mockResults = [
        { hasErrors: false, hasFailures: false, responseTime: 120 },
        { hasErrors: false, hasFailures: false, responseTime: 150 },
        { hasErrors: true, hasFailures: false, responseTime: 300 }
      ];

      ds.request = mock(async () => mockResults);

      const result = await ds.fetchCheckResults('check-123', '24h');

      expect(result.type).toBe('check_results');
      expect(result.checkId).toBe('check-123');
      expect(result.total).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('should calculate uptime percentage correctly', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      const mockResults = Array(10).fill({}).map((_, i) => ({
        hasErrors: i >= 9, // Last result has error
        hasFailures: false,
        responseTime: 100 + i * 10
      }));

      ds.request = mock(async () => mockResults);

      const result = await ds.fetchCheckResults('check-123', '24h');

      expect(result.uptime).toBe(90); // 9 out of 10 successful
    });

    it('should calculate average response time', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      const mockResults = [
        { hasErrors: false, hasFailures: false, responseTime: 100 },
        { hasErrors: false, hasFailures: false, responseTime: 200 },
        { hasErrors: false, hasFailures: false, responseTime: 300 }
      ];

      ds.request = mock(async () => mockResults);

      const result = await ds.fetchCheckResults('check-123', '24h');

      expect(result.avgResponseTime).toBe(200);
    });
  });

  describe('fetchUptimeMetrics()', () => {
    it('should fetch uptime for specific check', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      const mockResults = Array(100).fill({}).map((_, i) => ({
        hasErrors: i >= 95, // 95% uptime
        hasFailures: false,
        responseTime: 150
      }));

      ds.request = mock(async () => mockResults);

      const result = await ds.fetchUptimeMetrics('check-123', '24h');

      expect(result.type).toBe('uptime');
      expect(result.uptime).toBe(95);
      expect(result.checkId).toBe('check-123');
    });

    it('should fetch aggregate uptime for all checks', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      const mockChecks = [
        { activated: true, degraded: false },
        { activated: true, degraded: false },
        { activated: true, degraded: false },
        { activated: true, degraded: true }
      ];

      ds.request = mock(async () => mockChecks);

      const result = await ds.fetchUptimeMetrics(null, '24h');

      expect(result.type).toBe('uptime');
      expect(result.uptime).toBe(75); // 3 out of 4 passing
    });
  });

  describe('fetchResponseTimeMetrics()', () => {
    it('should calculate response time statistics', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      const mockResults = Array.from({ length: 100 }, (_, i) => ({
        hasErrors: false,
        hasFailures: false,
        responseTime: 100 + i
      }));

      ds.request = mock(async () => mockResults);

      const result = await ds.fetchResponseTimeMetrics('check-123', '24h');

      expect(result.type).toBe('response_time');
      expect(result.min).toBe(100);
      expect(result.max).toBe(199);
      expect(result.avg).toBeGreaterThan(0);
      expect(result.p95).toBeGreaterThan(result.avg);
      expect(result.p99).toBeGreaterThan(result.p95);
    });
  });

  describe('fetchFailingChecks()', () => {
    it('should return only failing checks', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      const mockChecks = [
        { id: 'check-1', name: 'Check 1', activated: true, degraded: false, checkType: 'api' },
        { id: 'check-2', name: 'Check 2', activated: true, degraded: true, checkType: 'browser' },
        { id: 'check-3', name: 'Check 3', activated: true, degraded: true, checkType: 'api' }
      ];

      ds.request = mock(async () => mockChecks);

      const result = await ds.fetchFailingChecks();

      expect(result.type).toBe('failing_checks');
      expect(result.total).toBe(2);
      expect(result.details.length).toBe(2);
      expect(result.details.every(d => d.degraded)).toBe(true);
    });
  });

  describe('fetchChecksByType()', () => {
    it('should group checks by type', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      const mockChecks = [
        { checkType: 'api' },
        { checkType: 'api' },
        { checkType: 'browser' },
        { checkType: 'tcp' },
        { checkType: 'heartbeat' }
      ];

      ds.request = mock(async () => mockChecks);

      const result = await ds.fetchChecksByType();

      expect(result.type).toBe('checks_by_type');
      expect(result.total).toBe(5);
      expect(result.types.api).toBe(2);
      expect(result.types.browser).toBe(1);
      expect(result.types.tcp).toBe(1);
      expect(result.types.heartbeat).toBe(1);
    });
  });

  describe('calculateTimeRange()', () => {
    it('should calculate time range for different periods', () => {
      const periods = ['1h', '6h', '24h', '7d', '30d'];
      const expectedDurations = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      periods.forEach(period => {
        const { from, to } = dataSource.calculateTimeRange(period);
        const duration = to.getTime() - from.getTime();
        expect(duration).toBeCloseTo(expectedDurations[period], -2);
      });
    });

    it('should default to 24h for unknown periods', () => {
      const { from, to } = dataSource.calculateTimeRange('unknown');
      const duration = to.getTime() - from.getTime();
      expect(duration).toBeCloseTo(24 * 60 * 60 * 1000, -2);
    });
  });

  describe('testConnection()', () => {
    it('should return false when credentials not configured', async () => {
      const result = await dataSource.testConnection();
      expect(result).toBe(false);
    });

    it('should return true when connection successful', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
      });

      ds.request = mock(async () => []);

      const result = await ds.testConnection();
      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      const ds = new ChecklyDataSource({
        apiKey: 'test-key',
        accountId: 'acc-123'
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

    it('should transform big-number data correctly for checks', () => {
      const mockResponse = {
        type: 'checks',
        total: 25,
        passing: 20,
        failing: 5
      };

      const result = dataSource.transformData(mockResponse, 'big-number', 'checks');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('trend');
      expect(result.value).toBe(25);
      expect(result.label).toBe('Total Checks');
      expect(result.unit).toBe('checks');
    });

    it('should transform big-number data correctly for uptime', () => {
      const mockResponse = {
        type: 'uptime',
        uptime: 99.5,
        total: 100,
        successful: 99,
        failed: 1
      };

      const result = dataSource.transformData(mockResponse, 'big-number', 'uptime');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('trend');
      expect(result.value).toBe(100); // Rounded
      expect(result.label).toBe('Uptime');
      expect(result.unit).toBe('%');
      expect(result.trend).toBe('up');
    });

    it('should transform gauge data correctly for uptime', () => {
      const mockResponse = {
        type: 'uptime',
        uptime: 98.7
      };

      const result = dataSource.transformData(mockResponse, 'gauge', 'uptime');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('min');
      expect(result).toHaveProperty('max');
      expect(result.value).toBe(99);
      expect(result.min).toBe(0);
      expect(result.max).toBe(100);
      expect(result.unit).toBe('%');
      expect(result.label).toBe('Uptime');
    });

    it('should transform line-chart data correctly', () => {
      const mockResponse = {
        type: 'response_time',
        avg: 150,
        history: [120, 130, 140, 150, 160]
      };

      const result = dataSource.transformData(mockResponse, 'line-chart', 'response_time');

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('values');
      expect(result.labels.length).toBe(5);
      expect(result.values).toEqual([120, 130, 140, 150, 160]);
      expect(result.series).toBe('Response Time');
    });

    it('should transform bar-chart data with check types', () => {
      const mockResponse = {
        type: 'checks_by_type',
        total: 31,
        types: {
          api: 15,
          browser: 8,
          heartbeat: 5,
          tcp: 3
        }
      };

      const result = dataSource.transformData(mockResponse, 'bar-chart', 'checks_by_type');

      expect(result).toHaveProperty('values');
      expect(Array.isArray(result.values)).toBe(true);
      expect(result.values.length).toBe(4);
      expect(result.values[0].label).toBe('Api');
      expect(result.values[0].value).toBe(15);
    });

    it('should transform status-grid data with checks', () => {
      const mockResponse = {
        type: 'checks',
        checks: [
          { id: 'check-1', name: 'API Check', activated: true, degraded: false, checkType: 'api' },
          { id: 'check-2', name: 'Browser Check', activated: true, degraded: true, checkType: 'browser' }
        ],
        total: 2
      };

      const result = dataSource.transformData(mockResponse, 'status-grid', 'checks');

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
      expect(data.value).toBeGreaterThanOrEqual(90); // Mock uptime is 90-100%
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
      expect(metrics.length).toBe(10);
    });

    it('should include total_checks metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const totalChecks = metrics.find(m => m.id === 'total_checks');

      expect(totalChecks).toBeDefined();
      expect(totalChecks.name).toBe('Total Checks');
      expect(totalChecks.metric).toBe('checks');
      expect(totalChecks.type).toBe('number');
    });

    it('should include uptime_percentage metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const uptime = metrics.find(m => m.id === 'uptime_percentage');

      expect(uptime).toBeDefined();
      expect(uptime.name).toBe('Uptime Percentage');
      expect(uptime.metric).toBe('uptime');
      expect(uptime.type).toBe('percentage');
    });

    it('should include avg_response_time metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const responseTime = metrics.find(m => m.id === 'avg_response_time');

      expect(responseTime).toBeDefined();
      expect(responseTime.metric).toBe('response_time');
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

    it('should include apiKey field', () => {
      const schema = dataSource.getConfigSchema();
      const apiKeyField = schema.fields.find(f => f.name === 'apiKey');

      expect(apiKeyField).toBeDefined();
      expect(apiKeyField.required).toBe(true);
      expect(apiKeyField.secure).toBe(true);
      expect(apiKeyField.envVar).toBe('CHECKLY_API_KEY');
    });

    it('should include accountId field', () => {
      const schema = dataSource.getConfigSchema();
      const accountField = schema.fields.find(f => f.name === 'accountId');

      expect(accountField).toBeDefined();
      expect(accountField.required).toBe(true);
      expect(accountField.secure).toBe(true);
      expect(accountField.envVar).toBe('CHECKLY_ACCOUNT_ID');
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
        metric: 'checks'
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
      const validMetrics = ['checks', 'check_results', 'uptime', 'response_time', 'failing_checks', 'check_frequency', 'checks_by_type'];

      validMetrics.forEach(metric => {
        const ds = new ChecklyDataSource({ apiKey: 'test-key', accountId: 'acc-123' });
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

  describe('Helper methods', () => {
    it('getMetricLabel should return correct labels', () => {
      expect(dataSource.getMetricLabel('checks')).toBe('Checks');
      expect(dataSource.getMetricLabel('check_results')).toBe('Check Results');
      expect(dataSource.getMetricLabel('uptime')).toBe('Uptime');
      expect(dataSource.getMetricLabel('response_time')).toBe('Response Time');
      expect(dataSource.getMetricLabel('failing_checks')).toBe('Failing Checks');
      expect(dataSource.getMetricLabel('check_frequency')).toBe('Check Frequency');
      expect(dataSource.getMetricLabel('checks_by_type')).toBe('Checks by Type');
    });

    it('getTypeColor should return correct colors', () => {
      expect(dataSource.getTypeColor('api')).toBe('#3B82F6');
      expect(dataSource.getTypeColor('browser')).toBe('#8B5CF6');
      expect(dataSource.getTypeColor('heartbeat')).toBe('#10B981');
      expect(dataSource.getTypeColor('tcp')).toBe('#F59E0B');
      expect(dataSource.getTypeColor('unknown')).toBe('#9CA3AF');
    });
  });
});
