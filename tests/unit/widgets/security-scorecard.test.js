// ===========================================================================
// Widget Tests: Security Scorecard
// Tests security scorecard widget for vulnerability tracking
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript } from '../../helpers/dom-helpers.js';

describe('Widget: Security Scorecard', () => {
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

  it('should render security scorecard canvas', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('security-scorecard', container, {});

    widget.update({
      score: 85,
      vulnerabilities: {
        critical: 0,
        high: 2,
        medium: 5,
        low: 10
      }
    });

    const canvas = container.querySelector('.security-canvas');
    expect(canvas).toBeTruthy();
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('should handle high security score', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('security-scorecard', container, {});

    widget.update({
      score: 95,
      vulnerabilities: {
        critical: 0,
        high: 0,
        medium: 1,
        low: 2
      }
    });

    const canvas = container.querySelector('.security-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should handle low security score', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('security-scorecard', container, {});

    widget.update({
      score: 45,
      vulnerabilities: {
        critical: 5,
        high: 10,
        medium: 15,
        low: 20
      }
    });

    const canvas = container.querySelector('.security-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should handle detailed vulnerability data', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('security-scorecard', container, {});

    widget.update({
      score: 75,
      vulnerabilities: {
        critical: 1,
        high: 3,
        medium: 8,
        low: 12
      },
      categories: [
        { name: 'Dependencies', score: 80 },
        { name: 'Code Quality', score: 70 },
        { name: 'Configuration', score: 75 }
      ]
    });

    const canvas = container.querySelector('.security-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should handle zero vulnerabilities', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('security-scorecard', container, {});

    widget.update({
      score: 100,
      vulnerabilities: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    });

    const canvas = container.querySelector('.security-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should handle trend data', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('security-scorecard', container, {});

    widget.update({
      score: 85,
      vulnerabilities: {
        critical: 0,
        high: 2,
        medium: 5,
        low: 10
      },
      trend: 'up',
      scoreHistory: [75, 78, 82, 85]
    });

    const canvas = container.querySelector('.security-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should handle null data gracefully', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('security-scorecard', container, {});

    // Should not throw
    widget.update(null);

    const canvas = container.querySelector('.security-canvas');
    expect(canvas).toBeTruthy();
  });
});
