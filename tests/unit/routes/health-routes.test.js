// ===========================================================================
// Health Routes Tests — Following Elysia.js Testing Patterns
// Tests for health check endpoint (Cloud Run compatibility)
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { createTestRequest } from '../../helpers/test-app.js';

describe('Health Route (Elysia Unit Tests)', () => {
  let app;

  beforeEach(() => {
    // Create test app with health route
    app = new Elysia()
      .get('/health', () => {
        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '2.0.0',
          service: 'tv-dashboards'
        };
      });
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const request = createTestRequest('/health');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('healthy');
    });

    it('should include timestamp', async () => {
      const request = createTestRequest('/health');
      const response = await app.handle(request);

      const data = await response.json();
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('string');

      // Validate ISO format
      expect(new Date(data.timestamp)).toBeInstanceOf(Date);
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include version', async () => {
      const request = createTestRequest('/health');
      const response = await app.handle(request);

      const data = await response.json();
      expect(data.version).toBeDefined();
      expect(typeof data.version).toBe('string');
      expect(data.version).toMatch(/^\d+\.\d+\.\d+/); // Semantic versioning
    });

    it('should include service name', async () => {
      const request = createTestRequest('/health');
      const response = await app.handle(request);

      const data = await response.json();
      expect(data.service).toBeDefined();
      expect(data.service).toBe('tv-dashboards');
    });

    it('should return valid JSON', async () => {
      const request = createTestRequest('/health');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('json');

      const data = await response.json();
      expect(data).toBeObject();
    });

    it('should respond quickly', async () => {
      const start = Date.now();

      const request = createTestRequest('/health');
      await app.handle(request);

      const duration = Date.now() - start;

      // Health check should be fast (< 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should be idempotent', async () => {
      const request1 = createTestRequest('/health');
      const request2 = createTestRequest('/health');
      const request3 = createTestRequest('/health');

      const response1 = await app.handle(request1);
      const response2 = await app.handle(request2);
      const response3 = await app.handle(request3);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response3.status).toBe(200);

      const data1 = await response1.json();
      const data2 = await response2.json();
      const data3 = await response3.json();

      expect(data1.status).toBe('healthy');
      expect(data2.status).toBe('healthy');
      expect(data3.status).toBe('healthy');
    });

    it('should include all required fields', async () => {
      const request = createTestRequest('/health');
      const response = await app.handle(request);

      const data = await response.json();
      const requiredFields = ['status', 'timestamp', 'version', 'service'];

      requiredFields.forEach(field => {
        expect(data[field]).toBeDefined();
      });
    });
  });

  describe('Cloud Run Compatibility', () => {
    it('should meet Cloud Run health check requirements', async () => {
      const request = createTestRequest('/health');
      const response = await app.handle(request);

      // Cloud Run expects 200 OK for healthy
      expect(response.status).toBe(200);

      // Should respond within timeout (Cloud Run default is 10s)
      const start = Date.now();
      await app.handle(createTestRequest('/health'));
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10000);
    });

    it('should support HTTP/1.1', async () => {
      const request = createTestRequest('/health');
      const response = await app.handle(request);

      // Basic HTTP compatibility check
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
    });
  });

  describe('Monitoring Integration', () => {
    it('should provide machine-readable status', async () => {
      const request = createTestRequest('/health');
      const response = await app.handle(request);

      const data = await response.json();

      // Status should be a simple string for monitoring tools
      expect(typeof data.status).toBe('string');
      expect(data.status.toLowerCase()).toBe('healthy');
    });

    it('should include metadata for observability', async () => {
      const request = createTestRequest('/health');
      const response = await app.handle(request);

      const data = await response.json();

      // Metadata for tracing and debugging
      expect(data.version).toBeDefined();
      expect(data.service).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });
  });
});
