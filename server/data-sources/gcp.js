// ===========================================================================
// GCP Data Source Plugin — Google Cloud Platform monitoring
// ===========================================================================

import { DataSource } from './base.js';

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
      console.log('[gcp] GCP data source initialized');
    } catch (error) {
      console.error('[gcp] Failed to initialize:', error.message);
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
      // For backward compatibility, fetch entire dashboard metrics
      const dashboardId = widgetConfig.dashboardId || 'platform-overview';
      const allMetrics = await this.gcpMetrics.getMetrics(dashboardId);

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
   * Test connection to GCP
   */
  async testConnection() {
    try {
      if (!this.gcpMetrics) {
        await this.initialize();
      }
      return this.isConnected;
    } catch (error) {
      console.error('[gcp] Connection test failed:', error.message);
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
  transformData(raw, widgetType) {
    // GCP data is already in the correct format
    return raw;
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
