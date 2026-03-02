// ===========================================================================
// Dashboard Scenarios — Test fixture data for E2E and integration tests
// ===========================================================================

/**
 * Simple dashboard with single big-number widget using mock data
 *
 * Use case: Basic dashboard rendering, single widget scenarios
 *
 * @returns {Object} Dashboard configuration with 1 big-number widget
 */
export function simpleDashboard() {
  return {
    id: 'test-simple',
    name: 'Simple Test Dashboard',
    subtitle: 'Single Widget Test',
    icon: 'bolt',
    grid: {
      columns: 2,
      rows: 1,
      gap: 14
    },
    widgets: [
      {
        id: 'simple-bignumber',
        type: 'big-number',
        title: 'Total Users',
        source: 'mock',
        position: {
          col: 1,
          row: 1,
          colSpan: 2,
          rowSpan: 1
        },
        sparkline: true
      }
    ]
  };
}

/**
 * Complex dashboard with 6+ widgets of various types
 *
 * Use case: Multi-widget rendering, diverse widget types, layout testing
 * Widget types: big-number, stat-card, gauge, bar-chart, line-chart, gauge-row
 *
 * @returns {Object} Dashboard configuration with 8 diverse widgets
 */
export function complexDashboard() {
  return {
    id: 'test-complex',
    name: 'Complex Test Dashboard',
    subtitle: 'Multi-Widget Test Scenario',
    icon: 'grid',
    grid: {
      columns: 4,
      rows: 3,
      gap: 14
    },
    widgets: [
      {
        id: 'complex-bignumber',
        type: 'big-number',
        title: 'Requests Served',
        source: 'mock',
        position: {
          col: 1,
          row: 1,
          colSpan: 2,
          rowSpan: 1
        },
        sparkline: true
      },
      {
        id: 'complex-statcard',
        type: 'stat-card',
        title: 'Active Sessions',
        source: 'mock',
        position: {
          col: 3,
          row: 1,
          colSpan: 1,
          rowSpan: 1
        }
      },
      {
        id: 'complex-gauge',
        type: 'gauge',
        title: 'CPU Usage',
        source: 'mock',
        position: {
          col: 4,
          row: 1,
          colSpan: 1,
          rowSpan: 1
        },
        unit: '%',
        min: 0,
        max: 100
      },
      {
        id: 'complex-barchart',
        type: 'bar-chart',
        title: 'Top Services by Traffic',
        source: 'mock',
        position: {
          col: 1,
          row: 2,
          colSpan: 2,
          rowSpan: 1
        }
      },
      {
        id: 'complex-linechart',
        type: 'line-chart',
        title: 'Response Time Trend',
        source: 'mock',
        position: {
          col: 3,
          row: 2,
          colSpan: 2,
          rowSpan: 1
        }
      },
      {
        id: 'complex-gauge-row',
        type: 'gauge-row',
        title: 'System Metrics',
        source: 'mock',
        position: {
          col: 1,
          row: 3,
          colSpan: 2,
          rowSpan: 1
        },
        unit: '%',
        min: 0,
        max: 100
      },
      {
        id: 'complex-progress',
        type: 'progress-bar',
        title: 'Deployment Progress',
        source: 'mock',
        position: {
          col: 3,
          row: 3,
          colSpan: 1,
          rowSpan: 1
        }
      },
      {
        id: 'complex-alerts',
        type: 'alert-list',
        title: 'Recent Alerts',
        source: 'mock',
        position: {
          col: 4,
          row: 3,
          colSpan: 1,
          rowSpan: 1
        }
      }
    ]
  };
}

/**
 * Multi-source dashboard using GCP, BigQuery, and Mock data sources
 *
 * Use case: Testing data source integration, multiple sources in one dashboard
 * Sources: GCP (Cloud Monitoring), BigQuery (SQL queries), Mock (test data)
 *
 * @returns {Object} Dashboard configuration with widgets from 3 data sources
 */
