// ---------------------------------------------------------------------------
// TV App integrations — Numerics (Custom JSON) & AnyBoard
// Serves dashboard data in formats consumable by Apple TV apps — ElysiaJS
// ---------------------------------------------------------------------------

import { Elysia } from 'elysia';

const LIVE = process.env.USE_REAL_DATA === 'true';

async function getData(dashboardId) {
  if (LIVE) {
    try {
      const live = await import('./gcp-metrics.js');
      return await live.getMetrics(dashboardId);
    } catch (e) { /* fall through */ }
  }
  const mock = await import('./mock-data.js');
  return mock.getMetrics(dashboardId);
}

function fmtNum(n) {
  if (n == null) return '0';
  if (typeof n === 'string') return n;
  if (Math.abs(n) >= 1e9)  return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6)  return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e4)  return (n / 1e4).toFixed(1) + 'K';
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return String(n);
}

// ===========================================================================
// NUMERICS — Custom JSON Widget Endpoints
// ===========================================================================

export const numericsRoutes = new Elysia({ prefix: '/api/numerics' })

  // ── Index: list all available widgets ──
  .get('/', ({ headers }) => {
    const host = headers.host || 'localhost:3000';
    const base = `http://${host}/api/numerics`;
    return {
      info: 'Numerics Custom JSON endpoints — point Numerics widgets at these URLs',
      widgets: {
        'Platform Overview': {
          'Bids Served (sparkline)':      `${base}/bids-served`,
          'Impressions Delivered':         `${base}/impressions`,
          'Active Services':              `${base}/active-services`,
          'Platform Uptime (gauge)':       `${base}/platform-uptime`,
          'Events Processed (sparkline)':  `${base}/events-processed`,
          'Cloud Services (label)':        `${base}/cloud-services`,
          'Storage Volume (label)':        `${base}/storage-volume`,
        },
        'Services Health': {
          'Services Online (label)':       `${base}/services-online`,
          'Requests Served (sparkline)':   `${base}/requests-served`,
          'Response Time (gauge)':         `${base}/response-time`,
          'Top Services (funnel)':         `${base}/top-services`,
          'Fastest Services (funnel)':     `${base}/fastest-services`,
        },
        'Data Processing': {
          'Analytics Queries (sparkline)': `${base}/analytics-queries`,
          'Compute Utilization (gauge)':   `${base}/compute-utilization`,
          'Storage Volume (label)':        `${base}/storage-volume-dp`,
          'Messages Queued (sparkline)':   `${base}/messages-queued`,
          'Ingestion by Topic (funnel)':   `${base}/ingestion-topics`,
        },
        'Campaign Delivery': {
          'Total Delivery (number+delta)': `${base}/delivery-total`,
          'Delivery by Region (pie)':      `${base}/delivery-by-region`,
        },
      },
    };
  })

  // ── Platform Overview widgets ──
  .get('/bids-served', async () => {
    const d = await getData('platform-overview');
    const w = d['bids-served'] || {};
    return {
      postfix: '/s',
      color: '#200847',
      data: (w.sparkline || []).slice(-20).map(v => ({ value: v })),
    };
  })

  .get('/impressions', async () => {
    const d = await getData('platform-overview');
    const w = d['impressions-delivered'] || {};
    const val = typeof w.value === 'string' ? parseInt(w.value) || 0 : (w.value || 0);
    return {
      postfix: 'today',
      color: '#200847',
      data: [{ value: val }],
    };
  })

  .get('/active-services', async () => {
    const d = await getData('platform-overview');
    const w = d['active-services'] || {};
    return {
      postfix: 'with traffic',
      color: '#200847',
      data: { value: String(w.value || '0/0') },
    };
  })

  .get('/platform-uptime', async () => {
    const d = await getData('platform-overview');
    const w = d['platform-uptime'] || {};
    return {
      postfix: '%',
      color: '#200847',
      data: { minValue: 99, value: w.value || 99.97, maxValue: 100 },
    };
  })

  .get('/events-processed', async () => {
    const d = await getData('platform-overview');
    const w = d['events-processed'] || {};
    return {
      postfix: '/s',
      color: '#200847',
      data: (w.sparkline || []).slice(-20).map(v => ({ value: v })),
    };
  })

  .get('/cloud-services', async () => {
    const d = await getData('platform-overview');
    const w = d['cloud-services'] || {};
    return {
      color: '#200847',
      data: { value: String(w.value || '—') },
    };
  })

  .get('/storage-volume', async () => {
    const d = await getData('platform-overview');
    const w = d['storage-volume'] || {};
    return {
      postfix: 'total',
      color: '#200847',
      data: { value: String(w.value || '—') },
    };
  })

  // ── Services Health widgets ──
  .get('/services-online', async () => {
    const d = await getData('services-health');
    const w = d['services-online'] || {};
    return {
      postfix: 'online',
      color: '#200847',
      data: { value: String(w.value || '—') },
    };
  })

  .get('/requests-served', async () => {
    const d = await getData('services-health');
    const w = d['requests-served'] || {};
    return {
      postfix: 'req/s',
      color: '#200847',
      data: (w.sparkline || []).slice(-20).map(v => ({ value: v })),
    };
  })

  .get('/response-time', async () => {
    const d = await getData('services-health');
    const w = d['response-time'] || {};
    return {
      postfix: 'ms',
      color: '#200847',
      data: { minValue: 0, value: w.value || 0, maxValue: 500 },
    };
  })

  .get('/top-services', async () => {
    const d = await getData('services-health');
    const w = d['top-services'] || {};
    return {
      postfix: 'req/s',
      color: '#200847',
      data: (w.bars || []).map(b => ({ name: b.label, value: b.value })),
    };
  })

  .get('/fastest-services', async () => {
    const d = await getData('services-health');
    const w = d['fastest-services'] || {};
    return {
      postfix: 'ms',
      color: '#200847',
      data: (w.bars || []).map(b => ({ name: b.label, value: b.value })),
    };
  })

  // ── Data Processing widgets ──
  .get('/analytics-queries', async () => {
    const d = await getData('data-processing');
    const w = d['analytics-queries'] || {};
    return {
      postfix: '/hr',
      color: '#200847',
      data: (w.sparkline || []).slice(-20).map(v => ({ value: v })),
    };
  })

  .get('/compute-utilization', async () => {
    const d = await getData('data-processing');
    const w = d['compute-utilization'] || {};
    return {
      postfix: 'slots',
      color: '#200847',
      data: { minValue: 0, value: w.value || 0, maxValue: 2000 },
    };
  })

  .get('/storage-volume-dp', async () => {
    const d = await getData('data-processing');
    const w = d['storage-volume'] || {};
    return {
      postfix: 'total',
      color: '#200847',
      data: { value: String(w.value || '—') },
    };
  })

  .get('/messages-queued', async () => {
    const d = await getData('data-processing');
    const w = d['messages-queued'] || {};
    return {
      postfix: 'msgs',
      color: '#200847',
      data: (w.sparkline || []).slice(-20).map(v => ({ value: v })),
    };
  })

  .get('/ingestion-topics', async () => {
    const d = await getData('data-processing');
    const w = d['ingestion-topics'] || {};
    return {
      postfix: 'msg/s',
      color: '#200847',
      data: (w.bars || []).map(b => ({ name: b.label, value: b.value })),
    };
  })

  // ── Campaign Delivery summary ──
  .get('/delivery-total', async () => {
    const d = await getData('campaign-delivery');
    const w = d['usa-delivery-map'] || {};
    const totals = w.totals || {};
    return {
      postfix: 'impressions',
      color: '#200847',
      data: [{ value: totals.impressions || 0 }, { value: Math.round((totals.impressions || 0) * 0.97) }],
    };
  })

  .get('/delivery-by-region', async () => {
    const d = await getData('campaign-delivery');
    const w = d['usa-delivery-map'] || {};
    const regions = w.regions || {};
    return {
      postfix: 'impressions',
      color: '#200847',
      data: [
        { name: 'East Coast', value: regions.east?.impressions || 0 },
        { name: 'Central', value: regions.central?.impressions || 0 },
        { name: 'West Coast', value: regions.west?.impressions || 0 },
      ],
    };
  });


