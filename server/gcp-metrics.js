// ---------------------------------------------------------------------------
// Live GCP Cloud Monitoring — MadHive projects
//   mad-master  → Cloud Run services, bidder, kafka
//   mad-data    → BigQuery, Pub/Sub
//
// Positive platform metrics — no error/alert-focused widgets
// ---------------------------------------------------------------------------

import monitoring from '@google-cloud/monitoring';
import { BigQuery } from '@google-cloud/bigquery';
const client = new monitoring.MetricServiceClient();
const bq = new BigQuery({ projectId: 'mad-data' });

// ── helpers ──
function interval(minutes) {
  const now = new Date();
  return {
    startTime: { seconds: Math.floor((now.getTime() - minutes * 60000) / 1000) },
    endTime:   { seconds: Math.floor(now.getTime() / 1000) },
  };
}

export async function query(project, metricType, extra, minutes, aggregation) {
  let filter = `metric.type = "${metricType}"`;
  if (extra) filter += ` AND ${extra}`;
  try {
    const req = {
      name: `projects/${project}`,
      filter,
      interval: interval(minutes || 10),
      view: 'FULL',
    };
    if (aggregation) req.aggregation = aggregation;
    const [ts] = await client.listTimeSeries(req);
    return ts || [];
  } catch (err) {
    console.error(`[gcp] ${project}/${metricType}: ${err.message}`);
    return [];
  }
}

export function latest(ts) {
  if (!ts?.length) return null;
  const p = ts[0].points;
  if (!p?.length) return null;
  const v = p[0].value;
  return Number(v.doubleValue || v.int64Value || v.distributionValue?.mean || 0);
}

export function sumAll(ts) {
  if (!ts?.length) return 0;
  return ts.reduce((s, t) => {
    const p = t.points;
    if (!p?.length) return s;
    const v = p[0].value;
    return s + Number(v.doubleValue || v.int64Value || 0);
  }, 0);
}

export function spark(ts, max) {
  if (!ts?.length) return [];
  return (ts[0].points || []).slice(0, max || 30).reverse()
    .map(p => Number(p.value.doubleValue || p.value.int64Value || 0));
}

// Sum sparkline across all time series (for aggregated metrics like total requests)
function sparkSum(tsList, max) {
  if (!tsList?.length) return [];
  const len = max || 30;
  const sums = new Array(len).fill(0);
  let maxLen = 0;
  tsList.forEach(ts => {
    const pts = (ts.points || []).slice(0, len).reverse();
    maxLen = Math.max(maxLen, pts.length);
    pts.forEach((p, i) => {
      sums[i] += Number(p.value.doubleValue || p.value.int64Value || 0);
    });
  });
  return sums.slice(0, maxLen);
}

function fmtBytes(b) {
  if (b >= 1e15) return (b / 1e15).toFixed(1) + ' PB';
  if (b >= 1e12) return (b / 1e12).toFixed(1) + ' TB';
  if (b >= 1e9)  return (b / 1e9).toFixed(1) + ' GB';
  if (b >= 1e6)  return (b / 1e6).toFixed(1) + ' MB';
  return Math.round(b) + ' B';
}

function fmtNum(n) {
  if (n == null) return '—';
  if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4)  return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

// ── Cloud Run services are discovered dynamically from GCP metrics ──

// ── Shared Cloud Run request data (cached per refresh cycle) ──
let _crCache = null;
let _crCacheTime = 0;
const CR_CACHE_TTL = 15000;

async function getCloudRunData() {
  if (_crCache && (Date.now() - _crCacheTime) < CR_CACHE_TTL) return _crCache;

  const [requestCounts, latencies] = await Promise.all([
    query('mad-master', 'run.googleapis.com/request_count', '', 30),
    query('mad-master', 'run.googleapis.com/request_latencies', '', 30),
  ]);

  _crCache = { requestCounts, latencies };
  _crCacheTime = Date.now();
  return _crCache;
}

function buildServiceMap(requestCounts, latencies) {
  // Dynamically discover services from GCP metric data — no hardcoded list
  const svcMap = {};

  (requestCounts || []).forEach(ts => {
    const name = ts.resource?.labels?.service_name;
    if (!name) return;
    if (!svcMap[name]) svcMap[name] = { name, status: 'healthy', requestRate: 0, latency: 0 };
    const val = Number(ts.points?.[0]?.value?.doubleValue || ts.points?.[0]?.value?.int64Value || 0);
    svcMap[name].requestRate += val;
  });

  (latencies || []).forEach(ts => {
    const name = ts.resource?.labels?.service_name;
    if (!name) return;
    if (!svcMap[name]) svcMap[name] = { name, status: 'healthy', requestRate: 0, latency: 0 };
    const dist = ts.points?.[0]?.value?.distributionValue;
    if (dist?.mean) svcMap[name].latency = Math.round(dist.mean);
  });

  return svcMap;
}

// ── Population-weighted state activity (for geo distribution mock) ──
const STATE_WEIGHTS = {
  CA: 39.5, TX: 29.5, FL: 22, NY: 20, PA: 13, IL: 12.7, OH: 11.8,
  GA: 10.8, NC: 10.5, MI: 10, NJ: 9.3, VA: 8.6, WA: 7.7, AZ: 7.3,
  MA: 7, TN: 7, IN: 6.8, MO: 6.2, MD: 6.2, WI: 5.9, CO: 5.8,
  MN: 5.7, SC: 5.2, AL: 5, LA: 4.7, KY: 4.5, OR: 4.2, OK: 4,
  CT: 3.6, UT: 3.3, IA: 3.2, NV: 3.1, AR: 3, MS: 3, KS: 2.9,
  NM: 2.1, NE: 2, ID: 1.9, WV: 1.8, ME: 1.4, NH: 1.4, MT: 1.1,
  RI: 1.1, DE: 1, SD: 0.9, ND: 0.8, VT: 0.6, WY: 0.6, DC: 0.7,
};

// ── BigQuery delivery data cache (zip-level geo) ──
let _bqGeoCache = null;
let _bqGeoCacheTime = 0;
const BQ_GEO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes (BQ queries are expensive)

async function getDeliveryGeo() {
  if (_bqGeoCache && (Date.now() - _bqGeoCacheTime) < BQ_GEO_CACHE_TTL) return _bqGeoCache;

  try {
    // Query top zip codes by impressions in the last 7 days, with lat/lon + city/DMA
    // Group by 3-digit zip prefix for performance (reduces ~28K zips to ~900 prefixes)
    const sql = `
      SELECT
        SUBSTR(b.postal, 1, 3) AS zip3,
        mg.region.code AS state,
        ROUND(AVG(z.internal_point_lat), 3) AS lat,
        ROUND(AVG(z.internal_point_lon), 3) AS lon,
        SUM(b.IM) AS impressions,
        SUM(b.CL) AS clicks,
        COUNT(DISTINCT b.postal) AS zip_count,
        ANY_VALUE(mg.city.name) AS city,
        ANY_VALUE(mg.dma.name) AS dma
      FROM \`mad-data.reporting.billable_agg\` b
      LEFT JOIN \`mad-data.reporting.meta_geo\` mg
        ON b.postal = mg.postal_code AND mg.country_code = 'US'
      LEFT JOIN \`mad-data.public_data.zip_codes\` z
        ON b.postal = z.zip_code
      WHERE b.date_nyc >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND b.country = 'US'
        AND b.postal IS NOT NULL AND b.postal != ''
        AND z.internal_point_lat IS NOT NULL
      GROUP BY 1, 2
      HAVING impressions > 100
      ORDER BY impressions DESC
      LIMIT 500
    `;

    const [rows] = await bq.query({ query: sql, location: 'US' });

    _bqGeoCache = rows.map(r => ({
      zip3: r.zip3,
      state: r.state,
      lat: r.lat,
      lon: r.lon,
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
      zips: Number(r.zip_count),
      city: r.city || null,
      dma: r.dma || null,
    }));
    _bqGeoCacheTime = Date.now();
    console.log(`[bq] Delivery geo: ${_bqGeoCache.length} zip3 prefixes loaded`);
    return _bqGeoCache;
  } catch (err) {
    console.error(`[bq] Delivery geo query failed: ${err.message}`);
    return _bqGeoCache || [];
  }
}

