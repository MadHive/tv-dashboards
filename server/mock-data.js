// ---------------------------------------------------------------------------
// Mock data generators — positive platform metrics for MadHive dashboard
// ---------------------------------------------------------------------------

function jitter(v, r) { return v + (Math.random() - 0.5) * 2 * r; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function hist(base, len, variance) {
  return Array.from({ length: len }, () =>
    Math.round(base + (Math.random() - 0.5) * 2 * variance));
}

// ── All Cloud Run services in mad-master ──
const SERVICE_NAMES = [
  'adbook','advancedquerytool','ai-audience','annovid','audience-link',
  'authorization','beaker','bigquery-job-broadcaster','billing',
  'bundle-crawler','burns','campaignmanager','cs-tools','datranslator',
  'dg-exporter','display-tag-validator','doubleverify-iqc','dynamic-pricer',
  'edge','encoder','extractor','financial-systems','haproxy-backend-manager',
  'hermes','hive-partitioner','human-ingest','inscape','invoices',
  'jelly-v2','logerrorssecondgen','madserver','mav-plat','maverick',
  'maverick-chat-ui','mozart','mozart-metrics-exporter','olyeller',
  'operative','performanceapp','pg-handler','planner','reporter',
  'resource-downloader','segment-pii-ingest','seller','ssoendpoint2gen',
  'storage-sync','tmt','xandr-creative',
];

// Key services that always have high traffic
const HIGH_TRAFFIC_SERVICES = [
  'madserver','mozart','authorization','edge','billing',
  'campaignmanager','hermes','adbook',
];

function initService(name) {
  const isHighTraffic = HIGH_TRAFFIC_SERVICES.includes(name);
  const rr = isHighTraffic ? 2000 + Math.random() * 6000 : 50 + Math.random() * 8000;
  return {
    status: 'healthy',
    rr,
    lat: 5 + Math.random() * 120,
    deploy: pick(['1h ago','2h ago','4h ago','8h ago','1d ago','2d ago','5d ago']),
  };
}

// ── Population-weighted state activity (CTV market proxy) ──
const STATE_WEIGHTS = {
  CA: 39.5, TX: 29.5, FL: 22, NY: 20, PA: 13, IL: 12.7, OH: 11.8,
  GA: 10.8, NC: 10.5, MI: 10, NJ: 9.3, VA: 8.6, WA: 7.7, AZ: 7.3,
  MA: 7, TN: 7, IN: 6.8, MO: 6.2, MD: 6.2, WI: 5.9, CO: 5.8,
  MN: 5.7, SC: 5.2, AL: 5, LA: 4.7, KY: 4.5, OR: 4.2, OK: 4,
  CT: 3.6, UT: 3.3, IA: 3.2, NV: 3.1, AR: 3, MS: 3, KS: 2.9,
  NM: 2.1, NE: 2, ID: 1.9, WV: 1.8, ME: 1.4, NH: 1.4, MT: 1.1,
  RI: 1.1, DE: 1, SD: 0.9, ND: 0.8, VT: 0.6, WY: 0.6, DC: 0.7,
};

// ── persistent state ──
const S = {
  // Platform Overview
  bidsServed: 4700000, bidsServedH: hist(4700000, 30, 350000),
  impressions: 2840000,
  eventsProcessed: 32000, eventsH: hist(32000, 30, 5000),
  platformUptime: 99.97,

  // Cloud Run services
  services: {},

  // Data Processing (mad-data)
  bqQueries: 1420, bqQueriesH: hist(1420, 30, 300),
  bqSlots: 820,
  storedBytes: 12.4,  // TB — replaces scanned_bytes
  pubsubBacklog: 1850, pubsubH: hist(1850, 30, 600),

  // Pipeline — 6 stages with sparkline history and sub-metrics
  pipeline: {
    ingest:    { status: 'healthy', throughput: 48200, latency: 10, errorRate: 0.02, dataVolume: 2.1, sparkline: hist(48200, 20, 2000) },
    transform: { status: 'healthy', throughput: 47800, latency: 24, errorRate: 0.01, dataVolume: 1.8, sparkline: hist(47800, 20, 1800) },
    store:     { status: 'healthy', throughput: 47500, latency: 8,  errorRate: 0.005, dataVolume: 4.2, sparkline: hist(47500, 20, 1500) },
    process:   { status: 'healthy', throughput: 47100, latency: 52, errorRate: 0.03, dataVolume: 1.5, sparkline: hist(47100, 20, 2200) },
    deliver:   { status: 'healthy', throughput: 46800, latency: 7,  errorRate: 0.01, dataVolume: 1.2, sparkline: hist(46800, 20, 1600) },
    report:    { status: 'healthy', throughput: 46500, latency: 130, errorRate: 0.02, dataVolume: 0.8, sparkline: hist(46500, 20, 1400) },
  },

  // Per-state delivery activity
  stateActivity: {},

  // Bidder Cluster
  bidQps: 3500000, bidQpsH: hist(3500000, 30, 200000),
  winRate: 18.2,
  errorRateBidder: 0.12,
  timeoutRate: 0.85,
  latencyP50: 8,
  latencyP95: 42,
  latencyP99: 118,
  bidRatio: 72,
  budgetPacing: 67,
  regionQps: {
    'us-east1': 980000, 'us-central1': 870000, 'us-west1': 620000,
    'europe-west1': 510000, 'asia-east1': 340000, 'asia-southeast1': 180000,
  },
  backendQps: {
    'bidder-prod': 2100000, 'vast--prod': 850000, 'bidder-staging': 320000,
    'bidder-canary': 180000, 'vast--canary': 50000,
  },

  // RTB Infrastructure
  bidderNodes: 312, bidderNodesH: hist(312, 30, 8),
  rogerNodes: 48, rogerNodesH: hist(48, 30, 2),
  memcacheNodes: 96, memcacheNodesH: hist(96, 30, 3),
  coreClusterSize: 420,
  bidderCpu: 62, bidderMem: 71,
  containerRestarts: 0,
  grpcP50: 4, grpcP95: 18, grpcP99: 65,
  pipeBytes: 1240000, pipeBytesH: hist(1240000, 30, 80000),
  bidderZones: { 'us-east4-a': 105, 'us-east4-b': 104, 'us-east4-c': 103 },

  // Campaign & Pacing (Roger)
  activeCampaigns: 3420, activeCampaignsH: hist(3420, 30, 150),
  globalWinRate: 14.2,
  campaignMetas: 8540,
  pacingP50: 0.98,
  bidPriceP50: 12.4,
  ebrakeP50: 0.92,
  rogerSendLatency: 28,
  rogerMessages: 185000, rogerMessagesH: hist(185000, 30, 12000),
  impressionRater: 42000, impressionRaterH: hist(42000, 30, 3000),

  // Data Infrastructure (Kafka + Bigtable)
  kafkaRequests: 890000, kafkaRequestsH: hist(890000, 30, 45000),
  kafkaLag: 12400,
  kafkaLatencyP95: 45,
  kafkaWriteErrors: 0.001,
  bigtableReads: 320000, bigtableReadsH: hist(320000, 30, 20000),
  bigtableRequests: 580000, bigtableRequestsH: hist(580000, 30, 30000),
  bigtableLatencyP95: 12,
  bigtableCpu: 34,
  pubsubEventsUnacked: 2400,
  pubsubWinsUnacked: 180,
  bigtableTables: {
    'impressions': 4200, 'segments': 3100, 'events': 2800,
    'device-graph': 1900, 'audiences': 1400, 'ledger': 980,
  },

  // VulnTrack Security
  vuln: {
    openFindings: 682,
    openHistory: (() => {
      // Declining trend over 30 days
      const h = [];
      let v = 780;
      for (let i = 0; i < 30; i++) { v = Math.max(600, v - 2 - Math.random() * 5); h.push(Math.round(v)); }
      return h;
    })(),
    criticalOpen: 12,
    highOpen: 89,
    mediumOpen: 342,
    lowOpen: 239,
    totalFindings: 2418,
    resolvedFindings: 1736,
    exploitableOpen: 47,
    runtimeFindings: 156,
    threats: { total: 156, open: 23 },
    secrets: { total: 89, open: 8 },
    mttr: 14.2,
    bySource: { 'CodeQL': 420, 'Dependabot': 380, 'Upwind': 290, 'Jira': 45, 'Manual': 15 },
    byStatus: { open: 498, acknowledged: 62, in_progress: 122, resolved: 1620, false_positive: 84, wont_fix: 32 },
    withFix: 491,
    topRiskTeams: [
      { name: 'RTB', riskScore: 72, trend: 'improving', openFindings: 142 },
      { name: 'Data Pipeline', riskScore: 58, trend: 'stable', openFindings: 98 },
      { name: 'Platform', riskScore: 45, trend: 'improving', openFindings: 76 },
      { name: 'Delivery', riskScore: 38, trend: 'declining', openFindings: 64 },
      { name: 'Auth', riskScore: 22, trend: 'improving', openFindings: 28 },
      { name: 'Billing', riskScore: 18, trend: 'stable', openFindings: 22 },
    ],
  },

  // API & Services (Mozart + Planner + Gary2)
  mozartRequests: 28000, mozartRequestsH: hist(28000, 30, 2000),
  mozartImpressions: 156000, mozartImpressionsH: hist(156000, 30, 12000),
  mozartErrors: 12,
  plannerImpressions: 84000, plannerImpressionsH: hist(84000, 30, 6000),
  plannerReach: 42000, plannerReachH: hist(42000, 30, 4000),
  madserverSqlP95: 85,
  gary2Segments: 24000, gary2SegmentsH: hist(24000, 30, 2000),
  gary2Backlog: 340,
  madserverCalls: {
    'madserver': 18000, 'mozart': 8500, 'planner': 4200,
    'gary2': 2800, 'billing': 1600, 'adbook': 1200,
  },
};

// init all services
SERVICE_NAMES.forEach(n => { S.services[n] = initService(n); });

// init state activity
Object.keys(STATE_WEIGHTS).forEach(st => {
  const w = STATE_WEIGHTS[st];
  S.stateActivity[st] = {
    impressions: Math.round(w * 50000 + Math.random() * w * 20000),
    bids: Math.round(w * 8000 + Math.random() * w * 3000),
    campaigns: Math.round(w * 2.5 + Math.random() * w),
  };
});

// ── evolve state each tick ──
function tick() {
  S.bidsServed = clamp(S.bidsServed + (Math.random() - 0.48) * 70000, 3400000, 6500000);
  S.bidsServedH.push(Math.round(S.bidsServed)); if (S.bidsServedH.length > 30) S.bidsServedH.shift();
  S.impressions = clamp(Math.round(jitter(S.impressions, 150000)), 1500000, 5000000);
  S.eventsProcessed = clamp(S.eventsProcessed + (Math.random() - 0.48) * 1500, 15000, 55000);
  S.eventsH.push(Math.round(S.eventsProcessed)); if (S.eventsH.length > 30) S.eventsH.shift();
  S.platformUptime = clamp(S.platformUptime + (Math.random() - 0.5) * 0.001, 99.90, 99.99);

  // services
  Object.values(S.services).forEach(s => {
    s.rr  = clamp(jitter(s.rr, s.rr * 0.03), 5, 99999);
    s.lat = clamp(jitter(s.lat, s.lat * 0.03), 1, 500);
  });

  // data processing
  S.bqQueries = clamp(S.bqQueries + (Math.random() - 0.48) * 60, 800, 3000);
  S.bqQueriesH.push(Math.round(S.bqQueries)); if (S.bqQueriesH.length > 30) S.bqQueriesH.shift();
  S.bqSlots = clamp(jitter(S.bqSlots, 80), 200, 1900);
  S.storedBytes = clamp(S.storedBytes + (Math.random() - 0.45) * 0.08, 5, 25);
  S.pubsubBacklog = clamp(S.pubsubBacklog + (Math.random() - 0.5) * 350, 0, 25000);
  S.pubsubH.push(Math.round(S.pubsubBacklog)); if (S.pubsubH.length > 30) S.pubsubH.shift();

  // pipeline — 6 stages
  Object.values(S.pipeline).forEach(p => {
    p.throughput = clamp(jitter(p.throughput, 500), 30000, 60000);
    p.latency = clamp(jitter(p.latency, p.latency * 0.06), 1, 300);
    p.errorRate = clamp(jitter(p.errorRate, 0.005), 0, 0.1);
    p.dataVolume = clamp(jitter(p.dataVolume, 0.1), 0.1, 8);
    p.sparkline.push(Math.round(p.throughput));
    if (p.sparkline.length > 20) p.sparkline.shift();
    p.status = 'healthy';
  });

  // bidder cluster
  S.bidQps = clamp(S.bidQps + (Math.random() - 0.47) * 80000, 2800000, 4200000);
  S.bidQpsH.push(Math.round(S.bidQps)); if (S.bidQpsH.length > 30) S.bidQpsH.shift();
  S.winRate = clamp(jitter(S.winRate, 0.6), 12, 25);
  S.errorRateBidder = clamp(jitter(S.errorRateBidder, 0.02), 0.02, 0.5);
  S.timeoutRate = clamp(jitter(S.timeoutRate, 0.08), 0.1, 3.5);
  S.latencyP50 = clamp(jitter(S.latencyP50, 1.2), 3, 20);
  S.latencyP95 = clamp(jitter(S.latencyP95, 3), 25, 75);
  S.latencyP99 = clamp(jitter(S.latencyP99, 8), 70, 200);
  S.bidRatio = clamp(jitter(S.bidRatio, 1.5), 55, 85);
  S.budgetPacing = clamp(S.budgetPacing + (Math.random() - 0.3) * 1.5, 10, 98);
  Object.keys(S.regionQps).forEach(r => {
    S.regionQps[r] = clamp(jitter(S.regionQps[r], S.regionQps[r] * 0.03), S.regionQps[r] * 0.7, S.regionQps[r] * 1.3);
  });
  Object.keys(S.backendQps).forEach(b => {
    S.backendQps[b] = clamp(jitter(S.backendQps[b], S.backendQps[b] * 0.03), S.backendQps[b] * 0.7, S.backendQps[b] * 1.3);
  });

  // state activity
  Object.keys(S.stateActivity).forEach(st => {
    const w = STATE_WEIGHTS[st];
    const a = S.stateActivity[st];
    a.impressions = clamp(Math.round(jitter(a.impressions, w * 5000)), Math.round(w * 20000), Math.round(w * 100000));
    a.bids = clamp(Math.round(jitter(a.bids, w * 800)), Math.round(w * 3000), Math.round(w * 15000));
    a.campaigns = clamp(Math.round(jitter(a.campaigns, w * 0.3)), Math.round(w * 1), Math.round(w * 5));
  });

  // RTB Infrastructure
  S.bidderNodes = clamp(jitter(S.bidderNodes, 3), 280, 350);
  S.bidderNodesH.push(Math.round(S.bidderNodes)); if (S.bidderNodesH.length > 30) S.bidderNodesH.shift();
  S.rogerNodes = clamp(jitter(S.rogerNodes, 1), 40, 60);
  S.rogerNodesH.push(Math.round(S.rogerNodes)); if (S.rogerNodesH.length > 30) S.rogerNodesH.shift();
  S.memcacheNodes = clamp(jitter(S.memcacheNodes, 1), 85, 110);
  S.memcacheNodesH.push(Math.round(S.memcacheNodes)); if (S.memcacheNodesH.length > 30) S.memcacheNodesH.shift();
  S.bidderCpu = clamp(jitter(S.bidderCpu, 3), 30, 90);
  S.bidderMem = clamp(jitter(S.bidderMem, 2), 40, 90);
  S.grpcP50 = clamp(jitter(S.grpcP50, 0.8), 1, 15);
  S.grpcP95 = clamp(jitter(S.grpcP95, 2), 8, 40);
  S.grpcP99 = clamp(jitter(S.grpcP99, 5), 30, 120);
  S.pipeBytes = clamp(jitter(S.pipeBytes, 50000), 800000, 2000000);
  S.pipeBytesH.push(Math.round(S.pipeBytes)); if (S.pipeBytesH.length > 30) S.pipeBytesH.shift();
  Object.keys(S.bidderZones).forEach(z => { S.bidderZones[z] = clamp(jitter(S.bidderZones[z], 2), 90, 120); });

  // Campaign & Pacing
  S.activeCampaigns = clamp(jitter(S.activeCampaigns, 50), 2800, 4200);
  S.activeCampaignsH.push(Math.round(S.activeCampaigns)); if (S.activeCampaignsH.length > 30) S.activeCampaignsH.shift();
  S.globalWinRate = clamp(jitter(S.globalWinRate, 0.5), 8, 22);
  S.campaignMetas = clamp(jitter(S.campaignMetas, 100), 7000, 10000);
  S.pacingP50 = clamp(jitter(S.pacingP50, 0.03), 0.7, 1.3);
  S.bidPriceP50 = clamp(jitter(S.bidPriceP50, 0.8), 5, 25);
  S.ebrakeP50 = clamp(jitter(S.ebrakeP50, 0.02), 0.7, 1.0);
  S.rogerSendLatency = clamp(jitter(S.rogerSendLatency, 3), 10, 80);
  S.rogerMessages = clamp(jitter(S.rogerMessages, 8000), 120000, 250000);
  S.rogerMessagesH.push(Math.round(S.rogerMessages)); if (S.rogerMessagesH.length > 30) S.rogerMessagesH.shift();
  S.impressionRater = clamp(jitter(S.impressionRater, 2000), 30000, 60000);
  S.impressionRaterH.push(Math.round(S.impressionRater)); if (S.impressionRaterH.length > 30) S.impressionRaterH.shift();

  // Data Infrastructure
  S.kafkaRequests = clamp(jitter(S.kafkaRequests, 30000), 700000, 1200000);
  S.kafkaRequestsH.push(Math.round(S.kafkaRequests)); if (S.kafkaRequestsH.length > 30) S.kafkaRequestsH.shift();
  S.kafkaLag = clamp(jitter(S.kafkaLag, 2000), 0, 50000);
  S.kafkaLatencyP95 = clamp(jitter(S.kafkaLatencyP95, 5), 10, 200);
  S.kafkaWriteErrors = clamp(jitter(S.kafkaWriteErrors, 0.0005), 0, 0.05);
  S.bigtableReads = clamp(jitter(S.bigtableReads, 15000), 200000, 500000);
  S.bigtableReadsH.push(Math.round(S.bigtableReads)); if (S.bigtableReadsH.length > 30) S.bigtableReadsH.shift();
  S.bigtableRequests = clamp(jitter(S.bigtableRequests, 20000), 400000, 800000);
  S.bigtableRequestsH.push(Math.round(S.bigtableRequests)); if (S.bigtableRequestsH.length > 30) S.bigtableRequestsH.shift();
  S.bigtableLatencyP95 = clamp(jitter(S.bigtableLatencyP95, 1.5), 3, 30);
  S.bigtableCpu = clamp(jitter(S.bigtableCpu, 3), 15, 70);
  S.pubsubEventsUnacked = clamp(jitter(S.pubsubEventsUnacked, 400), 0, 15000);
  S.pubsubWinsUnacked = clamp(jitter(S.pubsubWinsUnacked, 40), 0, 2000);
  Object.keys(S.bigtableTables).forEach(t => { S.bigtableTables[t] = clamp(jitter(S.bigtableTables[t], S.bigtableTables[t] * 0.02), S.bigtableTables[t] * 0.8, S.bigtableTables[t] * 1.2); });

  // VulnTrack Security
  S.vuln.openFindings = Math.round(clamp(jitter(S.vuln.openFindings, 3), 600, 780));
  S.vuln.openHistory.push(Math.round(S.vuln.openFindings)); if (S.vuln.openHistory.length > 30) S.vuln.openHistory.shift();
  S.vuln.criticalOpen = clamp(Math.round(jitter(S.vuln.criticalOpen, 1)), 5, 20);
  S.vuln.highOpen = clamp(Math.round(jitter(S.vuln.highOpen, 3)), 70, 110);
  S.vuln.mediumOpen = clamp(Math.round(jitter(S.vuln.mediumOpen, 5)), 300, 400);
  S.vuln.lowOpen = clamp(Math.round(jitter(S.vuln.lowOpen, 4)), 200, 280);
  S.vuln.exploitableOpen = clamp(Math.round(jitter(S.vuln.exploitableOpen, 2)), 30, 65);
  S.vuln.threats.open = clamp(Math.round(jitter(S.vuln.threats.open, 1)), 10, 40);
  S.vuln.secrets.open = clamp(Math.round(jitter(S.vuln.secrets.open, 1)), 2, 15);
  S.vuln.mttr = clamp(jitter(S.vuln.mttr, 0.5), 8, 22);
  S.vuln.resolvedFindings = clamp(Math.round(jitter(S.vuln.resolvedFindings, 5)), 1600, 1900);

  // API & Services
  S.mozartRequests = clamp(jitter(S.mozartRequests, 1500), 18000, 40000);
  S.mozartRequestsH.push(Math.round(S.mozartRequests)); if (S.mozartRequestsH.length > 30) S.mozartRequestsH.shift();
  S.mozartImpressions = clamp(jitter(S.mozartImpressions, 8000), 100000, 220000);
  S.mozartImpressionsH.push(Math.round(S.mozartImpressions)); if (S.mozartImpressionsH.length > 30) S.mozartImpressionsH.shift();
  S.mozartErrors = clamp(Math.round(jitter(S.mozartErrors, 3)), 0, 50);
  S.plannerImpressions = clamp(jitter(S.plannerImpressions, 4000), 50000, 120000);
  S.plannerImpressionsH.push(Math.round(S.plannerImpressions)); if (S.plannerImpressionsH.length > 30) S.plannerImpressionsH.shift();
  S.plannerReach = clamp(jitter(S.plannerReach, 2000), 25000, 60000);
  S.plannerReachH.push(Math.round(S.plannerReach)); if (S.plannerReachH.length > 30) S.plannerReachH.shift();
  S.madserverSqlP95 = clamp(jitter(S.madserverSqlP95, 8), 20, 200);
  S.gary2Segments = clamp(jitter(S.gary2Segments, 1500), 15000, 35000);
  S.gary2SegmentsH.push(Math.round(S.gary2Segments)); if (S.gary2SegmentsH.length > 30) S.gary2SegmentsH.shift();
  S.gary2Backlog = clamp(jitter(S.gary2Backlog, 60), 0, 2000);
  Object.keys(S.madserverCalls).forEach(c => { S.madserverCalls[c] = clamp(jitter(S.madserverCalls[c], S.madserverCalls[c] * 0.04), S.madserverCalls[c] * 0.7, S.madserverCalls[c] * 1.3); });
}

function fmtBytes(b) {
  if (b >= 1) return b.toFixed(1) + ' TB';
  if (b >= 0.001) return (b * 1000).toFixed(1) + ' GB';
  return Math.round(b * 1e6) + ' MB';
}

// ── dashboard data accessors ──
export function getMetrics(id) {
  tick();
  switch (id) {
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

function platformOverview() {
  const prev = S.bidsServedH[S.bidsServedH.length - 2] || S.bidsServed;
  const svcs = Object.values(S.services);
  const onlineCount = svcs.length;
  const withTraffic = svcs.filter(s => s.rr > 100).length;

  return {
    'bids-served': { value: Math.round(S.bidsServed), previous: Math.round(prev), trend: S.bidsServed >= prev ? 'up' : 'stable', sparkline: [...S.bidsServedH] },
    'impressions-delivered': { value: Math.round(S.impressions), detail: 'today', trend: 'up' },
    'bid-qps': { value: Math.round(S.bidsServed / 60), detail: fmtNum(Math.round(S.bidsServed / 60)) + '/s', trend: 'up' },
    'platform-uptime': { value: +S.platformUptime.toFixed(2) },
    'events-processed': { value: Math.round(S.eventsProcessed), sparkline: [...S.eventsH], trend: 'up' },
    'kafka-throughput': { value: fmtNum(Math.round(S.eventsProcessed)), sparkline: [...S.eventsH], detail: 'writes/10min', trend: 'up' },
    'storage-volume': { value: fmtBytes(S.storedBytes), detail: 'BQ + GCS total', trend: 'up' },
  };
}

function servicesHealth() {
  const svcs = SERVICE_NAMES.map(name => {
    const s = S.services[name];
    return { name, status: s.status, requestRate: Math.round(s.rr), latency: Math.round(s.lat) };
  });

  const onlineCount = svcs.length;
  const totalQps = svcs.reduce((sum, s) => sum + s.requestRate, 0);
  const withLat = svcs.filter(s => s.latency > 0).sort((a, b) => a.latency - b.latency);
  const medianLat = withLat.length > 0 ? withLat[Math.floor(withLat.length / 2)].latency : 0;

  const topSvcs = [...svcs].sort((a, b) => b.requestRate - a.requestRate).slice(0, 6);
  const fastSvcs = [...svcs].filter(s => s.requestRate > 100).sort((a, b) => a.latency - b.latency).slice(0, 6);
  const colors = ['#FDA4D4','#4ADE80','#B388FF','#FBBF24','#60A5FA','#67E8F9'];

  return {
    'fleet-health':     { value: 100, detail: onlineCount + '/' + onlineCount + ' active', trend: 'stable' },
    'requests-served':  { value: Math.round(totalQps), sparkline: hist(totalQps, 30, totalQps * 0.05), trend: 'up' },
    'response-time':    { value: medianLat },
    'top-services':     {
      bars: topSvcs.map((s, i) => ({ label: s.name, value: s.requestRate, color: colors[i % colors.length] })),
    },
    'fastest-services': {
      bars: fastSvcs.map((s, i) => ({ label: s.name, value: s.latency, color: colors[i % colors.length] })),
    },
  };
}

function campaignDeliveryMap() {
  const totalImpressions = Object.values(S.stateActivity).reduce((s, a) => s + a.impressions, 0);
  const totalBids = Object.values(S.stateActivity).reduce((s, a) => s + a.bids, 0);

  // Active services count as campaign proxy
  const svcs = Object.values(S.services);
  const withTraffic = svcs.filter(s => s.rr > 100).length;

  // regional summaries
  const regionDefs = {
    west:    ['WA','OR','CA','NV','ID','MT','WY','UT','CO','AZ','NM'],
    central: ['ND','SD','NE','KS','OK','TX','MN','IA','MO','AR','LA','WI','IL','MI','IN','OH','MS','AL','TN','KY'],
    east:    ['ME','VT','NH','MA','CT','RI','NY','NJ','PA','DE','MD','DC','VA','WV','NC','SC','GA','FL'],
  };

  const regions = {};
  Object.entries(regionDefs).forEach(([key, sts]) => {
    const regImpressions = sts.reduce((s, st) => s + (S.stateActivity[st]?.impressions || 0), 0);
    const regBids = sts.reduce((s, st) => s + (S.stateActivity[st]?.bids || 0), 0);
    const regCampaigns = sts.reduce((s, st) => s + (S.stateActivity[st]?.campaigns || 0), 0);
    regions[key] = {
      impressions: regImpressions,
      bids: regBids,
      campaigns: regCampaigns,
    };
  });

  // Mock zip3 hotspots for demo mode
  var mockHotspots = [
    { zip3: '100', lat: 40.71, lon: -74.01, impressions: 850000, clicks: 12400, state: 'NY' },
    { zip3: '900', lat: 34.05, lon: -118.24, impressions: 720000, clicks: 10800, state: 'CA' },
    { zip3: '606', lat: 41.88, lon: -87.63, impressions: 540000, clicks: 8100, state: 'IL' },
    { zip3: '770', lat: 29.76, lon: -95.37, impressions: 480000, clicks: 7200, state: 'TX' },
    { zip3: '331', lat: 25.76, lon: -80.19, impressions: 420000, clicks: 6300, state: 'FL' },
    { zip3: '191', lat: 39.95, lon: -75.17, impressions: 380000, clicks: 5700, state: 'PA' },
    { zip3: '850', lat: 33.45, lon: -112.07, impressions: 320000, clicks: 4800, state: 'AZ' },
    { zip3: '303', lat: 33.75, lon: -84.39, impressions: 300000, clicks: 4500, state: 'GA' },
    { zip3: '021', lat: 42.36, lon: -71.06, impressions: 280000, clicks: 4200, state: 'MA' },
    { zip3: '981', lat: 47.61, lon: -122.33, impressions: 260000, clicks: 3900, state: 'WA' },
    { zip3: '802', lat: 39.74, lon: -104.99, impressions: 240000, clicks: 3600, state: 'CO' },
    { zip3: '752', lat: 32.78, lon: -96.80, impressions: 220000, clicks: 3300, state: 'TX' },
  ];

  return {
    'usa-delivery-map': {
      states: { ...S.stateActivity },
      totals: { impressions: totalImpressions, bids: totalBids, campaigns: withTraffic },
      regions: regions,
      hotspots: mockHotspots,
    },
  };
}

function dataProcessing() {
  return {
    'analytics-queries': { value: Math.round(S.bqQueries), sparkline: [...S.bqQueriesH], trend: 'up' },
    'compute-utilization': { value: Math.round(S.bqSlots) },
    'storage-volume': { value: fmtBytes(S.storedBytes), trend: 'up', detail: 'BQ + GCS total' },
    'messages-queued': { value: Math.round(S.pubsubBacklog), sparkline: [...S.pubsubH], trend: 'stable' },
    'ingestion-topics': {
      bars: [
        { label: 'bid-events',    value: Math.round(jitter(18500, 1200)), color: '#FDA4D4' },
        { label: 'impressions',   value: Math.round(jitter(12400, 900)),  color: '#4ADE80' },
        { label: 'conversions',   value: Math.round(jitter(3200, 400)),   color: '#B388FF' },
        { label: 'audience-sync', value: Math.round(jitter(6800, 600)),   color: '#FBBF24' },
        { label: 'creative-meta', value: Math.round(jitter(2100, 300)),   color: '#60A5FA' },
      ],
    },
  };
}

function bidderCluster() {
  const colors = ['#FDA4D4','#4ADE80','#B388FF','#FBBF24','#60A5FA','#67E8F9'];
  const noBidPct = Math.round(100 - S.bidRatio);

  return {
    'bid-qps': {
      value: Math.round(S.bidQps),
      sparkline: [...S.bidQpsH],
      trend: S.bidQps >= 3400000 ? 'up' : 'stable',
    },
    'win-rate': {
      value: S.winRate.toFixed(1) + '%',
      detail: 'of bids won',
      trend: S.winRate > 17 ? 'up' : 'stable',
    },
    'error-rate': {
      value: S.errorRateBidder.toFixed(2) + '%',
      detail: '4xx + 5xx combined',
      trend: S.errorRateBidder < 0.2 ? 'stable' : 'down',
      status: S.errorRateBidder < 0.3 ? 'healthy' : 'warning',
    },
    'timeout-rate': { value: +S.timeoutRate.toFixed(2) },
    'response-latency': {
      gauges: [
        { label: 'p50', value: Math.round(S.latencyP50) },
        { label: 'p95', value: Math.round(S.latencyP95) },
        { label: 'p99', value: Math.round(S.latencyP99) },
      ],
    },
    'bid-nobid-ratio': {
      value: Math.round(S.bidRatio) + ' / ' + noBidPct,
      detail: 'bid / no-bid %',
      trend: 'stable',
    },
    'budget-pacing': {
      value: Math.round(S.budgetPacing) + '%',
      detail: 'daily spend progress',
      trend: 'up',
    },
    'qps-by-region': {
      bars: Object.entries(S.regionQps)
        .sort((a, b) => b[1] - a[1])
        .map(([region, qps], i) => ({ label: region, value: Math.round(qps), color: colors[i % colors.length] })),
    },
    'response-by-backend': {
      bars: Object.entries(S.backendQps)
        .sort((a, b) => b[1] - a[1])
        .map(([backend, qps], i) => ({ label: backend, value: Math.round(qps), color: colors[i % colors.length] })),
    },
  };
}

function dataPipeline() {
  const stageOrder = ['ingest', 'transform', 'store', 'process', 'deliver', 'report'];
  const stageNames = { ingest: 'Ingest', transform: 'Transform', store: 'Store', process: 'Process', deliver: 'Deliver', report: 'Report' };

  // Compute total latency and end-to-end throughput
  let totalLatency = 0;
  stageOrder.forEach(id => { totalLatency += S.pipeline[id].latency; });
  const endThroughput = S.pipeline[stageOrder[stageOrder.length - 1]].throughput;

  return {
    pipeline: {
      summary: {
        throughput: Math.round(endThroughput),
        totalLatency: Math.round(totalLatency),
      },
      stages: stageOrder.map(id => {
        const p = S.pipeline[id];
        return {
          id,
          name: stageNames[id],
          status: p.status,
          throughput: Math.round(p.throughput),
          latency: Math.round(p.latency),
          errorRate: +p.errorRate.toFixed(3),
          dataVolume: +p.dataVolume.toFixed(1),
          sparkline: [...p.sparkline],
          health: Math.max(0, Math.min(100, Math.round(100 - p.errorRate * 1000 - (p.latency > 100 ? 5 : 0)))),
        };
      }),
    },
  };
}

function rtbInfra() {
  const colors = ['#FDA4D4','#4ADE80','#B388FF','#FBBF24','#60A5FA','#67E8F9'];
  return {
    'bidder-nodes':      { value: Math.round(S.bidderNodes), sparkline: [...S.bidderNodesH], trend: 'stable' },
    'roger-nodes':       { value: Math.round(S.rogerNodes), sparkline: [...S.rogerNodesH], trend: 'stable' },
    'memcache-nodes':    { value: Math.round(S.memcacheNodes), sparkline: [...S.memcacheNodesH], trend: 'stable' },
    'core-cluster-size': { value: String(S.coreClusterSize), detail: 'GKE nodes', trend: 'stable' },
    'bidder-cpu':        { value: Math.round(S.bidderCpu) },
    'bidder-memory':     { value: Math.round(S.bidderMem) },
    'container-restarts': { value: String(S.containerRestarts), detail: 'last 24h', trend: 'stable', status: S.containerRestarts === 0 ? 'healthy' : 'warning' },
    'bidder-error-rate': { value: 12, detail: '503s/s', trend: 'stable', status: 'healthy' },
    'pipe-bytes-written': { value: Math.round(S.pipeBytes), sparkline: [...S.pipeBytesH], trend: 'up' },
    'bidder-nodes-by-zone': { bars: Object.entries(S.bidderZones).sort((a,b) => b[1]-a[1]).map(([z,v],i) => ({ label: z, value: Math.round(v), color: colors[i % colors.length] })) },
    'lb-backend-503s': { value: '0.02%', detail: 'load shedding', trend: 'stable', status: 'healthy' },
  };
}

function campaignPacing() {
  return {
    'active-campaigns':  { value: Math.round(S.activeCampaigns), sparkline: [...S.activeCampaignsH], trend: 'up' },
    'global-win-rate':   { value: Math.round(S.globalWinRate) },
    'campaign-metas':    { value: String(Math.round(S.campaignMetas)), detail: 'metadata entries', trend: 'stable' },
    'pacing-p50':        { value: +S.pacingP50.toFixed(2) },
    'active-campaigns-count': { value: String(Math.round(S.activeCampaigns)), detail: 'roger campaigns', trend: 'stable' },
    'ebrake-p50':        { value: S.ebrakeP50.toFixed(2), detail: 'brake factor', trend: 'stable', status: S.ebrakeP50 > 0.85 ? 'healthy' : 'warning' },
    'roger-send-latency': { value: Math.round(S.rogerSendLatency) },
    'roger-messages':    { value: Math.round(S.rogerMessages), sparkline: [...S.rogerMessagesH], trend: 'up' },
    'impression-rater':  { value: Math.round(S.impressionRater), sparkline: [...S.impressionRaterH], trend: 'up' },
  };
}

function dataInfra() {
  const colors = ['#FDA4D4','#4ADE80','#B388FF','#FBBF24','#60A5FA','#67E8F9'];
  return {
    'kafka-requests':     { value: Math.round(S.kafkaRequests), sparkline: [...S.kafkaRequestsH], trend: 'up' },
    'kafka-lag':          { value: String(Math.round(S.kafkaLag)), detail: 'consumer offset lag', trend: S.kafkaLag < 20000 ? 'stable' : 'down', status: S.kafkaLag < 30000 ? 'healthy' : (S.kafkaLag < 100000 ? 'warning' : 'critical') },
    'kafka-latency':      { value: Math.round(S.kafkaLatencyP95) },
    'kafka-write-errors': { value: (S.kafkaWriteErrors * 100).toFixed(3) + '%', detail: 'bidder writes', trend: 'stable', status: S.kafkaWriteErrors < 0.01 ? 'healthy' : 'warning' },
    'bigtable-reads':     { value: Math.round(S.bigtableReads), sparkline: [...S.bigtableReadsH], trend: 'up' },
    'bigtable-requests':  { value: Math.round(S.bigtableRequests), sparkline: [...S.bigtableRequestsH], trend: 'up' },
    'bigtable-latency':   { value: Math.round(S.bigtableLatencyP95) },
    'bigtable-cpu':       { value: Math.round(S.bigtableCpu) },
    'pubsub-events-unacked': { value: String(Math.round(S.pubsubEventsUnacked)), detail: 'events-primary', trend: S.pubsubEventsUnacked < 5000 ? 'stable' : 'down', status: S.pubsubEventsUnacked < 10000 ? 'healthy' : 'warning' },
    'pubsub-wins-unacked': { value: String(Math.round(S.pubsubWinsUnacked)), detail: 'wins topic', trend: 'stable', status: S.pubsubWinsUnacked < 1000 ? 'healthy' : 'warning' },
    'bigtable-tables':    { bars: Object.entries(S.bigtableTables).sort((a,b) => b[1]-a[1]).map(([t,v],i) => ({ label: t, value: Math.round(v), color: colors[i % colors.length] })) },
  };
}

function apiServices() {
  const colors = ['#FDA4D4','#4ADE80','#B388FF','#FBBF24','#60A5FA','#67E8F9'];
  return {
    'mozart-requests':    { value: Math.round(S.mozartRequests), sparkline: [...S.mozartRequestsH], trend: 'up' },
    'mozart-impressions': { value: Math.round(S.mozartImpressions), sparkline: [...S.mozartImpressionsH], trend: 'up' },
    'mozart-errors':      { value: String(S.mozartErrors), detail: 'errors/min', trend: 'stable', status: S.mozartErrors < 20 ? 'healthy' : 'warning' },
    'planner-impressions': { value: Math.round(S.plannerImpressions), sparkline: [...S.plannerImpressionsH], trend: 'up' },
    'planner-reach':      { value: Math.round(S.plannerReach), sparkline: [...S.plannerReachH], trend: 'up' },
    'madserver-sql':      { value: Math.round(S.madserverSqlP95) },
    'gary2-segments':     { value: Math.round(S.gary2Segments), sparkline: [...S.gary2SegmentsH], trend: 'up' },
    'gary2-backlog':      { value: String(Math.round(S.gary2Backlog)), detail: 'unacked msgs', trend: 'stable', status: S.gary2Backlog < 1000 ? 'healthy' : 'warning' },
    'madserver-calls':    { bars: Object.entries(S.madserverCalls).sort((a,b) => b[1]-a[1]).map(([c,v],i) => ({ label: c, value: Math.round(v), color: colors[i % colors.length] })) },
  };
}

function securityPosture() {
  const v = S.vuln;
  const fixPct = Math.round((v.withFix / v.openFindings) * 100);
  return {
    'vulntrack-overview': {
      openFindings: v.openFindings,
      openHistory: [...v.openHistory],
      criticalOpen: v.criticalOpen,
      highOpen: v.highOpen,
      mediumOpen: v.mediumOpen,
      lowOpen: v.lowOpen,
      totalFindings: v.totalFindings,
      resolvedFindings: v.resolvedFindings,
      exploitableOpen: v.exploitableOpen,
      runtimeFindings: v.runtimeFindings,
      threats: { ...v.threats },
      secrets: { ...v.secrets },
      mttr: v.mttr,
      fixAvailablePct: fixPct,
      bySource: { ...v.bySource },
      byStatus: { ...v.byStatus },
      topRiskTeams: v.topRiskTeams.map(t => ({ ...t })),
    },
  };
}

export default { getMetrics };
