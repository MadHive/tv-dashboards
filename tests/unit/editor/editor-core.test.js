// ===========================================================================
// Editor Tests: Editor Core
// Tests editor initialization, activation, and state management
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript } from '../../helpers/dom-helpers.js';

describe('Editor: Core', () => {
  let dom, cleanup;

  beforeEach(() => {
    const setup = setupDOM();
    dom = setup.dom;
    cleanup = setup.cleanup;

    // Load dependencies
    loadScript('public/js/charts.js');
    loadScript('public/js/widgets.js');
    loadScript('public/js/editor-utils.js');
    loadScript('public/js/editor.js');
  });

  afterEach(() => {
    cleanup();
  });

  it('should initialize EditorApp class', () => {
    const EditorApp = window.EditorApp;
    expect(EditorApp).toBeTruthy();
    expect(typeof EditorApp).toBe('function');
  });

  it('should create editor instance with dashboard app', () => {
    const mockDashboardApp = {
      config: { dashboards: [] },
      rotationTimer: null,
      refreshTimer: null
    };

    const EditorApp = window.EditorApp;
    const editor = new EditorApp(mockDashboardApp);

    expect(editor).toBeTruthy();
    expect(editor.dashboardApp).toBe(mockDashboardApp);
    expect(editor.isActive).toBe(false);
  });

  it('should have grid overlay element', () => {
    const mockDashboardApp = {
      config: { dashboards: [] },
      rotationTimer: null,
      refreshTimer: null
    };

    const EditorApp = window.EditorApp;
    const editor = new EditorApp(mockDashboardApp);

    expect(editor.gridOverlay).toBeTruthy();
    expect(editor.gridOverlay.className).toBe('editor-grid-overlay');
  });

  it('should initialize with isActive as false', () => {
    const mockDashboardApp = {
      config: { dashboards: [] },
      rotationTimer: null,
      refreshTimer: null
    };

    const EditorApp = window.EditorApp;
    const editor = new EditorApp(mockDashboardApp);

    expect(editor.isActive).toBe(false);
  });

  it('should track selected widget state', () => {
    const mockDashboardApp = {
      config: { dashboards: [] },
      rotationTimer: null,
      refreshTimer: null
    };

    const EditorApp = window.EditorApp;
    const editor = new EditorApp(mockDashboardApp);

    expect(editor.selectedWidget).toBe(null);
    expect(editor.selectedWidgetElement).toBe(null);
  });

  it('should have modified config state', () => {
    const mockDashboardApp = {
      config: { dashboards: [] },
      rotationTimer: null,
      refreshTimer: null
    };

    const EditorApp = window.EditorApp;
    const editor = new EditorApp(mockDashboardApp);

    expect(editor.modifiedConfig).toBe(null);
  });

  it('should initialize drag controller property', () => {
    const mockDashboardApp = {
      config: { dashboards: [] },
      rotationTimer: null,
      refreshTimer: null
    };

    const EditorApp = window.EditorApp;
    const editor = new EditorApp(mockDashboardApp);

    expect(editor.dragController).toBe(null);
  });

  it('should initialize resize controller property', () => {
    const mockDashboardApp = {
      config: { dashboards: [] },
      rotationTimer: null,
      refreshTimer: null
    };

    const EditorApp = window.EditorApp;
    const editor = new EditorApp(mockDashboardApp);

    expect(editor.resizeController).toBe(null);
  });

  it('should initialize property panel property', () => {
    const mockDashboardApp = {
      config: { dashboards: [] },
      rotationTimer: null,
      refreshTimer: null
    };

    const EditorApp = window.EditorApp;
    const editor = new EditorApp(mockDashboardApp);

    expect(editor.propertyPanel).toBe(null);
  });

  it('should have toggle method', () => {
    const mockDashboardApp = {
      config: { dashboards: [] },
      rotationTimer: null,
      refreshTimer: null
    };

    const EditorApp = window.EditorApp;
    const editor = new EditorApp(mockDashboardApp);

    expect(typeof editor.toggle).toBe('function');
  });

  it('should have enter method', () => {
    const mockDashboardApp = {
      config: { dashboards: [] },
      rotationTimer: null,
      refreshTimer: null
    };

    const EditorApp = window.EditorApp;
    const editor = new EditorApp(mockDashboardApp);

    expect(typeof editor.enter).toBe('function');
  });

  it('should have exit method', () => {
    const mockDashboardApp = {
      config: { dashboards: [] },
      rotationTimer: null,
      refreshTimer: null
    };

    const EditorApp = window.EditorApp;
    const editor = new EditorApp(mockDashboardApp);

    expect(typeof editor.exit).toBe('function');
  });
});
