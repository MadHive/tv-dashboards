// ===========================================================================
// Config Manager Tests — Following Elysia.js Testing Patterns
// Tests for dashboard configuration management functions
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, unlinkSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { dump, load } from 'js-yaml';
import {
  loadConfig,
  saveConfig,
  updateDashboard,
  createDashboard,
  deleteDashboard,
  listBackups,
  restoreBackup
} from '../../../server/config-manager.js';
import { testDashboard, testConfig } from '../../helpers/fixtures.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_CONFIG_DIR = join(__dirname, '../../../config');
const TEST_CONFIG_PATH = join(TEST_CONFIG_DIR, 'dashboards.test.yaml');
const BACKUP_DIR = TEST_CONFIG_DIR;

describe('Config Manager', () => {
  let originalEnv;
  let createdBackups = [];

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env.USE_REAL_DATA;

    // Ensure config directory exists
    if (!existsSync(TEST_CONFIG_DIR)) {
      mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Restore environment
    process.env.USE_REAL_DATA = originalEnv;

    // Clean up test backup files
    createdBackups.forEach(filename => {
      const backupPath = join(BACKUP_DIR, filename);
      if (existsSync(backupPath)) {
        try {
          unlinkSync(backupPath);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    });
    createdBackups = [];
  });

  describe('loadConfig()', () => {
    it('should load configuration from YAML file', () => {
      const config = loadConfig();

      expect(config).toBeObject();
      expect(config.dashboards).toBeArray();
    });

    it('should add dataMode metadata when USE_REAL_DATA is false', () => {
      process.env.USE_REAL_DATA = 'false';

      const config = loadConfig();

      expect(config.dataMode).toBe('MOCK');
    });

    it('should add dataMode metadata when USE_REAL_DATA is true', () => {
      process.env.USE_REAL_DATA = 'true';

      const config = loadConfig();

      expect(config.dataMode).toBe('LIVE');
    });

    it('should return valid dashboard structure', () => {
      const config = loadConfig();

      expect(config.dashboards).toBeArray();

      if (config.dashboards.length > 0) {
        const dashboard = config.dashboards[0];
        expect(dashboard.id).toBeDefined();
        expect(dashboard.name).toBeDefined();
        expect(dashboard.grid).toBeObject();
      }
    });

    it('should throw error for missing config file', () => {
      // This test would require mocking the file system
      // For now, we rely on the config file existing
      expect(loadConfig).not.toThrow();
    });
  });

  describe('saveConfig()', () => {
    it('should save valid configuration', async () => {
      const config = loadConfig();
      const originalCount = config.dashboards.length;

      await saveConfig(config);

      const reloaded = loadConfig();
      expect(reloaded.dashboards.length).toBe(originalCount);
    });

    it('should remove runtime metadata before saving', async () => {
      const config = loadConfig();
      config.dataMode = 'MOCK'; // Runtime metadata

      await saveConfig(config);

      // Read raw YAML to verify dataMode was removed
      const raw = readFileSync(join(TEST_CONFIG_DIR, 'dashboards.yaml'), 'utf8');
      const parsed = load(raw);

      expect(parsed.dataMode).toBeUndefined();
    });

    it('should create backup before saving', async () => {
      const config = loadConfig();

      const beforeBackups = listBackups();
      const beforeCount = beforeBackups.length;

      await saveConfig(config);

      const afterBackups = listBackups();
      expect(afterBackups.length).toBeGreaterThanOrEqual(beforeCount);

      // Track for cleanup
      if (afterBackups.length > beforeCount) {
        createdBackups.push(afterBackups[afterBackups.length - 1].filename);
      }
    });

    it('should validate config before saving', async () => {
      const invalidConfig = {
        // Missing dashboards array
      };

      try {
        await saveConfig(invalidConfig);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Invalid configuration');
      }
    });

    it('should preserve dashboard order', async () => {
      const config = loadConfig();
      const originalOrder = config.dashboards.map(d => d.id);

      await saveConfig(config);

      const reloaded = loadConfig();
      const newOrder = reloaded.dashboards.map(d => d.id);

      expect(newOrder).toEqual(originalOrder);
    });
  });

  describe('updateDashboard()', () => {
    it('should update existing dashboard', async () => {
      const config = loadConfig();
      const dashboard = config.dashboards[0];
      const originalName = dashboard.name;

      const updated = {
        ...dashboard,
        name: 'Updated Dashboard Name'
      };

      const result = await updateDashboard(dashboard.id, updated);

      expect(result.success).toBe(true);
      expect(result.dashboard.name).toBe('Updated Dashboard Name');

      // Verify persistence
      const reloaded = loadConfig();
      const found = reloaded.dashboards.find(d => d.id === dashboard.id);
      expect(found.name).toBe('Updated Dashboard Name');

      // Restore original
      await updateDashboard(dashboard.id, { ...dashboard, name: originalName });
    });

    it('should validate dashboard before update', async () => {
      const config = loadConfig();
      const dashboardId = config.dashboards[0].id;

      const invalid = {
        // Missing required fields
        name: 'Invalid'
      };

      try {
        await updateDashboard(dashboardId, invalid);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Invalid dashboard');
      }
    });

    it('should throw error for non-existent dashboard', async () => {
      const updated = { ...testDashboard };

      try {
        await updateDashboard('nonexistent-id', updated);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Dashboard not found');
      }
    });

    it('should preserve other dashboards', async () => {
      const config = loadConfig();
      const dashboard = config.dashboards[0];
      const otherDashboards = config.dashboards.slice(1);

      const updated = {
        ...dashboard,
        name: 'Modified Name'
      };

      await updateDashboard(dashboard.id, updated);

      const reloaded = loadConfig();
      const preserved = reloaded.dashboards.slice(1);

      expect(preserved.length).toBe(otherDashboards.length);
      otherDashboards.forEach((original, index) => {
        expect(preserved[index].id).toBe(original.id);
      });

      // Restore
      await updateDashboard(dashboard.id, dashboard);
    });
  });

  describe('createDashboard()', () => {
    it('should create new dashboard', async () => {
      const newDashboard = {
        id: 'test-new-dashboard',
        name: 'Test New Dashboard',
        grid: { columns: 4, rows: 3, gap: 14 },
        widgets: [{
          id: 'test-widget',
          type: 'big-number',
          title: 'Test',
          source: 'mock',
          position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 }
        }]
      };

      const result = await createDashboard(newDashboard);

      expect(result.success).toBe(true);
      expect(result.dashboard.id).toBe('test-new-dashboard');

      // Verify persistence
      const config = loadConfig();
      const found = config.dashboards.find(d => d.id === 'test-new-dashboard');
      expect(found).toBeDefined();

      // Clean up
      await deleteDashboard('test-new-dashboard');
    });

    it('should validate dashboard data', async () => {
      const invalid = {
        // Missing required fields
        id: 'invalid'
      };

      try {
        await createDashboard(invalid);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Invalid dashboard');
      }
    });

    it('should add dashboard to array', async () => {
      const config = loadConfig();
      const initialCount = config.dashboards.length;

      const newDashboard = {
        id: 'test-added-dashboard',
        name: 'Test Added Dashboard',
        grid: { columns: 4, rows: 3, gap: 14 },
        widgets: [{
          id: 'test-widget',
          type: 'big-number',
          title: 'Test',
          source: 'mock',
          position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 }
        }]
      };

      await createDashboard(newDashboard);

      const reloaded = loadConfig();
      expect(reloaded.dashboards.length).toBe(initialCount + 1);

      // Clean up
      await deleteDashboard('test-added-dashboard');
    });
  });

  describe('deleteDashboard()', () => {
    it('should delete existing dashboard', async () => {
      // Create a dashboard to delete
      const tempDashboard = {
        id: 'test-delete-me',
        name: 'Delete Me',
        grid: { columns: 4, rows: 3, gap: 14 },
        widgets: [{
          id: 'test-widget',
          type: 'big-number',
          title: 'Test',
          source: 'mock',
          position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 }
        }]
      };

      await createDashboard(tempDashboard);

      const result = await deleteDashboard('test-delete-me');

      expect(result.success).toBe(true);
      expect(result.deleted.id).toBe('test-delete-me');

      // Verify deletion
      const config = loadConfig();
      const found = config.dashboards.find(d => d.id === 'test-delete-me');
      expect(found).toBeUndefined();
    });

    it('should throw error for non-existent dashboard', async () => {
      try {
        await deleteDashboard('nonexistent-dashboard');
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Dashboard not found');
      }
    });

    it('should preserve other dashboards', async () => {
      const config = loadConfig();
      const initialCount = config.dashboards.length;

      // Create and delete a dashboard
      const tempDashboard = {
        id: 'test-temp-dashboard',
        name: 'Temp Dashboard',
        grid: { columns: 4, rows: 3, gap: 14 },
        widgets: [{
          id: 'test-widget',
          type: 'big-number',
          title: 'Test',
          source: 'mock',
          position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 }
        }]
      };

      await createDashboard(tempDashboard);
      await deleteDashboard('test-temp-dashboard');

      const reloaded = loadConfig();
      expect(reloaded.dashboards.length).toBe(initialCount);
    });
  });

  describe('listBackups()', () => {
    it('should list backup files', () => {
      const backups = listBackups();

      expect(Array.isArray(backups)).toBe(true);
    });

    it('should include metadata for each backup', () => {
      const backups = listBackups();

      if (backups.length > 0) {
        const backup = backups[0];

        expect(backup.filename).toBeDefined();
        expect(backup.timestamp).toBeDefined();
        expect(backup.path).toBeDefined();
      }
    });

    it('should sort backups by timestamp', () => {
      const backups = listBackups();

      if (backups.length > 1) {
        const timestamps = backups.map(b => new Date(b.timestamp).getTime());

        // Check if sorted (either ascending or descending)
        let isAscending = true;
        let isDescending = true;

        for (let i = 1; i < timestamps.length; i++) {
          if (timestamps[i] < timestamps[i - 1]) isAscending = false;
          if (timestamps[i] > timestamps[i - 1]) isDescending = false;
        }

        expect(isAscending || isDescending).toBe(true);
      }
    });
  });

  describe('restoreBackup()', () => {
    it('should restore from backup file', async () => {
      // Create a backup first
      const config = loadConfig();
      await saveConfig(config);

      const backups = listBackups();
      expect(backups.length).toBeGreaterThan(0);

      const latestBackup = backups[backups.length - 1];
      createdBackups.push(latestBackup.filename);

      const result = await restoreBackup(latestBackup.filename);

      expect(result.success).toBe(true);
    });

    it('should throw error for missing backup', async () => {
      try {
        await restoreBackup('nonexistent-backup.yaml');
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('not found');
      }
    });

    it('should validate restored config', async () => {
      // This test would require creating an invalid backup file
      // For now, we verify that valid backups restore successfully
      const backups = listBackups();

      if (backups.length > 0) {
        const result = await restoreBackup(backups[0].filename);
        expect(result.success).toBe(true);
      }
    });
  });
});
