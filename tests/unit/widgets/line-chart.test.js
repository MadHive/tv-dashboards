// ===========================================================================
// Widget Tests: Line Chart
// Tests line chart widget rendering with time-series data
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript } from '../../helpers/dom-helpers.js';

describe('Widget: Line Chart', () => {
  let dom, cleanup;

  beforeEach(() => {
    const setup = setupDOM();
    dom = setup.dom;
    cleanup = setup.cleanup;

    loadScript('public/js/charts.js');
    loadScript('public/js/widgets.js');
  });

  afterEach(() => {
    cleanup();
  });

  it('should render line chart canvas', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('line-chart', container, {});

    widget.update({
      points: [
        { x: 1000, y: 100 },
        { x: 2000, y: 150 },
        { x: 3000, y: 120 }
      ]
    });

    const canvas = container.querySelector('.line-chart-canvas');
    expect(canvas).toBeTruthy();
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('should handle time-series data', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('line-chart', container, {});

    const now = Date.now();
    widget.update({
      points: [
        { x: now - 3600000, y: 100 },
        { x: now - 1800000, y: 120 },
        { x: now, y: 150 }
      ]
    });

    const canvas = container.querySelector('.line-chart-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should support custom styling config', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('line-chart', container, {
      color: '#00E5FF',
      lineWidth: 2
    });

    widget.update({
      points: [{ x: 1, y: 10 }, { x: 2, y: 20 }]
    });

    const canvas = container.querySelector('.line-chart-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should handle empty points array', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('line-chart', container, {});

    widget.update({ points: [] });

    const canvas = container.querySelector('.line-chart-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should render with single data point', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('line-chart', container, {});

    widget.update({ points: [{ x: 1, y: 100 }] });

    const canvas = container.querySelector('.line-chart-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should support multiple data series', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('line-chart', container, {});

    widget.update({
      series: [
        { name: 'Series 1', points: [{ x: 1, y: 10 }, { x: 2, y: 20 }] },
        { name: 'Series 2', points: [{ x: 1, y: 15 }, { x: 2, y: 25 }] }
      ]
    });

    const canvas = container.querySelector('.line-chart-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should set canvas dimensions from container', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('line-chart', container, {});

    widget.update({ points: [{ x: 1, y: 10 }] });

    const canvas = container.querySelector('.line-chart-canvas');
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
  });
});
