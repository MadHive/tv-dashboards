#!/usr/bin/env bun
// ============================================================================
// Auto-assign GCP saved queries to all simple widgets in dashboards.yaml
// Run: bun scripts/auto-assign-queries.js
// ============================================================================

import { readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { saveQuery } from '../server/query-manager.js';

const DASHBOARDS_PATH = './config/dashboards.yaml';
const BASE = 'http://localhost:3000';

// ── Aggregation presets ────────────────────────────────────────────────────
const AGG = {
  rateSum:       { perSeriesAligner: 'ALIGN_RATE',  crossSeriesReducer: 'REDUCE_SUM',  alignmentPeriod: { seconds: 60 } },
  meanMean:      { perSeriesAligner: 'ALIGN_MEAN',  crossSeriesReducer: 'REDUCE_MEAN', alignmentPeriod: { seconds: 60 } },
  meanSum:       { perSeriesAligner: 'ALIGN_MEAN',  crossSeriesReducer: 'REDUCE_SUM',  alignmentPeriod: { seconds: 60 } },
  deltaP95:      { perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_PERCENTILE_95', alignmentPeriod: { seconds: 60 } },
  deltaP50:      { perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_PERCENTILE_50', alignmentPeriod: { seconds: 60 } },
  meanCount:     { perSeriesAligner: 'ALIGN_MEAN',  crossSeriesReducer: 'REDUCE_COUNT', alignmentPeriod: { seconds: 60 } },
  deltaSum:      { perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_SUM',  alignmentPeriod: { seconds: 60 } },
  meanMax:       { perSeriesAligner: 'ALIGN_MEAN',  crossSeriesReducer: 'REDUCE_MAX',  alignmentPeriod: { seconds: 60 } },
};

// ── Query definitions ──────────────────────────────────────────────────────
// Each entry: { id, name, metricType, project, timeWindow, aggregation, filters? }
const QUERIES = [
  // Platform Overview
  { id: 'bidder-winner-candidates', name: 'Bidder Winner Candidates',
    metricType: 'custom.googleapis.com/opencensus/mhive/bidder/winner_candidates_count',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum },

  { id: 'cloudrun-request-count-madmaster', name: 'Cloud Run Request Count (mad-master)',
    metricType: 'run.googleapis.com/request_count',
    project: 'mad-master', timeWindow: 30, aggregation: AGG.rateSum },

  { id: 'kafka-writes-madmaster', name: 'Kafka Writes (mad-master)',
    metricType: 'custom.googleapis.com/opencensus/mhive/kafka/writes',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum },

  // Services Health
  { id: 'cloudrun-latencies-madmaster', name: 'Cloud Run Latencies (mad-master)',
    metricType: 'run.googleapis.com/request_latencies',
    project: 'mad-master', timeWindow: 30, aggregation: AGG.deltaP95 },

  // Data Processing
  { id: 'bigquery-query-count', name: 'BigQuery Query Count',
    metricType: 'bigquery.googleapis.com/query/count',
    project: 'mad-data', timeWindow: 60, aggregation: AGG.rateSum },

  { id: 'bigquery-slots-allocated', name: 'BigQuery Slots Allocated',
    metricType: 'bigquery.googleapis.com/slots/allocated_for_project',
    project: 'mad-data', timeWindow: 10, aggregation: AGG.meanMean },

  { id: 'pubsub-undelivered-maddata', name: 'Pub/Sub Undelivered Messages (mad-data)',
    metricType: 'pubsub.googleapis.com/subscription/num_undelivered_messages',
    project: 'mad-data', timeWindow: 10, aggregation: AGG.meanSum },

  { id: 'pubsub-topic-send-maddata', name: 'Pub/Sub Topic Send Rate (mad-data)',
    metricType: 'pubsub.googleapis.com/topic/send_message_operation_count',
    project: 'mad-data', timeWindow: 10, aggregation: AGG.rateSum },

  // RTB Infrastructure — Kubernetes
  { id: 'k8s-uptime-bidder', name: 'K8s Container Uptime — Bidder',
    metricType: 'kubernetes.io/container/uptime',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.meanCount,
    filters: 'resource.labels.container_name = "bidder"' },

  { id: 'k8s-uptime-roger', name: 'K8s Container Uptime — Roger',
    metricType: 'kubernetes.io/container/uptime',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.meanCount,
    filters: 'resource.labels.container_name = "roger"' },

  { id: 'k8s-uptime-memcached', name: 'K8s Container Uptime — Memcached',
    metricType: 'kubernetes.io/container/uptime',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.meanCount,
    filters: 'resource.labels.container_name = "memcached"' },

  { id: 'k8s-cpu-bidder', name: 'K8s CPU Utilization — Bidder',
    metricType: 'kubernetes.io/container/cpu/request_utilization',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.deltaP95,
    filters: 'resource.labels.container_name = "bidder"' },

  { id: 'k8s-memory-bidder', name: 'K8s Memory Utilization — Bidder',
    metricType: 'kubernetes.io/container/memory/request_utilization',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.deltaP95,
    filters: 'resource.labels.container_name = "bidder"' },

  { id: 'k8s-restart-bidder', name: 'K8s Container Restarts — Bidder',
    metricType: 'kubernetes.io/container/restart_count',
    project: 'mad-master', timeWindow: 60, aggregation: AGG.deltaSum,
    filters: 'resource.labels.container_name = "bidder"' },

  // Load Balancer
  { id: 'lb-request-count-bidder', name: 'LB Request Count — Bidder',
    metricType: 'loadbalancing.googleapis.com/https/request_count',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum },

  { id: 'lb-backend-latencies', name: 'LB Backend Latencies',
    metricType: 'loadbalancing.googleapis.com/https/backend_latencies',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.deltaP50 },

  { id: 'lb-503-count', name: 'LB 503 Error Count',
    metricType: 'loadbalancing.googleapis.com/https/request_count',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum,
    filters: 'metric.labels.response_code = "503"' },

  { id: 'pipe-bytes-written', name: 'Pipe Bytes Written',
    metricType: 'custom.googleapis.com/opencensus/mhive/pipe/bytes_written',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum },

  // Bidder Cluster
  { id: 'pubsub-wins-topic', name: 'Pub/Sub Wins Topic Rate',
    metricType: 'pubsub.googleapis.com/topic/send_message_operation_count',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum,
    filters: 'resource.labels.topic_id = "wins"' },

  // Campaign & Pacing — Roger metrics
  { id: 'roger-campaigns', name: 'Roger Active Campaigns',
    metricType: 'workload.googleapis.com/mhive/roger/campaigns',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.meanMean },

  { id: 'roger-global-win-rate', name: 'Roger Global Win Rate',
    metricType: 'workload.googleapis.com/mhive/roger/global_win_rate',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.meanMean },

  { id: 'roger-campaign-metas', name: 'Roger Campaign Metas',
    metricType: 'workload.googleapis.com/mhive/roger/campaign_metas',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.meanMean },

  { id: 'roger-pacing-ratio', name: 'Roger Pacing Ratio P50',
    metricType: 'workload.googleapis.com/mhive/roger/pacing_ratio',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.deltaP50 },

  { id: 'roger-send-count', name: 'Roger Send Count',
    metricType: 'workload.googleapis.com/mhive/roger/send_count',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum },

  { id: 'roger-ebrake', name: 'Roger EBrake P50',
    metricType: 'workload.googleapis.com/mhive/roger/ebrake',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.deltaP50 },

  { id: 'roger-send-latency', name: 'Roger Send Latency P95',
    metricType: 'workload.googleapis.com/mhive/roger/send_latency',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.deltaP95 },

  { id: 'impressionrater-row-updates', name: 'ImpressionRater Row Updates',
    metricType: 'workload.googleapis.com/mhive/impressionrater/row_updates',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum },

  // Data Infrastructure — Managed Kafka
  { id: 'kafka-managed-request-count', name: 'Managed Kafka Request Count',
    metricType: 'managedkafka.googleapis.com/request_count',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum },

  { id: 'kafka-managed-offset-lag', name: 'Managed Kafka Offset Lag',
    metricType: 'managedkafka.googleapis.com/offset_lag',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.meanSum },

  { id: 'kafka-managed-latency', name: 'Managed Kafka Request Latencies P95',
    metricType: 'managedkafka.googleapis.com/request_latencies',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.deltaP95 },

  // Bigtable
  { id: 'bigtable-returned-rows', name: 'Bigtable Returned Rows Rate',
    metricType: 'bigtable.googleapis.com/server/returned_rows_count',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum },

  { id: 'bigtable-request-count', name: 'Bigtable Request Count',
    metricType: 'bigtable.googleapis.com/server/request_count',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum },

  { id: 'bigtable-latency', name: 'Bigtable Server Latencies P95',
    metricType: 'bigtable.googleapis.com/server/latencies',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.deltaP95 },

  { id: 'bigtable-cpu-load', name: 'Bigtable Cluster CPU Load',
    metricType: 'bigtable.googleapis.com/cluster/cpu_load',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.meanMax },

  { id: 'pubsub-events-primary-unacked', name: 'Pub/Sub Events-Primary Unacked',
    metricType: 'pubsub.googleapis.com/subscription/num_undelivered_messages',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.meanSum,
    filters: 'resource.labels.subscription_id = "events-primary"' },

  { id: 'pubsub-wins-unacked', name: 'Pub/Sub Wins Unacked',
    metricType: 'pubsub.googleapis.com/subscription/num_undelivered_messages',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.meanMean,
    filters: 'resource.labels.subscription_id = "wins"' },

  { id: 'bigtable-table-bytes', name: 'Bigtable Table Bytes Used',
    metricType: 'bigtable.googleapis.com/table/bytes_used',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.meanSum },

  // API & Services — Mozart
  { id: 'mozart-total-requests', name: 'Mozart Total Requests',
    metricType: 'workload.googleapis.com/mhive/mozart/totalRequests',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum },

  { id: 'mozart-total-impressions', name: 'Mozart Total Impressions',
    metricType: 'workload.googleapis.com/mhive/mozart/totalImpressions',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum },

  { id: 'mozart-errors', name: 'Mozart Errors Per Resource',
    metricType: 'workload.googleapis.com/mhive/mozart/errorsPerResource',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum },

  { id: 'planner-impressions', name: 'Planner 3 Impressions',
    metricType: 'custom.googleapis.com/opencensus/mhive/planner_3/impressions',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.deltaP50 },

  { id: 'planner-reach', name: 'Planner 3 Reach',
    metricType: 'custom.googleapis.com/opencensus/mhive/planner_3/reach',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.deltaP50 },

  { id: 'madserver-sql-latency', name: 'MadServer SQL Latency P95',
    metricType: 'workload.googleapis.com/madserver/sql/latency_ms',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.deltaP95 },

  { id: 'gary2-segments-processed', name: 'Gary2 Segments Processed',
    metricType: 'workload.googleapis.com/mhive/gary2/segmentsProcessed',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum },

  { id: 'gary2-pubsub-backlog', name: 'Gary2 Pub/Sub Backlog',
    metricType: 'pubsub.googleapis.com/subscription/num_undelivered_messages',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.meanMean,
    filters: 'resource.labels.subscription_id = "gary2-input"' },

  { id: 'madserver-rpc-calls', name: 'MadServer RPC Client Calls',
    metricType: 'workload.googleapis.com/madserver/rpc/client_call',
    project: 'mad-master', timeWindow: 10, aggregation: AGG.rateSum },
];

// ── Widget → queryId mapping ───────────────────────────────────────────────
// key: "dashboardId:widgetId"  value: query id from QUERIES above
// SKIP: complex multi-metric, static, mock, vulntrack, bigquery widgets
const WIDGET_QUERY_MAP = {
  // Platform Overview
  'platform-overview:bids-served':          'bidder-winner-candidates',
  'platform-overview:impressions-delivered': 'cloudrun-request-count-madmaster',
  'platform-overview:bid-qps':              'bidder-winner-candidates',
  'platform-overview:events-processed':     'kafka-writes-madmaster',
  'platform-overview:kafka-throughput':     'kafka-writes-madmaster',
  // platform-overview:storage-volume → COMPLEX (5 metrics)
  // platform-overview:platform-uptime → STATIC

  // Services Health
  // services-health:fleet-health → COMPLEX
  'services-health:requests-served': 'cloudrun-request-count-madmaster',
  // services-health:response-time → COMPLEX (median of medians)
  'services-health:top-services':    'cloudrun-request-count-madmaster',
  'services-health:fastest-services':'cloudrun-latencies-madmaster',

  // Campaign Delivery — usa-delivery-map → COMPLEX (BigQuery)

  // Data Processing
  'data-processing:analytics-queries':    'bigquery-query-count',
  'data-processing:compute-utilization':  'bigquery-slots-allocated',
  // data-processing:storage-volume → COMPLEX
  'data-processing:messages-queued':      'pubsub-undelivered-maddata',
  'data-processing:ingestion-topics':     'pubsub-topic-send-maddata',

  // Data Pipeline — all COMPLEX (multi-metric pipeline stages)

  // RTB Infrastructure
  'rtb-infrastructure:bidder-nodes':      'k8s-uptime-bidder',
  'rtb-infrastructure:roger-nodes':       'k8s-uptime-roger',
  'rtb-infrastructure:memcache-nodes':    'k8s-uptime-memcached',
  // rtb-infrastructure:core-cluster-size → COMPLEX (sum of 3 k8s queries)
  'rtb-infrastructure:bidder-cpu':         'k8s-cpu-bidder',
  'rtb-infrastructure:bidder-memory':      'k8s-memory-bidder',
  'rtb-infrastructure:container-restarts': 'k8s-restart-bidder',
  'rtb-infrastructure:bidder-error-rate':  'lb-503-count',
  'rtb-infrastructure:pipe-bytes-written': 'pipe-bytes-written',
  'rtb-infrastructure:bidder-nodes-by-zone': 'k8s-uptime-bidder',
  'rtb-infrastructure:lb-backend-503s':   'lb-503-count',

  // Bidder Cluster
  'bidder-cluster:bid-qps':           'lb-request-count-bidder',
  'bidder-cluster:win-rate':          'pubsub-wins-topic',
  // bidder-cluster:error-rate → COMPLEX (response code breakdown)
  // bidder-cluster:timeout-rate → COMPLEX
  'bidder-cluster:response-latency':  'lb-backend-latencies',
  'bidder-cluster:bid-nobid-ratio':   'lb-request-count-bidder',
  'bidder-cluster:budget-pacing':     'lb-503-count',
  'bidder-cluster:qps-by-region':     'lb-request-count-bidder',
  'bidder-cluster:response-by-backend': 'lb-request-count-bidder',

  // Campaign & Pacing
  'campaign-pacing:active-campaigns':       'roger-campaigns',
  'campaign-pacing:global-win-rate':        'roger-global-win-rate',
  'campaign-pacing:campaign-metas':         'roger-campaign-metas',
  'campaign-pacing:pacing-p50':             'roger-pacing-ratio',
  'campaign-pacing:roger-messages':         'roger-send-count',
  'campaign-pacing:ebrake-p50':             'roger-ebrake',
  'campaign-pacing:roger-send-latency':     'roger-send-latency',
  'campaign-pacing:impression-rater':       'impressionrater-row-updates',
  'campaign-pacing:active-campaigns-count': 'roger-campaigns',

  // Data Infrastructure
  'data-infrastructure:kafka-requests':        'kafka-managed-request-count',
  'data-infrastructure:kafka-lag':             'kafka-managed-offset-lag',
  'data-infrastructure:kafka-latency':         'kafka-managed-latency',
  // data-infrastructure:kafka-write-errors → STATIC
  'data-infrastructure:bigtable-reads':        'bigtable-returned-rows',
  'data-infrastructure:bigtable-requests':     'bigtable-request-count',
  'data-infrastructure:bigtable-latency':      'bigtable-latency',
  'data-infrastructure:bigtable-cpu':          'bigtable-cpu-load',
  'data-infrastructure:pubsub-events-unacked': 'pubsub-events-primary-unacked',
  'data-infrastructure:pubsub-wins-unacked':   'pubsub-wins-unacked',
  'data-infrastructure:bigtable-tables':       'bigtable-table-bytes',

  // API & Services
  'api-services:mozart-requests':    'mozart-total-requests',
  'api-services:mozart-impressions': 'mozart-total-impressions',
  'api-services:mozart-errors':      'mozart-errors',
  'api-services:planner-impressions':'planner-impressions',
  'api-services:planner-reach':      'planner-reach',
  'api-services:madserver-sql':      'madserver-sql-latency',
  'api-services:gary2-segments':     'gary2-segments-processed',
  'api-services:gary2-backlog':      'gary2-pubsub-backlog',
  'api-services:madserver-calls':    'madserver-rpc-calls',

  // Security Posture — vulntrack-overview uses source:vulntrack, no queryId needed
};

// ── Step 1: Save all queries ───────────────────────────────────────────────
console.log(`\nCreating ${QUERIES.length} saved GCP queries...\n`);
let created = 0, skipped = 0;

for (const q of QUERIES) {
  try {
    const result = await saveQuery('gcp', {
      id:          q.id,
      name:        q.name,
      metricType:  q.metricType,
      project:     q.project,
      timeWindow:  q.timeWindow,
      aggregation: q.aggregation,
      filters:     q.filters || '',
      widgetTypes: [],
    });
    if (result && !result.error) {
      console.log(`  ✓ ${q.id}`);
      created++;
    } else {
      console.log(`  ↻ ${q.id} (already exists)`);
      skipped++;
    }
  } catch (err) {
    console.error(`  ✗ ${q.id}: ${err.message}`);
  }
}

console.log(`\n  Created: ${created}, Skipped/existing: ${skipped}\n`);

// ── Step 2: Update dashboards.yaml ────────────────────────────────────────
console.log('Patching dashboards.yaml...\n');

const raw    = readFileSync(DASHBOARDS_PATH, 'utf8');
const config = yaml.load(raw);

let assigned = 0, notFound = 0;

for (const dash of config.dashboards) {
  for (const widget of (dash.widgets || [])) {
    const key = `${dash.id}:${widget.id}`;
    const queryId = WIDGET_QUERY_MAP[key];
    if (queryId) {
      widget.queryId = queryId;
      widget.source  = 'gcp';
      assigned++;
      console.log(`  ✓ ${key} → ${queryId}`);
    }
  }
}

// Write back with same style as original
const updated = yaml.dump(config, {
  lineWidth: 120,
  noRefs: true,
  quotingType: '"',
});
writeFileSync(DASHBOARDS_PATH, updated, 'utf8');

console.log(`\n✅ Done — assigned ${assigned} widgets\n`);
if (notFound > 0) console.log(`   ${notFound} widget keys not found in map (expected for new dashboards)\n`);
