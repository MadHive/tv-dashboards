# OpenAPI + Drizzle Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade to @elysiajs/openapi, add TypeBox request/response schemas to all ~60 routes, and wire up Drizzle Studio.

**Architecture:** Central model registry (`server/models/`) registers named TypeBox schemas via Elysia's `.model()`. Routes reference schemas by name. The two Drizzle-backed tables use drizzle-typebox for auto-generated schemas so DB shape and API shape never drift.

**Tech Stack:** Elysia.js v1.2, @elysiajs/openapi, TypeBox (via `t` from elysia), drizzle-typebox, drizzle-kit, SQLite (bun:sqlite)

---

## Task 1: Swap @elysiajs/swagger → @elysiajs/openapi, fix db:studio port

**Files:**
- Modify: `package.json`
- Modify: `server/index.js` (import + .use() call only)

**Step 1: Install new package, remove old**

```bash
bun add @elysiajs/openapi
bun remove @elysiajs/swagger
```

If `@elysiajs/openapi` is not found on npm (package may still be in preview), keep `@elysiajs/swagger` and skip the import change — all other tasks apply equally to both packages.

**Step 2: Update the import + .use() in server/index.js**

Find (near top of file):
```js
import { swagger } from '@elysiajs/swagger';
```
Replace with:
```js
import { openapi } from '@elysiajs/openapi';
```

Find the `.use(swagger({` call, replace with `.use(openapi({` — all options inside stay identical.

**Step 3: Fix db:studio port in package.json**

Find:
```json
"db:studio": "bunx drizzle-kit studio",
```
Replace with:
```json
"db:studio": "bunx drizzle-kit studio --port 4983",
```

**Step 4: Verify server starts**

```bash
bun run start
```
Expected: server starts on port 3000, no import errors. Visit `http://tv:3000/swagger` — docs UI loads.

**Step 5: Commit**

```bash
git add package.json server/index.js
git commit -m "feat: upgrade to @elysiajs/openapi, set db:studio port 4983"
```

---

## Task 2: Bootstrap DB — generate + run initial migration

**Files:**
- Creates: `migrations/0000_initial.sql` (generated, do not edit manually)

**Step 1: Generate migration from existing schema**

```bash
bun run db:generate
```
Expected: `migrations/0000_initial.sql` created. Verify it contains `CREATE TABLE IF NOT EXISTS data_source_configs` and `CREATE TABLE IF NOT EXISTS config_audit_log`.

**Step 2: Apply migration**

```bash
bun run db:migrate
```
Expected: `data/tv-dashboards.db` exists (created or confirmed). No errors.

**Step 3: Verify Drizzle Studio opens**

```bash
bun run db:studio
```
Expected: Studio opens at `http://tv:4983`. You should see both tables in the sidebar. Kill with Ctrl+C when done.

**Step 4: Commit**

```bash
git add migrations/
git commit -m "feat: add initial drizzle migration for data_source_configs and config_audit_log"
```

---

## Task 3: Create common.model.js + schema contract test

**Files:**
- Create: `server/models/common.model.js`
- Create: `tests/unit/models/common.model.test.js`

**Step 1: Write the test**

```js
// tests/unit/models/common.model.test.js
import { describe, it, expect } from 'bun:test';
import { t } from 'elysia';
import { Value } from '@sinclair/typebox/value';

const ErrorSchema  = t.Object({ success: t.Literal(false), error: t.String() });
const SuccessSchema = t.Object({ success: t.Literal(true) });

describe('common models', () => {
  it('error schema validates correct shape', () => {
    expect(Value.Check(ErrorSchema, { success: false, error: 'oops' })).toBe(true);
  });
  it('error schema rejects missing error field', () => {
    expect(Value.Check(ErrorSchema, { success: false })).toBe(false);
  });
  it('success schema validates correct shape', () => {
    expect(Value.Check(SuccessSchema, { success: true })).toBe(true);
  });
});
```

**Step 2: Run test**

```bash
bun test tests/unit/models/common.model.test.js
```
Expected: all PASS (pure TypeBox, no files needed).

**Step 3: Create the model file**

```js
// server/models/common.model.js
import { Elysia, t } from 'elysia';

export const commonModels = new Elysia({ name: 'common.models' })
  .model({
    'common.error': t.Object({
      success: t.Literal(false),
      error:   t.String(),
    }),
    'common.success': t.Object({
      success: t.Literal(true),
    }),
  });
```

**Step 4: Commit**

```bash
git add server/models/common.model.js tests/unit/models/common.model.test.js
git commit -m "feat: common model registry (error, success schemas)"
```