export function multiSourceDashboard() {
  return {
    id: 'test-multi-source',
    name: 'Multi-Source Dashboard',
    subtitle: 'GCP + BigQuery + Mock',
    icon: 'data',
    grid: {
      columns: 4,
      rows: 2,
      gap: 14
    },
    widgets: [
      // GCP widgets (Cloud Monitoring)
      {
        id: 'gcp-requests',
        type: 'big-number',
        title: 'Cloud Run Requests',
        source: 'gcp',
        project: 'mad-master',
        position: {
          col: 1,
          row: 1,
          colSpan: 1,
          rowSpan: 1
        },
        sparkline: true
      },
      {
        id: 'gcp-latency',
        type: 'gauge',
        title: 'Response Latency',
        source: 'gcp',
        project: 'mad-master',
        position: {
          col: 2,
          row: 1,
          colSpan: 1,
          rowSpan: 1
        },
        unit: 'ms',
        min: 0,
        max: 500
      },
      // BigQuery widgets (SQL queries)
      {
        id: 'bq-total-events',
        type: 'big-number',
        title: 'Total Events (BQ)',
        source: 'bigquery',
        queryId: 'example-count',
        position: {
          col: 3,
          row: 1,
          colSpan: 1,
          rowSpan: 1
        },
        sparkline: true
      },
      {
        id: 'bq-revenue-trend',
        type: 'line-chart',
        title: 'Revenue Trend',
        source: 'bigquery',
        queryId: 'revenue-trend',
        position: {
          col: 4,
          row: 1,
          colSpan: 1,
          rowSpan: 1
        }
      },
      // Mock widgets (test data)
      {
        id: 'mock-services',
        type: 'status-grid',
        title: 'Service Health',
        source: 'mock',
        position: {
          col: 1,
          row: 2,
          colSpan: 2,
          rowSpan: 1
        }
      },
      {
        id: 'mock-bar',
        type: 'bar-chart',
        title: 'Mock Data Chart',
        source: 'mock',
        position: {
          col: 3,
          row: 2,
          colSpan: 2,
          rowSpan: 1
        }
      }
    ]
  };
}

/**
 * Dashboard with all 12 widget types for comprehensive rendering tests
 *
 * Use case: Widget renderer testing, visual regression testing
 * Widget types: big-number, stat-card, gauge, gauge-row, bar-chart, line-chart,
 *               progress-bar, status-grid, alert-list, service-heatmap,
 *               pipeline-flow, security-scorecard
 *
 * @returns {Object} Dashboard configuration showcasing all widget types
 */
export function allWidgetTypesDashboard() {
  return {
    id: 'test-all-widgets',
    name: 'All Widget Types',
    subtitle: 'Complete Widget Showcase',
    icon: 'palette',
    grid: {
      columns: 4,
      rows: 3,
      gap: 14
    },
    widgets: [
      {
        id: 'widget-bignumber',
        type: 'big-number',
        title: 'Big Number Widget',
        source: 'mock',
        position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
        sparkline: true
      },
      {
        id: 'widget-statcard',
        type: 'stat-card',
        title: 'Stat Card Widget',
        source: 'mock',
        position: { col: 2, row: 1, colSpan: 1, rowSpan: 1 }
      },
      {
        id: 'widget-gauge',
        type: 'gauge',
        title: 'Gauge Widget',
        source: 'mock',
        position: { col: 3, row: 1, colSpan: 1, rowSpan: 1 },
        unit: '%',
        min: 0,
        max: 100
      },
      {
        id: 'widget-gauge-row',
        type: 'gauge-row',
        title: 'Gauge Row Widget',
        source: 'mock',
        position: { col: 4, row: 1, colSpan: 1, rowSpan: 1 },
        unit: '%',
        min: 0,
        max: 100
      },
      {
        id: 'widget-barchart',
        type: 'bar-chart',
        title: 'Bar Chart Widget',
        source: 'mock',
        position: { col: 1, row: 2, colSpan: 1, rowSpan: 1 }
      },
      {
        id: 'widget-linechart',
        type: 'line-chart',
        title: 'Line Chart Widget',
        source: 'mock',
        position: { col: 2, row: 2, colSpan: 1, rowSpan: 1 }
      },
      {
        id: 'widget-progress',
        type: 'progress-bar',
        title: 'Progress Bar Widget',
        source: 'mock',
        position: { col: 3, row: 2, colSpan: 1, rowSpan: 1 }
      },
      {
        id: 'widget-status-grid',
        type: 'status-grid',
        title: 'Status Grid Widget',
        source: 'mock',
        position: { col: 4, row: 2, colSpan: 1, rowSpan: 1 }
      },
      {
        id: 'widget-alerts',
        type: 'alert-list',
        title: 'Alert List Widget',
        source: 'mock',
        position: { col: 1, row: 3, colSpan: 1, rowSpan: 1 }
      },
      {
        id: 'widget-heatmap',
        type: 'service-heatmap',
        title: 'Service Heatmap Widget',
        source: 'mock',
        position: { col: 2, row: 3, colSpan: 1, rowSpan: 1 }
      },
      {
        id: 'widget-pipeline',
        type: 'pipeline-flow',
        title: 'Pipeline Flow Widget',
        source: 'mock',
        position: { col: 3, row: 3, colSpan: 1, rowSpan: 1 },
        stages: [
          { id: 'stage1', name: 'Build' },
          { id: 'stage2', name: 'Test' },
          { id: 'stage3', name: 'Deploy' }
        ]
      },
      {
        id: 'widget-security',
        type: 'security-scorecard',
        title: 'Security Scorecard Widget',
        source: 'mock',
        position: { col: 4, row: 3, colSpan: 1, rowSpan: 1 }
      }
    ]
  };
}

