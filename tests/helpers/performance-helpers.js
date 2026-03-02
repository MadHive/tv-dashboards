// ===========================================================================
// Performance Helpers — Performance measurement utilities
// ===========================================================================

/**
 * Measure load time for a page
 * @param {Page} page - Puppeteer page
 * @returns {Object} Performance metrics
 */
export async function measureLoadTime(page) {
  const metrics = await page.metrics();
  const performanceTiming = await page.evaluate(() => {
    const timing = performance.timing;
    return {
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      loadComplete: timing.loadEventEnd - timing.navigationStart,
      firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
      firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime || 0
    };
  });

  return {
    ...performanceTiming,
    jsHeapUsed: metrics.JSHeapUsedSize,
    jsHeapTotal: metrics.JSHeapTotalSize
  };
}

/**
 * Measure render time for a widget
 * @param {Function} renderFn - Function that renders widget
 * @returns {Object} Render metrics
 */
export function measureRenderTime(renderFn) {
  const start = performance.now();
  renderFn();
  const end = performance.now();

  return {
    renderTime: end - start,
    timestamp: Date.now()
  };
}

/**
 * Profile memory usage
 * @param {Page} page - Puppeteer page
 * @returns {Object} Memory metrics
 */
export async function profileMemory(page) {
  const metrics = await page.metrics();

  return {
    jsHeapUsed: metrics.JSHeapUsedSize,
    jsHeapTotal: metrics.JSHeapTotalSize,
    usedPercent: (metrics.JSHeapUsedSize / metrics.JSHeapTotalSize) * 100,
    timestamp: Date.now()
  };
}

/**
 * Measure data fetch time
 * @param {Function} fetchFn - Async function that fetches data
 * @returns {Object} Fetch metrics
 */
export async function measureFetchTime(fetchFn) {
  const start = performance.now();
  const result = await fetchFn();
  const end = performance.now();

  return {
    fetchTime: end - start,
    result,
    timestamp: Date.now()
  };
}

/**
 * Track FPS over time
 * @param {Page} page - Puppeteer page
 * @param {number} duration - Duration in ms
 * @returns {Object} FPS metrics
 */
export async function trackFPS(page, duration = 5000) {
  const fps = await page.evaluate((duration) => {
    return new Promise((resolve) => {
      const frames = [];
      let lastTime = performance.now();

      function measureFrame() {
        const currentTime = performance.now();
        const delta = currentTime - lastTime;
        frames.push(1000 / delta);
        lastTime = currentTime;

        if (currentTime - frames[0] < duration) {
          requestAnimationFrame(measureFrame);
        } else {
          const avgFPS = frames.reduce((a, b) => a + b, 0) / frames.length;
          const minFPS = Math.min(...frames);
          const maxFPS = Math.max(...frames);
          resolve({ avgFPS, minFPS, maxFPS, sampleCount: frames.length });
        }
      }

      requestAnimationFrame(measureFrame);
    });
  }, duration);

  return fps;
}

/**
 * Benchmark function execution
 * @param {Function} fn - Function to benchmark
 * @param {number} iterations - Number of iterations
 * @returns {Object} Benchmark results
 */
export async function benchmark(fn, iterations = 100) {
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  times.sort((a, b) => a - b);

  return {
    iterations,
    min: times[0],
    max: times[times.length - 1],
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    median: times[Math.floor(times.length / 2)],
    p95: times[Math.floor(times.length * 0.95)],
    p99: times[Math.floor(times.length * 0.99)]
  };
}

/**
 * Monitor network requests
 * @param {Page} page - Puppeteer page
 * @returns {Object} Network monitoring object
 */
export function monitorNetwork(page) {
  const requests = [];
  const responses = [];

  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      timestamp: Date.now()
    });
  });

  page.on('response', response => {
    responses.push({
      url: response.url(),
      status: response.status(),
      timestamp: Date.now()
    });
  });

  return {
    getRequests: () => requests,
    getResponses: () => responses,
    getStats: () => ({
      totalRequests: requests.length,
      totalResponses: responses.length,
      failedRequests: responses.filter(r => r.status >= 400).length,
      avgResponseTime: responses.reduce((sum, r, i) => {
        const req = requests.find(req => req.url === r.url);
        return sum + (req ? r.timestamp - req.timestamp : 0);
      }, 0) / responses.length
    })
  };
}

/**
 * Assert performance threshold
 * @param {number} actual - Actual time in ms
 * @param {number} threshold - Maximum allowed time in ms
 * @param {string} metric - Metric name for error message
 */
export function assertPerformance(actual, threshold, metric) {
  if (actual > threshold) {
    throw new Error(`Performance threshold exceeded for ${metric}: ${actual}ms > ${threshold}ms`);
  }
}
