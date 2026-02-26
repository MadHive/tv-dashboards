// ===========================================================================
// DataSource Base Class — Abstract interface for data source plugins
// ===========================================================================

/**
 * Abstract base class for data source plugins.
 * All data sources must extend this class and implement required methods.
 */
export class DataSource {
  constructor(name, config = {}) {
    if (new.target === DataSource) {
      throw new Error('DataSource is an abstract class and cannot be instantiated directly');
    }

    this.name = name;
    this.config = config;
    this.isConnected = false;
    this.lastError = null;
  }

  /**
   * Fetch metrics for a widget
   * @param {Object} widgetConfig - Widget configuration including metric queries
   * @returns {Promise<Object>} - Metric data formatted for the widget
   */
  async fetchMetrics(widgetConfig) {
    throw new Error('fetchMetrics() must be implemented by subclass');
  }

  /**
   * Test connection to the data source
   * @returns {Promise<boolean>} - True if connection is successful
   */
  async testConnection() {
    throw new Error('testConnection() must be implemented by subclass');
  }

  /**
   * Get configuration schema for this data source
   * @returns {Object} - Schema describing required configuration fields
   */
  getConfigSchema() {
    throw new Error('getConfigSchema() must be implemented by subclass');
  }

  /**
   * Transform raw data from the source to widget format
   * @param {*} raw - Raw data from the data source
   * @param {string} widgetType - Type of widget requesting the data
   * @returns {Object} - Transformed data matching widget expectations
   */
  transformData(raw, widgetType) {
    throw new Error('transformData() must be implemented by subclass');
  }

  /**
   * Get mock/fallback data for a widget type
   * @param {string} widgetType - Type of widget
   * @returns {Object} - Mock data matching widget expectations
   */
  getMockData(widgetType) {
    throw new Error('getMockData() must be implemented by subclass');
  }

  /**
   * Initialize/authenticate the data source
   * @returns {Promise<void>}
   */
  async initialize() {
    // Default implementation - can be overridden
    try {
      this.isConnected = await this.testConnection();
      if (this.isConnected) {
        console.log(`[${this.name}] Connected successfully`);
      } else {
        console.warn(`[${this.name}] Connection test failed`);
      }
    } catch (error) {
      this.lastError = error;
      console.error(`[${this.name}] Initialization error:`, error.message);
      this.isConnected = false;
    }
  }

  /**
   * Check if data source is ready to serve requests
   * @returns {boolean}
   */
  isReady() {
    return this.isConnected;
  }

  /**
   * Get available metrics for this data source
   * @returns {Array<Object>} - List of available metrics with metadata
   */
  getAvailableMetrics() {
    // Default implementation - can be overridden
    return [];
  }

  /**
   * Validate widget configuration for this data source
   * @param {Object} widgetConfig - Widget configuration to validate
   * @returns {Array<string>} - Array of validation error messages (empty if valid)
   */
  validateWidgetConfig(widgetConfig) {
    const errors = [];

    if (!widgetConfig.type) {
      errors.push('Widget must have a type');
    }

    if (!widgetConfig.id) {
      errors.push('Widget must have an id');
    }

    return errors;
  }

  /**
   * Handle errors and provide fallback data
   * @param {Error} error - The error that occurred
   * @param {string} widgetType - Type of widget
   * @returns {Object} - Fallback data
   */
  handleError(error, widgetType) {
    console.error(`[${this.name}] Error fetching metrics:`, error.message);
    this.lastError = error;

    // Return mock data as fallback
    try {
      return this.getMockData(widgetType);
    } catch (mockError) {
      console.error(`[${this.name}] Failed to get mock data:`, mockError.message);
      return this.getEmptyData(widgetType);
    }
  }

  /**
   * Get empty/placeholder data structure for a widget type
   * @param {string} widgetType - Type of widget
   * @returns {Object} - Empty data structure
   */
  getEmptyData(widgetType) {
    const baseData = {
      timestamp: new Date().toISOString(),
      source: this.name,
      error: this.lastError?.message || 'No data available'
    };

    // Provide basic empty structures based on widget type
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return { ...baseData, value: 0 };

      case 'gauge':
      case 'gauge-row':
        return { ...baseData, value: 0, min: 0, max: 100 };

      case 'bar-chart':
        return { ...baseData, values: [] };

      case 'progress-bar':
        return { ...baseData, progress: 0 };

      case 'status-grid':
        return { ...baseData, items: [] };

      case 'alert-list':
        return { ...baseData, alerts: [] };

      case 'service-heatmap':
        return { ...baseData, services: [] };

      case 'pipeline-flow':
        return { ...baseData, stages: [] };

      case 'usa-map':
        return { ...baseData, locations: [], hotspots: [] };

      case 'security-scorecard':
        return { ...baseData, score: 0, categories: [] };

      default:
        return baseData;
    }
  }
}
