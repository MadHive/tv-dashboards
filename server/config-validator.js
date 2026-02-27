// ===========================================================================
// Configuration Validator — Schema validation for dashboard configs
// ===========================================================================

const VALID_WIDGET_TYPES = [
  'big-number',
  'stat-card',
  'gauge',
  'gauge-row',
  'bar-chart',
  'progress-bar',
  'status-grid',
  'alert-list',
  'service-heatmap',
  'pipeline-flow',
  'usa-map',
  'security-scorecard',
  'sparkline',
  'multi-metric-card',
  'line-chart',
  'heatmap',
  'stacked-bar-chart',
  'sankey',
  'table',
  'treemap'
];

const VALID_DATA_SOURCES = [
  'gcp',
  'aws',
  'datadog',
  'elasticsearch',
  'salesforce',
  'hotjar',
  'fullstory',
  'zendesk',
  'vulntrack',
  'mock'
];

/**
 * Validate entire config object
 */
export function validateConfig(config) {
  const errors = [];

  // Check top-level structure
  if (!config || typeof config !== 'object') {
    errors.push('Config must be an object');
    return { valid: false, errors };
  }

  // Validate global settings
  if (!config.global || typeof config.global !== 'object') {
    errors.push('Config must have a global settings object');
  } else {
    const globalErrors = validateGlobalSettings(config.global);
    errors.push(...globalErrors);
  }

  // Validate dashboards array
  if (!Array.isArray(config.dashboards)) {
    errors.push('Config must have a dashboards array');
  } else if (config.dashboards.length === 0) {
    errors.push('Config must have at least one dashboard');
  } else {
    // Validate each dashboard
    config.dashboards.forEach((dashboard, index) => {
      const dashErrors = validateDashboard(dashboard);
      dashErrors.forEach(err => {
        errors.push(`Dashboard ${index} (${dashboard.id || 'unknown'}): ${err}`);
      });
    });

    // Check for duplicate dashboard IDs
    const ids = config.dashboards.map(d => d.id).filter(Boolean);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (duplicates.length > 0) {
      errors.push(`Duplicate dashboard IDs: ${duplicates.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate global settings
 */
function validateGlobalSettings(global) {
  const errors = [];

  if (typeof global.rotation_interval !== 'number' || global.rotation_interval <= 0) {
    errors.push('global.rotation_interval must be a positive number');
  }

  if (typeof global.refresh_interval !== 'number' || global.refresh_interval <= 0) {
    errors.push('global.refresh_interval must be a positive number');
  }

  if (!global.title || typeof global.title !== 'string') {
    errors.push('global.title must be a non-empty string');
  }

  return errors;
}

/**
 * Validate a single dashboard
 */
export function validateDashboard(dashboard) {
  const errors = [];

  // Required fields
  if (!dashboard.id || typeof dashboard.id !== 'string') {
    errors.push('Dashboard must have an id (string)');
  }

  if (!dashboard.name || typeof dashboard.name !== 'string') {
    errors.push('Dashboard must have a name (string)');
  }

  // Grid configuration
  if (!dashboard.grid || typeof dashboard.grid !== 'object') {
    errors.push('Dashboard must have a grid configuration');
  } else {
    const gridErrors = validateGrid(dashboard.grid);
    errors.push(...gridErrors);
  }

  // Widgets array
  if (!Array.isArray(dashboard.widgets)) {
    errors.push('Dashboard must have a widgets array');
  } else if (dashboard.widgets.length === 0) {
    errors.push('Dashboard must have at least one widget');
  } else {
    // Validate each widget
    dashboard.widgets.forEach((widget, index) => {
      const widgetErrors = validateWidget(widget, dashboard.grid);
      widgetErrors.forEach(err => {
        errors.push(`Widget ${index} (${widget.id || 'unknown'}): ${err}`);
      });
    });

    // Check for duplicate widget IDs
    const ids = dashboard.widgets.map(w => w.id).filter(Boolean);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (duplicates.length > 0) {
      errors.push(`Duplicate widget IDs: ${duplicates.join(', ')}`);
    }

    // Check for widget overlaps
    const overlaps = findWidgetOverlaps(dashboard.widgets);
    if (overlaps.length > 0) {
      overlaps.forEach(overlap => {
        errors.push(`Widgets overlap: ${overlap.widget1} and ${overlap.widget2}`);
      });
    }
  }

  return errors;
}

/**
 * Validate grid configuration
 */
function validateGrid(grid) {
  const errors = [];

  if (typeof grid.columns !== 'number' || grid.columns < 1 || grid.columns > 12) {
    errors.push('grid.columns must be a number between 1 and 12');
  }

  if (typeof grid.rows !== 'number' || grid.rows < 1 || grid.rows > 10) {
    errors.push('grid.rows must be a number between 1 and 10');
  }

  if (grid.gap !== undefined) {
    if (typeof grid.gap !== 'number' || grid.gap < 0 || grid.gap > 50) {
      errors.push('grid.gap must be a number between 0 and 50');
    }
  }

  return errors;
}

/**
 * Validate a single widget
 */
function validateWidget(widget, grid) {
  const errors = [];

  // Required fields
  if (!widget.id || typeof widget.id !== 'string') {
    errors.push('Widget must have an id (string)');
  }

  if (!widget.type || typeof widget.type !== 'string') {
    errors.push('Widget must have a type (string)');
  } else if (!VALID_WIDGET_TYPES.includes(widget.type)) {
    errors.push(`Invalid widget type: ${widget.type}. Must be one of: ${VALID_WIDGET_TYPES.join(', ')}`);
  }

  if (widget.title === undefined || typeof widget.title !== 'string') {
    errors.push('Widget must have a title property (string, can be empty)');
  }

  // Data source validation
  if (widget.source && !VALID_DATA_SOURCES.includes(widget.source)) {
    errors.push(`Invalid data source: ${widget.source}. Must be one of: ${VALID_DATA_SOURCES.join(', ')}`);
  }

  // Position validation
  if (!widget.position || typeof widget.position !== 'object') {
    errors.push('Widget must have a position object');
  } else {
    const posErrors = validatePosition(widget.position, grid);
    errors.push(...posErrors);
  }

  return errors;
}

/**
 * Validate widget position
 */
function validatePosition(position, grid) {
  const errors = [];

  if (typeof position.col !== 'number' || position.col < 1) {
    errors.push('position.col must be a number >= 1');
  }

  if (typeof position.row !== 'number' || position.row < 1) {
    errors.push('position.row must be a number >= 1');
  }

  const colSpan = position.colSpan || 1;
  const rowSpan = position.rowSpan || 1;

  if (typeof colSpan !== 'number' || colSpan < 1) {
    errors.push('position.colSpan must be a number >= 1');
  }

  if (typeof rowSpan !== 'number' || rowSpan < 1) {
    errors.push('position.rowSpan must be a number >= 1');
  }

  // Check bounds if grid is provided
  if (grid) {
    if (position.col + colSpan - 1 > grid.columns) {
      errors.push(`Widget extends beyond grid columns (col ${position.col} + span ${colSpan} > ${grid.columns} columns)`);
    }

    if (position.row + rowSpan - 1 > grid.rows) {
      errors.push(`Widget extends beyond grid rows (row ${position.row} + span ${rowSpan} > ${grid.rows} rows)`);
    }
  }

  return errors;
}

/**
 * Find overlapping widgets
 */
function findWidgetOverlaps(widgets) {
  const overlaps = [];

  for (let i = 0; i < widgets.length; i++) {
    for (let j = i + 1; j < widgets.length; j++) {
      const w1 = widgets[i];
      const w2 = widgets[j];

      if (widgetsOverlap(w1.position, w2.position)) {
        overlaps.push({
          widget1: w1.id || `index ${i}`,
          widget2: w2.id || `index ${j}`
        });
      }
    }
  }

  return overlaps;
}

/**
 * Check if two widget positions overlap
 */
function widgetsOverlap(pos1, pos2) {
  const col1 = pos1.col;
  const row1 = pos1.row;
  const colSpan1 = pos1.colSpan || 1;
  const rowSpan1 = pos1.rowSpan || 1;

  const col2 = pos2.col;
  const row2 = pos2.row;
  const colSpan2 = pos2.colSpan || 1;
  const rowSpan2 = pos2.rowSpan || 1;

  const colOverlap = col1 < col2 + colSpan2 && col1 + colSpan1 > col2;
  const rowOverlap = row1 < row2 + rowSpan2 && row1 + rowSpan1 > row2;

  return colOverlap && rowOverlap;
}
