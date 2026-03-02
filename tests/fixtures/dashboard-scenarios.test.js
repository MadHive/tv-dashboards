// ===========================================================================
// Dashboard Scenarios Test — Validates fixture structure
// ===========================================================================

import { describe, it, expect } from 'bun:test';
import {
  simpleDashboard,
  complexDashboard,
  multiSourceDashboard
} from './dashboard-scenarios.js';

describe('Dashboard Scenarios Fixtures', () => {
  describe('simpleDashboard()', () => {
    it('should return valid dashboard configuration', () => {
      const dashboard = simpleDashboard();

      // Required dashboard fields
      expect(dashboard).toHaveProperty('id');
      expect(dashboard).toHaveProperty('name');
      expect(dashboard).toHaveProperty('grid');
      expect(dashboard).toHaveProperty('widgets');

      // Grid configuration
      expect(dashboard.grid).toHaveProperty('columns');
      expect(dashboard.grid).toHaveProperty('rows');
      expect(dashboard.grid).toHaveProperty('gap');

      // Must have at least one widget
      expect(dashboard.widgets.length).toBeGreaterThan(0);
    });

    it('should have exactly 1 widget (big-number with mock data)', () => {
      const dashboard = simpleDashboard();
      expect(dashboard.widgets).toHaveLength(1);
      expect(dashboard.widgets[0].type).toBe('big-number');
      expect(dashboard.widgets[0].source).toBe('mock');
    });

    it('should have valid widget configuration', () => {
      const dashboard = simpleDashboard();
      const widget = dashboard.widgets[0];

      // Required widget fields
      expect(widget).toHaveProperty('id');
      expect(widget).toHaveProperty('type');
      expect(widget).toHaveProperty('title');
      expect(widget).toHaveProperty('source');
      expect(widget).toHaveProperty('position');

      // Position structure (NOT x/y/width/height)
      expect(widget.position).toHaveProperty('col');
      expect(widget.position).toHaveProperty('row');
      expect(widget.position).toHaveProperty('colSpan');
      expect(widget.position).toHaveProperty('rowSpan');
    });
  });

  describe('complexDashboard()', () => {
    it('should return valid dashboard configuration', () => {
      const dashboard = complexDashboard();

      expect(dashboard).toHaveProperty('id');
      expect(dashboard).toHaveProperty('name');
      expect(dashboard).toHaveProperty('grid');
      expect(dashboard).toHaveProperty('widgets');
    });

    it('should have 6+ widgets of various types', () => {
      const dashboard = complexDashboard();
      expect(dashboard.widgets.length).toBeGreaterThanOrEqual(6);

      // Collect widget types
      const types = new Set(dashboard.widgets.map(w => w.type));

      // Should have at least 5 different widget types
      expect(types.size).toBeGreaterThanOrEqual(5);

      // Should include these common types
      expect(types.has('big-number')).toBe(true);
      expect(types.has('gauge')).toBe(true);
      expect(types.has('bar-chart')).toBe(true);
    });

    it('should have widgets with valid positions', () => {
      const dashboard = complexDashboard();

      dashboard.widgets.forEach(widget => {
        expect(widget.position).toHaveProperty('col');
        expect(widget.position).toHaveProperty('row');
        expect(widget.position).toHaveProperty('colSpan');
        expect(widget.position).toHaveProperty('rowSpan');

        // Positions should be positive integers
        expect(widget.position.col).toBeGreaterThanOrEqual(1);
        expect(widget.position.row).toBeGreaterThanOrEqual(1);
        expect(widget.position.colSpan).toBeGreaterThanOrEqual(1);
        expect(widget.position.rowSpan).toBeGreaterThanOrEqual(1);
      });
    });

    it('should include various widget types', () => {
      const dashboard = complexDashboard();
      const types = dashboard.widgets.map(w => w.type);

      // Check for diverse widget types
      const expectedTypes = [
        'big-number',
        'stat-card',
        'gauge',
        'bar-chart',
        'line-chart',
        'gauge-row'
      ];

      expectedTypes.forEach(type => {
        expect(types).toContain(type);
      });
    });
  });

  describe('multiSourceDashboard()', () => {
    it('should return valid dashboard configuration', () => {
      const dashboard = multiSourceDashboard();

      expect(dashboard).toHaveProperty('id');
      expect(dashboard).toHaveProperty('name');
      expect(dashboard).toHaveProperty('grid');
      expect(dashboard).toHaveProperty('widgets');
    });

    it('should use multiple data sources (GCP, BigQuery, Mock)', () => {
      const dashboard = multiSourceDashboard();
      const sources = new Set(dashboard.widgets.map(w => w.source));

      // Should have at least 2 different sources
      expect(sources.size).toBeGreaterThanOrEqual(2);

      // Should include these sources
      expect(sources.has('gcp') || sources.has('bigquery') || sources.has('mock')).toBe(true);
    });

    it('should have GCP widgets with project configuration', () => {
      const dashboard = multiSourceDashboard();
      const gcpWidgets = dashboard.widgets.filter(w => w.source === 'gcp');

      if (gcpWidgets.length > 0) {
        gcpWidgets.forEach(widget => {
          // GCP widgets should have project in config
          expect(widget.project || widget.config?.project).toBeDefined();
        });
      }
    });

    it('should have BigQuery widgets with queryId', () => {
      const dashboard = multiSourceDashboard();
      const bqWidgets = dashboard.widgets.filter(w => w.source === 'bigquery');

      if (bqWidgets.length > 0) {
        bqWidgets.forEach(widget => {
          // BigQuery widgets should have queryId
          expect(widget.queryId).toBeDefined();
          expect(typeof widget.queryId).toBe('string');
        });
      }
    });

    it('should have all widgets with valid positions', () => {
      const dashboard = multiSourceDashboard();

      dashboard.widgets.forEach(widget => {
        expect(widget.position).toBeDefined();
        expect(widget.position.col).toBeGreaterThanOrEqual(1);
        expect(widget.position.row).toBeGreaterThanOrEqual(1);
        expect(widget.position.colSpan).toBeGreaterThanOrEqual(1);
        expect(widget.position.rowSpan).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Dashboard Structure Consistency', () => {
    it('all scenarios should follow dashboards.yaml structure', () => {
      const dashboards = [
        simpleDashboard(),
        complexDashboard(),
        multiSourceDashboard()
      ];

      dashboards.forEach(dashboard => {
        // Top-level structure
        expect(dashboard.id).toBeTruthy();
        expect(dashboard.name).toBeTruthy();
        expect(dashboard.grid).toBeDefined();

        // Grid structure
        expect(typeof dashboard.grid.columns).toBe('number');
        expect(typeof dashboard.grid.rows).toBe('number');
        expect(typeof dashboard.grid.gap).toBe('number');

        // Widgets array
        expect(Array.isArray(dashboard.widgets)).toBe(true);

        // Each widget structure
        dashboard.widgets.forEach(widget => {
          expect(widget.id).toBeTruthy();
          expect(widget.type).toBeTruthy();
          expect(widget.title).toBeTruthy();
          expect(widget.source).toBeTruthy();
          expect(widget.position).toBeDefined();
          expect(widget.position.col).toBeDefined();
          expect(widget.position.row).toBeDefined();
        });
      });
    });
  });
});
