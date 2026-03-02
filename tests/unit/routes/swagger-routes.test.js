// ===========================================================================
// Swagger Route Tests — Verify OpenAPI documentation is served
// ===========================================================================

import { describe, it, expect } from 'bun:test';
import Elysia from 'elysia';
import { swagger } from '@elysiajs/swagger';

describe('Swagger Plugin', () => {
  it('should mount Swagger UI at /swagger', async () => {
    const app = new Elysia().use(swagger());
    const response = await app.handle(new Request('http://localhost/swagger'));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('swagger');
  });

  it('should serve OpenAPI JSON at /swagger/json', async () => {
    const app = new Elysia().use(swagger());
    const response = await app.handle(new Request('http://localhost/swagger/json'));
    expect(response.status).toBe(200);
    const spec = await response.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info).toBeDefined();
  });
});
