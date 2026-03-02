// ===========================================================================
// Widget Tests: Pipeline Flow
// Tests pipeline flow widget for CI/CD pipeline visualization
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript } from '../../helpers/dom-helpers.js';

describe('Widget: Pipeline Flow', () => {
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

  it('should render pipeline canvas', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('pipeline-flow', container, {});

    widget.update({
      stages: [
        { name: 'Build', status: 'success', duration: 120 },
        { name: 'Test', status: 'success', duration: 90 },
        { name: 'Deploy', status: 'running', duration: 30 }
      ]
    });

    const canvas = container.querySelector('.pipeline-canvas');
    expect(canvas).toBeTruthy();
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('should handle multiple pipeline stages', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('pipeline-flow', container, {});

    widget.update({
      stages: [
        { name: 'Build', status: 'success', duration: 120 },
        { name: 'Test', status: 'success', duration: 90 },
        { name: 'Deploy', status: 'success', duration: 60 },
        { name: 'Verify', status: 'success', duration: 30 }
      ]
    });

    const canvas = container.querySelector('.pipeline-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should handle pipeline with summary data', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('pipeline-flow', container, {});

    widget.update({
      stages: [
        { name: 'Build', status: 'success', duration: 120 }
      ],
      summary: {
        totalDuration: 300,
        success: 5,
        failed: 1
      }
    });

    const canvas = container.querySelector('.pipeline-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should handle different stage statuses', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('pipeline-flow', container, {});

    widget.update({
      stages: [
        { name: 'Build', status: 'success', duration: 120 },
        { name: 'Test', status: 'failed', duration: 45 },
        { name: 'Deploy', status: 'pending', duration: 0 }
      ]
    });

    const canvas = container.querySelector('.pipeline-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should handle empty stages array', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('pipeline-flow', container, {});

    widget.update({ stages: [] });

    const canvas = container.querySelector('.pipeline-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should handle single stage pipeline', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('pipeline-flow', container, {});

    widget.update({
      stages: [
        { name: 'Build', status: 'running', duration: 60 }
      ]
    });

    const canvas = container.querySelector('.pipeline-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should accept null data gracefully', () => {
    const container = document.getElementById('test-container');
    const widget = window.Widgets.create('pipeline-flow', container, {});

    // Should not throw
    widget.update(null);

    const canvas = container.querySelector('.pipeline-canvas');
    expect(canvas).toBeTruthy();
  });
});
