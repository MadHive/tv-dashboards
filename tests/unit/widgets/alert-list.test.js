// ===========================================================================
// Widget Tests: Alert List
// Tests alert list widget for displaying recent alerts
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript } from '../../helpers/dom-helpers.js';

describe('Widget: Alert List', () => {
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

  it('should render alert items', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('alert-list', container, {});

    widget.update({
      alerts: [
        { severity: 'critical', service: 'API', message: 'High error rate', time: '5m ago' },
        { severity: 'warning', service: 'DB', message: 'Slow queries', time: '10m ago' }
      ]
    });

    const items = container.querySelectorAll('.alert-item');
    expect(items.length).toBe(2);
  });

  it('should display alert severity', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('alert-list', container, {});

    widget.update({
      alerts: [
        { severity: 'critical', service: 'API', message: 'Error', time: '5m ago' }
      ]
    });

    const severity = container.querySelector('.alert-sev');
    expect(severity).toBeTruthy();
    expect(severity.textContent).toBe('critical');
  });

  it('should apply severity classes to items', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('alert-list', container, {});

    widget.update({
      alerts: [
        { severity: 'critical', service: 'API', message: 'Error', time: '5m ago' },
        { severity: 'warning', service: 'DB', message: 'Warning', time: '10m ago' }
      ]
    });

    const items = container.querySelectorAll('.alert-item');
    expect(items[0].classList.contains('critical')).toBe(true);
    expect(items[1].classList.contains('warning')).toBe(true);
  });

  it('should display service name', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('alert-list', container, {});

    widget.update({
      alerts: [
        { severity: 'warning', service: 'API Gateway', message: 'Slow response', time: '2m ago' }
      ]
    });

    const service = container.querySelector('.alert-svc');
    expect(service).toBeTruthy();
    expect(service.textContent).toBe('API Gateway');
  });

  it('should display alert message', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('alert-list', container, {});

    widget.update({
      alerts: [
        { severity: 'critical', service: 'DB', message: 'Connection pool exhausted', time: '1m ago' }
      ]
    });

    const message = container.querySelector('.alert-msg');
    expect(message).toBeTruthy();
    expect(message.textContent).toBe('Connection pool exhausted');
  });

  it('should display alert timestamp', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('alert-list', container, {});

    widget.update({
      alerts: [
        { severity: 'warning', service: 'Cache', message: 'Memory high', time: '15m ago' }
      ]
    });

    const time = container.querySelector('.alert-time');
    expect(time).toBeTruthy();
    expect(time.textContent).toBe('15m ago');
  });

  it('should rebuild list on each update', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('alert-list', container, {});

    widget.update({
      alerts: [
        { severity: 'warning', service: 'API', message: 'Alert 1', time: '5m ago' }
      ]
    });

    let items = container.querySelectorAll('.alert-item');
    expect(items.length).toBe(1);

    widget.update({
      alerts: [
        { severity: 'critical', service: 'DB', message: 'Alert 2', time: '1m ago' },
        { severity: 'warning', service: 'Cache', message: 'Alert 3', time: '3m ago' }
      ]
    });

    items = container.querySelectorAll('.alert-item');
    expect(items.length).toBe(2);
  });
});