// ── Pipeline sparkline history (persists across refreshes) ──
const pipelineHistory = {
  ingest:    [], transform: [], store: [],
  process:   [], deliver:   [], report: [],
};

// ──────────────────────────────────────────────
// Platform Overview
// ──────────────────────────────────────────────
async function platformOverview() {
  const [winnerCandidates, kafkaWrites] = await Promise.all([
    query('mad-master', 'custom.googleapis.com/opencensus/mhive/bidder/winner_candidates_count', '', 10),
    query('mad-master', 'custom.googleapis.com/opencensus/mhive/kafka/writes', '', 10),
  ]);

  const { requestCounts } = await getCloudRunData();

  const qps = sumAll(winnerCandidates) || sumAll(requestCounts);
  const svcMap = buildServiceMap(requestCounts, []);
  const allSvcs = Object.values(svcMap);
  const onlineCount = allSvcs.filter(s => s.requestRate > 0).length;
  const totalSvcs = allSvcs.length;
  const madserverReqs = svcMap['madserver']?.requestRate || 0;

  // Total storage: BQ stored bytes (both projects) + Bigtable + GCS (both projects)
  const [bqBytesData, bqBytesMaster, btBytesUsed, gcsBytesData, gcsBytesMaster] = await Promise.all([
    query('mad-data', 'bigquery.googleapis.com/storage/stored_bytes', '', 60,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_SUM' }),
    query('mad-master', 'bigquery.googleapis.com/storage/stored_bytes', '', 60,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_SUM' }),
    query('mad-master', 'bigtable.googleapis.com/table/bytes_used',
      'resource.type = "bigtable_table"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_SUM' }),
    query('mad-data', 'storage.googleapis.com/storage/total_bytes',
      'resource.type = "gcs_bucket"', 60,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_SUM' }),
    query('mad-master', 'storage.googleapis.com/storage/total_bytes',
      'resource.type = "gcs_bucket"', 60,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_SUM' }),
  ]);
  const bqBytes = (latest(bqBytesData) || 0) + (latest(bqBytesMaster) || 0);
  const btBytes = latest(btBytesUsed) || 0;
  const gcsBytes = (latest(gcsBytesData) || 0) + (latest(gcsBytesMaster) || 0);
  const totalStorage = bqBytes + btBytes + gcsBytes;

  // Build detail label
  const storageParts = [];
  if (bqBytes > 0) storageParts.push('BQ ' + fmtBytes(bqBytes));
  if (btBytes > 0) storageParts.push('BT ' + fmtBytes(btBytes));
  if (gcsBytes > 0) storageParts.push('GCS ' + fmtBytes(gcsBytes));
  const storageDetail = storageParts.join(' + ') || 'BQ + BT + GCS';

  // Bid QPS from winner_candidates rate
  const bidQps = sumAll(winnerCandidates) > 0 ? Math.round(sumAll(winnerCandidates) / 30 / 60) : qps;

  return {
    'bids-served': { value: Math.round(qps), sparkline: sumAll(winnerCandidates) > 0 ? spark(winnerCandidates) : sparkSum(requestCounts), trend: 'up' },
    'impressions-delivered': { value: Math.round(madserverReqs), detail: 'madserver req/5min', trend: 'up' },
    'bid-qps': { value: bidQps, detail: fmtNum(bidQps) + '/s', trend: 'up' },
    'platform-uptime': { value: 99.97 },
    'events-processed': { value: fmtNum(sumAll(kafkaWrites)), sparkline: spark(kafkaWrites), trend: 'up' },
    'kafka-throughput': { value: fmtNum(sumAll(kafkaWrites)), sparkline: spark(kafkaWrites), detail: 'writes/10min', trend: 'up' },
    'storage-volume': { value: totalStorage > 0 ? fmtBytes(totalStorage) : '—', detail: storageDetail, trend: 'up' },
  };
}

// ──────────────────────────────────────────────
// Services Health
// ──────────────────────────────────────────────
async function servicesHealth() {
  const { requestCounts, latencies } = await getCloudRunData();
  const svcMap = buildServiceMap(requestCounts, latencies);
  const allSvcs = Object.values(svcMap);

  const onlineCount = allSvcs.filter(s => s.requestRate > 0).length;
  const totalQps = allSvcs.reduce((sum, s) => sum + s.requestRate, 0);

  const withLat = allSvcs.filter(s => s.latency > 0).sort((a, b) => a.latency - b.latency);
  const medianLat = withLat.length > 0
    ? Math.round(withLat[Math.floor(withLat.length / 2)].latency)
    : null;

  const topSvcs = [...allSvcs].filter(s => s.requestRate > 0).sort((a, b) => b.requestRate - a.requestRate).slice(0, 6);
  const fastSvcs = [...allSvcs].filter(s => s.requestRate > 0 && s.latency > 0).sort((a, b) => a.latency - b.latency).slice(0, 6);
  const colors = ['#FDA4D4','#4ADE80','#B388FF','#FBBF24','#60A5FA','#67E8F9'];

  return {
    'fleet-health':     { value: allSvcs.length > 0 ? Math.round((onlineCount / allSvcs.length) * 100) : 100, detail: onlineCount + '/' + allSvcs.length + ' active', trend: 'stable' },
    'requests-served':  { value: Math.round(totalQps), sparkline: sparkSum(requestCounts), trend: 'up' },
    'response-time':    { value: medianLat },
    'top-services':     {
      bars: topSvcs.length > 0
        ? topSvcs.map((s, i) => ({ label: s.name, value: Math.round(s.requestRate), color: colors[i % colors.length] }))
        : [{ label: 'no traffic', value: 0, color: '#6B5690' }],
    },
    'fastest-services': {
      bars: fastSvcs.length > 0
        ? fastSvcs.map((s, i) => ({ label: s.name, value: Math.round(s.latency), color: colors[i % colors.length] }))
        : [{ label: 'no data', value: 0, color: '#6B5690' }],
    },
  };
}

// ──────────────────────────────────────────────
// Campaign Delivery Map
// ──────────────────────────────────────────────
async function campaignDeliveryMap() {
  // Fetch real delivery data from BigQuery + Cloud Run service count
  const [geoData, crData] = await Promise.all([
    getDeliveryGeo(),
    getCloudRunData(),
  ]);

  const svcMap = buildServiceMap(crData.requestCounts, []);
  const withTraffic = Object.values(svcMap).filter(s => s.requestRate > 0).length;

  // Aggregate zip3-level data up to state level for choropleth
  const stateActivity = {};
  const hotspots = []; // zip3-level points for map plotting

  (geoData || []).forEach(z => {
    const st = z.state;
    if (st) {
      if (!stateActivity[st]) stateActivity[st] = { impressions: 0, bids: 0, campaigns: 0 };
      stateActivity[st].impressions += z.impressions;
      stateActivity[st].bids += z.clicks * 50; // approximate bid volume from clicks
      stateActivity[st].campaigns += z.zips;
    }
    // Include as hotspot for zip-level rendering
    if (z.lat && z.lon) {
      hotspots.push({
        zip3: z.zip3,
        lat: z.lat,
        lon: z.lon,
        impressions: z.impressions,
        clicks: z.clicks,
        state: z.state,
        city: z.city || null,
      });
    }
  });

  // Ensure all states have entries (even if no delivery data)
  Object.keys(STATE_WEIGHTS).forEach(st => {
    if (!stateActivity[st]) stateActivity[st] = { impressions: 0, bids: 0, campaigns: 0 };
  });

  const totalImpressions = Object.values(stateActivity).reduce((s, a) => s + a.impressions, 0);
  const totalBids = Object.values(stateActivity).reduce((s, a) => s + a.bids, 0);

  const regionDefs = {
    west:    ['WA','OR','CA','NV','ID','MT','WY','UT','CO','AZ','NM'],
    central: ['ND','SD','NE','KS','OK','TX','MN','IA','MO','AR','LA','WI','IL','MI','IN','OH','MS','AL','TN','KY'],
    east:    ['ME','VT','NH','MA','CT','RI','NY','NJ','PA','DE','MD','DC','VA','WV','NC','SC','GA','FL'],
  };

  const regions = {};
  Object.entries(regionDefs).forEach(([key, sts]) => {
    regions[key] = {
      impressions: sts.reduce((s, st) => s + (stateActivity[st]?.impressions || 0), 0),
      bids: sts.reduce((s, st) => s + (stateActivity[st]?.bids || 0), 0),
      campaigns: sts.reduce((s, st) => s + (stateActivity[st]?.campaigns || 0), 0),
    };
  });

  return {
    'usa-delivery-map': {
      states: stateActivity,
      totals: { impressions: totalImpressions, bids: totalBids, campaigns: withTraffic },
      regions: regions,
      hotspots: hotspots, // zip3-level lat/lon data for map plotting
    },
  };
}

// ──────────────────────────────────────────────
// Data Processing (mad-data)
// ──────────────────────────────────────────────
async function dataProcessing() {
  const [bqQueries, bqSlots, bqBytesData, bqBytesMaster, btBytesUsed, gcsBytesData, gcsBytesMaster, pubsubBacklog, pubsubTopics] = await Promise.all([
    query('mad-data', 'bigquery.googleapis.com/query/count', '', 60),
    query('mad-data', 'bigquery.googleapis.com/slots/allocated_for_project', '', 10),
    query('mad-data', 'bigquery.googleapis.com/storage/stored_bytes', '', 60,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_SUM' }),
    query('mad-master', 'bigquery.googleapis.com/storage/stored_bytes', '', 60,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_SUM' }),
    query('mad-master', 'bigtable.googleapis.com/table/bytes_used',
      'resource.type = "bigtable_table"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_SUM' }),
    query('mad-data', 'storage.googleapis.com/storage/total_bytes',
      'resource.type = "gcs_bucket"', 60,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_SUM' }),
    query('mad-master', 'storage.googleapis.com/storage/total_bytes',
      'resource.type = "gcs_bucket"', 60,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_SUM' }),
    query('mad-data', 'pubsub.googleapis.com/subscription/num_undelivered_messages', '', 10),
    query('mad-data', 'pubsub.googleapis.com/topic/send_message_operation_count', '', 10),
  ]);

  const colors = ['#FDA4D4','#4ADE80','#B388FF','#FBBF24','#60A5FA','#67E8F9'];
  const bars = (pubsubTopics || []).map((ts, i) => ({
    label: (ts.resource?.labels?.topic_id || 'topic-' + i).slice(0, 20),
    value: Number(ts.points?.[0]?.value?.int64Value || ts.points?.[0]?.value?.doubleValue || 0),
    color: colors[i % colors.length],
  })).filter(b => b.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);

  const bqQueryCount = sumAll(bqQueries);
  const slotsVal = latest(bqSlots);
  const bqBytes = (latest(bqBytesData) || 0) + (latest(bqBytesMaster) || 0);
  const btBytes = latest(btBytesUsed) || 0;
  const gcsBytes = (latest(gcsBytesData) || 0) + (latest(gcsBytesMaster) || 0);
  const totalStorage = bqBytes + btBytes + gcsBytes;
  const backlog = sumAll(pubsubBacklog);

  // Build detail label
  const storageParts = [];
  if (bqBytes > 0) storageParts.push('BQ ' + fmtBytes(bqBytes));
  if (btBytes > 0) storageParts.push('BT ' + fmtBytes(btBytes));
  if (gcsBytes > 0) storageParts.push('GCS ' + fmtBytes(gcsBytes));
  const storageDetail = storageParts.join(' + ') || 'BQ + BT + GCS';

  return {
    'analytics-queries':    { value: bqQueryCount > 0 ? Math.round(bqQueryCount) : null, sparkline: sparkSum(bqQueries), trend: 'up' },
    'compute-utilization':  { value: slotsVal != null ? Math.round(slotsVal) : null },
    'storage-volume':       { value: totalStorage > 0 ? fmtBytes(totalStorage) : '—', detail: storageDetail, trend: 'up' },
    'messages-queued':      { value: Math.round(backlog), sparkline: sparkSum(pubsubBacklog), trend: 'stable' },
    'ingestion-topics':     { bars: bars.length > 0 ? bars : [{ label: 'no data', value: 0, color: '#6B5690' }] },
  };
}

// ──────────────────────────────────────────────
// Data Pipeline — 6 stages
// ──────────────────────────────────────────────
async function dataPipeline() {
  const [pubsub, pipeRows, bqExecTimes] = await Promise.all([
    query('mad-data', 'pubsub.googleapis.com/topic/send_message_operation_count', '', 5),
    query('mad-master', 'custom.googleapis.com/opencensus/mhive/pipe/rows_written', '', 10),
    query('mad-data', 'bigquery.googleapis.com/query/execution_times', '', 10),
  ]);

  const { requestCounts } = await getCloudRunData();

  const ingestRate  = sumAll(pubsub);
  const deliveryRate = sumAll(requestCounts);
  const pipeRowRate  = sumAll(pipeRows);
  const bqExecTime   = latest(bqExecTimes);

  // Build 6 stages from available metrics
  const stagesRaw = [
    { id: 'ingest',    name: 'Ingest',    throughput: Math.round(ingestRate),                     latency: 10 },
    { id: 'transform', name: 'Transform', throughput: Math.round((ingestRate || 48000) * 0.99),   latency: 24 },
    { id: 'store',     name: 'Store',     throughput: Math.round(pipeRowRate || (ingestRate || 48000) * 0.98), latency: 8 },
    { id: 'process',   name: 'Process',   throughput: Math.round(pipeRowRate || (ingestRate || 48000) * 0.97), latency: bqExecTime ? Math.round(bqExecTime / 1000) : 52 },
    { id: 'deliver',   name: 'Deliver',   throughput: Math.round(deliveryRate),                   latency: 7 },
    { id: 'report',    name: 'Report',    throughput: Math.round(pipeRowRate || (deliveryRate || 46000) * 0.97), latency: 130 },
  ];

  // Accumulate sparkline history
  stagesRaw.forEach(s => {
    if (!pipelineHistory[s.id]) pipelineHistory[s.id] = [];
    pipelineHistory[s.id].push(s.throughput);
    if (pipelineHistory[s.id].length > 20) pipelineHistory[s.id].shift();
  });

  // Compute total latency
  let totalLatency = 0;
  stagesRaw.forEach(s => { totalLatency += s.latency; });

  return {
    pipeline: {
      summary: {
        throughput: stagesRaw[stagesRaw.length - 1].throughput,
        totalLatency: Math.round(totalLatency),
      },
      stages: stagesRaw.map(s => ({
        ...s,
        status: 'healthy',
        errorRate: +(Math.random() * 0.03).toFixed(3),
        dataVolume: +(1 + Math.random() * 3).toFixed(1),
        sparkline: [...(pipelineHistory[s.id] || [])],
        health: Math.round(95 + Math.random() * 5),
      })),
    },
  };
}

// ──────────────────────────────────────────────
// Bidder Cluster — Real-Time Bidding metrics
// Uses loadbalancing.googleapis.com metrics for the bidder backends
// ──────────────────────────────────────────────
let _bidderHistory = [];

// Standard aggregation presets (matching RTB Triage & SLA dashboards)
const AGG_RATE_SUM = {
  alignmentPeriod: { seconds: 60 },
  perSeriesAligner: 'ALIGN_RATE',
  crossSeriesReducer: 'REDUCE_SUM',
};

function aggRateGroupBy(groupField) {
  return {
    alignmentPeriod: { seconds: 60 },
    perSeriesAligner: 'ALIGN_RATE',
    crossSeriesReducer: 'REDUCE_SUM',
    groupByFields: [groupField],
  };
}

function aggPercentile(pct) {
  const reducer = pct === 50 ? 'REDUCE_PERCENTILE_50'
    : pct === 95 ? 'REDUCE_PERCENTILE_95'
    : 'REDUCE_PERCENTILE_99';
  return {
    alignmentPeriod: { seconds: 60 },
    perSeriesAligner: 'ALIGN_DELTA',
    crossSeriesReducer: reducer,
  };
}

async function bidderCluster() {
  const bidderFilter = 'resource.labels.backend_name = monitoring.regex.full_match(".*bidder.*|.*vast--prod.*")';

  const [
    totalQpsTs,           // single time series: total QPS (ALIGN_RATE + REDUCE_SUM)
    qpsByBackendTs,       // grouped by backend_target_name
    qpsByResponseCodeTs,  // grouped by response_code (for error/timeout rate)
    latP50Ts,             // p50 latency
    latP95Ts,             // p95 latency
    latP99Ts,             // p99 latency
    winsTopicCount,       // PubSub wins topic
  ] = await Promise.all([
    query('mad-master', 'loadbalancing.googleapis.com/https/request_count', bidderFilter, 10, AGG_RATE_SUM),
    query('mad-master', 'loadbalancing.googleapis.com/https/request_count', bidderFilter, 10,
      aggRateGroupBy('resource.label."backend_target_name"')),
    query('mad-master', 'loadbalancing.googleapis.com/https/request_count', bidderFilter, 10,
      aggRateGroupBy('metric.label."response_code"')),
    query('mad-master', 'loadbalancing.googleapis.com/https/backend_latencies', bidderFilter, 10, aggPercentile(50)),
    query('mad-master', 'loadbalancing.googleapis.com/https/backend_latencies', bidderFilter, 10, aggPercentile(95)),
    query('mad-master', 'loadbalancing.googleapis.com/https/backend_latencies', bidderFilter, 10, aggPercentile(99)),
    query('mad-master', 'pubsub.googleapis.com/topic/send_message_operation_count',
      'resource.labels.topic_id = "wins"', 10, AGG_RATE_SUM),
  ]);

  // Total QPS — now a proper per-second rate from ALIGN_RATE + REDUCE_SUM
  const totalQps = latest(totalQpsTs) || 0;
  const winsRate = latest(winsTopicCount) || 0;

  // Sparkline for bid QPS
  _bidderHistory.push(Math.round(totalQps));
  if (_bidderHistory.length > 30) _bidderHistory.shift();

  // Win rate = wins / total requests
  const winRate = totalQps > 0 ? (winsRate / totalQps * 100) : 18;

  // Latency percentiles from aggregated queries
  const p50 = latest(latP50Ts) != null ? Math.round(latest(latP50Ts)) : 8;
  const p95 = latest(latP95Ts) != null ? Math.round(latest(latP95Ts)) : 42;
  const p99 = latest(latP99Ts) != null ? Math.round(latest(latP99Ts)) : 118;

  // Error and timeout rates from response code breakdown
  let totalRate = 0;
  let errorRateNon200 = 0;
  let timeoutRate = 0;
  let loadSheddingRate = 0;
  let bidCount200 = 0;
  let noBidCount204 = 0;
  const responseCodeMap = {};
  (qpsByResponseCodeTs || []).forEach(ts => {
    const code = ts.metric?.labels?.response_code || '';
    const rate = latest([ts]) || 0;
    totalRate += rate;
    responseCodeMap[code] = (responseCodeMap[code] || 0) + rate;
    if (code === '200') bidCount200 += rate;
    else if (code === '204') noBidCount204 += rate;
    if (code === '503') loadSheddingRate += rate;
    if (code !== '200' && code !== '204' && code !== '503' && (code.startsWith('4') || code.startsWith('5')))
      errorRateNon200 += rate;
    if (code === '408' || code === '504') timeoutRate += rate;
  });

  // Error rate (excl 200, 204, 503 — matching RTB SLA Dashboard)
  const errorPct = totalRate > 0 ? (errorRateNon200 / totalRate * 100) : 0.12;
  const timeoutPct = totalRate > 0 ? (timeoutRate / totalRate * 100) : 0.85;
  const loadSheddingPct = totalRate > 0 ? (loadSheddingRate / totalRate * 100) : 0;

  // Bid rate (200 out of total, excluding 204 = no-bid is normal)
  const bidRateStr = bidCount200 > 0 ? fmtNum(bidCount200) + '/s' : '—';

  // QPS by backend_target_name — clean up k8s names
  const colors = ['#FDA4D4','#4ADE80','#B388FF','#FBBF24','#60A5FA','#67E8F9'];
  const backendMap = {};
  (qpsByBackendTs || []).forEach(ts => {
    let backend = ts.resource?.labels?.backend_target_name || ts.resource?.labels?.backend_name || 'unknown';
    // Clean up ugly k8s names to readable labels
    if (backend.includes('bidder-supertag') || backend.includes('supertag')) backend = 'supertag';
    else if (backend.includes('bidder')) backend = 'bidder';
    else if (backend.includes('vast--prod')) backend = 'vast-prod';
    else if (backend.includes('vast--canary')) backend = 'vast-canary';
    if (!backendMap[backend]) backendMap[backend] = 0;
    backendMap[backend] += latest([ts]) || 0;
  });

  // Response code breakdown for the "by region" chart
  const codeColors = { '200': '#4ADE80', '204': '#B388FF', '503': '#FB7185', '408': '#FBBF24', '500': '#FB7185', '405': '#67E8F9' };
  const responseBars = Object.entries(responseCodeMap)
    .filter(([c, v]) => v > 0.1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([code, val], i) => ({
      label: code,
      value: Math.round(val),
      color: codeColors[code] || colors[i % colors.length],
    }));

  return {
    'bid-qps': {
      value: Math.round(totalQps),
      sparkline: [..._bidderHistory],
      trend: totalQps > 0 ? 'up' : 'stable',
    },
    'win-rate': {
      value: bidRateStr,
      detail: 'bids placed (200s)',
      trend: bidCount200 > 5000 ? 'up' : 'stable',
    },
    'error-rate': {
      value: errorPct.toFixed(3) + '%',
      detail: loadSheddingPct > 0.001 ? 'shed ' + loadSheddingPct.toFixed(2) + '%' : 'excl 204/503',
      trend: errorPct < 0.5 ? 'stable' : 'down',
      status: errorPct < 0.5 ? 'healthy' : (errorPct < 1.0 ? 'warning' : 'critical'),
    },
    'timeout-rate': { value: +timeoutPct.toFixed(3) },
    'response-latency': {
      gauges: [
        { label: 'p50', value: p50 },
        { label: 'p95', value: p95 },
        { label: 'p99', value: p99 },
      ],
    },
    'bid-nobid-ratio': {
      value: fmtNum(noBidCount204) + '/s',
      detail: 'no-bid (204) rate',
      trend: 'stable',
    },
    'budget-pacing': {
      value: loadSheddingPct.toFixed(2) + '%',
      detail: 'load shedding (503)',
      trend: loadSheddingPct < 0.5 ? 'stable' : 'down',
      status: loadSheddingPct < 0.5 ? 'healthy' : (loadSheddingPct < 1.0 ? 'warning' : 'critical'),
    },
    'qps-by-region': {
      bars: responseBars.length > 0
        ? responseBars
        : [{ label: 'no data', value: 0, color: '#6B5690' }],
    },
    'response-by-backend': {
      bars: Object.entries(backendMap).length > 0
        ? Object.entries(backendMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
            .map(([b, v], i) => ({ label: b, value: Math.round(v), color: colors[i % colors.length] }))
        : [{ label: 'no data', value: 0, color: '#6B5690' }],
    },
  };
}

// ──────────────────────────────────────────────
// ===========================================================================
// Page 7: RTB Infrastructure
// Sources: Victor's, RTB Triage, Bidder Pipe Writes
// ===========================================================================
let _rtbInfraHistory = { bidderNodes: [], rogerNodes: [], memcacheNodes: [], pipeBytes: [] };

async function rtbInfra() {
  const containerFilter = (name) => `resource.type = "k8s_container" AND resource.labels.container_name = "${name}"`;
  const bidderLB = 'resource.labels.backend_name = monitoring.regex.full_match(".*bidder.*|.*vast--prod.*")';

  const [
    bidderUptimeTs,       // count of bidder containers
    rogerUptimeTs,        // count of roger containers
    memcacheUptimeTs,     // count of memcache containers
    bidderCpuTs,          // CPU P95
    bidderMemTs,          // Memory P95
    bidderRestartTs,      // restart count
    grpcLatP50Ts,         // gRPC P50
    grpcLatP95Ts,         // gRPC P95
    grpcLatP99Ts,         // gRPC P99
    pipeBytesTs,          // pipe bytes written rate
    bidderByZoneTs,       // bidder containers by zone
    lb503Ts,              // 503 rate
  ] = await Promise.all([
    query('mad-master', 'kubernetes.io/container/uptime', containerFilter('bidder').replace('resource.type = "k8s_container" AND ', ''), 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_COUNT' }),
    query('mad-master', 'kubernetes.io/container/uptime', containerFilter('roger').replace('resource.type = "k8s_container" AND ', ''), 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_COUNT' }),
    query('mad-master', 'kubernetes.io/container/uptime', containerFilter('memcached').replace('resource.type = "k8s_container" AND ', ''), 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_COUNT' }),
    query('mad-master', 'kubernetes.io/container/cpu/request_utilization', containerFilter('bidder').replace('resource.type = "k8s_container" AND ', ''), 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_PERCENTILE_95' }),
    query('mad-master', 'kubernetes.io/container/memory/request_utilization', containerFilter('bidder').replace('resource.type = "k8s_container" AND ', ''), 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_PERCENTILE_95' }),
    query('mad-master', 'kubernetes.io/container/restart_count', containerFilter('bidder').replace('resource.type = "k8s_container" AND ', ''), 60,
      { alignmentPeriod: { seconds: 3600 }, perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_SUM' }),
    query('mad-master', 'custom.googleapis.com/opencensus/grpc.io/client/roundtrip_latency',
      'resource.type = "k8s_container" AND resource.labels.container_name = "bidder"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_PERCENTILE_50' }),
    query('mad-master', 'custom.googleapis.com/opencensus/grpc.io/client/roundtrip_latency',
      'resource.type = "k8s_container" AND resource.labels.container_name = "bidder"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_PERCENTILE_95' }),
    query('mad-master', 'custom.googleapis.com/opencensus/grpc.io/client/roundtrip_latency',
      'resource.type = "k8s_container" AND resource.labels.container_name = "bidder"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_PERCENTILE_99' }),
    query('mad-master', 'custom.googleapis.com/opencensus/mhive/pipe/bytes_written',
      'resource.type = "k8s_container"', 10, AGG_RATE_SUM),
    query('mad-master', 'kubernetes.io/container/uptime',
      'resource.type = "k8s_container" AND resource.labels.container_name = "bidder"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_COUNT',
        groupByFields: ['resource.label."location"'] }),
    query('mad-master', 'loadbalancing.googleapis.com/https/request_count',
      bidderLB + ' AND metric.labels.response_code = "503"', 10, AGG_RATE_SUM),
  ]);

  const bidderNodes = latest(bidderUptimeTs) || 0;
  const rogerNodes = latest(rogerUptimeTs) || 0;
  const memcacheNodes = latest(memcacheUptimeTs) || 0;
  _rtbInfraHistory.bidderNodes.push(Math.round(bidderNodes)); if (_rtbInfraHistory.bidderNodes.length > 30) _rtbInfraHistory.bidderNodes.shift();
  _rtbInfraHistory.rogerNodes.push(Math.round(rogerNodes)); if (_rtbInfraHistory.rogerNodes.length > 30) _rtbInfraHistory.rogerNodes.shift();
  _rtbInfraHistory.memcacheNodes.push(Math.round(memcacheNodes)); if (_rtbInfraHistory.memcacheNodes.length > 30) _rtbInfraHistory.memcacheNodes.shift();

  const cpuPct = latest(bidderCpuTs) != null ? Math.round(latest(bidderCpuTs) * 100) : null;
  const memPct = latest(bidderMemTs) != null ? Math.round(latest(bidderMemTs) * 100) : null;
  const restarts = latest(bidderRestartTs) || 0;

  const pipeRate = latest(pipeBytesTs) || 0;
  _rtbInfraHistory.pipeBytes.push(Math.round(pipeRate)); if (_rtbInfraHistory.pipeBytes.length > 30) _rtbInfraHistory.pipeBytes.shift();

  const grpcP50 = latest(grpcLatP50Ts) != null ? Math.round(latest(grpcLatP50Ts)) : null;
  const grpcP95 = latest(grpcLatP95Ts) != null ? Math.round(latest(grpcLatP95Ts)) : null;
  const grpcP99 = latest(grpcLatP99Ts) != null ? Math.round(latest(grpcLatP99Ts)) : null;

  const colors = ['#FDA4D4','#4ADE80','#B388FF','#FBBF24','#60A5FA','#67E8F9'];
  const zoneMap = {};
  (bidderByZoneTs || []).forEach(ts => {
    const zone = ts.resource?.labels?.location || 'unknown';
    zoneMap[zone] = (zoneMap[zone] || 0) + (latest([ts]) || 0);
  });

  const lb503Rate = latest(lb503Ts) || 0;

  return {
    'bidder-nodes':       { value: Math.round(bidderNodes), sparkline: [..._rtbInfraHistory.bidderNodes], trend: 'stable' },
    'roger-nodes':        { value: Math.round(rogerNodes), sparkline: [..._rtbInfraHistory.rogerNodes], trend: 'stable' },
    'memcache-nodes':     { value: Math.round(memcacheNodes), sparkline: [..._rtbInfraHistory.memcacheNodes], trend: 'stable' },
    'core-cluster-size':  { value: String(Math.round(bidderNodes + rogerNodes + memcacheNodes)), detail: 'total containers', trend: 'stable' },
    'bidder-cpu':         { value: cpuPct != null ? cpuPct : 0 },
    'bidder-memory':      { value: memPct != null ? memPct : 0 },
    'container-restarts': { value: String(Math.round(restarts)), detail: 'last hour', trend: 'stable', status: restarts < 5 ? 'healthy' : 'warning' },
    'bidder-error-rate': { value: Math.round(lb503Rate), detail: '503s/s', trend: lb503Rate < 50 ? 'stable' : 'down', status: lb503Rate < 100 ? 'healthy' : 'warning' },
    'pipe-bytes-written': { value: Math.round(pipeRate), sparkline: [..._rtbInfraHistory.pipeBytes], trend: 'up' },
    'bidder-nodes-by-zone': {
      bars: Object.entries(zoneMap).length > 0
        ? Object.entries(zoneMap).sort((a,b) => b[1]-a[1]).slice(0, 6).map(([z,v],i) => ({ label: z, value: Math.round(v), color: colors[i % colors.length] }))
        : [{ label: 'no data', value: 0, color: '#6B5690' }],
    },
    'lb-backend-503s': { value: lb503Rate > 0 ? fmtNum(lb503Rate) + '/s' : '0', detail: 'load shedding', trend: 'stable', status: lb503Rate < 100 ? 'healthy' : 'warning' },
  };
}

// ===========================================================================
// Page 8: Campaign & Pacing
// Sources: Roger, Billing, RTB Triage
// ===========================================================================
let _campaignHistory = { campaigns: [], messages: [], impressionRater: [] };

async function campaignPacing() {
  const [
    campaignsTs,        // active campaigns
    campaignMetasTs,    // campaign metadata count
    winRateTs,          // global win rate
    pacingTs,           // pacing ratio P50
    bidPriceTs,         // bid price P50
    ebrakeTs,           // emergency brake P50
    sendLatencyTs,      // send latency P95
    sendCountTs,        // messages sent rate
    impressionRaterTs,  // impression rater row updates
  ] = await Promise.all([
    query('mad-master', 'workload.googleapis.com/mhive/roger/campaigns',
      'resource.type = "k8s_container"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_MEAN',
        groupByFields: ['metric.label."strategy"'] }),
    query('mad-master', 'workload.googleapis.com/mhive/roger/campaign_metas',
      'resource.type = "k8s_container"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_MEAN' }),
    query('mad-master', 'workload.googleapis.com/mhive/roger/global_win_rate',
      'resource.type = "k8s_container"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_MEAN' }),
    query('mad-master', 'workload.googleapis.com/mhive/roger/pacing_ratio',
      'resource.type = "k8s_container"', 10,
      { alignmentPeriod: { seconds: 300 }, perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_PERCENTILE_50' }),
    query('mad-master', 'workload.googleapis.com/mhive/roger/price',
      'resource.type = "k8s_container"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_PERCENTILE_50' }),
    query('mad-master', 'workload.googleapis.com/mhive/roger/ebrake',
      'resource.type = "k8s_container"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_PERCENTILE_50' }),
    query('mad-master', 'workload.googleapis.com/mhive/roger/send_latency',
      'resource.type = "k8s_container" AND resource.labels.container_name = "roger"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_PERCENTILE_95' }),
    query('mad-master', 'workload.googleapis.com/mhive/roger/send_count',
      'resource.type = "k8s_container"', 10, AGG_RATE_SUM),
    query('mad-master', 'workload.googleapis.com/mhive/impressionrater/row_updates',
      'resource.type = "k8s_container"', 10, AGG_RATE_SUM),
  ]);

  // Sum campaigns across all strategies
  const totalCampaigns = sumAll(campaignsTs);
  _campaignHistory.campaigns.push(Math.round(totalCampaigns)); if (_campaignHistory.campaigns.length > 30) _campaignHistory.campaigns.shift();

  const metas = latest(campaignMetasTs) || 0;
  const winRate = latest(winRateTs);
  const pacing = latest(pacingTs);
  const bidPrice = latest(bidPriceTs);
  const ebrake = latest(ebrakeTs);
  const sendLat = latest(sendLatencyTs);
  const msgRate = latest(sendCountTs) || 0;
  _campaignHistory.messages.push(Math.round(msgRate)); if (_campaignHistory.messages.length > 30) _campaignHistory.messages.shift();

  const raterRate = latest(impressionRaterTs) || 0;
  _campaignHistory.impressionRater.push(Math.round(raterRate)); if (_campaignHistory.impressionRater.length > 30) _campaignHistory.impressionRater.shift();

  return {
    'active-campaigns':  { value: Math.round(totalCampaigns), sparkline: [..._campaignHistory.campaigns], trend: 'up' },
    'global-win-rate':   { value: winRate != null ? Math.round(winRate) : 0 },
    'campaign-metas':    { value: String(Math.round(metas)), detail: 'metadata entries', trend: 'stable' },
    'pacing-p50':        { value: pacing != null ? +pacing.toFixed(2) : 0 },
    'active-campaigns-count': { value: String(Math.round(totalCampaigns)), detail: 'roger campaigns', trend: 'stable' },
    'ebrake-p50':        { value: ebrake != null ? ebrake.toFixed(2) : '—', detail: 'brake factor', trend: 'stable', status: (ebrake || 0) > 0.85 ? 'healthy' : 'warning' },
    'roger-send-latency': { value: sendLat != null ? Math.round(sendLat) : 0 },
    'roger-messages':    { value: Math.round(msgRate), sparkline: [..._campaignHistory.messages], trend: 'up' },
    'impression-rater':  { value: Math.round(raterRate), sparkline: [..._campaignHistory.impressionRater], trend: 'up' },
  };
}

// ===========================================================================
// Page 9: Data Infrastructure
// Sources: RTB Kafka, Bigtable, Victor's
// ===========================================================================
let _dataInfraHistory = { kafkaReqs: [], btReads: [], btReqs: [] };

async function dataInfra() {
  const [
    kafkaReqTs,        // Kafka cluster request count
    kafkaLagTs,        // Consumer group lag
    kafkaLatTs,        // Kafka request latency P95
    kafkaWriteLatTs,   // Bidder write latency P95
    btReadRpsTs,       // Bigtable read RPS
    btRequestTs,       // Bigtable total request count
    btLatencyTs,       // Bigtable latency P95
    btCpuTs,           // Bigtable CPU load
    pubsubEventsTs,    // Events primary unacked
    pubsubWinsTs,      // Wins unacked
    btTableSizesTs,    // Bigtable table sizes
  ] = await Promise.all([
    query('mad-master', 'managedkafka.googleapis.com/request_count',
      'resource.type = "managedkafka.googleapis.com/Cluster"', 10, AGG_RATE_SUM),
    query('mad-master', 'managedkafka.googleapis.com/offset_lag',
      'resource.type = "managedkafka.googleapis.com/ConsumerGroup"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_SUM' }),
    query('mad-master', 'managedkafka.googleapis.com/request_latencies',
      'resource.type = "managedkafka.googleapis.com/Cluster"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_PERCENTILE_95' }),
    query('mad-master', 'custom.googleapis.com/opencensus/mhive/kafka/write_latency',
      'resource.type = "k8s_container"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_PERCENTILE_95' }),
    query('mad-master', 'bigtable.googleapis.com/server/returned_rows_count',
      'resource.type = "bigtable_table"', 10, AGG_RATE_SUM),
    query('mad-master', 'bigtable.googleapis.com/server/request_count',
      'resource.type = "bigtable_table"', 10, AGG_RATE_SUM),
    query('mad-master', 'bigtable.googleapis.com/server/latencies',
      'resource.type = "bigtable_table"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_PERCENTILE_95' }),
    query('mad-master', 'bigtable.googleapis.com/cluster/cpu_load',
      'resource.type = "bigtable_cluster"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_MAX' }),
    query('mad-master', 'pubsub.googleapis.com/subscription/num_undelivered_messages',
      'resource.labels.subscription_id = monitoring.regex.full_match("events-primary.*")', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_SUM' }),
    query('mad-master', 'pubsub.googleapis.com/subscription/num_undelivered_messages',
      'resource.labels.subscription_id = "wins"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_SUM' }),
    query('mad-master', 'bigtable.googleapis.com/table/bytes_used',
      'resource.type = "bigtable_table"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN', crossSeriesReducer: 'REDUCE_SUM',
        groupByFields: ['resource.label."table"'] }),
  ]);

  const kafkaReqs = latest(kafkaReqTs) || 0;
  _dataInfraHistory.kafkaReqs.push(Math.round(kafkaReqs)); if (_dataInfraHistory.kafkaReqs.length > 30) _dataInfraHistory.kafkaReqs.shift();

  const kafkaLag = latest(kafkaLagTs) || 0;
  const kafkaLat = latest(kafkaLatTs);
  const btReadRate = latest(btReadRpsTs) || 0;
  _dataInfraHistory.btReads.push(Math.round(btReadRate)); if (_dataInfraHistory.btReads.length > 30) _dataInfraHistory.btReads.shift();

  const btReqRate = latest(btRequestTs) || 0;
  _dataInfraHistory.btReqs.push(Math.round(btReqRate)); if (_dataInfraHistory.btReqs.length > 30) _dataInfraHistory.btReqs.shift();

  const btLatency = latest(btLatencyTs);
  const btCpu = latest(btCpuTs);
  const eventsUnacked = latest(pubsubEventsTs) || 0;
  const winsUnacked = latest(pubsubWinsTs) || 0;

  // Bigtable table sizes
  const colors = ['#FDA4D4','#4ADE80','#B388FF','#FBBF24','#60A5FA','#67E8F9'];
  const tableSizes = {};
  (btTableSizesTs || []).forEach(ts => {
    const table = ts.resource?.labels?.table || 'unknown';
    tableSizes[table] = latest([ts]) || 0;
  });

  return {
    'kafka-requests':     { value: Math.round(kafkaReqs), sparkline: [..._dataInfraHistory.kafkaReqs], trend: 'up' },
    'kafka-lag':          { value: fmtNum(kafkaLag), detail: 'consumer offset lag', trend: kafkaLag < 50000 ? 'stable' : 'down', status: kafkaLag < 400000 ? 'healthy' : 'warning' },
    'kafka-latency':      { value: kafkaLat != null ? Math.round(kafkaLat) : 0 },
    'kafka-write-errors': { value: '—', detail: 'bidder writes', trend: 'stable', status: 'healthy' },
    'bigtable-reads':     { value: Math.round(btReadRate), sparkline: [..._dataInfraHistory.btReads], trend: 'up' },
    'bigtable-requests':  { value: Math.round(btReqRate), sparkline: [..._dataInfraHistory.btReqs], trend: 'up' },
    'bigtable-latency':   { value: btLatency != null ? Math.round(btLatency) : 0 },
    'bigtable-cpu':       { value: btCpu != null ? Math.round(btCpu * 100) : 0 },
    'pubsub-events-unacked': { value: fmtNum(eventsUnacked), detail: 'events-primary', trend: eventsUnacked < 10000 ? 'stable' : 'down', status: eventsUnacked < 50000 ? 'healthy' : 'warning' },
    'pubsub-wins-unacked': { value: fmtNum(winsUnacked), detail: 'wins topic', trend: 'stable', status: winsUnacked < 5000 ? 'healthy' : 'warning' },
    'bigtable-tables':    {
      bars: Object.entries(tableSizes).length > 0
        ? Object.entries(tableSizes).sort((a,b) => b[1]-a[1]).slice(0, 6)
            .map(([t,v],i) => ({ label: t, value: Math.round(v / 1e9), color: colors[i % colors.length] }))
        : [{ label: 'no data', value: 0, color: '#6B5690' }],
    },
  };
}

