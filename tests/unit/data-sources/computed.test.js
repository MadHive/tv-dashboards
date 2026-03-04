import { describe, it, expect, mock, beforeEach } from 'bun:test';

const mockStorageVolume = mock(async () => ({
  data:    { value: '1.2 TB', detail: 'BQ + BT + GCS', trend: 'up' },
  rawData: [{ label: 'total', value: '1.2 TB' }],
}));
const mockFleetHealth = mock(async () => ({
  data:    { value: 95, detail: '19/20 active', trend: 'stable' },
  rawData: [{ label: 'online', value: 19 }],
}));

mock.module('../../../server/gcp-metrics.js', () => ({
  storageVolume:             mockStorageVolume,
  fleetHealth:               mockFleetHealth,
  serviceLatency:            mock(async () => ({ data: { value: 42 }, rawData: [] })),
  campaignDeliveryMapWidget: mock(async () => ({ data: {}, rawData: [] })),
  coreClusterSize:           mock(async () => ({ data: { value: '42' }, rawData: [] })),
  pipelineFlow:              mock(async () => ({ data: { stages: [] }, rawData: [] })),
  bidderErrorRate:           mock(async () => ({ data: { value: '0.012%' }, rawData: [] })),
  bidderTimeoutRate:         mock(async () => ({ data: { value: 0.85 }, rawData: [] })),
}));

mock.module('../../../server/query-manager.js', () => ({
  getQuery: mock(async (source, id) => {
    if (source !== 'computed') return null;
    const map = {
      'storage-volume': { id: 'storage-volume', function: 'storageVolume', params: {} },
      'fleet-health':   { id: 'fleet-health',   function: 'fleetHealth',   params: {} },
    };
    return map[id] || null;
  }),
}));

const { ComputedDataSource } = await import('../../../server/data-sources/computed.js');

describe('ComputedDataSource', () => {
  let ds;

  beforeEach(() => {
    ds = new ComputedDataSource();
    mockStorageVolume.mockClear();
    mockFleetHealth.mockClear();
  });

  it('has name "computed" and isConnected true', () => {
    expect(ds.name).toBe('computed');
    expect(ds.isConnected).toBe(true);
  });

  it('fetchMetrics calls the registered function by queryId', async () => {
    const result = await ds.fetchMetrics({ queryId: 'storage-volume', id: 'storage-volume' });
    expect(mockStorageVolume).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual({ value: '1.2 TB', detail: 'BQ + BT + GCS', trend: 'up' });
    expect(result.source).toBe('computed');
    expect(result.rawData).toBeDefined();
  });

  it('fetchMetrics calls fleetHealth function for fleet-health queryId', async () => {
    await ds.fetchMetrics({ queryId: 'fleet-health', id: 'fleet-health' });
    expect(mockFleetHealth).toHaveBeenCalledTimes(1);
  });

  it('fetchMetrics returns empty data for unknown queryId without crashing', async () => {
    const result = await ds.fetchMetrics({ queryId: 'does-not-exist', id: 'x' });
    expect(result.data).toBeDefined();
    expect(result.source).toBe('computed');
  });

  it('testConnection returns true', async () => {
    expect(await ds.testConnection()).toBe(true);
  });
});
