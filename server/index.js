// ---------------------------------------------------------------------------
// MadHive Dashboard Server — Bun + ElysiaJS
// ---------------------------------------------------------------------------

import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getMetrics as mockGetMetrics } from './mock-data.js';
import { proxyRoutes } from './api-proxy.js';
import { numericsRoutes, anyboardRoutes } from './tv-apps.js';
import {
  loadConfig as loadConfigFromFile,
  saveConfig,
  updateDashboard,
  createDashboard,
  deleteDashboard,
  listBackups,
  restoreBackup
} from './config-manager.js';
import { dataSourceRegistry } from './data-source-registry.js';
import {
  saveTemplate,
  listTemplates,
  loadTemplate,
  deleteTemplate,
  exportDashboard,
  importDashboard
} from './template-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '80', 10);
const HOST = process.env.HOST || 'tv.madhive.local';
const LIVE = process.env.USE_REAL_DATA === 'true';

// Use config manager for loading (with caching)
let cachedConfig = null;
let cacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds

function loadConfig() {
  const now = Date.now();
  if (cachedConfig && (now - cacheTime) < CACHE_TTL) {
    return cachedConfig;
  }

  cachedConfig = loadConfigFromFile();
  cacheTime = now;
  return cachedConfig;
}

function invalidateConfigCache() {
  cachedConfig = null;
  cacheTime = 0;
}

export async function getData(dashboardId) {
  // Try to get dashboard config for widget-based fetching
  try {
    const config = loadConfig();
    const dashboard = config.dashboards.find(d => d.id === dashboardId);

    if (dashboard && dashboard.widgets) {
      // Use new data source registry for widget-based fetching
      return await dataSourceRegistry.fetchDashboardMetrics(dashboardId, dashboard);
    }
  } catch (err) {
    console.warn('[metrics] Failed to use registry, falling back to legacy:', err.message);
  }

  // Legacy behavior for backward compatibility
  if (LIVE) {
    try {
      const liveData = await import('./gcp-metrics.js');
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('GCP query timeout (20s)')), 20000)
      );
      return await Promise.race([liveData.getMetrics(dashboardId), timeout]);
    } catch (err) {
      console.error('[metrics] Live data failed, falling back to mock:', err.message);
    }
  }
  return mockGetMetrics(dashboardId);
}

const publicDir = join(__dirname, '..', 'public');
const indexHtml = readFileSync(join(publicDir, 'index.html'), 'utf8');

const app = new Elysia()
  .use(staticPlugin({ assets: publicDir, prefix: '/' }))
  .get('/', () => new Response(indexHtml, { headers: { 'content-type': 'text/html; charset=utf-8' } }))

  // Config endpoints
  .get('/api/config', () => loadConfig())
  .get('/api/metrics/:dashboardId', async ({ params }) => {
    return getData(params.dashboardId);
  })

  // Dashboard management endpoints
  .post('/api/config', async ({ body }) => {
    try {
      await saveConfig(body);
      invalidateConfigCache();
      return { success: true, message: 'Configuration saved' };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  .put('/api/dashboards/:id', async ({ params, body }) => {
    try {
      const result = await updateDashboard(params.id, body);
      invalidateConfigCache();
      return result;
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  .post('/api/dashboards', async ({ body }) => {
    try {
      const result = await createDashboard(body);
      invalidateConfigCache();
      return result;
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  .delete('/api/dashboards/:id', async ({ params }) => {
    try {
      const result = await deleteDashboard(params.id);
      invalidateConfigCache();
      return result;
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  // Backup management endpoints
  .get('/api/backups', () => {
    try {
      return { success: true, backups: listBackups() };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  .post('/api/backups/restore', async ({ body }) => {
    try {
      const result = await restoreBackup(body.filename);
      invalidateConfigCache();
      return result;
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  // Data source management endpoints
  .get('/api/data-sources', () => {
    try {
      const sources = dataSourceRegistry.getAllSources();
      return {
        success: true,
        sources: sources.map(s => ({
          name: s.name,
          isConnected: s.isConnected,
          isReady: s.isReady()
        }))
      };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  .get('/api/data-sources/schemas', () => {
    try {
      return { success: true, schemas: dataSourceRegistry.getSchemas() };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  .get('/api/data-sources/health', () => {
    try {
      return { success: true, health: dataSourceRegistry.getHealth() };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  .get('/api/data-sources/:name/metrics', ({ params }) => {
    try {
      const metrics = dataSourceRegistry.getAvailableMetrics(params.name);
      return { success: true, metrics };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 404, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  .post('/api/data-sources/:name/test', async ({ params }) => {
    try {
      const connected = await dataSourceRegistry.testConnection(params.name);
      return { success: true, connected };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  // Template management endpoints
  .get('/api/templates', () => {
    try {
      const templates = listTemplates();
      return { success: true, templates };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  .get('/api/templates/:filename', ({ params }) => {
    try {
      const template = loadTemplate(params.filename);
      return { success: true, template };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 404, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  .post('/api/templates', async ({ body }) => {
    try {
      const { name, dashboard, metadata } = body;
      if (!name || !dashboard) {
        throw new Error('Template name and dashboard configuration required');
      }
      const result = await saveTemplate(name, dashboard, metadata);
      return result;
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  .delete('/api/templates/:filename', ({ params }) => {
    try {
      const result = deleteTemplate(params.filename);
      return result;
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 404, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  .post('/api/dashboards/export', ({ body }) => {
    try {
      const { dashboard } = body;
      if (!dashboard) {
        throw new Error('Dashboard configuration required');
      }
      const json = exportDashboard(dashboard);
      return new Response(json, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${dashboard.id || 'dashboard'}.json"`
        }
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  .post('/api/dashboards/import', async ({ body }) => {
    try {
      const { json } = body;
      if (!json) {
        throw new Error('JSON data required');
      }
      const dashboard = importDashboard(json);
      return { success: true, dashboard };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  })

  // Health check endpoint for Cloud Run
  .get('/health', () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      service: 'tv-dashboards'
    };
  })

  .use(proxyRoutes)
  .use(numericsRoutes)
  .use(anyboardRoutes)
  .listen({ port: PORT, hostname: HOST });

console.log(`\n  Dashboard server running at http://${HOST}:${PORT}`);
console.log(`  Config loaded from config/dashboards.yaml`);
console.log(`  Data mode: ${LIVE ? 'LIVE (GCP)' : 'MOCK'}`);
console.log(`  Numerics widgets: http://${HOST}:${PORT}/api/numerics/<widget>`);
console.log(`  AnyBoard config:  http://${HOST}:${PORT}/api/anyboard/config.json\n`);
