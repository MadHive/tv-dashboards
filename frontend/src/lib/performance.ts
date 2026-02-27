/**
 * Performance monitoring utilities
 */

/**
 * Measure component render time
 */
export function measureRender(componentName: string): () => void {
  const startMark = `${componentName}-render-start`;
  const endMark = `${componentName}-render-end`;
  const measureName = `${componentName}-render`;

  performance.mark(startMark);

  return () => {
    performance.mark(endMark);
    performance.measure(measureName, startMark, endMark);

    const measure = performance.getEntriesByName(measureName)[0];
    if (measure) {
      console.log(`[Perf] ${componentName} rendered in ${measure.duration.toFixed(2)}ms`);
    }

    // Cleanup
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);
  };
}

/**
 * Measure async operation time
 */
export async function measureAsync<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const start = performance.now();

  try {
    const result = await operation();
    const end = performance.now();
    console.log(`[Perf] ${operationName} completed in ${(end - start).toFixed(2)}ms`);
    return result;
  } catch (error) {
    const end = performance.now();
    console.log(`[Perf] ${operationName} failed after ${(end - start).toFixed(2)}ms`);
    throw error;
  }
}

/**
 * Report Web Vitals to console (or analytics service)
 */
export function reportWebVitals(metric: {
  name: string;
  value: number;
  id: string;
  delta: number;
}): void {
  console.log(`[Web Vital] ${metric.name}:`, {
    value: metric.value,
    delta: metric.delta,
    id: metric.id,
  });

  // In production, send to analytics service:
  // sendToAnalytics(metric);
}

/**
 * Get current performance metrics
 */
export function getPerformanceMetrics(): {
  navigation: PerformanceNavigationTiming | null;
  paint: PerformancePaintTiming[];
  resources: PerformanceResourceTiming[];
} {
  const navigation = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;

  const paint = performance.getEntriesByType('paint') as PerformancePaintTiming[];

  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

  return {
    navigation: navigation || null,
    paint,
    resources,
  };
}

/**
 * Log performance summary
 */
export function logPerformanceSummary(): void {
  const metrics = getPerformanceMetrics();

  if (metrics.navigation) {
    const nav = metrics.navigation;
    console.group('[Performance Summary]');
    console.log('DNS:', `${(nav.domainLookupEnd - nav.domainLookupStart).toFixed(2)}ms`);
    console.log('TCP:', `${(nav.connectEnd - nav.connectStart).toFixed(2)}ms`);
    console.log('Request:', `${(nav.responseStart - nav.requestStart).toFixed(2)}ms`);
    console.log('Response:', `${(nav.responseEnd - nav.responseStart).toFixed(2)}ms`);
    console.log('DOM Processing:', `${(nav.domComplete - nav.domInteractive).toFixed(2)}ms`);
    console.log('Load Complete:', `${nav.loadEventEnd.toFixed(2)}ms`);
    console.groupEnd();
  }

  if (metrics.paint.length > 0) {
    console.group('[Paint Metrics]');
    metrics.paint.forEach((entry) => {
      console.log(`${entry.name}:`, `${entry.startTime.toFixed(2)}ms`);
    });
    console.groupEnd();
  }
}

/**
 * Performance observer for long tasks
 */
export function observeLongTasks(threshold: number = 50): void {
  if (!('PerformanceObserver' in window)) return;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > threshold) {
        console.warn(
          `[Long Task] ${entry.name} took ${entry.duration.toFixed(2)}ms (threshold: ${threshold}ms)`
        );
      }
    }
  });

  try {
    observer.observe({ entryTypes: ['measure', 'longtask'] });
  } catch (e) {
    // longtask not supported in all browsers
    observer.observe({ entryTypes: ['measure'] });
  }
}

/**
 * Bundle size estimator (rough estimate from loaded resources)
 */
export function estimateBundleSize(): { js: number; css: number; total: number } {
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

  let jsSize = 0;
  let cssSize = 0;

  resources.forEach((resource) => {
    const size = resource.transferSize || resource.encodedBodySize || 0;

    if (resource.name.endsWith('.js')) {
      jsSize += size;
    } else if (resource.name.endsWith('.css')) {
      cssSize += size;
    }
  });

  return {
    js: Math.round(jsSize / 1024), // KB
    css: Math.round(cssSize / 1024), // KB
    total: Math.round((jsSize + cssSize) / 1024), // KB
  };
}

/**
 * Check if performance budget is met
 */
export function checkPerformanceBudget(): {
  passed: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  const metrics = getPerformanceMetrics();
  const bundleSize = estimateBundleSize();

  // Bundle size checks
  if (bundleSize.js > 500) {
    violations.push(`JS bundle too large: ${bundleSize.js}KB (max: 500KB)`);
  }

  if (bundleSize.css > 100) {
    violations.push(`CSS bundle too large: ${bundleSize.css}KB (max: 100KB)`);
  }

  // Paint timing checks
  const fcp = metrics.paint.find((p) => p.name === 'first-contentful-paint');
  if (fcp && fcp.startTime > 2500) {
    violations.push(`FCP too slow: ${fcp.startTime.toFixed(0)}ms (max: 2500ms)`);
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}
