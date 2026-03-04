// ===========================================================================
// Data Source Registry — Central registry for all data source plugins
// ===========================================================================

import { gcpDataSource } from './data-sources/gcp.js';
import { mockDataSource } from './data-sources/mock.js';
import { vulnTrackDataSource } from './data-sources/vulntrack.js';
import { awsDataSource } from './data-sources/aws.js';
import { dataDogDataSource } from './data-sources/datadog.js';
import { elasticsearchDataSource } from './data-sources/elasticsearch.js';
import { salesforceDataSource } from './data-sources/salesforce.js';
import { hotJarDataSource } from './data-sources/hotjar.js';
import { fullStoryDataSource } from './data-sources/fullstory.js';
import { zendeskDataSource } from './data-sources/zendesk.js';
import { bigQueryDataSource } from './data-sources/bigquery.js';
import { checklyDataSource } from './data-sources/checkly.js';
import { chromaticDataSource } from './data-sources/chromatic.js';
import { lookerDataSource } from './data-sources/looker.js';
import { rollbarDataSource } from './data-sources/rollbar.js';
import { rootlyDataSource } from './data-sources/rootly.js';
import { segmentDataSource } from './data-sources/segment.js';
import { computedDataSource } from './data-sources/computed.js';
import logger from './logger.js';

/**
 * Central registry for managing data source plugins
 */
class DataSourceRegistry {
  constructor() {
    this.sources = new Map();
    this.initialized = false;
  }

  /**
   * Register all data sources
   */
  async initialize() {
    if (this.initialized) return;

    logger.info('Initializing data source registry');

    // Register all data sources
    this.register(gcpDataSource);
    this.register(mockDataSource);
    this.register(vulnTrackDataSource);
    this.register(awsDataSource);
    this.register(dataDogDataSource);
    this.register(elasticsearchDataSource);
    this.register(salesforceDataSource);
    this.register(hotJarDataSource);
    this.register(fullStoryDataSource);
    this.register(zendeskDataSource);
    this.register(bigQueryDataSource);
    this.register(checklyDataSource);
    this.register(chromaticDataSource);
    this.register(lookerDataSource);
    this.register(rollbarDataSource);
    this.register(rootlyDataSource);
    this.register(segmentDataSource);
    this.register(computedDataSource);

    // Initialize all sources
    const initPromises = Array.from(this.sources.values()).map(source =>
      source.initialize().catch(err =>
        logger.warn({ dataSource: source.name, error: err.message }, 'Failed to initialize data source')
      )
    );

    await Promise.all(initPromises);

    this.initialized = true;
    logger.info({ count: this.sources.size }, 'Registered data sources');
  }

  /**
   * Register a data source
   */
  register(dataSource) {
    if (this.sources.has(dataSource.name)) {
      logger.warn({ dataSource: dataSource.name }, 'Data source already registered');
      return;
    }

    this.sources.set(dataSource.name, dataSource);
    logger.info({ dataSource: dataSource.name }, 'Registered data source');
  }

  /**
   * Get a data source by name
   */
  getSource(sourceName) {
    const source = this.sources.get(sourceName);
    if (!source) {
      throw new Error(`Data source not found: ${sourceName}`);
    }
    return source;
  }

  /**
   * Get all registered data sources
   */
  getAllSources() {
    return Array.from(this.sources.values());
  }

  /**
   * Get data source configuration schemas
   */
  getSchemas() {
    const schemas = {};
    for (const [name, source] of this.sources.entries()) {
      schemas[name] = source.getConfigSchema();
    }
    return schemas;
  }

