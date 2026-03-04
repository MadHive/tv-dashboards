// ===========================================================================
// GCP Dashboard Importer — lists Cloud Monitoring dashboards and parses tiles
// ===========================================================================

import { GoogleAuth } from 'google-auth-library';

const MONITORING_BASE = 'https://monitoring.googleapis.com/v1';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/monitoring.read'],
  ...(process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? { keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS }
    : {}),
});

async function gcpFetch(url) {
  const client = await auth.getClient();
  const res = await client.request({ url });
  return res.data;
}

/**
 * List all custom dashboards for a GCP project.
 * Returns [{ name, displayName, tileCount }]
 */
export async function listDashboards(project) {
  const data = await gcpFetch(`${MONITORING_BASE}/projects/${project}/dashboards`);
  const dashboards = data.dashboards || [];
  return dashboards.map(d => ({
    name:        d.name,
    displayName: d.displayName || d.name.split('/').pop(),
    tileCount:   countTiles(d),
  }));
}

/**
 * Fetch a single dashboard and return its parsed tiles.
 * name: full resource name e.g. "projects/mad-master/dashboards/abc123"
 */
export async function getDashboard(name) {
  const data = await gcpFetch(`${MONITORING_BASE}/${name}`);
  return parseTiles(data);
}

function countTiles(dashboard) {
  return collectWidgets(dashboard).length;
}

function collectWidgets(dashboard) {
  const widgets = [];
  if (dashboard.mosaicLayout?.tiles) {
    for (const tile of dashboard.mosaicLayout.tiles) {
      if (tile.widget) widgets.push(tile.widget);
    }
  } else if (dashboard.gridLayout?.widgets) {
    widgets.push(...dashboard.gridLayout.widgets);
  } else if (dashboard.rowLayout?.rows) {
    for (const row of dashboard.rowLayout.rows) {
      if (row.widgets) widgets.push(...row.widgets);
    }
  }
  return widgets;
}

/**
 * Parse all chart tiles in a dashboard into importable query definitions.
 * Returns [{ id, name, metricType, filters, aggregation }]
 * Exported for unit testing.
 */
export function parseTiles(dashboard) {
  const results = [];

  for (const widget of collectWidgets(dashboard)) {
    const title = widget.title || 'Untitled';
    const tsFilters = [];

    if (widget.xyChart?.dataSets) {
      for (const ds of widget.xyChart.dataSets) {
        const tsf = ds?.timeSeriesQuery?.timeSeriesFilter;
        if (tsf) tsFilters.push(tsf);
      }
    } else if (widget.scorecard?.timeSeriesQuery?.timeSeriesFilter) {
      tsFilters.push(widget.scorecard.timeSeriesQuery.timeSeriesFilter);
    }

    if (tsFilters.length === 0) continue;

    const multi = tsFilters.length > 1;

    tsFilters.forEach((tsf, i) => {
      const parsed = parseFilter(tsf.filter || '');
      if (!parsed.metricType) return;

      const name = multi ? `${title} (${i + 1})` : title;
      const agg  = tsf.aggregation || {};

      results.push({
        id:          slugifyId(name, parsed.metricType),
        name,
        metricType:  parsed.metricType,
        filters:     parsed.remaining,
        aggregation: {
          perSeriesAligner:   agg.perSeriesAligner   || 'ALIGN_MEAN',
          crossSeriesReducer: agg.crossSeriesReducer  || undefined, // omitted in JSON when absent — correct for single-series queries
          alignmentPeriod:    agg.alignmentPeriod     || '60s',
        },
      });
    });
  }

  return results;
}

function parseFilter(filterStr) {
  const match = filterStr.match(/metric\.type="([^"]+)"/);
  if (!match) return { metricType: null, remaining: '' };
  const metricType = match[1];
  const remaining  = filterStr.replace(match[0], '').trim();
  return { metricType, remaining };
}

/**
 * Generate a stable, URL-safe id from a tile name and metricType.
 * Appends a 4-char hash of the metricType to avoid collisions.
 * Exported for unit testing.
 */
export function slugifyId(name, metricType) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  let h = 5381;
  for (let i = 0; i < metricType.length; i++) {
    h = ((h << 5) + h) ^ metricType.charCodeAt(i);
    h = h >>> 0;
  }
  const suffix = (h % 0x10000).toString(16).padStart(4, '0');

  return `${slug}-${suffix}`;
}
