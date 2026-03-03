// ===========================================================================
// Swagger Route Tests — Verify OpenAPI documentation is served
// ===========================================================================

import { describe, it, expect } from 'bun:test';
import Elysia from 'elysia';
import { openapi } from '@elysiajs/openapi';

describe('Swagger Plugin', () => {
  it('should mount Swagger UI at /openapi', async () => {
    const app = new Elysia().use(openapi());
    const response = await app.handle(new Request('http://localhost/openapi'));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('api-reference');
  });

  it('should serve OpenAPI JSON at /openapi/json', async () => {
    const app = new Elysia().use(openapi());
    const response = await app.handle(new Request('http://localhost/openapi/json'));
    expect(response.status).toBe(200);
    const spec = await response.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info).toBeDefined();
  });
});
