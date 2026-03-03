// ===========================================================================
// Chromatic Data Source Plugin — Visual regression testing
// ===========================================================================

import { DataSource } from './base.js';
import logger from '../logger.js';

const CHROMATIC_API_URL = 'https://www.chromatic.com/api/v1';
const CHROMATIC_GRAPHQL_URL = 'https://index.chromatic.com/graphql';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Chromatic data source for visual regression testing metrics
 *
 * Configuration:
 * - Set CHROMATIC_PROJECT_TOKEN environment variable
 */
export class ChromaticDataSource extends DataSource {
  constructor(config = {}) {
    super('chromatic', config);
    this.projectToken = config.projectToken || process.env.CHROMATIC_PROJECT_TOKEN;
    this.apiUrl = config.apiUrl || CHROMATIC_API_URL;
    this.graphqlUrl = config.graphqlUrl || CHROMATIC_GRAPHQL_URL;
    this.cache = null;
    this.cacheTime = 0;
  }

  /**
   * Initialize Chromatic client
   */
  async initialize() {
    try {
      if (!this.projectToken) {
        logger.warn('[chromatic] No project token found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      // Test connection
      this.isConnected = await this.testConnection();

      if (this.isConnected) {
        logger.info('[chromatic] Chromatic data source initialized');
      } else {
        logger.warn('[chromatic] Connection test failed - using mock data');
      }
    } catch (error) {
      logger.error('[chromatic] Failed to initialize:', error.message);
      this.lastError = error;
      this.isConnected = false;
    }
  }

  /**
   * Fetch builds data from Chromatic API with caching
   */
  async fetchFromAPI() {
    const now = Date.now();
    if (this.cache && now - this.cacheTime < CACHE_TTL) {
      return this.cache;
    }

    if (!this.projectToken) {
      throw new Error('Chromatic project token not configured');
    }

    try {
      // GraphQL query to fetch builds and testing data
      const query = `
        query {
          project {
            name
            builds(first: 20, sortBy: CREATED_AT_DESC) {
              nodes {
                id
                number
                status
                autoAcceptChanges
                changeCount
                componentCount
                specCount
                testCount
                errorCount
                startedAt
                completedAt
                branch
                commit
                uncommittedHash
                isLimited
                actualTestCount
                actualCaptureCount
                changeCount
                reviewedChangeCount
              }
            }
            latestBuild {
              status
              testCount
              changeCount
              errorCount
              componentCount
            }
          }
        }
      `;

      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.projectToken}`
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        logger.error(`[chromatic] API error: ${response.status}`);
        return this.cache || null;
      }

      const result = await response.json();

      if (result.errors) {
        logger.error('[chromatic] GraphQL errors:', result.errors);
        return this.cache || null;
      }

      this.cache = result.data;
      this.cacheTime = now;

      return this.cache;
    } catch (error) {
      logger.error('[chromatic] Fetch error:', error.message);
      return this.cache || null;
    }
  }

  /**
   * Fetch metrics for a widget
   */
  async fetchMetrics(widgetConfig) {
    try {
      if (!this.projectToken) {
        logger.warn('[chromatic] Project token not configured - using mock data');
        return {
          timestamp: new Date().toISOString(),
          source: 'chromatic',
          data: this.getMockData(widgetConfig.type),
          widgetId: widgetConfig.id
        };
      }

      const data = await this.fetchFromAPI();

      if (!data) {
        throw new Error('Failed to fetch Chromatic data');
      }

      // Transform data for widget type
      const transformed = this.transformData(data, widgetConfig.type);

      return {
        timestamp: new Date().toISOString(),
        source: 'chromatic',
        data: transformed,
        widgetId: widgetConfig.id
      };
    } catch (error) {
      return this.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Test connection to Chromatic API
   */
  async testConnection() {
    try {
      if (!this.projectToken) {
        return false;
      }

      // Simple query to test authentication and connectivity
      const query = `
        query {
          project {
            name
          }
        }
      `;

      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.projectToken}`
        },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        logger.error('[chromatic] Connection test failed:', response.status);
        return false;
      }

      const result = await response.json();

      if (result.errors) {
        logger.error('[chromatic] Connection test failed:', result.errors);
        return false;
      }

      logger.info('[chromatic] Connection test successful');
      return true;
    } catch (error) {
      logger.error('[chromatic] Connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get configuration schema
   */
  getConfigSchema() {
    return {
      name: 'Chromatic',
      description: 'Visual regression testing and UI review platform',
      fields: [
        {
          name: 'projectToken',
          type: 'string',
          required: true,
          description: 'Chromatic Project Token',
          secure: true,
          envVar: 'CHROMATIC_PROJECT_TOKEN'
        },
        {
          name: 'apiUrl',
          type: 'string',
          required: false,
          description: 'Chromatic API URL',
          default: CHROMATIC_API_URL
        },
        {
          name: 'graphqlUrl',
          type: 'string',
          required: false,
          description: 'Chromatic GraphQL endpoint',
          default: CHROMATIC_GRAPHQL_URL
        }
      ]
    };
  }

  /**
   * Transform raw Chromatic data to widget format
   */
  transformData(raw, widgetType) {
    const project = raw?.project;
    if (!project) {
      return this.getEmptyData(widgetType);
    }

    const builds = project.builds?.nodes || [];
    const latestBuild = project.latestBuild || builds[0] || {};

    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        // Total builds count
        return {
          value: builds.length,
          trend: this.calculateTrend(builds),
          unit: 'builds'
        };
      }

      case 'gauge':
      case 'gauge-row': {
        // Pass rate: builds without changes / total builds
        const passingBuilds = builds.filter(b => b.changeCount === 0 && b.status === 'PASSED').length;
        const passRate = builds.length > 0 ? Math.round((passingBuilds / builds.length) * 100) : 0;

        return {
          value: passRate,
          min: 0,
          max: 100,
          unit: '%',
          label: 'Pass Rate'
        };
      }

      case 'bar-chart': {
        // Builds by status
        const statusCounts = this.aggregateByStatus(builds);

        return {
          values: Object.entries(statusCounts).map(([status, count]) => ({
            label: status,
            value: count,
            color: this.getStatusColor(status)
          }))
        };
      }

      case 'line-chart':
      case 'sparkline': {
        // Changes over time
        const changeHistory = builds.slice(0, 20).reverse().map(b => ({
          timestamp: b.startedAt,
          value: b.changeCount || 0
        }));

        return {
          labels: changeHistory.map(h => new Date(h.timestamp).toLocaleDateString()),
          values: changeHistory.map(h => h.value),
          series: 'Visual Changes'
        };
      }

      case 'progress-bar': {
        // Review progress: reviewed changes / total changes
        const totalChanges = latestBuild.changeCount || 0;
        const reviewedChanges = latestBuild.reviewedChangeCount || 0;
        const progress = totalChanges > 0 ? Math.round((reviewedChanges / totalChanges) * 100) : 100;

        return {
          progress,
          label: `${reviewedChanges} / ${totalChanges} changes reviewed`
        };
      }

      case 'status-grid': {
        // Recent builds status
        return {
          items: builds.slice(0, 12).map(b => ({
            id: b.id,
            label: `Build #${b.number}`,
            status: this.mapBuildStatus(b.status),
            value: b.changeCount || 0,
            metadata: {
              branch: b.branch,
              tests: b.testCount,
              changes: b.changeCount
            }
          }))
        };
      }

      case 'alert-list': {
        // Builds with changes or errors
        const alerts = builds
          .filter(b => b.changeCount > 0 || b.errorCount > 0)
          .slice(0, 10)
          .map(b => ({
            id: b.id,
            severity: b.errorCount > 0 ? 'critical' : 'warning',
            message: `Build #${b.number}: ${b.changeCount} changes, ${b.errorCount} errors`,
            timestamp: b.startedAt,
            metadata: {
              branch: b.branch,
              commit: b.commit?.substring(0, 7)
            }
          }));

        return {
          alerts
        };
      }

      default:
        return {
          builds: builds.slice(0, 10),
          latestBuild,
          project: project.name
        };
    }
  }

