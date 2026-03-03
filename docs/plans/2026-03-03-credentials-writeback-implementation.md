# Data Source Credentials Write-Back Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow saving data source credentials from the studio Sources tab directly to `.env` with immediate hot-reload — no SSH or server restart required.

**Architecture:** New `PUT /api/data-sources/:name/credentials` endpoint validates a per-source env var whitelist, updates `.env` in-place via `env-writer.js`, sets `process.env[key]` immediately, and re-initializes just the affected data source singleton. The studio gains a Save button that collects credential inputs and calls the endpoint.

**Tech Stack:** Bun/Elysia.js, vanilla JS, `fs.readFileSync`/`writeFileSync` for .env manipulation.

---

## Task 1: Create server/data-source-env-map.js (whitelist)

**Files:**
- Create: `server/data-source-env-map.js`
- Create: `tests/unit/data-source-env-map.test.js`

**Step 1: Write the failing test**

```js
// tests/unit/data-source-env-map.test.js
import { describe, it, expect } from 'bun:test';
import { ENV_MAP, getAllowedKeys, isSecure } from '../../server/data-source-env-map.js';

describe('ENV_MAP', () => {
  it('has entries for all major data sources', () => {
    const sources = ['datadog', 'aws', 'vulntrack', 'elasticsearch', 'salesforce'];
    for (const src of sources) {
      expect(ENV_MAP[src]).toBeDefined();
    }
  });

  it('getAllowedKeys returns the env var names for a source', () => {
    const keys = getAllowedKeys('datadog');
    expect(keys).toContain('DATADOG_API_KEY');
    expect(keys).toContain('DATADOG_APP_KEY');
    expect(keys).not.toContain('SESSION_SECRET');
    expect(keys).not.toContain('GOOGLE_CLIENT_SECRET');
  });

  it('getAllowedKeys returns null for unknown source', () => {
    expect(getAllowedKeys('nonexistent')).toBeNull();
  });

  it('isSecure returns true for api key fields', () => {
    expect(isSecure('datadog', 'DATADOG_API_KEY')).toBe(true);
    expect(isSecure('aws', 'AWS_REGION')).toBe(false);
  });
});
```

**Step 2: Run test — verify it fails**

```bash
bun test tests/unit/data-source-env-map.test.js
```
Expected: FAIL — module not found.

**Step 3: Create the file**

```js
// server/data-source-env-map.js
// Whitelist of env vars each data source is allowed to write.
// Keys NOT listed here can never be overwritten by the credentials endpoint.

export const ENV_MAP = {
  datadog: {
    DATADOG_API_KEY: { secure: true  },
    DATADOG_APP_KEY: { secure: true  },
    DD_SITE:         { secure: false },
  },
  aws: {
    AWS_ACCESS_KEY_ID:     { secure: true  },
    AWS_SECRET_ACCESS_KEY: { secure: true  },
    AWS_REGION:            { secure: false },
  },
  vulntrack: {
    VULNTRACK_API_URL: { secure: false },
    VULNTRACK_API_KEY: { secure: true  },
  },
  elasticsearch: {
    ELASTICSEARCH_URL:     { secure: false },
    ELASTICSEARCH_API_KEY: { secure: true  },
  },
  salesforce: {
    SALESFORCE_INSTANCE_URL: { secure: false },
    SALESFORCE_CLIENT_ID:    { secure: false },
    SALESFORCE_CLIENT_SECRET:{ secure: true  },
    SALESFORCE_USERNAME:     { secure: false },
    SALESFORCE_PASSWORD:     { secure: true  },
  },
  checkly: {
    CHECKLY_API_KEY:    { secure: true  },
    CHECKLY_ACCOUNT_ID: { secure: false },
  },
  hotjar: {
    HOTJAR_SITE_ID: { secure: false },
    HOTJAR_API_KEY: { secure: true  },
  },
  fullstory: {
    FULLSTORY_API_KEY: { secure: true  },
    FULLSTORY_ORG_ID:  { secure: false },
  },
  zendesk: {
    ZENDESK_SUBDOMAIN:  { secure: false },
    ZENDESK_EMAIL:      { secure: false },
    ZENDESK_API_TOKEN:  { secure: true  },
  },
  looker: {
    LOOKER_BASE_URL:      { secure: false },
    LOOKER_CLIENT_ID:     { secure: false },
    LOOKER_CLIENT_SECRET: { secure: true  },
  },
  rollbar: {
    ROLLBAR_ACCESS_TOKEN: { secure: true },
    ROLLBAR_ACCOUNT_TOKEN:{ secure: true },
  },
  rootly: {
    ROOTLY_API_KEY: { secure: true },
  },
  segment: {
    SEGMENT_WRITE_KEY:    { secure: true  },
    SEGMENT_WORKSPACE_ID: { secure: false },
  },
  chromatic: {
    CHROMATIC_PROJECT_TOKEN: { secure: true  },
    CHROMATIC_APP_ID:        { secure: false },
  },
};

/** Returns array of allowed env var names for a source, or null if source unknown. */
export function getAllowedKeys(sourceName) {
  const entry = ENV_MAP[sourceName];
  return entry ? Object.keys(entry) : null;
}

/** Returns true if the env var is marked secure for that source. */
export function isSecure(sourceName, key) {
  return Boolean(ENV_MAP[sourceName]?.[key]?.secure);
}
```

