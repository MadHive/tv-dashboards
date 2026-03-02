// ===========================================================================
// Widget Tests: Service Heatmap
// Tests service heatmap widget for compact service visualization
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript } from '../../helpers/dom-helpers.js';

describe('Widget: Service Heatmap', () => {
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

  it('should render heatmap tiles for services', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('service-heatmap', container, {});

    widget.update({
      services: [
        { name: 'API', status: 'healthy', requestRate: 1000, latency: 45 },
        { name: 'DB', status: 'warning', requestRate: 500, latency: 120 },
        { name: 'Cache', status: 'healthy', requestRate: 2000, latency: 5 }
      ]
    });

    const tiles = container.querySelectorAll('.heatmap-tile');
    expect(tiles.length).toBe(3);
  });

  it('should display service names', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('service-heatmap', container, {});

    widget.update({
      services: [
        { name: 'API Gateway', status: 'healthy', requestRate: 1000, latency: 45 }
      ]
    });

    const name = container.querySelector('.heatmap-name');
    expect(name).toBeTruthy();
    expect(name.textContent).toBe('API Gateway');
  });

  it('should apply status classes to tiles', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('service-heatmap', container, {});

    widget.update({
      services: [
        { name: 'Healthy', status: 'healthy', requestRate: 1000, latency: 45 },
        { name: 'Warning', status: 'warning', requestRate: 500, latency: 200 },
        { name: 'Error', status: 'error', requestRate: 100, latency: 500 }
      ]
    });

    const tiles = container.querySelectorAll('.heatmap-tile');
    expect(tiles[0].classList.contains('healthy')).toBe(true);
    expect(tiles[1].classList.contains('warning')).toBe(true);
    expect(tiles[2].classList.contains('error')).toBe(true);
  });

  it('should display request rate stats', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('service-heatmap', container, {});

    widget.update({
      services: [
        { name: 'API', status: 'healthy', requestRate: 1500, latency: 45 }
      ]
    });

    const stats = container.querySelectorAll('.heatmap-stat');
    expect(stats.length).toBeGreaterThan(0);

    const statText = Array.from(stats).map(s => s.textContent);
    expect(statText.some(t => t.includes('1.5K/s') || t.includes('1,500/s'))).toBe(true);
  });

  it('should display latency stats', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('service-heatmap', container, {});

    widget.update({
      services: [
        { name: 'API', status: 'healthy', requestRate: 1000, latency: 125 }
      ]
    });

    const latencyStat = container.querySelector('.heatmap-lat');
    expect(latencyStat).toBeTruthy();
    expect(latencyStat.textContent).toBe('125ms');
  });

  it('should render status dots', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('service-heatmap', container, {});

    widget.update({
      services: [
        { name: 'API', status: 'healthy', requestRate: 1000, latency: 45 }
      ]
    });

    const dot = container.querySelector('.heatmap-dot');
    expect(dot).toBeTruthy();
    expect(dot.classList.contains('healthy')).toBe(true);
  });

  it('should update in place when service count matches', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('service-heatmap', container, {});

    widget.update({
      services: [
        { name: 'API', status: 'healthy', requestRate: 1000, latency: 45 }
      ]
    });

    const firstTile = container.querySelector('.heatmap-tile');

    widget.update({
      services: [
        { name: 'API', status: 'warning', requestRate: 1500, latency: 150 }
      ]
    });

    const secondTile = container.querySelector('.heatmap-tile');
    expect(secondTile).toBe(firstTile);
    expect(secondTile.classList.contains('warning')).toBe(true);
  });
});
