// ===========================================================================
// Widget Tests: Stat Card
// Tests stat card widget rendering, string values, and detail text
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript } from '../../helpers/dom-helpers.js';

describe('Widget: Stat Card', () => {
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

  it('should render stat card with numeric value', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('stat-card', container, {});

    widget.update({ value: 567 });

    const valueEl = container.querySelector('.stat-card-value');
    expect(valueEl).toBeTruthy();
    expect(valueEl.textContent).toBe('567');
  });

  it('should render stat card with string value', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('stat-card', container, {});

    widget.update({ value: '49/49', status: 'healthy' });

    const valueEl = container.querySelector('.stat-card-value');
    expect(valueEl.textContent).toBe('49/49');
  });

  it('should scale font size based on value length', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('stat-card', container, {});

    // Short string (≤5 chars) - large font
    widget.update({ value: '100%' });
    let valueEl = container.querySelector('.stat-card-value');
    expect(valueEl.style.fontSize).toBe('62px');

    // Medium string (6-8 chars) - medium font
    widget.update({ value: '12.4 TB' });
    valueEl = container.querySelector('.stat-card-value');
    expect(valueEl.style.fontSize).toBe('52px');

    // Long string (>8 chars) - small font
    widget.update({ value: 'Very long text' });
    valueEl = container.querySelector('.stat-card-value');
    expect(valueEl.style.fontSize).toBe('42px');
  });

  it('should apply threshold colors', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('stat-card', container, {
      thresholds: [50, 80]
    });

    widget.update({ value: 90 });

    const valueEl = container.querySelector('.stat-card-value');
    expect(valueEl.style.color).toBeTruthy();
  });

  it('should display trend indicators', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('stat-card', container, {});

    widget.update({ value: 100, trend: 'up' });

    const trendEl = container.querySelector('.stat-card-trend');
    expect(trendEl.textContent).toBe('\u25B2');
    expect(trendEl.classList.contains('up')).toBe(true);
  });

  it('should handle null values gracefully', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('stat-card', container, {});

    widget.update({ value: null });

    const valueEl = container.querySelector('.stat-card-value');
    expect(valueEl.textContent).toBe('—');
  });

  it('should display detail text', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('stat-card', container, {});

    widget.update({ value: 100, detail: 'Last updated 5m ago' });

    const detailEl = container.querySelector('.stat-card-detail');
    expect(detailEl).toBeTruthy();
    expect(detailEl.textContent).toBe('Last updated 5m ago');
  });
});
