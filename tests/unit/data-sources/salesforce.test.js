// ===========================================================================
// Salesforce Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { SalesforceDataSource } from '../../../server/data-sources/salesforce.js';

describe('Salesforce Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new SalesforceDataSource({});
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('salesforce');
      expect(dataSource.instanceUrl).toBeUndefined();
      expect(dataSource.accessToken).toBeUndefined();
      expect(dataSource.connection).toBeNull();
      expect(dataSource.metricCache).toBeInstanceOf(Map);
    });

    it('should accept custom configuration', () => {
      const ds = new SalesforceDataSource({
        instanceUrl: 'https://test.my.salesforce.com',
        accessToken: 'test-token',
        isSandbox: true
      });

      expect(ds.instanceUrl).toBe('https://test.my.salesforce.com');
      expect(ds.accessToken).toBe('test-token');
      expect(ds.isSandbox).toBe(true);
    });

    it('should use environment variables if available', () => {
      const originalUrl = process.env.SALESFORCE_INSTANCE_URL;
      const originalToken = process.env.SALESFORCE_ACCESS_TOKEN;

      process.env.SALESFORCE_INSTANCE_URL = 'https://env.my.salesforce.com';
      process.env.SALESFORCE_ACCESS_TOKEN = 'env-token';

      const ds = new SalesforceDataSource({});
      expect(ds.instanceUrl).toBe('https://env.my.salesforce.com');
      expect(ds.accessToken).toBe('env-token');

      // Restore original values
      if (originalUrl) process.env.SALESFORCE_INSTANCE_URL = originalUrl;
      else delete process.env.SALESFORCE_INSTANCE_URL;
      if (originalToken) process.env.SALESFORCE_ACCESS_TOKEN = originalToken;
      else delete process.env.SALESFORCE_ACCESS_TOKEN;
    });

    it('should accept OAuth credentials', () => {
      const ds = new SalesforceDataSource({
        username: 'user@example.com',
        password: 'password123',
        securityToken: 'token123',
        clientId: 'client123',
        clientSecret: 'secret123'
      });

      expect(ds.username).toBe('user@example.com');
      expect(ds.password).toBe('password123');
      expect(ds.securityToken).toBe('token123');
      expect(ds.clientId).toBe('client123');
      expect(ds.clientSecret).toBe('secret123');
    });
  });

  describe('initialize()', () => {
    it('should handle missing credentials gracefully', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(false);
    });

    it('should initialize with access token if provided', async () => {
      const ds = new SalesforceDataSource({
        instanceUrl: 'https://test.my.salesforce.com',
        accessToken: 'test-token'
      });

      await ds.initialize();
      // Connection should be created even without valid credentials
      expect(ds.connection).not.toBeNull();
    });
  });

  describe('buildSOQLQuery()', () => {
    it('should build simple count query', () => {
      const query = dataSource.buildSOQLQuery({
        object: 'Lead',
        aggregation: 'count'
      });

      expect(query).toContain('SELECT COUNT()');
      expect(query).toContain('FROM Lead');
      expect(query).toContain('LIMIT 1000');
    });

    it('should build sum aggregation query', () => {
      const query = dataSource.buildSOQLQuery({
        object: 'Opportunity',
        aggregation: 'sum',
        field: 'Amount'
      });

      expect(query).toContain('SELECT SUM(Amount)');
      expect(query).toContain('FROM Opportunity');
    });

    it('should build avg aggregation query', () => {
      const query = dataSource.buildSOQLQuery({
        object: 'Opportunity',
        aggregation: 'avg',
        field: 'Amount'
      });

      expect(query).toContain('SELECT AVG(Amount)');
      expect(query).toContain('FROM Opportunity');
    });

    it('should add WHERE clause', () => {
      const query = dataSource.buildSOQLQuery({
        object: 'Lead',
        aggregation: 'count',
        where: 'Status = \'Open\''
      });

      expect(query).toContain('WHERE');
      expect(query).toContain('Status = \'Open\'');
    });

    it('should add time range filter', () => {
      const query = dataSource.buildSOQLQuery({
        object: 'Lead',
        aggregation: 'count',
        timeField: 'CreatedDate',
        timeRange: 30
      });

      expect(query).toContain('WHERE');
      expect(query).toContain('CreatedDate >=');
    });

    it('should build grouped query', () => {
      const query = dataSource.buildSOQLQuery({
        object: 'Case',
        aggregation: 'count',
        groupBy: 'Status'
      });

      expect(query).toContain('SELECT Status, COUNT()');
      expect(query).toContain('FROM Case');
      expect(query).toContain('GROUP BY Status');
      expect(query).toContain('ORDER BY COUNT() DESC');
    });

    it('should combine WHERE and time range filters', () => {
      const query = dataSource.buildSOQLQuery({
        object: 'Opportunity',
        aggregation: 'sum',
        field: 'Amount',
        where: 'IsClosed = false',
        timeField: 'CreatedDate',
        timeRange: 90
      });

      expect(query).toContain('WHERE');
      expect(query).toContain('IsClosed = false');
      expect(query).toContain('AND');
      expect(query).toContain('CreatedDate >=');
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
      expect(data.value).toBeGreaterThan(0);
    });

    it('should return mock data for stat-card widget', () => {
      const data = dataSource.getMockData('stat-card');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('trend');
      expect(data).toHaveProperty('unit');
    });

    it('should return mock data for gauge widget', () => {
      const data = dataSource.getMockData('gauge');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('min');
      expect(data).toHaveProperty('max');
      expect(data).toHaveProperty('unit');
      expect(data.min).toBe(0);
      expect(data.max).toBe(100);
    });

    it('should return mock data for gauge-row widget', () => {
      const data = dataSource.getMockData('gauge-row');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('min');
      expect(data).toHaveProperty('max');
    });

    it('should return mock data for bar-chart widget', () => {
      const data = dataSource.getMockData('bar-chart');

      expect(data).toHaveProperty('values');
      expect(Array.isArray(data.values)).toBe(true);
      expect(data.values.length).toBeGreaterThan(0);
      expect(data.values[0]).toHaveProperty('label');
      expect(data.values[0]).toHaveProperty('value');
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

    it('should return mock data for sparkline widget', () => {
      const data = dataSource.getMockData('sparkline');

      expect(data).toHaveProperty('labels');
      expect(data).toHaveProperty('values');
      expect(Array.isArray(data.values)).toBe(true);
    });

    it('should return mock data for table widget', () => {
      const data = dataSource.getMockData('table');

      expect(data).toHaveProperty('rows');
      expect(Array.isArray(data.rows)).toBe(true);
      expect(data.rows.length).toBeGreaterThan(0);
      expect(data.rows[0]).toHaveProperty('Name');
      expect(data.rows[0]).toHaveProperty('Status');
    });
  });

  describe('transformData()', () => {
    it('should handle empty result', () => {
      const result = dataSource.transformData({ records: [] }, 'big-number');
      expect(result).toBeDefined();
    });

    it('should handle null result', () => {
      const result = dataSource.transformData(null, 'big-number');
      expect(result).toBeDefined();
    });

    it('should transform simple aggregation for big-number', () => {
      const mockResult = {
        records: [{ expr0: 150 }]
      };

      const result = dataSource.transformData(mockResult, 'big-number', 'count');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('unit');
      expect(result.value).toBe(150);
      expect(result.unit).toBe('records');
    });

    it('should transform simple aggregation for gauge', () => {
      const mockResult = {
        records: [{ expr0: 75 }]
      };

      const result = dataSource.transformData(mockResult, 'gauge', 'sum');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('min');
      expect(result).toHaveProperty('max');
      expect(result.value).toBe(75);
      expect(result.min).toBe(0);
      expect(result.max).toBe(112.5); // 75 * 1.5
    });

    it('should transform grouped results for bar-chart', () => {
      const mockResult = {
        records: [
          { Status: 'Open', expr0: 25 },
          { Status: 'Closed', expr0: 15 },
          { Status: 'Pending', expr0: 10 }
        ]
      };

      const result = dataSource.transformData(mockResult, 'bar-chart', 'count');

      expect(result).toHaveProperty('values');
      expect(Array.isArray(result.values)).toBe(true);
      expect(result.values.length).toBe(3);
      expect(result.values[0].label).toBe('Open');
      expect(result.values[0].value).toBe(25);
      expect(result.values[1].label).toBe('Closed');
      expect(result.values[1].value).toBe(15);
    });

    it('should transform grouped results for line-chart', () => {
      const mockResult = {
        records: [
          { Month: 'Jan', expr0: 100 },
          { Month: 'Feb', expr0: 120 },
          { Month: 'Mar', expr0: 110 }
        ]
      };

      const result = dataSource.transformData(mockResult, 'line-chart', 'count');

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('values');
      expect(result).toHaveProperty('series');
      expect(result.labels.length).toBe(3);
      expect(result.values).toEqual([100, 120, 110]);
      expect(result.series).toBe('Salesforce');
    });

    it('should transform grouped results for big-number (uses first value)', () => {
      const mockResult = {
        records: [
          { Status: 'Open', expr0: 50 },
          { Status: 'Closed', expr0: 40 }
        ]
      };

      const result = dataSource.transformData(mockResult, 'big-number', 'count');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('previous');
      expect(result).toHaveProperty('trend');
      expect(result.value).toBe(50);
      expect(result.previous).toBe(40);
      expect(result.trend).toBe('up');
    });

    it('should calculate down trend correctly', () => {
      const mockResult = {
        records: [
          { Status: 'Open', expr0: 30 },
          { Status: 'Closed', expr0: 50 }
        ]
      };

      const result = dataSource.transformData(mockResult, 'big-number', 'count');
      expect(result.trend).toBe('down');
    });

    it('should calculate stable trend correctly', () => {
      const mockResult = {
        records: [
          { Status: 'Open', expr0: 40 },
          { Status: 'Closed', expr0: 40 }
        ]
      };

      const result = dataSource.transformData(mockResult, 'big-number', 'count');
      expect(result.trend).toBe('stable');
    });

    it('should transform table data', () => {
      const mockResult = {
        records: [
          { attributes: { type: 'Account' }, Name: 'Acme Corp', Industry: 'Tech' },
          { attributes: { type: 'Account' }, Name: 'Global Inc', Industry: 'Finance' }
        ]
      };

      const result = dataSource.transformData(mockResult, 'table');

      expect(result).toHaveProperty('rows');
      expect(Array.isArray(result.rows)).toBe(true);
      expect(result.rows.length).toBe(2);
      expect(result.rows[0]).not.toHaveProperty('attributes');
      expect(result.rows[0]).toHaveProperty('Name');
      expect(result.rows[0].Name).toBe('Acme Corp');
    });

    it('should limit bar-chart to 10 values', () => {
      const mockResult = {
        records: Array.from({ length: 20 }, (_, i) => ({
          Status: `Status${i}`,
          expr0: i * 10
        }))
      };

      const result = dataSource.transformData(mockResult, 'bar-chart', 'count');
      expect(result.values.length).toBe(10);
    });

    it('should handle null group values', () => {
      const mockResult = {
        records: [
          { Status: 'Open', expr0: 25 },
          { Status: null, expr0: 15 },
          { Status: 'Closed', expr0: 10 }
        ]
      };

      const result = dataSource.transformData(mockResult, 'bar-chart', 'count');

      expect(result.values.length).toBe(2); // null value should be filtered out
      expect(result.values[0].label).toBe('Open');
      expect(result.values[1].label).toBe('Closed');
    });
  });

  describe('getUnitForAggregation()', () => {
    it('should return correct unit for count', () => {
      expect(dataSource.getUnitForAggregation('count')).toBe('records');
    });

    it('should return correct unit for sum', () => {
      expect(dataSource.getUnitForAggregation('sum')).toBe('total');
    });

    it('should return correct unit for avg', () => {
      expect(dataSource.getUnitForAggregation('avg')).toBe('avg');
    });

    it('should return empty string for unknown aggregation', () => {
      expect(dataSource.getUnitForAggregation('unknown')).toBe('');
    });
  });

  describe('getAvailableMetrics()', () => {
    it('should return array of metrics', () => {
      const metrics = dataSource.getAvailableMetrics();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should include open opportunities metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const metric = metrics.find(m => m.id === 'open_opportunities_value');

      expect(metric).toBeDefined();
      expect(metric.object).toBe('Opportunity');
      expect(metric.aggregation).toBe('sum');
      expect(metric.field).toBe('Amount');
      expect(metric.type).toBe('currency');
    });

    it('should include leads created metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const metric = metrics.find(m => m.id === 'leads_created_this_month');

      expect(metric).toBeDefined();
      expect(metric.object).toBe('Lead');
      expect(metric.aggregation).toBe('count');
      expect(metric.timeRange).toBe(30);
    });

    it('should include cases by status metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const metric = metrics.find(m => m.id === 'cases_by_status');

      expect(metric).toBeDefined();
      expect(metric.object).toBe('Case');
      expect(metric.groupBy).toBe('Status');
    });

    it('should include win rate metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const metric = metrics.find(m => m.id === 'win_rate');

      expect(metric).toBeDefined();
      expect(metric.where).toContain('IsWon = true');
      expect(metric.type).toBe('percentage');
    });

    it('should include average deal size metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const metric = metrics.find(m => m.id === 'average_deal_size');

      expect(metric).toBeDefined();
      expect(metric.aggregation).toBe('avg');
      expect(metric.field).toBe('Amount');
      expect(metric.type).toBe('currency');
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

    it('should include custom query metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const metric = metrics.find(m => m.id === 'custom_query');

      expect(metric).toBeDefined();
      expect(metric.name).toBe('Custom SOQL Query');
      expect(metric.widgets).toContain('table');
    });
  });

  describe('getConfigSchema()', () => {
    it('should return configuration schema', () => {
      const schema = dataSource.getConfigSchema();

      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('description');
      expect(schema).toHaveProperty('fields');
      expect(Array.isArray(schema.fields)).toBe(true);
      expect(schema.name).toBe('Salesforce');
    });

    it('should include instance URL field', () => {
      const schema = dataSource.getConfigSchema();
      const field = schema.fields.find(f => f.name === 'instanceUrl');

      expect(field).toBeDefined();
      expect(field.type).toBe('string');
      expect(field.envVar).toBe('SALESFORCE_INSTANCE_URL');
    });

    it('should include sandbox flag', () => {
      const schema = dataSource.getConfigSchema();
      const field = schema.fields.find(f => f.name === 'isSandbox');

      expect(field).toBeDefined();
      expect(field.type).toBe('boolean');
      expect(field.default).toBe(false);
    });

    it('should include access token field', () => {
      const schema = dataSource.getConfigSchema();
      const field = schema.fields.find(f => f.name === 'accessToken');

      expect(field).toBeDefined();
      expect(field.secure).toBe(true);
      expect(field.envVar).toBe('SALESFORCE_ACCESS_TOKEN');
    });

    it('should include OAuth credentials', () => {
      const schema = dataSource.getConfigSchema();
      const clientId = schema.fields.find(f => f.name === 'clientId');
      const clientSecret = schema.fields.find(f => f.name === 'clientSecret');
      const username = schema.fields.find(f => f.name === 'username');
      const password = schema.fields.find(f => f.name === 'password');
      const securityToken = schema.fields.find(f => f.name === 'securityToken');

      expect(clientId).toBeDefined();
      expect(clientSecret).toBeDefined();
      expect(username).toBeDefined();
      expect(password).toBeDefined();
      expect(securityToken).toBeDefined();

      expect(clientId.secure).toBe(true);
      expect(clientSecret.secure).toBe(true);
      expect(password.secure).toBe(true);
      expect(securityToken.secure).toBe(true);
    });

    it('should include SOQL query field', () => {
      const schema = dataSource.getConfigSchema();
      const field = schema.fields.find(f => f.name === 'soql');

      expect(field).toBeDefined();
      expect(field.type).toBe('string');
      expect(field.example).toContain('SELECT COUNT()');
    });

    it('should include object selector', () => {
      const schema = dataSource.getConfigSchema();
      const field = schema.fields.find(f => f.name === 'object');

      expect(field).toBeDefined();
      expect(field.type).toBe('select');
      expect(Array.isArray(field.options)).toBe(true);
      expect(field.options).toContain('Lead');
      expect(field.options).toContain('Opportunity');
      expect(field.options).toContain('Case');
      expect(field.default).toBe('Lead');
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
        type: 'gauge',
        object: 'Lead',
        aggregation: 'count'
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
    it('should return mock data when connection not initialized', async () => {
      const result = await dataSource.fetchMetrics({
        id: 'test-widget',
        type: 'big-number'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('widgetId');
      expect(result.source).toBe('salesforce');
      expect(result.widgetId).toBe('test-widget');
    });

    it('should return appropriate mock data for different widget types', async () => {
      const gaugeResult = await dataSource.fetchMetrics({
        id: 'gauge-widget',
        type: 'gauge'
      });

      expect(gaugeResult.data).toHaveProperty('value');
      expect(gaugeResult.data).toHaveProperty('min');
      expect(gaugeResult.data).toHaveProperty('max');

      const barChartResult = await dataSource.fetchMetrics({
        id: 'bar-widget',
        type: 'bar-chart'
      });

      expect(barChartResult.data).toHaveProperty('values');
      expect(Array.isArray(barChartResult.data.values)).toBe(true);
    });
  });

  describe('testConnection()', () => {
    it('should return false when connection not initialized', async () => {
      const result = await dataSource.testConnection();
      expect(result).toBe(false);
    });
  });
});
