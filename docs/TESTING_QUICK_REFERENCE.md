# Testing Quick Reference

## Commands

```bash
# Run all tests
bun test

# Run unit tests only
bun test:unit

# Run integration tests
bun test:integration

# Run E2E tests
bun test:e2e

# Watch mode
bun test:watch

# Coverage report
bun test:coverage

# Run specific file
bun test tests/unit/routes/config-routes.test.js

# Run tests matching pattern
bun test --grep "Config Routes"
```

## Test Template

```javascript
import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { createTestRequest } from '../../helpers/test-app.js';

describe('Feature Name', () => {
  let app;

  beforeEach(() => {
    app = new Elysia()
      .get('/api/endpoint', () => ({ data: 'value' }));
  });

  it('should do something', async () => {
    const request = createTestRequest('/api/endpoint');
    const response = await app.handle(request);

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ data: 'value' });
  });
});
```

## Common Assertions

```javascript
// Status codes
expect(response.status).toBe(200);
expect(response.status).toBe(404);
expect(response.status).toBeGreaterThanOrEqual(400);

// JSON response
const data = await response.json();
expect(data).toBeObject();
expect(data).toBeArray();
expect(data.success).toBe(true);
expect(data.error).toBeDefined();
expect(data.items).toHaveLength(5);

// Strings
expect(data.message).toContain('success');
expect(data.error).toBeTruthy();

// Arrays
expect(data.dashboards).toBeArray();
expect(data.dashboards.length).toBeGreaterThan(0);

// Objects
expect(data).toBeObject();
expect(data.id).toBeDefined();
expect(data).toHaveProperty('name');
```

## Request Helpers

```javascript
import {
  createTestRequest,
  createJsonPostRequest,
  createJsonPutRequest,
  createDeleteRequest
} from '../helpers/test-app.js';

// GET request
const request = createTestRequest('/api/config');

// POST request with JSON
const request = createJsonPostRequest('/api/dashboards', {
  id: 'test',
  name: 'Test Dashboard'
});

// PUT request with JSON
const request = createJsonPutRequest('/api/dashboards/test', {
  name: 'Updated Name'
});

// DELETE request
const request = createDeleteRequest('/api/dashboards/test');
```

## Mock Factories

```javascript
import {
  mockGCPMonitoring,
  mockBigQuery,
  mockFileSystem,
  createMockDataSource
} from '../helpers/mocks.js';

// Mock GCP
const gcpClient = mockGCPMonitoring({
  listTimeSeries: async () => ({
    timeSeries: [{ points: [{ value: { doubleValue: 100 } }] }]
  })
});

// Mock BigQuery
const bqClient = mockBigQuery({
  query: async () => [[{ value: 100 }]]
});

// Mock File System
const fs = mockFileSystem();
fs.writeFileSync('/path/file.txt', 'content');
expect(fs.files.has('/path/file.txt')).toBe(true);

// Mock Data Source
const dataSource = createMockDataSource('test-source', {
  fetchMetrics: async () => ({ value: 123 })
});
```

## Test Fixtures

```javascript
import {
  testDashboard,
  testBigQueryQuery,
  testGCPQuery,
  testConfig,
  createTestDashboard,
  createTestQuery,
  createTestWidget
} from '../helpers/fixtures.js';

// Use static fixtures
const dashboard = testDashboard;

// Or create dynamic ones
const uniqueDashboard = createTestDashboard({ name: 'Custom Name' });
const uniqueQuery = createTestQuery('bigquery', { sql: 'SELECT 1' });
```

## Lifecycle Hooks

```javascript
describe('Test Suite', () => {
  beforeEach(() => {
    // Runs before each test
    // Create fresh app instance
  });

  afterEach(() => {
    // Runs after each test
    // Clean up test data
  });

  beforeAll(() => {
    // Runs once before all tests
    // Set up test environment
  });

  afterAll(() => {
    // Runs once after all tests
    // Tear down test environment
  });
});
```

## Testing Error Cases

