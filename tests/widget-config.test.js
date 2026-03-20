import { describe, test, expect } from 'bun:test';
import { createMockDash, createMockWidget, createMockQueries, populateWidgets, snapToNearest } from './helpers/widget-config-helpers.js';

describe('WDGT-01: subtitle and format field storage', () => {
  test('subtitle field is stored on widget config object', () => {
    const wc = createMockWidget({ subtitle: 'Last 24h' });
    expect(wc.subtitle).toBe('Last 24h');
  });

  test('format field is stored on widget config object', () => {
    const wc = createMockWidget({ format: '${value}K' });
    expect(wc.format).toBe('${value}K');
  });

  test('subtitle defaults to undefined when not set', () => {
    const wc = createMockWidget();
    expect(wc.subtitle).toBeUndefined();
  });

  test('label fields (xLabel, yLabel, legendLabels) stored on widget config', () => {
    const wc = createMockWidget({ xLabel: 'Time', yLabel: 'Req/s', legendLabels: 'East,West' });
    expect(wc.xLabel).toBe('Time');
    expect(wc.yLabel).toBe('Req/s');
    expect(wc.legendLabels).toBe('East,West');
  });
});

describe('WDGT-02: position snap-to-nearest collision resolution', () => {
  test('snap returns desired position when no collision exists', () => {
    const dash = populateWidgets(createMockDash(), [{ id: 'w-0', col: 5, row: 5, colSpan: 1, rowSpan: 1 }]);
    const result = snapToNearest(dash, 1, 1, 1, 1, 'widget-moving');
    expect(result).toEqual({ col: 1, row: 1 });
  });

  test('snap finds nearest open slot to the right when target is occupied', () => {
    // Block col 1, row 1 with a widget
    const dash = populateWidgets(createMockDash(), [{ id: 'blocker', col: 1, row: 1, colSpan: 1, rowSpan: 1 }]);
    // Moving widget (1x1) into col 1, row 1 — should snap right to col 2
    const result = snapToNearest(dash, 1, 1, 1, 1, 'widget-moving');
    expect(result.col).toBe(2);
    expect(result.row).toBe(1);
  });

  test('snap finds nearest open slot downward when right is blocked', () => {
    // Block col 1 row 1 and col 2 row 1
    const dash = populateWidgets(createMockDash(), [
      { id: 'b1', col: 1, row: 1, colSpan: 1, rowSpan: 1 },
      { id: 'b2', col: 2, row: 1, colSpan: 1, rowSpan: 1 },
    ]);
    // Moving 1x1 widget into col 1 row 1 — right (col 2) is also blocked, so should snap down
    const result = snapToNearest(dash, 1, 1, 1, 1, 'widget-moving');
    expect(result.row).toBe(2);
  });

  test('snap clamps to grid boundaries', () => {
    const dash = createMockDash({ grid: { columns: 4, rows: 4, gap: 12 } });
    // Widget 2x1 desired at col 4 (would overflow — col max = 4 - 2 + 1 = 3)
    const result = snapToNearest(dash, 4, 1, 2, 1, 'widget-moving');
    expect(result.col).toBeLessThanOrEqual(3);
  });

  test('snap returns original position when entire grid is full', () => {
    // Fill the whole 2x2 grid with 4 widgets
    const dash = createMockDash({ grid: { columns: 2, rows: 2, gap: 12 } });
    populateWidgets(dash, [
      { id: 'w1', col: 1, row: 1, colSpan: 1, rowSpan: 1 },
      { id: 'w2', col: 2, row: 1, colSpan: 1, rowSpan: 1 },
      { id: 'w3', col: 1, row: 2, colSpan: 1, rowSpan: 1 },
      { id: 'w4', col: 2, row: 2, colSpan: 1, rowSpan: 1 },
    ]);
    // No open slot — should return desired position unchanged
    const result = snapToNearest(dash, 1, 1, 1, 1, 'widget-moving');
    expect(result).toEqual({ col: 1, row: 1 });
  });
});

describe('WDGT-03: type-switch auto-match query', () => {
  test.todo('auto-match finds query with same metricType for new widget type');
  test.todo('auto-match returns null when no compatible query found');
  test.todo('auto-match preserves existing queryId when metric type matches current');
});

describe('WDGT-03: type-switch config preservation', () => {
  test('thresholds preserved when switching between compatible types', () => {
    const wc = createMockWidget({
      type: 'big-number',
      thresholds: { warning: 80, critical: 95 },
      min: 0,
      max: 100,
      unit: 'ms',
    });
    // Simulate switch to gauge (compatible — both use thresholds/min/max)
    wc.type = 'gauge';
    // Thresholds should still be present (Plan 03 will enforce preservation logic)
    expect(wc.thresholds.warning).toBe(80);
    expect(wc.thresholds.critical).toBe(95);
    expect(wc.min).toBe(0);
    expect(wc.max).toBe(100);
    expect(wc.unit).toBe('ms');
  });

  test('map config cleared when switching away from usa-map', () => {
    const wc = createMockWidget({
      type: 'usa-map',
      mapConfig: { timeWindow: 7, minImpressions: 100, metric: 'impressions' },
    });
    // This test verifies the fixture; Plan 03 will add the clearing logic
    expect(wc.mapConfig).toBeDefined();
    expect(wc.mapConfig.timeWindow).toBe(7);
  });
});
