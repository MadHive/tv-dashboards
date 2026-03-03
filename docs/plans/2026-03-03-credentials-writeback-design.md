# Data Source Credentials Write-Back Design
**Date:** 2026-03-03
**Status:** Approved
**Scope:** Save credentials from the studio Sources tab to .env with hot-reload

---

## Problem

The studio's Sources tab shows a credentials editor for each data source but has no Save button — credentials can only be changed by SSH'ing in to edit `.env` and restarting the service. Data sources read from `process.env` at construction time, so a restart has been required for any credential change.

---

## Solution: Option A — Write to .env + hot-reload

Update `.env` on disk, set `process.env[key] = value`, and call `source.initialize()` on just the affected data source. Changes take effect immediately with no restart.

---

## Data Flow

```
Studio credentials form
        ↓  PUT /api/data-sources/:name/credentials
        ↓  { DATADOG_API_KEY: "xxx", ... }
  Whitelist check  ─── reject unknown keys (400)
        ↓
  server/env-writer.js  ─── parse .env, update lines in-place, write back
        ↓
  process.env[key] = value  ─── hot-apply to running process
        ↓
  registry.reinitializeSource(name)  ─── call source.initialize() again
        ↓
  return { success, connected, message }
        ↓
  Studio refreshes datasource status dots
```

---

## New / Modified Files

| File | Change |
|------|--------|
| `server/env-writer.js` | New — safe in-place `.env` key updater |
| `server/data-source-env-map.js` | New — whitelist: source name → allowed env var keys |
| `server/data-source-registry.js` | Add `reinitializeSource(name)` method |
| `server/index.js` | Add `PUT /api/data-sources/:name/credentials` endpoint |
| `public/js/studio.js` | Add Save button handler, populate `dataset.envVar` on inputs |
| `public/studio.html` | Add Save button + result span to `#datasource-editor-panel` |
| `.env` | Fix `DD_API_KEY`/`DD_APP_KEY` → `DATADOG_API_KEY`/`DATADOG_APP_KEY` |

---

## Security: Env Var Whitelist

Every incoming key is validated against a per-source whitelist before touching the filesystem. Unknown keys → 400. Blank values are skipped (allows partial updates).

```js
// server/data-source-env-map.js
export const ENV_MAP = {
  datadog:       { DATADOG_API_KEY: { secure: true },  DATADOG_APP_KEY: { secure: true },  DD_SITE: { secure: false } },
  aws:           { AWS_ACCESS_KEY_ID: { secure: true }, AWS_SECRET_ACCESS_KEY: { secure: true }, AWS_REGION: { secure: false } },
  vulntrack:     { VULNTRACK_API_URL: { secure: false }, VULNTRACK_API_KEY: { secure: true } },
  elasticsearch: { ELASTICSEARCH_URL: { secure: false }, ELASTICSEARCH_API_KEY: { secure: true } },
  salesforce:    { SALESFORCE_INSTANCE_URL: { secure: false }, SALESFORCE_CLIENT_ID: { secure: false }, SALESFORCE_CLIENT_SECRET: { secure: true }, SALESFORCE_USERNAME: { secure: false }, SALESFORCE_PASSWORD: { secure: true } },
  checkly:       { CHECKLY_API_KEY: { secure: true }, CHECKLY_ACCOUNT_ID: { secure: false } },
  hotjar:        { HOTJAR_SITE_ID: { secure: false }, HOTJAR_API_KEY: { secure: true } },
  fullstory:     { FULLSTORY_API_KEY: { secure: true }, FULLSTORY_ORG_ID: { secure: false } },
  zendesk:       { ZENDESK_SUBDOMAIN: { secure: false }, ZENDESK_EMAIL: { secure: false }, ZENDESK_API_TOKEN: { secure: true } },
  looker:        { LOOKER_BASE_URL: { secure: false }, LOOKER_CLIENT_ID: { secure: false }, LOOKER_CLIENT_SECRET: { secure: true } },
  rollbar:       { ROLLBAR_ACCESS_TOKEN: { secure: true }, ROLLBAR_ACCOUNT_TOKEN: { secure: true } },
  rootly:        { ROOTLY_API_KEY: { secure: true } },
  segment:       { SEGMENT_WRITE_KEY: { secure: true }, SEGMENT_WORKSPACE_ID: { secure: false } },
  chromatic:     { CHROMATIC_PROJECT_TOKEN: { secure: true }, CHROMATIC_APP_ID: { secure: false } },
};
```

