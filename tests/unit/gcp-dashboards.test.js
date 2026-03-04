import { describe, it, expect } from 'bun:test';
import { parseTiles, slugifyId } from '../../server/gcp-dashboards.js';

const FIXTURE_MOSAIC = {
  displayName: 'Bidder Overview',
  mosaicLayout: {
    tiles: [
      {
        widget: {
          title: 'Winner Candidates',
          xyChart: {
            dataSets: [{
              timeSeriesQuery: {
                timeSeriesFilter: {
                  filter: 'metric.type="custom.googleapis.com/opencensus/mhive/bidder/winner_candidates_count" resource.type="global"',
                  aggregation: {
                    alignmentPeriod: '60s',
                    perSeriesAligner: 'ALIGN_DELTA',
                    crossSeriesReducer: 'REDUCE_SUM',
                  },
                },
              },
            }],
          },
        },
      },
      {
        widget: {
          title: 'Request Latency',
          scorecard: {
            timeSeriesQuery: {
              timeSeriesFilter: {
                filter: 'metric.type="monitoring.googleapis.com/uptime_check/request_latency"',
                aggregation: {
                  alignmentPeriod: '60s',
                  perSeriesAligner: 'ALIGN_MEAN',
                  crossSeriesReducer: 'REDUCE_MEAN',
                },
              },
            },
          },
        },
      },
      {
        widget: {
          title: 'Notes',
          text: { content: 'Dashboard notes' },
        },
      },
    ],
  },
};

const FIXTURE_GRID = {
  displayName: 'Cloud Run',
  gridLayout: {
    widgets: [
      {
        title: 'Request Count',
        xyChart: {
          dataSets: [{
            timeSeriesQuery: {
              timeSeriesFilter: {
                filter: 'metric.type="run.googleapis.com/request_count"',
                aggregation: { alignmentPeriod: '60s', perSeriesAligner: 'ALIGN_RATE' },
              },
            },
          }],
        },
      },
    ],
  },
};

const FIXTURE_MULTI_DATASET = {
  displayName: 'Multi',
  mosaicLayout: {
    tiles: [{
      widget: {
        title: 'CPU & Memory',
        xyChart: {
          dataSets: [
            {
              timeSeriesQuery: {
                timeSeriesFilter: {
                  filter: 'metric.type="kubernetes.io/container/cpu/core_usage_time"',
                  aggregation: { perSeriesAligner: 'ALIGN_MEAN' },
                },
              },
            },
            {
              timeSeriesQuery: {
                timeSeriesFilter: {
                  filter: 'metric.type="kubernetes.io/container/memory/used_bytes"',
                  aggregation: { perSeriesAligner: 'ALIGN_MEAN' },
                },
              },
            },
          ],
        },
      },
    }],
  },
};

describe('parseTiles()', () => {
  it('extracts xyChart tiles from mosaicLayout', () => {
    const tiles = parseTiles(FIXTURE_MOSAIC);
    const winner = tiles.find(t => t.name === 'Winner Candidates');
    expect(winner).toBeDefined();
    expect(winner.metricType).toBe('custom.googleapis.com/opencensus/mhive/bidder/winner_candidates_count');
    expect(winner.filters).toBe('resource.type="global"');
    expect(winner.aggregation.perSeriesAligner).toBe('ALIGN_DELTA');
    expect(winner.aggregation.crossSeriesReducer).toBe('REDUCE_SUM');
    expect(winner.aggregation.alignmentPeriod).toBe('60s');
  });

  it('extracts scorecard tiles from mosaicLayout', () => {
    const tiles = parseTiles(FIXTURE_MOSAIC);
    const latency = tiles.find(t => t.name === 'Request Latency');
    expect(latency).toBeDefined();
    expect(latency.metricType).toBe('monitoring.googleapis.com/uptime_check/request_latency');
  });

  it('skips text/alert widgets with no metricType', () => {
    const tiles = parseTiles(FIXTURE_MOSAIC);
    expect(tiles.find(t => t.name === 'Notes')).toBeUndefined();
    expect(tiles.length).toBe(2);
  });

  it('extracts widgets from gridLayout', () => {
    const tiles = parseTiles(FIXTURE_GRID);
    expect(tiles.length).toBe(1);
    expect(tiles[0].metricType).toBe('run.googleapis.com/request_count');
  });

  it('splits multi-dataset tiles into multiple rows with suffixed names', () => {
    const tiles = parseTiles(FIXTURE_MULTI_DATASET);
    expect(tiles.length).toBe(2);
    expect(tiles[0].name).toBe('CPU & Memory (1)');
    expect(tiles[0].metricType).toBe('kubernetes.io/container/cpu/core_usage_time');
    expect(tiles[1].name).toBe('CPU & Memory (2)');
    expect(tiles[1].metricType).toBe('kubernetes.io/container/memory/used_bytes');
  });

  it('generates a unique slug id for each tile', () => {
    const tiles = parseTiles(FIXTURE_MOSAIC);
    expect(tiles[0].id).toMatch(/^[a-z0-9-]+-[a-z0-9]{4}$/);
    expect(tiles[0].id).not.toBe(tiles[1].id);
  });

  it('fills in missing aggregation fields with defaults', () => {
    const dashboard = {
      displayName: 'X',
      gridLayout: {
        widgets: [{
          title: 'Bare Metric',
          xyChart: {
            dataSets: [{
              timeSeriesQuery: {
                timeSeriesFilter: {
                  filter: 'metric.type="custom.googleapis.com/foo"',
                },
              },
            }],
          },
        }],
      },
    };
    const tiles = parseTiles(dashboard);
    expect(tiles[0].aggregation.perSeriesAligner).toBe('ALIGN_MEAN');
    expect(tiles[0].aggregation.alignmentPeriod).toBe('60s');
  });
});

describe('slugifyId()', () => {
  it('lowercases and replaces spaces/special chars with hyphens', () => {
    const id = slugifyId('Winner Candidates', 'custom.googleapis.com/foo');
    expect(id).toMatch(/^winner-candidates-[a-z0-9]{4}$/);
  });

  it('produces different ids for same name but different metricType', () => {
    const id1 = slugifyId('Requests', 'run.googleapis.com/request_count');
    const id2 = slugifyId('Requests', 'run.googleapis.com/request_latencies');
    expect(id1).not.toBe(id2);
  });
});
