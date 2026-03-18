// ===========================================================================
// Computed Data Source — wraps named gcp-metrics.js functions as queryable entities
// ===========================================================================

import { DataSource } from './base.js';
import { getQuery } from '../query-manager.js';
import logger from '../logger.js';

// Registry maps function name strings to callables from gcp-metrics.js.
// Lazy-imported to avoid circular deps and heavy GCP client init at startup.
const FUNCTION_REGISTRY = {
  storageVolume:             async (p, wc) => (await import('../gcp-metrics.js')).storageVolume(p, wc),
  fleetHealth:               async (p, wc) => (await import('../gcp-metrics.js')).fleetHealth(p, wc),
  serviceLatency:            async (p, wc) => (await import('../gcp-metrics.js')).serviceLatency(p, wc),
  campaignDeliveryMapWidget:       async (p, wc) => (await import('../gcp-metrics.js')).campaignDeliveryMapWidget(p, wc),
  campaignDeliveryMapClientWidget:  async (p, wc) => (await import('../gcp-metrics.js')).campaignDeliveryMapClientWidget(p, wc),
  coreClusterSize:           async (p, wc) => (await import('../gcp-metrics.js')).coreClusterSize(p, wc),
  pipelineFlow:              async (p, wc) => (await import('../gcp-metrics.js')).pipelineFlow(p, wc),
  bidderErrorRate:           async (p, wc) => (await import('../gcp-metrics.js')).bidderErrorRate(p, wc),
  bidderTimeoutRate:         async (p, wc) => (await import('../gcp-metrics.js')).bidderTimeoutRate(p, wc),
};

export class ComputedDataSource extends DataSource {
  constructor() {
    super('computed');
    this.isConnected = true; // always connected — functions are local
  }

  async fetchMetrics(widgetConfig) {
    const startTime = Date.now();
    try {
      const entry = await getQuery('computed', widgetConfig.queryId);

      if (!entry) {
        logger.warn({ queryId: widgetConfig.queryId }, '[computed] query not found — returning empty');
        return {
          timestamp: new Date().toISOString(),
          source:    'computed',
          data:      {},
          rawData:   [],
          widgetId:  widgetConfig.id,
          queryId:   widgetConfig.queryId,
        };
      }

      const fn = FUNCTION_REGISTRY[entry.function];
      if (!fn) {
        logger.error({ function: entry.function }, '[computed] function not in registry');
        return { timestamp: new Date().toISOString(), source: 'computed', data: {}, rawData: [], widgetId: widgetConfig.id, queryId: widgetConfig.queryId };
      }

      const result = await fn(entry.params || {}, widgetConfig);
      logger.info({ queryId: widgetConfig.queryId, ms: Date.now() - startTime }, '[computed] fetchMetrics ok');

      return {
        timestamp: new Date().toISOString(),
        source:    'computed',
        data:      result.data   ?? {},
        rawData:   result.rawData ?? [],
        widgetId:  widgetConfig.id,
        queryId:   widgetConfig.queryId,
      };
    } catch (err) {
      logger.error({ err: err.message, queryId: widgetConfig.queryId }, '[computed] fetchMetrics failed');
      return { timestamp: new Date().toISOString(), source: 'computed', data: {}, rawData: [], widgetId: widgetConfig.id, queryId: widgetConfig.queryId };
    }
  }

  async testConnection() {
    return true;
  }

  getConfigSchema() {
    return {
      name:        'Computed',
      description: 'Named server-side computed metric functions',
      fields:      [],
    };
  }
}

export const computedDataSource = new ComputedDataSource();
