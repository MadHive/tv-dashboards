# Coding Conventions

**Analysis Date:** 2026-03-20

## Naming Patterns

**Files:**
- Kebab-case for file names: `config-manager.js`, `data-source-registry.js`, `query-routes.js`
- Test files: `.test.js` suffix (e.g., `query-routes.test.js`)
- Index files: `index.js` in directories that export multiple modules
- Model files: `.model.js` suffix (e.g., `dashboard.model.js`)
- Helper/utility files in tests: `-helpers.js` suffix (e.g., `test-app.js`, `browser-helpers.js`)

**Functions:**
- camelCase for function and method names: `loadConfig()`, `saveQuery()`, `validateDashboard()`
- Exported functions: `export function validateConfig()`
- Private functions: No prefix convention; rely on lack of export
- Async functions: Use `async` keyword, no suffix convention
- Generator/factory functions: `create` prefix (e.g., `createTestApp()`, `createMockDataSource()`)

**Variables:**
- camelCase for all variables: `cachedConfig`, `rotationMs`, `monitoringClients`
- Constants: UPPER_SNAKE_CASE for module-level constants (e.g., `MAX_BACKUPS`, `QUERIES_PATH`, `LOG_LEVEL`)
- Private class members: No underscore prefix; rely on class scope
- Collection variables: Plural names (e.g., `dashboards`, `widgets`, `queries`)

**Types/Classes:**
- PascalCase for class names: `DashboardManager`, `DataSourceRegistry`, `AdminAPI`
- TypeBox models via `t.*`: Named with `Models` suffix (e.g., `commonModels`, `dashboardModels`)
- Enum-like objects: camelCase keys (e.g., `VALID_WIDGET_TYPES`, `VALID_DATA_SOURCES`)

## Code Style

**Formatting:**
- No linter configured (see `package.json` line 10: `"lint": "echo 'No linter configured..."`)
- No TypeScript (vanilla JavaScript project)
- ES Modules throughout (`import`/`export`)
- 2-space indentation (inferred from `.prettierrc` convention and js-yaml config)
- No automatic formatting enforcement

**Linting:**
- Not configured; rely on manual code review
- ESLint/Prettier: disabled/not used

**JSDoc/TypeDoc Comments:**
- Used extensively in test helpers and public APIs
- Format:
  ```javascript
  /**
   * Brief description
   * @param {Type} paramName - Description
   * @returns {Type} Description
   */
  export function myFunction(paramName) {}
  ```
- Examples from codebase: `test-app.js` (lines 10-17), `admin-api.js` (lines 10-43)
- Not required for internal implementation details, focus on exported functions

## Import Organization

**Order:**
1. Standard library imports (`fs`, `path`, `crypto`)
2. Third-party package imports (`elysia`, `js-yaml`, `pino`)
3. Local module imports (relative paths, starting with `./`)
4. Named imports then default imports within each group

**Example from `server/index.js` (lines 5-50):**
```javascript
import { Elysia, t } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import { staticPlugin } from '@elysiajs/static';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import logger from './logger.js';
import { fileURLToPath } from 'url';
import { getMetrics as mockGetMetrics } from './mock-data.js';
import { proxyRoutes } from './api-proxy.js';
```

**Path Aliases:**
- Not used; all imports use relative paths
- URLs are relative (`./config-manager.js`, `./data-sources/gcp.js`)

## Error Handling

**Pattern:**
- Try-catch used selectively for critical operations (file I/O, database, external APIs)
- Error messages include context: `throw new Error('Failed to load config: ' + message)`
- Errors logged with structured logging (pino) rather than thrown directly to client
- Examples from `config-manager.js`:
  ```javascript
  export function loadConfig() {
    try {
      const raw = readFileSync(CONFIG_PATH, 'utf8');
      const config = load(raw);
      return config;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to load config');
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }
  ```

**API Error Response Pattern:**
- All API routes return `{ success: true/false, ... }` envelope
- Field `error` contains human-readable error message
- Status codes: 400 (validation), 404 (not found), 500 (server error)
- Example from `query-routes.test.js` (lines 92-102):
  ```javascript
  it('should return 404 for non-existent query', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/queries/bigquery/does-not-exist')
    );
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Query not found');
  });
  ```