  /**
   * Fetch metrics for a widget using the appropriate data source
   */
  async fetchMetrics(widgetConfig, dashboardId) {
    const sourceName = widgetConfig.source || 'mock';

    // Check if source exists
    if (!this.sources.has(sourceName)) {
      logger.warn({ dataSource: sourceName }, 'Unknown data source, falling back to mock');
      return mockDataSource.fetchMetrics({ ...widgetConfig, dashboardId });
    }

    const source = this.sources.get(sourceName);

    // Validate widget config
    const validationErrors = source.validateWidgetConfig(widgetConfig);
    if (validationErrors.length > 0) {
      logger.warn({ dataSource: sourceName, errors: validationErrors }, 'Widget validation failed');
      // Fall back to mock data on validation error
      return mockDataSource.fetchMetrics({ ...widgetConfig, dashboardId });
    }

    try {
      // Fetch from data source
      return await source.fetchMetrics({ ...widgetConfig, dashboardId });
    } catch (error) {
      logger.error({ dataSource: sourceName, error: error.message }, 'Error fetching from data source');
      // Return error-handled data (which may include mock fallback)
      return source.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Fetch all metrics for a dashboard
   * This maintains backward compatibility with the current dashboard-level fetching
   */
  async fetchDashboardMetrics(dashboardId, dashboardConfig) {
    const results = {};

    // If no widgets defined, use legacy getData function
    if (!dashboardConfig?.widgets || dashboardConfig.widgets.length === 0) {
      // Fall back to legacy behavior
      const source = this.sources.get('gcp');
      if (source && source.gcpMetrics) {
        try {
          return await source.gcpMetrics.getMetrics(dashboardId);
        } catch (err) {
          logger.error({ error: err.message }, 'Legacy GCP fetch failed, using mock');
        }
      }
      return mockDataSource.fetchMetrics({ dashboardId, type: 'dashboard' });
    }

    // Fetch metrics for each widget
    const promises = dashboardConfig.widgets.map(async (widget) => {
      try {
        const data = await this.fetchMetrics(widget, dashboardId);
        return { widgetId: widget.id, data };
      } catch (error) {
        logger.error({ widgetId: widget.id, error: error.message }, 'Failed to fetch widget');
        return { widgetId: widget.id, data: { error: error.message } };
      }
    });

    const widgetResults = await Promise.all(promises);

    // Organize results by widget ID
    widgetResults.forEach(({ widgetId, data }) => {
      results[widgetId] = data.data || data;
    });

    return results;
  }

  /**
   * Test connection to a specific data source
   */
  async testConnection(sourceName) {
    const source = this.getSource(sourceName);
    return await source.testConnection();
  }

  /**
   * Re-initialize a single data source after credential changes.
   * Resets connection state then calls initialize() again so it picks
   * up new process.env values without a full server restart.
   */
  async reinitializeSource(sourceName) {
    const source = this.getSource(sourceName);
    source.isConnected = false;
    source.lastError   = null;

    // Refresh credential fields from process.env so the in-memory instance
    // picks up values written to .env by the credentials endpoint.
    // This handles module-level constants that were evaluated at startup.
    const ENV_CREDENTIAL_MAP = {
      vulntrack:     { apiKey: 'VULNTRACK_API_KEY', apiUrl: 'VULNTRACK_API_URL' },
      bigquery:      { credentials: 'GOOGLE_APPLICATION_CREDENTIALS' },
      gcp:           { credentials: 'GOOGLE_APPLICATION_CREDENTIALS' },
      datadog:       { apiKey: 'DATADOG_API_KEY', appKey: 'DATADOG_APP_KEY' },
      elasticsearch: { apiKey: 'ELASTICSEARCH_API_KEY', host: 'ELASTICSEARCH_HOST' },
      aws:           { accessKeyId: 'AWS_ACCESS_KEY_ID', secretAccessKey: 'AWS_SECRET_ACCESS_KEY' },
    };

    const credMap = ENV_CREDENTIAL_MAP[sourceName];
    if (credMap) {
      for (const [field, envVar] of Object.entries(credMap)) {
        const val = process.env[envVar];
        if (val !== undefined) source[field] = val;
      }
    }

    await source.initialize();
    logger.info({ sourceName, isConnected: source.isConnected }, 'Data source reinitialized');
    return source;
  }

  /**
   * Get available metrics for a data source
   */
  getAvailableMetrics(sourceName) {
    const source = this.getSource(sourceName);
    return source.getAvailableMetrics();
  }

  /**
   * Get health status of all data sources
   */
  getHealth() {
    const health = {};
    for (const [name, source] of this.sources.entries()) {
      health[name] = {
        isConnected: source.isConnected,
        lastError: source.lastError?.message || null,
        isReady: source.isReady()
      };
    }
    return health;
  }
}

// Create and export singleton instance
export const dataSourceRegistry = new DataSourceRegistry();

// Initialize on import
dataSourceRegistry.initialize().catch(err =>
  logger.error({ error: err.message || String(err) }, 'Failed to initialize data source registry')
);
