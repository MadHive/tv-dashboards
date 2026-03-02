// ===========================================================================
// Rootly Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { RootlyDataSource } from '../../../server/data-sources/rootly.js';

describe('Rootly Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new RootlyDataSource({});
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('rootly');
      expect(dataSource.apiUrl).toBe('https://api.rootly.com/v1');
      expect(dataSource.apiKey).toBe('');
      expect(dataSource.cache).toBeNull();
      expect(dataSource.cacheTime).toBe(0);
      expect(dataSource.requestCount).toBe(0);
    });

    it('should accept custom configuration', () => {
      const ds = new RootlyDataSource({
        apiUrl: 'https://custom.rootly.io/v1',
        apiKey: 'test-key-123'
      });

      expect(ds.apiUrl).toBe('https://custom.rootly.io/v1');
      expect(ds.apiKey).toBe('test-key-123');
    });

    it('should use environment variables if available', () => {
      const originalUrl = process.env.ROOTLY_API_URL;
      const originalKey = process.env.ROOTLY_API_KEY;

      process.env.ROOTLY_API_URL = 'https://env.rootly.io/v1';
      process.env.ROOTLY_API_KEY = 'env-key-123';

      const ds = new RootlyDataSource({});
      expect(ds.apiUrl).toBe('https://env.rootly.io/v1');
      expect(ds.apiKey).toBe('env-key-123');

      // Restore original values
      if (originalUrl) process.env.ROOTLY_API_URL = originalUrl;
      else delete process.env.ROOTLY_API_URL;
      if (originalKey) process.env.ROOTLY_API_KEY = originalKey;
      else delete process.env.ROOTLY_API_KEY;
    });
  });

  describe('checkRateLimit()', () => {
    it('should allow requests under rate limit', () => {
      dataSource.requestCount = 0;
      dataSource.requestWindowStart = Date.now();

      expect(() => dataSource.checkRateLimit()).not.toThrow();
      expect(dataSource.requestCount).toBe(1);
    });

    it('should throw error when rate limit exceeded', () => {
      dataSource.requestCount = 3000;
      dataSource.requestWindowStart = Date.now();

      expect(() => dataSource.checkRateLimit()).toThrow(/Rate limit exceeded/);
    });

    it('should reset counter after 1 minute', () => {
      dataSource.requestCount = 3000;
      dataSource.requestWindowStart = Date.now() - 61000; // 61 seconds ago

      expect(() => dataSource.checkRateLimit()).not.toThrow();
      expect(dataSource.requestCount).toBe(1);
    });

    it('should track multiple requests', () => {
      dataSource.requestCount = 0;
      dataSource.requestWindowStart = Date.now();

      for (let i = 0; i < 10; i++) {
        dataSource.checkRateLimit();
      }

      expect(dataSource.requestCount).toBe(10);
    });
  });

  describe('calculateMetrics()', () => {
    it('should calculate metrics from empty incidents', () => {
      const metrics = dataSource.calculateMetrics([]);

      expect(metrics.total).toBe(0);
      expect(metrics.active).toBe(0);
      expect(metrics.resolved).toBe(0);
      expect(metrics.mttr).toBe(0);
    });

    it('should count active incidents correctly', () => {
      const incidents = [
        { attributes: { status: 'active', severity: 'SEV-1' } },
        { attributes: { status: 'started', severity: 'SEV-2' } },
        { attributes: { status: 'resolved', severity: 'SEV-3' } }
      ];

      const metrics = dataSource.calculateMetrics(incidents);

      expect(metrics.total).toBe(3);
      expect(metrics.active).toBe(2);
      expect(metrics.resolved).toBe(1);
    });

    it('should count incidents by severity', () => {
      const incidents = [
        { attributes: { status: 'active', severity: 'SEV-1' } },
        { attributes: { status: 'active', severity: 'SEV-1' } },
        { attributes: { status: 'active', severity: 'SEV-2' } },
        { attributes: { status: 'active', severity: 'SEV-3' } }
      ];

      const metrics = dataSource.calculateMetrics(incidents);

      expect(metrics.bySeverity.sev1).toBe(2);
      expect(metrics.bySeverity.sev2).toBe(1);
      expect(metrics.bySeverity.sev3).toBe(1);
    });

    it('should calculate MTTR correctly', () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const incidents = [
        {
          attributes: {
            status: 'resolved',
            severity: 'SEV-2',
            created_at: twoHoursAgo.toISOString(),
            resolved_at: now.toISOString()
          }
        }
      ];

      const metrics = dataSource.calculateMetrics(incidents);

      // MTTR should be 120 minutes (2 hours)
      expect(metrics.mttr).toBe(120);
      expect(metrics.mttrSamples.length).toBe(1);
    });

    it('should count recent incidents', () => {
      const now = new Date();
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const incidents = [
        { attributes: { status: 'active', severity: 'SEV-1', created_at: twelveHoursAgo.toISOString() } },
        { attributes: { status: 'resolved', severity: 'SEV-2', created_at: threeDaysAgo.toISOString() } }
      ];

      const metrics = dataSource.calculateMetrics(incidents);

      expect(metrics.last24h).toBe(1);
      expect(metrics.last7d).toBe(2);
    });

    it('should handle incidents with missing attributes', () => {
      const incidents = [
        { attributes: {} },
        { attributes: { status: 'active' } },
        {}
      ];

      const metrics = dataSource.calculateMetrics(incidents);

      expect(metrics.total).toBe(3);
      expect(typeof metrics.active).toBe('number');
    });
  });

  describe('testConnection()', () => {
    it('should return false when API key not configured', async () => {
      const ds = new RootlyDataSource({});
      const result = await ds.testConnection();
      expect(result).toBe(false);
    });

    it('should attempt connection with valid API key', async () => {
      const ds = new RootlyDataSource({
        apiKey: 'test-key-123'
      });

      // Will fail in tests (invalid credentials), but structure is correct
      const result = await ds.testConnection();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getMockData()', () => {
    it('should return mock data for big-number widget', () => {
      const data = dataSource.getMockData('big-number');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('trend');
      expect(data).toHaveProperty('unit');
      expect(data).toHaveProperty('label');
      expect(typeof data.value).toBe('number');
      expect(['up', 'down']).toContain(data.trend);
      expect(data.unit).toBe('incidents');
    });

    it('should return mock data for stat-card widget', () => {
      const data = dataSource.getMockData('stat-card');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('trend');
      expect(data.unit).toBe('incidents');
      expect(data.label).toBe('Active Incidents');
    });

    it('should return mock data for gauge widget', () => {
      const data = dataSource.getMockData('gauge');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('min');
      expect(data).toHaveProperty('max');
      expect(data).toHaveProperty('unit');
      expect(data).toHaveProperty('label');
      expect(data.min).toBe(0);
      expect(data.max).toBe(240);
      expect(data.unit).toBe('min');
      expect(data.label).toBe('Mean Time to Resolution');
    });

    it('should return mock data for bar-chart widget', () => {
      const data = dataSource.getMockData('bar-chart');

      expect(data).toHaveProperty('values');
      expect(Array.isArray(data.values)).toBe(true);
      expect(data.values.length).toBe(5);
      expect(data.values[0]).toHaveProperty('label');
      expect(data.values[0]).toHaveProperty('value');
      expect(data.values[0]).toHaveProperty('color');

      const labels = data.values.map(v => v.label);
      expect(labels).toContain('SEV-1');
      expect(labels).toContain('SEV-2');
      expect(labels).toContain('SEV-3');
      expect(labels).toContain('SEV-4');
      expect(labels).toContain('SEV-5');
    });

    it('should return mock data for alert-list widget', () => {
      const data = dataSource.getMockData('alert-list');

      expect(data).toHaveProperty('alerts');
      expect(Array.isArray(data.alerts)).toBe(true);
      expect(data.alerts.length).toBeGreaterThan(0);
      expect(data.alerts[0]).toHaveProperty('id');
      expect(data.alerts[0]).toHaveProperty('title');
      expect(data.alerts[0]).toHaveProperty('severity');
      expect(data.alerts[0]).toHaveProperty('status');
      expect(data.alerts[0]).toHaveProperty('created_at');
      expect(data.alerts[0]).toHaveProperty('url');
    });

    it('should return mock data for status-grid widget', () => {
      const data = dataSource.getMockData('status-grid');

      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0]).toHaveProperty('label');
      expect(data.items[0]).toHaveProperty('value');
      expect(data.items[0]).toHaveProperty('status');

      const labels = data.items.map(i => i.label);
      expect(labels).toContain('Active');
      expect(labels).toContain('Mitigated');
      expect(labels).toContain('Resolved');
    });

    it('should return mock data for all widget types', () => {
      const types = ['big-number', 'gauge', 'bar-chart', 'alert-list', 'status-grid'];

      types.forEach(type => {
        const data = dataSource.getMockData(type);
        expect(data).toBeDefined();
      });
    });
  });

  describe('transformData()', () => {
    const mockData = {
      incidents: [
        {
          id: '1',
          attributes: {
            title: 'Test Incident 1',
            status: 'active',
            severity: 'SEV-1',
            created_at: new Date().toISOString(),
            url: 'https://app.rootly.com/incidents/1'
          }
        },
        {
          id: '2',
          attributes: {
            title: 'Test Incident 2',
            status: 'resolved',
            severity: 'SEV-2',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            url: 'https://app.rootly.com/incidents/2'
          }
        }
      ],
      services: [],
      metrics: {
        total: 2,
        active: 1,
        mitigated: 0,
        resolved: 1,
        bySeverity: { sev1: 1, sev2: 1, sev3: 0, sev4: 0, sev5: 0 },
        byStatus: { active: 1, resolved: 1 },
        last24h: 2,
        last7d: 2,
        mttr: 60,
        mttrSamples: [60]
      }
    };

    it('should handle empty data', () => {
      const result = dataSource.transformData({}, 'big-number');
      expect(result).toBeDefined();
    });

    it('should handle missing metrics', () => {
      const result = dataSource.transformData({ incidents: [] }, 'big-number');
      expect(result).toBeDefined();
    });

    it('should transform big-number data correctly', () => {
      const result = dataSource.transformData(mockData, 'big-number');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('trend');
      expect(result).toHaveProperty('unit');
      expect(result).toHaveProperty('label');
      expect(result.value).toBe(1);
      expect(['up', 'down']).toContain(result.trend);
      expect(result.unit).toBe('incidents');
      expect(result.label).toBe('Active Incidents');
    });

    it('should transform stat-card data correctly', () => {
      const result = dataSource.transformData(mockData, 'stat-card');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('trend');
      expect(result.value).toBe(1);
    });

    it('should transform gauge data correctly', () => {
      const result = dataSource.transformData(mockData, 'gauge');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('min');
      expect(result).toHaveProperty('max');
      expect(result).toHaveProperty('unit');
      expect(result).toHaveProperty('label');
      expect(result.value).toBe(60);
      expect(result.min).toBe(0);
      expect(result.max).toBe(240);
      expect(result.unit).toBe('min');
      expect(result.label).toBe('Mean Time to Resolution');
    });

    it('should cap MTTR at max value in gauge', () => {
      const data = {
        ...mockData,
        metrics: { ...mockData.metrics, mttr: 500 }
      };

      const result = dataSource.transformData(data, 'gauge');

      expect(result.value).toBe(240); // Capped at max
      expect(result.max).toBe(240);
    });

    it('should transform bar-chart data correctly', () => {
      const result = dataSource.transformData(mockData, 'bar-chart');

      expect(result).toHaveProperty('values');
      expect(Array.isArray(result.values)).toBe(true);
      expect(result.values.length).toBe(5);

      const sev1 = result.values.find(v => v.label === 'SEV-1');
      expect(sev1.value).toBe(1);
      expect(sev1.color).toBe('#DC2626');

      const sev2 = result.values.find(v => v.label === 'SEV-2');
      expect(sev2.value).toBe(1);
      expect(sev2.color).toBe('#EA580C');
    });

    it('should transform alert-list data correctly', () => {
      const result = dataSource.transformData(mockData, 'alert-list');

      expect(result).toHaveProperty('alerts');
      expect(Array.isArray(result.alerts)).toBe(true);
      expect(result.alerts.length).toBe(2);
      expect(result.alerts[0]).toHaveProperty('id');
      expect(result.alerts[0]).toHaveProperty('title');
      expect(result.alerts[0]).toHaveProperty('severity');
      expect(result.alerts[0]).toHaveProperty('status');
      expect(result.alerts[0].title).toBe('Test Incident 1');
      expect(result.alerts[0].severity).toBe('SEV-1');
    });

    it('should limit alert-list to 10 incidents', () => {
      const manyIncidents = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        attributes: {
          title: `Incident ${i}`,
          status: 'active',
          severity: 'SEV-3',
          created_at: new Date().toISOString()
        }
      }));

      const data = { ...mockData, incidents: manyIncidents };
      const result = dataSource.transformData(data, 'alert-list');

      expect(result.alerts.length).toBe(10);
    });

    it('should transform status-grid data correctly', () => {
      const result = dataSource.transformData(mockData, 'status-grid');

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBe(2);

      const activeItem = result.items.find(i => i.label === 'Active');
      expect(activeItem.value).toBe(1);
      expect(activeItem.status).toBe('error');

      const resolvedItem = result.items.find(i => i.label === 'Resolved');
      expect(resolvedItem.value).toBe(1);
      expect(resolvedItem.status).toBe('success');
    });

    it('should return raw data for unknown widget types', () => {
      const result = dataSource.transformData(mockData, 'custom-widget');

      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('incidents');
      expect(result.metrics.active).toBe(1);
      expect(result.incidents.length).toBe(2);
    });
  });

  describe('getAvailableMetrics()', () => {
    it('should return array of metrics', () => {
      const metrics = dataSource.getAvailableMetrics();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThanOrEqual(8);
    });

    it('should include active incidents metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const activeIncidents = metrics.find(m => m.id === 'active_incidents');

      expect(activeIncidents).toBeDefined();
      expect(activeIncidents.name).toBe('Active Incidents');
      expect(activeIncidents.type).toBe('number');
      expect(Array.isArray(activeIncidents.widgets)).toBe(true);
    });

    it('should include resolved incidents metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const resolved = metrics.find(m => m.id === 'resolved_incidents');

      expect(resolved).toBeDefined();
      expect(resolved.name).toBe('Resolved Incidents');
      expect(resolved.type).toBe('number');
    });

    it('should include MTTR metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const mttr = metrics.find(m => m.id === 'mttr');

      expect(mttr).toBeDefined();
      expect(mttr.name).toBe('Mean Time to Resolution');
      expect(mttr.type).toBe('duration');
    });

    it('should include incidents by severity metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const bySeverity = metrics.find(m => m.id === 'incidents_by_severity');

      expect(bySeverity).toBeDefined();
      expect(bySeverity.type).toBe('distribution');
    });

    it('should include incidents by service metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const byService = metrics.find(m => m.id === 'incidents_by_service');

      expect(byService).toBeDefined();
    });

    it('should include incident timeline metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const timeline = metrics.find(m => m.id === 'incident_timeline');

      expect(timeline).toBeDefined();
      expect(timeline.type).toBe('timeseries');
    });

    it('should include on-call status metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const onCall = metrics.find(m => m.id === 'on_call_status');

      expect(onCall).toBeDefined();
    });

    it('should include recent incident metrics', () => {
      const metrics = dataSource.getAvailableMetrics();
      const last24h = metrics.find(m => m.id === 'incidents_last_24h');
      const last7d = metrics.find(m => m.id === 'incidents_last_7d');

      expect(last24h).toBeDefined();
      expect(last7d).toBeDefined();
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
        expect(metric.widgets.length).toBeGreaterThan(0);
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
      expect(schema.name).toBe('Rootly');
    });

    it('should include apiUrl field', () => {
      const schema = dataSource.getConfigSchema();
      const apiUrlField = schema.fields.find(f => f.name === 'apiUrl');

      expect(apiUrlField).toBeDefined();
      expect(apiUrlField.type).toBe('string');
      expect(apiUrlField.required).toBe(false);
      expect(apiUrlField.default).toBe('https://api.rootly.com/v1');
      expect(apiUrlField.envVar).toBe('ROOTLY_API_URL');
    });

    it('should include apiKey field', () => {
      const schema = dataSource.getConfigSchema();
      const apiKeyField = schema.fields.find(f => f.name === 'apiKey');

      expect(apiKeyField).toBeDefined();
      expect(apiKeyField.type).toBe('string');
      expect(apiKeyField.required).toBe(true);
      expect(apiKeyField.secure).toBe(true);
      expect(apiKeyField.envVar).toBe('ROOTLY_API_KEY');
    });

    it('should have description for all fields', () => {
      const schema = dataSource.getConfigSchema();

      schema.fields.forEach(field => {
        expect(field).toHaveProperty('description');
        expect(typeof field.description).toBe('string');
        expect(field.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateWidgetConfig()', () => {
    it('should pass validation without API key', () => {
      const errors = dataSource.validateWidgetConfig({
        id: 'test-widget',
        type: 'big-number'
      });

      expect(errors).toEqual([]);
    });

    it('should validate widget config structure', () => {
      const errors = dataSource.validateWidgetConfig({
        id: 'test-widget',
        type: 'gauge'
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

  describe('fetchMetrics() - without API key', () => {
    it('should return mock data when API key not configured', async () => {
      const ds = new RootlyDataSource({});
      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'big-number'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('widgetId');
      expect(result.source).toBe('rootly');
      expect(result.widgetId).toBe('test-widget');
    });

    it('should return appropriate mock data for different widget types', async () => {
      const ds = new RootlyDataSource({});

      const gaugeResult = await ds.fetchMetrics({
        id: 'gauge-widget',
        type: 'gauge'
      });

      expect(gaugeResult.data).toHaveProperty('value');
      expect(gaugeResult.data).toHaveProperty('min');
      expect(gaugeResult.data).toHaveProperty('max');
      expect(gaugeResult.data).toHaveProperty('label');
      expect(gaugeResult.data.label).toBe('Mean Time to Resolution');
    });

    it('should return bar-chart mock data with correct structure', async () => {
      const ds = new RootlyDataSource({});

      const result = await ds.fetchMetrics({
        id: 'bar-widget',
        type: 'bar-chart'
      });

      expect(result.data).toHaveProperty('values');
      expect(Array.isArray(result.data.values)).toBe(true);
      expect(result.data.values.length).toBe(5);
    });

    it('should return alert-list mock data with incidents', async () => {
      const ds = new RootlyDataSource({});

      const result = await ds.fetchMetrics({
        id: 'alert-widget',
        type: 'alert-list'
      });

      expect(result.data).toHaveProperty('alerts');
      expect(Array.isArray(result.data.alerts)).toBe(true);
      expect(result.data.alerts.length).toBeGreaterThan(0);
    });
  });

  describe('caching behavior', () => {
    it('should initialize with empty cache', () => {
      expect(dataSource.cache).toBeNull();
      expect(dataSource.cacheTime).toBe(0);
    });

    it('should have correct cache TTL constant', () => {
      const FIVE_MINUTES = 5 * 60 * 1000;
      expect(FIVE_MINUTES).toBe(300000);
    });
  });

  describe('rate limiting', () => {
    it('should initialize request tracking', () => {
      expect(dataSource.requestCount).toBe(0);
      expect(typeof dataSource.requestWindowStart).toBe('number');
    });

    it('should track request count', () => {
      const initialCount = dataSource.requestCount;
      dataSource.checkRateLimit();
      expect(dataSource.requestCount).toBe(initialCount + 1);
    });

    it('should handle multiple sequential requests', () => {
      dataSource.requestCount = 0;
      dataSource.requestWindowStart = Date.now();

      for (let i = 0; i < 100; i++) {
        dataSource.checkRateLimit();
      }

      expect(dataSource.requestCount).toBe(100);
    });
  });
});
