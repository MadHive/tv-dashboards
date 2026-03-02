// ===========================================================================
// BigQuery Data Source Plugin — Google Cloud BigQuery
// ===========================================================================

import { DataSource } from './base.js';
import { BigQuery } from '@google-cloud/bigquery';
import { metricsCollector } from '../metrics.js';
import logger from '../logger.js';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * BigQuery data source for custom SQL queries
 * Allows users to define and save custom queries for metrics
 */
export class BigQueryDataSource extends DataSource {
  constructor(config = {}) {
    super('bigquery', config);
    this.client = null;
    this.queryCache = new Map();
    this.projectId = config.projectId || process.env.GCP_PROJECT_ID || 'mad-master';
    this.credentials = config.credentials || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    // Note: Saved queries now managed by query-manager.js
  }

  /**
   * Initialize BigQuery client
   */
  async initialize() {
    try {
      const clientConfig = {
        projectId: this.projectId
      };

      if (this.credentials && typeof this.credentials === 'string') {
        clientConfig.keyFilename = this.credentials;
      }

      this.client = new BigQuery(clientConfig);
      this.isConnected = true;
      logger.info('[bigquery] Initialized for project: ${this.projectId}');
    } catch (error) {
      logger.error({ error: error.message }, 'BigQuery initialization failed');
      this.lastError = error;
      this.isConnected = false;
    }
  }

  /**
   * Execute a BigQuery SQL query
   * @param {string} sql - SQL query string
   * @param {object} params - Query parameters
   * @param {boolean} useCache - Whether to use cache
   */
  async executeQuery(sql, params = {}, useCache = true) {
    if (!this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('BigQuery client not initialized');
    }

    // Check cache
    const cacheKey = `${sql}:${JSON.stringify(params)}`;
    if (useCache && this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        logger.info('[bigquery] Cache hit');
        metricsCollector.recordCacheHit();
        return cached.data;
      }
    }

    metricsCollector.recordCacheMiss();