  /**
   * Helper: Calculate trend from recent builds
   */
  calculateTrend(builds) {
    if (builds.length < 2) return 'stable';

    const recent = builds.slice(0, 5);
    const older = builds.slice(5, 10);

    const recentAvg = recent.reduce((sum, b) => sum + (b.changeCount || 0), 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((sum, b) => sum + (b.changeCount || 0), 0) / older.length : recentAvg;

    if (recentAvg > olderAvg) return 'up';
    if (recentAvg < olderAvg) return 'down';
    return 'stable';
  }

  /**
   * Helper: Aggregate builds by status
   */
  aggregateByStatus(builds) {
    const statusCounts = {};

    builds.forEach(build => {
      const status = build.status || 'UNKNOWN';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return statusCounts;
  }

  /**
   * Helper: Map build status to dashboard status
   */
  mapBuildStatus(status) {
    switch (status) {
      case 'PASSED':
        return 'success';
      case 'FAILED':
      case 'BROKEN':
        return 'error';
      case 'PENDING':
      case 'IN_PROGRESS':
        return 'warning';
      case 'DENIED':
        return 'critical';
      default:
        return 'unknown';
    }
  }

  /**
   * Helper: Get color for build status
   */
  getStatusColor(status) {
    switch (status) {
      case 'PASSED':
        return '#10B981'; // green
      case 'FAILED':
      case 'BROKEN':
        return '#EF4444'; // red
      case 'PENDING':
      case 'IN_PROGRESS':
        return '#F59E0B'; // orange
      case 'DENIED':
        return '#DC2626'; // dark red
      default:
        return '#6B7280'; // gray
    }
  }

  /**
   * Get mock data for fallback
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return {
          value: 156,
          trend: 'up',
          unit: 'builds'
        };

      case 'gauge':
      case 'gauge-row':
        return {
          value: 92,
          min: 0,
          max: 100,
          unit: '%',
          label: 'Pass Rate'
        };

      case 'bar-chart':
        return {
          values: [
            { label: 'PASSED', value: 145, color: '#10B981' },
            { label: 'PENDING', value: 8, color: '#F59E0B' },
            { label: 'FAILED', value: 3, color: '#EF4444' }
          ]
        };

      case 'line-chart':
      case 'sparkline': {
        const now = Date.now();
        return {
          labels: Array.from({ length: 20 }, (_, i) =>
            new Date(now - (19 - i) * 86400000).toLocaleDateString()
          ),
          values: Array.from({ length: 20 }, () => Math.floor(Math.random() * 15)),
          series: 'Visual Changes'
        };
      }

      case 'progress-bar':
        return {
          progress: 75,
          label: '15 / 20 changes reviewed'
        };

      case 'status-grid':
        return {
          items: Array.from({ length: 12 }, (_, i) => ({
            id: `build-${i}`,
            label: `Build #${200 - i}`,
            status: Math.random() > 0.8 ? 'warning' : 'success',
            value: Math.floor(Math.random() * 10)
          }))
        };

      case 'alert-list':
        return {
          alerts: [
            {
              id: 'alert-1',
              severity: 'warning',
              message: 'Build #199: 5 visual changes detected',
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              metadata: { branch: 'main' }
            },
            {
              id: 'alert-2',
              severity: 'critical',
              message: 'Build #197: 2 snapshot errors',
              timestamp: new Date(Date.now() - 7200000).toISOString(),
              metadata: { branch: 'feature/ui-updates' }
            }
          ]
        };

      default:
        return this.getEmptyData(widgetType);
    }
  }

  /**
   * Get available Chromatic metrics
   */
  getAvailableMetrics() {
    return [
      {
        id: 'total_builds',
        name: 'Total Builds',
        description: 'Total number of visual testing builds',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'passing_builds',
        name: 'Passing Builds',
        description: 'Number of builds with no visual changes',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'gauge']
      },
      {
        id: 'builds_with_changes',
        name: 'Builds with Changes',
        description: 'Number of builds with visual changes detected',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'bar-chart']
      },
      {
        id: 'snapshots_captured',
        name: 'Snapshots Captured',
        description: 'Total number of UI snapshots captured',
        type: 'number',
        widgets: ['big-number', 'stat-card']
      },
      {
        id: 'changes_detected',
        name: 'Visual Changes Detected',
        description: 'Number of visual changes detected across builds',
        type: 'number',
        widgets: ['big-number', 'line-chart', 'bar-chart']
      },
      {
        id: 'unreviewed_changes',
        name: 'Unreviewed Changes',
        description: 'Number of visual changes pending review',
        type: 'number',
        widgets: ['big-number', 'alert-list', 'progress-bar']
      },
      {
        id: 'build_duration',
        name: 'Build Duration',
        description: 'Average time to complete visual testing builds',
        type: 'duration',
        widgets: ['gauge', 'line-chart']
      },
      {
        id: 'test_coverage',
        name: 'Test Coverage',
        description: 'Percentage of components with visual tests',
        type: 'percentage',
        widgets: ['gauge', 'gauge-row', 'progress-bar']
      },
      {
        id: 'pass_rate',
        name: 'Pass Rate',
        description: 'Percentage of builds passing without changes',
        type: 'percentage',
        widgets: ['gauge', 'gauge-row', 'stat-card']
      },
      {
        id: 'snapshot_errors',
        name: 'Snapshot Errors',
        description: 'Number of snapshot capture errors',
        type: 'number',
        widgets: ['big-number', 'alert-list']
      }
    ];
  }

  /**
   * Validate widget configuration
   */
  validateWidgetConfig(widgetConfig) {
    const errors = super.validateWidgetConfig(widgetConfig);

    // Chromatic-specific validation
    if (!this.projectToken && !process.env.CHROMATIC_PROJECT_TOKEN) {
      errors.push('Chromatic project token required (set CHROMATIC_PROJECT_TOKEN environment variable)');
    }

    return errors;
  }
}

// Create singleton instance
export const chromaticDataSource = new ChromaticDataSource();
