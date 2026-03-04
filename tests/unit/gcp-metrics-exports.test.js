import { describe, it, expect, mock } from 'bun:test';

// Mock the GCP monitoring client and BigQuery before importing gcp-metrics
mock.module('@google-cloud/monitoring', () => ({
  default: { MetricServiceClient: class { listTimeSeries = async () => [[]] } }
}));
mock.module('@google-cloud/bigquery', () => ({
  BigQuery: class { query = async () => [[]] }
}));

const gcpMetrics = await import('../../server/gcp-metrics.js');

describe('gcp-metrics named exports', () => {
  it('exports storageVolume as a function', () => {
    expect(typeof gcpMetrics.storageVolume).toBe('function');
  });
  it('exports fleetHealth as a function', () => {
    expect(typeof gcpMetrics.fleetHealth).toBe('function');
  });
  it('exports serviceLatency as a function', () => {
    expect(typeof gcpMetrics.serviceLatency).toBe('function');
  });
  it('exports campaignDeliveryMapWidget as a function', () => {
    expect(typeof gcpMetrics.campaignDeliveryMapWidget).toBe('function');
  });
  it('exports coreClusterSize as a function', () => {
    expect(typeof gcpMetrics.coreClusterSize).toBe('function');
  });
  it('exports pipelineFlow as a function', () => {
    expect(typeof gcpMetrics.pipelineFlow).toBe('function');
  });
  it('exports bidderErrorRate as a function', () => {
    expect(typeof gcpMetrics.bidderErrorRate).toBe('function');
  });
  it('exports bidderTimeoutRate as a function', () => {
    expect(typeof gcpMetrics.bidderTimeoutRate).toBe('function');
  });

  it('storageVolume returns { data, rawData }', async () => {
    const result = await gcpMetrics.storageVolume();
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('rawData');
    expect(Array.isArray(result.rawData)).toBe(true);
  });

  it('fleetHealth returns { data, rawData }', async () => {
    const result = await gcpMetrics.fleetHealth();
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('rawData');
  });
});
