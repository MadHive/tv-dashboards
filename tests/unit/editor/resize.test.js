// ===========================================================================
// Editor Tests: Resize
// Tests widget resize functionality
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript } from '../../helpers/dom-helpers.js';

describe('Editor: Resize', () => {
  let dom, cleanup;

  beforeEach(() => {
    const setup = setupDOM();
    dom = setup.dom;
    cleanup = setup.cleanup;

    loadScript('public/js/editor-utils.js');
    loadScript('public/js/editor-resize.js');
  });

  afterEach(() => {
    cleanup();
  });

  it('should initialize ResizeController class', () => {
    const ResizeController = window.ResizeController;
    expect(ResizeController).toBeTruthy();
    expect(typeof ResizeController).toBe('function');
  });

  it('should create resize controller instance', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const ResizeController = window.ResizeController;
    const resizeController = new ResizeController(mockEditorApp);

    expect(resizeController).toBeTruthy();
    expect(resizeController.editorApp).toBe(mockEditorApp);
  });

  it('should initialize with isResizing as false', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const ResizeController = window.ResizeController;
    const resizeController = new ResizeController(mockEditorApp);

    expect(resizeController.isResizing).toBe(false);
  });

  it('should initialize resize state properties', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const ResizeController = window.ResizeController;
    const resizeController = new ResizeController(mockEditorApp);

    expect(resizeController.resizedWidget).toBe(null);
    expect(resizeController.resizedElement).toBe(null);
  });

  it('should have attachResizeHandlers method', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const ResizeController = window.ResizeController;
    const resizeController = new ResizeController(mockEditorApp);

    expect(typeof resizeController.attachResizeHandlers).toBe('function');
  });

  it('should have detachResizeHandlers method', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const ResizeController = window.ResizeController;
    const resizeController = new ResizeController(mockEditorApp);

    expect(typeof resizeController.detachResizeHandlers).toBe('function');
  });

  it('should have startResize method', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const ResizeController = window.ResizeController;
    const resizeController = new ResizeController(mockEditorApp);

    expect(typeof resizeController.startResize).toBe('function');
  });

  it('should create resize handles for widget', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const ResizeController = window.ResizeController;
    const resizeController = new ResizeController(mockEditorApp);

    const widgetElement = document.createElement('div');
    widgetElement.className = 'widget';
    document.body.appendChild(widgetElement);

    const mockConfig = {
      id: 'test-widget',
      position: { col: 1, row: 1, colSpan: 2, rowSpan: 2 }
    };

    resizeController.attachResizeHandlers(widgetElement, mockConfig);

    const resizeHandles = widgetElement.querySelectorAll('.resize-handle');
    expect(resizeHandles.length).toBeGreaterThan(0);
  });
});
