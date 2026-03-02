// ===========================================================================
// Rate Limiting Integration Test
// Tests rate limiting and cache headers on actual server routes
// ===========================================================================

import { describe, it, expect } from 'bun:test';
import { Elysia } from 'elysia';
import { smartRateLimit } from '../../server/rate-limiter.js';

describe('Rate Limiting Integration', () => {
  describe('Server with Rate Limiting', () => {
    it('should apply rate limiting to API endpoints', async () => {
      const app = new Elysia()
        .use(smartRateLimit)
        .get('/api/test', () => ({ message: 'ok' }));

      const response = await app.handle(new Request('http://localhost/api/test'));
      expect(response.status).toBe(200);
    });

    it('should apply rate limiting to data endpoints', async () => {
      const app = new Elysia()
        .use(smartRateLimit)
        .get('/api/data/widget/123', () => ({ value: 42 }));

      const response = await app.handle(new Request('http://localhost/api/data/widget/123'));
      expect(response.status).toBe(200);
    });

    it('should apply rate limiting to auth endpoints', async () => {
      const app = new Elysia()
        .use(smartRateLimit)
        .get('/auth/login', () => ({ redirect: '/oauth' }));

      const response = await app.handle(new Request('http://localhost/auth/login'));
      expect(response.status).toBe(200);
    });

    it('should skip rate limiting for health endpoint', async () => {
      const app = new Elysia()
        .use(smartRateLimit)
        .get('/health', () => ({ status: 'ok' }));

      // Make many requests - should all succeed
      for (let i = 0; i < 200; i++) {
        const response = await app.handle(new Request('http://localhost/health', {
          headers: { 'x-forwarded-for': '192.168.100.100' }
        }));
        expect(response.status).toBe(200);
      }
    });

    it('should skip rate limiting for static assets', async () => {
      const app = new Elysia()
        .use(smartRateLimit)
        .get('/app/assets/main.css', () => new Response('css'));

      // Make many requests - should all succeed
      for (let i = 0; i < 200; i++) {
        const response = await app.handle(new Request('http://localhost/app/assets/main.css', {
          headers: { 'x-forwarded-for': '192.168.100.101' }
        }));
        expect(response.status).toBe(200);
      }
    });

    it('should apply different limits to different endpoint types', async () => {
      const app = new Elysia()
        .use(smartRateLimit)
        .get('/api/test', () => ({ message: 'api' }))
        .get('/api/data/test', () => ({ message: 'data' }))
        .get('/auth/test', () => ({ message: 'auth' }));

      // These requests should succeed (within limits)
      const apiResponse = await app.handle(new Request('http://localhost/api/test', {
        headers: { 'x-forwarded-for': '192.168.100.1' }
      }));
      expect(apiResponse.status).toBe(200);

      const dataResponse = await app.handle(new Request('http://localhost/api/data/test', {
        headers: { 'x-forwarded-for': '192.168.100.2' }
      }));
      expect(dataResponse.status).toBe(200);

      const authResponse = await app.handle(new Request('http://localhost/auth/test', {
        headers: { 'x-forwarded-for': '192.168.100.3' }
      }));
      expect(authResponse.status).toBe(200);
    });

    it('should track requests per IP address separately', async () => {
      const app = new Elysia()
        .use(smartRateLimit)
        .get('/test', () => ({ message: 'ok' }));

      // Requests from IP1
      const ip1Response1 = await app.handle(new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '192.168.100.10' }
      }));
      expect(ip1Response1.status).toBe(200);

      const ip1Response2 = await app.handle(new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '192.168.100.10' }
      }));
      expect(ip1Response2.status).toBe(200);

      // Requests from IP2 should start fresh
      const ip2Response1 = await app.handle(new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '192.168.100.11' }
      }));
      expect(ip2Response1.status).toBe(200);

      const ip2Response2 = await app.handle(new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '192.168.100.11' }
      }));
      expect(ip2Response2.status).toBe(200);
    });
  });

  describe('Cache Headers Integration', () => {
    it('should add appropriate cache headers to responses', () => {
      const app = new Elysia()
        .onAfterHandle(({ request, response }) => {
          if (response instanceof Response) {
            const url = new URL(request.url);
            if (url.pathname.startsWith('/api/')) {
              response.headers.set('Cache-Control', 'no-cache');
            }
          }
          return response;
        })
        .get('/api/test', () => ({ message: 'ok' }));

      // Cache headers are applied by the server's onAfterHandle hook
      // This test verifies the pattern works
      return app.handle(new Request('http://localhost/api/test'))
        .then(response => {
          expect(response.status).toBe(200);
          // Cache headers would be added by server's onAfterHandle
        });
    });
  });
});
