// ===========================================================================
// Integration: Data Source Configuration API
// Tests the 5 new API endpoints for data source configuration management
// ===========================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createTestApp, createTestRequest, createJsonPutRequest, createJsonPostRequest, assertResponse } from '../helpers/test-app.js';
import { getDatabase, initDatabase } from '../../server/db.js';
import { updateConfig, toggleEnabled, getConfig, getAuditLog, exportConfigs } from '../../server/data-source-config.js';

describe('Integration: Data Source Configuration API', () => {
  let app;
  let db;

  beforeAll(() => {
    // Initialize test database
    initDatabase(':memory:');
    db = getDatabase();

    // Create test app
    app = createTestApp();

    // GET /api/data-sources/:name/config
    app.get('/api/data-sources/:name/config', ({ params }) => {
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
    });

    // PUT /api/data-sources/:name/config
    app.put('/api/data-sources/:name/config', async ({ params, body }) => {
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
    });

    // POST /api/data-sources/:name/toggle
    app.post('/api/data-sources/:name/toggle', async ({ params, body }) => {
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
    });

    // GET /api/data-sources/:name/history
    app.get('/api/data-sources/:name/history', ({ params, query }) => {
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
    });

    // GET /api/data-sources/export
    app.get('/api/data-sources/export', () => {
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
    });
  });

  beforeEach(() => {
    // Clear database before each test
    db.run('DELETE FROM data_source_configs');
    db.run('DELETE FROM config_audit_log');
  });

  afterAll(() => {
    // Cleanup
    if (db) {
      db.close();
    }
  });

  describe('GET /api/data-sources/:name/config', () => {
    it('should return config for existing data source', async () => {
      // Setup: Create a config
      updateConfig('gcp', { projectId: 'test-project' }, 'admin@madhive.com');

      const response = await app.handle(createTestRequest('/api/data-sources/gcp/config'));
      const data = await assertResponse.assertSuccess(response);

      expect(data.enabled).toBe(true);
      expect(data.config).toEqual({ projectId: 'test-project' });
      expect(data.updatedAt).toBeTruthy();
      expect(data.updatedBy).toBe('admin@madhive.com');
    });

    it('should return 404 for non-existent data source', async () => {
      const response = await app.handle(createTestRequest('/api/data-sources/nonexistent/config'));
      const data = await assertResponse.assertError(response, 404);

      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
  });

  describe('PUT /api/data-sources/:name/config', () => {
    it('should create new config for data source', async () => {
      const config = {
        region: 'us-east-1',
        bucket: 'my-bucket'
      };

      const response = await app.handle(
        createJsonPutRequest('/api/data-sources/aws/config', config)
      );
      const data = await assertResponse.assertSuccess(response);

      expect(data.enabled).toBe(true);
      expect(data.config).toEqual(config);
      expect(data.updatedBy).toBe('system@madhive.com');
    });

    it('should update existing config for data source', async () => {
      // Setup: Create initial config
      updateConfig('gcp', { projectId: 'project-1' }, 'admin@madhive.com');

      // Update config
      const newConfig = { projectId: 'project-2', region: 'us-central1' };
      const response = await app.handle(
        createJsonPutRequest('/api/data-sources/gcp/config', newConfig)
      );
      const data = await assertResponse.assertSuccess(response);

      expect(data.config).toEqual(newConfig);
      expect(data.updatedBy).toBe('system@madhive.com');
    });

    it('should reject config with sensitive fields', async () => {
      const config = {
        apiKey: 'secret-key',
        region: 'us-east-1'
      };

      const response = await app.handle(
        createJsonPutRequest('/api/data-sources/aws/config', config)
      );
      const data = await assertResponse.assertError(response, 400);

      expect(data.error).toContain('Sensitive');
    });

    it('should reject config with password field', async () => {
      const config = {
        username: 'admin',
        password: 'secret123'
      };

      const response = await app.handle(
        createJsonPutRequest('/api/data-sources/db/config', config)
      );
      const data = await assertResponse.assertError(response, 400);

      expect(data.error).toContain('Sensitive');
    });

    it('should reject config with token field', async () => {
      const config = {
        apiToken: 'bearer-token',
        endpoint: 'https://api.example.com'
      };

      const response = await app.handle(
        createJsonPutRequest('/api/data-sources/api/config', config)
      );
      const data = await assertResponse.assertError(response, 400);

      expect(data.error).toContain('Sensitive');
    });
  });

  describe('POST /api/data-sources/:name/toggle', () => {
    it('should enable data source', async () => {
      // Setup: Create disabled config
      updateConfig('gcp', { projectId: 'test' }, 'admin@madhive.com');
      toggleEnabled('gcp', false, 'admin@madhive.com');

      // Enable it
      const response = await app.handle(
        createJsonPostRequest('/api/data-sources/gcp/toggle', { enabled: true })
      );
      const data = await assertResponse.assertSuccess(response);

      expect(data.enabled).toBe(true);
      expect(data.config).toEqual({ projectId: 'test' });
    });

    it('should disable data source', async () => {
      // Setup: Create enabled config
      updateConfig('gcp', { projectId: 'test' }, 'admin@madhive.com');

      // Disable it
      const response = await app.handle(
        createJsonPostRequest('/api/data-sources/gcp/toggle', { enabled: false })
      );
      const data = await assertResponse.assertSuccess(response);

      expect(data.enabled).toBe(false);
    });

    it('should reject invalid enabled value (non-boolean)', async () => {
      const response = await app.handle(
        createJsonPostRequest('/api/data-sources/gcp/toggle', { enabled: 'true' })
      );
      const data = await assertResponse.assertError(response, 400);

      expect(data.error).toContain('boolean');
    });

    it('should reject missing enabled field', async () => {
      const response = await app.handle(
        createJsonPostRequest('/api/data-sources/gcp/toggle', {})
      );
      const data = await assertResponse.assertError(response, 400);

      expect(data.error).toContain('boolean');
    });

    it('should fail when toggling non-existent data source', async () => {
      const response = await app.handle(
        createJsonPostRequest('/api/data-sources/newds/toggle', { enabled: true })
      );
      const data = await assertResponse.assertError(response, 500);

      expect(data.error).toContain('does not exist');
    });
  });

  describe('GET /api/data-sources/:name/history', () => {
    it('should return audit log for data source', async () => {
      // Setup: Create some history
      updateConfig('gcp', { projectId: 'v1' }, 'user1@madhive.com');
      updateConfig('gcp', { projectId: 'v2' }, 'user2@madhive.com');
      toggleEnabled('gcp', false, 'user3@madhive.com');

      const response = await app.handle(
        createTestRequest('/api/data-sources/gcp/history')
      );
      const data = await assertResponse.assertSuccess(response);

      expect(data.history).toBeArray();
      expect(data.history.length).toBe(3);

      // Check that we have the right actions (order may vary due to timestamps)
      const actions = data.history.map(h => h.action);
      expect(actions).toContain('disable'); // toggleEnabled(false) creates "disable" action
      expect(actions).toContain('update');
      expect(actions).toContain('create');

      // Check users are correct
      const users = data.history.map(h => h.userEmail);
      expect(users).toContain('user1@madhive.com');
      expect(users).toContain('user2@madhive.com');
      expect(users).toContain('user3@madhive.com');
    });

    it('should respect limit parameter', async () => {
      // Setup: Create 10 history entries
      for (let i = 0; i < 10; i++) {
        updateConfig('gcp', { version: i }, `user${i}@madhive.com`);
      }

      const response = await app.handle(
        createTestRequest('/api/data-sources/gcp/history?limit=5')
      );
      const data = await assertResponse.assertSuccess(response);

      expect(data.history).toBeArray();
      expect(data.history.length).toBe(5);
    });

    it('should return empty array for non-existent data source', async () => {
      const response = await app.handle(
        createTestRequest('/api/data-sources/nonexistent/history')
      );
      const data = await assertResponse.assertSuccess(response);

      expect(data.history).toBeArray();
      expect(data.history.length).toBe(0);
    });

    it('should default to 50 limit when not specified', async () => {
      // Setup: Create 60 history entries
      for (let i = 0; i < 60; i++) {
        updateConfig('gcp', { version: i }, `user@madhive.com`);
      }

      const response = await app.handle(
        createTestRequest('/api/data-sources/gcp/history')
      );
      const data = await assertResponse.assertSuccess(response);

      expect(data.history).toBeArray();
      expect(data.history.length).toBe(50);
    });
  });

  describe('GET /api/data-sources/export', () => {
    it('should export all data source configs', async () => {
      // Setup: Create multiple configs
      updateConfig('gcp', { projectId: 'gcp-project' }, 'admin@madhive.com');
      updateConfig('aws', { region: 'us-east-1' }, 'admin@madhive.com');
      updateConfig('datadog', { apiHost: 'api.datadoghq.com' }, 'admin@madhive.com');

      const response = await app.handle(
        createTestRequest('/api/data-sources/export')
      );
      const data = await assertResponse.assertSuccess(response);

      expect(data.configs).toBeObject();
      expect(Object.keys(data.configs)).toHaveLength(3);
      expect(data.configs.gcp.config).toEqual({ projectId: 'gcp-project' });
      expect(data.configs.gcp.enabled).toBeDefined();
      expect(data.configs.aws.config).toEqual({ region: 'us-east-1' });
      expect(data.configs.datadog.config).toEqual({ apiHost: 'api.datadoghq.com' });
    });

    it('should return empty object when no configs exist', async () => {
      const response = await app.handle(
        createTestRequest('/api/data-sources/export')
      );
      const data = await assertResponse.assertSuccess(response);

      expect(data.configs).toBeObject();
      expect(Object.keys(data.configs)).toHaveLength(0);
    });

    it('should export all configs including disabled ones', async () => {
      // Setup: Create configs with different enabled states
      updateConfig('gcp', { projectId: 'gcp-project' }, 'admin@madhive.com');
      updateConfig('aws', { region: 'us-east-1' }, 'admin@madhive.com');
      toggleEnabled('aws', false, 'admin@madhive.com');

      const response = await app.handle(
        createTestRequest('/api/data-sources/export')
      );
      const data = await assertResponse.assertSuccess(response);

      expect(data.configs).toBeObject();
      expect(Object.keys(data.configs)).toHaveLength(2);
      expect(data.configs.gcp.enabled).toBeDefined();
      expect(data.configs.aws.enabled).toBe(0); // Disabled
    });
  });
});
