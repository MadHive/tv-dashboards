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
 * Pure collision detection function (mirrors _hasCollision in studio-canvas.js).
 * Used in tests to verify snap-to-nearest behavior without requiring a browser global.
 */
export function hasCollision(dash, col, row, colSpan, rowSpan, excludeId) {
  return dash.widgets.some(function (w) {
    if (w.id === excludeId) return false;
    var wcs = w.position.colSpan || 1;
    var wrs = w.position.rowSpan || 1;
    var colOk = col < w.position.col + wcs && col + colSpan > w.position.col;
    var rowOk = row < w.position.row + wrs && row + rowSpan > w.position.row;
    return colOk && rowOk;
  });
}

/**
 * Pure snap-to-nearest function (mirrors _snapToNearest in studio-canvas.js).
 * Searches right→down→left→up in expanding rings until an open slot is found.
 */
export function snapToNearest(dash, desiredCol, desiredRow, colSpan, rowSpan, excludeId) {
  // Clamp desired position to valid grid range before checking collision
  var dc = Math.max(1, Math.min(dash.grid.columns - colSpan + 1, desiredCol));
  var dr = Math.max(1, Math.min(dash.grid.rows    - rowSpan + 1, desiredRow));
  if (!hasCollision(dash, dc, dr, colSpan, rowSpan, excludeId)) {
    return { col: dc, row: dr };
  }
  var maxR = Math.max(dash.grid.columns, dash.grid.rows);
  for (var d = 1; d <= maxR; d++) {
    var candidates = [
      { col: desiredCol + d, row: desiredRow },
      { col: desiredCol,     row: desiredRow + d },
      { col: desiredCol - d, row: desiredRow },
      { col: desiredCol,     row: desiredRow - d },
    ];
    for (var i = 0; i < candidates.length; i++) {
      var c = Math.max(1, Math.min(dash.grid.columns - colSpan + 1, candidates[i].col));
      var r = Math.max(1, Math.min(dash.grid.rows    - rowSpan + 1, candidates[i].row));
      if (!hasCollision(dash, c, r, colSpan, rowSpan, excludeId)) {
        return { col: c, row: r };
      }
    }
  }
  return { col: desiredCol, row: desiredRow };
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
