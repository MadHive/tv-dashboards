# TV Dashboards - Comprehensive Test Plan

**Framework:** Elysia.js with Bun Test
**Approach:** Unit tests with `.handle()` method, Integration tests, E2E tests
**Test Runner:** `bun test`
**Date:** 2026-02-27

---

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Test Structure](#test-structure)
3. [Current Test Coverage](#current-test-coverage)
4. [Planned Test Coverage](#planned-test-coverage)
5. [Test Implementation Phases](#test-implementation-phases)
6. [Running Tests](#running-tests)
7. [Mocking Strategy](#mocking-strategy)
8. [CI/CD Integration](#cicd-integration)

---

## Testing Strategy

Following Elysia.js best practices:

### 1. **Unit Tests** (Primary Focus)
- Use `.handle()` method to test routes without network overhead
- Test individual route handlers in isolation
- Mock external dependencies (GCP, BigQuery, file system)
- Fast, deterministic, no side effects

### 2. **Integration Tests** (Secondary)
- Test multiple components working together
- Use Eden Treaty for type-safe API client testing
- Test actual file operations with test fixtures
- Test plugin interactions

### 3. **E2E Tests** (Minimal)
- Test critical user flows
- Use actual server instance
- Test OAuth flow, dashboard CRUD operations
- Run in separate test environment

### Key Principles
- **Isolated Test Instances:** Create new Elysia instance per test
- **No State Bleeding:** Clean up after each test
- **Mock External Services:** Don't hit real GCP, BigQuery in unit tests
- **Fast Execution:** Unit tests should run in milliseconds
- **Predictable Data:** Use fixtures and seed data

---

## Test Structure

```
tests/
├── unit/
│   ├── routes/
│   │   ├── config-routes.test.js          # /api/config
│   │   ├── dashboard-routes.test.js       # /api/dashboards/*
│   │   ├── data-routes.test.js            # /api/data/:widgetId, /api/metrics/:dashboardId
│   │   ├── backup-routes.test.js          # /api/backups/*
│   │   ├── data-source-routes.test.js     # /api/data-sources/*
│   │   ├── template-routes.test.js        # /api/templates/*
│   │   ├── health-routes.test.js          # /health
│   │   ├── query-routes.test.js           # ✅ DONE
│   │   ├── bigquery-routes.test.js        # /api/bigquery/*
│   │   ├── oauth-routes.test.js           # /auth/google/*
│   │   ├── tv-apps-routes.test.js         # /api/numerics/*, /api/anyboard/*
│   │   └── static-routes.test.js          # /, /public/*
│   │
│   ├── managers/
│   │   ├── query-manager.test.js          # ✅ DONE
│   │   ├── config-manager.test.js         # loadConfig, saveConfig, CRUD
│   │   ├── template-manager.test.js       # save/load/delete templates
│   │   └── config-validator.test.js       # validateConfig, validateDashboard
│   │
│   └── data-sources/
│       ├── data-source-registry.test.js   # ✅ DONE
│       ├── gcp-data-source.test.js        # GCP metrics fetching
│       ├── bigquery-data-source.test.js   # BigQuery queries
│       ├── mock-data-source.test.js       # Mock data generation
│       ├── vulntrack-data-source.test.js  # VulnTrack integration
│       └── [other-sources].test.js        # AWS, DataDog, etc.
│
├── integration/
│   ├── dashboard-lifecycle.test.js        # Create → Update → Delete
│   ├── query-to-widget-flow.test.js       # Query creation → Dashboard use
│   ├── backup-restore.test.js             # Backup → Restore → Verify
│   ├── template-workflow.test.js          # Save → Load → Apply template
│   └── data-source-health.test.js         # Connection testing
│
├── e2e/
│   ├── oauth-flow.test.js                 # Complete OAuth authentication
│   ├── dashboard-editing.test.js          # Full WYSIWYG editor workflow
│   └── data-fetching.test.js              # Real data source integration
│
├── fixtures/
│   ├── dashboards.yaml                    # Test dashboard configs
│   ├── queries.yaml                       # Test queries
│   ├── mock-gcp-responses.json            # Mocked GCP data
│   └── mock-bigquery-results.json         # Mocked BigQuery results
│
└── helpers/
    ├── test-app.js                        # Helper to create test Elysia instances
    ├── mocks.js                           # Mock factories for external services
    └── fixtures.js                        # Test data generators
```

---

## Current Test Coverage

### ✅ Completed (3 test files)

1. **`tests/query-routes.test.js`** (380 lines)
   - GET /api/queries/ (all sources)
   - GET /api/queries/:source
   - GET /api/queries/:source/:id
   - POST /api/queries/:source (create)
   - PUT /api/queries/:source/:id (update)
   - DELETE /api/queries/:source/:id
   - Error handling (malformed JSON, missing fields)

2. **`tests/query-manager.test.js`** (303 lines)
   - loadQueries()
   - saveQuery() - BigQuery & GCP
   - getQuery()
   - listQueries()
   - deleteQuery()
   - createBackup()
   - Persistence across save/load cycles

3. **`tests/data-source-integration.test.js`**
   - Data source registry integration
   - Mock data source testing

### 📊 Coverage Gaps

**Server Routes (0% coverage):**
- Config routes
- Dashboard CRUD routes
- Backup routes
- Data source routes
- Template routes
- Health check
- OAuth routes
- BigQuery routes
- TV Apps routes
- Static file serving

**Managers (33% coverage):**
- ✅ query-manager.js
- ❌ config-manager.js
- ❌ template-manager.js
- ❌ config-validator.js

**Data Sources (10% coverage):**
- ❌ Individual data source plugins
- ❌ Data fetching logic

---

## Planned Test Coverage

### Phase 1: Core Route Testing (Priority: HIGH)

#### 1.1 Config Routes (`tests/unit/routes/config-routes.test.js`)

```javascript
describe('Config Routes', () => {
  describe('GET /api/config', () => {
    it('should return dashboard configuration');
    it('should include dataMode metadata');
    it('should return valid YAML structure');
  });

  describe('POST /api/config', () => {
    it('should save valid configuration');
    it('should validate config before saving');
    it('should create backup before saving');
    it('should invalidate cache after save');
    it('should return 400 for invalid config');
  });
});
```

**Test Cases:** 8
**Estimated LOC:** 150

#### 1.2 Dashboard Routes (`tests/unit/routes/dashboard-routes.test.js`)

```javascript
describe('Dashboard Routes', () => {
  describe('PUT /api/dashboards/:id', () => {
    it('should update existing dashboard');
    it('should validate dashboard before update');
    it('should return 404 for non-existent dashboard');
    it('should invalidate cache after update');
  });

  describe('POST /api/dashboards', () => {
    it('should create new dashboard with valid data');
    it('should validate required fields');
    it('should generate unique ID if missing');
    it('should return 400 for invalid dashboard');
  });

  describe('DELETE /api/dashboards/:id', () => {
    it('should delete existing dashboard');
    it('should return 404 for non-existent dashboard');
    it('should preserve other dashboards');
  });
});
```

**Test Cases:** 12
**Estimated LOC:** 300

#### 1.3 Data Routes (`tests/unit/routes/data-routes.test.js`)

```javascript
describe('Data Routes', () => {
  describe('GET /api/metrics/:dashboardId', () => {
    it('should fetch metrics for dashboard with widgets');
    it('should use data source registry');
    it('should fall back to legacy GCP metrics');
    it('should fall back to mock data on error');
    it('should timeout after 20 seconds');
  });

  describe('GET /api/data/:widgetId', () => {
    it('should return cached data if available');
    it('should fetch fresh data when cache expired');
    it('should return widget data with timestamp');
    it('should return 404 for non-existent widget');
    it('should search across all dashboards');
  });
});
```

**Test Cases:** 10
**Estimated LOC:** 400

#### 1.4 Backup Routes (`tests/unit/routes/backup-routes.test.js`)

```javascript
describe('Backup Routes', () => {
  describe('GET /api/backups', () => {
    it('should list all backup files');
    it('should return timestamps and sizes');
    it('should handle empty backup directory');
  });

  describe('POST /api/backups/restore', () => {
    it('should restore valid backup file');
    it('should invalidate cache after restore');
    it('should return 400 for missing filename');
    it('should return 404 for non-existent backup');
  });
});
```

**Test Cases:** 7
**Estimated LOC:** 200

#### 1.5 Data Source Routes (`tests/unit/routes/data-source-routes.test.js`)

```javascript
describe('Data Source Routes', () => {
  describe('GET /api/data-sources', () => {
    it('should list all registered sources');
    it('should include connection status');
    it('should include ready state');
  });

  describe('GET /api/data-sources/schemas', () => {
    it('should return config schemas for all sources');
  });

  describe('GET /api/data-sources/health', () => {
    it('should return health status');
  });

  describe('GET /api/data-sources/:name/metrics', () => {
    it('should return available metrics for source');
    it('should return 404 for unknown source');
  });

  describe('POST /api/data-sources/:name/test', () => {
    it('should test connection for source');
    it('should return connection status');
    it('should handle connection failures');
  });
});
```

**Test Cases:** 10
**Estimated LOC:** 250

#### 1.6 Template Routes (`tests/unit/routes/template-routes.test.js`)

```javascript
describe('Template Routes', () => {
  describe('GET /api/templates', () => {
    it('should list all saved templates');
    it('should include metadata');
  });

  describe('GET /api/templates/:filename', () => {
    it('should load specific template');
    it('should return 404 for missing template');
  });

  describe('POST /api/templates', () => {
    it('should save new template');
    it('should require name and dashboard');
    it('should save with metadata');
  });

  describe('DELETE /api/templates/:filename', () => {
    it('should delete template');
    it('should return 404 for missing template');
  });

  describe('POST /api/dashboards/export', () => {
    it('should export dashboard as JSON');
    it('should set correct content-type');
    it('should set download filename');
  });

  describe('POST /api/dashboards/import', () => {
    it('should import valid dashboard JSON');
    it('should return 400 for invalid JSON');
  });
});
```

**Test Cases:** 13
**Estimated LOC:** 350

#### 1.7 Health Route (`tests/unit/routes/health-routes.test.js`)

```javascript
describe('Health Route', () => {
  describe('GET /health', () => {
    it('should return healthy status');
    it('should include timestamp');
    it('should include version');
    it('should include service name');
  });
});
```

**Test Cases:** 4
**Estimated LOC:** 80

---

### Phase 2: Manager Testing (Priority: MEDIUM)

#### 2.1 Config Manager (`tests/unit/managers/config-manager.test.js`)

```javascript
describe('Config Manager', () => {
  describe('loadConfig()', () => {
    it('should load configuration from YAML file');
    it('should add dataMode metadata');
    it('should throw error for invalid YAML');
    it('should throw error for missing file');
  });

  describe('saveConfig()', () => {
    it('should save valid configuration');
    it('should remove runtime metadata');
    it('should validate before saving');
    it('should create backup before saving');
    it('should throw error for invalid config');
  });

  describe('updateDashboard()', () => {
    it('should update existing dashboard');
    it('should validate dashboard data');
    it('should throw error for non-existent dashboard');
    it('should preserve other dashboards');
  });

  describe('createDashboard()', () => {
    it('should create new dashboard');
    it('should validate dashboard data');
    it('should add to dashboards array');
  });

  describe('deleteDashboard()', () => {
    it('should delete existing dashboard');
    it('should throw error for non-existent dashboard');
    it('should preserve other dashboards');
  });

  describe('listBackups()', () => {
    it('should list backup files');
    it('should include metadata');
    it('should sort by timestamp');
  });

  describe('restoreBackup()', () => {
    it('should restore from backup file');
    it('should validate restored config');
    it('should throw error for missing backup');
  });
});
```

**Test Cases:** 20
**Estimated LOC:** 500

#### 2.2 Template Manager (`tests/unit/managers/template-manager.test.js`)

```javascript
describe('Template Manager', () => {
  describe('saveTemplate()', () => {
    it('should save template with dashboard data');
    it('should save with metadata');
    it('should create templates directory if missing');
  });

  describe('listTemplates()', () => {
    it('should list all template files');
    it('should parse metadata');
  });

  describe('loadTemplate()', () => {
    it('should load template by filename');
    it('should throw error for missing template');
  });

  describe('deleteTemplate()', () => {
    it('should delete template file');
    it('should throw error for missing template');
  });

  describe('exportDashboard()', () => {
    it('should export as JSON string');
    it('should include all dashboard properties');
  });

  describe('importDashboard()', () => {
    it('should parse JSON string');
    it('should validate structure');
    it('should throw error for invalid JSON');
  });
});
```

**Test Cases:** 12
**Estimated LOC:** 300

#### 2.3 Config Validator (`tests/unit/managers/config-validator.test.js`)

```javascript
describe('Config Validator', () => {
  describe('validateConfig()', () => {
    it('should validate valid config');
    it('should reject missing dashboards array');
    it('should reject invalid dashboard structure');
    it('should validate widget references');
  });

  describe('validateDashboard()', () => {
    it('should validate valid dashboard');
    it('should reject missing id');
    it('should reject missing name');
    it('should reject invalid grid configuration');
    it('should validate widget positions');
    it('should validate widget types');
  });
});
```

**Test Cases:** 11
**Estimated LOC:** 350

---

### Phase 3: Data Source Testing (Priority: MEDIUM)

#### 3.1 GCP Data Source (`tests/unit/data-sources/gcp-data-source.test.js`)

```javascript
describe('GCP Data Source', () => {
  describe('initialize()', () => {
    it('should initialize monitoring client');
    it('should mark as connected');
  });

  describe('fetchMetrics()', () => {
    it('should fetch metrics from Cloud Monitoring');
    it('should handle query references');
    it('should format response for widget types');
    it('should handle timeWindow parameter');
  });

  describe('testConnection()', () => {
    it('should test GCP API connectivity');
  });

  // Mock GCP Monitoring API
});
```

**Test Cases:** 6
**Estimated LOC:** 250

#### 3.2 BigQuery Data Source (`tests/unit/data-sources/bigquery-data-source.test.js`)

```javascript
describe('BigQuery Data Source', () => {
  describe('initialize()', () => {
    it('should initialize BigQuery client');
  });

  describe('fetchMetrics()', () => {
    it('should execute SQL query');
    it('should handle query references');
    it('should format results for widgets');
    it('should handle parameters');
  });

  describe('testConnection()', () => {
    it('should test BigQuery connectivity');
  });

  // Mock BigQuery API
});
```

**Test Cases:** 6
**Estimated LOC:** 250

#### 3.3 Mock Data Source (`tests/unit/data-sources/mock-data-source.test.js`)

```javascript
describe('Mock Data Source', () => {
  describe('fetchMetrics()', () => {
    it('should generate mock data for big-number');
    it('should generate mock data for gauge');
    it('should generate mock data for line-chart');
    it('should generate mock data for all widget types');
    it('should return consistent structure');
  });
});
```

**Test Cases:** 5
**Estimated LOC:** 150

---

### Phase 4: Integration Testing (Priority: LOW)

#### 4.1 Dashboard Lifecycle (`tests/integration/dashboard-lifecycle.test.js`)

```javascript
describe('Dashboard Lifecycle Integration', () => {
  it('should create → read → update → delete dashboard');
  it('should maintain consistency across operations');
  it('should handle backup creation during updates');
});
```

**Test Cases:** 3
**Estimated LOC:** 200

#### 4.2 Query to Widget Flow (`tests/integration/query-to-widget-flow.test.js`)

```javascript
describe('Query to Widget Flow', () => {
  it('should create query → add to dashboard → fetch data');
  it('should update query → refresh widget data');
});
```

**Test Cases:** 2
**Estimated LOC:** 150

---

## Test Implementation Phases

### Phase 1: Foundation (Week 1)
- Set up test helpers and fixtures
- Implement config-routes.test.js
- Implement dashboard-routes.test.js
- Implement data-routes.test.js
- **Target:** 30 test cases, ~850 LOC

### Phase 2: Extended Routes (Week 2)
- Implement backup-routes.test.js
- Implement data-source-routes.test.js
- Implement template-routes.test.js
- Implement health-routes.test.js
- **Target:** 34 test cases, ~880 LOC

### Phase 3: Managers (Week 3)
- Implement config-manager.test.js
- Implement template-manager.test.js
- Implement config-validator.test.js
- **Target:** 43 test cases, ~1,150 LOC

### Phase 4: Data Sources (Week 4)
- Implement gcp-data-source.test.js
- Implement bigquery-data-source.test.js
- Implement mock-data-source.test.js
- **Target:** 17 test cases, ~650 LOC

### Phase 5: Integration (Week 5)
- Implement integration tests
- Implement E2E tests
- **Target:** 5 test cases, ~350 LOC

---

## Running Tests

### Run All Tests
```bash
bun test
```

### Run Specific Test File
```bash
bun test tests/unit/routes/config-routes.test.js
```

### Run Tests with Coverage
```bash
bun test --coverage
```

### Run Tests in Watch Mode
```bash
bun test --watch
```

### Run Only Unit Tests
```bash
bun test tests/unit/
```

### Run Only Integration Tests
```bash
bun test tests/integration/
```

---

## Mocking Strategy

### External Services

#### 1. GCP Monitoring API
```javascript
// tests/helpers/mocks.js
export function mockGCPMonitoring() {
  return {
    listTimeSeries: vi.fn().mockResolvedValue({
      timeSeries: [
        {
          points: [{ value: { doubleValue: 1234 } }]
        }
      ]
    })
  };
}
```

#### 2. BigQuery API
```javascript
export function mockBigQuery() {
  return {
    query: vi.fn().mockResolvedValue([
      [{ value: 100, label: 'Test' }]
    ])
  };
}
```

#### 3. File System Operations
```javascript
export function mockFileSystem() {
  const files = new Map();

  return {
    readFileSync: vi.fn((path) => files.get(path)),
    writeFileSync: vi.fn((path, content) => files.set(path, content)),
    existsSync: vi.fn((path) => files.has(path))
  };
}
```

### Test Fixtures

```javascript
// tests/fixtures/fixtures.js
export const testDashboard = {
  id: 'test-dashboard',
  name: 'Test Dashboard',
  grid: { columns: 4, rows: 3, gap: 14 },
  widgets: [
    {
      id: 'test-widget',
      type: 'big-number',
      title: 'Test Widget',
      source: 'mock',
      position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 }
    }
  ]
};

export const testQuery = {
  id: 'test-query',
  name: 'Test Query',
  sql: 'SELECT COUNT(*) as value FROM test',
  widgetTypes: ['big-number']
};
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun test --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Coverage Goals

- **Phase 1:** 40% coverage
- **Phase 2:** 60% coverage
- **Phase 3:** 75% coverage
- **Phase 4:** 85% coverage
- **Phase 5:** 90% coverage

### Quality Gates

- All tests must pass before merge
- No decrease in coverage percentage
- No new console.error/console.warn in tests
- Maximum test execution time: 30 seconds for unit tests

---

## Summary

### Total Planned Test Coverage

| Category | Test Files | Test Cases | Estimated LOC |
|----------|-----------|------------|---------------|
| **Current** | 3 | ~50 | ~700 |
| **Routes (Phase 1-2)** | 11 | 64 | 1,730 |
| **Managers (Phase 3)** | 3 | 43 | 1,150 |
| **Data Sources (Phase 4)** | 3 | 17 | 650 |
| **Integration (Phase 5)** | 2 | 5 | 350 |
| **TOTAL** | **22** | **179** | **4,580** |

### Implementation Timeline

- **5 weeks** for complete test coverage
- **~900 LOC per week**
- **~36 test cases per week**

### Success Metrics

✅ All critical routes tested
✅ 90% code coverage achieved
✅ Zero flaky tests
✅ Fast test execution (< 30s for unit tests)
✅ CI/CD integration complete
✅ Mocking strategy documented
✅ Test fixtures reusable

---

**Created:** 2026-02-27
**Follows:** Elysia.js Testing Best Practices
**Test Framework:** Bun Test
**Methodology:** TDD with `.handle()` pattern
