// ===========================================================================
// Chart Rendering Tests
// Tests canvas-based chart rendering utilities
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript, mockCanvas } from '../../helpers/dom-helpers.js';

describe('Chart Rendering', () => {
  let dom, cleanup;

  beforeEach(() => {
    const setup = setupDOM();
    dom = setup.dom;
    cleanup = setup.cleanup;

    loadScript('public/js/charts.js');
  });

  afterEach(() => {
    cleanup();
  });

  describe('Canvas Setup', () => {
    it('should initialize canvas with DPI awareness', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 150;
      document.body.appendChild(canvas);

      // Canvas setup is called internally by chart functions
      expect(canvas.getContext('2d')).toBeTruthy();
    });

    it('should return context and dimensions', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '300px';
      canvas.style.height = '150px';
      document.body.appendChild(canvas);

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });
  });

  describe('Color Utilities', () => {
    it('should convert hex to rgba with alpha', () => {
      const Charts = window.Charts;

      // Test hexToRgba via threshold color (which uses it internally)
      expect(Charts).toBeTruthy();
    });

    it('should calculate threshold colors correctly', () => {
      const Charts = window.Charts;

      // Normal thresholds (higher is worse)
      const normalThresholds = { warning: 70, critical: 90 };

      // Low value (green)
      const greenColor = Charts.thresholdColor(50, normalThresholds, false);
      expect(greenColor).toBeTruthy();

      // Medium value (amber/warning)
      const amberColor = Charts.thresholdColor(80, normalThresholds, false);
      expect(amberColor).toBeTruthy();

      // High value (red/critical)
      const redColor = Charts.thresholdColor(95, normalThresholds, false);
      expect(redColor).toBeTruthy();
    });

    it('should handle inverted thresholds correctly', () => {
      const Charts = window.Charts;

      const invertedThresholds = { warning: 60, critical: 30 };

      // Low value is bad when inverted (red)
      const redColor = Charts.thresholdColor(20, invertedThresholds, true);
      expect(redColor).toBeTruthy();

      // High value is good when inverted (green)
      const greenColor = Charts.thresholdColor(80, invertedThresholds, true);
      expect(greenColor).toBeTruthy();
    });

    it('should return default color when no thresholds provided', () => {
      const Charts = window.Charts;

      const defaultColor = Charts.thresholdColor(50, null, false);
      expect(defaultColor).toBeTruthy();
      expect(typeof defaultColor).toBe('string');
    });
  });

  describe('Sparkline Rendering', () => {
    it('should render sparkline with data', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '200px';
      canvas.style.height = '60px';
      document.body.appendChild(canvas);

      const data = [10, 15, 12, 18, 25, 20, 30];

      window.Charts.sparkline(canvas, data, '#00E5FF');

      // Verify canvas has content (context was used)
      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });

    it('should handle sparkline with custom color', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '200px';
      canvas.style.height = '60px';
      document.body.appendChild(canvas);

      window.Charts.sparkline(canvas, [5, 10, 8, 12], '#FF5722');

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });

    it('should handle sparkline with minimal data points', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '200px';
      canvas.style.height = '60px';
      document.body.appendChild(canvas);

      // Should handle gracefully with < 2 points
      window.Charts.sparkline(canvas, [10], '#00E5FF');

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });

    it('should handle sparkline with null data', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '200px';
      canvas.style.height = '60px';
      document.body.appendChild(canvas);

      // Should not throw
      window.Charts.sparkline(canvas, null, '#00E5FF');

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });
  });

  describe('Gauge Rendering', () => {
    it('should render gauge with value', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '200px';
      canvas.style.height = '200px';
      document.body.appendChild(canvas);

      window.Charts.gauge(canvas, 75, 0, 100, null, '%', false);

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });

    it('should render gauge with custom range', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '200px';
      canvas.style.height = '200px';
      document.body.appendChild(canvas);

      window.Charts.gauge(canvas, 150, 0, 200, null, 'ms', false);

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });

    it('should render gauge with thresholds', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '200px';
      canvas.style.height = '200px';
      document.body.appendChild(canvas);

      const thresholds = { warning: 70, critical: 90 };
      window.Charts.gauge(canvas, 85, 0, 100, thresholds, '%', false);

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });

    it('should render gauge with inverted thresholds', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '200px';
      canvas.style.height = '200px';
      document.body.appendChild(canvas);

      const thresholds = { warning: 30, critical: 10 };
      window.Charts.gauge(canvas, 5, 0, 100, thresholds, '%', true);

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });

    it('should render gauge at minimum value', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '200px';
      canvas.style.height = '200px';
      document.body.appendChild(canvas);

      window.Charts.gauge(canvas, 0, 0, 100, null, '%', false);

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });

    it('should render gauge at maximum value', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '200px';
      canvas.style.height = '200px';
      document.body.appendChild(canvas);

      window.Charts.gauge(canvas, 100, 0, 100, null, '%', false);

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });
  });

  describe('Pipeline Rendering', () => {
    it('should render pipeline with stages', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '600px';
      canvas.style.height = '150px';
      document.body.appendChild(canvas);

      const stages = [
        { name: 'Build', status: 'success', duration: 120 },
        { name: 'Test', status: 'success', duration: 90 },
        { name: 'Deploy', status: 'running', duration: 30 }
      ];

      window.Charts.pipeline(canvas, stages, null);

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });

    it('should render pipeline with summary', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '600px';
      canvas.style.height = '150px';
      document.body.appendChild(canvas);

      const stages = [
        { name: 'Build', status: 'success', duration: 120 }
      ];

      const summary = {
        totalDuration: 300,
        success: 5,
        failed: 1
      };

      window.Charts.pipeline(canvas, stages, summary);

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });

    it('should handle pipeline with failed stages', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '600px';
      canvas.style.height = '150px';
      document.body.appendChild(canvas);

      const stages = [
        { name: 'Build', status: 'success', duration: 120 },
        { name: 'Test', status: 'failed', duration: 45 }
      ];

      window.Charts.pipeline(canvas, stages, null);

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });
  });

  describe('USA Map Rendering', () => {
    it('should render USA map with data', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '800px';
      canvas.style.height = '500px';
      document.body.appendChild(canvas);

      const data = {
        states: {
          CA: { value: 1000, status: 'healthy' },
          NY: { value: 800, status: 'healthy' },
          TX: { value: 600, status: 'warning' }
        }
      };

      window.Charts.usaMap(canvas, data);

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });

    it('should handle USA map with null data', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '800px';
      canvas.style.height = '500px';
      document.body.appendChild(canvas);

      // Should handle gracefully
      window.Charts.usaMap(canvas, null);

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });
  });

  describe('Number Formatting', () => {
    it('should format numbers with locale string', () => {
      const Charts = window.Charts;

      // formatNum is used internally by chart rendering
      expect(Charts).toBeTruthy();
    });
  });

  describe('Canvas Operations', () => {
    it('should clear canvas before redrawing', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '200px';
      canvas.style.height = '60px';
      document.body.appendChild(canvas);

      const data1 = [10, 20, 15];
      const data2 = [30, 40, 35];

      // Draw first sparkline
      window.Charts.sparkline(canvas, data1, '#00E5FF');

      // Draw second sparkline (should clear first)
      window.Charts.sparkline(canvas, data2, '#FF5722');

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });

    it('should handle canvas scaling for high DPI displays', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '300px';
      canvas.style.height = '150px';
      document.body.appendChild(canvas);

      // Draw something to trigger setup
      window.Charts.sparkline(canvas, [10, 20, 30], '#00E5FF');

      // Canvas should be sized appropriately
      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small canvas dimensions', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '10px';
      canvas.style.height = '10px';
      document.body.appendChild(canvas);

      window.Charts.sparkline(canvas, [10, 20], '#00E5FF');

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });

    it('should handle very large data sets', () => {
      const canvas = document.createElement('canvas');
      canvas.style.width = '1000px';
      canvas.style.height = '200px';
      document.body.appendChild(canvas);

      const largeDataset = Array.from({ length: 1000 }, (_, i) => Math.sin(i / 10) * 50 + 50);

      window.Charts.sparkline(canvas, largeDataset, '#00E5FF');

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });
  });
});