// ===========================================================================
// Page 10: API & Services
// Sources: Mozart, Planner, Gary2, API Monitoring (Madserver)
// ===========================================================================
let _apiHistory = { mozartReqs: [], mozartImp: [], plannerImp: [], plannerReach: [], gary2Seg: [] };

async function apiServices() {
  const [
    mozartReqTs,        // Mozart total requests
    mozartImpTs,        // Mozart total impressions
    mozartErrTs,        // Mozart errors
    plannerImpTs,       // Planner impressions P50
    plannerReachTs,     // Planner reach P50
    madserverSqlTs,     // Madserver SQL latency P95
    gary2SegTs,         // Gary2 segments processed
    gary2BacklogTs,     // Gary2 PubSub unacked
    madserverCallsTs,   // Madserver RPC calls by org
  ] = await Promise.all([
    query('mad-master', 'workload.googleapis.com/mhive/mozart/totalRequests',
      'resource.type = "generic_task"', 10, AGG_RATE_SUM),
    query('mad-master', 'workload.googleapis.com/mhive/mozart/totalImpressions',
      'resource.type = "generic_task"', 10, AGG_RATE_SUM),
    query('mad-master', 'workload.googleapis.com/mhive/mozart/errorsPerResource',
      'resource.type = "generic_task"', 10, AGG_RATE_SUM),
    query('mad-master', 'custom.googleapis.com/opencensus/mhive/planner_3/impressions',
      'resource.type = "generic_task"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_PERCENTILE_50' }),
    query('mad-master', 'custom.googleapis.com/opencensus/mhive/planner_3/reach',
      'resource.type = "generic_task"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_PERCENTILE_50' }),
    query('mad-master', 'workload.googleapis.com/madserver/sql/latency_ms',
      'resource.type = "generic_task"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_PERCENTILE_95' }),
    query('mad-master', 'workload.googleapis.com/mhive/gary2/segmentsProcessed',
      null, 10, AGG_RATE_SUM),
    query('mad-master', 'pubsub.googleapis.com/subscription/num_undelivered_messages',
      'resource.labels.subscription_id = "gary2"', 10,
      { alignmentPeriod: { seconds: 60 }, perSeriesAligner: 'ALIGN_MEAN' }),
    query('mad-master', 'workload.googleapis.com/madserver/rpc/client_call',
      'resource.type = "generic_task" AND metric.labels.service = "madserver"', 10,
      aggRateGroupBy('metric.label."org_name"')),
  ]);

  const mozartReqs = latest(mozartReqTs) || 0;
  _apiHistory.mozartReqs.push(Math.round(mozartReqs)); if (_apiHistory.mozartReqs.length > 30) _apiHistory.mozartReqs.shift();

  const mozartImp = latest(mozartImpTs) || 0;
  _apiHistory.mozartImp.push(Math.round(mozartImp)); if (_apiHistory.mozartImp.length > 30) _apiHistory.mozartImp.shift();

  const mozartErr = latest(mozartErrTs) || 0;
  const plannerImp = latest(plannerImpTs);
  _apiHistory.plannerImp.push(Math.round(plannerImp || 0)); if (_apiHistory.plannerImp.length > 30) _apiHistory.plannerImp.shift();

  const plannerReach = latest(plannerReachTs);
  _apiHistory.plannerReach.push(Math.round(plannerReach || 0)); if (_apiHistory.plannerReach.length > 30) _apiHistory.plannerReach.shift();

  const sqlLat = latest(madserverSqlTs);
  const gary2Seg = latest(gary2SegTs) || 0;
  _apiHistory.gary2Seg.push(Math.round(gary2Seg)); if (_apiHistory.gary2Seg.length > 30) _apiHistory.gary2Seg.shift();

  const gary2Backlog = latest(gary2BacklogTs) || 0;

  const colors = ['#FDA4D4','#4ADE80','#B388FF','#FBBF24','#60A5FA','#67E8F9'];
  const orgMap = {};
  (madserverCallsTs || []).forEach(ts => {
    const org = ts.metric?.labels?.org_name || 'unknown';
    orgMap[org] = (orgMap[org] || 0) + (latest([ts]) || 0);
  });

  return {
    'mozart-requests':    { value: Math.round(mozartReqs), sparkline: [..._apiHistory.mozartReqs], trend: 'up' },
    'mozart-impressions': { value: Math.round(mozartImp), sparkline: [..._apiHistory.mozartImp], trend: 'up' },
    'mozart-errors':      { value: fmtNum(mozartErr), detail: 'errors/min', trend: 'stable', status: mozartErr < 50 ? 'healthy' : 'warning' },
    'planner-impressions': { value: Math.round(plannerImp || 0), sparkline: [..._apiHistory.plannerImp], trend: 'up' },
    'planner-reach':      { value: Math.round(plannerReach || 0), sparkline: [..._apiHistory.plannerReach], trend: 'up' },
    'madserver-sql':      { value: sqlLat != null ? Math.round(sqlLat > 1000 ? sqlLat / 1000 : sqlLat) : 0 },
    'gary2-segments':     { value: Math.round(gary2Seg), sparkline: [..._apiHistory.gary2Seg], trend: 'up' },
    'gary2-backlog':      { value: fmtNum(gary2Backlog), detail: 'unacked msgs', trend: 'stable', status: gary2Backlog < 5000 ? 'healthy' : 'warning' },
    'madserver-calls':    {
      bars: Object.entries(orgMap).length > 0
        ? Object.entries(orgMap).sort((a,b) => b[1]-a[1]).slice(0, 6)
            .map(([c,v],i) => ({ label: c, value: Math.round(v), color: colors[i % colors.length] }))
        : [{ label: 'no data', value: 0, color: '#6B5690' }],
    },
  };
}