Only keys in the source's whitelist can be written. Everything else in `.env` (SESSION_SECRET, GCP_PROJECTS, GOOGLE_CLIENT_SECRET, etc.) is untouched.

---

## Server Components

### server/env-writer.js

Reads `.env` line-by-line, updates matching `KEY=value` lines in place, appends new keys that don't exist yet:

```js
import { readFileSync, writeFileSync } from 'fs';

export function updateEnvVars(updates) {
  const envPath = new URL('../.env', import.meta.url).pathname;
  const lines = readFileSync(envPath, 'utf8').split('\n');
  const remaining = new Set(Object.keys(updates));

  const updated = lines.map(line => {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && remaining.has(match[1])) {
      remaining.delete(match[1]);
      return match[1] + '=' + updates[match[1]];
    }
    return line;
  });

  for (const key of remaining) updated.push(key + '=' + updates[key]);
  writeFileSync(envPath, updated.join('\n'), 'utf8');
}
```

### registry.reinitializeSource(name)

```js
async reinitializeSource(name) {
  const source = this.sources.get(name);
  if (!source) throw new Error(`Unknown source: ${name}`);
  source.isConnected = false;
  source.lastError   = null;
  await source.initialize();
  return source;
}
```

### PUT /api/data-sources/:name/credentials

```js
.put('/api/data-sources/:name/credentials', async ({ params, body }) => {
  const allowed = ENV_MAP[params.name];
  if (!allowed) return 400 { error: 'Unknown source' };

  for (const key of Object.keys(body)) {
    if (!allowed[key]) return 400 { error: `Unknown credential key: ${key}` };
  }

  const updates = Object.fromEntries(Object.entries(body).filter(([, v]) => v));
  if (!Object.keys(updates).length) return 400 { error: 'No credentials provided' };

  updateEnvVars(updates);
  for (const [k, v] of Object.entries(updates)) process.env[k] = v;

  const source = await dataSourceRegistry.reinitializeSource(params.name);
  return { success: true, connected: source.isConnected, message: source.lastError?.message };
})
```

---

## Studio UI Changes

### studio.html — datasource-editor-panel

Add Save button and result span alongside existing Test button:

```html
<div class="dse-actions">
  <button id="dse-save" class="studio-btn primary small">Save Credentials</button>
  <button id="dse-test" class="studio-btn secondary small">Test Connection</button>
  <span id="dse-test-result" class="dse-result"></span>
</div>
```

### studio.js — field construction

When building credential inputs, populate `dataset.envVar` from `field.envVar`:

```js
input.dataset.envVar = field.envVar || '';
```

### studio.js — Save handler

```js
document.getElementById('dse-save').onclick = async () => {
  const body = {};
  document.querySelectorAll('#dse-fields input[data-field]').forEach(input => {
    if (input.value && input.dataset.envVar) body[input.dataset.envVar] = input.value;
  });
  if (!Object.keys(body).length) { /* show amber warning */ return; }
  // PUT /api/data-sources/:name/credentials
  // on success: refresh renderDatasourceList()
  // show ✓ green / amber / red result
};
```

---

## .env Fix

Rename the mismatched DataDog keys:
```
DD_API_KEY=  →  DATADOG_API_KEY=
DD_APP_KEY=  →  DATADOG_APP_KEY=
```
(DD_SITE stays as-is, datadog.js doesn't read it from env yet)

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Unknown source name | 400 "Unknown source" |
| Unknown env var key | 400 "Unknown credential key: KEY" |
| All values blank | 400 "No credentials provided" |
| .env file write fails | 500 with error message |
| Re-init fails (bad creds) | 200 `{ connected: false, message: "..." }` |
| Re-init succeeds | 200 `{ connected: true }` |

Re-init failure (bad creds) is a 200, not an error — the credentials were saved successfully, the connection just didn't work.

---

## Success Criteria

- Save button writes credentials to `.env` and takes effect without a server restart
- Status dots in the sidebar refresh after save
- Entering bad credentials shows "saved — not yet connected" (amber), not an error
- Blank fields are skipped (partial updates allowed)
- Only whitelisted env var keys can be written
- SESSION_SECRET, GOOGLE_CLIENT_SECRET, GCP_PROJECTS etc. cannot be overwritten
