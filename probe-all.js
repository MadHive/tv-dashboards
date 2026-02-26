const monitoring = require('@google-cloud/monitoring');
const client = new monitoring.MetricServiceClient();

const now = new Date();
const interval = {
  startTime: { seconds: Math.floor((now.getTime() - 60 * 60000) / 1000) },
  endTime: { seconds: Math.floor(now.getTime() / 1000) },
};

async function check(project, metricType) {
  try {
    const [ts] = await client.listTimeSeries({
      name: `projects/${project}`, filter: `metric.type = "${metricType}"`,
      interval, view: 'FULL', pageSize: 5,
    });
    if (!ts?.length) return null;
    const pts = ts[0].points || [];
    const v = pts[0]?.value;
    const sample = v?.doubleValue || v?.int64Value || (v?.distributionValue ? 'dist:'+Math.round(v.distributionValue.mean) : '?');
    return { count: ts.length, sample, points: pts.length };
  } catch (e) { return { error: e.message.slice(0,80) }; }
}

async function main() {
  const metrics = [
    // Cloud Run we're NOT using yet
    ['mad-master', 'run.googleapis.com/container/instance_count'],
    ['mad-master', 'run.googleapis.com/container/cpu/utilizations'],
    ['mad-master', 'run.googleapis.com/container/memory/utilizations'],
    ['mad-master', 'run.googleapis.com/container/network/received_bytes_count'],
    ['mad-master', 'run.googleapis.com/container/network/sent_bytes_count'],
    ['mad-master', 'run.googleapis.com/container/billable_instance_time'],
    ['mad-master', 'run.googleapis.com/container/startup_latencies'],
    // Custom metrics
    ['mad-master', 'custom.googleapis.com/opencensus/mhive/bidder/winner_candidates_count'],
    ['mad-master', 'custom.googleapis.com/opencensus/mhive/kafka/writes'],
    ['mad-master', 'custom.googleapis.com/opencensus/mhive/roger/campaign_metas'],
    ['mad-master', 'custom.googleapis.com/opencensus/mhive/roger/pacing_ratio'],
    ['mad-master', 'custom.googleapis.com/opencensus/mhive/pipe/rows_written'],
    // K8s
    ['mad-master', 'kubernetes.io/container/cpu/core_usage_time'],
    ['mad-master', 'kubernetes.io/container/memory/used_bytes'],
    ['mad-master', 'kubernetes.io/node/cpu/allocatable_utilization'],
    ['mad-master', 'kubernetes.io/pod/network/received_bytes_count'],
    // Load balancer
    ['mad-master', 'loadbalancing.googleapis.com/https/request_count'],
    ['mad-master', 'loadbalancing.googleapis.com/https/total_latencies'],
    // BigQuery
    ['mad-data', 'bigquery.googleapis.com/query/count'],
    ['mad-data', 'bigquery.googleapis.com/query/execution_times'],
    ['mad-data', 'bigquery.googleapis.com/slots/allocated_for_project'],
    ['mad-data', 'bigquery.googleapis.com/slots/total_available'],
    ['mad-data', 'bigquery.googleapis.com/query/scanned_bytes'],
    ['mad-data', 'bigquery.googleapis.com/query/scanned_bytes_billed'],
    ['mad-data', 'bigquery.googleapis.com/storage/stored_bytes'],
    ['mad-data', 'bigquery.googleapis.com/storage/table_count'],
    // Pub/Sub
    ['mad-data', 'pubsub.googleapis.com/subscription/num_undelivered_messages'],
    ['mad-data', 'pubsub.googleapis.com/topic/send_message_operation_count'],
    ['mad-data', 'pubsub.googleapis.com/subscription/pull_request_count'],
    ['mad-data', 'pubsub.googleapis.com/topic/message_sizes'],
    ['mad-data', 'pubsub.googleapis.com/topic/send_request_count'],
    // GCS
    ['mad-data', 'storage.googleapis.com/api/request_count'],
    ['mad-data', 'storage.googleapis.com/storage/total_bytes'],
    ['mad-data', 'storage.googleapis.com/storage/object_count'],
  ];

  // Run 5 at a time
  for (let i = 0; i < metrics.length; i += 5) {
    const batch = metrics.slice(i, i + 5);
    const results = await Promise.all(batch.map(([p, m]) => check(p, m)));
    batch.forEach(([proj, metric], j) => {
      const r = results[j];
      if (!r) console.log(`  EMPTY  ${proj}/${metric}`);
      else if (r.error) console.log(`  ERROR  ${proj}/${metric}: ${r.error}`);
      else console.log(`  LIVE   ${proj}/${metric}  ts=${r.count}  sample=${r.sample}  pts=${r.points}`);
    });
  }
}
main();
