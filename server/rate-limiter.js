// ===========================================================================
// Rate Limiter Utility — IP-based rate limiting with configurable limits
// Following Elysia.js best practices for middleware composition
// ===========================================================================

import { rateLimit } from 'elysia-rate-limit';

/**
 * Rate limit configuration from environment variables
 * Allows runtime configuration without code changes
 */
const config = {
  api: {
    max: parseInt(process.env.RATE_LIMIT_API || '100', 10),
    duration: 60000, // 1 minute
  },
  data: {
    max: parseInt(process.env.RATE_LIMIT_DATA || '60', 10),
    duration: 60000, // 1 minute
  },
  auth: {
    max: parseInt(process.env.RATE_LIMIT_AUTH || '10', 10),
    duration: 60000, // 1 minute
  },
};

/**
 * Extract client IP from request
 * Supports proxied requests with X-Forwarded-For header
 *
 * @param {Request} request - Incoming request
 * @returns {string} Client IP address
 */
function getClientKey(request) {
  // Check X-Forwarded-For header first (for proxied requests)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  // Check X-Real-IP header (nginx)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to connection remote address
  // Note: In Elysia/Bun, we don't have direct access to socket,
  // so we use a placeholder that the rate limiter will handle
  return 'unknown';
}

/**
 * Add rate limit headers to response
 * Following standard rate limit header naming conventions
 *
 * @param {Response} response - Response object
 * @param {Object} context - Rate limit context
 * @param {number} context.limit - Maximum requests allowed
 * @param {number} context.remaining - Remaining requests
 * @param {number} context.reset - Unix timestamp when limit resets
 * @returns {Response} Response with rate limit headers
 */
function addRateLimitHeaders(response, { limit, remaining, reset }) {
  if (!(response instanceof Response)) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', String(limit));
  headers.set('X-RateLimit-Remaining', String(Math.max(0, remaining)));
  headers.set('X-RateLimit-Reset', String(reset));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Create rate limiter for API endpoints (/api/*)
 * 100 requests per minute per IP (configurable via RATE_LIMIT_API)
 */
export const apiRateLimit = rateLimit({
  max: config.api.max,
  duration: config.api.duration,
  generator: getClientKey,
  errorResponse: new Response(
    JSON.stringify({ error: 'Too many requests, please try again later.' }),
    { status: 429, headers: { 'content-type': 'application/json' } }
  ),
  countFailedRequest: true, // Count failed requests toward limit
  headers: true, // Add X-RateLimit-* headers
  skip: (request) => {
    // Skip rate limiting for health check endpoint
    const url = new URL(request.url);
    return url.pathname === '/health';
  },
});

/**
 * Create rate limiter for data endpoints (/api/data/*)
 * 60 requests per minute per IP (configurable via RATE_LIMIT_DATA)
 */
export const dataRateLimit = rateLimit({
  max: config.data.max,
  duration: config.data.duration,
  generator: getClientKey,
  errorResponse: new Response(
    JSON.stringify({ error: 'Too many data requests, please try again later.' }),
    { status: 429, headers: { 'content-type': 'application/json' } }
  ),
  countFailedRequest: true,
  headers: true,
});

/**
 * Create rate limiter for auth endpoints (/auth/*)
 * 10 requests per minute per IP (configurable via RATE_LIMIT_AUTH)
 */
export const authRateLimit = rateLimit({
  max: config.auth.max,
  duration: config.auth.duration,
  generator: getClientKey,
  errorResponse: new Response(
    JSON.stringify({ error: 'Too many authentication attempts, please try again later.' }),
    { status: 429, headers: { 'content-type': 'application/json' } }
  ),
  countFailedRequest: true,
  headers: true,
});

/**
 * Custom rate limiter with flexible configuration
 * Use this for endpoints that need custom limits
 *
 * @param {Object} options - Rate limit options
 * @param {number} options.max - Maximum requests allowed
 * @param {number} options.duration - Time window in milliseconds
 * @param {string} options.message - Custom error message
 * @returns {Function} Elysia plugin
 */
export function createRateLimit({ max, duration, message }) {
  return rateLimit({
    max,
    duration,
    generator: getClientKey,
    errorResponse: new Response(
      JSON.stringify({ error: message || 'Too many requests, please try again later.' }),
      { status: 429, headers: { 'content-type': 'application/json' } }
    ),
    countFailedRequest: true,
    headers: true,
  });
}

/**
 * Get rate limit configuration (for testing/debugging)
 */
export function getRateLimitConfig() {
  return { ...config };
}

/**
 * Smart rate limiter that applies different limits based on path
 * - /auth/* endpoints: 10 req/min
 * - /api/data/* endpoints: 60 req/min
 * - Other /api/* endpoints: 100 req/min
 */
export const smartRateLimit = rateLimit({
  duration: 60000, // 1 minute window
  max: (key, request) => {
    const url = new URL(request.url);

    // Auth endpoints: strictest limit
    if (url.pathname.startsWith('/auth/')) {
      return config.auth.max;
    }

    // Data endpoints: moderate limit
    if (url.pathname.startsWith('/api/data/')) {
      return config.data.max;
    }

    // All other API endpoints: generous limit
    if (url.pathname.startsWith('/api/')) {
      return config.api.max;
    }

    // Non-API endpoints: same as API default
    return config.api.max;
  },
  generator: getClientKey,
  errorResponse: (request) => {
    const url = new URL(request.url);
    let message = 'Too many requests, please try again later.';

    if (url.pathname.startsWith('/auth/')) {
      message = 'Too many authentication attempts, please try again later.';
    } else if (url.pathname.startsWith('/api/data/')) {
      message = 'Too many data requests, please try again later.';
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 429, headers: { 'content-type': 'application/json' } }
    );
  },
  countFailedRequest: true,
  headers: true,
  skip: (request) => {
    const url = new URL(request.url);
    // Skip rate limiting for health check and static assets
    return url.pathname === '/health' ||
           url.pathname.startsWith('/app/assets/') ||
           url.pathname.startsWith('/css/') ||
           url.pathname.startsWith('/js/');
  },
});

/**
 * Add cache control headers to response
 * Following HTTP caching best practices
 *
 * @param {Response} response - Response object
 * @param {Object} options - Cache options
 * @param {number} options.maxAge - Max age in seconds
 * @param {boolean} options.noCache - Set no-cache directive
 * @param {boolean} options.mustRevalidate - Set must-revalidate directive
 * @param {boolean} options.immutable - Set immutable directive
 * @returns {Response} Response with cache headers
 */
export function addCacheHeaders(response, options = {}) {
  if (!(response instanceof Response)) {
    return response;
  }

  const directives = [];

  if (options.noCache) {
    directives.push('no-cache', 'no-store');
  } else if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);

    if (options.mustRevalidate) {
      directives.push('must-revalidate');
    }

    if (options.immutable) {
      directives.push('immutable');
    }
  }

  if (directives.length === 0) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set('Cache-Control', directives.join(', '));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Preset cache configurations for common use cases
 */
export const cachePresets = {
  // Static assets: 1 hour, immutable
  static: { maxAge: 3600, immutable: true },

  // API responses: no caching
  api: { noCache: true },

  // Dashboard config: 1 minute, must revalidate
  dashboard: { maxAge: 60, mustRevalidate: true },

  // Short-lived: 5 seconds
  shortLived: { maxAge: 5 },

  // HTML pages: no caching
  html: { noCache: true },
};
