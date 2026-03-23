# Testing Patterns

**Analysis Date:** 2026-03-20

## Test Framework

**Runner:**
- Bun's built-in test runner
- Config: No separate config file — uses Bun defaults
- Import: `import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test'`

**Assertion Library:**
- Bun's built-in expect API
- Custom matchers: `toBeArray()`, `toBeObject()`

**Run Commands:**
```bash
bun test                              # Run all tests
bun test tests/unit                   # Run unit tests only
bun test tests/integration            # Run integration tests only
bun test tests/e2e                    # Run e2e tests only
bun test --watch                      # Watch mode
bun test --coverage                   # Coverage report
bun test:unit                         # From package.json
bun test:coverage                     # With full suite
```

**Coverage Goals (from tests/README.md):**
- Phase 1: 40%
- Phase 2: 60%
- Phase 3: 75%
- Phase 4: 85%
- Phase 5: 90%

## Test File Organization

**Location Pattern:**
- Unit tests: `tests/unit/` (co-located by module)
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/`
- Helpers: `tests/helpers/`
- Fixtures: `tests/fixtures/`

**Naming:**
- `*.test.js` suffix (e.g., `query-routes.test.js`, `dashboard-manager.test.js`)
- Helper files: No suffix, descriptive names (e.g., `test-app.js`, `mocks.js`)
- Fixture files: `fixtures.js`

**Current Test Coverage:**
```
tests/
├── unit/                           # Fast, isolated tests
│   ├── (specific test files here)
├── integration/                    # Component interaction tests
│   ├── multi-source-dashboard.test.js
│   ├── rate-limiting.test.js
│   ├── openapi-spec.test.js
├── e2e/                            # Full workflow tests
│   ├── dashboard-lifecycle.test.js
│   ├── editor-workflow.test.js
│   ├── query-management.test.js
│   ├── authentication-flow.test.js
├── helpers/                        # Test utilities
│   ├── test-app.js                 # Elysia instance factory
│   ├── mocks.js                    # Mock service factories
│   ├── fixtures.js                 # Reusable test data
│   ├── browser-helpers.js          # Puppeteer/browser utilities
│   ├── performance-helpers.js      # Perf measurement
│   └── dom-helpers.js              # DOM manipulation for tests
├── fixtures/                       # Test data files
│   └── (YAML configs, sample data)
└── README.md                       # This documentation
```

## Test Structure

**Suite Organization Pattern:**
```javascript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { queryRoutes } from '../server/query-routes.js';

describe('Query Routes (Elysia Unit Tests)', () => {
  let app;

  beforeEach(() => {
    // Create fresh Elysia instance per test
    app = new Elysia().use(queryRoutes);
  });

  describe('GET /api/queries/', () => {
    it('should return all queries grouped by source', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/queries/')
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.queries).toBeObject();
    });
  });
});
```

**Setup Pattern:**
- `beforeEach()`: Create fresh Elysia instances or test data per test (isolation)
- `beforeAll()`: Global setup (expensive operations like database init)
- Initialize databases, mock registries, or fixtures

**Teardown Pattern:**
- `afterEach()`: Cleanup test artifacts (delete created queries, restore config files)
- Example from `query-routes.test.js` (lines 133-134):
  ```javascript
  // Clean up
  await deleteQuery('bigquery', 'test-api-create');
  ```
- Example from `dashboard-manager.test.js` (lines 16-19):
  ```javascript
  afterEach(async () => {
    // Restore original config
    await writeFile('./config/dashboards.yaml', originalConfig);
  });
  ```

**Assertion Pattern:**
- Status code assertions first: `expect(response.status).toBe(200)`
- Then data shape: `expect(data.success).toBe(true)`
- Then field values: `expect(data.query.id).toBe('test-id')`

## Mocking

**Framework:** Custom mock factories in `tests/helpers/mocks.js`

**Pattern for Creating Mocks:**
```javascript
export function mockGCPMonitoring(customResponses = {}) {
  const defaultTimeSeries = { /* default data */ };

  return {
    projectPath: (project) => `projects/${project}`,
    listTimeSeries: async (request) => {
      if (customResponses.listTimeSeries) {
        return customResponses.listTimeSeries(request);
      }
      return [defaultTimeSeries];
    }
  };
}
```

**Available Mocks:**
- `mockGCPMonitoring(customResponses)` — Cloud Monitoring API client
- `mockBigQuery(customResponses)` — BigQuery client with `.query()` and `.dataset()`
- `mockFileSystem()` — In-memory file system with Map-backed storage
- `mockOAuthClient(customResponses)` — Google OAuth client
- `createMockDataSource(name, config)` — Generic data source plugin
- `mockDataSourceRegistry(sources)` — Registry with multiple sources

**Usage Example:**
```javascript
import { mockGCPMonitoring } from '../helpers/mocks.js';

it('should fetch metrics from GCP', async () => {
  const mockClient = mockGCPMonitoring({
    listTimeSeries: async () => ({
      timeSeries: [{ points: [{ value: { doubleValue: 100 } }] }]
    })
  });
  // Use mock in route handlers...
});
```

**What to Mock:**
- External API clients (GCP, BigQuery, Datadog)
- File system operations (for config file tests)
- Data source registry (for multi-source tests)
- OAuth providers

**What NOT to Mock:**
- Core application logic (DashboardManager, QueryManager)
- Elysia route handlers (test via `.handle()` instead)
- TypeBox schema validation
- Logger (or use no-op mock if side-effect matters)

## Fixtures and Factories

**Test Data Pattern:**
```javascript
// Static fixtures
export const testDashboard = {
  id: 'test-dashboard',
  name: 'Test Dashboard',
  widgets: [
    {
      id: 'test-widget-1',
      type: 'big-number',
      title: 'Test Widget 1',
      source: 'mock',
      position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 }
    }
  ]
};