---

## Task 4: Create dashboard.model.js + test

**Files:**
- Create: `server/models/dashboard.model.js`
- Create: `tests/unit/models/dashboard.model.test.js`

**Step 1: Write the test**

```js
// tests/unit/models/dashboard.model.test.js
import { describe, it, expect } from 'bun:test';
import { t } from 'elysia';
import { Value } from '@sinclair/typebox/value';

const WidgetPosition = t.Object({
  col: t.Number(), row: t.Number(),
  colSpan: t.Optional(t.Number()), rowSpan: t.Optional(t.Number()),
});
const GridSchema = t.Object({
  columns: t.Number(), rows: t.Number(), gap: t.Optional(t.Number()),
});
const WidgetConfig = t.Object({
  id: t.String(), type: t.String(), title: t.String(),
  source: t.Optional(t.String()), queryId: t.Optional(t.String()),
  position: WidgetPosition,
  unit: t.Optional(t.String()), min: t.Optional(t.Number()), max: t.Optional(t.Number()),
  thresholds: t.Optional(t.Object({
    warning: t.Optional(t.Number()), critical: t.Optional(t.Number()),
  })),
});
const DashboardCreate = t.Object({
  id: t.String(), name: t.String(),
  subtitle: t.Optional(t.String()), icon: t.Optional(t.String()),
  grid: GridSchema, widgets: t.Array(WidgetConfig),
});

describe('dashboard models', () => {
  it('dashboard.create accepts minimal valid dashboard', () => {
    expect(Value.Check(DashboardCreate, {
      id: 'test', name: 'Test', grid: { columns: 4, rows: 3 }, widgets: [],
    })).toBe(true);
  });
  it('dashboard.create rejects missing required fields', () => {
    expect(Value.Check(DashboardCreate, { id: 'test', grid: { columns: 4, rows: 3 }, widgets: [] })).toBe(false);
  });
  it('widget config validates position', () => {
    expect(Value.Check(WidgetConfig, {
      id: 'w1', type: 'big-number', title: 'Bids', position: { col: 1, row: 1 },
    })).toBe(true);
  });
  it('widget config accepts optional thresholds', () => {
    expect(Value.Check(WidgetConfig, {
      id: 'w1', type: 'gauge', title: 'Uptime',
      position: { col: 1, row: 1 },
      thresholds: { warning: 80, critical: 95 },
    })).toBe(true);
  });
});
```

**Step 2: Run test**

```bash
bun test tests/unit/models/dashboard.model.test.js
```
Expected: all PASS.

**Step 3: Create the model file**

```js
// server/models/dashboard.model.js
import { Elysia, t } from 'elysia';

const WidgetPosition = t.Object({
  col: t.Number(), row: t.Number(),
  colSpan: t.Optional(t.Number()), rowSpan: t.Optional(t.Number()),
});

const GridSchema = t.Object({
  columns: t.Number(), rows: t.Number(), gap: t.Optional(t.Number()),
});

const WidgetConfig = t.Object({
  id: t.String(), type: t.String(), title: t.String(),
  source: t.Optional(t.String()), queryId: t.Optional(t.String()),
  position: WidgetPosition,
  unit: t.Optional(t.String()), min: t.Optional(t.Number()), max: t.Optional(t.Number()),
  thresholds: t.Optional(t.Object({
    warning: t.Optional(t.Number()), critical: t.Optional(t.Number()),
  })),
});

const DashboardShape = t.Object({
  id: t.String(), name: t.String(),
  subtitle: t.Optional(t.String()), icon: t.Optional(t.String()),
  grid: GridSchema, widgets: t.Array(WidgetConfig),
});

export const dashboardModels = new Elysia({ name: 'dashboard.models' })
  .model({
    'dashboard.create':   DashboardShape,
    'dashboard.update':   t.Partial(DashboardShape),
    'dashboard.item':     DashboardShape,
    'dashboard.response': t.Object({ success: t.Boolean(), dashboard: DashboardShape }),
    'dashboard.list':     t.Object({
      dashboards: t.Array(DashboardShape),
      dataMode:   t.Optional(t.String()),
      global:     t.Optional(t.Any()),
    }),
    'dashboard.reorder':  t.Object({ order: t.Array(t.String()) }),
    'dashboard.import':   t.Object({ json: t.Any() }),
    'dashboard.export':   t.Object({ dashboard: t.Any() }),
  });
```

**Step 4: Commit**

```bash
git add server/models/dashboard.model.js tests/unit/models/dashboard.model.test.js
git commit -m "feat: dashboard model registry"
```

---

