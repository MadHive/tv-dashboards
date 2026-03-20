/**
 * Shared test fixtures for widget configuration tests (Phase 1).
 * Provides mock dashboard, widget, and query objects.
 */

export function createMockDash(overrides = {}) {
  return {
    id: 'test-dash',
    name: 'Test Dashboard',
    grid: { columns: 12, rows: 8, gap: 12 },
    widgets: [],
    ...overrides,
  };
}

export function createMockWidget(overrides = {}) {
  return {
    id: 'widget-1',
    title: 'Test Widget',
    type: 'big-number',
    source: 'gcp',
    queryId: 'query-1',
    position: { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
    unit: 'ms',
    ...overrides,
  };
}

export function createMockQueries() {
  return {
    gcp: [
      { id: 'query-1', name: 'CPU Usage', metricType: 'compute.googleapis.com/instance/cpu/utilization', source: 'gcp' },
      { id: 'query-2', name: 'Memory Usage', metricType: 'compute.googleapis.com/instance/memory/usage', source: 'gcp' },
      { id: 'query-3', name: 'Request Count', metricType: 'run.googleapis.com/request_count', source: 'gcp' },
      { id: 'query-4', name: 'Latency', metricType: 'run.googleapis.com/request_latencies', source: 'gcp' },
    ],
    bigquery: [
      { id: 'bq-1', name: 'Query Count', metricType: 'bigquery.googleapis.com/query/count', source: 'bigquery' },
    ],
  };
}

/**
 * Populate a mock dashboard with widgets to create specific collision scenarios.
 * @param {object} dash - Mock dashboard to populate
 * @param {Array<{col,row,colSpan,rowSpan,id}>} widgetPositions - Array of position objects
 */
export function populateWidgets(dash, widgetPositions) {
  dash.widgets = widgetPositions.map((pos, i) => createMockWidget({
    id: pos.id || `w-${i}`,
    position: {
      col: pos.col,
      row: pos.row,
      colSpan: pos.colSpan || 1,
      rowSpan: pos.rowSpan || 1,
    },
  }));
  return dash;
}