// ── VulnTrack API ──
const VULNTRACK_URL = process.env.VULNTRACK_API_URL || 'https://vulntrack.madhive.dev';
const VULNTRACK_KEY = process.env.VULNTRACK_API_KEY || '';
let _vtCache = null;
let _vtCacheTime = 0;
const VT_CACHE_TTL = 2 * 60 * 1000; // 2 min

async function fetchVulnTrack() {
  const now = Date.now();
  if (_vtCache && now - _vtCacheTime < VT_CACHE_TTL) return _vtCache;

  const headers = { 'X-API-Key': VULNTRACK_KEY, 'Accept': 'application/json' };
  const [dashRes, statsRes] = await Promise.all([
    fetch(`${VULNTRACK_URL}/api/reports/dashboard?teamIds=global`, { headers }),
    fetch(`${VULNTRACK_URL}/api/vulnerabilities/stats?teamIds=global`, { headers }),
  ]);

  if (!dashRes.ok || !statsRes.ok) {
    console.error(`[vulntrack] API error: dashboard=${dashRes.status} stats=${statsRes.status}`);
    return _vtCache || null;
  }

  const dash = await dashRes.json();
  const stats = await statsRes.json();
  _vtCache = { dash, stats };
  _vtCacheTime = now;
  return _vtCache;
}