```javascript
// Test 400 Bad Request
it('should return 400 for invalid input', async () => {
  const request = createJsonPostRequest('/api/resource', { invalid: 'data' });
  const response = await app.handle(request);

  expect(response.status).toBe(400);

  const data = await response.json();
  expect(data.success).toBe(false);
  expect(data.error).toBeDefined();
});

// Test 404 Not Found
it('should return 404 for missing resource', async () => {
  const request = createTestRequest('/api/dashboards/nonexistent');
  const response = await app.handle(request);

  expect(response.status).toBe(404);
});

// Test validation errors
it('should validate required fields', async () => {
  const request = createJsonPostRequest('/api/dashboards', {
    // Missing required fields
  });
  const response = await app.handle(request);

  expect(response.status).toBe(400);

  const data = await response.json();
  expect(data.error).toContain('required');
});
```

## Testing Async Operations

```javascript
it('should handle async operations', async () => {
  const request = createTestRequest('/api/async-endpoint');
  const response = await app.handle(request);

  expect(response.status).toBe(200);

  const data = await response.json();
  expect(data.completed).toBe(true);
});
```

## Testing with Real File Operations (Integration Tests)

```javascript
import { existsSync, unlinkSync, readFileSync } from 'fs';

afterEach(() => {
  // Clean up test files
  if (existsSync('/path/to/test-file.yaml')) {
    unlinkSync('/path/to/test-file.yaml');
  }
});

it('should create file', async () => {
  // Perform operation that creates file
  // ...

  expect(existsSync('/path/to/test-file.yaml')).toBe(true);
});
```

## Debugging Tips

```javascript
// Log request details
it('should work', async () => {
  const request = createTestRequest('/api/test');
  console.log('Request URL:', request.url);

  const response = await app.handle(request);
  console.log('Response status:', response.status);

  const data = await response.json();
  console.log('Response data:', data);

  expect(response.status).toBe(200);
});

// Test isolation check
it('should be isolated', async () => {
  // Each test gets fresh app instance
  expect(app).toBeDefined();
});
```

## Common Patterns

### Test CRUD Operations

```javascript
describe('Dashboard CRUD', () => {
  it('should create dashboard', async () => { /* ... */ });
  it('should read dashboard', async () => { /* ... */ });
  it('should update dashboard', async () => { /* ... */ });
  it('should delete dashboard', async () => { /* ... */ });
  it('should list dashboards', async () => { /* ... */ });
});
```

### Test Validation

```javascript
describe('Validation', () => {
  it('should accept valid data', async () => { /* ... */ });
  it('should reject missing required fields', async () => { /* ... */ });
  it('should reject invalid types', async () => { /* ... */ });
  it('should reject out-of-range values', async () => { /* ... */ });
});
```

### Test Edge Cases

```javascript
describe('Edge Cases', () => {
  it('should handle empty arrays', async () => { /* ... */ });
  it('should handle null values', async () => { /* ... */ });
  it('should handle very long strings', async () => { /* ... */ });
  it('should handle special characters', async () => { /* ... */ });
});
```

## File Organization

```
tests/
├── unit/
│   ├── routes/          # Route handler tests
│   ├── managers/        # Business logic tests
│   └── data-sources/    # Data source tests
├── integration/         # Multi-component tests
├── e2e/                # End-to-end tests
├── helpers/
│   ├── test-app.js     # Test utilities
│   ├── mocks.js        # Mock factories
│   └── fixtures.js     # Test data
└── README.md           # Documentation
```

## Coverage Goals

| Phase | Coverage | Target Date |
|-------|----------|-------------|
| Phase 1 | 40% | Week 1 |
| Phase 2 | 60% | Week 2 |
| Phase 3 | 75% | Week 3 |
| Phase 4 | 85% | Week 4 |
| Phase 5 | 90% | Week 5 |

## Resources

- [Full Test Plan](./TEST_PLAN.md)
- [Test README](../tests/README.md)
- [Elysia.js Docs](https://elysiajs.com/testing)
- [Bun Test Docs](https://bun.sh/docs/cli/test)
