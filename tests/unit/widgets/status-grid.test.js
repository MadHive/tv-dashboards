// ===========================================================================
// Widget Tests: Status Grid
// Tests status grid widget for service health monitoring
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript } from '../../helpers/dom-helpers.js';

describe('Widget: Status Grid', () => {
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

  it('should render status cards for services', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('status-grid', container, {});

    widget.update({
      services: [
        { name: 'API', status: 'healthy', requestRate: 1000, errorRate: 0.5, latency: 45, lastDeploy: '2h ago' },
        { name: 'DB', status: 'warning', requestRate: 500, errorRate: 2.1, latency: 120, lastDeploy: '1d ago' }
      ]
    });

    const cards = container.querySelectorAll('.status-card');
    expect(cards.length).toBe(2);
  });

  it('should display service names', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('status-grid', container, {});

    widget.update({
      services: [
        { name: 'API Gateway', status: 'healthy', requestRate: 1000, errorRate: 0.5, latency: 45, lastDeploy: '2h ago' }
      ]
    });

    const name = container.querySelector('.status-card-name');
    expect(name).toBeTruthy();
    expect(name.textContent).toBe('API Gateway');
  });

  it('should apply status classes to cards', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('status-grid', container, {});

    widget.update({
      services: [
        { name: 'Healthy Service', status: 'healthy', requestRate: 1000, errorRate: 0.5, latency: 45, lastDeploy: '2h ago' },
        { name: 'Warning Service', status: 'warning', requestRate: 500, errorRate: 5.0, latency: 200, lastDeploy: '1d ago' }
      ]
    });

    const cards = container.querySelectorAll('.status-card');
    expect(cards[0].classList.contains('healthy')).toBe(true);
    expect(cards[1].classList.contains('warning')).toBe(true);
  });

  it('should display service metrics', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('status-grid', container, {});

    widget.update({
      services: [
        { name: 'API', status: 'healthy', requestRate: 1234, errorRate: 0.75, latency: 45, lastDeploy: '2h ago' }
      ]
    });

    const metrics = container.querySelectorAll('.status-metric-value');
    expect(metrics.length).toBeGreaterThan(0);

    // Check for formatted request rate
    const values = Array.from(metrics).map(m => m.textContent);
    expect(values.some(v => v.includes('1,234') || v.includes('1.2K'))).toBe(true);
  });

  it('should render status dots', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('status-grid', container, {});

    widget.update({
      services: [
        { name: 'API', status: 'healthy', requestRate: 1000, errorRate: 0.5, latency: 45, lastDeploy: '2h ago' }
      ]
    });

    const dot = container.querySelector('.status-dot');
    expect(dot).toBeTruthy();
    expect(dot.classList.contains('healthy')).toBe(true);
  });

  it('should update in place without rebuilding when count matches', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('status-grid', container, {});

    widget.update({
      services: [
        { name: 'API', status: 'healthy', requestRate: 1000, errorRate: 0.5, latency: 45, lastDeploy: '2h ago' }
      ]
    });

    const firstCard = container.querySelector('.status-card');

    widget.update({
      services: [
        { name: 'API', status: 'warning', requestRate: 1500, errorRate: 2.0, latency: 100, lastDeploy: '2h ago' }
      ]
    });

    const secondCard = container.querySelector('.status-card');
    expect(secondCard).toBe(firstCard); // Same DOM element
    expect(secondCard.classList.contains('warning')).toBe(true);
  });

  it('should rebuild when service count changes', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('status-grid', container, {});

    widget.update({
      services: [
        { name: 'API', status: 'healthy', requestRate: 1000, errorRate: 0.5, latency: 45, lastDeploy: '2h ago' }
      ]
    });

    let cards = container.querySelectorAll('.status-card');
    expect(cards.length).toBe(1);

    widget.update({
      services: [
        { name: 'API', status: 'healthy', requestRate: 1000, errorRate: 0.5, latency: 45, lastDeploy: '2h ago' },
        { name: 'DB', status: 'healthy', requestRate: 500, errorRate: 0.1, latency: 30, lastDeploy: '1d ago' }
      ]
    });

    cards = container.querySelectorAll('.status-card');
    expect(cards.length).toBe(2);
  });
});