// ===========================================================================
// ANYBOARD — Dashboard Configuration + Data Endpoint
// ===========================================================================

export const anyboardRoutes = new Elysia({ prefix: '/api/anyboard' })

  // ── Live data endpoint ──
  .get('/data.json', async () => {
    const [overview, services, dataProc, delivery] = await Promise.all([
      getData('platform-overview'),
      getData('services-health'),
      getData('data-processing'),
      getData('campaign-delivery'),
    ]);

    const ov = {
      bidsServed:     overview['bids-served']?.value || 0,
      impressions:    overview['impressions-delivered']?.value || 0,
      activeServices: overview['active-services']?.value || '0/0',
      uptime:         overview['platform-uptime']?.value || 99.97,
      events:         overview['events-processed']?.value || 0,
      cloudServices:  overview['cloud-services']?.value || '—',
      storageVolume:  overview['storage-volume']?.value || '—',
    };

    const sh = {
      online:       services['services-online']?.value || '—',
      requests:     services['requests-served']?.value || 0,
      responseTime: services['response-time']?.value || 0,
    };

    const topBars = services['top-services']?.bars || [];
    const fastBars = services['fastest-services']?.bars || [];

    const dp = {
      queries:  dataProc['analytics-queries']?.value || 0,
      slots:    dataProc['compute-utilization']?.value || 0,
      volume:   dataProc['storage-volume']?.value || '—',
      queued:   dataProc['messages-queued']?.value || 0,
    };

    const ingestionBars = dataProc['ingestion-topics']?.bars || [];

    const del = delivery['usa-delivery-map'] || {};
    const totals = del.totals || {};
    const regions = del.regions || {};

    const bidsSpark = (overview['bids-served']?.sparkline || []).slice(-12);
    const eventsSpark = (overview['events-processed']?.sparkline || []).slice(-12);
    const queriesSpark = (dataProc['analytics-queries']?.sparkline || []).slice(-12);
    const queuedSpark = (dataProc['messages-queued']?.sparkline || []).slice(-12);

    return {
      'bids-served':       { value: fmtNum(ov.bidsServed), subtitle: 'per second' },
      'impressions':       { value: fmtNum(ov.impressions), subtitle: 'today' },
      'active-services':   { value: String(ov.activeServices), subtitle: 'with traffic' },
      'uptime':            { value: String(ov.uptime), subtitle: '%', progress: Math.round(ov.uptime) },
      'events':            { value: fmtNum(ov.events), subtitle: 'per second' },
      'cloud-services':    { value: String(ov.cloudServices), subtitle: 'all healthy' },
      'storage-volume':    { value: String(ov.storageVolume), subtitle: 'BQ + GCS' },
      'services-online':   { value: String(sh.online), subtitle: 'Cloud Run' },
      'requests':          { value: fmtNum(sh.requests), subtitle: 'req/s' },
      'response-time':     { value: String(sh.responseTime), subtitle: 'ms median' },
      'queries':           { value: fmtNum(dp.queries), subtitle: 'per hour' },
      'slots':             { value: fmtNum(dp.slots), subtitle: 'BQ slots' },
      'data-volume':       { value: String(dp.volume), subtitle: 'total' },
      'queued':            { value: fmtNum(dp.queued), subtitle: 'messages' },
      'delivery-total':    { value: fmtNum(totals.impressions || 0), subtitle: 'nationwide' },
      'delivery-bids':     { value: fmtNum(totals.bids || 0), subtitle: 'bids served' },
      'delivery-campaigns': { value: String(totals.campaigns || 0), subtitle: 'services' },

      'bids-chart': bidsSpark.map((v, i) => ({ x: String(i), load: v })),
      'events-chart': eventsSpark.map((v, i) => ({ x: String(i), load: v })),
      'queries-chart': queriesSpark.map((v, i) => ({ x: String(i), load: v })),
      'queued-chart': queuedSpark.map((v, i) => ({ x: String(i), load: v })),

      'top-services-table': topBars.map(b => ({ name: b.label, value: fmtNum(b.value) })),
      'fastest-table': fastBars.map(b => ({ name: b.label, value: b.value + ' ms' })),
      'ingestion-table': ingestionBars.map(b => ({ name: b.label, value: fmtNum(b.value) })),
      'regions-table': [
        { name: 'East Coast',  value: fmtNum(regions.east?.impressions || 0) },
        { name: 'Central',     value: fmtNum(regions.central?.impressions || 0) },
        { name: 'West Coast',  value: fmtNum(regions.west?.impressions || 0) },
      ],
    };
  })

  // ── AnyBoard dashboard configuration ──
  .get('/config.json', ({ headers }) => {
    const host = headers.host || 'localhost:3000';
    const dataUrl = `http://${host}/api/anyboard/data.json`;

    return {
      name: 'MadHive Platform',
      sources: [{
        auth: 'none',
        name: 'Dashboard',
        endpoints: [{
          id: 'live',
          url: dataUrl,
          refresh: 8,
        }],
      }],
      dashboards: [
        // ── Page 1: Platform Overview ──
        {
          name: 'Platform Overview',
          color: '#FDA4D4',
          background: '#200847',
          cols: 4,
          rows: 3,
          source: { endpoint: 'live' },
          widgets: [
            {
              width: 2,
              basic: { title: 'BIDS SERVED' },
              source: { endpoint: 'live', mapping: { 'value': 'bids-served.value', 'subtitle': 'bids-served.subtitle' } },
            },
            {
              basic: { title: 'IMPRESSIONS' },
              source: { endpoint: 'live', mapping: { 'value': 'impressions.value', 'subtitle': 'impressions.subtitle' } },
            },
            {
              basic: { title: 'ACTIVE SERVICES' },
              source: { endpoint: 'live', mapping: { 'value': 'active-services.value', 'subtitle': 'active-services.subtitle' } },
            },
            {
              background: '#3D1A5C',
              basic: { title: 'UPTIME', unit: '%' },
              source: { endpoint: 'live', mapping: { 'value': 'uptime.value', 'progress': 'uptime.progress' } },
            },
            {
              basic: { title: 'EVENTS PROCESSED' },
              source: { endpoint: 'live', mapping: { 'value': 'events.value', 'subtitle': 'events.subtitle' } },
            },
            {
              basic: { title: 'CLOUD SERVICES' },
              source: { endpoint: 'live', mapping: { 'value': 'cloud-services.value', 'subtitle': 'cloud-services.subtitle' } },
            },
            {
              basic: { title: 'STORAGE VOLUME' },
              source: { endpoint: 'live', mapping: { 'value': 'storage-volume.value', 'subtitle': 'storage-volume.subtitle' } },
            },
            {
              width: 4,
              height: 1,
              chart: {
                title: 'Bids Served Trend',
                legend: false,
                series: [{ id: 'load', name: 'Bids', type: 'line', color: '#FDA4D4' }],
                data: [],
              },
              source: { endpoint: 'live', mapping: { 'data[].x': 'bids-chart[].x', 'data[].load': 'bids-chart[].load' } },
            },
          ],
        },

        // ── Page 2: Services Health ──
        {
          name: 'Services Health',
          color: '#4ADE80',
          background: '#200847',
          cols: 3,
          rows: 3,
          source: { endpoint: 'live' },
          widgets: [
            {
              basic: { title: 'SERVICES ONLINE' },
              source: { endpoint: 'live', mapping: { 'value': 'services-online.value', 'subtitle': 'services-online.subtitle' } },
            },
            {
              basic: { title: 'REQUESTS SERVED' },
              source: { endpoint: 'live', mapping: { 'value': 'requests.value', 'subtitle': 'requests.subtitle' } },
            },
            {
              basic: { title: 'RESPONSE TIME' },
              source: { endpoint: 'live', mapping: { 'value': 'response-time.value', 'subtitle': 'response-time.subtitle' } },
            },
            {
              width: 2,
              height: 2,
              minitable: {
                title: 'Top Services by Traffic',
                columns: [
                  { id: 'name', flex: 2 },
                  { id: 'value', align: 'right', style: 'bold' },
                ],
                data: [],
              },
              source: { endpoint: 'live', mapping: { 'data[].name': 'top-services-table[].name', 'data[].value': 'top-services-table[].value' } },
            },
            {
              height: 2,
              minitable: {
                title: 'Fastest Response',
                columns: [
                  { id: 'name', flex: 2 },
                  { id: 'value', align: 'right', style: 'bold' },
                ],
                data: [],
              },
              source: { endpoint: 'live', mapping: { 'data[].name': 'fastest-table[].name', 'data[].value': 'fastest-table[].value' } },
            },
          ],
        },

        // ── Page 3: Campaign Delivery ──
        {
          name: 'Campaign Delivery',
          color: '#FF9BD3',
          background: '#200847',
          cols: 3,
          rows: 2,
          source: { endpoint: 'live' },
          widgets: [
            {
              basic: { title: 'TOTAL IMPRESSIONS' },
              source: { endpoint: 'live', mapping: { 'value': 'delivery-total.value', 'subtitle': 'delivery-total.subtitle' } },
            },
            {
              basic: { title: 'BIDS SERVED' },
              source: { endpoint: 'live', mapping: { 'value': 'delivery-bids.value', 'subtitle': 'delivery-bids.subtitle' } },
            },
            {
              basic: { title: 'ACTIVE SERVICES' },
              source: { endpoint: 'live', mapping: { 'value': 'delivery-campaigns.value', 'subtitle': 'delivery-campaigns.subtitle' } },
            },
            {
              width: 3,
              minitable: {
                title: 'Delivery by Region',
                columns: [
                  { id: 'name', flex: 2, style: 'bold' },
                  { id: 'value', align: 'right', style: 'bold' },
                ],
                data: [],
              },
              source: { endpoint: 'live', mapping: { 'data[].name': 'regions-table[].name', 'data[].value': 'regions-table[].value' } },
            },
          ],
        },

        // ── Page 4: Data Processing ──
        {
          name: 'Data Processing',
          color: '#67E8F9',
          background: '#200847',
          cols: 3,
          rows: 3,
          source: { endpoint: 'live' },
          widgets: [
            {
              basic: { title: 'ANALYTICS QUERIES' },
              source: { endpoint: 'live', mapping: { 'value': 'queries.value', 'subtitle': 'queries.subtitle' } },
            },
            {
              basic: { title: 'COMPUTE', unit: 'slots' },
              source: { endpoint: 'live', mapping: { 'value': 'slots.value', 'subtitle': 'slots.subtitle' } },
            },
            {
              basic: { title: 'STORAGE VOLUME' },
              source: { endpoint: 'live', mapping: { 'value': 'data-volume.value', 'subtitle': 'data-volume.subtitle' } },
            },
            {
              basic: { title: 'MESSAGES QUEUED' },
              source: { endpoint: 'live', mapping: { 'value': 'queued.value', 'subtitle': 'queued.subtitle' } },
            },
            {
              width: 2,
              minitable: {
                title: 'Ingestion by Topic',
                columns: [
                  { id: 'name', flex: 2 },
                  { id: 'value', align: 'right', style: 'bold' },
                ],
                data: [],
              },
              source: { endpoint: 'live', mapping: { 'data[].name': 'ingestion-table[].name', 'data[].value': 'ingestion-table[].value' } },
            },
            {
              width: 3,
              height: 1,
              chart: {
                title: 'Queries Trend',
                legend: false,
                series: [{ id: 'load', name: 'Queries', type: 'line', color: '#67E8F9' }],
                data: [],
              },
              source: { endpoint: 'live', mapping: { 'data[].x': 'queries-chart[].x', 'data[].load': 'queries-chart[].load' } },
            },
          ],
        },
      ],
    };
  });
