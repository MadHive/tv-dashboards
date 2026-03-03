// ===========================================================================
// Integration: OpenAPI spec validation
// Verifies the spec endpoint returns a valid OpenAPI 3.x document with the
// expected tags and that key routes carry request/response schemas.
// Spec is served at /openapi/json by @elysiajs/openapi (default path).
// ===========================================================================

import { describe, it, expect, beforeAll } from 'bun:test';

let app;
beforeAll(async () => {
  const mod = await import('../../server/index.js');
  app = mod.app;
});

describe('OpenAPI spec', () => {
  it('GET /openapi/json returns valid OpenAPI 3.x spec', async () => {
    const res = await app.handle(new Request('http://localhost/openapi/json'));
    expect(res.status).toBe(200);
    const spec = await res.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBe('MadHive TV Dashboards API');
    expect(spec.paths).toBeDefined();
  });

  it('spec includes all required tag groups', async () => {
    const res = await app.handle(new Request('http://localhost/openapi/json'));
    const spec = await res.json();
    const tagNames = (spec.tags || []).map(t => t.name);
    for (const required of ['health', 'dashboards', 'data-sources', 'queries', 'templates', 'themes', 'metrics', 'tv-apps', 'auth']) {
      expect(tagNames).toContain(required);
    }
  });

  it('POST /api/dashboards has a requestBody schema defined', async () => {
    const res = await app.handle(new Request('http://localhost/openapi/json'));
    const spec = await res.json();
    const route = spec.paths?.['/api/dashboards']?.post;
    expect(route).toBeDefined();
    expect(route.requestBody).toBeDefined();
    expect(route.requestBody.content?.['application/json']?.schema).toBeDefined();
  });

  it('POST /api/dashboards has response schemas defined', async () => {
    const res = await app.handle(new Request('http://localhost/openapi/json'));
    const spec = await res.json();
    const route = spec.paths?.['/api/dashboards']?.post;
    expect(route.responses).toBeDefined();
    expect(Object.keys(route.responses).length).toBeGreaterThan(0);
  });
});
