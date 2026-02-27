// ---------------------------------------------------------------------------
// MadHive Dashboard Server — Bun + ElysiaJS
// ---------------------------------------------------------------------------

import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { cookie } from '@elysiajs/cookie';
import { cors } from '@elysiajs/cors';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getMetrics as mockGetMetrics } from './mock-data.js';
import { proxyRoutes } from './api-proxy.js';
import { numericsRoutes, anyboardRoutes } from './tv-apps.js';
import { bigQueryRoutes } from './bigquery-routes.js';
import { queryRoutes } from './query-routes.js';
import { googleOAuthRoutes } from './google-oauth.js';
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

// Serve Astro build output instead of vanilla JS
const publicDir = join(__dirname, '..', 'public-astro');
const indexHtml = readFileSync(join(publicDir, 'index.html'), 'utf8');

// Simple in-memory cache to speed up widget loading (10 second cache)
const widgetCache = new Map();
const CACHE_DURATION = 10000;

function getCachedData(key) {
  const cached = widgetCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedData(key, data) {
  widgetCache.set(key, { data, timestamp: Date.now() });
}

const app = new Elysia()
  .use(cors())
  .use(cookie())
  .onAfterHandle(({ request, response }) => {
    // Add no-cache headers for HTML files to prevent browser caching issues
    if (request.url.endsWith('.html') || request.url.endsWith('/')) {
      if (response instanceof Response) {
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
      }
    }
    return response;
  })
  .use(staticPlugin({ assets: publicDir, prefix: '/' }))
  .get('/', () => new Response(indexHtml, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  }))

  // Config endpoints
  .get('/api/config', () => loadConfig())
  .get('/api/metrics/:dashboardId', async ({ params }) => {
    return getData(params.dashboardId);
  })

  // Single widget data endpoint
  .get('/api/data/:widgetId', async ({ params }) => {
    const config = loadConfig();
    const { widgetId } = params;

    // Check cache first
    const cached = getCachedData(widgetId);
    if (cached) {
      return cached;
    }

    // Find which dashboard contains this widget
    for (const dashboard of config.dashboards) {
      const widget = dashboard.widgets.find(w => w.id === widgetId);
      if (widget) {
        try {
          // Get all metrics for this dashboard
          const dashboardData = await getData(dashboard.id);

          console.log(`[api/data] Widget ${widgetId} found in dashboard ${dashboard.id}, has data:`, !!dashboardData?.[widgetId]);

          // Return just this widget's data
          if (dashboardData && dashboardData[widgetId]) {
            const widgetData = {
              ...dashboardData[widgetId],
              timestamp: new Date().toISOString(),
            };
            // Cache the result
            setCachedData(widgetId, widgetData);
            return widgetData;
          }

          // Widget found but no data - try next dashboard
          continue;
        } catch (error) {
          console.error(`[api/data] Error fetching data for widget ${widgetId} from dashboard ${dashboard.id}:`, error.message);
          continue;
        }
      }
    }

    console.log(`[api/data] Widget ${widgetId} NOT FOUND in any dashboard`);
    return new Response(
      JSON.stringify({ error: 'Widget not found' }),
      { status: 404, headers: { 'content-type': 'application/json' } }
    );
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
  .use(bigQueryRoutes)
  .use(queryRoutes)
  .use(googleOAuthRoutes)
  .listen({ port: PORT, hostname: HOST });

console.log(`\n  Dashboard server running at http://${HOST}:${PORT}`);
console.log(`  Config loaded from config/dashboards.yaml`);
console.log(`  Data mode: ${LIVE ? 'LIVE (GCP)' : 'MOCK'}`);
console.log(`  Numerics widgets: http://${HOST}:${PORT}/api/numerics/<widget>`);
console.log(`  AnyBoard config:  http://${HOST}:${PORT}/api/anyboard/config.json\n`);
