// frontend/src/lib/dataSourceConnectors/__tests__/gcpMonitoring.test.ts
import { describe, it, expect, vi } from 'vitest';
import { discoverGCPMetrics, testGCPConnection } from '../gcpMonitoring';

describe('gcpMonitoring', () => {
  it('should discover GCP metrics by category', async () => {
    const metrics = await discoverGCPMetrics();

    expect(metrics).toHaveProperty('performance');
    expect(metrics).toHaveProperty('errors');
    expect(metrics).toHaveProperty('resources');
    expect(metrics.performance).toBeInstanceOf(Array);
    expect(metrics.performance.length).toBeGreaterThan(0);
  });

  it('should test GCP connection', async () => {
    const result = await testGCPConnection();

    expect(result).toHaveProperty('connected');
    expect(result).toHaveProperty('metricsCount');
    expect(typeof result.connected).toBe('boolean');
  });
});
