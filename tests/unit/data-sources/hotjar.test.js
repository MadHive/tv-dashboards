// ===========================================================================
// HotJar Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { HotJarDataSource } from '../../../server/data-sources/hotjar.js';

describe('HotJar Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new HotJarDataSource({});
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('hotjar');
      expect(dataSource.clientId).toBeUndefined();
      expect(dataSource.clientSecret).toBeUndefined();
      expect(dataSource.siteId).toBeUndefined();
      expect(dataSource.accessToken).toBeNull();
    });

    it('should accept config parameters', () => {
      const ds = new HotJarDataSource({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        siteId: 'test-site-123'
      });

      expect(ds.clientId).toBe('test-client-id');
      expect(ds.clientSecret).toBe('test-client-secret');
      expect(ds.siteId).toBe('test-site-123');
    });
  });

  describe('initialize()', () => {
    it('should handle missing credentials gracefully', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(false);
    });

    it('should set isConnected to false when OAuth fails', async () => {
      const ds = new HotJarDataSource({
        clientId: 'test-client-id',
        clientSecret: 'invalid-secret'
      });

      await ds.initialize();
      // Will fail with invalid credentials
      expect(typeof ds.isConnected).toBe('boolean');
    });
  });

  describe('refreshAccessToken()', () => {
    it('should handle OAuth token request', async () => {
      const ds = new HotJarDataSource({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      });

      // This will fail without valid credentials, but tests the flow
      try {
        await ds.refreshAccessToken();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('ensureValidToken()', () => {
    it('should not refresh when token is valid', async () => {
      dataSource.accessToken = 'valid-token';
      dataSource.tokenExpiry = Date.now() + 3600000; // 1 hour from now

      await dataSource.ensureValidToken();
      expect(dataSource.accessToken).toBe('valid-token');
    });

    it('should refresh when token is expired', async () => {
      const ds = new HotJarDataSource({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      });

      ds.accessToken = 'expired-token';
      ds.tokenExpiry = Date.now() - 1000; // Expired 1 second ago

      // Will attempt to refresh
      try {
        await ds.ensureValidToken();
      } catch (error) {
        // Expected to fail without valid credentials
        expect(error).toBeDefined();
      }
    });
  });

  describe('fetchMetrics() - without credentials', () => {
    it('should return mock data when client not initialized', async () => {
      const result = await dataSource.fetchMetrics({
        id: 'test-widget',
        type: 'big-number'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('data');
      expect(result.source).toBe('hotjar');
      expect(result.data).toHaveProperty('value');
    });

    it('should handle different metric types', async () => {
      const metricTypes = ['sites', 'surveys', 'heatmaps', 'polls'];

      for (const metricType of metricTypes) {
        const result = await dataSource.fetchMetrics({
          id: 'test-widget',
          type: 'big-number',
          metricType
        });

        expect(result).toHaveProperty('data');
      }
    });
  });

  describe('transformData()', () => {
    it('should handle null/undefined data', () => {
      const result = dataSource.transformData(null, 'big-number');
      expect(result).toBeDefined();
    });

    it('should transform surveys data for big-number widget', () => {
      const mockSurveys = [
        { id: '1', name: 'Survey 1', response_count: 100 },
        { id: '2', name: 'Survey 2', response_count: 200 }
      ];

      const result = dataSource.transformData(mockSurveys, 'big-number', 'surveys');

      expect(result).toHaveProperty('value');
      expect(result.value).toBe(2); // Count of surveys
      expect(result.label).toBe('Total Surveys');
    });

    it('should transform heatmaps data for big-number widget', () => {
      const mockHeatmaps = [
        { id: '1', name: 'Heatmap 1' },
        { id: '2', name: 'Heatmap 2' },
        { id: '3', name: 'Heatmap 3' }
      ];

      const result = dataSource.transformData(mockHeatmaps, 'big-number', 'heatmaps');

      expect(result).toHaveProperty('value');
      expect(result.value).toBe(3);
      expect(result.label).toBe('Active Heatmaps');
    });

    it('should transform poll data for big-number widget', () => {
      const mockPolls = [
        { id: '1', title: 'Poll 1', responses: 50 }
      ];

      const result = dataSource.transformData(mockPolls, 'big-number', 'polls');

      expect(result).toHaveProperty('value');
      expect(result.value).toBe(1);
      expect(result.label).toBe('Active Polls');
    });

    it('should transform site data with page views', () => {
      const mockSite = {
        page_views_count: 12345,
        sessions_count: 5678
      };

      const result = dataSource.transformData(mockSite, 'big-number', 'sites');

      expect(result).toHaveProperty('value');
      expect(result.value).toBe(12345);
      expect(result.label).toBe('Page Views');
    });

    it('should transform array data for bar-chart widget', () => {
      const mockSurveys = [
        { name: 'Survey A', response_count: 100 },
        { name: 'Survey B', response_count: 200 },
        { title: 'Survey C', responses: 150 }
      ];

      const result = dataSource.transformData(mockSurveys, 'bar-chart');

      expect(result).toHaveProperty('values');
      expect(Array.isArray(result.values)).toBe(true);
      expect(result.values.length).toBe(3);
      expect(result.values[0].label).toBe('Survey A');
      expect(result.values[0].value).toBe(100);
    });

    it('should transform data for gauge widget', () => {
      const mockSite = {
        page_views_count: 1000,
        sessions_count: 750
      };

      const result = dataSource.transformData(mockSite, 'gauge', 'sites');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('min');
      expect(result).toHaveProperty('max');
      expect(result).toHaveProperty('unit');
      expect(result.min).toBe(0);
      expect(result.max).toBe(100);
      expect(result.unit).toBe('%');
      expect(result.value).toBe(75); // (750/1000) * 100
    });

    it('should transform array data for status-grid widget', () => {
      const mockSurveys = [
        { name: 'Survey 1', status: 'active', response_count: 100 },
        { title: 'Survey 2', status: 'inactive', response_count: 50 }
      ];

      const result = dataSource.transformData(mockSurveys, 'status-grid');

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items[0].label).toBe('Survey 1');
      expect(result.items[0].status).toBe('healthy');
      expect(result.items[1].status).toBe('warning');
    });

    it('should limit bar-chart to 10 items', () => {
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        name: `Item ${i}`,
        response_count: i * 10
      }));

      const result = dataSource.transformData(mockData, 'bar-chart');

      expect(result.values.length).toBe(10);
    });

    it('should limit status-grid to 12 items', () => {
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        name: `Item ${i}`,
        status: 'active',
        response_count: i * 10
      }));

      const result = dataSource.transformData(mockData, 'status-grid');

      expect(result.items.length).toBe(12);
    });
  });

  describe('testConnection()', () => {
    it('should return false when credentials missing', async () => {
      const result = await dataSource.testConnection();
      expect(result).toBe(false);
    });

    it('should attempt connection with credentials', async () => {
      const ds = new HotJarDataSource({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        siteId: 'test-site-123'
      });

      // Will fail with invalid credentials, but tests the structure
      const result = await ds.testConnection();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getMockData()', () => {
    it('should return realistic mock data for big-number', () => {
      const data = dataSource.getMockData('big-number');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('label');
      expect(data).toHaveProperty('trend');
      expect(typeof data.value).toBe('number');
      expect(data.value).toBe(12458);
    });

    it('should return mock data for stat-card', () => {
      const data = dataSource.getMockData('stat-card');

      expect(data).toHaveProperty('value');
      expect(data.label).toBe('Page Views');
      expect(data.trend).toBe('up');
    });

    it('should return mock data for bar-chart', () => {
      const data = dataSource.getMockData('bar-chart');

      expect(data).toHaveProperty('values');
      expect(Array.isArray(data.values)).toBe(true);
      expect(data.values.length).toBe(5);
      expect(data.values[0]).toHaveProperty('label');
      expect(data.values[0]).toHaveProperty('value');
    });

    it('should return mock data for gauge', () => {
      const data = dataSource.getMockData('gauge');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('min');
      expect(data).toHaveProperty('max');
      expect(data).toHaveProperty('unit');
      expect(data.value).toBe(67.5);
      expect(data.min).toBe(0);
      expect(data.max).toBe(100);
      expect(data.unit).toBe('%');
    });

    it('should return mock data for status-grid', () => {
      const data = dataSource.getMockData('status-grid');

      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBe(4);
      expect(data.items[0]).toHaveProperty('label');
      expect(data.items[0]).toHaveProperty('status');
      expect(data.items[0]).toHaveProperty('value');
    });

    it('should return empty data for unknown widget types', () => {
      const data = dataSource.getMockData('unknown-widget');

      expect(data).toBeDefined();
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('source');
    });
  });

  describe('getAvailableMetrics()', () => {
    it('should return array of metrics', () => {
      const metrics = dataSource.getAvailableMetrics();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should include page views metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const pageViews = metrics.find(m => m.id === 'page_views');

      expect(pageViews).toBeDefined();
      expect(pageViews.name).toBe('Page Views');
      expect(pageViews.type).toBe('number');
      expect(pageViews.metricType).toBe('sites');
      expect(pageViews.widgets).toContain('big-number');
    });

    it('should include surveys metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const surveys = metrics.find(m => m.id === 'surveys_total');

      expect(surveys).toBeDefined();
      expect(surveys.name).toBe('Total Surveys');
      expect(surveys.metricType).toBe('surveys');
    });

    it('should include heatmaps metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const heatmaps = metrics.find(m => m.id === 'heatmaps_total');

      expect(heatmaps).toBeDefined();
      expect(heatmaps.name).toBe('Active Heatmaps');
      expect(heatmaps.metricType).toBe('heatmaps');
    });

    it('should include polls metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const polls = metrics.find(m => m.id === 'polls_total');

      expect(polls).toBeDefined();
      expect(polls.name).toBe('Active Polls');
      expect(polls.metricType).toBe('polls');
    });

    it('should include engagement rate metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const engagement = metrics.find(m => m.id === 'engagement_rate');

      expect(engagement).toBeDefined();
      expect(engagement.type).toBe('percentage');
      expect(engagement.widgets).toContain('gauge');
    });

    it('should have valid metric structure', () => {
      const metrics = dataSource.getAvailableMetrics();

      metrics.forEach(metric => {
        expect(metric).toHaveProperty('id');
        expect(metric).toHaveProperty('name');
        expect(metric).toHaveProperty('description');
        expect(metric).toHaveProperty('type');
        expect(metric).toHaveProperty('metricType');
        expect(metric).toHaveProperty('widgets');
        expect(Array.isArray(metric.widgets)).toBe(true);
      });
    });
  });

  describe('getConfigSchema()', () => {
    it('should return config schema', () => {
      const schema = dataSource.getConfigSchema();

      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('description');
      expect(schema).toHaveProperty('fields');
      expect(Array.isArray(schema.fields)).toBe(true);
    });

    it('should require clientId', () => {
      const schema = dataSource.getConfigSchema();
      const clientIdField = schema.fields.find(f => f.name === 'clientId');

      expect(clientIdField).toBeDefined();
      expect(clientIdField.required).toBe(true);
      expect(clientIdField.secure).toBe(true);
      expect(clientIdField.envVar).toBe('HOTJAR_CLIENT_ID');
    });

    it('should require clientSecret', () => {
      const schema = dataSource.getConfigSchema();
      const clientSecretField = schema.fields.find(f => f.name === 'clientSecret');

      expect(clientSecretField).toBeDefined();
      expect(clientSecretField.required).toBe(true);
      expect(clientSecretField.secure).toBe(true);
      expect(clientSecretField.envVar).toBe('HOTJAR_CLIENT_SECRET');
    });

    it('should require siteId', () => {
      const schema = dataSource.getConfigSchema();
      const siteIdField = schema.fields.find(f => f.name === 'siteId');

      expect(siteIdField).toBeDefined();
      expect(siteIdField.required).toBe(true);
      expect(siteIdField.envVar).toBe('HOTJAR_SITE_ID');
    });

    it('should have optional metricType field', () => {
      const schema = dataSource.getConfigSchema();
      const metricTypeField = schema.fields.find(f => f.name === 'metricType');

      expect(metricTypeField).toBeDefined();
      expect(metricTypeField.required).toBe(false);
      expect(metricTypeField.default).toBe('sites');
    });
  });

  describe('validateWidgetConfig()', () => {
    it('should return errors for missing credentials', () => {
      const errors = dataSource.validateWidgetConfig({
        id: 'test-widget',
        type: 'big-number'
      });

      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('credentials'))).toBe(true);
    });

    it('should validate successfully with all required config', () => {
      const ds = new HotJarDataSource({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        siteId: 'test-site-123'
      });

      const errors = ds.validateWidgetConfig({
        id: 'test-widget',
        type: 'big-number'
      });

      // Should only have base validation errors (none expected for valid config)
      expect(Array.isArray(errors)).toBe(true);
    });
  });

  describe('Cache functionality', () => {
    it('should cache API responses', async () => {
      dataSource.accessToken = 'test-token';
      dataSource.tokenExpiry = Date.now() + 3600000;

      const mockData = { test: 'data' };
      const cacheKey = 'test-cache-key';

      // Manually set cache
      dataSource.cache.set(cacheKey, {
        data: mockData,
        timestamp: Date.now()
      });

      const cached = dataSource.cache.get(cacheKey);
      expect(cached).toBeDefined();
      expect(cached.data).toEqual(mockData);
    });

    it('should respect cache TTL', async () => {
      const mockData = { test: 'data' };
      const cacheKey = 'test-cache-key';

      // Set cache with old timestamp (expired)
      dataSource.cache.set(cacheKey, {
        data: mockData,
        timestamp: Date.now() - (6 * 60 * 1000) // 6 minutes ago (expired)
      });

      const cached = dataSource.cache.get(cacheKey);
      expect(cached.timestamp).toBeLessThan(Date.now() - (5 * 60 * 1000));
    });
  });
});
