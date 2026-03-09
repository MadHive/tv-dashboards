// ===========================================================================
// GCP Data Source Plugin — Google Cloud Platform monitoring
// ===========================================================================

import { DataSource } from './base.js';
import { metricsCollector } from '../metrics.js';
import logger from '../logger.js';

/**
 * GCP Cloud Monitoring data source
 */
export class GCPDataSource extends DataSource {
  constructor(config = {}) {
    super('gcp', config);
    this.gcpMetrics = null;
  }

  /**
   * Initialize GCP client
   */
  async initialize() {
    try {
      // Lazy load GCP metrics module
      const gcpModule = await import('../gcp-metrics.js');
      this.gcpMetrics = gcpModule;
      this.isConnected = true;
      logger.info('[gcp] GCP data source initialized');
    } catch (error) {
      logger.error({ error: error.message }, 'GCP data source failed to initialize');
      this.lastError = error;
      this.isConnected = false;
    }
  }

  /**
   * Fetch metrics for a widget
   */
  async fetchMetrics(widgetConfig) {
    if (!this.gcpMetrics) {
      await this.initialize();
    }

    if (!this.gcpMetrics) {
      throw new Error('GCP metrics module not available');
    }

    try {
      // Check if widget uses a saved query
      if (widgetConfig.queryId) {
        return await this.executeQuery(widgetConfig);
      }

      // For backward compatibility, fetch entire dashboard metrics via legacy path
      const dashboardId = widgetConfig.dashboardId || 'platform-overview';
      const allMetrics = await this.gcpMetrics.getMetrics(dashboardId, widgetConfig);

      // Extract widget-specific data if available
      const widgetId = widgetConfig.id;
      const widgetData = allMetrics[widgetId] || allMetrics;

      return {
        timestamp: new Date().toISOString(),
        source: 'gcp',
        data: widgetData,
        widgetId: widgetId,
        dashboardId: dashboardId
      };
    } catch (error) {
      return this.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Execute a saved query from query-manager
   */
  async executeQuery(widgetConfig) {
    const startTime = Date.now();
    try {
      // Load saved query
      const { getQuery } = await import('../query-manager.js');
      const savedQuery = await getQuery('gcp', widgetConfig.queryId);

      if (!savedQuery) {
        throw new Error(`Saved query not found: ${widgetConfig.queryId}`);
      }

      // Execute GCP monitoring query
      const timeSeries = await this.gcpMetrics.query(
        savedQuery.project || 'mad-master',
        savedQuery.metricType,
        (typeof savedQuery.filters === 'string' ? savedQuery.filters : '') || '',
        savedQuery.timeWindow || 10,
        savedQuery.aggregation
      );

      // Calculate human-readable time period
      const timeWindow = savedQuery.timeWindow || 10;
      const timePeriod = timeWindow >= 60
        ? `Last ${Math.round(timeWindow / 60)} hr`
        : `Last ${timeWindow} min`;

      // Transform data for widget type with time period metadata
      const transformed = this.transformData(timeSeries, widgetConfig.type, {
        timePeriod,
        max:   widgetConfig.max,
        unit:  widgetConfig.unit,
        scale: savedQuery.scale,
      });

      // Record successful query
      const duration = Date.now() - startTime;
      metricsCollector.recordDataSourceQuery('gcp', duration, false);

      return {
        timestamp: new Date().toISOString(),
        source: 'gcp',
        data: transformed,
        widgetId: widgetConfig.id,
        queryId: widgetConfig.queryId,
        metricType: savedQuery.metricType
      };
    } catch (error) {
      // Record failed query
      const duration = Date.now() - startTime;
      metricsCollector.recordDataSourceQuery('gcp', duration, true);
      return this.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Test connection to GCP
   */
  async testConnection() {
    try {
      if (!this.gcpMetrics) {
        await this.initialize();
      }
      return this.isConnected;
    } catch (error) {
      logger.error({ error: error.message }, 'GCP connection test failed');
      return false;
    }
  }

  /**
   * Get configuration schema
   */
  getConfigSchema() {
    return {
      name: 'Google Cloud Platform',
      description: 'Fetch metrics from GCP Cloud Monitoring',
      fields: [
        {
          name: 'projectId',
          type: 'string',
          required: true,
          description: 'GCP Project ID',
          default: 'mad-master'
        },
        {
          name: 'credentials',
          type: 'json',
          required: false,
          description: 'GCP service account credentials (uses GOOGLE_APPLICATION_CREDENTIALS env var if not provided)',
          secure: true
        }
      ]
    };
  }

  /**
   * Transform raw data to widget format
   */
  transformData(timeSeries, widgetType, options = {}) {
    // If data is already transformed (from dashboard), return as-is
    if (!Array.isArray(timeSeries)) return timeSeries;
    if (timeSeries.length === 0) return this.getEmptyData(widgetType);

    // Check if this looks like GCP time series data
    const isTimeSeries = timeSeries[0]?.points !== undefined;
    if (!isTimeSeries) {
      return timeSeries; // Already transformed
    }

    // Import helper functions for transformation
    const transformers = {
      'big-number': (ts) => {
        const { latest } = require('../gcp-metrics.js');
        return {
          value: latest(ts),
          unit: '',
          trend: null,
          ...(options.timePeriod && { timePeriod: options.timePeriod })
        };
      },
      'stat-card': (ts) => {
        const { latest, spark } = require('../gcp-metrics.js');
        return {
          value: latest(ts),
          sparkline: spark(ts, 20),
          unit: '',
          ...(options.timePeriod && { timePeriod: options.timePeriod })
        };
      },
      'gauge': (ts) => {
        const { latest } = require('../gcp-metrics.js');
        let val = latest(ts);
        // Some GCP metrics report in microseconds despite _ms names — convert if value is unreasonably large
        const cfgUnit = options.unit || '';
        if (cfgUnit === 'ms' && val !== null && val > 10000) val = Math.round(val / 1000);
        return {
          value: val,
          min: 0,
          max: options.max || 100,
          unit: cfgUnit,
          ...(options.timePeriod && { timePeriod: options.timePeriod })
        };
      },
      'line-chart': (ts) => {
        const { spark } = require('../gcp-metrics.js');
        if (!Array.isArray(ts) || ts.length === 0) {
          return { series: [], timestamps: [], ...(options.timePeriod && { timePeriod: options.timePeriod }) };
        }

        // Sort by descending point count then total value, cap at 8 series
        const scored = ts.map(series => {
          const pts = series.points || [];
          const total = pts.reduce((s, p) => s + Number(p.value?.doubleValue || p.value?.int64Value || 0), 0);
          return { series, pointCount: pts.length, total };
        });
        scored.sort((a, b) => b.pointCount - a.pointCount || b.total - a.total);
        const top = scored.slice(0, 8).map(s => s.series);

        // Build one series per GCP time series
        const series = top.map((singleTs, idx) => {
          const resourceLabels = (singleTs.resource && singleTs.resource.labels) || {};
          const metricLabels   = (singleTs.metric   && singleTs.metric.labels)   || {};
          const rawLabel =
            resourceLabels.service_name   ||
            metricLabels.subscription_id  ||
            resourceLabels.cluster_name   ||
            Object.values(resourceLabels)[0] ||
            Object.values(metricLabels)[0]   ||
            `Series ${idx + 1}`;
          const label = String(rawLabel).slice(0, 20);
          return {
            label,
            values: spark([singleTs], 30),
          };
        });

        return {
          series,
          timestamps: [],
          ...(options.timePeriod && { timePeriod: options.timePeriod })
        };
      },
      // bar-chart: each time series becomes one bar, labeled by resource/metric labels
      'bar-chart': (ts) => {
        const { latest } = require('../gcp-metrics.js');
        if (!Array.isArray(ts) || ts.length === 0) return { bars: [] };

        // Multi-series: extract label from resource labels (service_name, subscription, etc.)
        const bars = ts.map(series => {
          const labels = (series.resource && series.resource.labels) || {};
          // Pick the most descriptive resource label
          const label = labels.service_name || labels.subscription_id ||
                        labels.topic_id || labels.instance_id ||
                        labels.cluster_name || Object.values(labels)[0] || 'Unknown';
          const val = latest([series]);
          return { label: String(label).replace(/^projects\/[^/]+\//, ''), value: val || 0 };
        });

        // Sort by value descending, take top 10
        bars.sort((a, b) => b.value - a.value);
        return { bars: bars.slice(0, 10), ...(options.timePeriod && { timePeriod: options.timePeriod }) };
      },
      'donut-ring': (ts) => {
        const { latest } = require('../gcp-metrics.js');
        if (!Array.isArray(ts) || ts.length === 0) return { slices: [] };

        const slices = ts.map(series => {
          const resourceLabels = (series.resource && series.resource.labels) || {};
          const metricLabels   = (series.metric   && series.metric.labels)   || {};
          const rawLabel =
            resourceLabels.service_name   ||
            metricLabels.subscription_id  ||
            resourceLabels.cluster_name   ||
            Object.values(resourceLabels)[0] ||
            Object.values(metricLabels)[0]   ||
            'Unknown';
          return {
            label: String(rawLabel).slice(0, 20),
            value: latest([series]) || 0,
          };
        });

        // Sort by value descending, take top 8
        slices.sort((a, b) => b.value - a.value);
        return {
          slices: slices.slice(0, 8),
          ...(options.timePeriod && { timePeriod: options.timePeriod }),
        };
      },
      'table': (ts) => {
        if (!Array.isArray(ts) || !ts.length) return { columns: [], rows: [] };

        // Collect all unique label keys across all series
        const labelKeys = new Set();
        ts.forEach(series => {
          Object.keys(series.resource?.labels || {}).forEach(k => labelKeys.add(k));
          Object.keys(series.metric?.labels   || {}).forEach(k => labelKeys.add(k));
        });
        const labelArr = [...labelKeys];

        const columns = [
          { key: 'timestamp', label: 'Timestamp', align: 'left' },
          ...labelArr.map(k => ({ key: k, label: k, align: 'left' })),
          { key: 'value', label: 'Value', align: 'right', format: 'number' },
        ];

        const rows = [];
        for (const series of ts) {
          const labels = {
            ...(series.resource?.labels || {}),
            ...(series.metric?.labels   || {}),
          };
          for (const point of (series.points || []).slice(0, 50)) {
            const v = point.value;
            rows.push({
              timestamp: point.interval?.endTime?.seconds
                ? new Date(point.interval.endTime.seconds * 1000)
                    .toISOString().replace('T', ' ').slice(0, 19)
                : '',
              ...Object.fromEntries(labelArr.map(k => [k, labels[k] || ''])),
              value: Number(v.doubleValue || v.int64Value || v.distributionValue?.mean || 0),
            });
          }
        }
        return {
          columns,
          rows: rows.slice(0, 200),
          ...(options.timePeriod && { timePeriod: options.timePeriod }),
        };
      },
    };

    const transformer = transformers[widgetType];
    if (transformer) {
      try {
        const result = transformer(timeSeries);

        // Apply scale factor if provided (e.g. scale: 100 to convert 0–1 fractions to %)
        const scale = options.scale;
        if (typeof scale === 'number') {
          // value (big-number, stat-card, gauge) — only if numeric
          if (typeof result.value === 'number') {
            result.value = result.value * scale;
          }
          // sparkline array (stat-card)
          if (Array.isArray(result.sparkline)) {
            result.sparkline = result.sparkline.map(v => (typeof v === 'number' ? v * scale : v));
          }
          // series[].values (line-chart)
          if (Array.isArray(result.series)) {
            result.series = result.series.map(s => ({
              ...s,
              values: Array.isArray(s.values)
                ? s.values.map(v => (typeof v === 'number' ? v * scale : v))
                : s.values,
            }));
          }
          // bars[].value (bar-chart)
          if (Array.isArray(result.bars)) {
            result.bars = result.bars.map(b => ({
              ...b,
              value: typeof b.value === 'number' ? b.value * scale : b.value,
            }));
          }
          // slices[].value (donut-ring)
          if (Array.isArray(result.slices)) {
            result.slices = result.slices.map(s => ({
              ...s,
              value: typeof s.value === 'number' ? s.value * scale : s.value,
            }));
          }
        }

        return result;
      } catch (error) {
        logger.error({ error: error.message }, 'GCP transform error');
        return this.getEmptyData(widgetType);
      }
    }

    // Default: return raw time series
    return timeSeries;
  }

  /**
   * Get mock data for fallback
   */
  getMockData(widgetType) {
    // Use mock data source as fallback
    return this.getEmptyData(widgetType);
  }

  /**
   * Get available metrics
   */
  getAvailableMetrics() {
    return [
      {
        id: 'run/request_count',
        name: 'Cloud Run Requests',
        description: 'Total number of requests to Cloud Run services',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'bar-chart']
      },
      {
        id: 'run/request_latencies',
        name: 'Request Latency',
        description: 'Cloud Run request latencies',
        type: 'distribution',
        widgets: ['gauge', 'bar-chart']
      },
      {
        id: 'bigquery/query/execution_times',
        name: 'BigQuery Execution Time',
        description: 'BigQuery query execution times',
        type: 'distribution',
        widgets: ['gauge', 'stat-card']
      },
      {
        id: 'pubsub/subscription/num_undelivered_messages',
        name: 'Pub/Sub Backlog',
        description: 'Number of undelivered messages',
        type: 'number',
        widgets: ['big-number', 'gauge']
      }
    ];
  }

  /**
   * Validate widget configuration
   */
  validateWidgetConfig(widgetConfig) {
    const errors = super.validateWidgetConfig(widgetConfig);

    // GCP-specific validation can be added here
    if (widgetConfig.gcpMetric && typeof widgetConfig.gcpMetric !== 'string') {
      errors.push('gcpMetric must be a string');
    }

    return errors;
  }
}

// Create singleton instance
export const gcpDataSource = new GCPDataSource();
