// frontend/src/lib/dataSourceConnectors/gcpMonitoring.ts

/**
 * GCP Monitoring Metric Discovery Connector
 *
 * Provides a catalog of Google Cloud Platform monitoring metrics
 * organized by category (performance, errors, resources).
 */

export interface GCPMetric {
  id: string;
  name: string;
  description: string;
  category: 'performance' | 'errors' | 'resources' | 'deployments';
  service: string;
  metricType: string;
  suggestedWidget: 'big-number' | 'gauge' | 'trend' | 'status';
  unit?: string;
  aggregation?: string[];
}

export interface GCPMetricsByCategory {
  performance: GCPMetric[];
  errors: GCPMetric[];
  resources: GCPMetric[];
  deployments: GCPMetric[];
}

export interface GCPConnectionTest {
  connected: boolean;
  metricsCount: number;
  message?: string;
}

/**
 * Catalog of available GCP monitoring metrics
 */
export const GCP_METRICS_CATALOG: GCPMetric[] = [
  // Cloud Run - Performance
  {
    id: 'cloudrun_request_latency',
    name: 'Request Latency',
    description: 'Request latency in milliseconds',
    category: 'performance',
    service: 'Cloud Run',
    metricType: 'run.googleapis.com/request_latencies',
    suggestedWidget: 'trend',
    unit: 'ms',
    aggregation: ['ALIGN_DELTA', 'ALIGN_MEAN', 'ALIGN_PERCENTILE_95']
  },
  {
    id: 'cloudrun_request_count',
    name: 'Request Count',
    description: 'Number of requests received',
    category: 'performance',
    service: 'Cloud Run',
    metricType: 'run.googleapis.com/request_count',
    suggestedWidget: 'big-number',
    unit: 'requests',
    aggregation: ['ALIGN_RATE', 'ALIGN_DELTA']
  },
  {
    id: 'cloudrun_container_cpu',
    name: 'Container CPU Utilization',
    description: 'CPU utilization of container instances',
    category: 'resources',
    service: 'Cloud Run',
    metricType: 'run.googleapis.com/container/cpu/utilizations',
    suggestedWidget: 'gauge',
    unit: 'percent',
    aggregation: ['ALIGN_MEAN', 'ALIGN_MAX']
  },
  {
    id: 'cloudrun_container_memory',
    name: 'Container Memory Utilization',
    description: 'Memory utilization of container instances',
    category: 'resources',
    service: 'Cloud Run',
    metricType: 'run.googleapis.com/container/memory/utilizations',
    suggestedWidget: 'gauge',
    unit: 'percent',
    aggregation: ['ALIGN_MEAN', 'ALIGN_MAX']
  },

  // Compute Engine - Resources
  {
    id: 'gce_cpu_utilization',
    name: 'VM CPU Utilization',
    description: 'CPU utilization of virtual machines',
    category: 'resources',
    service: 'Compute Engine',
    metricType: 'compute.googleapis.com/instance/cpu/utilization',
    suggestedWidget: 'gauge',
    unit: 'percent',
    aggregation: ['ALIGN_MEAN', 'ALIGN_MAX']
  },
  {
    id: 'gce_disk_read_ops',
    name: 'Disk Read Operations',
    description: 'Number of disk read operations',
    category: 'performance',
    service: 'Compute Engine',
    metricType: 'compute.googleapis.com/instance/disk/read_ops_count',
    suggestedWidget: 'trend',
    unit: 'operations',
    aggregation: ['ALIGN_RATE', 'ALIGN_DELTA']
  },

  // BigQuery - Performance
  {
    id: 'bigquery_query_count',
    name: 'Query Count',
    description: 'Number of BigQuery queries executed',
    category: 'performance',
    service: 'BigQuery',
    metricType: 'bigquery.googleapis.com/query/count',
    suggestedWidget: 'big-number',
    unit: 'queries',
    aggregation: ['ALIGN_RATE', 'ALIGN_DELTA']
  },
  {
    id: 'bigquery_slots_allocated',
    name: 'Slots Allocated',
    description: 'Number of BigQuery slots currently allocated',
    category: 'resources',
    service: 'BigQuery',
    metricType: 'bigquery.googleapis.com/slots/allocated',
    suggestedWidget: 'gauge',
    unit: 'slots',
    aggregation: ['ALIGN_MEAN', 'ALIGN_MAX']
  },

  // Pub/Sub - Performance
  {
    id: 'pubsub_publish_latency',
    name: 'Publish Message Latency',
    description: 'Latency of publishing messages to Pub/Sub',
    category: 'performance',
    service: 'Pub/Sub',
    metricType: 'pubsub.googleapis.com/topic/send_message_operation_count',
    suggestedWidget: 'trend',
    unit: 'ms',
    aggregation: ['ALIGN_DELTA', 'ALIGN_MEAN']
  },
  {
    id: 'pubsub_unacked_messages',
    name: 'Unacked Messages',
    description: 'Number of unacknowledged messages in subscription',
    category: 'resources',
    service: 'Pub/Sub',
    metricType: 'pubsub.googleapis.com/subscription/num_unacked_messages_by_region',
    suggestedWidget: 'big-number',
    unit: 'messages',
    aggregation: ['ALIGN_MEAN', 'ALIGN_MAX']
  },

  // Error Metrics
  {
    id: 'cloudrun_error_count',
    name: 'Request Error Count',
    description: 'Number of failed requests (5xx errors)',
    category: 'errors',
    service: 'Cloud Run',
    metricType: 'run.googleapis.com/request_count',
    suggestedWidget: 'status',
    unit: 'errors',
    aggregation: ['ALIGN_RATE', 'ALIGN_DELTA']
  },
  {
    id: 'pubsub_failed_deliveries',
    name: 'Failed Message Deliveries',
    description: 'Number of failed message delivery attempts',
    category: 'errors',
    service: 'Pub/Sub',
    metricType: 'pubsub.googleapis.com/subscription/dead_letter_message_count',
    suggestedWidget: 'status',
    unit: 'messages',
    aggregation: ['ALIGN_RATE', 'ALIGN_DELTA']
  },

  // Deployment Metrics
  {
    id: 'cloudrun_revision_count',
    name: 'Active Revisions',
    description: 'Number of active Cloud Run revisions',
    category: 'deployments',
    service: 'Cloud Run',
    metricType: 'run.googleapis.com/revision/count',
    suggestedWidget: 'big-number',
    unit: 'revisions',
    aggregation: ['ALIGN_MEAN']
  },
  {
    id: 'cloudrun_deployment_status',
    name: 'Deployment Status',
    description: 'Current status of Cloud Run deployments',
    category: 'deployments',
    service: 'Cloud Run',
    metricType: 'run.googleapis.com/revision/ready',
    suggestedWidget: 'status',
    unit: 'status',
    aggregation: ['ALIGN_MEAN']
  }
];

/**
 * Discover available GCP metrics organized by category
 */
export async function discoverGCPMetrics(): Promise<GCPMetricsByCategory> {
  // Simulate async operation (would call GCP Monitoring API in production)
  await new Promise(resolve => setTimeout(resolve, 10));

  const metricsByCategory: GCPMetricsByCategory = {
    performance: [],
    errors: [],
    resources: [],
    deployments: []
  };

  // Organize metrics by category
  for (const metric of GCP_METRICS_CATALOG) {
    metricsByCategory[metric.category].push(metric);
  }

  return metricsByCategory;
}

/**
 * Test connection to GCP Monitoring API
 */
export async function testGCPConnection(): Promise<GCPConnectionTest> {
  // Simulate async operation (would test actual GCP connection in production)
  await new Promise(resolve => setTimeout(resolve, 10));

  return {
    connected: true,
    metricsCount: GCP_METRICS_CATALOG.length,
    message: 'Successfully connected to GCP Monitoring API'
  };
}

/**
 * Get a specific metric by ID
 */
export function getMetricById(id: string): GCPMetric | undefined {
  return GCP_METRICS_CATALOG.find(metric => metric.id === id);
}
