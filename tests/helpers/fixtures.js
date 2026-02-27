// ===========================================================================
// Test Fixtures — Reusable test data
// ===========================================================================

/**
 * Sample dashboard for testing
 */
export const testDashboard = {
  id: 'test-dashboard',
  name: 'Test Dashboard',
  subtitle: 'Dashboard for testing',
  icon: 'test',
  grid: {
    columns: 4,
    rows: 3,
    gap: 14
  },
  widgets: [
    {
      id: 'test-widget-1',
      type: 'big-number',
      title: 'Test Widget 1',
      source: 'mock',
      position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 }
    },
    {
      id: 'test-widget-2',
      type: 'gauge',
      title: 'Test Widget 2',
      source: 'mock',
      position: { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
      min: 0,
      max: 100
    }
  ]
};

/**
 * Sample BigQuery query
 */
export const testBigQueryQuery = {
  id: 'test-bq-query',
  name: 'Test BigQuery Query',
  description: 'A test BigQuery query',
  sql: 'SELECT COUNT(*) as value FROM test_table',
  widgetTypes: ['big-number', 'stat-card']
};

/**
 * Sample GCP query
 */
export const testGCPQuery = {
  id: 'test-gcp-query',
  name: 'Test GCP Query',
  description: 'A test GCP metric query',
  metricType: 'run.googleapis.com/request_count',
  project: 'mad-master',
  timeWindow: 10,
  aggregation: 'ALIGN_RATE',
  widgetTypes: ['big-number', 'line-chart']
};

/**
 * Sample configuration
 */
export const testConfig = {
  global: {
    title: 'Test Dashboards',
    rotation_interval: 30,
    refresh_interval: 10
  },
  dashboards: [
    testDashboard,
    {
      id: 'test-dashboard-2',
      name: 'Second Test Dashboard',
      grid: { columns: 4, rows: 3, gap: 14 },
      widgets: [{
        id: 'test-widget',
        type: 'big-number',
        title: 'Test',
        source: 'mock',
        position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 }
      }]
    }
  ]
};

/**
 * Sample template
 */
export const testTemplate = {
  name: 'Test Template',
  dashboard: testDashboard,
  metadata: {
    author: 'Test User',
    description: 'A test template',
    tags: ['test', 'sample']
  }
};

/**
 * Sample widget data response
 */
export const testWidgetData = {
  'test-widget-1': {
    value: 1234,
    timestamp: '2026-02-27T12:00:00Z'
  },
  'test-widget-2': {
    value: 75.5,
    timestamp: '2026-02-27T12:00:00Z'
  }
};

/**
 * Sample GCP monitoring response
 */
export const testGCPResponse = {
  timeSeries: [
    {
      metric: {
        type: 'run.googleapis.com/request_count',
        labels: {
          service: 'test-service'
        }
      },
      resource: {
        type: 'cloud_run_revision',
        labels: {
          project_id: 'mad-master',
          service_name: 'test-service'
        }
      },
      points: [
        {
          interval: {
            startTime: { seconds: 1709038800 },
            endTime: { seconds: 1709039400 }
          },
          value: {
            doubleValue: 1234.5
          }
        }
      ]
    }
  ]
};

/**
 * Sample BigQuery response
 */
export const testBigQueryResponse = [
  [
    { value: 100, label: 'Service A' },
    { value: 250, label: 'Service B' },
    { value: 175, label: 'Service C' }
  ]
];

/**
 * Invalid dashboard (missing required fields)
 */
export const invalidDashboard = {
  name: 'Invalid Dashboard',
  // Missing id
  // Missing grid
  widgets: []
};

/**
 * Factory function to create test dashboard with custom properties
 */
export function createTestDashboard(overrides = {}) {
  return {
    ...testDashboard,
    ...overrides,
    id: overrides.id || `test-dashboard-${Date.now()}`,
    widgets: overrides.widgets || testDashboard.widgets
  };
}

/**
 * Factory function to create test query
 */
export function createTestQuery(source = 'bigquery', overrides = {}) {
  const base = source === 'bigquery' ? testBigQueryQuery : testGCPQuery;
  return {
    ...base,
    ...overrides,
    id: overrides.id || `test-query-${Date.now()}`
  };
}

/**
 * Factory function to create test widget
 */
export function createTestWidget(type = 'big-number', overrides = {}) {
  return {
    id: `test-widget-${Date.now()}`,
    type,
    title: `Test ${type} Widget`,
    source: 'mock',
    position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
    ...overrides
  };
}
