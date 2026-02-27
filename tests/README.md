# Test Suite Documentation

This directory contains the comprehensive test suite for the TV Dashboards application, following Elysia.js testing best practices.

## Quick Start

```bash
# Run all tests
bun test

# Run only unit tests
bun test:unit

# Run tests in watch mode
bun test:watch

# Run with coverage report
bun test:coverage
```

## Test Structure

```
tests/
├── unit/              # Unit tests (fast, isolated)
├── integration/       # Integration tests (component interaction)
├── e2e/              # End-to-end tests (full workflows)
├── helpers/          # Test utilities and helpers
└── fixtures/         # Test data and mock responses
```

## Writing Tests

### Basic Test Pattern (Elysia.js)

```javascript
import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { createTestRequest } from '../helpers/test-app.js';

describe('My Route', () => {
  let app;

  beforeEach(() => {
    // Create fresh Elysia instance per test
    app = new Elysia()
      .get('/api/example', () => ({ message: 'Hello' }));
  });

  it('should return hello message', async () => {
    const request = createTestRequest('/api/example');
    const response = await app.handle(request);

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Hello');
  });
});
```

### Testing POST Requests

```javascript
import { createJsonPostRequest } from '../helpers/test-app.js';

it('should create resource', async () => {
  const payload = { name: 'Test Resource' };
  const request = createJsonPostRequest('/api/resources', payload);
  const response = await app.handle(request);

  expect(response.status).toBe(200);

  const data = await response.json();
  expect(data.success).toBe(true);
});
```

### Testing with Mocks

```javascript
import { mockGCPMonitoring, mockBigQuery } from '../helpers/mocks.js';

it('should fetch metrics from GCP', async () => {
  const mockClient = mockGCPMonitoring({
    listTimeSeries: async () => ({
      timeSeries: [{ points: [{ value: { doubleValue: 100 } }] }]
    })
  });

  // Use mock in your test
  // ...
});
```

### Using Test Fixtures

```javascript
import { testDashboard, testConfig } from '../helpers/fixtures.js';

it('should validate dashboard structure', () => {
  expect(testDashboard.id).toBeDefined();
  expect(testDashboard.widgets).toBeArray();
});
```

## Test Helpers

### `test-app.js`

Provides utilities for creating test Elysia instances and requests:

- `createTestApp(options)` - Create isolated Elysia instance
- `createTestRequest(url, options)` - Create test Request
- `createJsonPostRequest(url, body)` - Create JSON POST request
- `createJsonPutRequest(url, body)` - Create JSON PUT request
- `createDeleteRequest(url)` - Create DELETE request
- `assertResponse` - Response assertion helpers

### `mocks.js`

Mock factories for external services:

- `mockGCPMonitoring()` - Mock Cloud Monitoring client
- `mockBigQuery()` - Mock BigQuery client
- `mockFileSystem()` - Mock fs operations (in-memory)
- `mockOAuthClient()` - Mock Google OAuth client
- `createMockDataSource()` - Mock data source plugin
- `mockDataSourceRegistry()` - Mock registry

### `fixtures.js`

Reusable test data:

- `testDashboard` - Sample dashboard configuration
- `testBigQueryQuery` - Sample BigQuery query
- `testGCPQuery` - Sample GCP query
- `testConfig` - Sample full configuration
- `testTemplate` - Sample template
- Factory functions for dynamic test data

## Best Practices

### 1. Test Isolation

Always create fresh Elysia instances in `beforeEach`:

```javascript
beforeEach(() => {
  app = new Elysia().use(myRoutes);
});
```

### 2. Use .handle() for Unit Tests

Test routes without network overhead:

```javascript
const response = await app.handle(new Request('http://localhost/api/test'));
```

### 3. Mock External Dependencies

Don't hit real APIs in unit tests:

```javascript
const mockGCP = mockGCPMonitoring();
// Use mock in route handlers
```

### 4. Clean Up After Tests

Use `afterEach` to clean up test artifacts:

```javascript
afterEach(() => {
  // Delete test files
  // Clear test data
});
```

### 5. Test Both Success and Failure Cases

```javascript
it('should succeed with valid input', async () => { /* ... */ });
it('should fail with invalid input', async () => { /* ... */ });
it('should return 404 for missing resource', async () => { /* ... */ });
```

### 6. Use Descriptive Test Names

```javascript
// Good
it('should return 400 when dashboard ID is missing')

// Bad
it('should fail')
```

## Running Specific Tests

```bash
# Run specific test file
bun test tests/unit/routes/config-routes.test.js

# Run tests matching pattern
bun test --grep "Config Routes"

# Run tests in specific directory
bun test tests/unit/routes/
```

## Coverage Reports

Generate coverage report:

```bash
bun test --coverage
```

Coverage goals:
- Phase 1: 40%
- Phase 2: 60%
- Phase 3: 75%
- Phase 4: 85%
- Phase 5: 90%

## Debugging Tests

```bash
# Run with verbose output
bun test --verbose

# Run single test file
bun test tests/unit/routes/config-routes.test.js

# Use console.log in tests
it('should work', async () => {
  console.log('Debug info:', someVariable);
  // ...
});
```

## CI/CD Integration

Tests run automatically in GitHub Actions on:
- Push to any branch
- Pull request creation
- Pull request updates

See `.github/workflows/ci.yml` for configuration.

## Common Patterns

### Testing Error Handling

```javascript
it('should return 400 for invalid input', async () => {
  const request = createJsonPostRequest('/api/resource', { invalid: 'data' });
  const response = await app.handle(request);

  expect(response.status).toBe(400);

  const data = await response.json();
  expect(data.success).toBe(false);
  expect(data.error).toBeDefined();
});
```

### Testing Authentication

```javascript
it('should require authentication', async () => {
  const request = createTestRequest('/api/protected');
  const response = await app.handle(request);

  expect(response.status).toBe(401);
});

it('should allow authenticated requests', async () => {
  const request = createTestRequest('/api/protected', {
    headers: {
      'Cookie': 'session=valid-token'
    }
  });
  const response = await app.handle(request);

  expect(response.status).toBe(200);
});
```

### Testing File Operations

```javascript
import { mockFileSystem } from '../helpers/mocks.js';

it('should save configuration to file', async () => {
  const fs = mockFileSystem();

  // Test file operations
  fs.writeFileSync('/path/to/config.yaml', 'content');

  expect(fs.files.has('/path/to/config.yaml')).toBe(true);
});
```

## Test Data Management

### Use Factories for Dynamic Data

```javascript
import { createTestDashboard, createTestQuery } from '../helpers/fixtures.js';

it('should handle unique IDs', async () => {
  const dashboard1 = createTestDashboard();
  const dashboard2 = createTestDashboard();

  expect(dashboard1.id).not.toBe(dashboard2.id);
});
```

### Clean Up Test Data

```javascript
afterEach(() => {
  // Delete queries created in tests
  const testQueries = listQueries('bigquery')
    .filter(q => q.id.startsWith('test-'));

  testQueries.forEach(q => deleteQuery('bigquery', q.id));
});
```

## Contributing

When adding new tests:

1. Follow existing patterns
2. Use test helpers and fixtures
3. Add tests for both success and failure cases
4. Clean up test artifacts
5. Update this README if adding new helpers

## References

- [Elysia.js Testing Guide](https://elysiajs.com/testing)
- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Test Plan](../docs/TEST_PLAN.md)
