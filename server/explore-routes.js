// ===========================================================================
// Query Explorer Routes — ad-hoc GCP and BigQuery queries (unsaved)
// ===========================================================================

import { Elysia } from 'elysia';
import { query as gcpQuery } from './gcp-metrics.js';
import { dataSourceRegistry } from './data-source-registry.js';
import logger from './logger.js';

const DEFAULT_PROJECT = (process.env.GCP_PROJECTS || 'mad-master').split(',')[0].trim();

export const exploreRoutes = new Elysia({ prefix: '/api/explore' })

  .post('/gcp', async ({ body }) => {
    const {
      metricType,
      project     = DEFAULT_PROJECT,
      timeWindow  = 30,
      aggregation = {},
      filters     = '',
      widgetType  = 'big-number',
    } = body || {};

    if (!metricType) {
      return new Response(
        JSON.stringify({ success: false, error: 'metricType is required' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    const t0 = Date.now();
    try {
      const timeSeries = await gcpQuery(project, metricType, filters, timeWindow, aggregation);
      const executionMs = Date.now() - t0;

      const rawSeries  = extractRawSeries(timeSeries);
      const gcpSource  = dataSourceRegistry.getSource('gcp');
      const widgetData = timeSeries.length
        ? gcpSource.transformData(timeSeries, widgetType)
        : null;

      return {
        success:     true,
        rawSeries,
        widgetData,
        seriesCount: timeSeries.length,
        pointCount:  rawSeries.length,
        executionMs,
      };
    } catch (err) {
      logger.error({ err: err.message }, 'explore/gcp failed');
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['queries'],
      summary: 'Ad-hoc GCP metric query',
      description: 'Run an unsaved GCP Cloud Monitoring query and get raw time series + widget data.',
    },
  })

  .post('/bigquery', async ({ body }) => {
    const { sql, widgetType = 'big-number' } = body || {};

    if (!sql?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'sql is required' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    let safeSql = sql.trim().replace(/;\s*$/, '');
    if (!/\bLIMIT\b/i.test(safeSql)) {
      safeSql = safeSql + ' LIMIT 200';
    }

    const t0 = Date.now();
    try {
      const bqSource    = dataSourceRegistry.getSource('bigquery');
      const rows        = await bqSource.executeQuery(safeSql, {}, false);
      const executionMs = Date.now() - t0;
      const widgetData  = transformBqRows(rows, widgetType);

      return {
        success:     true,
        rows,
        widgetData,
        rowCount:    rows.length,
        columnCount: rows.length > 0 ? Object.keys(rows[0]).length : 0,
        executionMs,
      };
    } catch (err) {
      logger.error({ err: err.message }, 'explore/bigquery failed');
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['queries'],
      summary: 'Ad-hoc BigQuery SQL query',
      description: 'Run an unsaved BigQuery SQL query and get raw rows + widget data. Caps at 200 rows.',
    },
  });

function extractRawSeries(timeSeries) {
  if (!timeSeries?.length) return [];
  const rows = [];
  for (const ts of timeSeries) {
    const labels = {
      ...(ts.resource?.labels || {}),
      ...(ts.metric?.labels  || {}),
    };
    for (const point of (ts.points || []).slice(0, 100)) {
      const v = point.value;
      rows.push({
        timestamp: point.interval?.endTime?.seconds
          ? new Date(point.interval.endTime.seconds * 1000)
              .toISOString().replace('T', ' ').slice(0, 19)
          : '',
        value: Number(v.doubleValue || v.int64Value || v.distributionValue?.mean || 0),
        ...labels,
      });
    }
  }
  return rows.slice(0, 500);
}

function transformBqRows(rows, widgetType) {
  if (!rows?.length) return null;
  const cols   = Object.keys(rows[0]);
  const numCol = cols.find(c => typeof rows[0][c] === 'number');
  const strCol = cols.find(c => typeof rows[0][c] === 'string');
  if (!numCol) return null;

  switch (widgetType) {
    case 'big-number':
    case 'stat-card':
      return { value: rows[0][numCol], sparkline: rows.slice(1, 21).map(r => r[numCol] || 0), unit: '' };
    case 'gauge':
      return { value: rows[0][numCol], min: 0, max: 100, unit: '' };
    case 'bar-chart':
      return {
        bars: rows.slice(0, 10).map(r => ({
          label: strCol ? String(r[strCol]) : String(r[numCol]),
          value: r[numCol] || 0,
        })),
      };
    case 'line-chart':
      return {
        series: [{ label: numCol, data: rows.map(r => r[numCol] || 0) }],
        timestamps: [],
      };
    default:
      return { value: rows[0][numCol], unit: '' };
  }
}
