# OpenAPI and Drizzle ORM Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full Swagger UI documentation and migrate the two existing SQLite tables to Drizzle ORM with type-safe integration.

**Architecture:** Drizzle wraps the existing `bun:sqlite` Database instance (from `server/db.js`) so both systems share one connection — no migration needed, tables already exist. Swagger is added as an Elysia plugin at the top of `server/index.js`. The existing `data-source-config.js` functions are rewritten to use Drizzle queries while preserving identical API surfaces.

**Tech Stack:** `drizzle-orm` + `drizzle-kit` (ORM + CLI), `@elysiajs/swagger` (Swagger UI), `drizzle-typebox` (TypeBox schema generation from Drizzle tables), Bun test runner, Elysia v1.2, bun:sqlite.

---

## Key Files Reference

- Main server: `server/index.js` (add Swagger plugin here)
- Old DB module: `server/db.js` (keep — still called by server/index.js for initDatabase)
- Data access: `server/data-source-config.js` (migrate all 5 exported functions to Drizzle)
- New schema: `server/db/schema.js` (create)
- New Drizzle instance: `server/db/index.js` (create — wraps db.js's Database)
- Drizzle Kit config: `drizzle.config.js` (create at root)
- New tests: `tests/unit/db-drizzle.test.js` (create)
- Existing tests that must keep passing: `tests/unit/data-source-config.test.js`, `tests/unit/db.test.js`

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install production dependencies**

```bash
cd /home/tech/dev-dashboards
bun add drizzle-orm@^0.38.0 @elysiajs/swagger@^1.1.0 drizzle-typebox@^0.1.1
```

Expected: Packages added to `dependencies` in package.json, no errors.

**Step 2: Install dev dependencies**

```bash
bun add -d drizzle-kit@^0.30.0
```

Expected: `drizzle-kit` added to `devDependencies` in package.json.

**Step 3: Verify installation**

```bash
bun pm ls | grep -E "drizzle|swagger"
```

Expected output (approximate):
```
drizzle-kit@0.30.x
drizzle-orm@0.38.x
drizzle-typebox@0.1.x
@elysiajs/swagger@1.1.x
```

**Step 4: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore: install drizzle-orm, drizzle-kit, swagger, drizzle-typebox"
```

---

### Task 2: Create Drizzle Schema

**Files:**
- Create: `server/db/schema.js`
- Create: `tests/unit/db-drizzle.test.js`

The schema must mirror the existing tables **exactly**. Check the column types in your database first:

```bash
bun run -e "
import { Database } from 'bun:sqlite';
const db = new Database('data/tv-dashboards.db');
console.log('data_source_configs:');
console.log(db.query('PRAGMA table_info(data_source_configs)').all());
console.log('config_audit_log:');
console.log(db.query('PRAGMA table_info(config_audit_log)').all());
"
```

**Step 1: Write the failing test**

Create `tests/unit/db-drizzle.test.js`:

```javascript
// ===========================================================================
// Drizzle Schema Tests — Verify schema definitions match existing database
// ===========================================================================

import { describe, it, expect } from 'bun:test';
import { getTableColumns } from 'drizzle-orm';
import { dataSourceConfigs, configAuditLog } from '../../server/db/schema.js';

describe('Drizzle Schema Definitions', () => {
  describe('dataSourceConfigs table', () => {
    it('should have sourceName as primary key column', () => {
      const columns = getTableColumns(dataSourceConfigs);
      expect(columns.sourceName).toBeDefined();
      expect(columns.sourceName.primary).toBe(true);
    });

    it('should have enabled column with boolean mode', () => {
      const columns = getTableColumns(dataSourceConfigs);
      expect(columns.enabled).toBeDefined();
      expect(columns.enabled.mode).toBe('boolean');
    });

    it('should have configJson, updatedAt, updatedBy text columns', () => {
      const columns = getTableColumns(dataSourceConfigs);
      expect(columns.configJson).toBeDefined();
      expect(columns.updatedAt).toBeDefined();
      expect(columns.updatedBy).toBeDefined();
    });
  });

  describe('configAuditLog table', () => {
    it('should have id as primary key with autoIncrement', () => {
      const columns = getTableColumns(configAuditLog);
      expect(columns.id).toBeDefined();
      expect(columns.id.primaryKey).toBe(true);
      expect(columns.id.isAutoincrement).toBe(true);
    });

    it('should have sourceName, action, changesJson, userEmail, timestamp columns', () => {
      const columns = getTableColumns(configAuditLog);
      expect(columns.sourceName).toBeDefined();
      expect(columns.action).toBeDefined();
      expect(columns.changesJson).toBeDefined();
      expect(columns.userEmail).toBeDefined();
      expect(columns.timestamp).toBeDefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/unit/db-drizzle.test.js
```

Expected: FAIL with "Cannot find module '../../server/db/schema.js'"

**Step 3: Create the schema file**

Create `server/db/schema.js`:

```javascript
// ---------------------------------------------------------------------------
// Drizzle ORM Schema — Table definitions matching existing SQLite schema
// ---------------------------------------------------------------------------

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const dataSourceConfigs = sqliteTable('data_source_configs', {
  sourceName: text('source_name').primaryKey(),
  enabled:    integer('enabled', { mode: 'boolean' }).default(true),
  configJson: text('config_json'),
  updatedAt:  text('updated_at'),
  updatedBy:  text('updated_by'),
});

export const configAuditLog = sqliteTable('config_audit_log', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  sourceName:  text('source_name'),
  action:      text('action'),
  changesJson: text('changes_json'),
  userEmail:   text('user_email'),
  timestamp:   text('timestamp'),
}, (table) => [
  index('idx_audit_timestamp').on(table.timestamp),
  index('idx_audit_source').on(table.sourceName),
]);

export const dataSourceConfigsRelations = relations(dataSourceConfigs, ({ many }) => ({
  auditLogs: many(configAuditLog),
}));

export const configAuditLogRelations = relations(configAuditLog, ({ one }) => ({
  dataSource: one(dataSourceConfigs, {
    fields: [configAuditLog.sourceName],
    references: [dataSourceConfigs.sourceName],
  }),
}));
```

> **Note on index syntax:** Drizzle v0.36+ uses array syntax for table extra config. If your installed version uses object syntax, replace the array with:
> ```javascript
> (table) => ({
>   timestampIdx: index('idx_audit_timestamp').on(table.timestamp),
>   sourceIdx: index('idx_audit_source').on(table.sourceName),
> })
> ```
> Run `bun test tests/unit/db-drizzle.test.js` after creating the file. If you see a syntax error about the table config argument, switch to the object form.

**Step 4: Run test to verify it passes**

```bash
bun test tests/unit/db-drizzle.test.js
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add server/db/schema.js tests/unit/db-drizzle.test.js
git commit -m "feat: add Drizzle ORM schema matching existing SQLite tables"
```

---

### Task 3: Create Drizzle Instance

**Files:**
- Create: `server/db/index.js`

The Drizzle instance wraps the **existing** `bun:sqlite` Database from `server/db.js` — they share a single connection. This means `initDatabase()` must have been called before `getDrizzle()`.

**Step 1: Add tests for the Drizzle instance**

Append to `tests/unit/db-drizzle.test.js`:

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { join } from 'path';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { initDatabase, closeDatabase } from '../../server/db.js';
import { getDrizzle } from '../../server/db/index.js';
import { dataSourceConfigs } from '../../server/db/schema.js';

const TEST_DB_PATH = join(process.cwd(), 'data', 'test-drizzle-instance.db');

describe('Drizzle Instance', () => {
  beforeAll(() => {
    initDatabase(TEST_DB_PATH);
  });

  afterAll(async () => {
    closeDatabase();
    for (const ext of ['', '-shm', '-wal']) {
      const p = TEST_DB_PATH + ext;
      if (existsSync(p)) await unlink(p);
    }
  });

  it('should return a Drizzle instance', () => {
    const db = getDrizzle();
    expect(db).toBeDefined();
    expect(typeof db.select).toBe('function');
    expect(typeof db.insert).toBe('function');
    expect(typeof db.transaction).toBe('function');
  });

  it('should query the data_source_configs table', () => {
    const db = getDrizzle();
    const rows = db.select().from(dataSourceConfigs).all();
    expect(Array.isArray(rows)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/unit/db-drizzle.test.js
```

Expected: FAIL with "Cannot find module '../../server/db/index.js'"

**Step 3: Create the Drizzle instance file**

Create `server/db/index.js`:

```javascript
// ---------------------------------------------------------------------------
// Drizzle ORM Instance — Wraps the existing bun:sqlite Database connection
//
// IMPORTANT: initDatabase() from server/db.js must be called before getDrizzle().
// The server/index.js already calls initDatabase() at startup.
// ---------------------------------------------------------------------------

import { drizzle } from 'drizzle-orm/bun-sqlite';
import { getDatabase } from '../db.js';
import * as schema from './schema.js';

/**
 * Get the Drizzle ORM instance wrapping the existing database connection.
 * @returns {import('drizzle-orm/bun-sqlite').BunSQLiteDatabase} Drizzle instance
 */
export function getDrizzle() {
  return drizzle(getDatabase(), { schema });
}

// Re-export tables for convenient imports
export { dataSourceConfigs, configAuditLog } from './schema.js';
```

**Step 4: Run test to verify it passes**

```bash
bun test tests/unit/db-drizzle.test.js
```

Expected: All tests PASS.

**Step 5: Run existing db tests to confirm nothing broke**

```bash
bun test tests/unit/db.test.js
```

Expected: All tests PASS.

**Step 6: Commit**

```bash
git add server/db/index.js tests/unit/db-drizzle.test.js
git commit -m "feat: add Drizzle instance wrapping existing bun:sqlite connection"
```

---

### Task 4: Create Drizzle Kit Configuration

**Files:**
- Create: `drizzle.config.js`

This is used by the `drizzle-kit` CLI for schema introspection and future migrations.

**Step 1: Create the config file**

Create `drizzle.config.js` at the project root:

```javascript
// ---------------------------------------------------------------------------
// Drizzle Kit Configuration — CLI tooling for schema management
// ---------------------------------------------------------------------------

/** @type {import('drizzle-kit').Config} */
export default {
  schema:    './server/db/schema.js',
  out:       './migrations',
  dialect:   'sqlite',
  dbCredentials: {
    url: './data/tv-dashboards.db',
  },
  verbose: true,
  strict:  true,
};
```

**Step 2: Verify Drizzle Kit can read the schema**

```bash
bunx drizzle-kit introspect
```

Expected: Generates introspected schema in `./migrations` folder (or shows it matches). No errors.

If `introspect` creates a `migrations/` folder, inspect it:
```bash
ls -la migrations/
```

**Step 3: Commit**

```bash
git add drizzle.config.js migrations/
git commit -m "chore: add drizzle-kit config for schema tooling"
```

---

### Task 5: Add Swagger Plugin to Server

**Files:**
- Modify: `server/index.js`

**Step 1: Write a test for the Swagger endpoint**

Create `tests/unit/routes/swagger-routes.test.js`:

```javascript
// ===========================================================================
// Swagger Route Tests — Verify OpenAPI documentation is served
// ===========================================================================

import { describe, it, expect } from 'bun:test';

// We test against the live server via fetch since Swagger is a plugin-level concern
// These tests assume the server is running on tv.madhive.local

describe('Swagger / OpenAPI Endpoints', () => {
  it('GET /swagger/json should return valid OpenAPI spec', async () => {
    const response = await fetch('http://tv:3000/swagger/json');
    expect(response.status).toBe(200);

    const spec = await response.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBe('MadHive TV Dashboards API');
    expect(spec.info.version).toBe('2.0.0');
  });

  it('GET /swagger should serve Swagger UI HTML', async () => {
    const response = await fetch('http://tv:3000/swagger');
    expect(response.status).toBe(200);

    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('text/html');
  });

  it('OpenAPI spec should list key API paths', async () => {
    const response = await fetch('http://tv:3000/swagger/json');
    const spec = await response.json();

    const paths = Object.keys(spec.paths || {});
    expect(paths.some(p => p.startsWith('/api/data-sources'))).toBe(true);
    expect(paths.some(p => p.startsWith('/api/dashboards'))).toBe(true);
    expect(paths.some(p => p.startsWith('/health'))).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails (server not yet updated)**

```bash
bun test tests/unit/routes/swagger-routes.test.js 2>/dev/null || echo "Expected to fail - Swagger not yet added"
```

Expected: Tests fail or error — Swagger UI not yet available.

**Step 3: Add Swagger plugin to server/index.js**

Open `server/index.js`. Add the import near the top with other imports (around line 5):

```javascript
import { swagger } from '@elysiajs/swagger';
```

Then add `.use(swagger(...))` as the FIRST plugin after `new Elysia()` (around line 133, before `.use(cors())`):

```javascript
const app = new Elysia()
  .use(swagger({
    documentation: {
      info: {
        title:       'MadHive TV Dashboards API',
        version:     '2.0.0',
        description: 'Real-time engineering dashboard system with WYSIWYG editor. Data sources: GCP, BigQuery, VulnTrack, Mock.',
      },
      tags: [
        { name: 'health',       description: 'Health and status checks' },
        { name: 'dashboards',   description: 'Dashboard CRUD and management' },
        { name: 'data-sources', description: 'Data source configuration and health' },
        { name: 'queries',      description: 'Saved query management' },
        { name: 'templates',    description: 'Dashboard template library' },
        { name: 'themes',       description: 'Visual theme management' },
        { name: 'backups',      description: 'Configuration backup and restore' },
        { name: 'metrics',      description: 'Performance and widget metrics' },
      ],
    },
    swaggerOptions: {
      persistAuthorization: true,
    },
  }))
  .use(cors())
  // ... rest unchanged
```

> **Swagger path:** By default, `@elysiajs/swagger` serves UI at `/swagger` and JSON at `/swagger/json`. If your version uses different paths (e.g., `/swagger/index.html`), check with `curl http://tv:3000/swagger -I` after restarting the server.

**Step 4: Restart server and verify manually**

```bash
# Restart server
pkill -f "bun.*server/index.js" 2>/dev/null; bun run server/index.js &
sleep 2
curl -s http://tv:3000/swagger/json | bun -e "const d=await Bun.stdin.text(); const j=JSON.parse(d); console.log('OpenAPI version:', j.openapi); console.log('Title:', j.info?.title);"
```

Expected output:
```
OpenAPI version: 3.0.x
Title: MadHive TV Dashboards API
```

**Step 5: Run the swagger route tests**

```bash
bun test tests/unit/routes/swagger-routes.test.js
```

Expected: All 3 tests PASS.

**Step 6: Commit**

```bash
git add server/index.js tests/unit/routes/swagger-routes.test.js
git commit -m "feat: add Swagger UI at /swagger with full API documentation"
```

---

### Task 6: Migrate getConfig to Drizzle

**Files:**
- Modify: `server/data-source-config.js`

The goal: replace the raw SQL `getConfig` with a Drizzle query. The function signature and return shape must stay **identical**.

**Step 1: Run existing tests as baseline**

```bash
bun test tests/unit/data-source-config.test.js 2>&1 | tail -5
```

Expected: All tests PASS. Record the count (e.g., "20 pass").

**Step 2: Replace getConfig in data-source-config.js**

At the top of `server/data-source-config.js`, add the Drizzle import alongside the existing import:

```javascript
import { getDatabase } from './db.js';         // keep — used by other functions
import { getDrizzle, dataSourceConfigs } from './db/index.js';  // ADD
import { eq } from 'drizzle-orm';              // ADD
import logger from './logger.js';
```

Then replace the `getConfig` function (lines 134-158) with:

```javascript
export function getConfig(sourceName) {
  try {
    const db = getDrizzle();
    const row = db
      .select()
      .from(dataSourceConfigs)
      .where(eq(dataSourceConfigs.sourceName, sourceName))
      .get();

    if (!row) return null;

    return {
      enabled:   row.enabled,
      config:    row.configJson ? JSON.parse(row.configJson) : null,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  } catch (error) {
    logger.error({ error: error.message, dataSource: sourceName }, 'Failed to get configuration');
    throw error;
  }
}
```

**Step 3: Run existing tests**

```bash
bun test tests/unit/data-source-config.test.js
```

Expected: Same pass count as Step 1. Zero failures.

**Step 4: Commit**

```bash
git add server/data-source-config.js
git commit -m "refactor: migrate getConfig to Drizzle ORM"
```

---

### Task 7: Migrate updateConfig to Drizzle

**Files:**
- Modify: `server/data-source-config.js`

This function uses a transaction and UPSERT. Drizzle handles both.

**Step 1: Confirm tests still pass**

```bash
bun test tests/unit/data-source-config.test.js 2>&1 | tail -3
```

**Step 2: Replace updateConfig**

Also add `configAuditLog` to the Drizzle import at the top:

```javascript
import { getDrizzle, dataSourceConfigs, configAuditLog } from './db/index.js';
```

Replace the `updateConfig` function (lines ~176-232) with:

```javascript
export function updateConfig(sourceName, config, userEmail) {
  validateSourceName(sourceName);
  validateNoSensitiveFields(config);

  const db        = getDrizzle();
  const timestamp = new Date().toISOString();
  const configJson = JSON.stringify(config);

  try {
    db.transaction((tx) => {
      // Determine action for audit log
      const existing = tx
        .select({ sourceName: dataSourceConfigs.sourceName })
        .from(dataSourceConfigs)
        .where(eq(dataSourceConfigs.sourceName, sourceName))
        .get();
      const action = existing ? 'update' : 'create';

      // UPSERT — insert or update atomically
      tx.insert(dataSourceConfigs)
        .values({ sourceName, enabled: true, configJson, updatedAt: timestamp, updatedBy: userEmail })
        .onConflictDoUpdate({
          target: dataSourceConfigs.sourceName,
          set:    { configJson, updatedAt: timestamp, updatedBy: userEmail },
        })
        .run();

      // Audit log within transaction (non-throwing)
      try {
        tx.insert(configAuditLog)
          .values({
            sourceName,
            action,
            changesJson: JSON.stringify({ config }),
            userEmail,
            timestamp,
          })
          .run();
      } catch (auditErr) {
        logger.error({ error: auditErr.message, dataSource: sourceName, action }, 'Failed to create audit log');
        // Don't rethrow — audit failure is non-blocking
      }

      logger.info({ dataSource: sourceName, action, userEmail }, 'Configuration updated successfully');
    });
  } catch (error) {
    logger.error({ error: error.message, dataSource: sourceName }, 'Failed to update configuration');
    throw error;
  }
}
```

> **Note:** Drizzle's `db.transaction()` automatically commits on success and rolls back on any thrown error — no manual `BEGIN`/`COMMIT`/`ROLLBACK` needed.

**Step 3: Run existing tests**

```bash
bun test tests/unit/data-source-config.test.js
```

Expected: All tests PASS.

**Step 4: Commit**

```bash
git add server/data-source-config.js
git commit -m "refactor: migrate updateConfig to Drizzle ORM with transaction"
```

---

### Task 8: Migrate toggleEnabled to Drizzle

**Files:**
- Modify: `server/data-source-config.js`

**Step 1: Replace toggleEnabled**

Replace the `toggleEnabled` function (lines ~248-312) with:

```javascript
export function toggleEnabled(sourceName, enabled, userEmail) {
  validateSourceName(sourceName);

  if (typeof enabled !== 'boolean') {
    throw new Error(
      `Invalid enabled value: must be boolean (true/false), got ${typeof enabled}`
    );
  }

  const db        = getDrizzle();
  const timestamp = new Date().toISOString();
  const action    = enabled ? 'enable' : 'disable';

  try {
    db.transaction((tx) => {
      const existing = tx
        .select({ sourceName: dataSourceConfigs.sourceName })
        .from(dataSourceConfigs)
        .where(eq(dataSourceConfigs.sourceName, sourceName))
        .get();

      if (!existing) {
        throw new Error(
          `Data source "${sourceName}" does not exist. ` +
          'Create a configuration first using updateConfig()'
        );
      }

      tx.update(dataSourceConfigs)
        .set({ enabled, updatedAt: timestamp, updatedBy: userEmail })
        .where(eq(dataSourceConfigs.sourceName, sourceName))
        .run();

      // Audit log within transaction (non-throwing)
      try {
        tx.insert(configAuditLog)
          .values({
            sourceName,
            action,
            changesJson: JSON.stringify({ enabled }),
            userEmail,
            timestamp,
          })
          .run();
      } catch (auditErr) {
        logger.error({ error: auditErr.message, dataSource: sourceName, action }, 'Failed to create audit log');
      }

      logger.info({ dataSource: sourceName, enabled, userEmail }, `Data source ${action}d successfully`);
    });
  } catch (error) {
    logger.error({ error: error.message, dataSource: sourceName }, 'Failed to toggle enabled status');
    throw error;
  }
}
```

**Step 2: Run existing tests**

```bash
bun test tests/unit/data-source-config.test.js
```

Expected: All tests PASS.

**Step 3: Commit**

```bash
git add server/data-source-config.js
git commit -m "refactor: migrate toggleEnabled to Drizzle ORM with transaction"
```

---

### Task 9: Migrate getAuditLog to Drizzle

**Files:**
- Modify: `server/data-source-config.js`

**Step 1: Replace getAuditLog**

Add `desc` to the drizzle-orm import at the top:

```javascript
import { eq, desc } from 'drizzle-orm';
```

Replace the `getAuditLog` function (lines ~324-354) with:

```javascript
export function getAuditLog(sourceName, limit = DEFAULT_AUDIT_LOG_LIMIT) {
  try {
    const validatedLimit = parseInt(limit, 10);
    if (isNaN(validatedLimit) || validatedLimit <= 0) {
      throw new Error(`Invalid limit: must be a positive integer, got ${limit}`);
    }

    const db   = getDrizzle();
    const rows = db
      .select()
      .from(configAuditLog)
      .where(eq(configAuditLog.sourceName, sourceName))
      .orderBy(desc(configAuditLog.timestamp))
      .limit(validatedLimit)
      .all();

    return rows.map(row => ({
      id:         row.id,
      sourceName: row.sourceName,
      action:     row.action,
      changes:    JSON.parse(row.changesJson),
      userEmail:  row.userEmail,
      timestamp:  row.timestamp,
    }));
  } catch (error) {
    logger.error({ error: error.message, dataSource: sourceName }, 'Failed to get audit log');
    throw error;
  }
}
```

**Step 2: Run existing tests**

```bash
bun test tests/unit/data-source-config.test.js
```

Expected: All tests PASS.

**Step 3: Commit**

```bash
git add server/data-source-config.js
git commit -m "refactor: migrate getAuditLog to Drizzle ORM"
```

---

### Task 10: Migrate exportConfigs to Drizzle

**Files:**
- Modify: `server/data-source-config.js`

**Step 1: Replace exportConfigs**

Replace the `exportConfigs` function (lines ~364-392) with:

```javascript
export function exportConfigs() {
  try {
    const db   = getDrizzle();
    const rows = db.select().from(dataSourceConfigs).all();

    const configs = {};
    for (const row of rows) {
      configs[row.sourceName] = {
        enabled:   row.enabled,
        config:    row.configJson ? JSON.parse(row.configJson) : null,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
      };
    }

    logger.info({ count: Object.keys(configs).length }, 'Exported all configurations');
    return configs;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to export configurations');
    throw error;
  }
}
```

**Step 2: Remove the now-unused logAudit function and getDatabase import**

After migrating all 5 exported functions, the private `logAudit` function and `getDatabase` import are no longer needed.

Remove the `logAudit` function (lines ~95-123 in original).

Update the import at the top — remove the `getDatabase` import from `db.js` IF no other code in the file uses it:

```javascript
// Remove this line if getDatabase is no longer referenced:
// import { getDatabase } from './db.js';
```

Check carefully that `getDatabase` is not referenced anywhere else in the file before removing.

**Step 3: Run the full test suite**

```bash
bun test tests/unit/data-source-config.test.js
bun test tests/unit/db.test.js
bun test tests/unit/db-drizzle.test.js
```

Expected: All tests PASS across all three files.

**Step 4: Run broader test suite to check for regressions**

```bash
bun test tests/unit/ 2>&1 | tail -10
```

Expected: No new failures compared to before this feature branch.

**Step 5: Commit**

```bash
git add server/data-source-config.js
git commit -m "refactor: migrate exportConfigs to Drizzle ORM, remove raw SQL from data-source-config"
```

---

### Task 11: Add Swagger Tags to Key Routes

**Files:**
- Modify: `server/index.js`

Adding `detail.tags` to routes groups them in the Swagger UI by category.

**Step 1: Tag the health route**

Find `.get('/health', ...)` and add detail:

```javascript
.get('/health', () => ({
  status:    'healthy',
  timestamp: new Date().toISOString(),
  version:   '2.0.0',
  service:   'tv-dashboards',
}), {
  detail: { tags: ['health'], summary: 'Health check for Cloud Run' },
})
```

**Step 2: Tag the dashboard routes**

For each dashboard route, add `detail`. Example pattern — apply to ALL dashboard routes:

```javascript
.get('/api/dashboards', async () => { ... }, {
  detail: { tags: ['dashboards'], summary: 'List all dashboards' },
})

.get('/api/dashboards/:id', async ({ params }) => { ... }, {
  detail: { tags: ['dashboards'], summary: 'Get dashboard by ID' },
})

.post('/api/dashboards', async ({ body }) => { ... }, {
  detail: { tags: ['dashboards'], summary: 'Create new dashboard' },
})

.put('/api/dashboards/:id', async ({ params, body }) => { ... }, {
  detail: { tags: ['dashboards'], summary: 'Update dashboard' },
})

.delete('/api/dashboards/:id', async ({ params }) => { ... }, {
  detail: { tags: ['dashboards'], summary: 'Delete dashboard' },
})

.post('/api/dashboards/:id/duplicate', async ({ params }) => { ... }, {
  detail: { tags: ['dashboards'], summary: 'Duplicate dashboard' },
})

.post('/api/dashboards/reorder', async ({ body }) => { ... }, {
  detail: { tags: ['dashboards'], summary: 'Reorder dashboards' },
})

.post('/api/dashboards/export', ({ body }) => { ... }, {
  detail: { tags: ['dashboards'], summary: 'Export dashboard as JSON' },
})

.post('/api/dashboards/import', async ({ body }) => { ... }, {
  detail: { tags: ['dashboards'], summary: 'Import dashboard from JSON' },
})
```

**Step 3: Tag the data-sources routes**

Add `detail: { tags: ['data-sources'], summary: '...' }` to each data-source route. Examples:

```javascript
// GET /api/data-sources → tags: ['data-sources'], summary: 'List all data sources'
// GET /api/data-sources/:name/config → tags: ['data-sources'], summary: 'Get data source config'
// PUT /api/data-sources/:name/config → tags: ['data-sources'], summary: 'Update data source config'
// POST /api/data-sources/:name/toggle → tags: ['data-sources'], summary: 'Enable or disable data source'
// GET /api/data-sources/:name/history → tags: ['data-sources'], summary: 'Get audit log'
// GET /api/data-sources/export → tags: ['data-sources'], summary: 'Export all configs'
// POST /api/data-sources/:name/test → tags: ['data-sources'], summary: 'Test data source connection'
// GET /api/data-sources/health → tags: ['data-sources'], summary: 'Get data source health'
// GET /api/data-sources/schemas → tags: ['data-sources'], summary: 'List data source schemas'
```

**Step 4: Tag remaining route groups**

```javascript
// /api/backups/* → tags: ['backups']
// /api/templates/* → tags: ['templates']
// /api/themes/* → tags: ['themes']
// /api/metrics → tags: ['metrics']
// /api/metrics/:dashboardId → tags: ['metrics']
```

**Step 5: Restart server and verify Swagger UI**

```bash
pkill -f "bun.*server/index.js" 2>/dev/null
bun run server/index.js &
sleep 2
curl -s http://tv:3000/swagger/json | bun -e "
const d = await Bun.stdin.text();
const spec = JSON.parse(d);
const tags = new Set();
Object.values(spec.paths || {}).forEach(methods =>
  Object.values(methods).forEach(op =>
    (op.tags || []).forEach(t => tags.add(t))
  )
);
console.log('Tags found:', [...tags].sort().join(', '));
"
```

Expected output:
```
Tags found: backups, dashboards, data-sources, health, metrics, templates, themes
```

**Step 6: Run swagger tests**

```bash
bun test tests/unit/routes/swagger-routes.test.js
```

Expected: All tests PASS.

**Step 7: Commit**

```bash
git add server/index.js
git commit -m "feat: add Swagger tags to all API routes for organized documentation"
```

---

### Task 12: Final Validation and Cleanup

**Files:**
- No new files

**Step 1: Run full unit test suite**

```bash
bun test tests/unit/ 2>&1 | tail -15
```

Expected: All tests PASS. No regressions.

**Step 2: Run integration tests**

```bash
bun test tests/integration/ 2>&1 | tail -10
```

Expected: All tests PASS (or same failures as before this feature).

**Step 3: Manual validation checklist**

```bash
# 1. Swagger UI loads
curl -sI http://tv:3000/swagger | head -3
# Expected: HTTP/1.1 200 OK

# 2. OpenAPI JSON is valid
curl -s http://tv:3000/swagger/json | bun -e "
const d=await Bun.stdin.text();
try { JSON.parse(d); console.log('Valid JSON ✓'); } catch(e) { console.log('INVALID JSON ✗'); }
"

# 3. Data source config endpoint works
curl -s http://tv:3000/api/data-sources/gcp/config | bun -e "const d=await Bun.stdin.text(); console.log(JSON.parse(d));"
# Expected: { success: true, enabled: ..., config: ... } or { success: false, error: '...' }

# 4. Audit log endpoint works
curl -s http://tv:3000/api/data-sources/gcp/history | bun -e "const d=await Bun.stdin.text(); const j=JSON.parse(d); console.log('success:', j.success, '| history items:', j.history?.length);"

# 5. Export endpoint works
curl -s http://tv:3000/api/data-sources/export | bun -e "const d=await Bun.stdin.text(); const j=JSON.parse(d); console.log('success:', j.success, '| sources:', Object.keys(j.configs||{}).join(', '));"
```

**Step 4: Check for any remaining raw SQL in data-source-config.js**

```bash
grep -n "db\.query\|db\.exec\|getDatabase" server/data-source-config.js
```

Expected: No output (no remaining raw SQL or old db imports).

**Step 5: Verify Drizzle is the only DB dependency in data-source-config.js**

```bash
head -10 server/data-source-config.js
```

Expected: Only imports from `./db/index.js` and `drizzle-orm`, no `./db.js` import.

**Step 6: Create final summary commit**

```bash
git add -A
git status  # review any uncommitted changes
git commit -m "feat: complete OpenAPI + Drizzle ORM integration

- Swagger UI at /swagger with full interactive documentation
- All API routes tagged by category (dashboards, data-sources, etc.)
- data-source-config.js fully migrated to Drizzle ORM
- Drizzle schema in server/db/schema.js mirrors existing tables
- Drizzle instance wraps existing bun:sqlite connection
- All existing tests pass, no regressions"
```

---

## Success Criteria Checklist

Before creating a PR, verify:

- [ ] `bun test tests/unit/` — all pass
- [ ] `bun test tests/unit/db-drizzle.test.js` — all pass
- [ ] `bun test tests/unit/data-source-config.test.js` — all pass
- [ ] `bun test tests/unit/routes/swagger-routes.test.js` — all pass
- [ ] `curl http://tv:3000/swagger` returns HTML (200)
- [ ] `curl http://tv:3000/swagger/json` returns valid OpenAPI 3.x JSON
- [ ] Swagger UI shows 7+ tag groups when opened in browser
- [ ] `grep -n "db\.query\|db\.exec" server/data-source-config.js` returns nothing
- [ ] Server starts cleanly with no errors: `bun run server/index.js`

---

## Troubleshooting

**"Cannot find package 'drizzle-orm/bun-sqlite'"**
Run `bun add drizzle-orm` again — the `bun-sqlite` adapter is included in the package.

**Drizzle `.run()` vs `.execute()`**
With `drizzle-orm/bun-sqlite`, synchronous queries use `.run()` for mutations and `.get()` / `.all()` for selects. Do NOT use `.execute()` — that's for async adapters.

**Index syntax error in schema.js**
Different Drizzle versions use different syntax for the table extra config. If array syntax fails, use the object syntax shown in the note in Task 2.

**Swagger plugin conflicts with static plugin**
If Swagger routes conflict with the static plugin, make sure `.use(swagger(...))` comes BEFORE `.use(staticPlugin(...))` in server/index.js.

**onConflictDoUpdate not working**
Verify `target` matches the exact primary key column reference from the schema. Use `dataSourceConfigs.sourceName` (the Drizzle column object), not the string `'source_name'`.