## Task 5: Create query.model.js + test

**Files:**
- Create: `server/models/query.model.js`
- Create: `tests/unit/models/query.model.test.js`

**Step 1: Write the test**

```js
// tests/unit/models/query.model.test.js
import { describe, it, expect } from 'bun:test';
import { t } from 'elysia';
import { Value } from '@sinclair/typebox/value';

const GcpQuery = t.Object({
  id: t.String(), name: t.String(),
  description: t.Optional(t.String()),
  metricType: t.String(),
  project: t.Optional(t.String()),
  timeWindow: t.Optional(t.Number()),
  aggregation: t.Optional(t.Any()),
  widgetTypes: t.Optional(t.Array(t.String())),
});

const BigQueryQuery = t.Object({
  id: t.String(), name: t.String(),
  description: t.Optional(t.String()),
  sql: t.String(),
  params: t.Optional(t.Any()),
  transform: t.Optional(t.Any()),
  widgetTypes: t.Optional(t.Array(t.String())),
});

describe('query models', () => {
  it('query.gcp accepts valid GCP query', () => {
    expect(Value.Check(GcpQuery, {
      id: 'q1', name: 'Request Count',
      metricType: 'run.googleapis.com/request_count',
    })).toBe(true);
  });
  it('query.gcp rejects missing metricType', () => {
    expect(Value.Check(GcpQuery, { id: 'q1', name: 'Bad' })).toBe(false);
  });
  it('query.bigquery accepts valid SQL query', () => {
    expect(Value.Check(BigQueryQuery, {
      id: 'bq1', name: 'Orders', sql: 'SELECT COUNT(*) FROM orders',
    })).toBe(true);
  });
  it('query.bigquery rejects missing sql', () => {
    expect(Value.Check(BigQueryQuery, { id: 'bq1', name: 'Bad' })).toBe(false);
  });
});
```

**Step 2: Run test**

```bash
bun test tests/unit/models/query.model.test.js
```
Expected: all PASS.

**Step 3: Create the model file**

```js
// server/models/query.model.js
import { Elysia, t } from 'elysia';

export const queryModels = new Elysia({ name: 'query.models' })
  .model({
    'query.gcp': t.Object({
      id: t.String(), name: t.String(),
      description:  t.Optional(t.String()),
      metricType:   t.String(),
      project:      t.Optional(t.String()),
      timeWindow:   t.Optional(t.Number()),
      aggregation:  t.Optional(t.Any()),
      filters:      t.Optional(t.String()),
      widgetTypes:  t.Optional(t.Array(t.String())),
    }),
    'query.bigquery': t.Object({
      id: t.String(), name: t.String(),
      description:  t.Optional(t.String()),
      sql:          t.String(),
      params:       t.Optional(t.Any()),
      transform:    t.Optional(t.Any()),
      widgetTypes:  t.Optional(t.Array(t.String())),
    }),
    'query.response': t.Object({ success: t.Boolean(), query: t.Any() }),
    'query.list':     t.Object({
      success: t.Boolean(), source: t.Optional(t.String()), queries: t.Array(t.Any()),
    }),
    'query.test-response': t.Object({
      success:       t.Boolean(),
      source:        t.String(),
      message:       t.Optional(t.String()),
      rowCount:      t.Optional(t.Number()),
      results:       t.Optional(t.Array(t.Any())),
      executionTime: t.Optional(t.Number()),
      error:         t.Optional(t.String()),
    }),
  });
```

**Step 4: Commit**

```bash
git add server/models/query.model.js tests/unit/models/query.model.test.js
git commit -m "feat: query model registry (gcp, bigquery, response schemas)"
```

---

## Task 6: Create data-source.model.js (drizzle-typebox) + test

**Files:**
- Create: `server/models/data-source.model.js`
- Create: `tests/unit/models/data-source.model.test.js`

**Step 1: Write the test**

```js
// tests/unit/models/data-source.model.test.js
import { describe, it, expect } from 'bun:test';
import { Value } from '@sinclair/typebox/value';
import { createInsertSchema, createSelectSchema } from 'drizzle-typebox';
import { dataSourceConfigs } from '../../server/db/schema.js';

const InsertSchema = createInsertSchema(dataSourceConfigs);
const SelectSchema = createSelectSchema(dataSourceConfigs);

describe('data-source models', () => {
  it('insert schema accepts valid config row', () => {
    expect(Value.Check(InsertSchema, {
      sourceName: 'gcp', enabled: true,
      configJson: '{}', updatedAt: new Date().toISOString(), updatedBy: 'test',
    })).toBe(true);
  });
  it('insert schema rejects row with missing sourceName', () => {
    expect(Value.Check(InsertSchema, { enabled: true })).toBe(false);
  });
  it('select schema is defined and has sourceName property', () => {
    expect(SelectSchema).toBeDefined();
    expect(SelectSchema.properties).toHaveProperty('sourceName');
  });
});
```