**Step 4: Run test — verify it passes**

```bash
bun test tests/unit/data-source-env-map.test.js
```
Expected: 4 PASS.

**Step 5: Commit**

```bash
git add server/data-source-env-map.js tests/unit/data-source-env-map.test.js
git commit -m "feat: data source env var whitelist (data-source-env-map.js)"
```

---

## Task 2: Create server/env-writer.js (safe .env updater)

**Files:**
- Create: `server/env-writer.js`
- Create: `tests/unit/env-writer.test.js`

**Step 1: Write the failing test**

```js
// tests/unit/env-writer.test.js
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

// Use a temp file so we never touch the real .env
const TMP_ENV = join(import.meta.dir, '__test__.env');

// Override the env path used by env-writer for tests
process.env._TEST_ENV_PATH = TMP_ENV;

import { updateEnvVars } from '../../server/env-writer.js';

const INITIAL = `# Dashboard
PORT=3000
DATADOG_API_KEY=
DATADOG_APP_KEY=old_app_key
DD_SITE=datadoghq.com
SESSION_SECRET=abc123
`;

beforeEach(() => writeFileSync(TMP_ENV, INITIAL, 'utf8'));
afterEach(() => { try { unlinkSync(TMP_ENV); } catch {} });

describe('updateEnvVars', () => {
  it('updates an existing key in-place', () => {
    updateEnvVars({ DATADOG_API_KEY: 'new_api_key' }, TMP_ENV);
    const content = readFileSync(TMP_ENV, 'utf8');
    expect(content).toContain('DATADOG_API_KEY=new_api_key');
    expect(content).not.toContain('DATADOG_API_KEY=\n');
  });

  it('preserves surrounding keys untouched', () => {
    updateEnvVars({ DATADOG_API_KEY: 'x' }, TMP_ENV);
    const content = readFileSync(TMP_ENV, 'utf8');
    expect(content).toContain('SESSION_SECRET=abc123');
    expect(content).toContain('DD_SITE=datadoghq.com');
    expect(content).toContain('PORT=3000');
  });

  it('updates multiple keys in one call', () => {
    updateEnvVars({ DATADOG_API_KEY: 'k1', DATADOG_APP_KEY: 'k2' }, TMP_ENV);
    const content = readFileSync(TMP_ENV, 'utf8');
    expect(content).toContain('DATADOG_API_KEY=k1');
    expect(content).toContain('DATADOG_APP_KEY=k2');
  });

  it('appends a key that does not yet exist', () => {
    updateEnvVars({ NEW_KEY: 'hello' }, TMP_ENV);
    const content = readFileSync(TMP_ENV, 'utf8');
    expect(content).toContain('NEW_KEY=hello');
  });

  it('preserves comments and blank lines', () => {
    updateEnvVars({ DATADOG_API_KEY: 'x' }, TMP_ENV);
    const content = readFileSync(TMP_ENV, 'utf8');
    expect(content).toContain('# Dashboard');
    expect(content).toContain('PORT=3000');
  });
});
```

**Step 2: Run test — verify it fails**

```bash
bun test tests/unit/env-writer.test.js
```
Expected: FAIL — module not found.

**Step 3: Create the file**

