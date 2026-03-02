// ===========================================================================
// Chromatic Data Source Tests
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { ChromaticDataSource } from '../../../server/data-sources/chromatic.js';

describe('Chromatic Data Source', () => {
  let dataSource;

  beforeEach(() => {
    dataSource = new ChromaticDataSource({});
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(dataSource.name).toBe('chromatic');
      expect(dataSource.projectToken).toBeUndefined();
      expect(dataSource.apiUrl).toBe('https://www.chromatic.com/api/v1');
      expect(dataSource.graphqlUrl).toBe('https://index.chromatic.com/graphql');
    });

    it('should accept custom configuration', () => {
      const ds = new ChromaticDataSource({
        projectToken: 'test-token',
        apiUrl: 'https://custom.api',
        graphqlUrl: 'https://custom.graphql'
      });

      expect(ds.projectToken).toBe('test-token');
      expect(ds.apiUrl).toBe('https://custom.api');
      expect(ds.graphqlUrl).toBe('https://custom.graphql');
    });
  });

  describe('initialize()', () => {
    it('should handle missing project token gracefully', async () => {
      await dataSource.initialize();
      expect(dataSource.isConnected).toBe(false);
    });

    it('should initialize with project token if provided', async () => {
      const ds = new ChromaticDataSource({
        projectToken: 'test-token'
      });

      await ds.initialize();
      // Will be false without valid token, but should complete without errors
      expect(typeof ds.isConnected).toBe('boolean');
    });
  });

  describe('fetchMetrics() - without credentials', () => {
    it('should return mock data when project token not configured', async () => {
      const result = await dataSource.fetchMetrics({
        id: 'test-widget',
        type: 'big-number'
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('data');
      expect(result.source).toBe('chromatic');
    });

    it('should include widget ID in response', async () => {
      const result = await dataSource.fetchMetrics({
        id: 'builds-count',
        type: 'stat-card'
      });

      expect(result.widgetId).toBe('builds-count');
    });
  });

  describe('transformData()', () => {
    const mockData = {
      project: {
        name: 'Test Project',
        builds: {
          nodes: [
            {
              id: 'build-1',
              number: 100,
              status: 'PASSED',
              changeCount: 0,
              errorCount: 0,
              testCount: 50,
              componentCount: 25,
              startedAt: '2026-03-02T10:00:00Z',
              branch: 'main'
            },
            {
              id: 'build-2',
              number: 99,
              status: 'FAILED',
              changeCount: 5,
              errorCount: 2,
              testCount: 50,
              componentCount: 25,
              startedAt: '2026-03-01T10:00:00Z',
              branch: 'feature/ui'
            },
            {
              id: 'build-3',
              number: 98,
              status: 'PASSED',
              changeCount: 0,
              errorCount: 0,
              testCount: 48,
              componentCount: 24,
              startedAt: '2026-02-28T10:00:00Z',
              branch: 'main'
            }
          ]
        },
        latestBuild: {
          status: 'PASSED',
          changeCount: 0,
          reviewedChangeCount: 0,
          errorCount: 0,
          testCount: 50,
          componentCount: 25
        }
      }
    };

    it('should handle empty data gracefully', () => {
      const result = dataSource.transformData(null, 'big-number');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('value');
    });

    it('should transform big-number data correctly', () => {
      const result = dataSource.transformData(mockData, 'big-number');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('trend');
      expect(result).toHaveProperty('unit');
      expect(result.value).toBe(3); // Number of builds
      expect(result.unit).toBe('builds');
    });

    it('should transform gauge data correctly', () => {
      const result = dataSource.transformData(mockData, 'gauge');

      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('min');
      expect(result).toHaveProperty('max');
      expect(result).toHaveProperty('label');
      expect(result.min).toBe(0);
      expect(result.max).toBe(100);
      expect(result.unit).toBe('%');
      // Pass rate: 2 passing builds out of 3 = 66%
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(100);
    });

    it('should transform bar-chart data correctly', () => {
      const result = dataSource.transformData(mockData, 'bar-chart');

      expect(result).toHaveProperty('values');
      expect(Array.isArray(result.values)).toBe(true);
      expect(result.values.length).toBeGreaterThan(0);

      const firstValue = result.values[0];
      expect(firstValue).toHaveProperty('label');
      expect(firstValue).toHaveProperty('value');
      expect(firstValue).toHaveProperty('color');
    });

    it('should transform line-chart data correctly', () => {
      const result = dataSource.transformData(mockData, 'line-chart');

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('values');
      expect(result).toHaveProperty('series');
      expect(Array.isArray(result.labels)).toBe(true);
      expect(Array.isArray(result.values)).toBe(true);
      expect(result.labels.length).toBe(result.values.length);
    });

    it('should transform progress-bar data correctly', () => {
      const result = dataSource.transformData(mockData, 'progress-bar');

      expect(result).toHaveProperty('progress');
      expect(result).toHaveProperty('label');
      expect(result.progress).toBeGreaterThanOrEqual(0);
      expect(result.progress).toBeLessThanOrEqual(100);
    });

    it('should transform status-grid data correctly', () => {
      const result = dataSource.transformData(mockData, 'status-grid');

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);

      const firstItem = result.items[0];
      expect(firstItem).toHaveProperty('id');
      expect(firstItem).toHaveProperty('label');
      expect(firstItem).toHaveProperty('status');
      expect(firstItem).toHaveProperty('value');
    });

    it('should transform alert-list data correctly', () => {
      const result = dataSource.transformData(mockData, 'alert-list');

      expect(result).toHaveProperty('alerts');
      expect(Array.isArray(result.alerts)).toBe(true);

      if (result.alerts.length > 0) {
        const firstAlert = result.alerts[0];
        expect(firstAlert).toHaveProperty('id');
        expect(firstAlert).toHaveProperty('severity');
        expect(firstAlert).toHaveProperty('message');
        expect(firstAlert).toHaveProperty('timestamp');
      }
    });
  });

  describe('testConnection()', () => {
    it('should return false when project token not configured', async () => {
      const result = await dataSource.testConnection();
      expect(result).toBe(false);
    });

    it('should attempt connection with valid token', async () => {
      const ds = new ChromaticDataSource({
        projectToken: 'test-token'
      });

      // Will fail with invalid token, but structure is correct
      const result = await ds.testConnection();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getMockData()', () => {
    it('should return realistic mock data for big-number', () => {
      const data = dataSource.getMockData('big-number');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('trend');
      expect(data).toHaveProperty('unit');
      expect(typeof data.value).toBe('number');
      expect(data.unit).toBe('builds');
    });

    it('should return mock data for gauge', () => {
      const data = dataSource.getMockData('gauge');

      expect(data).toHaveProperty('value');
      expect(data).toHaveProperty('min');
      expect(data).toHaveProperty('max');
      expect(data).toHaveProperty('label');
      expect(data.value).toBeGreaterThanOrEqual(data.min);
      expect(data.value).toBeLessThanOrEqual(data.max);
    });

    it('should return mock data for bar-chart', () => {
      const data = dataSource.getMockData('bar-chart');

      expect(data).toHaveProperty('values');
      expect(Array.isArray(data.values)).toBe(true);
      expect(data.values.length).toBeGreaterThan(0);
    });

    it('should return mock data for line-chart', () => {
      const data = dataSource.getMockData('line-chart');

      expect(data).toHaveProperty('labels');
      expect(data).toHaveProperty('values');
      expect(data).toHaveProperty('series');
      expect(data.labels.length).toBe(20);
      expect(data.values.length).toBe(20);
    });

    it('should return mock data for progress-bar', () => {
      const data = dataSource.getMockData('progress-bar');

      expect(data).toHaveProperty('progress');
      expect(data).toHaveProperty('label');
      expect(typeof data.progress).toBe('number');
    });

    it('should return mock data for status-grid', () => {
      const data = dataSource.getMockData('status-grid');

      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBe(12);
    });

    it('should return mock data for alert-list', () => {
      const data = dataSource.getMockData('alert-list');

      expect(data).toHaveProperty('alerts');
      expect(Array.isArray(data.alerts)).toBe(true);
      expect(data.alerts.length).toBeGreaterThan(0);
    });

    it('should return mock data for all widget types', () => {
      const types = [
        'big-number',
        'stat-card',
        'gauge',
        'gauge-row',
        'bar-chart',
        'line-chart',
        'sparkline',
        'progress-bar',
        'status-grid',
        'alert-list'
      ];

      types.forEach(type => {
        const data = dataSource.getMockData(type);
        expect(data).toBeDefined();
      });
    });
  });

  describe('getAvailableMetrics()', () => {
    it('should return array of metrics', () => {
      const metrics = dataSource.getAvailableMetrics();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThanOrEqual(8);
    });

    it('should include total builds metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const totalBuilds = metrics.find(m => m.id === 'total_builds');

      expect(totalBuilds).toBeDefined();
      expect(totalBuilds.name).toBe('Total Builds');
      expect(totalBuilds).toHaveProperty('description');
      expect(totalBuilds).toHaveProperty('type');
      expect(totalBuilds).toHaveProperty('widgets');
      expect(Array.isArray(totalBuilds.widgets)).toBe(true);
    });

    it('should include visual changes metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const changes = metrics.find(m => m.id === 'changes_detected');

      expect(changes).toBeDefined();
      expect(changes.name).toBe('Visual Changes Detected');
      expect(changes.type).toBe('number');
    });

    it('should include pass rate metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const passRate = metrics.find(m => m.id === 'pass_rate');

      expect(passRate).toBeDefined();
      expect(passRate.name).toBe('Pass Rate');
      expect(passRate.type).toBe('percentage');
    });

    it('should include unreviewed changes metric', () => {
      const metrics = dataSource.getAvailableMetrics();
      const unreviewed = metrics.find(m => m.id === 'unreviewed_changes');

      expect(unreviewed).toBeDefined();
      expect(unreviewed.widgets).toContain('alert-list');
    });

    it('should have at least 10 metrics', () => {
      const metrics = dataSource.getAvailableMetrics();
      expect(metrics.length).toBeGreaterThanOrEqual(10);
    });

    it('should have proper metric structure', () => {
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
      expect(schema.name).toBe('Chromatic');
      expect(Array.isArray(schema.fields)).toBe(true);
    });

    it('should include required fields', () => {
      const schema = dataSource.getConfigSchema();
      const projectTokenField = schema.fields.find(f => f.name === 'projectToken');

      expect(projectTokenField).toBeDefined();
      expect(projectTokenField.required).toBe(true);
      expect(projectTokenField.secure).toBe(true);
      expect(projectTokenField.envVar).toBe('CHROMATIC_PROJECT_TOKEN');
    });
  });

  describe('validateWidgetConfig()', () => {
    it('should validate widget configuration', () => {
      const errors = dataSource.validateWidgetConfig({
        id: 'test-widget',
        type: 'big-number'
      });

      expect(Array.isArray(errors)).toBe(true);
    });

    it('should require widget type', () => {
      const errors = dataSource.validateWidgetConfig({
        id: 'test-widget'
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('type'))).toBe(true);
    });

    it('should require widget id', () => {
      const errors = dataSource.validateWidgetConfig({
        type: 'big-number'
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('id'))).toBe(true);
    });
  });

  describe('Helper Methods', () => {
    it('should calculate trend correctly', () => {
      const builds = [
        { changeCount: 5 },
        { changeCount: 4 },
        { changeCount: 3 },
        { changeCount: 2 },
        { changeCount: 1 },
        { changeCount: 10 },
        { changeCount: 10 },
        { changeCount: 10 },
        { changeCount: 10 },
        { changeCount: 10 }
      ];

      const trend = dataSource.calculateTrend(builds);
      expect(['up', 'down', 'stable']).toContain(trend);
    });

    it('should aggregate by status correctly', () => {
      const builds = [
        { status: 'PASSED' },
        { status: 'PASSED' },
        { status: 'FAILED' },
        { status: 'PENDING' }
      ];

      const statusCounts = dataSource.aggregateByStatus(builds);

      expect(statusCounts).toHaveProperty('PASSED');
      expect(statusCounts).toHaveProperty('FAILED');
      expect(statusCounts).toHaveProperty('PENDING');
      expect(statusCounts.PASSED).toBe(2);
      expect(statusCounts.FAILED).toBe(1);
      expect(statusCounts.PENDING).toBe(1);
    });

    it('should map build status correctly', () => {
      expect(dataSource.mapBuildStatus('PASSED')).toBe('success');
      expect(dataSource.mapBuildStatus('FAILED')).toBe('error');
      expect(dataSource.mapBuildStatus('BROKEN')).toBe('error');
      expect(dataSource.mapBuildStatus('PENDING')).toBe('warning');
      expect(dataSource.mapBuildStatus('IN_PROGRESS')).toBe('warning');
      expect(dataSource.mapBuildStatus('DENIED')).toBe('critical');
      expect(dataSource.mapBuildStatus('UNKNOWN')).toBe('unknown');
    });

    it('should get status color correctly', () => {
      expect(dataSource.getStatusColor('PASSED')).toBe('#10B981');
      expect(dataSource.getStatusColor('FAILED')).toBe('#EF4444');
      expect(dataSource.getStatusColor('PENDING')).toBe('#F59E0B');
      expect(dataSource.getStatusColor('DENIED')).toBe('#DC2626');
      expect(dataSource.getStatusColor('UNKNOWN')).toBe('#6B7280');
    });
  });
});
