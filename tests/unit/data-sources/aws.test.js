// ===========================================================================
// AWS CloudWatch Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { AWSDataSource } from '../../../server/data-sources/aws.js';

describe('AWS CloudWatch Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new AWSDataSource({
      region: 'us-east-1'
    });
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('aws');
      expect(dataSource.region).toBe('us-east-1');
      expect(dataSource.cloudWatchClient).toBeNull();
      expect(dataSource.metricCache).toBeInstanceOf(Map);
    });

    it('should accept custom region', () => {
      const ds = new AWSDataSource({ region: 'eu-west-1' });
      expect(ds.region).toBe('eu-west-1');
    });

    it('should use environment variables if available', () => {
      const originalRegion = process.env.AWS_REGION;
      process.env.AWS_REGION = 'ap-south-1';

      const ds = new AWSDataSource({});
      expect(ds.region).toBe('ap-south-1');

      if (originalRegion) {
        process.env.AWS_REGION = originalRegion;
      } else {
        delete process.env.AWS_REGION;
      }
    });
  });

  describe('initialize()', () => {
    it('should handle missing credentials gracefully', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(false);
    });

    it('should initialize with credentials if provided', async () => {
      const ds = new AWSDataSource({
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        region: 'us-east-1'
      });

      await ds.initialize();
      // Should create client even with fake credentials
      expect(ds.cloudWatchClient).not.toBeNull();
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
  });

  describe('transformData()', () => {
    it('should handle empty metric results', () => {
      const result = dataSource.transformData([], 'big-number');
      expect(result).toBeDefined();
    });

    it('should handle null metric results', () => {
      const result = dataSource.transformData(null, 'big-number');
      expect(result).toBeDefined();
    });

    it('should transform big-number data correctly', () => {
      const mockResults = [{
        Values: [45.5, 50.2, 55.8],
        Timestamps: [
          new Date('2024-01-01T10:00:00Z'),
          new Date('2024-01-01T10:05:00Z'),
          new Date('2024-01-01T10:10:00Z')
        ],
        Label: 'CPU%'
      }];

      const result = dataSource.transformData(mockResults, 'big-number');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('previous');
      expect(result).toHaveProperty('trend');
      expect(result.value).toBe(55.8);
      expect(result.previous).toBe(50.2);
      expect(result.trend).toBe('up');
    });

    it('should calculate down trend correctly', () => {
      const mockResults = [{
        Values: [55.8, 50.2],
        Timestamps: [new Date(), new Date()],
        Label: 'CPU%'
      }];

      const result = dataSource.transformData(mockResults, 'big-number');
      expect(result.trend).toBe('down');
    });

    it('should transform gauge data correctly', () => {
      const mockResults = [{
        Values: [75.5],
        Timestamps: [new Date()],
        Label: 'CPU%'
      }];

      const result = dataSource.transformData(mockResults, 'gauge');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('min');
      expect(result).toHaveProperty('max');
      expect(result.value).toBe(75.5);
      expect(result.min).toBe(0);
      expect(result.max).toBe(100);
    });

    it('should transform line-chart data correctly', () => {
      const mockResults = [{
        Values: [10, 20, 30],
        Timestamps: [
          new Date('2024-01-01T10:00:00Z'),
          new Date('2024-01-01T10:05:00Z'),
          new Date('2024-01-01T10:10:00Z')
        ],
        Label: 'Requests'
      }];

      const result = dataSource.transformData(mockResults, 'line-chart');

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('values');
      expect(result).toHaveProperty('series');
      expect(result.labels.length).toBe(3);
      expect(result.values).toEqual([10, 20, 30]);
      expect(result.series).toBe('Requests');
    });

    it('should transform bar-chart data correctly', () => {
      const mockResults = [{
        Values: [10, 20, 30, 40, 50],
        Timestamps: [
          new Date('2024-01-01T10:00:00Z'),
          new Date('2024-01-01T10:05:00Z'),
          new Date('2024-01-01T10:10:00Z'),
          new Date('2024-01-01T10:15:00Z'),
          new Date('2024-01-01T10:20:00Z')
        ]
      }];

      const result = dataSource.transformData(mockResults, 'bar-chart');

      expect(result).toHaveProperty('values');
      expect(Array.isArray(result.values)).toBe(true);
      expect(result.values.length).toBe(5);
      expect(result.values[0]).toHaveProperty('label');
      expect(result.values[0]).toHaveProperty('value');
    });

    it('should limit bar-chart to 10 values', () => {
      const mockResults = [{
        Values: Array.from({ length: 20 }, (_, i) => i),
        Timestamps: Array.from({ length: 20 }, (_, i) => new Date())
      }];

      const result = dataSource.transformData(mockResults, 'bar-chart');
      expect(result.values.length).toBe(10);
    });
  });

  describe('getAvailableMetrics()', () => {
    it('should return array of metrics', () => {
      const metrics = dataSource.getAvailableMetrics();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should include EC2 CPU metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const ec2Metric = metrics.find(m => m.id === 'ec2_cpu_utilization');

      expect(ec2Metric).toBeDefined();
      expect(ec2Metric.namespace).toBe('AWS/EC2');
      expect(ec2Metric.metric).toBe('CPUUtilization');
      expect(ec2Metric.statistic).toBe('Average');
    });

    it('should include Lambda metrics', () => {
      const metrics = dataSource.getAvailableMetrics();
      const lambdaMetrics = metrics.filter(m => m.namespace === 'AWS/Lambda');

      expect(lambdaMetrics.length).toBeGreaterThan(0);
    });

    it('should include RDS metrics', () => {
      const metrics = dataSource.getAvailableMetrics();
      const rdsMetrics = metrics.filter(m => m.namespace === 'AWS/RDS');

      expect(rdsMetrics.length).toBeGreaterThan(0);
    });

    it('should include S3 metrics', () => {
      const metrics = dataSource.getAvailableMetrics();
      const s3Metric = metrics.find(m => m.id === 's3_requests');

      expect(s3Metric).toBeDefined();
      expect(s3Metric.namespace).toBe('AWS/S3');
    });

    it('should include ALB metrics', () => {
      const metrics = dataSource.getAvailableMetrics();
      const albMetrics = metrics.filter(m => m.namespace === 'AWS/ApplicationELB');

      expect(albMetrics.length).toBeGreaterThan(0);
    });

    it('should have proper widget associations', () => {
      const metrics = dataSource.getAvailableMetrics();

      metrics.forEach(metric => {
        expect(metric).toHaveProperty('id');
        expect(metric).toHaveProperty('name');
        expect(metric).toHaveProperty('namespace');
        expect(metric).toHaveProperty('metric');
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

    it('should include region field', () => {
      const schema = dataSource.getConfigSchema();
      const regionField = schema.fields.find(f => f.name === 'region');

      expect(regionField).toBeDefined();
      expect(regionField.type).toBe('string');
      expect(regionField.default).toBe('us-east-1');
    });

    it('should include credentials fields', () => {
      const schema = dataSource.getConfigSchema();
      const keyField = schema.fields.find(f => f.name === 'accessKeyId');
      const secretField = schema.fields.find(f => f.name === 'secretAccessKey');

      expect(keyField).toBeDefined();
      expect(secretField).toBeDefined();
      expect(keyField.secure).toBe(true);
      expect(secretField.secure).toBe(true);
    });

    it('should include metric configuration fields', () => {
      const schema = dataSource.getConfigSchema();
      const metricField = schema.fields.find(f => f.name === 'metric');
      const namespaceField = schema.fields.find(f => f.name === 'namespace');
      const statisticField = schema.fields.find(f => f.name === 'statistic');

      expect(metricField).toBeDefined();
      expect(namespaceField).toBeDefined();
      expect(statisticField).toBeDefined();
    });

    it('should have statistic options', () => {
      const schema = dataSource.getConfigSchema();
      const statisticField = schema.fields.find(f => f.name === 'statistic');

      expect(statisticField.type).toBe('select');
      expect(Array.isArray(statisticField.options)).toBe(true);
      expect(statisticField.options).toContain('Average');
      expect(statisticField.options).toContain('Sum');
      expect(statisticField.options).toContain('Maximum');
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
        metric: 'CPUUtilization',
        namespace: 'AWS/EC2'
      });

      expect(errors).toEqual([]);
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
      expect(result).toHaveProperty('widgetId');
      expect(result.source).toBe('aws');
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
    });
  });

  describe('testConnection()', () => {
    it('should return false when client not initialized', async () => {
      const result = await dataSource.testConnection();
      expect(result).toBe(false);
    });
  });
});
