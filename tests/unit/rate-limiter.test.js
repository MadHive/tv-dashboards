// ===========================================================================
// Rate Limiter Tests — Verify rate limiting configuration and cache headers
// ===========================================================================

import { describe, it, expect } from 'bun:test';
import { getRateLimitConfig, addCacheHeaders, cachePresets } from '../../server/rate-limiter.js';

describe('Rate Limiter', () => {
  describe('Configuration', () => {
    it('should load rate limit config from environment', () => {
      const config = getRateLimitConfig();

      expect(config).toBeDefined();
      expect(config.api).toBeDefined();
      expect(config.data).toBeDefined();
      expect(config.auth).toBeDefined();

      expect(config.api.max).toBeGreaterThan(0);
      expect(config.api.duration).toBe(60000);
    });

    it('should have correct default limits', () => {
      const config = getRateLimitConfig();

      // Default values (or from env vars)
      expect(config.api.max).toBeGreaterThanOrEqual(10);
      expect(config.data.max).toBeGreaterThanOrEqual(10);
      expect(config.auth.max).toBeGreaterThanOrEqual(10);

      // All should use 1 minute duration
      expect(config.api.duration).toBe(60000);
      expect(config.data.duration).toBe(60000);
      expect(config.auth.duration).toBe(60000);
    });

    it('should have stricter limits for auth than data', () => {
      const config = getRateLimitConfig();
      expect(config.auth.max).toBeLessThanOrEqual(config.data.max);
    });

    it('should have stricter limits for data than API', () => {
      const config = getRateLimitConfig();
      expect(config.data.max).toBeLessThanOrEqual(config.api.max);
    });
  });

  describe('Cache Headers', () => {
    it('should add cache headers to response', () => {
      const response = new Response('test', {
        headers: { 'content-type': 'text/plain' }
      });

      const cachedResponse = addCacheHeaders(response, { maxAge: 3600 });

      expect(cachedResponse).toBeInstanceOf(Response);
      expect(cachedResponse.headers.get('cache-control')).toBe('max-age=3600');
    });

    it('should add no-cache headers', () => {
      const response = new Response('test');
      const cachedResponse = addCacheHeaders(response, { noCache: true });

      expect(cachedResponse.headers.get('cache-control')).toBe('no-cache, no-store');
    });

    it('should add immutable directive', () => {
      const response = new Response('test');
      const cachedResponse = addCacheHeaders(response, { maxAge: 3600, immutable: true });

      const cacheControl = cachedResponse.headers.get('cache-control');
      expect(cacheControl).toContain('max-age=3600');
      expect(cacheControl).toContain('immutable');
    });

    it('should add must-revalidate directive', () => {
      const response = new Response('test');
      const cachedResponse = addCacheHeaders(response, { maxAge: 60, mustRevalidate: true });

      const cacheControl = cachedResponse.headers.get('cache-control');
      expect(cacheControl).toContain('max-age=60');
      expect(cacheControl).toContain('must-revalidate');
    });

    it('should combine multiple directives correctly', () => {
      const response = new Response('test');
      const cachedResponse = addCacheHeaders(response, {
        maxAge: 3600,
        immutable: true,
        mustRevalidate: true
      });

      const cacheControl = cachedResponse.headers.get('cache-control');
      expect(cacheControl).toContain('max-age=3600');
      expect(cacheControl).toContain('immutable');
      expect(cacheControl).toContain('must-revalidate');
    });

    it('should not modify non-Response objects', () => {
      const obj = { test: 'value' };
      const result = addCacheHeaders(obj, { maxAge: 3600 });

      expect(result).toBe(obj);
      expect(result).toEqual({ test: 'value' });
    });

    it('should preserve existing response body and status', () => {
      const originalBody = 'test content';
      const response = new Response(originalBody, {
        status: 201,
        statusText: 'Created',
        headers: { 'content-type': 'text/plain' }
      });

      const cachedResponse = addCacheHeaders(response, { maxAge: 3600 });

      expect(cachedResponse.status).toBe(201);
      expect(cachedResponse.statusText).toBe('Created');
      expect(cachedResponse.headers.get('content-type')).toBe('text/plain');
    });

    it('should return response unchanged if no cache options provided', () => {
      const response = new Response('test');
      const cachedResponse = addCacheHeaders(response, {});

      expect(cachedResponse).toBeInstanceOf(Response);
      expect(cachedResponse.headers.get('cache-control')).toBeNull();
    });
  });

  describe('Cache Presets', () => {
    it('should have static asset preset', () => {
      expect(cachePresets.static).toEqual({ maxAge: 3600, immutable: true });
    });

    it('should have API preset', () => {
      expect(cachePresets.api).toEqual({ noCache: true });
    });

    it('should have dashboard preset', () => {
      expect(cachePresets.dashboard).toEqual({ maxAge: 60, mustRevalidate: true });
    });

    it('should have HTML preset', () => {
      expect(cachePresets.html).toEqual({ noCache: true });
    });

    it('should have short-lived preset', () => {
      expect(cachePresets.shortLived).toEqual({ maxAge: 5 });
    });

    it('should work with addCacheHeaders', () => {
      const response = new Response('test');
      const cachedResponse = addCacheHeaders(response, cachePresets.static);

      const cacheControl = cachedResponse.headers.get('cache-control');
      expect(cacheControl).toContain('max-age=3600');
      expect(cacheControl).toContain('immutable');
    });
  });

  describe('Rate Limit Environment Variables', () => {
    it('should respect RATE_LIMIT_API environment variable if set', () => {
      const config = getRateLimitConfig();

      // Should either be default (100) or custom value from env
      expect(config.api.max).toBeGreaterThanOrEqual(10);

      if (process.env.RATE_LIMIT_API) {
        expect(config.api.max).toBe(parseInt(process.env.RATE_LIMIT_API));
      }
    });

    it('should respect RATE_LIMIT_DATA environment variable if set', () => {
      const config = getRateLimitConfig();

      expect(config.data.max).toBeGreaterThanOrEqual(10);

      if (process.env.RATE_LIMIT_DATA) {
        expect(config.data.max).toBe(parseInt(process.env.RATE_LIMIT_DATA));
      }
    });

    it('should respect RATE_LIMIT_AUTH environment variable if set', () => {
      const config = getRateLimitConfig();

      expect(config.auth.max).toBeGreaterThanOrEqual(10);

      if (process.env.RATE_LIMIT_AUTH) {
        expect(config.auth.max).toBe(parseInt(process.env.RATE_LIMIT_AUTH));
      }
    });
  });
});