**Step 2: Run test**

```bash
bun test tests/unit/models/data-source.model.test.js
```
Expected: all PASS.

**Step 3: Create the model file**

```js
// server/models/data-source.model.js
import { Elysia, t } from 'elysia';
import { createInsertSchema, createSelectSchema } from 'drizzle-typebox';
import { dataSourceConfigs } from '../db/schema.js';

export const dataSourceModels = new Elysia({ name: 'datasource.models' })
  .model({
    'datasource.config': createInsertSchema(dataSourceConfigs),
    'datasource.select': createSelectSchema(dataSourceConfigs),
    'datasource.list':   t.Object({
      success: t.Boolean(),
      sources: t.Array(t.Object({
        name:        t.String(),
        isConnected: t.Boolean(),
        isReady:     t.Boolean(),
        lastError:   t.Optional(t.String()),
      })),
    }),
    'datasource.test-response': t.Object({
      success:   t.Boolean(),
      connected: t.Boolean(),
      message:   t.Optional(t.String()),
    }),
  });
```

**Step 4: Commit**

```bash
git add server/models/data-source.model.js tests/unit/models/data-source.model.test.js
git commit -m "feat: data-source model registry using drizzle-typebox"
```

---

## Task 7: Create metrics.model.js, template.model.js, theme.model.js

**Files:**
- Create: `server/models/metrics.model.js`
- Create: `server/models/template.model.js`
- Create: `server/models/theme.model.js`

**Step 1: Create metrics.model.js**

```js
// server/models/metrics.model.js
import { Elysia, t } from 'elysia';

const GcpDescriptor = t.Object({
  type: t.String(), displayName: t.String(),
  description: t.String(), metricKind: t.String(),
  valueType: t.String(), unit: t.String(),
});

export const metricsModels = new Elysia({ name: 'metrics.models' })
  .model({
    'metrics.dashboard':        t.Record(t.String(), t.Any()),
    'metrics.descriptor-list':  t.Object({
      success:     t.Boolean(),
      project:     t.String(),
      projects:    t.Array(t.String()),
      count:       t.Number(),
      namespaces:  t.Array(t.String()),
      descriptors: t.Array(GcpDescriptor),
    }),
    'metrics.descriptor-error': t.Object({
      success: t.Boolean(),
      error:   t.String(),
      hint:    t.Optional(t.String()),
    }),
    'metrics.numerics-value':   t.Object({
      postfix: t.Optional(t.String()),
      color:   t.Optional(t.String()),
      data:    t.Any(),
    }),
  });
```

**Step 2: Create template.model.js**

```js
// server/models/template.model.js
import { Elysia, t } from 'elysia';

const TemplateShape = t.Object({
  name:        t.String(),
  description: t.Optional(t.String()),
  category:    t.Optional(t.String()),
  author:      t.Optional(t.String()),
  dashboard:   t.Any(),
});

export const templateModels = new Elysia({ name: 'template.models' })
  .model({
    'template.create':   TemplateShape,
    'template.update':   t.Partial(TemplateShape),
    'template.item':     TemplateShape,
    'template.response': t.Object({
      success:  t.Boolean(),
      filename: t.Optional(t.String()),
      template: t.Optional(TemplateShape),
    }),
    'template.list': t.Object({
      success:   t.Boolean(),
      templates: t.Array(TemplateShape),
      count:     t.Optional(t.Number()),
    }),
  });
```

**Step 3: Create theme.model.js**

```js
// server/models/theme.model.js
import { Elysia, t } from 'elysia';

const ThemeColors = t.Object({
  background: t.Optional(t.String()),
  primary:    t.Optional(t.String()),
  secondary:  t.Optional(t.String()),
  text:       t.Optional(t.String()),
  accent:     t.Optional(t.String()),
});

const ThemeShape = t.Object({
  id:          t.Optional(t.String()),
  name:        t.String(),
  description: t.Optional(t.String()),
  category:    t.Optional(t.String()),
  colors:      t.Optional(ThemeColors),
});

export const themeModels = new Elysia({ name: 'theme.models' })
  .model({
    'theme.create':   ThemeShape,
    'theme.update':   t.Partial(ThemeShape),
    'theme.item':     ThemeShape,
    'theme.response': t.Object({
      success: t.Optional(t.Boolean()),
      theme:   t.Optional(ThemeShape),
    }),
    'theme.list': t.Array(ThemeShape),
  });
```

