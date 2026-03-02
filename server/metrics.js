// ===========================================================================
// Performance Metrics Collection — Lightweight in-memory metrics
// ===========================================================================

/**
 * Lightweight metrics collector for performance monitoring
 * Tracks request counts, response times, errors, and cache statistics
 * All metrics stored in-memory and reset on server restart
 */
export class MetricsCollector {
  constructor() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;

    // Request metrics by endpoint
    this.endpoints = new Map(); // endpoint -> { count, totalTime, errors, responseTimes[] }

    // Data source query metrics
    this.dataSourceQueries = new Map(); // source -> { count, totalTime, errors, responseTimes[] }

    // Cache statistics
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };

    // Error tracking by source/type
    this.errors = new Map(); // source -> count
  }

  /**
   * Record a request with timing
   * @param {string} endpoint - Request endpoint path
   * @param {number} duration - Request duration in ms
   * @param {number} statusCode - HTTP status code
   */
  recordRequest(endpoint, duration, statusCode) {
    this.requestCount++;

    // Normalize endpoint (remove query params and IDs)
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);

    if (!this.endpoints.has(normalizedEndpoint)) {
      this.endpoints.set(normalizedEndpoint, {
        count: 0,
        totalTime: 0,
        errors: 0,
        responseTimes: []
      });
    }

    const metrics = this.endpoints.get(normalizedEndpoint);
    metrics.count++;
    metrics.totalTime += duration;

    // Track response times for percentile calculation (keep last 1000)
    metrics.responseTimes.push(duration);
    if (metrics.responseTimes.length > 1000) {
      metrics.responseTimes.shift();
    }

    // Track errors (4xx and 5xx)
    if (statusCode >= 400) {
      metrics.errors++;
      this.errorCount++;
    }
  }

  /**
   * Record data source query timing
   * @param {string} source - Data source name (bigquery, gcp, aws, etc.)
   * @param {number} duration - Query duration in ms
   * @param {boolean} isError - Whether the query failed
   */
  recordDataSourceQuery(source, duration, isError = false) {
    if (!this.dataSourceQueries.has(source)) {
      this.dataSourceQueries.set(source, {
        count: 0,
        totalTime: 0,
        errors: 0,
        responseTimes: []
      });
    }

    const metrics = this.dataSourceQueries.get(source);
    metrics.count++;
    metrics.totalTime += duration;

    // Track response times (keep last 1000)
    metrics.responseTimes.push(duration);
    if (metrics.responseTimes.length > 1000) {
      metrics.responseTimes.shift();
    }

    if (isError) {
      metrics.errors++;
      this.recordError(`datasource:${source}`);
    }
  }

  /**
   * Record cache hit
   */
  recordCacheHit() {
    this.cacheStats.hits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss() {
    this.cacheStats.misses++;
  }

  /**
   * Record cache set operation
   */
  recordCacheSet() {
    this.cacheStats.sets++;
  }

  /**
   * Record cache eviction
   */
  recordCacheEviction() {
    this.cacheStats.evictions++;
  }

  /**
   * Record an error by source/type
   * @param {string} source - Error source (e.g., 'bigquery', 'gcp', 'api')
   */
  recordError(source) {
    const count = this.errors.get(source) || 0;
    this.errors.set(source, count + 1);
  }

  /**
   * Normalize endpoint path for grouping
   * Removes IDs and query parameters
   * @param {string} path - Request path
   * @returns {string} Normalized path
   */
  normalizeEndpoint(path) {
    // Remove query string
    let normalized = path.split('?')[0];

    // Replace common ID patterns with :id
    // Examples: /api/dashboards/dashboard-1 -> /api/dashboards/:id
    //           /api/queries/bigquery/my-query -> /api/queries/:source/:id
    normalized = normalized.replace(/\/[a-f0-9-]{8,}/gi, '/:id'); // UUIDs and long IDs
    normalized = normalized.replace(/\/dashboard-\d+/g, '/:id'); // dashboard-1, dashboard-2
    normalized = normalized.replace(/\/widget-\d+/g, '/:id'); // widget-1, widget-2
    normalized = normalized.replace(/\/\d+$/g, '/:id'); // Trailing numbers

    // Handle data source paths like /api/queries/bigquery/query-id
    if (normalized.match(/\/api\/queries\/[^/]+\/[^/]+$/)) {
      normalized = normalized.replace(/\/[^/]+\/[^/]+$/, '/:source/:id');
    }

    return normalized;
  }

  /**
   * Calculate percentile from array of values
   * @param {number[]} values - Array of numeric values
   * @param {number} percentile - Percentile to calculate (0-100)
   * @returns {number} Percentile value
   */
  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get uptime in seconds
   * @returns {number} Uptime in seconds
   */
  getUptime() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Get comprehensive metrics snapshot
   * @returns {object} All collected metrics
   */
  getMetrics() {
    const now = Date.now();
    const uptimeSeconds = this.getUptime();

    // Calculate endpoint metrics
    const endpointMetrics = {};
    for (const [endpoint, metrics] of this.endpoints.entries()) {
      const avgResponseTime = metrics.count > 0
        ? Math.round(metrics.totalTime / metrics.count)
        : 0;

      endpointMetrics[endpoint] = {
        requests: metrics.count,
        errors: metrics.errors,
        avgResponseTime,
        p95: Math.round(this.calculatePercentile(metrics.responseTimes, 95)),
        p99: Math.round(this.calculatePercentile(metrics.responseTimes, 99))
      };
    }

    // Calculate data source metrics
    const dataSourceMetrics = {};
    for (const [source, metrics] of this.dataSourceQueries.entries()) {
      const avgQueryTime = metrics.count > 0
        ? Math.round(metrics.totalTime / metrics.count)
        : 0;

      dataSourceMetrics[source] = {
        queries: metrics.count,
        errors: metrics.errors,
        avgQueryTime,
        p95: Math.round(this.calculatePercentile(metrics.responseTimes, 95)),
        p99: Math.round(this.calculatePercentile(metrics.responseTimes, 99))
      };
    }

    // Calculate cache hit ratio
    const totalCacheRequests = this.cacheStats.hits + this.cacheStats.misses;
    const cacheHitRatio = totalCacheRequests > 0
      ? (this.cacheStats.hits / totalCacheRequests * 100).toFixed(2)
      : 0;

    // Convert errors map to object
    const errorsBySource = Object.fromEntries(this.errors);

    return {
      timestamp: new Date(now).toISOString(),
      uptime: {
        seconds: uptimeSeconds,
        formatted: this.formatUptime(uptimeSeconds)
      },
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        errorRate: this.requestCount > 0
          ? ((this.errorCount / this.requestCount) * 100).toFixed(2) + '%'
          : '0%',
        requestsPerSecond: uptimeSeconds > 0
          ? (this.requestCount / uptimeSeconds).toFixed(2)
          : 0
      },
      endpoints: endpointMetrics,
      dataSources: dataSourceMetrics,
      cache: {
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
        sets: this.cacheStats.sets,
        evictions: this.cacheStats.evictions,
        hitRatio: cacheHitRatio + '%',
        totalRequests: totalCacheRequests
      },
      errors: errorsBySource
    };
  }

  /**
   * Format uptime as human-readable string
   * @param {number} seconds - Uptime in seconds
   * @returns {string} Formatted uptime (e.g., "2h 15m 30s")
   */
  formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.endpoints.clear();
    this.dataSourceQueries.clear();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
    this.errors.clear();
  }
}

// Global singleton instance
export const metricsCollector = new MetricsCollector();

/**
 * Helper to time async operations
 * @param {Function} fn - Async function to time
 * @returns {Promise<{result: any, duration: number}>}
 */
export async function timeOperation(fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration, error: null };
  } catch (error) {
    const duration = Date.now() - start;
    return { result: null, duration, error };
  }
}
