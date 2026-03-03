// ---------------------------------------------------------------------------
// MadHive Dashboard Server — Bun + ElysiaJS
// ---------------------------------------------------------------------------

import { Elysia, t } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import { staticPlugin } from '@elysiajs/static';
import { cookie } from '@elysiajs/cookie';
import { cors } from '@elysiajs/cors';
import { readFileSync, writeFileSync } from 'fs';
import { load, dump } from 'js-yaml';
import { join, dirname } from 'path';
import logger from './logger.js';
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
import DashboardManager from './dashboard-manager.js';
import { getSchema, getAllSchemas, validateConnection } from './data-source-schemas.js';
import { themeManager } from './theme-manager.js';
import { metricsCollector } from './metrics.js';
import { models } from './models/index.js';
import { smartRateLimit, addCacheHeaders, cachePresets } from './rate-limiter.js';
import { getConfig, updateConfig, toggleEnabled, getAuditLog, exportConfigs } from './data-source-config.js';
import { initDatabase } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '80', 10);
const HOST = process.env.HOST || 'tv.madhive.local';
const LIVE = process.env.USE_REAL_DATA === 'true';

// Initialize database for data source configuration management
initDatabase();

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
    logger.warn({ error: err.message }, 'Failed to use data source registry, falling back to legacy');
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
      logger.error({ error: err.message }, 'Live data failed, falling back to mock');
    }
  }
  return mockGetMetrics(dashboardId);
}

// Serve vanilla JS (public/)
const publicDir = join(__dirname, '..', 'public');
const indexHtml = readFileSync(join(publicDir, 'index.html'), 'utf8');

// Simple in-memory cache to speed up widget loading (10 second cache)
const widgetCache = new Map();
const CACHE_DURATION = 10000;

function getCachedData(key) {
  const cached = widgetCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    metricsCollector.recordCacheHit();
    return cached.data;
  }
  metricsCollector.recordCacheMiss();
  return null;
}

function setCachedData(key, data) {
  widgetCache.set(key, { data, timestamp: Date.now() });
  metricsCollector.recordCacheSet();
}

// Dashboard manager instance
const dashboardManager = new DashboardManager('./config/dashboards.yaml');

// Load themes on startup
await themeManager.loadThemes();