**Step 4: Commit**

```bash
git add server/models/metrics.model.js server/models/template.model.js server/models/theme.model.js
git commit -m "feat: metrics, template, theme model registries"
```

---

## Task 8: Create server/models/index.js and wire into server

**Files:**
- Create: `server/models/index.js`
- Modify: `server/index.js`

**Step 1: Create index.js**

```js
// server/models/index.js
import { Elysia } from 'elysia';
import { commonModels }     from './common.model.js';
import { dashboardModels }  from './dashboard.model.js';
import { queryModels }      from './query.model.js';
import { dataSourceModels } from './data-source.model.js';
import { metricsModels }    from './metrics.model.js';
import { templateModels }   from './template.model.js';
import { themeModels }      from './theme.model.js';

export const models = new Elysia({ name: 'models' })
  .use(commonModels)
  .use(dashboardModels)
  .use(queryModels)
  .use(dataSourceModels)
  .use(metricsModels)
  .use(templateModels)
  .use(themeModels);
```

**Step 2: Wire into server/index.js**

Add import near the other server imports:
```js
import { models } from './models/index.js';
```

Add `.use(models)` immediately after the openapi plugin, before any routes:
```js
const app = new Elysia()
  .use(openapi({ ... }))
  .use(models)           // ← add this line
  .use(cors())
```

**Step 3: Verify server starts**

```bash
bun run start
```
Expected: starts cleanly, `/swagger` still loads.

**Step 4: Commit**

```bash
git add server/models/index.js server/index.js
git commit -m "feat: compose model registry, wire into server"
```

---

## Task 9: Add schemas to dashboard + config + metrics routes

**Files:**
- Modify: `server/index.js`

For each route below, add `body` and/or `response` properties to its options object alongside the existing `detail` block. Do not change the handler logic.

```js
// GET /api/config
{ response: { 200: 'dashboard.list' },
  detail: { tags: ['dashboards'], summary: '...' } }

// PUT /api/config/global
{ body: t.Object({
    title:             t.Optional(t.String()),
    rotation_interval: t.Optional(t.Number()),
    refresh_interval:  t.Optional(t.Number()),
  }),
  response: { 200: 'common.success', 400: 'common.error' },
  detail: { ... } }

// GET /api/metrics/:dashboardId
{ response: { 200: 'metrics.dashboard' }, detail: { ... } }

// GET /api/gcp/metrics/descriptors
{ response: {
    200: 'metrics.descriptor-list',
    403: 'metrics.descriptor-error',
    500: 'metrics.descriptor-error',
  },
  detail: { ... } }

// POST /api/dashboards
{ body: 'dashboard.create',
  response: { 200: 'dashboard.response', 400: 'common.error' },
  detail: { ... } }

// GET /api/dashboards/:id  (if exists)
{ response: { 200: 'dashboard.response', 404: 'common.error' }, detail: { ... } }

// PUT /api/dashboards/:id
{ body: 'dashboard.update',
  response: { 200: 'dashboard.response', 400: 'common.error' },
  detail: { ... } }

// DELETE /api/dashboards/:id
{ response: { 200: 'common.success', 404: 'common.error' }, detail: { ... } }

// POST /api/dashboards/:id/duplicate
{ response: { 200: 'dashboard.response', 404: 'common.error' }, detail: { ... } }

// POST /api/dashboards/reorder
{ body: 'dashboard.reorder', response: { 200: 'dashboard.list' }, detail: { ... } }

// POST /api/dashboards/export
{ body: 'dashboard.export', response: { 200: 'dashboard.item' }, detail: { ... } }

// POST /api/dashboards/import
{ body: 'dashboard.import',
  response: { 200: 'dashboard.response', 400: 'common.error' },
  detail: { ... } }

// GET /api/backups
{ response: { 200: t.Object({ success: t.Boolean(), backups: t.Array(t.String()) }) },
  detail: { ... } }

// POST /api/backups/restore
{ body: t.Object({ filename: t.String() }),
  response: { 200: 'common.success', 400: 'common.error' },
  detail: { ... } }
```

**After each group of changes, run:**

```bash
bun test tests/unit tests/integration
```
Expected: all pass. Schemas are additive and don't change handler behaviour.

**Commit:**

```bash
git add server/index.js
git commit -m "feat: add body/response schemas to dashboard, config, metrics routes"
```

---

## Task 10: Add schemas to data-source, template, theme, health routes

**Files:**
- Modify: `server/index.js`

