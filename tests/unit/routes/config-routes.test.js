// ===========================================================================
// Config Routes Tests — Following Elysia.js Testing Patterns
// Uses .handle() method for unit testing without network overhead
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, unlinkSync, writeFileSync, readFileSync } from 'fs';
import { dump } from 'js-yaml';
import {
  createTestRequest,
  createJsonPostRequest,
  assertResponse
} from '../../helpers/test-app.js';
import { testConfig, testDashboard } from '../../helpers/fixtures.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_CONFIG_PATH = join(__dirname, '../../../config/dashboards.test.yaml');
const BACKUP_DIR = join(__dirname, '../../../config');

describe('Config Routes (Elysia Unit Tests)', () => {
  let app;
  let originalConfigPath;

  beforeEach(() => {
    // Create a test app instance with config routes
    // In a real implementation, you would import and use the actual routes
    app = new Elysia()
      .get('/api/config', ({ store }) => {
        // Mock implementation - real app would use loadConfig()
        return {
          dashboards: [testDashboard],
          dataMode: process.env.USE_REAL_DATA === 'true' ? 'LIVE' : 'MOCK'
        };
      })
      .post('/api/config', async ({ body }) => {
        try {
          // Mock implementation - real app would use saveConfig()
          if (!body.dashboards || !Array.isArray(body.dashboards)) {
            throw new Error('Invalid configuration: dashboards array required');
          }

          // Simulate backup creation
          const backupPath = join(BACKUP_DIR, `dashboards.yaml.backup.${Date.now()}`);

          return { success: true, message: 'Configuration saved' };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }
      });
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(TEST_CONFIG_PATH)) {
      unlinkSync(TEST_CONFIG_PATH);
    }

    // Clean up test backups
    const fs = require('fs');
    const backupFiles = fs
      .readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('dashboards.yaml.backup.test-'));

    backupFiles.forEach(file => {
      try {
        unlinkSync(join(BACKUP_DIR, file));
      } catch (err) {
        // Ignore cleanup errors
      }
    });
  });

  describe('GET /api/config', () => {
    it('should return dashboard configuration', async () => {
      const request = createTestRequest('/api/config');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toBeObject();
      expect(data.dashboards).toBeArray();
    });

    it('should include dataMode metadata', async () => {
      const request = createTestRequest('/api/config');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.dataMode).toBeDefined();
      expect(['LIVE', 'MOCK']).toContain(data.dataMode);
    });

    it('should return valid dashboard structure', async () => {
      const request = createTestRequest('/api/config');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.dashboards).toBeArray();

      if (data.dashboards.length > 0) {
        const dashboard = data.dashboards[0];
        expect(dashboard.id).toBeDefined();
        expect(dashboard.name).toBeDefined();
        expect(dashboard.grid).toBeObject();
        expect(dashboard.widgets).toBeArray();
      }
    });
  });

  describe('POST /api/config', () => {
    it('should save valid configuration', async () => {
      const configData = {
        dashboards: [testDashboard]
      };

      const request = createJsonPostRequest('/api/config', configData);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('saved');
    });

    it('should return 400 when dashboards array is missing', async () => {
      const invalidConfig = {
        // Missing dashboards array
        someOtherField: 'value'
      };

      const request = createJsonPostRequest('/api/config', invalidConfig);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error).toContain('dashboards');
    });

    it('should return 400 when dashboards is not an array', async () => {
      const invalidConfig = {
        dashboards: 'not-an-array'
      };

      const request = createJsonPostRequest('/api/config', invalidConfig);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should handle malformed JSON gracefully', async () => {
      const request = createTestRequest('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}'
      });

      const response = await app.handle(request);

      // Elysia should handle this gracefully with 4xx error
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty dashboards array', async () => {
      const configData = {
        dashboards: []
      };

      const request = createJsonPostRequest('/api/config', configData);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should handle configuration with multiple dashboards', async () => {
      const configData = {
        dashboards: [
          testDashboard,
          {
            id: 'dashboard-2',
            name: 'Dashboard 2',
            grid: { columns: 4, rows: 3, gap: 14 },
            widgets: []
          }
        ]
      };

      const request = createJsonPostRequest('/api/config', configData);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});