const app = new Elysia()
  .use(openapi({
    documentation: {
      info: {
        title:       'MadHive TV Dashboards API',
        version:     '2.0.0',
        description: 'Real-time engineering dashboard system with WYSIWYG editor. Data sources: GCP, BigQuery, VulnTrack, Mock.',
      },
      tags: [
        { name: 'health',       description: 'Health and status checks' },
        { name: 'dashboards',   description: 'Dashboard CRUD and management' },
        { name: 'data-sources', description: 'Data source configuration and health' },
        { name: 'queries',      description: 'Saved query management' },
        { name: 'templates',    description: 'Dashboard template library' },
        { name: 'themes',       description: 'Visual theme management' },
        { name: 'backups',      description: 'Configuration backup and restore' },
        { name: 'metrics',      description: 'Performance and widget metrics' },
        { name: 'tv-apps',      description: 'Apple TV and external app widget endpoints' },
        { name: 'auth',         description: 'Google OAuth authentication' },
      ],
    },
    swaggerOptions: {
      persistAuthorization: true,
    },
  }))
  .use(models)           // model registry — all t.* schemas available to routes
  .use(cors())
  .use(cookie())
  // Performance monitoring middleware
  .onRequest(({ request, store }) => {
    // Track request start time
    store.requestStartTime = Date.now();
  })
  .onAfterHandle(({ request, response, store }) => {
    // Calculate response time
    const duration = Date.now() - (store.requestStartTime || Date.now());
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Add headers to Response objects
    if (response instanceof Response) {
      response.headers.set('X-Response-Time', `${duration}ms`);

      // Apply cache headers based on path
      // HTML files: no cache
      if (pathname.endsWith('.html') || pathname === '/') {
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
      }
      // Static assets: 1 hour cache, immutable
      else if (pathname.startsWith('/app/assets/') || pathname.startsWith('/css/') || pathname.startsWith('/js/')) {
        response.headers.set('Cache-Control', 'public, max-age=3600, immutable');
      }
      // Dashboard config: 1 minute cache with revalidation
      else if (pathname === '/api/config') {
        response.headers.set('Cache-Control', 'max-age=60, must-revalidate');
      }
      // Other API endpoints: no cache
      else if (pathname.startsWith('/api/')) {
        response.headers.set('Cache-Control', 'no-cache');
      }
    }

    // Record metrics
    const statusCode = response instanceof Response ? response.status : 200;
    metricsCollector.recordRequest(pathname, duration, statusCode);

    return response;
  })
  // HTML pages need to be served before static plugin to avoid build issues
  .get('/', () => new Response(indexHtml, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  }))

  .get('/admin', () => {
    const adminHtml = readFileSync(join(publicDir, 'studio.html'), 'utf8');
    return new Response(adminHtml, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  })

  .get('/data-sources.html', () => {
    const dataSourcesHtml = readFileSync(join(publicDir, 'data-sources-page.html'), 'utf8');
    return new Response(dataSourcesHtml, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  })

  // Studio JS/CSS: served dynamically so file edits take effect on restart
  // without the static plugin's in-memory file cache getting in the way
  .get('/js/studio.js', () => new Response(readFileSync(join(publicDir, 'js/studio.js'), 'utf8'), {
    headers: { 'content-type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' }
  }))
  .get('/css/studio.css', () => new Response(readFileSync(join(publicDir, 'css/studio.css'), 'utf8'), {
    headers: { 'content-type': 'text/css; charset=utf-8', 'Cache-Control': 'no-cache' }
  }))
  .get('/js/studio-canvas.js', () => new Response(readFileSync(join(publicDir, 'js/studio-canvas.js'), 'utf8'), {
    headers: { 'content-type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' }
  }))

  .use(staticPlugin({ assets: publicDir, prefix: '/' }))

  .get('/wizard-demo', async () => {
    const file = Bun.file(join(publicDir, 'wizard-demo.html'));
    return new Response(file, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  })

  // Config endpoints
  .get('/api/config', () => loadConfig(), {
    response: { 200: 'dashboard.list' },
    detail: { tags: ['config'], summary: 'Get full dashboard configuration' },
  })
  .put('/api/config/global', ({ body }) => {
    try {
      const cfg = loadConfig();
      cfg.global = { ...cfg.global, ...body };
      saveConfig(cfg);
      invalidateConfigCache();
      return { success: true };
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }, {
    body: t.Object({ title: t.Optional(t.String()), rotation_interval: t.Optional(t.Number()), refresh_interval: t.Optional(t.Number()) }),
    response: { 200: 'common.success', 400: 'common.error' },
    detail: { tags: ['config'], summary: 'Update global config settings' },
  })
  .get('/api/metrics/:dashboardId', async ({ params }) => {
    return getData(params.dashboardId);
  }, {
    response: { 200: 'metrics.dashboard' },
    detail: { tags: ['metrics'], summary: 'Get metrics for a dashboard' },
  })

  // Browse GCP metric descriptors across projects
  .get('/api/gcp/metrics/descriptors', async ({ query }) => {
    try {
      const { listDescriptors } = await import('./gcp-metrics.js');
      const projects = (process.env.GCP_PROJECTS || 'mad-master').split(',').map(p => p.trim());
      const project = query.project && projects.includes(query.project) ? query.project : projects[0];
      const search  = query.search || '';
      const descriptors = await listDescriptors(project, search);
      const namespaces = [...new Set(descriptors.map(d => d.type.split('/')[0]))].sort();
      return { success: true, project, projects, count: descriptors.length, namespaces, descriptors };
    } catch (err) {
      const permDenied = err.code === 7 || (err.message || '').includes('PERMISSION_DENIED');
      return new Response(
        JSON.stringify({
          success: false,
          error: err.message,
          hint: permDenied
            ? 'Grant roles/monitoring.viewer to the service account on this project'
            : undefined,
        }),
        { status: permDenied ? 403 : 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    response: { 200: 'metrics.descriptor-list', 403: 'metrics.descriptor-error', 500: 'metrics.descriptor-error' },
    detail: { tags: ['metrics'], summary: 'Browse GCP metric descriptors for a project' },
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

          logger.warn({ widgetId }, 'Widget not found in any dashboard');

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
          logger.error({ widgetId, dashboardId: dashboard.id, error: error.message }, 'Error fetching widget data');
          continue;
        }
      }
    }

    logger.warn({ widgetId }, 'Widget not found in any dashboard');
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

  // Dashboard management endpoints
  .get('/api/dashboards', async () => {
    try {
      const dashboards = await dashboardManager.listDashboards();
      return dashboards;
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, { detail: { tags: ['dashboards'], summary: 'List all dashboards' } })

  .get('/api/dashboards/:id', async ({ params }) => {
    try {
      const dashboard = await dashboardManager.getDashboard(params.id);
      return dashboard;
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 404, headers: { 'content-type': 'application/json' } }
      );
    }
  }, { detail: { tags: ['dashboards'], summary: 'Get dashboard by ID' } })

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
  }, {
    body: 'dashboard.update',
    response: { 200: 'dashboard.response', 400: 'common.error' },
    detail: { tags: ['dashboards'], summary: 'Update dashboard' },
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
  }, {
    body: 'dashboard.create',
    response: { 200: 'dashboard.response', 400: 'common.error' },
    detail: { tags: ['dashboards'], summary: 'Create new dashboard' },
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
  }, {
    response: { 200: 'common.success', 404: 'common.error' },
    detail: { tags: ['dashboards'], summary: 'Delete dashboard' },
  })

  .post('/api/dashboards/:id/duplicate', async ({ params }) => {
    try {
      const dashboard = await dashboardManager.duplicateDashboard(params.id);
      invalidateConfigCache();
      return dashboard;
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    response: { 200: 'dashboard.response', 404: 'common.error' },
    detail: { tags: ['dashboards'], summary: 'Duplicate dashboard' },
  })

  .post('/api/dashboards/reorder', async ({ body }) => {
    try {
      const dashboards = await dashboardManager.reorderDashboards(body.order);
      invalidateConfigCache();
      return dashboards;
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    body: 'dashboard.reorder',
    response: { 200: 'dashboard.list' },
    detail: { tags: ['dashboards'], summary: 'Reorder dashboards' },
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
  }, {
    response: { 200: t.Object({ success: t.Boolean(), backups: t.Array(t.String()) }) },
    detail: { tags: ['backups'], summary: 'List configuration backups' },
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
  }, {
    body: t.Object({ filename: t.String() }),
    response: { 200: 'common.success', 400: 'common.error' },
    detail: { tags: ['backups'], summary: 'Restore from backup' },
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
  }, {
    response: { 200: 'datasource.list' },
    detail: { tags: ['data-sources'], summary: 'List all data sources' },
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
  }, { detail: { tags: ['data-sources'], summary: 'List data source schemas' } })

  .get('/api/data-sources/health', () => {
    try {
      return { success: true, health: dataSourceRegistry.getHealth() };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, { detail: { tags: ['data-sources'], summary: 'Get data source health' } })

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
  }, {
    response: { 200: t.Object({ success: t.Boolean(), metrics: t.Array(t.Any()) }) },
    detail: { tags: ['data-sources'], summary: 'Get available metrics for a data source' },
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
  }, {
    response: { 200: 'datasource.test-response' },
    detail: { tags: ['data-sources'], summary: 'Test data source connection' },
  })

  // Data source schema endpoints (detailed field definitions)
  .get('/api/data-sources/schemas/detailed', () => {
    try {
      const schemas = getAllSchemas();
      return { success: true, schemas };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, { detail: { tags: ['data-sources'], summary: 'Get detailed data source schemas' } })

  .get('/api/data-sources/schemas/detailed/:sourceId', ({ params }) => {
    try {
      const schema = getSchema(params.sourceId);
      if (!schema) {
        return new Response(
          JSON.stringify({ success: false, error: 'Schema not found' }),
          { status: 404, headers: { 'content-type': 'application/json' } }
        );
      }
      return { success: true, schema };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, { detail: { tags: ['data-sources'], summary: 'Get detailed schema for a data source' } })

  .post('/api/data-sources/validate', ({ body }) => {
    try {
      const { sourceId, data } = body;
      if (!sourceId || !data) {
        return new Response(
          JSON.stringify({ success: false, error: 'sourceId and data are required' }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }
      const result = validateConnection(sourceId, data);
      return { success: true, ...result };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, { detail: { tags: ['data-sources'], summary: 'Validate data source configuration' } })

  // Data source configuration management endpoints
  .get('/api/data-sources/:name/config', ({ params }) => {
    try {
      const result = getConfig(params.name);
      if (!result) {
        return new Response(
          JSON.stringify({ success: false, error: `Data source "${params.name}" not found` }),
          { status: 404, headers: { 'content-type': 'application/json' } }
        );
      }
      return {
        success: true,
        enabled: Boolean(result.enabled),
        config: result.config,
        updatedAt: result.updatedAt,
        updatedBy: result.updatedBy
      };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, { detail: { tags: ['data-sources'], summary: 'Get data source config' } })

  .put('/api/data-sources/:name/config', async ({ params, body }) => {
    try {
      const config = body;
      const userEmail = 'system@madhive.com'; // TODO: Extract from session
      updateConfig(params.name, config, userEmail);
      const result = getConfig(params.name);
      return {
        success: true,
        enabled: Boolean(result.enabled),
        config: result.config,
        updatedAt: result.updatedAt,
        updatedBy: result.updatedBy
      };
    } catch (error) {
      if (error.message.includes('Sensitive') || error.message.includes('Invalid')) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    body: 'datasource.config',
    response: { 200: 'common.success', 400: 'common.error' },
    detail: { tags: ['data-sources'], summary: 'Update data source config' },
  })

  .post('/api/data-sources/:name/toggle', async ({ params, body }) => {
    try {
      const { enabled } = body;
      if (typeof enabled !== 'boolean') {
        return new Response(
          JSON.stringify({ success: false, error: 'enabled must be a boolean' }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }
      const userEmail = 'system@madhive.com'; // TODO: Extract from session
      toggleEnabled(params.name, enabled, userEmail);
      const result = getConfig(params.name);
      return {
        success: true,
        enabled: Boolean(result.enabled),
        config: result.config,
        updatedAt: result.updatedAt,
        updatedBy: result.updatedBy
      };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, { detail: { tags: ['data-sources'], summary: 'Enable or disable data source' } })

  .get('/api/data-sources/:name/history', ({ params, query }) => {
    try {
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const history = getAuditLog(params.name, limit);
      return {
        success: true,
        history
      };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    response: { 200: t.Object({ success: t.Boolean(), history: t.Array(t.Any()) }) },
    detail: { tags: ['data-sources'], summary: 'Get audit log for data source' },
  })

  .get('/api/data-sources/export', () => {
    try {
      const configs = exportConfigs();
      return {
        success: true,
        configs
      };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, { detail: { tags: ['data-sources'], summary: 'Export all data source configs' } })

  // Template management endpoints
  .get('/api/templates', ({ query }) => {
    try {
      const templates = listTemplates();

      // Filter by category if provided
      if (query.category) {
        const filtered = templates.filter(t => t.category === query.category);
        return { success: true, templates: filtered };
      }

      return { success: true, templates };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    response: { 200: 'template.list' },
    detail: { tags: ['templates'], summary: 'List dashboard templates' },
  })

  .get('/api/templates/:id', ({ params }) => {
    try {
      // Validate BEFORE sanitization (prevent path traversal)
      if (params.id.includes('..') || params.id.includes('/') || params.id.includes('\\')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid template ID' }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }

      // Sanitize ID and add .yaml extension
      const sanitizedId = params.id.replace(/[^a-z0-9-]/g, '-');

      // Additional validation after sanitization
      if (sanitizedId.startsWith('-') || sanitizedId.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid template ID' }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }

      const filename = `${sanitizedId}.yaml`;
      const template = loadTemplate(filename);
      return { success: true, template };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: error.message.includes('not found') ? 404 : 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    response: { 200: 'template.response', 404: 'common.error' },
    detail: { tags: ['templates'], summary: 'Get template by ID' },
  })

  .post('/api/templates', async ({ body }) => {
    try {
      const { name, dashboard, description, category, author } = body;

      // Validate required fields
      if (!name || !dashboard) {
        throw new Error('Template name and dashboard configuration required');
      }

      // Validate BEFORE sanitization (prevent path traversal)
      if (name.includes('..') || name.includes('/') || name.includes('\\')) {
        throw new Error('Invalid template name');
      }

      // Sanitize name for filename
      const sanitizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Additional validation after sanitization
      if (sanitizedName.startsWith('-') || sanitizedName.length === 0) {
        throw new Error('Invalid template name');
      }

      const metadata = {
        description: description || '',
        category: category || 'Custom',
        author: author || 'User'
      };

      const result = await saveTemplate(name, dashboard, metadata);
      return new Response(
        JSON.stringify(result),
        { status: 201, headers: { 'content-type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    body: 'template.create',
    response: { 200: 'template.response', 400: 'common.error' },
    detail: { tags: ['templates'], summary: 'Create new template' },
  })

  .put('/api/templates/:id', async ({ params, body }) => {
    try {
      // Validate BEFORE sanitization (prevent path traversal)
      if (params.id.includes('..') || params.id.includes('/') || params.id.includes('\\')) {
        throw new Error('Invalid template ID');
      }

      // Sanitize ID and add .yaml extension
      const sanitizedId = params.id.replace(/[^a-z0-9-]/g, '-');

      // Additional validation after sanitization
      if (sanitizedId.startsWith('-') || sanitizedId.length === 0) {
        throw new Error('Invalid template ID');
      }

      const filename = `${sanitizedId}.yaml`;

      // Load existing template
      const existing = loadTemplate(filename);

      // Merge updates
      const updated = {
        name: body.name || existing.name,
        description: body.description || existing.description,
        category: body.category || existing.category,
        author: existing.author, // Don't allow changing author
        createdAt: existing.createdAt || new Date().toISOString(),
        dashboard: body.dashboard || existing.dashboard
      };

      // Validate updated name if it was changed
      if (body.name && (body.name.includes('..') || body.name.includes('/') || body.name.includes('\\'))) {
        throw new Error('Invalid template name');
      }

      // Write updated template directly to same file (don't change filename)
      const TEMPLATES_DIR = join(__dirname, '..', 'config', 'templates');
      const filepath = join(TEMPLATES_DIR, filename);

      const yamlContent = dump(updated, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false
      });

      writeFileSync(filepath, yamlContent, 'utf8');

      return { success: true, filename, template: updated };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    body: 'template.update',
    response: { 200: 'template.response', 404: 'common.error' },
    detail: { tags: ['templates'], summary: 'Update template' },
  })

  .delete('/api/templates/:id', ({ params }) => {
    try {
      // Validate BEFORE sanitization (prevent path traversal)
      if (params.id.includes('..') || params.id.includes('/') || params.id.includes('\\')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid template ID' }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }

      // Sanitize ID and add .yaml extension
      const sanitizedId = params.id.replace(/[^a-z0-9-]/g, '-');

      // Additional validation after sanitization
      if (sanitizedId.startsWith('-') || sanitizedId.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid template ID' }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }

      const filename = `${sanitizedId}.yaml`;
      deleteTemplate(filename);
      return new Response(null, { status: 204 });
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: error.message.includes('not found') ? 404 : 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    response: { 200: 'common.success', 404: 'common.error' },
    detail: { tags: ['templates'], summary: 'Delete template' },
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
  }, {
    body: 'dashboard.export',
    response: { 200: 'dashboard.item' },
    detail: { tags: ['dashboards'], summary: 'Export dashboard as JSON' },
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
  }, {
    body: 'dashboard.import',
    response: { 200: 'dashboard.response', 400: 'common.error' },
    detail: { tags: ['dashboards'], summary: 'Import dashboard from JSON' },
  })

  // Theme management endpoints
  .get('/api/themes', ({ query }) => {
    try {
      if (query.category) {
        return themeManager.getThemesByCategory(query.category);
      }
      return themeManager.getAllThemes();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    response: { 200: 'theme.list' },
    detail: { tags: ['themes'], summary: 'List all themes' },
  })

  .get('/api/themes/categories', () => {
    try {
      return themeManager.getCategories();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    response: { 200: 'theme.list' },
    detail: { tags: ['themes'], summary: 'List theme categories' },
  })

  .get('/api/themes/default', ({ set }) => {
    try {
      const defaultTheme = themeManager.getDefaultTheme();
      if (!defaultTheme) {
        set.status = 404;
        return { error: 'No default theme found' };
      }
      return defaultTheme;
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    response: { 200: 'theme.list' },
    detail: { tags: ['themes'], summary: 'Get default theme' },
  })

  .get('/api/themes/:id', ({ params, set }) => {
    try {
      const theme = themeManager.getTheme(params.id);
      if (!theme) {
        set.status = 404;
        return { error: 'Theme not found' };
      }
      return theme;
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    response: { 200: 'theme.response', 404: 'common.error' },
    detail: { tags: ['themes'], summary: 'Get theme by ID' },
  })

  .post('/api/themes', async ({ body, set }) => {
    try {
      const theme = await themeManager.saveTheme(body);
      set.status = 201;
      return theme;
    } catch (error) {
      set.status = 400;
      return { error: error.message };
    }
  }, {
    body: 'theme.create',
    response: { 200: 'theme.response', 400: 'common.error' },
    detail: { tags: ['themes'], summary: 'Create new theme' },
  })

  .put('/api/themes/:id', async ({ params, body, set }) => {
    try {
      // Merge ID from params into body
      const themeData = { ...body, id: params.id };
      const theme = await themeManager.saveTheme(themeData);
      return theme;
    } catch (error) {
      set.status = 400;
      return { error: error.message };
    }
  }, {
    body: 'theme.update',
    response: { 200: 'theme.response', 404: 'common.error' },
    detail: { tags: ['themes'], summary: 'Update theme' },
  })

  .delete('/api/themes/:id', async ({ params, set }) => {
    try {
      const deleted = await themeManager.deleteTheme(params.id);
      if (!deleted) {
        set.status = 404;
        return { error: 'Theme not found' };
      }
      return { success: true, message: 'Theme deleted' };
    } catch (error) {
      set.status = 400;
      return { error: error.message };
    }
  }, {
    response: { 200: 'common.success', 404: 'common.error' },
    detail: { tags: ['themes'], summary: 'Delete theme' },
  })

  // Health check endpoint for Cloud Run
  .get('/health', () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      service: 'tv-dashboards'
    };
  }, {
    response: { 200: t.Object({ status: t.String(), timestamp: t.String(), uptime: t.Number() }) },
    detail: { tags: ['health'], summary: 'Health check for Cloud Run' },
  })

  // Performance metrics endpoint
  .get('/api/metrics', () => {
    try {
      return {
        success: true,
        metrics: metricsCollector.getMetrics()
      };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    response: { 200: t.Object({ success: t.Boolean(), metrics: t.Any() }) },
    detail: { tags: ['metrics'], summary: 'Get server performance metrics' },
  })

  // Apply rate limiting
  .use(smartRateLimit)
  .use(proxyRoutes)
  .use(numericsRoutes)
  .use(anyboardRoutes)
  .use(bigQueryRoutes)
  .use(queryRoutes)
  .use(googleOAuthRoutes)

  // Serve React frontend for /app/* routes
  .get('/app*', () => {
    const reactIndexHtml = readFileSync(join(__dirname, '..', 'frontend', 'dist', 'index.html'), 'utf8');
    return new Response(reactIndexHtml, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  });

export { app };

// Only start listening when this file is the entry point (not when imported by tests)
if (import.meta.main) {
  app.listen({ port: PORT, hostname: HOST });
  logger.info(`Dashboard server running at http://${HOST}:${PORT}`);
  logger.info('Config loaded from config/dashboards.yaml');
  logger.info({ dataMode: LIVE ? 'LIVE' : 'MOCK' }, 'Data mode configured');
  logger.info(`Numerics widgets: http://${HOST}:${PORT}/api/numerics/<widget>`);
  logger.info(`AnyBoard config: http://${HOST}:${PORT}/api/anyboard/config.json`);
}
