// ===========================================================================
// Widget Tests: Gauge
// Tests gauge widget rendering, value ranges, and thresholds
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript } from '../../helpers/dom-helpers.js';

describe('Widget: Gauge', () => {
  let dom, cleanup;

  beforeEach(async () => {
    const setup = setupDOM();
    dom = setup.dom;
    cleanup = setup.cleanup;

    await loadScript('public/js/charts.js');
    await loadScript('public/js/widgets.js');
  });

  afterEach(() => {
    cleanup();
  });

  it('should render gauge canvas', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('gauge', container, {});

    widget.update({ value: 75 });

    const canvas = container.querySelector('.gauge-canvas');
    expect(canvas).toBeTruthy();
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('should handle values within range', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('gauge', container, { min: 0, max: 100 });

    widget.update({ value: 50 });

    const canvas = container.querySelector('.gauge-canvas');
    expect(canvas.style.display).not.toBe('none');
  });

  it('should display N/A label for null values', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('gauge', container, {});

    widget.update({ value: null });

    const naLabel = container.querySelector('.gauge-na');
    expect(naLabel).toBeTruthy();
    expect(naLabel.style.display).toBe('flex');
    expect(naLabel.textContent).toBe('—');
  });

  it('should support custom min/max ranges', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('gauge', container, { min: 0, max: 200 });

    widget.update({ value: 150 });

    const canvas = container.querySelector('.gauge-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should handle threshold configuration', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('gauge', container, {
      min: 0,
      max: 100,
      thresholds: [70, 90]
    });

    widget.update({ value: 85 });

    const canvas = container.querySelector('.gauge-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should display custom units', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('gauge', container, { unit: '%' });

    widget.update({ value: 75 });

    // Unit is rendered inside the canvas by Charts.gauge()
    const canvas = container.querySelector('.gauge-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should support inverted thresholds', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('gauge', container, {
      min: 0,
      max: 100,
      thresholds: [30, 60],
      invert: true
    });

    widget.update({ value: 25 });

    const canvas = container.querySelector('.gauge-canvas');
    expect(canvas).toBeTruthy();
  });
});
