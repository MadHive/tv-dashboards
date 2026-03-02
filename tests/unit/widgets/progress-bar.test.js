// ===========================================================================
// Widget Tests: Progress Bar
// Tests progress bar widget rendering and percentage display
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript } from '../../helpers/dom-helpers.js';

describe('Widget: Progress Bar', () => {
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

  it('should render progress bar elements', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('progress-bar', container, {});

    widget.update({ value: 75 });

    const track = container.querySelector('.progress-track');
    const fill = container.querySelector('.progress-fill');
    const valueEl = container.querySelector('.progress-value');

    expect(track).toBeTruthy();
    expect(fill).toBeTruthy();
    expect(valueEl).toBeTruthy();
  });

  it('should display percentage value', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('progress-bar', container, {});

    widget.update({ value: 75 });

    const valueEl = container.querySelector('.progress-value');
    expect(valueEl.textContent).toBe('75%');
  });

  it('should set fill width based on value', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('progress-bar', container, {});

    widget.update({ value: 50 });

    const fill = container.querySelector('.progress-fill');
    expect(fill.style.width).toBe('50%');
  });

  it('should cap fill width at 100%', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('progress-bar', container, {});

    widget.update({ value: 150 });

    const fill = container.querySelector('.progress-fill');
    expect(fill.style.width).toBe('100%');
  });

  it('should handle zero value', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('progress-bar', container, {});

    widget.update({ value: 0 });

    const fill = container.querySelector('.progress-fill');
    const valueEl = container.querySelector('.progress-value');

    expect(fill.style.width).toBe('0%');
    expect(valueEl.textContent).toBe('0%');
  });

  it('should display custom label', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('progress-bar', container, {});

    widget.update({ value: 75, label: 'Deployment in progress' });

    const label = container.querySelector('.progress-label');
    expect(label).toBeTruthy();
    expect(label.textContent).toBe('Deployment in progress');
  });

  it('should update value dynamically', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('progress-bar', container, {});

    widget.update({ value: 25 });
    let fill = container.querySelector('.progress-fill');
    expect(fill.style.width).toBe('25%');

    widget.update({ value: 75 });
    fill = container.querySelector('.progress-fill');
    expect(fill.style.width).toBe('75%');
  });
});
