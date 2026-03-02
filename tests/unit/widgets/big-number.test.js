// ===========================================================================
// Widget Tests: Big Number
// Tests big number widget rendering, formatting, trends, and sparklines
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript, mockCanvas } from '../../helpers/dom-helpers.js';

describe('Widget: Big Number', () => {
  let dom, cleanup;

  beforeEach(async () => {
    const setup = setupDOM();
    dom = setup.dom;
    cleanup = setup.cleanup;

    // Load Charts utilities (required dependency)
    await loadScript('public/js/charts.js');
    // Load Widgets
    await loadScript('public/js/widgets.js');
  });

  afterEach(() => {
    cleanup();
  });

  it('should render big number with valid data', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('big-number', container, {});

    widget.update({ value: 1234, trend: 'up' });

    const valueEl = container.querySelector('.big-number-value');
    expect(valueEl).toBeTruthy();
    expect(valueEl.textContent).toBe('1,234');
  });

  it('should format large numbers with K suffix', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('big-number', container, {});

    widget.update({ value: 15000 });

    const valueEl = container.querySelector('.big-number-value');
    expect(valueEl.textContent).toBe('15.0K');
  });

  it('should format millions with M suffix', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('big-number', container, {});

    widget.update({ value: 2500000 });

    const valueEl = container.querySelector('.big-number-value');
    expect(valueEl.textContent).toBe('2.5M');
  });

  it('should display trend arrow indicators', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('big-number', container, {});

    // Test up trend
    widget.update({ value: 100, trend: 'up' });
    let trendEl = container.querySelector('.big-number-trend');
    expect(trendEl.textContent).toBe('\u25B2'); // Up arrow
    expect(trendEl.classList.contains('up')).toBe(true);

    // Test down trend
    widget.update({ value: 100, trend: 'down' });
    trendEl = container.querySelector('.big-number-trend');
    expect(trendEl.textContent).toBe('\u25BC'); // Down arrow
    expect(trendEl.classList.contains('down')).toBe(true);
  });

  it('should handle null/undefined values gracefully', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('big-number', container, {});

    widget.update({ value: null });

    const valueEl = container.querySelector('.big-number-value');
    expect(valueEl.textContent).toBe('—');
  });

  it('should render sparkline canvas when configured', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('big-number', container, { sparkline: true });

    widget.update({
      value: 100,
      sparkline: [50, 60, 55, 70, 100]
    });

    const sparklineCanvas = container.querySelector('.big-number-sparkline');
    expect(sparklineCanvas).toBeTruthy();
    expect(sparklineCanvas.tagName).toBe('CANVAS');
  });

  it('should display custom unit suffix', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('big-number', container, { unit: 'ms' });

    widget.update({ value: 42, suffix: 'ms' });

    const unitEl = container.querySelector('.big-number-unit');
    expect(unitEl).toBeTruthy();
    expect(unitEl.textContent).toBe('ms');
  });
});