```js
// GET /api/data-sources
{ response: { 200: 'datasource.list' }, detail: { ... } }

// GET /api/data-sources/:name
{ response: { 200: t.Object({ success: t.Boolean(), source: t.Any() }), 404: 'common.error' },
  detail: { ... } }

// PUT /api/data-sources/:name/config
{ body: 'datasource.config',
  response: { 200: 'common.success', 400: 'common.error' },
  detail: { ... } }

// POST /api/data-sources/:name/test
{ response: { 200: 'datasource.test-response' }, detail: { ... } }

// GET /api/data-sources/:name/metrics
{ response: { 200: t.Object({ success: t.Boolean(), metrics: t.Array(t.Any()) }) },
  detail: { ... } }

// GET /api/data-sources/:name/history
{ response: { 200: t.Object({ success: t.Boolean(), history: t.Array(t.Any()) }) },
  detail: { ... } }

// GET /api/templates
{ response: { 200: 'template.list' }, detail: { ... } }

// GET /api/templates/:id
{ response: { 200: 'template.response', 404: 'common.error' }, detail: { ... } }

// POST /api/templates
{ body: 'template.create',
  response: { 201: 'template.response', 400: 'common.error' },
  detail: { ... } }

// PUT /api/templates/:id
{ body: 'template.update',
  response: { 200: 'template.response', 404: 'common.error' },
  detail: { ... } }

// DELETE /api/templates/:id
{ response: { 204: t.Void(), 404: 'common.error' }, detail: { ... } }

// GET /api/themes (and /api/themes/categories, /api/themes/default)
{ response: { 200: 'theme.list' }, detail: { ... } }

// GET /api/themes/:id
{ response: { 200: 'theme.response', 404: 'common.error' }, detail: { ... } }

// POST /api/themes
{ body: 'theme.create', response: { 201: 'theme.response', 400: 'common.error' }, detail: { ... } }

// PUT /api/themes/:id
{ body: 'theme.update', response: { 200: 'theme.response', 404: 'common.error' }, detail: { ... } }

// DELETE /api/themes/:id
{ response: { 204: t.Void(), 404: 'common.error' }, detail: { ... } }

// POST /api/themes/:id/activate
{ response: { 200: 'common.success', 404: 'common.error' }, detail: { ... } }

// GET /health
{ response: { 200: t.Object({ status: t.String(), timestamp: t.String(), uptime: t.Number() }) },
  detail: { tags: ['health'], summary: 'Health check' } }

// GET /api/metrics  (server performance metrics)
{ response: { 200: t.Object({ success: t.Boolean(), metrics: t.Any() }) },
  detail: { tags: ['metrics'], summary: 'Server performance metrics' } }
```

**Run tests, then commit:**

```bash
bun test tests/unit tests/integration
git add server/index.js
git commit -m "feat: add schemas to data-source, template, theme, health routes"
```

---

## Task 11: Add schemas to query-routes.js

**Files:**
- Modify: `server/query-routes.js`

Ensure `t` is imported at the top:
```js
import { Elysia, t } from 'elysia';
```

```js
// GET /api/queries/
{ response: { 200: 'query.list' }, detail: { ... } }

// GET /api/queries/:source
{ response: { 200: 'query.list', 404: 'common.error' }, detail: { ... } }

// GET /api/queries/:source/:id
{ response: { 200: 'query.response', 404: 'common.error' }, detail: { ... } }

// POST /api/queries/:source
// Source is dynamic so body uses t.Any(); runtime validation is already in the handler.
{ body: t.Any(),
  response: { 200: 'query.response', 400: 'common.error' },
  detail: { ... } }

// PUT /api/queries/:source/:id
{ body: t.Any(),
  response: { 200: 'query.response', 400: 'common.error', 404: 'common.error' },
  detail: { ... } }

// DELETE /api/queries/:source/:id
{ response: { 200: 'common.success', 404: 'common.error' }, detail: { ... } }

// POST /api/queries/:source/test
{ body: t.Any(),
  response: { 200: 'query.test-response', 400: 'query.test-response' },
  detail: { ... } }

// GET /api/queries/backups/list
{ response: { 200: t.Object({ success: t.Boolean(), backups: t.Array(t.String()) }) },
  detail: { ... } }

// POST /api/queries/backups/restore
{ body: t.Object({ filename: t.String() }),
  response: { 200: 'common.success', 400: 'common.error' },
  detail: { ... } }
```

**Run tests, then commit:**

```bash
bun test tests/unit tests/integration
git add server/query-routes.js
git commit -m "feat: add body/response schemas to query routes"
```

---

