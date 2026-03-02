// ===========================================================================
// Rollbar Integration Test
// ===========================================================================

import { describe, it, expect, beforeAll } from 'bun:test';
import { dataSourceRegistry } from '../../server/data-source-registry.js';

describe('Rollbar Integration', () => {
  beforeAll(async () => {
    // Ensure registry is initialized
    await dataSourceRegistry.initialize();
  });

  describe('Data Source Registration', () => {
    it('should register Rollbar data source', () => {
      const source = dataSourceRegistry.getSource('rollbar');
      expect(source).toBeDefined();
      expect(source.name).toBe('rollbar');
    });

    it('should include Rollbar in all sources', () => {
      const allSources = dataSourceRegistry.getAllSources();
      const rollbarSource = allSources.find(s => s.name === 'rollbar');
      expect(rollbarSource).toBeDefined();
    });
  });

  describe('Configuration Schema', () => {
    it('should provide configuration schema', () => {
      const schemas = dataSourceRegistry.getSchemas();
      expect(schemas.rollbar).toBeDefined();
      expect(schemas.rollbar.name).toBe('Rollbar');
      expect(schemas.rollbar.fields).toBeDefined();
    });

    it('should include required fields in schema', () => {
      const source = dataSourceRegistry.getSource('rollbar');
      const schema = source.getConfigSchema();

      const fieldNames = schema.fields.map(f => f.name);
      expect(fieldNames).toContain('accessToken');
      expect(fieldNames).toContain('projectId');
      expect(fieldNames).toContain('level');
    });
  });

  describe('Available Metrics', () => {
    it('should provide list of available metrics', () => {
      const metrics = dataSourceRegistry.getAvailableMetrics('rollbar');
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThanOrEqual(8);
    });

    it('should include all required metrics', () => {
      const metrics = dataSourceRegistry.getAvailableMetrics('rollbar');
      const metricIds = metrics.map(m => m.id);

      const requiredMetrics = [
        'total_occurrences',
        'active_items',
        'errors_by_level',
        'critical_errors',
        'error_rate',
        'top_errors',
        'occurrence_trends',
        'mttr'
      ];

      requiredMetrics.forEach(metricId => {
        expect(metricIds).toContain(metricId);
      });
    });
  });

  describe('Widget Metrics Fetching', () => {
    it('should fetch metrics for big-number widget', async () => {
      const widgetConfig = {
        id: 'error-count',
        type: 'big-number',
        source: 'rollbar',
        metricType: 'items'
      };

      const result = await dataSourceRegistry.fetchMetrics(widgetConfig, 'test-dashboard');

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('data');
      expect(result.source).toBe('rollbar');
      expect(result.data).toHaveProperty('value');
    });

    it('should fetch metrics for bar-chart widget', async () => {
      const widgetConfig = {
        id: 'errors-by-level',
        type: 'bar-chart',
        source: 'rollbar',
        metricType: 'items'
      };

      const result = await dataSourceRegistry.fetchMetrics(widgetConfig, 'test-dashboard');

      expect(result.data).toHaveProperty('values');
      expect(Array.isArray(result.data.values)).toBe(true);
    });

    it('should fetch metrics for alert-list widget', async () => {
      const widgetConfig = {
        id: 'top-errors',
        type: 'alert-list',
        source: 'rollbar',
        metricType: 'top_active'
      };

      const result = await dataSourceRegistry.fetchMetrics(widgetConfig, 'test-dashboard');

      expect(result.data).toHaveProperty('alerts');
      expect(Array.isArray(result.data.alerts)).toBe(true);
    });

    it('should fetch metrics for line-chart widget', async () => {
      const widgetConfig = {
        id: 'error-trends',
        type: 'line-chart',
        source: 'rollbar',
        metricType: 'occurrence_counts'
      };

      const result = await dataSourceRegistry.fetchMetrics(widgetConfig, 'test-dashboard');

      expect(result.data).toHaveProperty('labels');
      expect(result.data).toHaveProperty('values');
      expect(Array.isArray(result.data.labels)).toBe(true);
      expect(Array.isArray(result.data.values)).toBe(true);
    });

    it('should fetch metrics for gauge widget', async () => {
      const widgetConfig = {
        id: 'error-rate',
        type: 'gauge',
        source: 'rollbar',
        metricType: 'items'
      };

      const result = await dataSourceRegistry.fetchMetrics(widgetConfig, 'test-dashboard');

      expect(result.data).toHaveProperty('value');
      expect(result.data).toHaveProperty('min');
      expect(result.data).toHaveProperty('max');
    });
  });

  describe('Mock Data Mode', () => {
    it('should return mock data when credentials not configured', async () => {
      const widgetConfig = {
        id: 'test-widget',
        type: 'big-number',
        source: 'rollbar'
      };

      const result = await dataSourceRegistry.fetchMetrics(widgetConfig, 'test-dashboard');

      // Should have mock flag or data from mock source
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('should provide realistic mock data for all widget types', async () => {
      const widgetTypes = [
        'big-number',
        'stat-card',
        'gauge',
        'gauge-row',
        'bar-chart',
        'alert-list',
        'line-chart',
        'sparkline'
      ];

      for (const type of widgetTypes) {
        const widgetConfig = {
          id: `test-${type}`,
          type,
          source: 'rollbar'
        };

        const result = await dataSourceRegistry.fetchMetrics(widgetConfig, 'test-dashboard');
        expect(result.data).toBeDefined();
      }
    });
  });

  describe('Health Status', () => {
    it('should report Rollbar health status', () => {
      const health = dataSourceRegistry.getHealth();
      expect(health.rollbar).toBeDefined();
      expect(health.rollbar).toHaveProperty('isConnected');
      expect(health.rollbar).toHaveProperty('lastError');
      expect(health.rollbar).toHaveProperty('isReady');
    });
  });

  describe('Connection Testing', () => {
    it('should test connection to Rollbar API', async () => {
      const result = await dataSourceRegistry.testConnection('rollbar');
      expect(typeof result).toBe('boolean');
      // Will be false without credentials, true with valid credentials
    });
  });

  describe('Dashboard-Level Metrics', () => {
    it('should fetch metrics for multiple Rollbar widgets', async () => {
      const dashboardConfig = {
        widgets: [
          {
            id: 'error-count',
            type: 'big-number',
            source: 'rollbar',
            metricType: 'items'
          },
          {
            id: 'errors-by-level',
            type: 'bar-chart',
            source: 'rollbar',
            metricType: 'items'
          },
          {
            id: 'error-trends',
            type: 'line-chart',
            source: 'rollbar',
            metricType: 'occurrence_counts'
          }
        ]
      };

      const results = await dataSourceRegistry.fetchDashboardMetrics(
        'rollbar-test-dashboard',
        dashboardConfig
      );

      expect(results).toHaveProperty('error-count');
      expect(results).toHaveProperty('errors-by-level');
      expect(results).toHaveProperty('error-trends');
    });
  });
});
