// ===========================================================================
// Editor Tests: Drag & Drop
// Tests widget drag and drop functionality
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript } from '../../helpers/dom-helpers.js';

describe('Editor: Drag & Drop', () => {
  let dom, cleanup;

  beforeEach(() => {
    const setup = setupDOM();
    dom = setup.dom;
    cleanup = setup.cleanup;

    loadScript('public/js/editor-utils.js');
    loadScript('public/js/editor-drag.js');
  });

  afterEach(() => {
    cleanup();
  });

  it('should initialize WidgetDragController class', () => {
    const WidgetDragController = window.WidgetDragController;
    expect(WidgetDragController).toBeTruthy();
    expect(typeof WidgetDragController).toBe('function');
  });

  it('should create drag controller instance', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const WidgetDragController = window.WidgetDragController;
    const dragController = new WidgetDragController(mockEditorApp);

    expect(dragController).toBeTruthy();
    expect(dragController.editorApp).toBe(mockEditorApp);
  });

  it('should initialize with isDragging as false', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const WidgetDragController = window.WidgetDragController;
    const dragController = new WidgetDragController(mockEditorApp);

    expect(dragController.isDragging).toBe(false);
  });

  it('should initialize drag state properties', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const WidgetDragController = window.WidgetDragController;
    const dragController = new WidgetDragController(mockEditorApp);

    expect(dragController.draggedWidget).toBe(null);
    expect(dragController.draggedElement).toBe(null);
    expect(dragController.ghostElement).toBe(null);
  });

  it('should track mouse position during drag', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const WidgetDragController = window.WidgetDragController;
    const dragController = new WidgetDragController(mockEditorApp);

    expect(dragController.startMouseX).toBe(0);
    expect(dragController.startMouseY).toBe(0);
  });

  it('should track grid position during drag', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const WidgetDragController = window.WidgetDragController;
    const dragController = new WidgetDragController(mockEditorApp);

    expect(dragController.startCol).toBe(0);
    expect(dragController.startRow).toBe(0);
    expect(dragController.currentCol).toBe(0);
    expect(dragController.currentRow).toBe(0);
  });

  it('should have attachDragHandlers method', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const WidgetDragController = window.WidgetDragController;
    const dragController = new WidgetDragController(mockEditorApp);

    expect(typeof dragController.attachDragHandlers).toBe('function');
  });

  it('should have detachDragHandlers method', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const WidgetDragController = window.WidgetDragController;
    const dragController = new WidgetDragController(mockEditorApp);

    expect(typeof dragController.detachDragHandlers).toBe('function');
  });

  it('should have startDrag method', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const WidgetDragController = window.WidgetDragController;
    const dragController = new WidgetDragController(mockEditorApp);

    expect(typeof dragController.startDrag).toBe('function');
  });

  it('should add drag handle to widget element', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const WidgetDragController = window.WidgetDragController;
    const dragController = new WidgetDragController(mockEditorApp);

    const widgetElement = document.createElement('div');
    widgetElement.className = 'widget';
    document.body.appendChild(widgetElement);

    const mockConfig = {
      id: 'test-widget',
      position: { col: 1, row: 1 }
    };

    dragController.attachDragHandlers(widgetElement, mockConfig);

    const dragHandle = widgetElement.querySelector('.drag-handle');
    expect(dragHandle).toBeTruthy();
  });

  it('should attach mousedown handler to widget', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const WidgetDragController = window.WidgetDragController;
    const dragController = new WidgetDragController(mockEditorApp);

    const widgetElement = document.createElement('div');
    widgetElement.className = 'widget';
    document.body.appendChild(widgetElement);

    const mockConfig = {
      id: 'test-widget',
      position: { col: 1, row: 1 }
    };

    dragController.attachDragHandlers(widgetElement, mockConfig);

    expect(widgetElement._dragHandler).toBeTruthy();
    expect(typeof widgetElement._dragHandler).toBe('function');
  });
});
