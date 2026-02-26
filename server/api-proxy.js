// ---------------------------------------------------------------------------
// GCP Cloud Monitoring + Datadog API proxy — ElysiaJS
// Queries real metrics from multiple GCP projects when USE_REAL_DATA=true
// ---------------------------------------------------------------------------

import { Elysia } from 'elysia';

let monitoringClients = {};

async function getClient(projectId) {
  if (monitoringClients[projectId]) return monitoringClients[projectId];
  try {
    const monitoring = await import('@google-cloud/monitoring');
    const MonitoringModule = monitoring.default || monitoring;
    const client = new MonitoringModule.MetricServiceClient();
    monitoringClients[projectId] = client;
    console.log(`[gcp] Initialized monitoring client for ${projectId}`);
    return client;
  } catch (err) {
    console.error(`[gcp] Failed to init client for ${projectId}:`, err.message);
    return null;
  }
}

export const proxyRoutes = new Elysia({ prefix: '/api/proxy' })

  // ── Generic timeseries query ──
  .get('/gcp/:project/timeseries', async ({ params, query, set }) => {
    const { project } = params;
    const { metric, filter, interval_minutes } = query;

    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      set.status = 501;
      return { error: 'GOOGLE_APPLICATION_CREDENTIALS not set' };
    }

    const client = await getClient(project);
    if (!client) {
      set.status = 500;
      return { error: 'Client init failed' };
    }

    try {
      const now = new Date();
      const start = new Date(now.getTime() - (parseInt(interval_minutes) || 60) * 60000);

      const [timeSeries] = await client.listTimeSeries({
        name: `projects/${project}`,
        filter: filter || `metric.type = "${metric}"`,
        interval: {
          startTime: { seconds: Math.floor(start.getTime() / 1000) },
          endTime:   { seconds: Math.floor(now.getTime() / 1000) },
        },
      });

      return { timeSeries };
    } catch (err) {
      console.error(`[gcp] Query error (${project}/${metric}):`, err.message);
      set.status = 500;
      return { error: err.message };
    }
  })

  // ── GCP BigQuery metrics (mad-data) ──
  .get('/gcp/mad-data/bigquery', async ({ set }) => {
    const client = await getClient('mad-data');
    if (!client) {
      set.status = 501;
      return { error: 'Not configured' };
    }

    try {
      const now = new Date();
      const start = new Date(now.getTime() - 3600000);

      const metrics = [
        'bigquery.googleapis.com/query/count',
        'bigquery.googleapis.com/slots/allocated_for_project',
        'bigquery.googleapis.com/storage/stored_bytes',
      ];

      const results = {};
      for (const m of metrics) {
        const [ts] = await client.listTimeSeries({
          name: 'projects/mad-data',
          filter: `metric.type = "${m}"`,
          interval: {
            startTime: { seconds: Math.floor(start.getTime() / 1000) },
            endTime:   { seconds: Math.floor(now.getTime() / 1000) },
          },
        });
        results[m] = ts;
      }
      return results;
    } catch (err) {
      set.status = 500;
      return { error: err.message };
    }
  })

  // ── GCP Cloud Run metrics (mad-master) ──
  .get('/gcp/mad-master/cloudrun', async ({ set }) => {
    const client = await getClient('mad-master');
    if (!client) {
      set.status = 501;
      return { error: 'Not configured' };
    }

    try {
      const now = new Date();
      const start = new Date(now.getTime() - 300000);

      const [ts] = await client.listTimeSeries({
        name: 'projects/mad-master',
        filter: 'metric.type = "run.googleapis.com/request_count"',
        interval: {
          startTime: { seconds: Math.floor(start.getTime() / 1000) },
          endTime:   { seconds: Math.floor(now.getTime() / 1000) },
        },
      });
      return { services: ts };
    } catch (err) {
      set.status = 500;
      return { error: err.message };
    }
  })

  // ── GCP K8s metrics — core cluster (mad-master) ──
  .get('/gcp/mad-master/kubernetes', async ({ set }) => {
    const client = await getClient('mad-master');
    if (!client) {
      set.status = 501;
      return { error: 'Not configured' };
    }

    try {
      const now = new Date();
      const start = new Date(now.getTime() - 300000);

      const [ts] = await client.listTimeSeries({
        name: 'projects/mad-master',
        filter: 'metric.type = "kubernetes.io/container/cpu/core_usage_time" AND resource.labels.cluster_name = "core"',
        interval: {
          startTime: { seconds: Math.floor(start.getTime() / 1000) },
          endTime:   { seconds: Math.floor(now.getTime() / 1000) },
        },
      });
      return { k8s: ts };
    } catch (err) {
      set.status = 500;
      return { error: err.message };
    }
  })

  // ── GCP Logging metrics (mad-audit) ──
  .get('/gcp/mad-audit/logging', async ({ set }) => {
    const client = await getClient('mad-audit');
    if (!client) {
      set.status = 501;
      return { error: 'Not configured' };
    }

    try {
      const now = new Date();
      const start = new Date(now.getTime() - 3600000);

      const [ts] = await client.listTimeSeries({
        name: 'projects/mad-audit',
        filter: 'metric.type = "logging.googleapis.com/log_entry_count"',
        interval: {
          startTime: { seconds: Math.floor(start.getTime() / 1000) },
          endTime:   { seconds: Math.floor(now.getTime() / 1000) },
        },
      });
      return { logs: ts };
    } catch (err) {
      set.status = 500;
      return { error: err.message };
    }
  })

  // ── Datadog proxy (placeholder) ──
  .get('/datadog/query', async ({ set }) => {
    if (!process.env.DD_API_KEY) {
      set.status = 501;
      return { error: 'DD_API_KEY not configured' };
    }
    set.status = 501;
    return { error: 'Datadog integration pending' };
  });