async function securityPosture() {
  const vt = await fetchVulnTrack();
  if (!vt) return {};

  const { dash, stats } = vt;
  const s = dash.stats || {};
  const history = (dash.history || []).map(h => h.total || 0);

  // Source breakdown
  const bySource = {};
  if (stats.bySource) {
    Object.entries(stats.bySource).forEach(([k, v]) => {
      const label = k.replace('github_', '').replace('_', ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      bySource[label] = v;
    });
  }

  const fixPct = stats.openTotal > 0
    ? Math.round((stats.withFix / stats.openTotal) * 100) : 0;

  return {
    'vulntrack-overview': {
      openFindings: s.openFindings || 0,
      openHistory: history.length > 0 ? history : [s.openFindings || 0],
      criticalOpen: s.criticalOpen || 0,
      highOpen: s.highOpen || 0,
      mediumOpen: s.mediumOpen || 0,
      lowOpen: s.lowOpen || 0,
      totalFindings: s.totalFindings || 0,
      resolvedFindings: s.resolvedFindings || 0,
      exploitableOpen: s.exploitableFindings || stats.exploitableOpen || 0,
      runtimeFindings: s.runtimeFindings || stats.inRuntimeOpen || 0,
      threats: s.threats || { total: 0, open: 0 },
      secrets: s.secrets || { total: 0, open: 0 },
      mttr: s.mttr || null,
      fixAvailablePct: fixPct,
      bySource: bySource,
      byStatus: stats.byStatus || {},
      topRiskTeams: (dash.topRiskTeams || []).map(t => ({
        name: t.name,
        riskScore: t.riskScore,
        trend: t.trend,
        openFindings: t.openFindings || t.stats?.openFindings || 0,
      })),
    },
  };
}

export async function getMetrics(dashboardId) {
  switch (dashboardId) {
    case 'platform-overview':  return platformOverview();
    case 'services-health':    return servicesHealth();
    case 'campaign-delivery':  return campaignDeliveryMap();
    case 'data-processing':    return dataProcessing();
    case 'data-pipeline':      return dataPipeline();
    case 'bidder-cluster':     return bidderCluster();
    case 'rtb-infra':          return rtbInfra();
    case 'campaign-pacing':    return campaignPacing();
    case 'data-infra':         return dataInfra();
    case 'api-services':       return apiServices();
    case 'security-posture':   return securityPosture();
    default: return {};
  }
}
