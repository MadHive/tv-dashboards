// ===========================================================================
// AWS CloudWatch Data Source Plugin — Amazon Web Services monitoring
// ===========================================================================

import { DataSource } from './base.js';
import { CloudWatchClient, GetMetricDataCommand, ListMetricsCommand } from '@aws-sdk/client-cloudwatch';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * AWS CloudWatch data source for AWS infrastructure metrics
 *
 * Configuration:
 * - Set AWS_ACCESS_KEY_ID environment variable
 * - Set AWS_SECRET_ACCESS_KEY environment variable
 * - Set AWS_REGION environment variable (default: us-east-1)
 */
export class AWSDataSource extends DataSource {
  constructor(config = {}) {
    super('aws', config);
    this.region = config.region || process.env.AWS_REGION || 'us-east-1';
    this.accessKeyId = config.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    this.secretAccessKey = config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
    this.cloudWatchClient = null;
    this.metricCache = new Map();
  }

  /**
   * Initialize AWS CloudWatch client
   */
  async initialize() {
    try {
      // Check if credentials are available
      if (!this.accessKeyId || !this.secretAccessKey) {
        console.warn('[aws] No AWS credentials found - data source will use mock data');
        this.isConnected = false;
        return;
      }

      this.cloudWatchClient = new CloudWatchClient({
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey
        }
      });

      this.isConnected = true;
      console.log(`[aws] CloudWatch client initialized for region: ${this.region}`);
    } catch (error) {
      console.error('[aws] Failed to initialize:', error.message);
      this.lastError = error;
      this.isConnected = false;
    }
  }

  /**
   * Fetch metrics for a widget
   *
   * Widget config should include:
   * - metric: Metric name (e.g., 'CPUUtilization')
   * - namespace: AWS namespace (e.g., 'AWS/EC2')
   * - dimensions: Array of { Name, Value } objects
   * - statistic: Statistic type (Average, Sum, Maximum, etc.)
   * - period: Data point period in seconds (default: 300)
   */
  async fetchMetrics(widgetConfig) {
    try {
      if (!this.cloudWatchClient) {
        console.warn('[aws] CloudWatch client not initialized - using mock data');
        return {
          timestamp: new Date().toISOString(),
          source: 'aws',
          data: this.getMockData(widgetConfig.type),
          widgetId: widgetConfig.id
        };
      }

      // Extract CloudWatch metric parameters
      const {
        metric = 'CPUUtilization',
        namespace = 'AWS/EC2',
        dimensions = [],
        statistic = 'Average',
        period = 300,
        timeRange = 3600 // 1 hour in seconds
      } = widgetConfig;

      // Check cache
      const cacheKey = JSON.stringify({ metric, namespace, dimensions, statistic, period });
      if (this.metricCache.has(cacheKey)) {
        const cached = this.metricCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          console.log('[aws] Cache hit for metric:', metric);
          return {
            timestamp: new Date().toISOString(),
            source: 'aws',
            data: this.transformData(cached.data, widgetConfig.type),
            widgetId: widgetConfig.id,
            cached: true
          };
        }
      }

      // Build metric data query
      const endTime = new Date();
      const startTime = new Date(Date.now() - (timeRange * 1000));

      const command = new GetMetricDataCommand({
        MetricDataQueries: [
          {
            Id: 'm1',
            MetricStat: {
              Metric: {
                Namespace: namespace,
                MetricName: metric,
                Dimensions: dimensions
              },
              Period: period,
              Stat: statistic
            },
            ReturnData: true
          }
        ],
        StartTime: startTime,
        EndTime: endTime
      });

      const response = await this.cloudWatchClient.send(command);

      // Cache the result
      this.metricCache.set(cacheKey, {
        data: response.MetricDataResults,
        timestamp: Date.now()
      });

      return {
        timestamp: new Date().toISOString(),
        source: 'aws',
        data: this.transformData(response.MetricDataResults, widgetConfig.type),
        widgetId: widgetConfig.id
      };
    } catch (error) {
      console.error('[aws] Fetch metrics error:', error.message);
      return this.handleError(error, widgetConfig.type);
    }
  }

  /**
   * Test connection to AWS CloudWatch
   */
  async testConnection() {
    try {
      if (!this.cloudWatchClient) {
        return false;
      }

      // Try to list metrics (limit to 1 for quick test)
      const command = new ListMetricsCommand({
        MaxRecords: 1
      });

      await this.cloudWatchClient.send(command);
      console.log('[aws] Connection test successful');
      return true;
    } catch (error) {
      console.error('[aws] Connection test failed:', error.message);
      this.lastError = error;
      return false;
    }
  }

  /**
   * Get configuration schema
   */
  getConfigSchema() {
    return {
      name: 'AWS CloudWatch',
      description: 'Fetch metrics from AWS CloudWatch monitoring',
      fields: [
        {
          name: 'region',
          type: 'string',
          required: true,
          description: 'AWS Region',
          default: 'us-east-1'
        },
        {
          name: 'accessKeyId',
          type: 'string',
          required: true,
          description: 'AWS Access Key ID',
          secure: true,
          envVar: 'AWS_ACCESS_KEY_ID'
        },
        {
          name: 'secretAccessKey',
          type: 'string',
          required: true,
          description: 'AWS Secret Access Key',
          secure: true,
          envVar: 'AWS_SECRET_ACCESS_KEY'
        },
        {
          name: 'metric',
          type: 'string',
          required: false,
          description: 'CloudWatch metric name',
          example: 'CPUUtilization'
        },
        {
          name: 'namespace',
          type: 'string',
          required: false,
          description: 'AWS service namespace',
          example: 'AWS/EC2'
        },
        {
          name: 'statistic',
          type: 'select',
          required: false,
          description: 'Statistic type',
          options: ['Average', 'Sum', 'Minimum', 'Maximum', 'SampleCount'],
          default: 'Average'
        }
      ]
    };
  }

  /**
   * Transform CloudWatch metric data to widget format
   */
  transformData(metricResults, widgetType) {
    if (!metricResults || metricResults.length === 0) {
      return this.getEmptyData(widgetType);
    }

    const result = metricResults[0];
    const values = result.Values || [];
    const timestamps = result.Timestamps || [];

    // No data
    if (values.length === 0) {
      return this.getEmptyData(widgetType);
    }

    switch (widgetType) {
      case 'big-number':
      case 'stat-card': {
        const latestValue = values[values.length - 1];
        const previousValue = values.length > 1 ? values[values.length - 2] : latestValue;
        const trend = latestValue > previousValue ? 'up' : latestValue < previousValue ? 'down' : 'stable';

        return {
          value: Math.round(latestValue * 100) / 100,
          previous: Math.round(previousValue * 100) / 100,
          trend,
          unit: result.Label || ''
        };
      }

      case 'gauge':
      case 'gauge-row': {
        const latestValue = values[values.length - 1];
        return {
          value: Math.round(latestValue * 100) / 100,
          min: 0,
          max: 100,
          unit: '%'
        };
      }

      case 'line-chart':
      case 'sparkline': {
        return {
          labels: timestamps.map(t => new Date(t).toISOString()),
          values: values.map(v => Math.round(v * 100) / 100),
          series: result.Label || 'Value'
        };
      }

      case 'bar-chart': {
        // For bar charts, take last N values
        const lastN = Math.min(10, values.length);
        const recentValues = values.slice(-lastN);
        const recentTimestamps = timestamps.slice(-lastN);

        return {
          values: recentTimestamps.map((t, i) => ({
            label: new Date(t).toLocaleTimeString(),
            value: Math.round(recentValues[i] * 100) / 100
          }))
        };
      }

      default:
        // Return raw data for unsupported widget types
        return {
          values,
          timestamps,
          label: result.Label
        };
    }
  }

  /**
   * Get mock data for testing when AWS credentials not available
   */
  getMockData(widgetType) {
    switch (widgetType) {
      case 'big-number':
      case 'stat-card':
        return {
          value: Math.round(Math.random() * 100),
          trend: Math.random() > 0.5 ? 'up' : 'down',
          unit: '%'
        };

      case 'gauge':
      case 'gauge-row':
        return {
          value: Math.round(Math.random() * 100),
          min: 0,
          max: 100,
          unit: '%'
        };

      case 'bar-chart':
        return {
          values: [
            { label: 'EC2', value: 45 },
            { label: 'Lambda', value: 32 },
            { label: 'RDS', value: 28 },
            { label: 'S3', value: 18 }
          ]
        };

      case 'line-chart':
      case 'sparkline': {
        const now = Date.now();
        return {
          labels: Array.from({ length: 12 }, (_, i) =>
            new Date(now - (11 - i) * 300000).toISOString()
          ),
          values: Array.from({ length: 12 }, () =>
            Math.round(Math.random() * 100)
          ),
          series: 'Mock Data'
        };
      }

      default:
        return this.getEmptyData(widgetType);
    }
  }

  /**
   * Get available AWS CloudWatch metrics
   */
  getAvailableMetrics() {
    return [
      {
        id: 'ec2_cpu_utilization',
        name: 'EC2 CPU Utilization',
        description: 'Average CPU utilization across EC2 instances',
        namespace: 'AWS/EC2',
        metric: 'CPUUtilization',
        statistic: 'Average',
        type: 'percentage',
        widgets: ['gauge', 'gauge-row', 'line-chart', 'big-number']
      },
      {
        id: 'lambda_invocations',
        name: 'Lambda Invocations',
        description: 'Number of Lambda function invocations',
        namespace: 'AWS/Lambda',
        metric: 'Invocations',
        statistic: 'Sum',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart']
      },
      {
        id: 'lambda_errors',
        name: 'Lambda Errors',
        description: 'Number of Lambda function errors',
        namespace: 'AWS/Lambda',
        metric: 'Errors',
        statistic: 'Sum',
        type: 'number',
        widgets: ['big-number', 'stat-card', 'line-chart']
      },
      {
        id: 'rds_cpu',
        name: 'RDS CPU Utilization',
        description: 'Database CPU utilization',
        namespace: 'AWS/RDS',
        metric: 'CPUUtilization',
        statistic: 'Average',
        type: 'percentage',
        widgets: ['gauge', 'line-chart', 'big-number']
      },
      {
        id: 'rds_connections',
        name: 'RDS Database Connections',
        description: 'Number of database connections',
        namespace: 'AWS/RDS',
        metric: 'DatabaseConnections',
        statistic: 'Average',
        type: 'number',
        widgets: ['big-number', 'gauge', 'line-chart']
      },
      {
        id: 's3_requests',
        name: 'S3 Requests',
        description: 'Number of S3 requests',
        namespace: 'AWS/S3',
        metric: 'AllRequests',
        statistic: 'Sum',
        type: 'number',
        widgets: ['big-number', 'bar-chart', 'line-chart']
      },
      {
        id: 'alb_request_count',
        name: 'ALB Request Count',
        description: 'Application Load Balancer request count',
        namespace: 'AWS/ApplicationELB',
        metric: 'RequestCount',
        statistic: 'Sum',
        type: 'number',
        widgets: ['big-number', 'line-chart']
      },
      {
        id: 'alb_target_response_time',
        name: 'ALB Target Response Time',
        description: 'Average response time from targets',
        namespace: 'AWS/ApplicationELB',
        metric: 'TargetResponseTime',
        statistic: 'Average',
        type: 'duration',
        widgets: ['gauge', 'line-chart', 'big-number']
      }
    ];
  }

  /**
   * Validate widget configuration
   */
  validateWidgetConfig(widgetConfig) {
    const errors = super.validateWidgetConfig(widgetConfig);

    // AWS credentials are optional - will use mock data if not provided
    // This allows the dashboard to work without AWS access

    return errors;
  }
}

// Create singleton instance
export const awsDataSource = new AWSDataSource();
