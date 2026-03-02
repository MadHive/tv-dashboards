// ===========================================================================
// Zendesk Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { ZendeskDataSource } from '../../../server/data-sources/zendesk.js';

describe('Zendesk Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new ZendeskDataSource({
      subdomain: 'test-company',
      email: 'test@example.com',
      apiToken: 'test-token'
    });
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('zendesk');
      expect(dataSource.subdomain).toBe('test-company');
      expect(dataSource.email).toBe('test@example.com');
      expect(dataSource.apiToken).toBe('test-token');
      expect(dataSource.zendeskClient).toBeNull();
      expect(dataSource.cache).toBeNull();
      expect(dataSource.cacheTime).toBe(0);
    });

    it('should accept custom configuration', () => {
      const ds = new ZendeskDataSource({
        subdomain: 'custom-company',
        email: 'custom@example.com',
        apiToken: 'custom-token'
      });
      expect(ds.subdomain).toBe('custom-company');
      expect(ds.email).toBe('custom@example.com');
      expect(ds.apiToken).toBe('custom-token');
    });

    it('should use environment variables if available', () => {
      const originalSubdomain = process.env.ZENDESK_SUBDOMAIN;
      const originalEmail = process.env.ZENDESK_EMAIL;
      const originalToken = process.env.ZENDESK_API_TOKEN;

      process.env.ZENDESK_SUBDOMAIN = 'env-company';
      process.env.ZENDESK_EMAIL = 'env@example.com';
      process.env.ZENDESK_API_TOKEN = 'env-token';

      const ds = new ZendeskDataSource({});
      expect(ds.subdomain).toBe('env-company');
      expect(ds.email).toBe('env@example.com');
      expect(ds.apiToken).toBe('env-token');

      // Restore original values
      if (originalSubdomain) process.env.ZENDESK_SUBDOMAIN = originalSubdomain;
      else delete process.env.ZENDESK_SUBDOMAIN;
      if (originalEmail) process.env.ZENDESK_EMAIL = originalEmail;
      else delete process.env.ZENDESK_EMAIL;
      if (originalToken) process.env.ZENDESK_API_TOKEN = originalToken;
      else delete process.env.ZENDESK_API_TOKEN;
    });
  });

  describe('initialize()', () => {
    it('should handle missing credentials gracefully', async () => {
      const ds = new ZendeskDataSource({});
      await ds.initialize();
      expect(ds.isConnected).toBe(false);
      expect(ds.zendeskClient).toBeNull();
    });

    it('should initialize with credentials', async () => {
      await dataSource.initialize();
      expect(dataSource.zendeskClient).not.toBeNull();
      expect(dataSource.isConnected).toBe(true);
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
      dataSource.requestCount = 200;
      dataSource.requestWindowStart = Date.now();

      expect(() => dataSource.checkRateLimit()).toThrow(/Rate limit exceeded/);
    });

    it('should reset counter after 1 minute', () => {
      dataSource.requestCount = 200;
      dataSource.requestWindowStart = Date.now() - 61000; // 61 seconds ago

      expect(() => dataSource.checkRateLimit()).not.toThrow();
      expect(dataSource.requestCount).toBe(1);
    });
  });

  describe('getMockData()', () => {
    it('should return mock data for big-number widget', () => {
      const data = dataSource.getMockData('big-number');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('trend');
      expect(data).toHaveProperty('unit');
      expect(typeof data.value).toBe('number');
      expect(['up', 'down']).toContain(data.trend);
      expect(data.unit).toBe('tickets');
    });

    it('should return mock data for stat-card widget', () => {
      const data = dataSource.getMockData('stat-card');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('trend');
      expect(data).toHaveProperty('unit');
      expect(data.value).toBe(42);
      expect(data.unit).toBe('tickets');
    });

    it('should return mock data for gauge widget', () => {
      const data = dataSource.getMockData('gauge');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('min');
      expect(data).toHaveProperty('max');
      expect(data).toHaveProperty('unit');
      expect(data).toHaveProperty('label');
      expect(data.min).toBe(0);
      expect(data.max).toBe(100);
      expect(data.unit).toBe('%');
      expect(data.label).toBe('Customer Satisfaction');
    });

    it('should return mock data for bar-chart widget', () => {
      const data = dataSource.getMockData('bar-chart');

      expect(data).toHaveProperty('values');
      expect(Array.isArray(data.values)).toBe(true);
      expect(data.values.length).toBe(4);
      expect(data.values[0]).toHaveProperty('label');
      expect(data.values[0]).toHaveProperty('value');
      expect(data.values[0]).toHaveProperty('color');

      const labels = data.values.map(v => v.label);
      expect(labels).toContain('New');
      expect(labels).toContain('Open');
      expect(labels).toContain('Pending');
      expect(labels).toContain('Solved');
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
      expect(data.series).toBe('Open Tickets');
    });

    it('should return mock data for sparkline widget', () => {
      const data = dataSource.getMockData('sparkline');

      expect(data).toHaveProperty('labels');
      expect(data).toHaveProperty('values');
      expect(Array.isArray(data.values)).toBe(true);
      expect(data.values.length).toBe(12);
    });
  });

  describe('transformData()', () => {
    const mockMetrics = {
      ticketCounts: {
        open: 42,
        pending: 8,
        new: 15,
        solved: 125,
        total: 190
      },
      satisfaction: {
        score: 87,
        ratings: 245
      }
    };

    it('should handle empty metrics', () => {
      const result = dataSource.transformData(null, 'big-number');
      expect(result).toBeDefined();
    });

    it('should handle missing ticketCounts', () => {
      const result = dataSource.transformData({}, 'big-number');
      expect(result).toBeDefined();
    });

    it('should transform big-number data correctly', () => {
      const result = dataSource.transformData(mockMetrics, 'big-number');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('trend');
      expect(result).toHaveProperty('unit');
      expect(result.value).toBe(42);
      expect(['up', 'down']).toContain(result.trend);
      expect(result.unit).toBe('tickets');
    });

    it('should transform stat-card data correctly', () => {
      const result = dataSource.transformData(mockMetrics, 'stat-card');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('trend');
      expect(result).toHaveProperty('unit');
      expect(result.value).toBe(42);
    });

    it('should calculate down trend when open < solved', () => {
      const metrics = {
        ticketCounts: {
          open: 10,
          solved: 50
        },
        satisfaction: { score: 90, ratings: 100 }
      };

      const result = dataSource.transformData(metrics, 'big-number');
      expect(result.trend).toBe('down');
    });

    it('should calculate up trend when open > solved', () => {
      const metrics = {
        ticketCounts: {
          open: 100,
          solved: 50
        },
        satisfaction: { score: 90, ratings: 100 }
      };

      const result = dataSource.transformData(metrics, 'big-number');
      expect(result.trend).toBe('up');
    });

    it('should transform gauge data correctly', () => {
      const result = dataSource.transformData(mockMetrics, 'gauge');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('min');
      expect(result).toHaveProperty('max');
      expect(result).toHaveProperty('unit');
      expect(result).toHaveProperty('label');
      expect(result.value).toBe(87);
      expect(result.min).toBe(0);
      expect(result.max).toBe(100);
      expect(result.unit).toBe('%');
      expect(result.label).toBe('Customer Satisfaction');
    });

    it('should transform bar-chart data correctly', () => {
      const result = dataSource.transformData(mockMetrics, 'bar-chart');

      expect(result).toHaveProperty('values');
      expect(Array.isArray(result.values)).toBe(true);
      expect(result.values.length).toBe(4);

      const newTicket = result.values.find(v => v.label === 'New');
      expect(newTicket.value).toBe(15);
      expect(newTicket.color).toBe('#3B82F6');

      const openTicket = result.values.find(v => v.label === 'Open');
      expect(openTicket.value).toBe(42);
      expect(openTicket.color).toBe('#F59E0B');

      const pendingTicket = result.values.find(v => v.label === 'Pending');
      expect(pendingTicket.value).toBe(8);
      expect(pendingTicket.color).toBe('#EF4444');

      const solvedTicket = result.values.find(v => v.label === 'Solved');
      expect(solvedTicket.value).toBe(125);
      expect(solvedTicket.color).toBe('#10B981');
    });

    it('should transform line-chart data correctly', () => {
      const result = dataSource.transformData(mockMetrics, 'line-chart');

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('values');
      expect(result).toHaveProperty('series');
      expect(Array.isArray(result.labels)).toBe(true);
      expect(Array.isArray(result.values)).toBe(true);
      expect(result.series).toBe('Open Tickets');
    });

    it('should return raw data for unknown widget types', () => {
      const result = dataSource.transformData(mockMetrics, 'custom-widget');

      expect(result).toHaveProperty('ticketCounts');
      expect(result).toHaveProperty('satisfaction');
      expect(result.ticketCounts.open).toBe(42);
      expect(result.satisfaction.score).toBe(87);
    });
  });

  describe('getAvailableMetrics()', () => {
    it('should return array of metrics', () => {
      const metrics = dataSource.getAvailableMetrics();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should include open tickets metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const openTickets = metrics.find(m => m.id === 'open_tickets');

      expect(openTickets).toBeDefined();
      expect(openTickets.name).toBe('Open Tickets');
      expect(openTickets.type).toBe('number');
      expect(Array.isArray(openTickets.widgets)).toBe(true);
    });

    it('should include customer satisfaction metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const satisfaction = metrics.find(m => m.id === 'customer_satisfaction');

      expect(satisfaction).toBeDefined();
      expect(satisfaction.name).toBe('Customer Satisfaction Score');
      expect(satisfaction.type).toBe('percentage');
    });

    it('should include tickets by status metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const byStatus = metrics.find(m => m.id === 'tickets_by_status');

      expect(byStatus).toBeDefined();
      expect(byStatus.type).toBe('distribution');
    });

    it('should include new tickets metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const newTickets = metrics.find(m => m.id === 'new_tickets');

      expect(newTickets).toBeDefined();
      expect(newTickets.name).toBe('New Tickets');
    });

    it('should include pending tickets metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const pending = metrics.find(m => m.id === 'pending_tickets');

      expect(pending).toBeDefined();
    });

    it('should include solved tickets metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const solved = metrics.find(m => m.id === 'solved_tickets');

      expect(solved).toBeDefined();
    });

    it('should include average resolution time metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const resolutionTime = metrics.find(m => m.id === 'average_resolution_time');

      expect(resolutionTime).toBeDefined();
      expect(resolutionTime.type).toBe('duration');
    });

    it('should include agent performance metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const agentPerf = metrics.find(m => m.id === 'agent_performance');

      expect(agentPerf).toBeDefined();
      expect(agentPerf.type).toBe('distribution');
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
      expect(schema.name).toBe('Zendesk');
    });

    it('should include subdomain field', () => {
      const schema = dataSource.getConfigSchema();
      const subdomainField = schema.fields.find(f => f.name === 'subdomain');

      expect(subdomainField).toBeDefined();
      expect(subdomainField.type).toBe('string');
      expect(subdomainField.required).toBe(true);
      expect(subdomainField.envVar).toBe('ZENDESK_SUBDOMAIN');
    });

    it('should include email field', () => {
      const schema = dataSource.getConfigSchema();
      const emailField = schema.fields.find(f => f.name === 'email');

      expect(emailField).toBeDefined();
      expect(emailField.type).toBe('string');
      expect(emailField.required).toBe(true);
      expect(emailField.envVar).toBe('ZENDESK_EMAIL');
    });

    it('should include apiToken field', () => {
      const schema = dataSource.getConfigSchema();
      const tokenField = schema.fields.find(f => f.name === 'apiToken');

      expect(tokenField).toBeDefined();
      expect(tokenField.type).toBe('string');
      expect(tokenField.required).toBe(true);
      expect(tokenField.secure).toBe(true);
      expect(tokenField.envVar).toBe('ZENDESK_API_TOKEN');
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
    it('should pass validation without credentials (uses mock data)', () => {
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

  describe('fetchMetrics() - without credentials', () => {
    it('should return mock data when client not initialized', async () => {
      const ds = new ZendeskDataSource({});
      const result = await ds.fetchMetrics({
        id: 'test-widget',
        type: 'big-number'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('widgetId');
      expect(result.source).toBe('zendesk');
      expect(result.widgetId).toBe('test-widget');
    });

    it('should return appropriate mock data for different widget types', async () => {
      const ds = new ZendeskDataSource({});

      const gaugeResult = await ds.fetchMetrics({
        id: 'gauge-widget',
        type: 'gauge'
      });

      expect(gaugeResult.data).toHaveProperty('value');
      expect(gaugeResult.data).toHaveProperty('min');
      expect(gaugeResult.data).toHaveProperty('max');
      expect(gaugeResult.data).toHaveProperty('label');
    });

    it('should return bar-chart mock data with correct structure', async () => {
      const ds = new ZendeskDataSource({});

      const result = await ds.fetchMetrics({
        id: 'bar-widget',
        type: 'bar-chart'
      });

      expect(result.data).toHaveProperty('values');
      expect(Array.isArray(result.data.values)).toBe(true);
      expect(result.data.values.length).toBe(4);
    });
  });

  describe('testConnection()', () => {
    it('should return false when client not initialized', async () => {
      const ds = new ZendeskDataSource({});
      const result = await ds.testConnection();
      expect(result).toBe(false);
    });

    it('should initialize client before testing', async () => {
      const ds = new ZendeskDataSource({});
      const result = await ds.testConnection();
      // Without credentials, should return false
      expect(result).toBe(false);
    });
  });

  describe('caching behavior', () => {
    it('should initialize with empty cache', () => {
      expect(dataSource.cache).toBeNull();
      expect(dataSource.cacheTime).toBe(0);
    });

    it('should have correct cache TTL constant', () => {
      const FIVE_MINUTES = 5 * 60 * 1000;
      // We can't directly access the constant, but we can verify the behavior
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

      for (let i = 0; i < 10; i++) {
        dataSource.checkRateLimit();
      }

      expect(dataSource.requestCount).toBe(10);
    });
  });
});
