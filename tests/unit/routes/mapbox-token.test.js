// ===========================================================================
// Mapbox Token Route Tests
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';

describe('GET /api/config/mapbox-token', () => {
  let savedToken;

  beforeEach(() => {
    savedToken = process.env.MAPBOX_ACCESS_TOKEN;
  });

  afterEach(() => {
    if (savedToken !== undefined) {
      process.env.MAPBOX_ACCESS_TOKEN = savedToken;
    } else {
      delete process.env.MAPBOX_ACCESS_TOKEN;
    }
  });

  it('returns the token from MAPBOX_ACCESS_TOKEN env var', async () => {
    process.env.MAPBOX_ACCESS_TOKEN = 'pk.test-token-abc123';

    const app = new Elysia()
      .get('/api/config/mapbox-token', () => ({
        token: process.env.MAPBOX_ACCESS_TOKEN || ''
      }));

    const res = await app.handle(
      new Request('http://localhost/api/config/mapbox-token')
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBe('pk.test-token-abc123');
  });

  it('returns empty string when MAPBOX_ACCESS_TOKEN is not set', async () => {
    delete process.env.MAPBOX_ACCESS_TOKEN;

    const app = new Elysia()
      .get('/api/config/mapbox-token', () => ({
        token: process.env.MAPBOX_ACCESS_TOKEN || ''
      }));

    const res = await app.handle(
      new Request('http://localhost/api/config/mapbox-token')
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBe('');
  });

  it('returns a JSON response with exactly a token field', async () => {
    process.env.MAPBOX_ACCESS_TOKEN = 'sk.test';

    const app = new Elysia()
      .get('/api/config/mapbox-token', () => ({
        token: process.env.MAPBOX_ACCESS_TOKEN || ''
      }));

    const res = await app.handle(
      new Request('http://localhost/api/config/mapbox-token')
    );

    const data = await res.json();
    expect(Object.keys(data)).toEqual(['token']);
  });
});