// Factory for dynamic data
export function createTestDashboard(overrides = {}) {
  return {
    ...testDashboard,
    ...overrides,
    id: overrides.id || `test-dashboard-${Date.now()}`  // unique IDs
  };
}
```

**Location:**
- `tests/helpers/fixtures.js` — Main fixture file
- Organized by type: `testDashboard`, `testBigQueryQuery`, `testGCPQuery`, `testConfig`, `testTemplate`, `testWidgetData`

**Factories in Fixtures:**
```javascript
// From fixtures.js (lines 312-320)
export function createTestDashboard(overrides = {}) {
  const dashboard = { ...testDashboard, ...overrides };
  if (overrides.id && !dashboard.id.includes('-')) {
    dashboard.id = overrides.name.toLowerCase().replace(/\s+/g, '-');
  }
  return dashboard;
}
```

## Coverage

**Requirements:** No hard requirement enforced; goals are aspirational (see phases above)

**View Coverage:**
```bash
bun test --coverage
```

**Coverage Output:** Generates report in coverage/ directory

## Test Types

**Unit Tests:**
- Scope: Single function or method in isolation
- File location: `tests/unit/`
- Mock external dependencies
- Example: Testing `validateConfig()` from `config-validator.js`
- Use `.handle()` for Elysia routes

**Integration Tests:**
- Scope: Multiple modules working together
- File location: `tests/integration/`
- Example from `multi-source-dashboard.test.js`:
  - Setup multiple mock data sources
  - Test dashboard fetching data from all sources simultaneously
  - Verify error isolation per source
- Can use real file system or databases (with cleanup)

**E2E Tests:**
- Scope: Full workflows from client UI through API to data source
- File location: `tests/e2e/`
- Framework: Puppeteer/browser automation (in `browser-helpers.js`)
- Example files: `dashboard-lifecycle.test.js`, `editor-workflow.test.js`

## Common Patterns

**Async Testing:**
```javascript
it('should create dashboard', async () => {
  const queryData = { id: 'test', name: 'Test' };

  const response = await app.handle(
    new Request('http://localhost/api/queries/bigquery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryData)
    })
  );

  const data = await response.json();
  expect(data.success).toBe(true);
});
```

**Error Testing:**
```javascript
it('should return 404 for non-existent dashboard', async () => {
  const response = await app.handle(
    new Request('http://localhost/api/dashboards/nonexistent')
  );

  expect(response.status).toBe(404);
  const data = await response.json();
  expect(data.success).toBe(false);
  expect(data.error).toContain('Dashboard not found');
});
```

**State Cleanup:**
```javascript
afterEach(async () => {
  // Delete test queries
  const testQueries = listQueries('bigquery')
    .filter(q => q.id.startsWith('test-'));

  for (const q of testQueries) {
    await deleteQuery('bigquery', q.id);
  }
});
```

## Test Helpers API

**`tests/helpers/test-app.js`:**
```javascript
createTestApp(options)           // Create fresh Elysia instance
  - options.withCors             // Enable CORS plugin
  - options.withCookie           // Enable cookie plugin

createTestRequest(url, options)  // Create Request object for .handle()
createJsonPostRequest(url, body) // POST with JSON body
createJsonPutRequest(url, body)  // PUT with JSON body
createDeleteRequest(url)         // DELETE request

assertResponse.assertJson(response, expectedStatus)
assertResponse.assertError(response, expectedStatus)
assertResponse.assertSuccess(response)
```

**`tests/helpers/mocks.js`:**
```javascript
mockGCPMonitoring(customResponses)
mockBigQuery(customResponses)
mockFileSystem()
mockOAuthClient(customResponses)
createMockDataSource(name, config)
mockDataSourceRegistry(sources)
```

**`tests/helpers/fixtures.js`:**
```javascript
testDashboard                    // Static sample dashboard
testBigQueryQuery                // Static BigQuery query
testGCPQuery                      // Static GCP query
testConfig                        // Complete config with dashboards
testTemplate                      // Sample template
testWidgetData                    // Widget data responses

createTestDashboard(overrides)   // Factory with unique ID
createTestQuery(overrides)        // (if defined)
```

## Running Specific Tests

```bash
# Single test file
bun test tests/unit/routes/config-routes.test.js

# By directory
bun test tests/unit/routes/

# By pattern (grep)
bun test --grep "Config Routes"

# Watch mode with pattern
bun test --watch --grep "Dashboard"
```

## Best Practices Summary

1. **Test Isolation:** Create fresh Elysia instances in `beforeEach` — prevents state bleeding
2. **Use .handle() for Units:** Test routes without network overhead
3. **Mock External Services:** Don't hit real APIs during tests
4. **Cleanup After Tests:** Delete test artifacts in `afterEach`
5. **Test Both Paths:** Success AND failure cases for each endpoint
6. **Descriptive Names:** Use full phrases like "should return 400 when dashboard ID is missing"
7. **Restore State:** Save/restore config files that tests modify (use `beforeEach`/`afterEach`)
8. **Factory Functions:** Use factories in fixtures for unique test data

## CI/CD Integration

**Runs automatically on:**
- Push to any branch
- Pull request creation
- Pull request updates

**Configuration:** `.github/workflows/ci.yml` (must check for test workflow)

---

*Testing analysis: 2026-03-20*
