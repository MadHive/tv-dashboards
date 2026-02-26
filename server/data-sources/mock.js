// ===========================================================================
// Mock Data Source Plugin — Wraps existing mock-data.js
// ===========================================================================

import { DataSource } from './base.js';
import { getMetrics as getMockMetrics } from '../mock-data.js';

/**
 * Mock data source for testing and fallback
 */
export class MockDataSource extends DataSource {
  constructor() {
    super('mock', {});
  }

  /**
   * Fetch metrics for a widget
   */
  async fetchMetrics(widgetConfig) {
    try {
      // For backward compatibility, we fetch the entire dashboard's metrics
      // In a real implementation, this would query per-widget
      const dashboardId = widgetConfig.dashboardId || 'platform-overview';
      const allMetrics = getMockMetrics(dashboardId);

      // Extract widget-specific data if available
      const widgetId = widgetConfig.id;
      const widgetData = allMetrics[widgetId] || allMetrics;

      return {
        timestamp: new Date().toISOString(),
        source: 'mock',
        data: widgetData,
        widgetId: widgetId,
        dashboardId: dashboardId
      };
    } catch (error) {
      return this.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Test connection (always succeeds for mock data)
   */
  async testConnection() {
    return true;
  }

  /**
   * Get configuration schema
   */
  getConfigSchema() {
    return {
      name: 'Mock Data Source',
      description: 'Generates realistic mock data for testing',
      fields: [
        {
          name: 'dashboardId',
          type: 'string',
          required: false,
          description: 'Dashboard ID to fetch mock data for',
          default: 'platform-overview'
        }
      ]
    };
  }

  /**
   * Transform raw data to widget format
   */
  transformData(raw, widgetType) {
    // Mock data is already in the correct format
    return raw;
  }

  /**
   * Get mock data for a widget type
   */
  getMockData(widgetType) {
    // Mock data is the primary data, so just return empty structure
    return this.getEmptyData(widgetType);
  }

  /**
   * Get available metrics
   */
  getAvailableMetrics() {
    return [
      {
        id: 'bids-served',
        name: 'Bids Served',
        description: 'Total number of bids served',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'bar-chart']
      },
      {
        id: 'impressions-delivered',
        name: 'Impressions Delivered',
        description: 'Total impressions delivered',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'platform-uptime',
        name: 'Platform Uptime',
        description: 'Platform uptime percentage',
        type: 'percentage',
        widgets: ['gauge', 'gauge-row']
      },
      {
        id: 'events-processed',
        name: 'Events Processed',
        description: 'Number of events processed',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'bar-chart']
      }
    ];
  }

  /**
   * Validate widget configuration
   */
  validateWidgetConfig(widgetConfig) {
    const errors = super.validateWidgetConfig(widgetConfig);

    // Mock data doesn't require specific configuration
    return errors;
  }
}

// Create singleton instance
export const mockDataSource = new MockDataSource();