```js
// server/env-writer.js
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');

/**
 * Update specific keys in a .env file without touching anything else.
 * Existing keys are updated in-place; missing keys are appended at the end.
 *
 * @param {Record<string, string>} updates  - key → new value pairs
 * @param {string} [envPath]               - path to .env file (defaults to project root)
 */
export function updateEnvVars(updates, envPath = DEFAULT_ENV_PATH) {
  const content = readFileSync(envPath, 'utf8');
  const lines   = content.split('\n');
  const pending = new Set(Object.keys(updates));

  const updated = lines.map(line => {
    // Match KEY=value lines (no spaces around =, key is ALL_CAPS + underscores)
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && pending.has(match[1])) {
      pending.delete(match[1]);
      return match[1] + '=' + updates[match[1]];
    }
    return line;
  });

  // Append any keys not found in the file
  for (const key of pending) {
    updated.push(key + '=' + updates[key]);
  }

  writeFileSync(envPath, updated.join('\n'), 'utf8');
}
```

**Step 4: Run test — verify it passes**

```bash
bun test tests/unit/env-writer.test.js
```
Expected: 5 PASS.

**Step 5: Commit**

```bash
git add server/env-writer.js tests/unit/env-writer.test.js
git commit -m "feat: safe in-place .env updater (env-writer.js)"
```

---

## Task 3: Add reinitializeSource() to the registry

**Files:**
- Modify: `server/data-source-registry.js:192-218` (after `testConnection`, before closing brace)

**Step 1: Add the method**

In `server/data-source-registry.js`, find the `testConnection` method (line ~192) and add `reinitializeSource` immediately after it, before `getAvailableMetrics`:

```js
  /**
   * Re-initialize a single data source after credential changes.
   * Resets connection state then calls initialize() again so it picks
   * up new process.env values without a full server restart.
   */
  async reinitializeSource(sourceName) {
    const source = this.getSource(sourceName);
    source.isConnected = false;
    source.lastError   = null;
    await source.initialize();
    logger.info({ sourceName, isConnected: source.isConnected }, 'Data source reinitialized');
    return source;
  }
```

**Step 2: Run the full test suite to confirm nothing broke**

```bash
bun test tests/unit tests/integration tests/helpers tests/components 2>&1 | tail -4
```
Expected: 1532 pass, 0 fail.

**Step 3: Commit**

```bash
git add server/data-source-registry.js
git commit -m "feat: add reinitializeSource() to data source registry"
```

---

## Task 4: Add PUT /api/data-sources/:name/credentials endpoint

**Files:**
- Modify: `server/index.js` — add import and new route after line 707 (after the PUT /api/data-sources/:name/config route)

**Step 1: Add imports near the top of server/index.js**

Find the block of imports at the top. Add:

```js
import { updateEnvVars }   from './env-writer.js';
import { ENV_MAP }         from './data-source-env-map.js';
```

**Step 2: Add the route in server/index.js after the PUT /api/data-sources/:name/config route (line 707)**

```js
  // Save credentials to .env and hot-reload the data source
  .put('/api/data-sources/:name/credentials', async ({ params, body }) => {
    try {
      const { name } = params;
      const allowed  = ENV_MAP[name];

      if (!allowed) {
        return new Response(
          JSON.stringify({ success: false, error: `No credential map for source: ${name}` }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }

      // Validate all incoming keys against the whitelist
      for (const key of Object.keys(body)) {
        if (!allowed[key]) {
          return new Response(
            JSON.stringify({ success: false, error: `Unknown credential key: ${key}` }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }
      }

      // Skip blank values (allow partial updates)
      const updates = Object.fromEntries(
        Object.entries(body).filter(([, v]) => typeof v === 'string' && v.trim() !== '')
      );

      if (Object.keys(updates).length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No credentials provided' }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }

      // Write to .env file then apply to running process
      updateEnvVars(updates);
      for (const [k, v] of Object.entries(updates)) {
        process.env[k] = v;
      }

      // Re-initialize the data source so it picks up the new env vars
      const source = await dataSourceRegistry.reinitializeSource(name);

      return {
        success:   true,
        connected: source.isConnected,
        message:   source.lastError?.message || null,
      };
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to save credentials');
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    body: t.Record(t.String(), t.String()),
    response: {
      200: t.Object({ success: t.Boolean(), connected: t.Boolean(), message: t.Optional(t.Nullable(t.String())) }),
      400: 'common.error',
      500: 'common.error',
    },
    detail: { tags: ['data-sources'], summary: 'Save credentials to .env and hot-reload data source' },
  })
```

