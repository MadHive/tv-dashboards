// ===========================================================================
// Widget Tests: Gauge Row
// Tests gauge row widget rendering multiple mini gauges
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript } from '../../helpers/dom-helpers.js';

describe('Widget: Gauge Row', () => {
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

  it('should render multiple mini gauges', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('gauge-row', container, {});

    widget.update({
      gauges: [
        { label: 'CPU', value: 65 },
        { label: 'Memory', value: 80 },
        { label: 'Disk', value: 45 }
      ]
    });

    const miniGauges = container.querySelectorAll('.mini-gauge');
    expect(miniGauges.length).toBe(3);
  });

  it('should render canvas for each gauge', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('gauge-row', container, {});

    widget.update({
      gauges: [
        { label: 'CPU', value: 65 },
        { label: 'Memory', value: 80 }
      ]
    });

    const canvases = container.querySelectorAll('.mini-gauge canvas');
    expect(canvases.length).toBe(2);
  });

  it('should display labels for each gauge', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('gauge-row', container, {});

    widget.update({
      gauges: [
        { label: 'CPU', value: 65 },
        { label: 'Memory', value: 80 },
        { label: 'Disk', value: 45 }
      ]
    });

    const labels = container.querySelectorAll('.mini-gauge-label');
    expect(labels.length).toBe(3);
    expect(labels[0].textContent).toBe('CPU');
    expect(labels[1].textContent).toBe('Memory');
    expect(labels[2].textContent).toBe('Disk');
  });

  it('should rebuild gauges when count changes', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('gauge-row', container, {});

    // Initial 2 gauges
    widget.update({
      gauges: [
        { label: 'CPU', value: 65 },
        { label: 'Memory', value: 80 }
      ]
    });

    let miniGauges = container.querySelectorAll('.mini-gauge');
    expect(miniGauges.length).toBe(2);

    // Update to 4 gauges
    widget.update({
      gauges: [
        { label: 'CPU', value: 65 },
        { label: 'Memory', value: 80 },
        { label: 'Disk', value: 45 },
        { label: 'Network', value: 30 }
      ]
    });

    miniGauges = container.querySelectorAll('.mini-gauge');
    expect(miniGauges.length).toBe(4);
  });

  it('should handle threshold configuration', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('gauge-row', container, {
      thresholds: [70, 90]
    });

    widget.update({
      gauges: [
        { label: 'CPU', value: 85 }
      ]
    });

    const miniGauges = container.querySelectorAll('.mini-gauge');
    expect(miniGauges.length).toBe(1);
  });

  it('should update values without rebuilding DOM', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('gauge-row', container, {});

    widget.update({
      gauges: [
        { label: 'CPU', value: 65 }
      ]
    });

    const firstCanvas = container.querySelector('.mini-gauge canvas');

    // Update with same count
    widget.update({
      gauges: [
        { label: 'CPU', value: 75 }
      ]
    });

    const secondCanvas = container.querySelector('.mini-gauge canvas');
    expect(secondCanvas).toBe(firstCanvas); // Same element
  });

  it('should handle empty gauge array', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('gauge-row', container, {});

    widget.update({ gauges: [] });

    const miniGauges = container.querySelectorAll('.mini-gauge');
    expect(miniGauges.length).toBe(0);
  });
});
