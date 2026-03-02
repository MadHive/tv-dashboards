// ===========================================================================
// Looker Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { LookerDataSource } from '../../../server/data-sources/looker.js';

describe('Looker Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new LookerDataSource({});
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('looker');
      expect(dataSource.baseUrl).toBeUndefined();
      expect(dataSource.clientId).toBeUndefined();
      expect(dataSource.clientSecret).toBeUndefined();
      expect(dataSource.accessToken).toBeNull();
      expect(dataSource.tokenExpiry).toBeNull();
      expect(dataSource.metricCache).toBeInstanceOf(Map);
    });

    it('should accept custom configuration', () => {
      const ds = new LookerDataSource({
        baseUrl: 'https://test.looker.com:19999',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      });

      expect(ds.baseUrl).toBe('https://test.looker.com:19999');
      expect(ds.clientId).toBe('test-client-id');
      expect(ds.clientSecret).toBe('test-client-secret');
    });

    it('should use environment variables if available', () => {
      const originalUrl = process.env.LOOKER_BASE_URL;
      const originalId = process.env.LOOKER_CLIENT_ID;
      const originalSecret = process.env.LOOKER_CLIENT_SECRET;

      process.env.LOOKER_BASE_URL = 'https://env.looker.com:19999';
      process.env.LOOKER_CLIENT_ID = 'env-client-id';
      process.env.LOOKER_CLIENT_SECRET = 'env-client-secret';

      const ds = new LookerDataSource({});
      expect(ds.baseUrl).toBe('https://env.looker.com:19999');
      expect(ds.clientId).toBe('env-client-id');
      expect(ds.clientSecret).toBe('env-client-secret');

      // Restore original values
      if (originalUrl) process.env.LOOKER_BASE_URL = originalUrl;
      else delete process.env.LOOKER_BASE_URL;
      if (originalId) process.env.LOOKER_CLIENT_ID = originalId;
      else delete process.env.LOOKER_CLIENT_ID;
      if (originalSecret) process.env.LOOKER_CLIENT_SECRET = originalSecret;
      else delete process.env.LOOKER_CLIENT_SECRET;
    });

    it('should normalize base URL by removing trailing slash', async () => {
      const ds = new LookerDataSource({
        baseUrl: 'https://test.looker.com:19999/'
      });

      await ds.initialize();
      expect(ds.baseUrl).toBe('https://test.looker.com:19999');
    });
  });

  describe('initialize()', () => {
    it('should handle missing credentials gracefully', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(false);
    });

    it('should set isConnected to false on authentication failure', async () => {
      const ds = new LookerDataSource({
        baseUrl: 'https://test.looker.com:19999',
        clientId: 'invalid-id',
        clientSecret: 'invalid-secret'
      });

      // Mock failed authentication
      ds.authenticate = mock(async () => {
        throw new Error('Authentication failed');
      });

      await ds.initialize();
      expect(ds.isConnected).toBe(false);
    });
  });

  describe('authenticate()', () => {
    it('should set access token and expiry on successful authentication', async () => {
      const ds = new LookerDataSource({
        baseUrl: 'https://test.looker.com:19999',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      });

      // Mock successful authentication
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => ({
          access_token: 'mock-token',
          expires_in: 3600
        })
      }));

      await ds.authenticate();

      expect(ds.accessToken).toBe('mock-token');
      expect(ds.tokenExpiry).toBeGreaterThan(Date.now());
      expect(ds.tokenExpiry).toBeLessThanOrEqual(Date.now() + 3600000);
    });

    it('should throw error on failed authentication', async () => {
      const ds = new LookerDataSource({
        baseUrl: 'https://test.looker.com:19999',
        clientId: 'invalid-id',
        clientSecret: 'invalid-secret'
      });

      // Mock failed authentication
      global.fetch = mock(async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      }));

      await expect(ds.authenticate()).rejects.toThrow('Looker authentication failed: 401 Unauthorized');
    });

    it('should send credentials in form-encoded body', async () => {
      const ds = new LookerDataSource({
        baseUrl: 'https://test.looker.com:19999',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      });

      let capturedRequest;
      global.fetch = mock(async (url, options) => {
        capturedRequest = { url, options };
        return {
          ok: true,
          json: async () => ({
            access_token: 'mock-token',
            expires_in: 3600
          })
        };
      });

      await ds.authenticate();

      expect(capturedRequest.options.method).toBe('POST');
      expect(capturedRequest.options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(capturedRequest.options.body).toContain('client_id=test-id');
      expect(capturedRequest.options.body).toContain('client_secret=test-secret');
    });
  });

  describe('ensureAuthenticated()', () => {
    it('should authenticate if no token exists', async () => {
      const ds = new LookerDataSource({
        baseUrl: 'https://test.looker.com:19999',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      });

      ds.authenticate = mock(async () => {
        ds.accessToken = 'new-token';
        ds.tokenExpiry = Date.now() + 3600000;
      });

      await ds.ensureAuthenticated();

      expect(ds.authenticate).toHaveBeenCalled();
      expect(ds.accessToken).toBe('new-token');
    });

    it('should re-authenticate if token is expired', async () => {
      const ds = new LookerDataSource({
        baseUrl: 'https://test.looker.com:19999',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      });

      ds.accessToken = 'old-token';
      ds.tokenExpiry = Date.now() - 1000; // Expired

      ds.authenticate = mock(async () => {
        ds.accessToken = 'new-token';
        ds.tokenExpiry = Date.now() + 3600000;
      });

      await ds.ensureAuthenticated();

      expect(ds.authenticate).toHaveBeenCalled();
      expect(ds.accessToken).toBe('new-token');
    });

    it('should re-authenticate if token expires in less than 60 seconds', async () => {
      const ds = new LookerDataSource({
        baseUrl: 'https://test.looker.com:19999',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      });

      ds.accessToken = 'old-token';
      ds.tokenExpiry = Date.now() + 30000; // 30 seconds remaining

      ds.authenticate = mock(async () => {
        ds.accessToken = 'new-token';
        ds.tokenExpiry = Date.now() + 3600000;
      });

      await ds.ensureAuthenticated();

      expect(ds.authenticate).toHaveBeenCalled();
    });

    it('should not re-authenticate if token is valid', async () => {
      const ds = new LookerDataSource({
        baseUrl: 'https://test.looker.com:19999',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      });

      ds.accessToken = 'valid-token';
      ds.tokenExpiry = Date.now() + 3600000; // 1 hour remaining

      ds.authenticate = mock(async () => {
        ds.accessToken = 'new-token';
      });

      await ds.ensureAuthenticated();

      expect(ds.authenticate).not.toHaveBeenCalled();
      expect(ds.accessToken).toBe('valid-token');
    });
  });

  describe('makeRequest()', () => {
    it('should make authenticated request with correct headers', async () => {
      const ds = new LookerDataSource({
        baseUrl: 'https://test.looker.com:19999',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      });

      ds.accessToken = 'test-token';
      ds.tokenExpiry = Date.now() + 3600000;

      let capturedRequest;
      global.fetch = mock(async (url, options) => {
        capturedRequest = { url, options };
        return {
          ok: true,
          json: async () => ({ data: 'test' })
        };
      });

      await ds.makeRequest('/test-endpoint');

      expect(capturedRequest.url).toBe('https://test.looker.com:19999/api/4.0/test-endpoint');
      expect(capturedRequest.options.headers['Authorization']).toBe('token test-token');
      expect(capturedRequest.options.headers['Content-Type']).toBe('application/json');
    });

    it('should throw error on failed request', async () => {
      const ds = new LookerDataSource({
        baseUrl: 'https://test.looker.com:19999',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      });

      ds.accessToken = 'test-token';
      ds.tokenExpiry = Date.now() + 3600000;

      global.fetch = mock(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Resource not found'
      }));

      await expect(ds.makeRequest('/invalid-endpoint')).rejects.toThrow('Looker API error: 404 Not Found');
    });
  });

  describe('getMockData()', () => {
    it('should return mock data for big-number widget', () => {
      const data = dataSource.getMockData('big-number');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('label');
      expect(typeof data.value).toBe('number');
      expect(data.value).toBeGreaterThan(0);
    });

    it('should return mock data for gauge widget', () => {
      const data = dataSource.getMockData('gauge');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('min');
      expect(data).toHaveProperty('max');
      expect(data).toHaveProperty('unit');
      expect(data.min).toBe(0);
    });

    it('should return mock data for bar-chart widget', () => {
      const data = dataSource.getMockData('bar-chart');

      expect(data).toHaveProperty('values');
      expect(Array.isArray(data.values)).toBe(true);
      expect(data.values.length).toBeGreaterThan(0);
      expect(data.values[0]).toHaveProperty('label');
      expect(data.values[0]).toHaveProperty('value');
    });

    it('should return mock data for status-grid widget', () => {
      const data = dataSource.getMockData('status-grid');

      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0]).toHaveProperty('name');
      expect(data.items[0]).toHaveProperty('status');
      expect(['healthy', 'warning', 'error', 'stale']).toContain(data.items[0].status);
    });

    it('should return mock data for line-chart widget', () => {
      const data = dataSource.getMockData('line-chart');

      expect(data).toHaveProperty('labels');
      expect(data).toHaveProperty('values');
      expect(data).toHaveProperty('series');
      expect(Array.isArray(data.labels)).toBe(true);
      expect(Array.isArray(data.values)).toBe(true);
      expect(data.labels.length).toBe(12);
      expect(data.values.length).toBe(12);
    });

    it('should return mock data for table widget', () => {
      const data = dataSource.getMockData('table');

      expect(data).toHaveProperty('rows');
      expect(Array.isArray(data.rows)).toBe(true);
      expect(data.rows.length).toBeGreaterThan(0);
      expect(data.rows[0]).toHaveProperty('name');
      expect(data.rows[0]).toHaveProperty('folder');
    });
  });

  describe('transformData()', () => {
    it('should handle empty/null response', () => {
      const result = dataSource.transformData(null, 'big-number', 'dashboards');
      expect(result).toBeDefined();
    });

    it('should transform array data for big-number widget', () => {
      const mockData = [
        { id: '1', title: 'Dashboard 1' },
        { id: '2', title: 'Dashboard 2' },
        { id: '3', title: 'Dashboard 3' }
      ];

      const result = dataSource.transformData(mockData, 'big-number', 'dashboards');

      expect(result).toHaveProperty('value');
      expect(result.value).toBe(3);
      expect(result.label).toBe('Dashboards');
    });

    it('should transform array data for gauge widget', () => {
      const mockData = Array.from({ length: 5 }, (_, i) => ({ id: String(i) }));

      const result = dataSource.transformData(mockData, 'gauge', 'running_queries');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('min');
      expect(result).toHaveProperty('max');
      expect(result.value).toBe(5);
      expect(result.min).toBe(0);
      expect(result.max).toBeGreaterThanOrEqual(10); // 2x current
    });

    it('should transform array data for bar-chart widget', () => {
      const mockData = [
        { id: '1', title: 'Dashboard 1', folder: { name: 'Sales' } },
        { id: '2', title: 'Dashboard 2', folder: { name: 'Sales' } },
        { id: '3', title: 'Dashboard 3', folder: { name: 'Marketing' } }
      ];

      const result = dataSource.transformData(mockData, 'bar-chart', 'dashboards');

      expect(result).toHaveProperty('values');
      expect(Array.isArray(result.values)).toBe(true);
      expect(result.values.length).toBeGreaterThan(0);
    });

    it('should transform array data for status-grid widget', () => {
      const mockData = [
        { id: '1', title: 'Dashboard 1', view_count: 100, folder: { name: 'Sales' } },
        { id: '2', title: 'Dashboard 2', view_count: 200, space: { name: 'Marketing' } }
      ];

      const result = dataSource.transformData(mockData, 'status-grid', 'dashboards');

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBe(2);
      expect(result.items[0]).toHaveProperty('name');
      expect(result.items[0]).toHaveProperty('status');
      expect(result.items[0]).toHaveProperty('value');
    });

    it('should limit status-grid to 20 items', () => {
      const mockData = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        title: `Item ${i}`
      }));

      const result = dataSource.transformData(mockData, 'status-grid', 'dashboards');

      expect(result.items.length).toBe(20);
    });

    it('should transform array data for table widget', () => {
      const mockData = [
        {
          id: '1',
          title: 'Dashboard 1',
          folder: { name: 'Sales' },
          view_count: 100,
          updated_at: '2026-03-01'
        }
      ];

      const result = dataSource.transformData(mockData, 'table', 'dashboards');

      expect(result).toHaveProperty('rows');
      expect(Array.isArray(result.rows)).toBe(true);
      expect(result.rows[0]).toHaveProperty('id');
      expect(result.rows[0]).toHaveProperty('name');
      expect(result.rows[0]).toHaveProperty('folder');
      expect(result.rows[0]).toHaveProperty('views');
    });

    it('should limit table to 100 rows', () => {
      const mockData = Array.from({ length: 200 }, (_, i) => ({
        id: String(i),
        title: `Item ${i}`
      }));

      const result = dataSource.transformData(mockData, 'table', 'dashboards');

      expect(result.rows.length).toBe(100);
    });
  });

  describe('transformQueryResults()', () => {
    it('should transform query results for big-number widget', () => {
      const mockResults = [
        { total_sales: 150000 }
      ];

      const result = dataSource.transformQueryResults(mockResults, 'big-number');

      expect(result).toHaveProperty('value');
      expect(result.value).toBe(150000);
    });

    it('should transform query results for bar-chart widget', () => {
      const mockResults = [
        { region: 'North', sales: 100000 },
        { region: 'South', sales: 75000 },
        { region: 'East', sales: 85000 }
      ];

      const result = dataSource.transformQueryResults(mockResults, 'bar-chart');

      expect(result).toHaveProperty('values');
      expect(Array.isArray(result.values)).toBe(true);
      expect(result.values.length).toBe(3);
      expect(result.values[0].label).toBe('North');
      expect(result.values[0].value).toBe(100000);
    });

    it('should transform query results for line-chart widget', () => {
      const mockResults = [
        { date: '2026-03-01', count: 100 },
        { date: '2026-03-02', count: 120 }
      ];

      const result = dataSource.transformQueryResults(mockResults, 'line-chart');

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('values');
      expect(result).toHaveProperty('series');
      expect(result.labels.length).toBe(2);
      expect(result.values).toEqual([100, 120]);
    });

    it('should handle empty query results', () => {
      const result = dataSource.transformQueryResults([], 'big-number');
      expect(result).toBeDefined();
    });
  });

  describe('groupByProperty()', () => {
    it('should group items by folder property', () => {
      const items = [
        { id: '1', folder: { name: 'Sales' } },
        { id: '2', folder: { name: 'Sales' } },
        { id: '3', folder: { name: 'Marketing' } }
      ];

      const grouped = dataSource.groupByProperty(items, 'folder');

      expect(grouped).toHaveProperty('Sales');
      expect(grouped).toHaveProperty('Marketing');
      expect(grouped.Sales.length).toBe(2);
      expect(grouped.Marketing.length).toBe(1);
    });

    it('should fallback to space property if folder not found', () => {
      const items = [
        { id: '1', space: { name: 'Workspace A' } },
        { id: '2', space: { name: 'Workspace A' } }
      ];

      const grouped = dataSource.groupByProperty(items, 'folder', 'space');

      expect(grouped).toHaveProperty('Workspace A');
      expect(grouped['Workspace A'].length).toBe(2);
    });

    it('should use Uncategorized for items without properties', () => {
      const items = [
        { id: '1' },
        { id: '2' }
      ];

      const grouped = dataSource.groupByProperty(items, 'folder', 'space');

      expect(grouped).toHaveProperty('Uncategorized');
      expect(grouped.Uncategorized.length).toBe(2);
    });
  });

  describe('getItemStatus()', () => {
    it('should return explicit status if available', () => {
      const item = { status: 'ACTIVE' };
      expect(dataSource.getItemStatus(item)).toBe('active');
    });

    it('should return healthy for recently updated items', () => {
      const item = {
        updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
      };
      expect(dataSource.getItemStatus(item)).toBe('healthy');
    });

    it('should return warning for items updated 7-30 days ago', () => {
      const item = {
        updated_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() // 15 days ago
      };
      expect(dataSource.getItemStatus(item)).toBe('warning');
    });

    it('should return stale for items updated over 30 days ago', () => {
      const item = {
        updated_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days ago
      };
      expect(dataSource.getItemStatus(item)).toBe('stale');
    });

    it('should return unknown for items without status or updated_at', () => {
      const item = { id: '1' };
      expect(dataSource.getItemStatus(item)).toBe('unknown');
    });
  });

  describe('getAvailableMetrics()', () => {
    it('should return array of metrics', () => {
      const metrics = dataSource.getAvailableMetrics();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThanOrEqual(8);
    });

    it('should include dashboard count metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const metric = metrics.find(m => m.id === 'dashboard_count');

      expect(metric).toBeDefined();
      expect(metric.metric).toBe('dashboards');
      expect(metric.type).toBe('number');
    });

    it('should include look count metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const metric = metrics.find(m => m.id === 'look_count');

      expect(metric).toBeDefined();
      expect(metric.metric).toBe('looks');
    });

    it('should include running queries metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const metric = metrics.find(m => m.id === 'running_queries_count');

      expect(metric).toBeDefined();
      expect(metric.metric).toBe('running_queries');
      expect(metric.widgets).toContain('gauge');
    });

    it('should include scheduled plans metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const metric = metrics.find(m => m.id === 'scheduled_plans_count');

      expect(metric).toBeDefined();
      expect(metric.metric).toBe('scheduled_plans');
    });

    it('should include active users metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const metric = metrics.find(m => m.id === 'active_users');

      expect(metric).toBeDefined();
      expect(metric.metric).toBe('users');
    });

    it('should have proper widget associations', () => {
      const metrics = dataSource.getAvailableMetrics();

      metrics.forEach(metric => {
        expect(metric).toHaveProperty('id');
        expect(metric).toHaveProperty('name');
        expect(metric).toHaveProperty('description');
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
      expect(schema.name).toBe('Looker');
    });

    it('should include base URL field', () => {
      const schema = dataSource.getConfigSchema();
      const field = schema.fields.find(f => f.name === 'baseUrl');

      expect(field).toBeDefined();
      expect(field.type).toBe('string');
      expect(field.required).toBe(true);
      expect(field.envVar).toBe('LOOKER_BASE_URL');
      expect(field.example).toContain('looker.com:19999');
    });

    it('should include client ID field', () => {
      const schema = dataSource.getConfigSchema();
      const field = schema.fields.find(f => f.name === 'clientId');

      expect(field).toBeDefined();
      expect(field.type).toBe('string');
      expect(field.required).toBe(true);
      expect(field.secure).toBe(true);
      expect(field.envVar).toBe('LOOKER_CLIENT_ID');
    });

    it('should include client secret field', () => {
      const schema = dataSource.getConfigSchema();
      const field = schema.fields.find(f => f.name === 'clientSecret');

      expect(field).toBeDefined();
      expect(field.type).toBe('string');
      expect(field.required).toBe(true);
      expect(field.secure).toBe(true);
      expect(field.envVar).toBe('LOOKER_CLIENT_SECRET');
    });

    it('should include metric selector', () => {
      const schema = dataSource.getConfigSchema();
      const field = schema.fields.find(f => f.name === 'metric');

      expect(field).toBeDefined();
      expect(field.type).toBe('select');
      expect(Array.isArray(field.options)).toBe(true);
      expect(field.options).toContain('dashboards');
      expect(field.options).toContain('looks');
      expect(field.options).toContain('running_queries');
      expect(field.default).toBe('dashboards');
    });

    it('should include optional ID fields', () => {
      const schema = dataSource.getConfigSchema();
      const queryId = schema.fields.find(f => f.name === 'queryId');
      const dashboardId = schema.fields.find(f => f.name === 'dashboardId');
      const lookId = schema.fields.find(f => f.name === 'lookId');

      expect(queryId).toBeDefined();
      expect(dashboardId).toBeDefined();
      expect(lookId).toBeDefined();

      expect(queryId.required).toBe(false);
      expect(dashboardId.required).toBe(false);
      expect(lookId.required).toBe(false);
    });
  });

  describe('validateWidgetConfig()', () => {
    it('should pass validation without credentials (uses mock data)', () => {
      const errors = dataSource.validateWidgetConfig({
        id: 'test-widget',
        type: 'big-number'
      });

      expect(errors).toEqual([]);
    });

    it('should require widget type', () => {
      const errors = dataSource.validateWidgetConfig({
        id: 'test-widget'
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('type');
    });

    it('should require widget id', () => {
      const errors = dataSource.validateWidgetConfig({
        type: 'big-number'
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('id');
    });
  });

  describe('fetchMetrics() - without connection', () => {
    it('should return mock data when client not initialized', async () => {
      const result = await dataSource.fetchMetrics({
        id: 'test-widget',
        type: 'big-number',
        metric: 'dashboards'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('widgetId');
      expect(result.source).toBe('looker');
      expect(result.widgetId).toBe('test-widget');
    });

    it('should return appropriate mock data for different widget types', async () => {
      const gaugeResult = await dataSource.fetchMetrics({
        id: 'gauge-widget',
        type: 'gauge',
        metric: 'running_queries'
      });

      expect(gaugeResult.data).toHaveProperty('value');
      expect(gaugeResult.data).toHaveProperty('min');
      expect(gaugeResult.data).toHaveProperty('max');

      const barChartResult = await dataSource.fetchMetrics({
        id: 'bar-widget',
        type: 'bar-chart',
        metric: 'dashboards'
      });

      expect(barChartResult.data).toHaveProperty('values');
      expect(Array.isArray(barChartResult.data.values)).toBe(true);
    });
  });

  describe('testConnection()', () => {
    it('should return false when credentials not configured', async () => {
      const result = await dataSource.testConnection();
      expect(result).toBe(false);
    });

    it('should return true on successful connection', async () => {
      const ds = new LookerDataSource({
        baseUrl: 'https://test.looker.com:19999',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      });

      ds.ensureAuthenticated = mock(async () => {
        ds.accessToken = 'test-token';
        ds.tokenExpiry = Date.now() + 3600000;
      });

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => ({ id: 'test-user' })
      }));

      const result = await ds.testConnection();
      expect(result).toBe(true);
    });

    it('should return false on connection failure', async () => {
      const ds = new LookerDataSource({
        baseUrl: 'https://test.looker.com:19999',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      });

      ds.ensureAuthenticated = mock(async () => {
        throw new Error('Authentication failed');
      });

      const result = await ds.testConnection();
      expect(result).toBe(false);
    });
  });
});
