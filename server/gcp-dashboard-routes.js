// ===========================================================================
// GCP Dashboard Import Routes
// ===========================================================================

import { Elysia } from 'elysia';
import { listDashboards, getDashboard } from './gcp-dashboards.js';
import { loadQueries } from './query-manager.js';
import logger from './logger.js';

const DEFAULT_PROJECT = (process.env.GCP_PROJECTS || 'mad-master').split(',')[0].trim();

export const gcpDashboardRoutes = new Elysia({ prefix: '/api/gcp/dashboards' })

  .get('/', async ({ query }) => {
    const project = query.project || DEFAULT_PROJECT;
    try {
      const dashboards = await listDashboards(project);
      return { success: true, project, dashboards };
    } catch (err) {
      logger.error({ err: err.message }, 'listDashboards failed');
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['queries'],
      summary: 'List GCP custom dashboards',
      description: 'List all Cloud Monitoring custom dashboards for a GCP project, with tile counts.',
    },
  })

  .get('/:name', async ({ params, query }) => {
    const project  = query.project || DEFAULT_PROJECT;
    const fullName = `projects/${project}/dashboards/${params.name}`;
    try {
      const rawTiles   = await getDashboard(fullName);
      const existing   = loadQueries();
      const gcpQueries = existing.gcp || [];

      const tiles = rawTiles.map(tile => {
        const conflict = gcpQueries.find(q => q.metricType === tile.metricType);
        return conflict ? { ...tile, conflictId: conflict.id } : tile;
      });

      return { success: true, project, dashboardName: params.name, tiles };
    } catch (err) {
      logger.error({ err: err.message }, 'getDashboard failed');
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['queries'],
      summary: 'Get importable tiles from a GCP dashboard',
      description: 'Returns parsed metric tiles. Tiles with a conflictId already exist in queries.yaml.',
    },
  });