/**
 * Empty dashboard (no widgets)
 *
 * Use case: Empty state rendering, edge case testing
 *
 * @returns {Object} Dashboard configuration with no widgets
 */
export function emptyDashboard() {
  return {
    id: 'test-empty',
    name: 'Empty Dashboard',
    subtitle: 'No Widgets',
    icon: 'grid',
    grid: {
      columns: 4,
      rows: 2,
      gap: 14
    },
    widgets: []
  };
}

/**
 * Dashboard with invalid/error configurations
 *
 * Use case: Error handling, fallback data, resilience testing
 *
 * @returns {Object} Dashboard with widgets that will cause errors
 */
export function errorDashboard() {
  return {
    id: 'test-error',
    name: 'Error Test Dashboard',
    subtitle: 'Invalid Configuration',
    icon: 'alert',
    grid: {
      columns: 3,
      rows: 2,
      gap: 14
    },
    widgets: [
      {
        id: 'widget-invalid-source',
        type: 'big-number',
        title: 'Invalid Data Source',
        source: 'nonexistent-source',
        position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 }
      },
      {
        id: 'widget-missing-query',
        type: 'stat-card',
        title: 'Missing Query ID',
        source: 'bigquery',
        queryId: 'nonexistent-query-id',
        position: { col: 2, row: 1, colSpan: 1, rowSpan: 1 }
      },
      {
        id: 'widget-invalid-project',
        type: 'gauge',
        title: 'Invalid GCP Project',
        source: 'gcp',
        project: 'invalid-project-name',
        position: { col: 3, row: 1, colSpan: 1, rowSpan: 1 },
        unit: '%',
        min: 0,
        max: 100
      }
    ]
  };
}

/**
 * Factory function to create custom dashboard
 *
 * @param {Object} overrides - Custom properties to override defaults
 * @returns {Object} Dashboard configuration
 */
export function createDashboard(overrides = {}) {
  return {
    id: overrides.id || `test-dashboard-${Date.now()}`,
    name: overrides.name || 'Custom Test Dashboard',
    subtitle: overrides.subtitle || 'Custom Test',
    icon: overrides.icon || 'grid',
    grid: overrides.grid || {
      columns: 4,
      rows: 2,
      gap: 14
    },
    widgets: overrides.widgets || []
  };
}

/**
 * Factory function to create custom widget
 *
 * @param {Object} overrides - Custom properties to override defaults
 * @returns {Object} Widget configuration
 */
export function createWidget(overrides = {}) {
  return {
    id: overrides.id || `widget-${Date.now()}`,
    type: overrides.type || 'big-number',
    title: overrides.title || 'Test Widget',
    source: overrides.source || 'mock',
    position: overrides.position || {
      col: 1,
      row: 1,
      colSpan: 1,
      rowSpan: 1
    },
    ...overrides
  };
}