## Logging

**Framework:** Pino (structured JSON logger)

**Configuration:** `server/logger.js` exports:
- Default logger instance (singleton)
- Helper factories: `createLogger()`, `createDataSourceLogger()`, `createWidgetLogger()`, `createDashboardLogger()`, `createRequestLogger()`

**Patterns:**
- Development: Pretty-printed output with `pino-pretty` plugin
- Production: Raw JSON output
- Log level: Controlled by `LOG_LEVEL` environment variable (default: `'info'`)
- Service identifier: `service: 'tv-dashboards'` in all logs

**Usage:**
```javascript
import logger from './logger.js';

// Simple message with context
logger.info({ dashboardId }, 'Dashboard updated');

// Error with exception
logger.error({ error: err.message }, 'Failed to load config');

// Query-specific logging
logQueryExecution({ source: 'gcp', queryId: 'my-query', duration: 45, success: true });
```

**Never use:** `console.log()`, `console.error()` (use logger instead)

## Comments

**When to Comment:**
- Explain WHY, not WHAT (code structure is self-explanatory)
- Complex algorithms or non-obvious business logic
- Browser compatibility or platform-specific hacks
- Example from `public/js/app.js` (lines 78-79):
  ```javascript
  // Note: removed "click anywhere to pause" — it caused the pause button to
  // immediately un-pause when clicking elsewhere on the dashboard.
  ```

**Section Headers:**
- Horizontal dividers for major sections (e.g., `// ---- bootstrap ----`)
- Used in `public/js/app.js`, `server/index.js` for clarity
- Format: `// ==== Section Name ====` (20+ dashes for emphasis)

## Function Design

**Size:**
- Keep functions under 50 lines when possible
- Async functions may exceed for sequential file/API operations
- Examples:
  - `loadConfig()` in `config-manager.js` (12 lines) — load and validate
  - `getData()` in `server/index.js` (18 lines) — conditional fallback logic
  - `init()` in `DashboardApp` (40 lines) — complex bootstrap with multiple steps

**Parameters:**
- Maximum 3 positional parameters; use object destructuring for optional args
- Example from `query-manager.js` (line 42):
  ```javascript
  export async function saveQueries(queries) {
    // Single param
  }
  ```
- Example from `logger.js` (line 113):
  ```javascript
  export function logQueryExecution({ source, queryId, duration, success, error = null }) {
    // Destructured object with defaults
  }
  ```

**Return Values:**
- Always return success indicator for public API functions: `{ success: true, data: ... }`
- Throw errors for exceptional cases (file not found, validation failed)
- Async functions return Promises
- Array queries return empty array `[]` on no matches (fallback), never null

## Module Design

**Exports:**
- Named exports for utilities: `export function loadConfig()`
- Named exports for constants: `export const ENV_MAP = {...}`
- Default export for classes: `export default class DashboardManager {}`
- Mixed in route files: `export const queryRoutes = new Elysia(...)`

**Barrel Files:**
- Used in `server/models/index.js` to compose sub-models
- Pattern:
  ```javascript
  export const models = new Elysia({ name: 'models' })
    .use(commonModels)
    .use(dashboardModels)
    .use(queryModels)
  ```

**Module Scope:**
- File-level state allowed for caching (e.g., `cachedConfig` in `server/index.js`)
- Invalidation functions provided when state is mutable (e.g., `invalidateConfigCache()`)
- Database connections initialized once on startup (`initDatabase()` in `server/db.js`)

## TypeBox Schemas

**Pattern:**
- Import `t` from `elysia`
- Define reusable schemas in `server/models/` files
- Compose schemas in route definitions using `.model()`
- Use `t.Nullable()` for fields that accept null (not just `t.Optional()`)
- Example schema structure:
  ```javascript
  export const commonModels = (app) =>
    app.model({
      successResponse: t.Object({
        success: t.Boolean(),
        // ... fields
      })
    });
  ```

---

*Convention analysis: 2026-03-20*
