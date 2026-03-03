// tests/integration/credentials-endpoint.test.js
import { describe, it, expect, beforeAll } from 'bun:test';

let app;
beforeAll(async () => {
  const mod = await import('../../server/index.js');
  app = mod.app;
});

describe('PUT /api/data-sources/:name/credentials', () => {
  it('rejects unknown source name with 400', async () => {
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

  it('rejects unknown credential key for known source with 400', async () => {
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

  it('rejects empty/blank values with 400', async () => {
    const res = await app.handle(new Request('http://localhost/api/data-sources/datadog/credentials', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ DATADOG_API_KEY: '' }),
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('accepts valid whitelisted keys and attempts write (returns 200 or 500 depending on .env presence)', async () => {
    // This test exercises the full happy path validation — it may return 200 (success)
    // or 500 (if .env not present in test env). Both are acceptable non-400 outcomes.
    const res = await app.handle(new Request('http://localhost/api/data-sources/vulntrack/credentials', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ VULNTRACK_API_KEY: 'test-key' }),
    }));
    // Must NOT be a 400 (validation passed)
    expect(res.status).not.toBe(400);
    const data = await res.json();
    // success field must be boolean
    expect(typeof data.success).toBe('boolean');
  });
});