**Step 3: Run the full test suite**

```bash
bun test tests/unit tests/integration tests/helpers tests/components 2>&1 | tail -4
```
Expected: 1532+ pass, 0 fail.

**Step 4: Smoke test the endpoint**

```bash
curl -s -X PUT http://tv:3000/api/data-sources/datadog/credentials \
  -H "Content-Type: application/json" \
  -d '{"DATADOG_API_KEY":"test123"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success'), d.get('connected'))"
```
Expected: `True False` (saved, not connected because test key is fake).

**Step 5: Commit**

```bash
git add server/index.js
git commit -m "feat: PUT /api/data-sources/:name/credentials — save to .env, hot-reload source"
```

---

## Task 5: Fix DD_API_KEY → DATADOG_API_KEY mismatch in .env

**Files:**
- Modify: `.env`

`datadog.js` reads `process.env.DATADOG_API_KEY` and `process.env.DATADOG_APP_KEY` but `.env` has `DD_API_KEY` and `DD_APP_KEY`. Fix the `.env` file so the keys match what the code actually reads.

**Step 1: Update .env**

Find in `.env`:
```
# Datadog API
DD_API_KEY=
DD_APP_KEY=
DD_SITE=datadoghq.com
```

Replace with:
```
# Datadog API
DATADOG_API_KEY=
DATADOG_APP_KEY=
DD_SITE=datadoghq.com
```

**Step 2: Verify the server still starts**

```bash
bun run server/index.js &
sleep 2
curl -s http://tv:3000/health | python3 -c "import sys,json; print(json.load(sys.stdin).get('status'))"
kill %1
```
Expected: `healthy`

**Step 3: Commit**

```bash
git add .env
git commit -m "fix: rename DD_API_KEY/DD_APP_KEY to DATADOG_API_KEY/DATADOG_APP_KEY to match datadog.js"
```

---

## Task 6: Update studio.html — add Save button

**Files:**
- Modify: `public/studio.html` (lines 335-339, the `#datasource-editor-panel` actions div)

**Step 1: Replace the actions div**

Find:
```html
        <div id="dse-fields" class="dse-fields"></div>
        <div class="qe-actions">
          <button id="dse-test" class="studio-btn secondary small">&#9654; Test Connection</button>
          <span id="dse-test-result" class="qe-run-status"></span>
        </div>
```

Replace with:
```html
        <div id="dse-fields" class="dse-fields"></div>
        <div class="qe-actions">
          <button id="dse-save" class="studio-btn primary small">Save Credentials</button>
          <button id="dse-test" class="studio-btn secondary small">&#9654; Test Connection</button>
          <span id="dse-test-result" class="qe-run-status"></span>
        </div>
```

**Step 2: Bump studio.js version** (so the browser picks up the JS changes in Task 7):

Find `<script src="/js/studio.js?v=6">` and change to `?v=7`.

**Step 3: Commit**

```bash
git add public/studio.html
git commit -m "feat: add Save Credentials button to datasource editor panel"
```

---

## Task 7: Update studio.js — populate envVar on inputs + Save handler

**Files:**
- Modify: `public/js/studio.js` — two changes inside `openDatasourceEditor`

**Change 1: Populate `dataset.envVar` when building credential inputs**

In `openDatasourceEditor`, find the line that creates the input element inside the `schema.fields.forEach` loop. It currently looks like:

```js
input.dataset.field = field.name;
```

Add immediately after it:
```js
input.dataset.envVar = field.envVar || '';
```

**Change 2: Add Save handler**

In `openDatasourceEditor`, after the existing `dse-test` onclick handler, add:

```js
    document.getElementById('dse-save').onclick = async () => {
      const saveBtn  = document.getElementById('dse-save');
      const resultEl = document.getElementById('dse-test-result');
      const inputs   = document.querySelectorAll('#dse-fields input[data-field]');

      // Collect non-empty fields that have an envVar mapping
      const body = {};
      inputs.forEach(input => {
        if (input.value.trim() && input.dataset.envVar) {
          body[input.dataset.envVar] = input.value.trim();
        }
      });

      if (!Object.keys(body).length) {
        resultEl.textContent = 'No credentials entered';
        resultEl.style.color = 'var(--amber)';
        return;
      }

      saveBtn.setAttribute('disabled', '');
      resultEl.textContent = 'Saving\u2026';
      resultEl.style.color = 'var(--t3)';

      try {
        const res  = await fetch('/api/data-sources/' + encodeURIComponent(src.name) + '/credentials', {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
          resultEl.textContent = '\u2717 ' + (data.error || 'Save failed');
          resultEl.style.color = 'var(--red)';
          return;
        }

        if (data.connected) {
          resultEl.textContent = '\u2713 Saved and connected';
          resultEl.style.color = 'var(--green)';
        } else {
          resultEl.textContent = '\u2713 Saved \u2014 ' + (data.message || 'not yet connected');
          resultEl.style.color = 'var(--amber)';
        }

        // Clear password fields after save (don't leave secrets in DOM)
        inputs.forEach(input => {
          if (input.type === 'password') input.value = '';
        });

        // Refresh the sidebar status dots
        this.renderDatasourceList();
      } catch (e) {
        resultEl.textContent = '\u2717 ' + e.message;
        resultEl.style.color = 'var(--red)';
      } finally {
        saveBtn.removeAttribute('disabled');
      }
    };
```

**Step 1: Apply both changes to studio.js**

**Step 2: Run full test suite**

```bash
bun test tests/unit tests/integration tests/helpers tests/components 2>&1 | tail -4
```
Expected: 1532+ pass, 0 fail.

**Step 3: Commit**

```bash
git add public/js/studio.js
git commit -m "feat: populate envVar on credential inputs, add Save handler in studio"
```

---

## Task 8: Integration test for the credentials endpoint

**Files:**
- Create: `tests/integration/credentials-endpoint.test.js`

**Step 1: Write the test**

```js
// tests/integration/credentials-endpoint.test.js
import { describe, it, expect, beforeAll } from 'bun:test';

let app;
beforeAll(async () => {
  const mod = await import('../../server/index.js');
  app = mod.app;
});

describe('PUT /api/data-sources/:name/credentials', () => {
  it('rejects unknown source name', async () => {
    const res = await app.handle(new Request('http://localhost/api/data-sources/notareal/credentials', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ SOME_KEY: 'val' }),
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('notareal');
  });

  it('rejects unknown credential key for a known source', async () => {
    const res = await app.handle(new Request('http://localhost/api/data-sources/datadog/credentials', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ SESSION_SECRET: 'hack' }),
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('SESSION_SECRET');
  });

  it('rejects empty body (all blank values)', async () => {
    const res = await app.handle(new Request('http://localhost/api/data-sources/datadog/credentials', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ DATADOG_API_KEY: '' }),
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('accepts valid whitelisted key and returns success + connected status', async () => {
    // Using 'vulntrack' which we know is already configured and connected
    // We send the same API key that is already in .env — no change in effect
    const currentKey = process.env.VULNTRACK_API_KEY;
    if (!currentKey) return; // skip if not configured in test env

    const res = await app.handle(new Request('http://localhost/api/data-sources/vulntrack/credentials', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ VULNTRACK_API_KEY: currentKey }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(typeof data.connected).toBe('boolean');
  });
});
```

**Step 2: Run the test**

```bash
bun test tests/integration/credentials-endpoint.test.js
```
Expected: 4 PASS (or 3 if VULNTRACK_API_KEY not set in test env — that's fine).

**Step 3: Run full suite**

```bash
bun test tests/unit tests/integration tests/helpers tests/components 2>&1 | tail -4
```
Expected: all pass.

**Step 4: Commit**

```bash
git add tests/integration/credentials-endpoint.test.js
git commit -m "test: integration tests for PUT /api/data-sources/:name/credentials"
```

---

## Task 9: PR

**Step 1: Push and create PR**

```bash
git checkout -b feat/credentials-writeback
git push -u origin feat/credentials-writeback
gh pr create \
  --title "feat: save data source credentials from studio UI to .env with hot-reload" \
  --body "Adds Save Credentials button to the studio Sources tab. Credentials are written to .env and the data source is hot-reloaded — no SSH or server restart required. A per-source whitelist prevents writing arbitrary env vars (SESSION_SECRET etc. are untouched)."
```