    const startTime = Date.now();
    try {
      const options = {
        query: sql,
        params: params,
        location: 'US',
      };

      const [job] = await this.client.createQueryJob(options);
      logger.info('[bigquery] Job ${job.id} started');

      const [rows] = await job.getQueryResults();

      const duration = Date.now() - startTime;
      metricsCollector.recordDataSourceQuery('bigquery', duration, false);

      // Cache results
      if (useCache) {
        this.queryCache.set(cacheKey, {
          data: rows,
          timestamp: Date.now()
        });
        metricsCollector.recordCacheSet();
      }

      return rows;
    } catch (error) {
      const duration = Date.now() - startTime;
      metricsCollector.recordDataSourceQuery('bigquery', duration, true);
      logger.error({ error: error.message }, 'BigQuery query failed');
      throw error;
    }
  }

  /**
   * DEPRECATED: Saved queries are now managed by query-manager.js
   * These methods maintained for backward compatibility with bigquery-routes.js
   */
  async saveQuery(queryId, queryDef) {
    const { saveQuery } = await import('../query-manager.js');
    const query = {
      id: queryId,
      ...queryDef
    };
    const result = await saveQuery('bigquery', query);
    return result.query;
  }

  async getSavedQuery(queryId) {
    const { getQuery } = await import('../query-manager.js');
    return await getQuery('bigquery', queryId);
  }

  async listSavedQueries() {
    const { listQueries } = await import('../query-manager.js');
    return await listQueries('bigquery');
  }

  async deleteSavedQuery(queryId) {
    const { deleteQuery } = await import('../query-manager.js');
    const result = await deleteQuery('bigquery', queryId);
    return result.success;
  }

  /**
   * Extract time period from query description
   * @param {string} description - Query description text
   * @returns {string|null} Human-readable time period or null
   */
  extractTimePeriod(description) {
    if (!description) return null;

    // Match patterns like "last 30 days", "last 1 hour", etc.
    const match = description.match(/last\s+\d+\s+(day|hour|minute|week|month)s?/i);
    if (match) {
      // Capitalize first letter
      return match[0].charAt(0).toUpperCase() + match[0].slice(1);
    }
    return null;
  }

  /**
   * Fetch metrics using widget config
   */
  async fetchMetrics(widgetConfig) {
    try {
      let rows;
      let timePeriod = null;

      // Check if widget has a saved query reference
      if (widgetConfig.queryId) {
        // Load query from query-manager
        const { getQuery } = await import('../query-manager.js');
        const savedQuery = await getQuery('bigquery', widgetConfig.queryId);

        if (!savedQuery) {
          throw new Error(`Saved query not found: ${widgetConfig.queryId}`);
        }

        // Extract time period from query description
        timePeriod = this.extractTimePeriod(savedQuery.description);

        // Execute saved query
        rows = await this.executeQuery(
          savedQuery.sql,
          savedQuery.params || {},
          true
        );

        // Apply custom transform if defined
        if (savedQuery.transform && typeof savedQuery.transform === 'function') {
          rows = savedQuery.transform(rows);
        }
      } else if (widgetConfig.sql) {
        // Execute inline SQL
        rows = await this.executeQuery(
          widgetConfig.sql,
          widgetConfig.params || {},
          true
        );
      } else {
        throw new Error('No query defined for widget');
      }

      // Transform data for widget type with time period metadata
      const transformed = this.transformData(rows, widgetConfig.type, { timePeriod });

      return {
        timestamp: new Date().toISOString(),
        source: 'bigquery',
        data: transformed,
        widgetId: widgetConfig.id,
        rowCount: rows.length
      };
    } catch (error) {
      return this.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Test connection to BigQuery
   */
  async testConnection() {
    try {
      if (!this.client) {
        await this.initialize();
      }

      // Simple test query
      const [rows] = await this.client.query({
        query: 'SELECT 1 as test',
        location: 'US'
      });

      return rows.length > 0;
    } catch (error) {
      logger.error({ error: error.message }, 'BigQuery connection test failed');
      return false;
    }
  }

  /**
   * List available datasets
   */
  async listDatasets() {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const [datasets] = await this.client.getDatasets();
      return datasets.map(ds => ({
        id: ds.id,
        name: ds.metadata.friendlyName || ds.id,
        location: ds.metadata.location,
        created: ds.metadata.creationTime
      }));
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to list BigQuery datasets');
      return [];
    }
  }

  /**
   * List tables in a dataset
   */
  async listTables(datasetId) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const dataset = this.client.dataset(datasetId);
      const [tables] = await dataset.getTables();
      return tables.map(t => ({
        id: t.id,
        name: t.metadata.friendlyName || t.id,
        type: t.metadata.type,
        numRows: t.metadata.numRows,
        numBytes: t.metadata.numBytes,
        created: t.metadata.creationTime
      }));
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to list BigQuery tables');
      return [];
    }
  }

  /**
   * Get table schema
   */
  async getTableSchema(datasetId, tableId) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const dataset = this.client.dataset(datasetId);
      const table = dataset.table(tableId);
      const [metadata] = await table.getMetadata();

      return {
        fields: metadata.schema.fields.map(f => ({
          name: f.name,
          type: f.type,
          mode: f.mode,
          description: f.description
        })),
        numRows: metadata.numRows,
        numBytes: metadata.numBytes
      };
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get BigQuery table schema');
      return null;
    }
  }

  /**
   * Validate SQL query syntax
   */
  async validateQuery(sql) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const options = {
        query: sql,
        dryRun: true,
        location: 'US'
      };

      const [job] = await this.client.createQueryJob(options);
      const [metadata] = await job.getMetadata();

      return {
        valid: true,
        bytesProcessed: metadata.statistics.totalBytesProcessed,
        estimatedCost: this.estimateQueryCost(metadata.statistics.totalBytesProcessed)
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Estimate query cost (approximate)
   * BigQuery pricing: $5 per TB processed
   */
  estimateQueryCost(bytesProcessed) {
    const TB = 1024 * 1024 * 1024 * 1024;
    const costPerTB = 5;
    return ((parseInt(bytesProcessed) / TB) * costPerTB).toFixed(4);
  }

  /**
   * Get configuration schema
   */
  getConfigSchema() {
    return {
      name: 'BigQuery',
      description: 'Execute custom SQL queries against Google BigQuery',
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
          type: 'file',
          required: false,
          description: 'Service account key file (uses GOOGLE_APPLICATION_CREDENTIALS env var if not provided)',
          secure: true,
          envVar: 'GOOGLE_APPLICATION_CREDENTIALS'
        },
        {
          name: 'queryId',
          type: 'string',
          required: false,
          description: 'ID of saved query to use'
        },
        {
          name: 'sql',
          type: 'textarea',
          required: false,
          description: 'Inline SQL query (alternative to queryId)'
        },
        {
          name: 'params',
          type: 'json',
          required: false,
          description: 'Query parameters as JSON object'
        }
      ]
    };
  }

  /**
   * Transform query results to widget format
   * @param {Array} rows - Query result rows
   * @param {string} widgetType - Widget type
   * @param {object} options - Transform options
   * @param {string} options.timePeriod - Time period metadata
   */
  transformData(rows, widgetType, options = {}) {
    const { timePeriod } = options;

    if (!rows || rows.length === 0) {
      return this.getEmptyData(widgetType);
    }

    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        // Expect single row with 'value' column
        const row = rows[0];
        return {
          value: row.value !== undefined ? row.value : Object.values(row)[0],
          label: row.label,
          trend: row.trend,
          unit: row.unit,
          ...(timePeriod && { timePeriod })
        };
      }

      case 'gauge': {
        const row = rows[0];
        return {
          value: row.value !== undefined ? row.value : Object.values(row)[0],
          min: row.min || 0,
          max: row.max || 100,
          unit: row.unit || '%',
          thresholds: {
            warning: row.warning,
            critical: row.critical
          },
          ...(timePeriod && { timePeriod })
        };
      }

      case 'bar-chart': {
        // Expect rows with 'label' and 'value' columns
        return {
          values: rows.map(row => ({
            label: row.label || row.name,
            value: row.value !== undefined ? row.value : row.count,
            color: row.color
          })),
          ...(timePeriod && { timePeriod })
        };
      }

      case 'line-chart': {
        // Expect rows with 'timestamp' and value columns
        // Group by series name if present
        const seriesMap = new Map();
        const timestamps = [];

        rows.forEach(row => {
          const series = row.series || 'value';
          if (!seriesMap.has(series)) {
            seriesMap.set(series, []);
          }
          seriesMap.get(series).push(row.value);

          if (!timestamps.includes(row.timestamp)) {
            timestamps.push(row.timestamp);
          }
        });

        return {
          series: Array.from(seriesMap.entries()).map(([label, data]) => ({
            label,
            data,
            color: rows.find(r => (r.series || 'value') === label)?.color
          })),
          timestamps,
          ...(timePeriod && { timePeriod })
        };
      }

      default:
        // Return raw rows for custom widget types
        return { rows };
    }
  }

  /**
   * Get mock data for testing
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
        return { value: 12345, trend: 'up', unit: '' };

      case 'gauge':
        return { value: 75, min: 0, max: 100, unit: '%' };

      case 'bar-chart':
        return {
          values: [
            { label: 'Series 1', value: 100 },
            { label: 'Series 2', value: 200 },
            { label: 'Series 3', value: 150 }
          ]
        };

      default:
        return this.getEmptyData(widgetType);
    }
  }

  /**
   * Get available metrics (returns saved queries)
   */
  async getAvailableMetrics() {
    const { listQueries } = await import('../query-manager.js');
    const queries = await listQueries('bigquery');

    return queries.map(q => ({
      id: q.id,
      name: q.name,
      description: q.description,
      type: 'custom',
      widgets: q.widgetTypes
    }));
  }
}

// Create singleton instance
export const bigQueryDataSource = new BigQueryDataSource();
