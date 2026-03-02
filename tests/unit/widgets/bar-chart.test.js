// ===========================================================================
// Widget Tests: Bar Chart
// Tests horizontal bar chart rendering and data visualization
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript } from '../../helpers/dom-helpers.js';

describe('Widget: Bar Chart', () => {
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

  it('should render bar chart with data', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('bar-chart', container, {});

    widget.update({
      bars: [
        { label: 'API A', value: 250 },
        { label: 'API B', value: 180 },
        { label: 'API C', value: 320 }
      ]
    });

    const barRows = container.querySelectorAll('.bar-row');
    expect(barRows.length).toBe(3);
  });

  it('should display bar labels', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('bar-chart', container, {});

    widget.update({
      bars: [
        { label: 'API A', value: 250 },
        { label: 'API B', value: 180 }
      ]
    });

    const labels = container.querySelectorAll('.bar-label');
    expect(labels.length).toBe(2);
    expect(labels[0].textContent).toBe('API A');
    expect(labels[1].textContent).toBe('API B');
  });

  it('should display bar values', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('bar-chart', container, {});

    widget.update({
      bars: [
        { label: 'API A', value: 250 },
        { label: 'API B', value: 180 }
      ]
    });

    const values = container.querySelectorAll('.bar-value');
    expect(values.length).toBe(2);
    expect(values[0].textContent).toBe('250');
    expect(values[1].textContent).toBe('180');
  });

  it('should scale bars relative to max value', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('bar-chart', container, {});

    widget.update({
      bars: [
        { label: 'Max', value: 100 },
        { label: 'Half', value: 50 }
      ]
    });

    const fills = container.querySelectorAll('.bar-fill');
    expect(fills[0].style.width).toBe('100%');
    expect(fills[1].style.width).toBe('50%');
  });

  it('should support custom bar colors', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('bar-chart', container, {});

    widget.update({
      bars: [
        { label: 'API A', value: 250, color: '#FF5722' },
        { label: 'API B', value: 180, color: '#4CAF50' }
      ]
    });

    const fills = container.querySelectorAll('.bar-fill');
    expect(fills[0].style.background).toBe('rgb(255, 87, 34)'); // #FF5722
    expect(fills[1].style.background).toBe('rgb(76, 175, 80)');  // #4CAF50
  });

  it('should rebuild when bar count changes', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('bar-chart', container, {});

    widget.update({
      bars: [
        { label: 'A', value: 100 },
        { label: 'B', value: 200 }
      ]
    });

    let barRows = container.querySelectorAll('.bar-row');
    expect(barRows.length).toBe(2);

    widget.update({
      bars: [
        { label: 'A', value: 100 },
        { label: 'B', value: 200 },
        { label: 'C', value: 150 }
      ]
    });

    barRows = container.querySelectorAll('.bar-row');
    expect(barRows.length).toBe(3);
  });

  it('should handle empty bars array', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('bar-chart', container, {});

    widget.update({ bars: [] });

    const barRows = container.querySelectorAll('.bar-row');
    expect(barRows.length).toBe(0);
  });
});
