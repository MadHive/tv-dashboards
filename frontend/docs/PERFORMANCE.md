# Performance Guide

Performance optimization guidelines and budgets for MadHive TV Dashboards.

## Performance Budget

### Bundle Size Targets

| Metric | Target | Maximum |
|--------|--------|---------|
| Initial JS Bundle | < 300KB gzipped | 500KB |
| CSS Bundle | < 50KB gzipped | 100KB |
| Total Assets | < 500KB gzipped | 1MB |
| Lazy Chunks | < 100KB each | 200KB |

### Runtime Performance

| Metric | Target | Maximum |
|--------|--------|---------|
| First Contentful Paint (FCP) | < 1.5s | 2.5s |
| Largest Contentful Paint (LCP) | < 2.0s | 3.0s |
| Time to Interactive (TTI) | < 2.5s | 4.0s |
| Cumulative Layout Shift (CLS) | < 0.1 | 0.25 |
| First Input Delay (FID) | < 50ms | 100ms |

### Widget Performance

| Metric | Target | Maximum |
|--------|--------|---------|
| Widget Render Time | < 50ms | 100ms |
| Chart Animation | 300-500ms | 1000ms |
| Data Fetch | < 500ms | 2000ms |
| Table Sort/Filter | < 100ms | 300ms |

### Lighthouse Scores

| Category | Target | Minimum |
|----------|--------|---------|
| Performance | > 95 | 90 |
| Accessibility | 100 | 100 |
| Best Practices | > 95 | 90 |
| SEO | > 90 | 85 |

## Optimization Strategies

### 1. Code Splitting

**Lazy Load Heavy Components:**

```typescript
// Heavy widgets are lazy loaded
const MapWidget = lazy(() => import('./MapWidget'));
const SankeyWidget = lazy(() => import('./SankeyWidget'));
const TreemapWidget = lazy(() => import('./TreemapWidget'));

// Wrap in Suspense
<Suspense fallback={<LoadingState />}>
  <MapWidget config={config} />
</Suspense>
```

**Route-based Splitting:**

```typescript
const QueryBuilder = lazy(() => import('@/pages/QueryBuilder'));

<Routes>
  <Route path="/query-builder" element={
    <Suspense fallback={<LoadingState />}>
      <QueryBuilder />
    </Suspense>
  } />
</Routes>
```

### 2. React Optimization

**Use React.memo for Expensive Components:**

```typescript
import { memo } from 'react';

const ExpensiveWidget = memo(({ data }) => {
  // Expensive rendering logic
  return <div>{/* ... */}</div>;
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.data === nextProps.data;
});
```

**Use useMemo for Expensive Computations:**

```typescript
import { useMemo } from 'react';

const sortedData = useMemo(() => {
  return data.sort((a, b) => b.value - a.value);
}, [data]);

const chartConfig = useMemo(() => ({
  lines: data.metrics.map(m => ({ key: m.id, color: m.color })),
  xAxis: data.timeRange
}), [data.metrics, data.timeRange]);
```

**Use useCallback for Event Handlers:**

```typescript
import { useCallback } from 'react';

const handleSort = useCallback((column: string) => {
  setSortConfig({ column, direction: 'asc' });
}, []);

const handleFilter = useCallback((filters: Filter[]) => {
  setActiveFilters(filters);
}, []);
```

### 3. Data Fetching Optimization

**React Query Configuration:**

```typescript
import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minute
      cacheTime: 300_000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

**Parallel Data Fetching:**

```typescript
// Fetch multiple widgets in parallel
const { data: widget1 } = useWidgetData('widget-1');
const { data: widget2 } = useWidgetData('widget-2');
const { data: widget3 } = useWidgetData('widget-3');
```

**Prefetch Critical Data:**

```typescript
// Prefetch on route enter
queryClient.prefetchQuery(['widget', widgetId], () => fetchWidgetData(widgetId));
```

### 4. Image Optimization

**Lazy Load Images:**

```tsx
<img
  src={imageSrc}
  loading="lazy"
  alt="Description"
  width={800}
  height={600}
/>
```

**Use Appropriate Formats:**

- WebP for photos (smaller size)
- SVG for icons and logos
- PNG for images with transparency

### 5. Virtual Scrolling

**For Large Lists/Tables:**

```typescript
import { useVirtual } from 'react-virtual';