## Task 12: Add schemas to bigquery-routes.js, tv-apps.js, google-oauth.js

**Files:**
- Modify: `server/bigquery-routes.js`
- Modify: `server/tv-apps.js`
- Modify: `server/google-oauth.js`
- Modify: `server/index.js` (add `tv-apps` and `auth` to the openapi tags array)

**bigquery-routes.js:**

```js
// GET /api/bigquery/queries
{ response: { 200: 'query.list' }, detail: { ... } }

// GET /api/bigquery/queries/:id
{ response: { 200: 'query.response', 404: 'common.error' }, detail: { ... } }

// POST /api/bigquery/queries
{ body: 'query.bigquery',
  response: { 200: 'query.response', 400: 'common.error' },
  detail: { ... } }

// DELETE /api/bigquery/queries/:id
{ response: { 200: 'common.success', 404: 'common.error' }, detail: { ... } }

// POST /api/bigquery/execute  (if it exists)
{ body: t.Object({ sql: t.String(), params: t.Optional(t.Any()) }),
  response: { 200: 'query.test-response', 400: 'query.test-response' },
  detail: { ... } }
```

**tv-apps.js** — read-only, no request body:

```js
// All GET /api/numerics/* endpoints
{ response: { 200: 'metrics.numerics-value' },
  detail: { tags: ['tv-apps'], summary: '...' } }

// GET /api/anyboard/data.json and /api/anyboard/config.json
{ response: { 200: t.Any() },
  detail: { tags: ['tv-apps'], summary: '...' } }
```

**google-oauth.js** — redirect routes, no JSON body:

```js
// GET /auth/google/login
{ detail: { tags: ['auth'], summary: 'Redirect to Google OAuth consent screen' } }

// GET /auth/google/callback
{ detail: { tags: ['auth'], summary: 'Google OAuth callback — sets session cookie, redirects to /' } }

// GET /auth/google/logout
{ detail: { tags: ['auth'], summary: 'Clear session and redirect to /' } }

// GET /auth/google/me
{ response: {
    200: t.Object({ email: t.String(), name: t.String(), picture: t.Optional(t.String()) }),
    401: t.Object({ error: t.String() }),
  },
  detail: { tags: ['auth'], summary: 'Get current authenticated user' } }
```

**Add tags to openapi config in server/index.js:**

```js
tags: [
  // ... existing 8 tags ...
  { name: 'tv-apps', description: 'Apple TV and external app widget endpoints' },
  { name: 'auth',    description: 'Google OAuth authentication' },
]
```

**Run tests, then commit:**

```bash
bun test tests/unit tests/integration
git add server/bigquery-routes.js server/tv-apps.js server/google-oauth.js server/index.js
git commit -m "feat: add schemas to bigquery, tv-apps, auth routes; add tv-apps and auth tags"
```

---

## Task 13: OpenAPI spec validation test

**Files:**
- Create: `tests/integration/openapi-spec.test.js`

**Step 1: Write the test**

```js
// tests/integration/openapi-spec.test.js
import { describe, it, expect, beforeAll } from 'bun:test';

let app;
beforeAll(async () => {
  const mod = await import('../../server/index.js');
  app = mod.app;
});

describe('OpenAPI spec', () => {
  it('GET /swagger/json returns valid OpenAPI 3.x spec', async () => {
    const res = await app.handle(new Request('http://localhost/swagger/json'));
    expect(res.status).toBe(200);
    const spec = await res.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBe('MadHive TV Dashboards API');
    expect(spec.paths).toBeDefined();
  });

  it('spec includes all required tag groups', async () => {
    const res = await app.handle(new Request('http://localhost/swagger/json'));
    const spec = await res.json();
    const tagNames = (spec.tags || []).map(t => t.name);
    for (const required of ['health', 'dashboards', 'data-sources', 'queries', 'templates', 'themes', 'metrics', 'tv-apps', 'auth']) {
      expect(tagNames).toContain(required);
    }
  });

  it('POST /api/dashboards has a requestBody schema defined', async () => {
    const res = await app.handle(new Request('http://localhost/swagger/json'));
    const spec = await res.json();
    const route = spec.paths?.['/api/dashboards']?.post;
    expect(route).toBeDefined();
    expect(route.requestBody).toBeDefined();
    expect(route.requestBody.content?.['application/json']?.schema).toBeDefined();
  });

  it('POST /api/dashboards has response schemas defined', async () => {
    const res = await app.handle(new Request('http://localhost/swagger/json'));
    const spec = await res.json();
    const route = spec.paths?.['/api/dashboards']?.post;
    expect(route.responses).toBeDefined();
    expect(Object.keys(route.responses).length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run the test**

```bash
bun test tests/integration/openapi-spec.test.js
```
Expected: all PASS.

**Step 3: Commit**

```bash
git add tests/integration/openapi-spec.test.js
git commit -m "test: OpenAPI spec validation — tags present, key routes have schemas"
```

---

## Task 14: Drizzle smoke tests

**Files:**
- Create: `tests/unit/db/drizzle-smoke.test.js`

**Step 1: Write the test**

Uses an in-memory SQLite instance so no file is created and tests are fully isolated.

```js
// tests/unit/db/drizzle-smoke.test.js
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import * as schema from '../../../server/db/schema.js';

