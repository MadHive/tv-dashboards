import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { JSDOM } from 'jsdom';

/**
 * Tests for 8 new widget types implemented in PR #17:
 * - sparkline (canvas)
 * - multiMetricCard (DOM)
 * - lineChart (canvas)
 * - heatmap (canvas)
 * - stackedBar (canvas)
 * - sankey (canvas)
 * - table (DOM with sorting)
 * - treemap (canvas)
 */

describe('New Widget Types (PR #17)', () => {
  let dom;
  let window;
  let document;
  let Widgets;
  let Charts;

  beforeEach(async () => {
    // Setup JSDOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head></head>
        <body></body>
      </html>
    `, {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLCanvasElement = window.HTMLCanvasElement;
    global.CanvasRenderingContext2D = window.CanvasRenderingContext2D;

    // Mock Image constructor for charts.js (both global and window)
    class MockImage {
      constructor() {
        this.src = '';
        this.onload = null;
      }
    }
    window.Image = MockImage;
    global.Image = MockImage;

    // Mock canvas methods
    HTMLCanvasElement.prototype.getContext = function() {
      return {
        canvas: this,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        font: '',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        shadowColor: '',
        shadowBlur: 0,
        scale: () => {},
        clearRect: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        bezierCurveTo: () => {},
        fill: () => {},
        stroke: () => {},
        fillText: () => {},
        createLinearGradient: () => ({
          addColorStop: () => {}
        }),
        createRadialGradient: () => ({
          addColorStop: () => {}
        }),
        save: () => {},
        restore: () => {},
        setTransform: () => {},
        setLineDash: () => {}
      };
    };

    HTMLCanvasElement.prototype.getBoundingClientRect = function() {
      return {
        width: this.width || 400,
        height: this.height || 300,
        top: 0,
        left: 0,
        right: this.width || 400,
        bottom: this.height || 300
      };
    };

    // Load charts.js and widgets.js
    // Note: Using Function constructor to load modules in test environment
    const chartsCode = await Bun.file('./public/js/charts.js').text();
    const chartsModule = new Function('window', chartsCode);
    chartsModule(window);
    Charts = window.Charts;

    const widgetsCode = await Bun.file('./public/js/widgets.js').text();
    const widgetsModule = new Function('window', widgetsCode);
    widgetsModule(window);
    Widgets = window.Widgets;
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.HTMLCanvasElement;
    delete global.CanvasRenderingContext2D;
  });

  // =========================================================================
  // SPARKLINE WIDGET TESTS
  // =========================================================================

  describe('sparkline widget', () => {
    it('should create a sparkline widget with canvas element', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('sparkline', container, {});

      expect(widget).toBeDefined();
      expect(widget.update).toBeDefined();
      expect(typeof widget.update).toBe('function');

      const canvas = container.querySelector('canvas.sparkline-canvas');
      expect(canvas).toBeTruthy();
      expect(canvas.style.width).toBe('100%');
      expect(canvas.style.height).toBe('100%');
    });

    it('should update sparkline with valid data', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('sparkline', container, {});

      const data = {
        values: [10, 15, 13, 17, 20, 18, 22, 25, 23, 28]
      };

      expect(() => widget.update(data)).not.toThrow();
    });

    it('should handle missing data gracefully', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('sparkline', container, {});

      expect(() => widget.update(null)).not.toThrow();
      expect(() => widget.update(undefined)).not.toThrow();
      expect(() => widget.update({})).not.toThrow();
    });

    it('should handle empty values array', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('sparkline', container, {});

      const data = { values: [] };
      expect(() => widget.update(data)).not.toThrow();
    });

    it('should handle single value', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('sparkline', container, {});

      const data = { values: [42] };
      expect(() => widget.update(data)).not.toThrow();
    });
  });

  // =========================================================================
  // MULTI-METRIC CARD WIDGET TESTS
  // =========================================================================

  describe('multiMetricCard widget', () => {
    it('should create a multi-metric card with DOM structure', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('multi-metric-card', container, {});

      expect(widget).toBeDefined();
      expect(widget.update).toBeDefined();

      const wrap = container.querySelector('.multi-metric-wrap');
      expect(wrap).toBeTruthy();
      expect(wrap.style.display).toBe('grid');
      expect(wrap.style.gap).toBe('12px');
      expect(wrap.style.padding).toBe('16px');
    });

    it('should render metrics correctly', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('multi-metric-card', container, {});

      const data = {
        metrics: [
          { label: 'CPU', value: 45, unit: '%', trend: 'stable' },
          { label: 'Memory', value: 78, unit: '%', trend: 'up' },
          { label: 'Disk', value: 32, unit: 'GB', trend: 'down' },
        ]
      };

      widget.update(data);

      const items = container.querySelectorAll('.metric-item');
      expect(items.length).toBe(3);

      const labels = container.querySelectorAll('.metric-label');
      expect(labels[0].textContent).toBe('CPU');
      expect(labels[1].textContent).toBe('Memory');
      expect(labels[2].textContent).toBe('Disk');
    });

    it('should handle grid layout for 2 metrics', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('multi-metric-card', container, {});

      const data = {
        metrics: [
          { label: 'CPU', value: 45, unit: '%' },
          { label: 'Memory', value: 78, unit: '%' },
        ]
      };

      widget.update(data);

      const wrap = container.querySelector('.multi-metric-wrap');
      expect(wrap.style.gridTemplateColumns).toBe('1fr 1fr');
    });

    it('should handle grid layout for more than 2 metrics', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('multi-metric-card', container, {});

      const data = {
        metrics: [
          { label: 'CPU', value: 45, unit: '%' },
          { label: 'Memory', value: 78, unit: '%' },
          { label: 'Disk', value: 32, unit: 'GB' },
          { label: 'Network', value: 120, unit: 'Mbps' },
        ]
      };

      widget.update(data);

      const wrap = container.querySelector('.multi-metric-wrap');
      expect(wrap.style.gridTemplateColumns).toBe('repeat(2, 1fr)');
    });

    it('should handle missing data gracefully', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('multi-metric-card', container, {});

      expect(() => widget.update(null)).not.toThrow();
      expect(() => widget.update({})).not.toThrow();
    });

    it('should format numbers correctly', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('multi-metric-card', container, {});

      const data = {
        metrics: [
          { label: 'Large', value: 1500000, unit: '' },
          { label: 'Medium', value: 15000, unit: '' },
          { label: 'Small', value: 45, unit: '' },
        ]
      };

      widget.update(data);

      const values = container.querySelectorAll('.metric-value');
      expect(values[0].textContent).toBe('1.5M'); // 1,500,000 -> 1.5M
      expect(values[1].textContent).toBe('15.0K'); // 15,000 -> 15.0K
      expect(values[2].textContent).toBe('45'); // 45 -> 45
    });

    it('should display trend arrows correctly', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('multi-metric-card', container, {});

      const data = {
        metrics: [
          { label: 'Up', value: 45, trend: 'up' },
          { label: 'Down', value: 30, trend: 'down' },
          { label: 'Stable', value: 50, trend: 'stable' },
        ]
      };

      widget.update(data);

      const trends = container.querySelectorAll('.metric-trend');
      expect(trends[0].textContent).toBe('▲'); // up
      expect(trends[1].textContent).toBe('▼'); // down
      expect(trends[2].textContent).toBe('▸'); // stable
    });
  });

  // =========================================================================
  // LINE CHART WIDGET TESTS
  // =========================================================================

  describe('lineChart widget', () => {
    it('should create a line chart with canvas element', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('line-chart', container, {});

      expect(widget).toBeDefined();
      expect(widget.update).toBeDefined();

      const canvas = container.querySelector('canvas.line-chart-canvas');
      expect(canvas).toBeTruthy();
      expect(canvas.style.width).toBe('100%');
      expect(canvas.style.height).toBe('100%');
    });

    it('should update with valid data', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('line-chart', container, {});

      const data = {
        series: [
          {
            name: 'Series 1',
            values: [10, 20, 15, 25, 30],
            color: '#FDA4D4'
          },
          {
            name: 'Series 2',
            values: [5, 15, 10, 20, 25],
            color: '#67E8F9'
          }
        ],
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May']
      };

      expect(() => widget.update(data)).not.toThrow();
    });

    it('should handle single series', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('line-chart', container, {});

      const data = {
        series: [
          {
            name: 'Series 1',
            values: [10, 20, 15, 25, 30]
          }
        ]
      };

      expect(() => widget.update(data)).not.toThrow();
    });

    it('should handle missing data', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('line-chart', container, {});

      expect(() => widget.update(null)).not.toThrow();
      expect(() => widget.update({})).not.toThrow();
      expect(() => widget.update({ series: [] })).not.toThrow();
    });

    it('should handle data without labels', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('line-chart', container, {});

      const data = {
        series: [
          {
            name: 'Series 1',
            values: [10, 20, 15, 25, 30]
          }
        ]
      };

      expect(() => widget.update(data)).not.toThrow();
    });
  });

  // =========================================================================
  // HEATMAP WIDGET TESTS
  // =========================================================================

  describe('heatmap widget', () => {
    it('should create a heatmap with canvas element', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('heatmap', container, {});

      expect(widget).toBeDefined();
      expect(widget.update).toBeDefined();

      const canvas = container.querySelector('canvas.heatmap-canvas');
      expect(canvas).toBeTruthy();
      expect(canvas.style.width).toBe('100%');
      expect(canvas.style.height).toBe('100%');
    });

    it('should update with valid data', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('heatmap', container, {});

      const data = {
        rows: ['Row 1', 'Row 2', 'Row 3'],
        columns: ['Col 1', 'Col 2', 'Col 3', 'Col 4'],
        values: [
          [10, 20, 15, 25],
          [30, 25, 35, 40],
          [15, 20, 18, 22]
        ]
      };

      expect(() => widget.update(data)).not.toThrow();
    });

    it('should handle missing data', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('heatmap', container, {});

      expect(() => widget.update(null)).not.toThrow();
      expect(() => widget.update({})).not.toThrow();
    });

    it('should handle single cell', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('heatmap', container, {});

      const data = {
        rows: ['Row 1'],
        columns: ['Col 1'],
        values: [[42]]
      };

      expect(() => widget.update(data)).not.toThrow();
    });

    it('should handle large heatmap', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('heatmap', container, {});

      const rows = Array.from({ length: 10 }, (_, i) => `Row ${i + 1}`);
      const columns = Array.from({ length: 10 }, (_, i) => `Col ${i + 1}`);
      const values = Array.from({ length: 10 }, () =>
        Array.from({ length: 10 }, () => Math.floor(Math.random() * 100))
      );

      const data = { rows, columns, values };
      expect(() => widget.update(data)).not.toThrow();
    });
  });

  // =========================================================================
  // STACKED BAR CHART WIDGET TESTS
  // =========================================================================

  describe('stackedBarChart widget', () => {
    it('should create a stacked bar chart with canvas element', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('stacked-bar-chart', container, {});

      expect(widget).toBeDefined();
      expect(widget.update).toBeDefined();

      const canvas = container.querySelector('canvas.stacked-bar-canvas');
      expect(canvas).toBeTruthy();
      expect(canvas.style.width).toBe('100%');
      expect(canvas.style.height).toBe('100%');
    });

    it('should update with valid data', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('stacked-bar-chart', container, {});

      const data = {
        categories: ['Q1', 'Q2', 'Q3', 'Q4'],
        segments: [
          {
            name: 'Product A',
            values: [100, 120, 110, 130],
            color: '#FDA4D4'
          },
          {
            name: 'Product B',
            values: [80, 90, 85, 95],
            color: '#67E8F9'
          },
          {
            name: 'Product C',
            values: [60, 70, 65, 75],
            color: '#4ADE80'
          }
        ]
      };

      expect(() => widget.update(data)).not.toThrow();
    });

    it('should handle single segment', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('stacked-bar-chart', container, {});

      const data = {
        categories: ['Q1', 'Q2', 'Q3'],
        segments: [
          {
            name: 'Product A',
            values: [100, 120, 110]
          }
        ]
      };

      expect(() => widget.update(data)).not.toThrow();
    });

    it('should handle missing data', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('stacked-bar-chart', container, {});

      expect(() => widget.update(null)).not.toThrow();
      expect(() => widget.update({})).not.toThrow();
    });
  });

  // =========================================================================
  // SANKEY WIDGET TESTS
  // =========================================================================

  describe('sankey widget', () => {
    it('should create a sankey diagram with canvas element', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('sankey', container, {});

      expect(widget).toBeDefined();
      expect(widget.update).toBeDefined();

      const canvas = container.querySelector('canvas.sankey-canvas');
      expect(canvas).toBeTruthy();
      expect(canvas.style.width).toBe('100%');
      expect(canvas.style.height).toBe('100%');
    });

    it('should update with valid data', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('sankey', container, {});

      const data = {
        nodes: [
          { id: 'a', label: 'Source A' },
          { id: 'b', label: 'Source B' },
          { id: 'c', label: 'Target C' },
          { id: 'd', label: 'Target D' }
        ],
        links: [
          { source: 'a', target: 'c', value: 100 },
          { source: 'a', target: 'd', value: 50 },
          { source: 'b', target: 'c', value: 80 },
          { source: 'b', target: 'd', value: 120 }
        ]
      };

      expect(() => widget.update(data)).not.toThrow();
    });

    it('should handle simple flow', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('sankey', container, {});

      const data = {
        nodes: [
          { id: 'a', label: 'Source' },
          { id: 'b', label: 'Target' }
        ],
        links: [
          { source: 'a', target: 'b', value: 100 }
        ]
      };

      expect(() => widget.update(data)).not.toThrow();
    });

    it('should handle missing data', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('sankey', container, {});

      expect(() => widget.update(null)).not.toThrow();
      expect(() => widget.update({})).not.toThrow();
    });

    it('should handle complex multi-stage flow', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('sankey', container, {});

      const data = {
        nodes: [
          { id: 's1', label: 'Source 1' },
          { id: 's2', label: 'Source 2' },
          { id: 'm1', label: 'Middle 1' },
          { id: 'm2', label: 'Middle 2' },
          { id: 't1', label: 'Target 1' },
          { id: 't2', label: 'Target 2' }
        ],
        links: [
          { source: 's1', target: 'm1', value: 100 },
          { source: 's1', target: 'm2', value: 50 },
          { source: 's2', target: 'm1', value: 80 },
          { source: 's2', target: 'm2', value: 120 },
          { source: 'm1', target: 't1', value: 150 },
          { source: 'm1', target: 't2', value: 30 },
          { source: 'm2', target: 't1', value: 70 },
          { source: 'm2', target: 't2', value: 100 }
        ]
      };

      expect(() => widget.update(data)).not.toThrow();
    });
  });

  // =========================================================================
  // TABLE WIDGET TESTS
  // =========================================================================

  describe('table widget', () => {
    it('should create a table with DOM structure', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('table', container, {});

      expect(widget).toBeDefined();
      expect(widget.update).toBeDefined();

      const wrap = container.querySelector('.table-wrap');
      expect(wrap).toBeTruthy();

      const table = container.querySelector('table.data-table');
      expect(table).toBeTruthy();
    });

    it('should render table with data', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('table', container, {});

      const data = {
        columns: [
          { key: 'name', label: 'Name', align: 'left' },
          { key: 'value', label: 'Value', align: 'right', format: 'number' },
          { key: 'status', label: 'Status', align: 'center', format: 'badge' }
        ],
        rows: [
          { name: 'Item 1', value: 100, status: 'success' },
          { name: 'Item 2', value: 200, status: 'warning' },
          { name: 'Item 3', value: 150, status: 'error' }
        ]
      };

      widget.update(data);

      const thead = container.querySelector('thead');
      const tbody = container.querySelector('tbody');

      expect(thead).toBeTruthy();
      expect(tbody).toBeTruthy();

      const headers = thead.querySelectorAll('th');
      expect(headers.length).toBe(3);
      expect(headers[0].textContent).toBe('Name');
      expect(headers[1].textContent).toBe('Value');
      expect(headers[2].textContent).toBe('Status');

      const rows = tbody.querySelectorAll('tr');
      expect(rows.length).toBe(3);
    });

    it('should make headers sortable', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('table', container, {});

      const data = {
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'value', label: 'Value', format: 'number' }
        ],
        rows: [
          { name: 'Charlie', value: 100 },
          { name: 'Alice', value: 200 },
          { name: 'Bob', value: 150 }
        ]
      };

      widget.update(data);

      const headers = container.querySelectorAll('th');
      expect(headers[0].className).toContain('sortable');
      expect(headers[1].className).toContain('sortable');
      expect(headers[0].onclick).toBeDefined();
      expect(headers[1].onclick).toBeDefined();
    });

    it('should sort by column when header clicked', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('table', container, {});

      const data = {
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'value', label: 'Value', format: 'number' }
        ],
        rows: [
          { name: 'Charlie', value: 100 },
          { name: 'Alice', value: 200 },
          { name: 'Bob', value: 150 }
        ]
      };

      widget.update(data);

      // Click the 'value' header to sort by value (onclick triggers widget.update internally)
      let valueHeader = container.querySelectorAll('th')[1];
      valueHeader.onclick();

      // Query again after update to check sort arrow
      valueHeader = container.querySelectorAll('th')[1];
      expect(valueHeader.textContent).toContain('▲');

      // Click again to reverse sort
      valueHeader.onclick();
      valueHeader = container.querySelectorAll('th')[1];
      expect(valueHeader.textContent).toContain('▼');
    });

    it('should apply alternating row styles', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('table', container, {});

      const data = {
        columns: [
          { key: 'name', label: 'Name' }
        ],
        rows: [
          { name: 'Row 1' },
          { name: 'Row 2' },
          { name: 'Row 3' },
          { name: 'Row 4' }
        ]
      };

      widget.update(data);

      const rows = container.querySelectorAll('tbody tr');
      expect(rows[0].classList.contains('alt')).toBe(false);
      expect(rows[1].classList.contains('alt')).toBe(true);
      expect(rows[2].classList.contains('alt')).toBe(false);
      expect(rows[3].classList.contains('alt')).toBe(true);
    });

    it('should format numbers correctly', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('table', container, {});

      const data = {
        columns: [
          { key: 'value', label: 'Value', format: 'number' }
        ],
        rows: [
          { value: 1500000 },
          { value: 15000 },
          { value: 45 }
        ]
      };

      widget.update(data);

      const cells = container.querySelectorAll('tbody td');
      expect(cells[0].textContent).toBe('1.5M');
      expect(cells[1].textContent).toBe('15.0K');
      expect(cells[2].textContent).toBe('45');
    });

    it('should render badge format', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('table', container, {});

      const data = {
        columns: [
          { key: 'status', label: 'Status', format: 'badge' }
        ],
        rows: [
          { status: 'success' },
          { status: 'warning' },
          { status: 'error' }
        ]
      };

      widget.update(data);

      const badges = container.querySelectorAll('.badge');
      expect(badges.length).toBe(3);
      expect(badges[0].classList.contains('badge-success')).toBe(true);
      expect(badges[1].classList.contains('badge-warning')).toBe(true);
      expect(badges[2].classList.contains('badge-error')).toBe(true);
    });

    it('should handle missing data', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('table', container, {});

      expect(() => widget.update(null)).not.toThrow();
      expect(() => widget.update({})).not.toThrow();
    });

    it('should handle empty rows', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('table', container, {});

      const data = {
        columns: [
          { key: 'name', label: 'Name' }
        ],
        rows: []
      };

      widget.update(data);

      const tbody = container.querySelector('tbody');
      expect(tbody).toBeTruthy();
      expect(tbody.querySelectorAll('tr').length).toBe(0);
    });
  });

  // =========================================================================
  // TREEMAP WIDGET TESTS
  // =========================================================================

  describe('treemap widget', () => {
    it('should create a treemap with canvas element', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('treemap', container, {});

      expect(widget).toBeDefined();
      expect(widget.update).toBeDefined();

      const canvas = container.querySelector('canvas.treemap-canvas');
      expect(canvas).toBeTruthy();
      expect(canvas.style.width).toBe('100%');
      expect(canvas.style.height).toBe('100%');
    });

    it('should update with valid data', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('treemap', container, {});

      const data = {
        children: [
          { name: 'Item A', value: 100, color: '#FDA4D4' },
          { name: 'Item B', value: 80, color: '#67E8F9' },
          { name: 'Item C', value: 60, color: '#4ADE80' },
          { name: 'Item D', value: 40, color: '#FBBF24' }
        ]
      };

      expect(() => widget.update(data)).not.toThrow();
    });

    it('should handle single item', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('treemap', container, {});

      const data = {
        children: [
          { name: 'Only Item', value: 100 }
        ]
      };

      expect(() => widget.update(data)).not.toThrow();
    });

    it('should handle many items', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('treemap', container, {});

      const children = Array.from({ length: 20 }, (_, i) => ({
        name: `Item ${i + 1}`,
        value: Math.floor(Math.random() * 100) + 10
      }));

      const data = { children };
      expect(() => widget.update(data)).not.toThrow();
    });

    it('should handle missing data', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('treemap', container, {});

      expect(() => widget.update(null)).not.toThrow();
      expect(() => widget.update({})).not.toThrow();
    });

    it('should handle empty children array', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('treemap', container, {});

      const data = { children: [] };
      expect(() => widget.update(data)).not.toThrow();
    });
  });

  // =========================================================================
  // CANVAS SETUP TESTS
  // =========================================================================

  describe('Canvas Setup', () => {
    it('should setup canvas with correct dimensions for sparkline', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('sparkline', container, {});
      const canvas = container.querySelector('canvas');

      expect(canvas).toBeTruthy();
      expect(canvas.getContext).toBeDefined();
      expect(canvas.getBoundingClientRect).toBeDefined();
    });

    it('should setup canvas for all canvas-based widgets', () => {
      const canvasWidgets = [
        'sparkline',
        'line-chart',
        'heatmap',
        'stacked-bar-chart',
        'sankey',
        'treemap'
      ];

      canvasWidgets.forEach(type => {
        const container = document.createElement('div');
        const widget = Widgets.create(type, container, {});
        const canvas = container.querySelector('canvas');

        expect(canvas).toBeTruthy();
        expect(canvas.style.width).toBe('100%');
        expect(canvas.style.height).toBe('100%');
      });
    });
  });

  // =========================================================================
  // INTEGRATION TESTS
  // =========================================================================

  describe('Widget Factory Integration', () => {
    it('should create all 8 new widget types', () => {
      const types = [
        'sparkline',
        'multi-metric-card',
        'line-chart',
        'heatmap',
        'stacked-bar-chart',
        'sankey',
        'table',
        'treemap'
      ];

      types.forEach(type => {
        const container = document.createElement('div');
        const widget = Widgets.create(type, container, {});

        expect(widget).toBeDefined();
        expect(widget.update).toBeDefined();
        expect(typeof widget.update).toBe('function');
      });
    });

    it('should handle unknown widget type gracefully', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('unknown-type', container, {});

      expect(widget).toBeDefined();
      expect(widget.update).toBeDefined();
      expect(container.textContent).toContain('Unknown widget');
    });

    it('should allow multiple widgets in same container parent', () => {
      const parent = document.createElement('div');

      const container1 = document.createElement('div');
      const container2 = document.createElement('div');
      parent.appendChild(container1);
      parent.appendChild(container2);

      const widget1 = Widgets.create('sparkline', container1, {});
      const widget2 = Widgets.create('table', container2, {});

      expect(widget1).toBeDefined();
      expect(widget2).toBeDefined();

      widget1.update({ values: [10, 20, 30] });
      widget2.update({
        columns: [{ key: 'name', label: 'Name' }],
        rows: [{ name: 'Test' }]
      });

      expect(container1.querySelector('canvas')).toBeTruthy();
      expect(container2.querySelector('table')).toBeTruthy();
    });

    it('should handle rapid updates without errors', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('sparkline', container, {});

      const data = { values: [10, 20, 30, 40, 50] };

      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        expect(() => widget.update(data)).not.toThrow();
      }
    });

    it('should handle widget updates with changing data structures', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('multi-metric-card', container, {});

      // First update with 2 metrics
      widget.update({
        metrics: [
          { label: 'CPU', value: 45, unit: '%' },
          { label: 'Memory', value: 78, unit: '%' }
        ]
      });

      let items = container.querySelectorAll('.metric-item');
      expect(items.length).toBe(2);

      // Second update with 4 metrics (should rebuild)
      widget.update({
        metrics: [
          { label: 'CPU', value: 50, unit: '%' },
          { label: 'Memory', value: 80, unit: '%' },
          { label: 'Disk', value: 32, unit: 'GB' },
          { label: 'Network', value: 120, unit: 'Mbps' }
        ]
      });

      items = container.querySelectorAll('.metric-item');
      expect(items.length).toBe(4);
    });
  });

  // =========================================================================
  // ERROR HANDLING TESTS
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle null and undefined data gracefully', () => {
      const types = [
        'sparkline',
        'multi-metric-card',
        'line-chart',
        'heatmap',
        'stacked-bar-chart',
        'sankey',
        'table',
        'treemap'
      ];

      types.forEach(type => {
        const container = document.createElement('div');
        const widget = Widgets.create(type, container, {});

        // All widgets should handle null and undefined without throwing
        expect(() => widget.update(null)).not.toThrow();
        expect(() => widget.update(undefined)).not.toThrow();
        expect(() => widget.update({})).not.toThrow();
      });
    });

    it('should handle partial data gracefully', () => {
      const container = document.createElement('div');
      const widget = Widgets.create('multi-metric-card', container, {});

      // Missing unit and trend
      const data = {
        metrics: [
          { label: 'CPU', value: 45 },
          { label: 'Memory', value: 78 }
        ]
      };

      expect(() => widget.update(data)).not.toThrow();

      const units = container.querySelectorAll('.metric-unit');
      expect(units[0].textContent).toBe('');
      expect(units[1].textContent).toBe('');
    });
  });
});
