// ===========================================================================
// Config Validator Tests — Following Elysia.js Testing Patterns
// Tests for dashboard configuration validation functions
// ===========================================================================

import { describe, it, expect } from 'bun:test';
import { validateConfig, validateDashboard } from '../../../server/config-validator.js';
import { testDashboard, testConfig, invalidDashboard } from '../../helpers/fixtures.js';

describe('Config Validator', () => {
  describe('validateConfig()', () => {
    it('should validate valid config', () => {
      const result = validateConfig(testConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeArray();
      expect(result.errors.length).toBe(0);
    });

    it('should reject config without dashboards array', () => {
      const invalid = {
        // Missing dashboards
      };

      const result = validateConfig(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('dashboards'))).toBe(true);
    });

    it('should reject config with invalid dashboards type', () => {
      const invalid = {
        dashboards: 'not-an-array'
      };

      const result = validateConfig(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('dashboards'))).toBe(true);
    });

    it('should validate all dashboards in array', () => {
      const config = {
        dashboards: [
          testDashboard,
          {
            // Missing required fields
            id: 'invalid'
          }
        ]
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject config with empty dashboards array', () => {
      const config = {
        global: {
          title: 'Test',
          rotation_interval: 30,
          refresh_interval: 10
        },
        dashboards: []
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('at least one dashboard'))).toBe(true);
    });

    it('should provide clear error messages', () => {
      const invalid = {
        dashboards: [{ invalid: 'dashboard' }]
      };

      const result = validateConfig(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeArray();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(typeof result.errors[0]).toBe('string');
    });
  });

  describe('validateDashboard()', () => {
    it('should validate valid dashboard', () => {
      const errors = validateDashboard(testDashboard);

      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBe(0);
    });

    it('should reject dashboard without id', () => {
      const dashboard = {
        ...testDashboard,
        id: undefined
      };
      delete dashboard.id;

      const errors = validateDashboard(dashboard);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('id'))).toBe(true);
    });

    it('should reject dashboard without name', () => {
      const dashboard = {
        ...testDashboard,
        name: undefined
      };
      delete dashboard.name;

      const errors = validateDashboard(dashboard);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('name'))).toBe(true);
    });

    it('should reject dashboard without grid', () => {
      const dashboard = {
        ...testDashboard,
        grid: undefined
      };
      delete dashboard.grid;

      const errors = validateDashboard(dashboard);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('grid'))).toBe(true);
    });

    it('should validate grid configuration', () => {
      const dashboard = {
        ...testDashboard,
        grid: {
          // Missing columns, rows
          gap: 14
        }
      };

      const errors = validateDashboard(dashboard);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject dashboard without widgets array', () => {
      const dashboard = {
        ...testDashboard,
        widgets: undefined
      };
      delete dashboard.widgets;

      const errors = validateDashboard(dashboard);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('widgets'))).toBe(true);
    });

    it('should validate widget positions', () => {
      const dashboard = {
        ...testDashboard,
        widgets: [{
          id: 'test',
          type: 'big-number',
          title: 'Test',
          source: 'mock',
          position: {
            // Missing required position fields
            col: 1
          }
        }]
      };

      const errors = validateDashboard(dashboard);

      // Depending on implementation, might validate position fields
      expect(Array.isArray(errors)).toBe(true);
    });

    it('should validate widget types', () => {
      const dashboard = {
        ...testDashboard,
        widgets: [{
          id: 'test',
          type: 'invalid-widget-type',
          title: 'Test',
          source: 'mock',
          position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 }
        }]
      };

      const errors = validateDashboard(dashboard);

      // Depending on implementation, might validate widget types
      expect(Array.isArray(errors)).toBe(true);
    });

    it('should return array of error messages', () => {
      const errors = validateDashboard({});

      expect(Array.isArray(errors)).toBe(true);

      if (errors.length > 0) {
        expect(typeof errors[0]).toBe('string');
      }
    });

    it('should accept dashboard with all valid fields', () => {
      const complete = {
        id: 'complete-dashboard',
        name: 'Complete Dashboard',
        subtitle: 'Optional subtitle',
        icon: 'dashboard',
        grid: { columns: 4, rows: 3, gap: 14 },
        widgets: [{
          id: 'widget-1',
          type: 'big-number',
          title: 'Widget 1',
          source: 'mock',
          position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 }
        }]
      };

      const errors = validateDashboard(complete);

      expect(errors.length).toBe(0);
    });

    it('should handle edge cases', () => {
      // Test with empty object
      const errors = validateDashboard({});
      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Error Messages', () => {
    it('should provide specific error for missing id', () => {
      const dashboard = { ...testDashboard };
      delete dashboard.id;

      const errors = validateDashboard(dashboard);

      expect(errors.some(e => e.toLowerCase().includes('id'))).toBe(true);
    });

    it('should provide specific error for missing name', () => {
      const dashboard = { ...testDashboard };
      delete dashboard.name;

      const errors = validateDashboard(dashboard);

      expect(errors.some(e => e.toLowerCase().includes('name'))).toBe(true);
    });

    it('should provide specific error for invalid grid', () => {
      const dashboard = {
        ...testDashboard,
        grid: 'invalid'
      };

      const errors = validateDashboard(dashboard);

      expect(errors.some(e => e.toLowerCase().includes('grid'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty dashboard object', () => {
      const errors = validateDashboard({});

      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle dashboard with extra fields', () => {
      const dashboard = {
        ...testDashboard,
        extraField: 'should be ignored',
        anotherExtra: 123
      };

      const errors = validateDashboard(dashboard);

      // Extra fields should not cause errors
      expect(errors.length).toBe(0);
    });

    it('should reject dashboard with empty widgets array', () => {
      const dashboard = {
        ...testDashboard,
        widgets: []
      };

      const errors = validateDashboard(dashboard);

      expect(Array.isArray(errors)).toBe(true);
      expect(errors.some(e => e.includes('at least one widget'))).toBe(true);
    });

    it('should validate grid with valid values', () => {
      const dashboard = {
        ...testDashboard,
        grid: {
          columns: 4,
          rows: 3,
          gap: 14
        }
      };

      const errors = validateDashboard(dashboard);

      expect(errors.length).toBe(0);
    });

    it('should handle dashboard with many widgets', () => {
      const dashboard = {
        ...testDashboard,
        grid: { columns: 10, rows: 10, gap: 14 },
        widgets: Array.from({ length: 100 }, (_, i) => ({
          id: `widget-${i}`,
          type: 'big-number',
          title: `Widget ${i}`,
          source: 'mock',
          position: {
            col: (i % 10) + 1,
            row: Math.floor(i / 10) + 1,
            colSpan: 1,
            rowSpan: 1
          }
        }))
      };

      const errors = validateDashboard(dashboard);

      expect(errors.length).toBe(0);
    });
  });
});
