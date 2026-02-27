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

    console.log('[registry] Initializing data source registry...');

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

    // Initialize all sources
    const initPromises = Array.from(this.sources.values()).map(source =>
      source.initialize().catch(err =>
        console.warn(`[registry] Failed to initialize ${source.name}:`, err.message)
      )
    );

    await Promise.all(initPromises);

    this.initialized = true;
    console.log(`[registry] Registered ${this.sources.size} data sources`);
  }

  /**
   * Register a data source
   */
  register(dataSource) {
    if (this.sources.has(dataSource.name)) {
      console.warn(`[registry] Data source already registered: ${dataSource.name}`);
      return;
    }

    this.sources.set(dataSource.name, dataSource);
    console.log(`[registry] Registered data source: ${dataSource.name}`);
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
      console.warn(`[registry] Unknown data source: ${sourceName}, falling back to mock`);
      return mockDataSource.fetchMetrics({ ...widgetConfig, dashboardId });
    }

    const source = this.sources.get(sourceName);

    // Validate widget config
    const validationErrors = source.validateWidgetConfig(widgetConfig);
    if (validationErrors.length > 0) {
      console.warn(`[registry] Widget validation failed for ${sourceName}:`, validationErrors);
      // Fall back to mock data on validation error
      return mockDataSource.fetchMetrics({ ...widgetConfig, dashboardId });
    }

    try {
      // Fetch from data source
      return await source.fetchMetrics({ ...widgetConfig, dashboardId });
    } catch (error) {
      console.error(`[registry] Error fetching from ${sourceName}:`, error.message);
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
          console.error('[registry] Legacy GCP fetch failed, using mock:', err.message);
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
        console.error(`[registry] Failed to fetch widget ${widget.id}:`, error.message);
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
  console.error('[registry] Failed to initialize:', err)
);
