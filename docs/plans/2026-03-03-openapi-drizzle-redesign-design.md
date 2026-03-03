# OpenAPI + Drizzle Studio Redesign
**Date:** 2026-03-03
**Status:** Approved
**Scope:** Upgrade to @elysiajs/openapi, full route schema coverage, Drizzle Studio setup

---

## Decisions

- **Package:** Upgrade from `@elysiajs/swagger` → `@elysiajs/openapi`
- **Schema coverage:** Every route (~60) gets `body` and/or `response` TypeBox schemas
- **Model organisation:** Central registry in `server/models/` using Elysia's `.model()` pattern
- **Drizzle-backed schemas:** `drizzle-typebox` generates schemas for `data_source_configs` and `config_audit_log`
- **Drizzle Studio:** On-demand via `bun run db:studio` on port 4983

---

## Section 1 — Package Swap

Uninstall `@elysiajs/swagger`, install `@elysiajs/openapi`.

```js
// before
import { swagger } from '@elysiajs/swagger'
.use(swagger({ documentation: { info: { ... }, tags: [...] } }))

// after
import { openapi } from '@elysiajs/openapi'
.use(openapi({ documentation: { info: { ... }, tags: [...] } }))
```

All existing `.detail({ tags, summary })` blocks remain unchanged.

---

## Section 2 — Model Registry

New directory `server/models/` with one file per domain:

```
server/models/
├── index.js              # Composes all into one Elysia plugin
├── common.model.js       # error, success, id-params
├── dashboard.model.js    # dashboard.create, dashboard.update, dashboard.response, dashboard.list
├── query.model.js        # query.gcp, query.bigquery, query.vulntrack, query.response
├── data-source.model.js  # datasource.config, datasource.select (drizzle-typebox)
├── metrics.model.js      # metrics.widget, metrics.descriptor
├── template.model.js     # template.create, template.update, template.response
└── theme.model.js        # theme.create, theme.update, theme.response
```

Pattern for each model file:

```js
import { Elysia, t } from 'elysia'

export const dashboardModels = new Elysia({ name: 'dashboard.models' })
  .model({
    'dashboard.create': t.Object({ ... }),
    'dashboard.update': t.Object({ ... }),
    'dashboard.response': t.Object({ success: t.Boolean(), dashboard: t.Object({ ... }) }),
    'dashboard.list': t.Object({ success: t.Boolean(), dashboards: t.Array(t.Object({ ... })) }),
  })
```

`data-source.model.js` uses drizzle-typebox:

```js
import { createInsertSchema, createSelectSchema } from 'drizzle-typebox'
import { dataSourceConfigs, configAuditLog } from '../db/schema.js'

export const DataSourceInsert = createInsertSchema(dataSourceConfigs)
export const DataSourceSelect = createSelectSchema(dataSourceConfigs)
```

`server/models/index.js` composes all into one plugin:

```js
import { Elysia } from 'elysia'
import { commonModels } from './common.model.js'
import { dashboardModels } from './dashboard.model.js'
// ...

export const models = new Elysia({ name: 'models' })
  .use(commonModels)
  .use(dashboardModels)
  // ...
```

Added to server/index.js at the top of the chain:

```js
import { models } from './models/index.js'

const app = new Elysia()
  .use(openapi({ ... }))
  .use(models)      // ← all named schemas available from here on
  // ...routes
```

---

## Section 3 — Route Coverage Plan

| Domain | Routes | Body model | Response model |
|--------|--------|-----------|----------------|
| Config | GET /api/config, PUT /api/config/global | `config.global` | `config.response` |
| Dashboards | CRUD + duplicate + reorder + import/export | `dashboard.create`, `dashboard.update` | `dashboard.response`, `dashboard.list` |
| Metrics | GET /api/metrics/:id, GET /api/gcp/metrics/descriptors, GET /api/data/:widgetId | — | `metrics.widget`, `metrics.descriptor` |
| Data Sources | config, test, history, available metrics | `datasource.config` | `datasource.select` |
| Queries | CRUD per source + test + backups | `query.gcp`, `query.bigquery`, `query.vulntrack` | `query.response` |
| BigQuery | list, get, create, delete, execute | `bigquery.create`, `bigquery.execute` | `bigquery.response` |
| Templates | CRUD | `template.create`, `template.update` | `template.response` |
| Themes | CRUD + activate | `theme.create`, `theme.update` | `theme.response` |
| Health | GET /health, GET /api/status, GET /api/metrics | — | `health.response`, `status.response` |
| TV Apps | Numerics + AnyBoard widget endpoints | — | `metrics.widget` |
| Auth | GET /auth/google/login, /callback | — | `auth.redirect` |

`common.model.js` provides:
- `common.error` — `{ success: false, error: t.String() }`
- `common.success` — `{ success: true }`
- `common.id-params` — `{ id: t.String() }`

GET-only routes with no body get only a `response` schema. Redirect/HTML routes get a `detail` annotation noting the content type.

---

## Section 4 — Drizzle Studio + Migrations

Three new scripts in `package.json`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate":  "drizzle-kit migrate",
"db:studio":   "drizzle-kit studio --port 4983"
```

Bootstrap sequence (run once):

```bash
bun run db:generate   # creates migrations/0000_initial.sql from schema.js
bun run db:migrate    # applies to data/tv-dashboards.db
bun run db:studio     # opens at http://tv:4983
```

`drizzle.config.js` is already correct — no changes needed.

**Ongoing schema change workflow:**
1. Edit `server/db/schema.js`
2. `bun run db:generate`
3. `bun run db:migrate`
4. Restart app server

---

## Section 5 — Testing

**OpenAPI spec validation:** One test fetches `/swagger/json`, asserts valid OpenAPI 3.0, all 8 tag groups present, key routes have `requestBody` and `responses` defined.

**Schema contract tests:** Per model file, assert a valid payload passes TypeBox validation and an invalid payload fails. No server or DB required.

**Drizzle smoke tests:** Two tests (one per table) using in-memory SQLite — insert, read back, assert shape matches drizzle-typebox select schema.

**Out of scope:** UI "Try it out" testing, auth flow testing, performance benchmarking.

---

## Success Criteria

- `/swagger` loads with full schema details for every route
- Every POST/PUT route shows its request body schema in the UI
- Every route shows response schemas for 200 and 4xx
- `bun run db:studio` opens Drizzle Studio at `http://tv:4983`
- `bun run db:generate` + `db:migrate` bootstrap the DB cleanly
- All existing 1500+ tests continue to pass
