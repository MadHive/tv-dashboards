// ===========================================================================
// Editor Tests: Property Panel
// Tests widget property editing UI and form handling
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupDOM, loadScript } from '../../helpers/dom-helpers.js';

describe('Editor: Property Panel', () => {
  let dom, cleanup;

  beforeEach(() => {
    const setup = setupDOM();
    dom = setup.dom;
    cleanup = setup.cleanup;

    loadScript('public/js/editor-utils.js');
    loadScript('public/js/editor-panel.js');
  });

  afterEach(() => {
    cleanup();
  });

  it('should initialize PropertyPanel class', () => {
    const PropertyPanel = window.PropertyPanel;
    expect(PropertyPanel).toBeTruthy();
    expect(typeof PropertyPanel).toBe('function');
  });

  it('should create property panel instance', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const PropertyPanel = window.PropertyPanel;
    const panel = new PropertyPanel(mockEditorApp);

    expect(panel).toBeTruthy();
    expect(panel.editorApp).toBe(mockEditorApp);
  });

  it('should create panel DOM element', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const PropertyPanel = window.PropertyPanel;
    const panel = new PropertyPanel(mockEditorApp);

    expect(panel.panel).toBeTruthy();
    expect(panel.panel.className).toBe('property-panel');
  });

  it('should have panel header with title', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const PropertyPanel = window.PropertyPanel;
    const panel = new PropertyPanel(mockEditorApp);

    const header = panel.panel.querySelector('.property-panel-header h3');
    expect(header).toBeTruthy();
    expect(header.textContent).toBe('Widget Properties');
  });

  it('should have close button in header', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const PropertyPanel = window.PropertyPanel;
    const panel = new PropertyPanel(mockEditorApp);

    const closeButton = panel.panel.querySelector('.panel-close');
    expect(closeButton).toBeTruthy();
  });

  it('should have widget property form', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const PropertyPanel = window.PropertyPanel;
    const panel = new PropertyPanel(mockEditorApp);

    const form = panel.panel.querySelector('#widget-property-form');
    expect(form).toBeTruthy();
  });

  it('should have widget type selector', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const PropertyPanel = window.PropertyPanel;
    const panel = new PropertyPanel(mockEditorApp);

    const typeSelect = panel.panel.querySelector('#prop-type');
    expect(typeSelect).toBeTruthy();
    expect(typeSelect.tagName).toBe('SELECT');
  });

  it('should have widget title input', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const PropertyPanel = window.PropertyPanel;
    const panel = new PropertyPanel(mockEditorApp);

    const titleInput = panel.panel.querySelector('#prop-title');
    expect(titleInput).toBeTruthy();
    expect(titleInput.tagName).toBe('INPUT');
  });

  it('should have data source selector', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const PropertyPanel = window.PropertyPanel;
    const panel = new PropertyPanel(mockEditorApp);

    const sourceSelect = panel.panel.querySelector('#prop-source');
    expect(sourceSelect).toBeTruthy();
    expect(sourceSelect.tagName).toBe('SELECT');
  });

  it('should have query selector (initially hidden)', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const PropertyPanel = window.PropertyPanel;
    const panel = new PropertyPanel(mockEditorApp);

    const queryGroup = panel.panel.querySelector('#prop-query-group');
    expect(queryGroup).toBeTruthy();
    expect(queryGroup.style.display).toBe('none');
  });

  it('should initialize with panel hidden', () => {
    const mockEditorApp = {
      dashboardApp: {
        config: { dashboards: [] }
      }
    };

    const PropertyPanel = window.PropertyPanel;
    const panel = new PropertyPanel(mockEditorApp);

    expect(panel.panel.style.display).toBe('none');
  });
});