let db;
let sqlite;

beforeAll(() => {
  sqlite = new Database(':memory:');
  // Use run() calls instead of exec() to create the tables
  sqlite.run(`CREATE TABLE data_source_configs (
    source_name TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 1,
    config_json TEXT,
    updated_at TEXT,
    updated_by TEXT
  )`);
  sqlite.run(`CREATE TABLE config_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT,
    action TEXT,
    changes_json TEXT,
    user_email TEXT,
    timestamp TEXT
  )`);
  db = drizzle(sqlite, { schema });
});

afterAll(() => {
  sqlite.close();
});

describe('Drizzle smoke tests', () => {
  it('can insert and read back a data_source_configs row', () => {
    db.insert(schema.dataSourceConfigs).values({
      sourceName: 'gcp',
      enabled: true,
      configJson: '{"project":"mad-master"}',
      updatedAt: new Date().toISOString(),
      updatedBy: 'test',
    }).run();

    const row = db.select()
      .from(schema.dataSourceConfigs)
      .where(eq(schema.dataSourceConfigs.sourceName, 'gcp'))
      .get();

    expect(row).toBeDefined();
    expect(row.sourceName).toBe('gcp');
    expect(row.enabled).toBe(true);
    expect(JSON.parse(row.configJson)).toEqual({ project: 'mad-master' });
  });

  it('can insert and read back a config_audit_log row', () => {
    db.insert(schema.configAuditLog).values({
      sourceName: 'gcp',
      action: 'update',
      changesJson: '{}',
      userEmail: 'test@madhive.com',
      timestamp: new Date().toISOString(),
    }).run();

    const rows = db.select()
      .from(schema.configAuditLog)
      .where(eq(schema.configAuditLog.sourceName, 'gcp'))
      .all();

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].action).toBe('update');
    expect(rows[0].userEmail).toBe('test@madhive.com');
  });

  it('drizzle-typebox select schema validates a real row shape', async () => {
    const { createSelectSchema } = await import('drizzle-typebox');
    const { Value } = await import('@sinclair/typebox/value');

    const SelectSchema = createSelectSchema(schema.dataSourceConfigs);
    const row = db.select().from(schema.dataSourceConfigs).get();

    expect(Value.Check(SelectSchema, row)).toBe(true);
  });
});
```

**Step 2: Run the test**

```bash
bun test tests/unit/db/drizzle-smoke.test.js
```
Expected: all PASS.

**Step 3: Run full suite**

```bash
bun run test
```
Expected: all 1500+ pass, 0 fail.

**Step 4: Commit**

```bash
git add tests/unit/db/drizzle-smoke.test.js
git commit -m "test: Drizzle smoke tests with in-memory SQLite"
```

---

## Task 15: Final verification + PR

**Step 1: Full test suite**

```bash
bun run test
```
Expected: all pass.

**Step 2: Manual Swagger check**

```bash
bun run start
```

Visit `http://tv:3000/swagger` and verify:
- [ ] All route groups in sidebar (dashboards, queries, templates, themes, data-sources, metrics, health, tv-apps, auth)
- [ ] POST /api/dashboards → request body schema shows `id`, `name`, `grid`, `widgets` fields
- [ ] POST /api/queries/gcp → body shows `metricType`, `project`, `timeWindow`
- [ ] GET /api/data-sources → response shows `sources` array with `name`, `isConnected`, `isReady`
- [ ] GET /auth/google/me → response shows `email`, `name`, `picture`

**Step 3: Manual Drizzle Studio check**

```bash
bun run db:studio
```

Visit `http://tv:4983`:
- [ ] Both tables visible in sidebar
- [ ] Can browse rows in `data_source_configs`
- [ ] Can browse rows in `config_audit_log`

**Step 4: Create PR**

```bash
git push origin <branch>
gh pr create --title "feat: @elysiajs/openapi, full route schema coverage, Drizzle Studio"
```