function VirtualTable({ rows }) {
  const parentRef = useRef();

  const rowVirtualizer = useVirtual({
    size: rows.length,
    parentRef,
    estimateSize: useCallback(() => 50, []),
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${rowVirtualizer.totalSize}px` }}>
        {rowVirtualizer.virtualItems.map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {rows[virtualRow.index]}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 6. CSS Optimization

**Tailwind CSS Purging:**

Ensure `tailwind.config.ts` includes proper content paths:

```typescript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // ...
};
```

**Avoid Runtime CSS:**

Use Tailwind classes instead of runtime style objects:

```typescript
// ❌ Avoid
<div style={{ color: isActive ? '#FF9BD3' : '#F4DFFF' }}>

// ✅ Prefer
<div className={isActive ? 'text-madhive-pink' : 'text-madhive-chalk'}>
```

### 7. Third-Party Libraries

**Bundle Size Impact:**

| Library | Size (gzipped) | Notes |
|---------|----------------|-------|
| React + ReactDOM | ~45KB | Core framework |
| React Router | ~11KB | Client-side routing |
| React Query | ~13KB | Data fetching |
| Recharts | ~95KB | Charts (shared) |
| D3 (sankey, hierarchy) | ~25KB | D3 modules |
| Leaflet | ~40KB | Maps |
| Lucide React | ~1KB/icon | Icons (tree-shakeable) |

**Optimization:**

- Use tree-shakeable imports
- Lazy load heavy libraries (D3, Leaflet)
- Import only needed components

```typescript
// ❌ Avoid
import * as d3 from 'd3';

// ✅ Prefer
import { sankey } from 'd3-sankey';
```

## Measuring Performance

### Build Analysis

```bash
cd frontend

# Build with analysis
npm run build

# Check bundle sizes
ls -lh dist/assets/*.js
```

### Runtime Performance

**Chrome DevTools:**

1. Open DevTools > Performance
2. Click Record
3. Interact with application
4. Stop recording
5. Analyze results

**Lighthouse:**

```bash
# Install globally
npm install -g lighthouse

# Run audit
lighthouse http://localhost:3000 --view
```

### Custom Performance Monitoring

```typescript
// Measure widget render time
const start = performance.now();
// ... rendering logic
const end = performance.now();
console.log(`Widget rendered in ${end - start}ms`);

// Use Performance Observer
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.duration}ms`);
  }
});

observer.observe({ entryTypes: ['measure'] });

// Mark and measure
performance.mark('widget-start');
// ... rendering logic
performance.mark('widget-end');
performance.measure('widget-render', 'widget-start', 'widget-end');
```

## Performance Checklist

### Build Time

- [ ] Bundle size under budget
- [ ] CSS purged properly
- [ ] Source maps enabled for debugging
- [ ] Tree shaking working
- [ ] Lazy chunks created for heavy components

### Runtime

- [ ] No unnecessary re-renders
- [ ] Expensive computations memoized
- [ ] Event handlers use useCallback
- [ ] Large lists virtualized
- [ ] Images lazy loaded
- [ ] No console.log in production

### Data Fetching

- [ ] React Query configured with proper cache times
- [ ] Stale data shown while revalidating
- [ ] Failed requests retried
- [ ] Loading states shown
- [ ] Parallel requests when possible

### Accessibility & Performance

- [ ] Focus management doesn't cause re-renders
- [ ] ARIA live regions used sparingly
- [ ] Animations use CSS transforms (GPU accelerated)
- [ ] No layout thrashing

## Common Performance Issues

### Issue: Large Bundle Size

**Symptoms:**
- Slow initial load
- Long Time to Interactive

**Solutions:**
1. Analyze bundle with `npm run build`
2. Lazy load heavy components
3. Check for duplicate dependencies
4. Use smaller alternative libraries

### Issue: Slow Widget Rendering

**Symptoms:**
- Lag when switching widgets
- Janky animations

**Solutions:**
1. Use React.memo on widget components
2. Memoize expensive computations
3. Reduce number of DOM elements
4. Use CSS transforms for animations

### Issue: Excessive Re-renders

**Symptoms:**
- CPU spikes
- Battery drain on mobile
- Choppy interactions

**Solutions:**
1. Use React DevTools Profiler
2. Implement shouldComponentUpdate or React.memo
3. Use useCallback for event handlers
4. Avoid creating objects/arrays in render

### Issue: Memory Leaks

**Symptoms:**
- Increasing memory usage
- Slowdown over time
- Tab crashes

**Solutions:**
1. Clean up subscriptions in useEffect
2. Cancel pending requests on unmount
3. Remove event listeners
4. Clear timers/intervals

```typescript
useEffect(() => {
  const timer = setInterval(() => {
    // ...
  }, 1000);

  return () => clearInterval(timer); // Cleanup
}, []);
```

## Performance Testing

### Automated Tests

```typescript
import { render } from '@testing-library/react';
import { performance } from 'perf_hooks';

test('widget renders within performance budget', () => {
  const start = performance.now();
  render(<MyWidget config={config} />);
  const end = performance.now();

  expect(end - start).toBeLessThan(100); // 100ms budget
});
```

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery quick --count 100 --num 10 http://localhost:3000
```

## Best Practices Summary

### Do's ✓

- Lazy load heavy components
- Memoize expensive computations
- Use React Query for data fetching
- Implement virtual scrolling for large lists
- Use CSS transforms for animations
- Monitor bundle size regularly
- Test on low-end devices
- Measure before optimizing

### Don'ts ✗

- Don't import entire libraries
- Don't create objects/arrays in render
- Don't fetch data in render
- Don't forget cleanup in useEffect
- Don't over-optimize prematurely
- Don't skip profiling
- Don't ignore bundle size warnings

## Monitoring in Production

### Web Vitals

```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  // Send to your analytics service
  console.log(metric);
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

### Error Monitoring

```typescript
window.addEventListener('error', (event) => {
  // Log to error tracking service
  console.error('Runtime error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  // Log promise rejections
  console.error('Unhandled promise rejection:', event.reason);
});
```

---

## Resources

- [Web Vitals](https://web.dev/vitals/)
- [React Performance](https://react.dev/learn/render-and-commit)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Bundle Analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)
- [React DevTools Profiler](https://react.dev/learn/react-developer-tools)

---

**Version:** 1.0.0 (2024-02-27)
