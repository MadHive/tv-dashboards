// ===========================================================================
// Test App Helper — Create isolated Elysia instances for testing
// Following Elysia.js best practices for test isolation
// ===========================================================================

import { Elysia } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { cors } from '@elysiajs/cors';

/**
 * Create a fresh Elysia instance for testing
 * Prevents state bleeding between tests
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.withCors - Include CORS plugin (default: false)
 * @param {boolean} options.withCookie - Include cookie plugin (default: false)
 * @returns {Elysia} Fresh Elysia instance
 */
export function createTestApp(options = {}) {
  const {
    withCors = false,
    withCookie = false
  } = options;

  let app = new Elysia();

  if (withCors) {
    app = app.use(cors());
  }

  if (withCookie) {
    app = app.use(cookie());
  }

  return app;
}

/**
 * Create test request helper
 * Simplifies creating Request objects for .handle() testing
 *
 * @param {string} url - Request URL (can be relative like '/api/config')
 * @param {Object} options - Fetch API options
 * @returns {Request} Request object
 */
export function createTestRequest(url, options = {}) {
  // Convert relative URLs to full URLs for Request constructor
  const fullUrl = url.startsWith('http')
    ? url
    : `http://localhost${url.startsWith('/') ? '' : '/'}${url}`;

  return new Request(fullUrl, options);
}

/**
 * Helper to create JSON POST request
 */
export function createJsonPostRequest(url, body) {
  return createTestRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

/**
 * Helper to create JSON PUT request
 */
export function createJsonPutRequest(url, body) {
  return createTestRequest(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

/**
 * Helper to create DELETE request
 */
export function createDeleteRequest(url) {
  return createTestRequest(url, {
    method: 'DELETE'
  });
}

/**
 * Test response assertions
 * Common assertion helpers for testing Elysia responses
 */
export const assertResponse = {
  /**
   * Assert response is successful JSON
   */
  async assertJson(response, expectedStatus = 200) {
    if (response.status !== expectedStatus) {
      const text = await response.text();
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}: ${text}`);
    }
    return response.json();
  },

  /**
   * Assert response is error
   */
  async assertError(response, expectedStatus = 400) {
    if (response.status !== expectedStatus) {
      throw new Error(`Expected error status ${expectedStatus}, got ${response.status}`);
    }
    const data = await response.json();
    if (data.success !== false) {
      throw new Error('Expected success: false in error response');
    }
    return data;
  },

  /**
   * Assert response is successful operation
   */
  async assertSuccess(response) {
    const data = await this.assertJson(response, 200);
    if (data.success !== true) {
      throw new Error(`Expected success: true, got: ${JSON.stringify(data)}`);
    }
    return data;
  }
};

/**
 * Create test context for isolated file operations
 * Returns helper to clean up test files
 */
export function createTestContext(testName) {
  const cleanupFns = [];

  return {
    /**
     * Register cleanup function
     */
    cleanup(fn) {
      cleanupFns.push(fn);
    },

    /**
     * Run all cleanup functions
     */
    async destroy() {
      for (const fn of cleanupFns) {
        try {
          await fn();
        } catch (error) {
          console.warn(`Cleanup error in ${testName}:`, error.message);
        }
      }
    }
  };
}
