// ===========================================================================
// Data Source Configuration Tests — Verify config management and validation
// ===========================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// Import the database module
import { initDatabase, getDatabase, closeDatabase } from '../../server/db.js';

// Import the data-source-config module (will be created)
import {
  getConfig,
  updateConfig,
  toggleEnabled,
  getAuditLog,
  exportConfigs,
} from '../../server/data-source-config.js';

const TEST_DB_PATH = join(process.cwd(), 'data', 'test-data-source-config.db');

describe('Data Source Configuration', () => {
  beforeAll(() => {
    // Initialize database once for all tests
    initDatabase(TEST_DB_PATH);
  });

  beforeEach(() => {
    // Clear data between tests
    const db = getDatabase();
    db.query('DELETE FROM data_source_configs').run();
    db.query('DELETE FROM config_audit_log').run();
  });

  afterAll(async () => {
    // Clean up test database after all tests
    closeDatabase();
    if (existsSync(TEST_DB_PATH)) {
      await unlink(TEST_DB_PATH);
    }
    if (existsSync(`${TEST_DB_PATH}-shm`)) {
      await unlink(`${TEST_DB_PATH}-shm`);
    }
    if (existsSync(`${TEST_DB_PATH}-wal`)) {
      await unlink(`${TEST_DB_PATH}-wal`);
    }
  });

  describe('getConfig', () => {
    it('should return null for non-existent source', () => {
      const result = getConfig('non-existent');
      expect(result).toBeNull();
    });

    it('should return config for existing source', () => {
      const db = getDatabase();
      db.query(
        'INSERT INTO data_source_configs (source_name, enabled, config_json, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)'
      ).run('gcp', 1, '{"region": "us-east1"}', new Date().toISOString(), 'test@example.com');

      const result = getConfig('gcp');
      expect(result).toBeDefined();
      expect(result.enabled).toBe(1);
      expect(result.config).toEqual({ region: 'us-east1' });
      expect(result.updatedAt).toBeDefined();
      expect(result.updatedBy).toBe('test@example.com');
    });

    it('should parse JSON config correctly', () => {
      const db = getDatabase();
      const complexConfig = {
        region: 'us-east1',
        projectId: 'test-project',
        options: { timeout: 5000 },
      };
      db.query(
        'INSERT INTO data_source_configs (source_name, enabled, config_json, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)'
      ).run('gcp', 1, JSON.stringify(complexConfig), new Date().toISOString(), 'test@example.com');

      const result = getConfig('gcp');
      expect(result.config).toEqual(complexConfig);
    });

    it('should handle null config_json', () => {
      const db = getDatabase();
      db.query(
        'INSERT INTO data_source_configs (source_name, enabled, config_json, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)'
      ).run('gcp', 1, null, new Date().toISOString(), 'test@example.com');

      const result = getConfig('gcp');
      expect(result.config).toBeNull();
    });
  });

  describe('updateConfig - Input Validation', () => {
    it('should reject empty source name', () => {
      expect(() => {
        updateConfig('', { region: 'us-east1' }, 'test@example.com');
      }).toThrow(/invalid source name/i);
    });

    it('should reject source name with special characters', () => {
      expect(() => {
        updateConfig('gcp@prod', { region: 'us-east1' }, 'test@example.com');
      }).toThrow(/invalid source name/i);
    });

    it('should reject source name with spaces', () => {
      expect(() => {
        updateConfig('gcp prod', { region: 'us-east1' }, 'test@example.com');
      }).toThrow(/invalid source name/i);
    });

    it('should reject source name longer than 64 characters', () => {
      expect(() => {
        updateConfig('a'.repeat(65), { region: 'us-east1' }, 'test@example.com');
      }).toThrow(/invalid source name/i);
    });

    it('should accept valid source name with hyphens', () => {
      expect(() => {
        updateConfig('gcp-prod', { region: 'us-east1' }, 'test@example.com');
      }).not.toThrow();
    });

    it('should accept valid source name with underscores', () => {
      expect(() => {
        updateConfig('gcp_prod', { region: 'us-east1' }, 'test@example.com');
      }).not.toThrow();
    });

    it('should accept valid source name with numbers', () => {
      expect(() => {
        updateConfig('gcp123', { region: 'us-east1' }, 'test@example.com');
      }).not.toThrow();
    });
  });

  describe('updateConfig - Sensitive Field Validation', () => {
    it('should reject config with apiKey field', () => {
      expect(() => {
        updateConfig('aws', { apiKey: 'secret123' }, 'test@example.com');
      }).toThrow(/sensitive.*apiKey/i);
    });

    it('should reject config with field ending in "key"', () => {
      expect(() => {
        updateConfig('aws', { accessKey: 'secret123' }, 'test@example.com');
      }).toThrow(/sensitive.*accessKey/i);
    });

    it('should reject config with field ending in "Key" (case insensitive)', () => {
      expect(() => {
        updateConfig('aws', { authKey: 'secret123' }, 'test@example.com');
      }).toThrow(/sensitive.*authKey/i);
    });

    it('should reject config with field ending in "token"', () => {
      expect(() => {
        updateConfig('datadog', { apiToken: 'secret123' }, 'test@example.com');
      }).toThrow(/sensitive.*apiToken/i);
    });

    it('should reject config with field ending in "Token" (case insensitive)', () => {
      expect(() => {
        updateConfig('datadog', { accessToken: 'secret123' }, 'test@example.com');
      }).toThrow(/sensitive.*accessToken/i);
    });

    it('should reject config with field ending in "password"', () => {
      expect(() => {
        updateConfig('elasticsearch', { dbPassword: 'secret123' }, 'test@example.com');
      }).toThrow(/sensitive.*dbPassword/i);
    });

    it('should reject config with field ending in "Password" (case insensitive)', () => {
      expect(() => {
        updateConfig('elasticsearch', { userPassword: 'secret123' }, 'test@example.com');
      }).toThrow(/sensitive.*userPassword/i);
    });

    it('should reject config with field ending in "secret"', () => {
      expect(() => {
        updateConfig('aws', { clientSecret: 'secret123' }, 'test@example.com');
      }).toThrow(/sensitive.*clientSecret/i);
    });

    it('should reject config with field ending in "Secret" (case insensitive)', () => {
      expect(() => {
        updateConfig('aws', { appSecret: 'secret123' }, 'test@example.com');
      }).toThrow(/sensitive.*appSecret/i);
    });

    it('should reject config with field containing "credential"', () => {
      expect(() => {
        updateConfig('gcp', { credentials: 'secret123' }, 'test@example.com');
      }).toThrow(/sensitive.*credentials/i);
    });

    it('should reject config with field containing "Credential" (case insensitive)', () => {
      expect(() => {
        updateConfig('gcp', { serviceCredential: 'secret123' }, 'test@example.com');
      }).toThrow(/sensitive.*serviceCredential/i);
    });

    it('should reject config with nested sensitive fields', () => {
      expect(() => {
        updateConfig('aws', {
          region: 'us-east-1',
          auth: {
            apiKey: 'secret123',
          },
        }, 'test@example.com');
      }).toThrow(/sensitive.*apiKey/i);
    });

    it('should reject config with deeply nested sensitive fields', () => {
      expect(() => {
        updateConfig('aws', {
          region: 'us-east-1',
          settings: {
            auth: {
              credentials: {
                accessToken: 'secret123',
              },
            },
          },
        }, 'test@example.com');
      }).toThrow(/sensitive.*(credentials|accessToken)/i);
    });

    it('should accept config with allowed fields', () => {
      expect(() => {
        updateConfig('gcp', {
          region: 'us-east1',
          projectId: 'test-project',
          timeout: 5000,
        }, 'test@example.com');
      }).not.toThrow();
    });

    it('should accept config with fields containing "key" but not ending with it', () => {
      expect(() => {
        updateConfig('gcp', {
          keyboard: 'qwerty',
          keystone: 'value',
        }, 'test@example.com');
      }).not.toThrow();
    });
  });

  describe('updateConfig - Database Operations', () => {
    it('should insert new config', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');

      const result = getConfig('gcp');
      expect(result).toBeDefined();
      expect(result.enabled).toBe(1);
      expect(result.config).toEqual({ region: 'us-east1' });
      expect(result.updatedBy).toBe('test@example.com');
    });

    it('should update existing config', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'user1@example.com');
      updateConfig('gcp', { region: 'us-west1', projectId: 'new-project' }, 'user2@example.com');

      const result = getConfig('gcp');
      expect(result.config).toEqual({ region: 'us-west1', projectId: 'new-project' });
      expect(result.updatedBy).toBe('user2@example.com');
    });

    it('should preserve enabled status when updating config', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');
      toggleEnabled('gcp', false, 'test@example.com');
      updateConfig('gcp', { region: 'us-west1' }, 'test@example.com');

      const result = getConfig('gcp');
      expect(result.enabled).toBe(0);
    });

    it('should set updatedAt timestamp', () => {
      const beforeUpdate = new Date();
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');
      const afterUpdate = new Date();

      const result = getConfig('gcp');
      const updatedAt = new Date(result.updatedAt);
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
      expect(updatedAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    });
  });

  describe('updateConfig - Audit Logging', () => {
    it('should create audit log on insert', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');

      const logs = getAuditLog('gcp', 10);
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('create');
      expect(logs[0].userEmail).toBe('test@example.com');
      expect(logs[0].changes.config).toEqual({ region: 'us-east1' });
    });

    it('should create audit log on update', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'user1@example.com');
      updateConfig('gcp', { region: 'us-west1' }, 'user2@example.com');

      const logs = getAuditLog('gcp', 10);
      expect(logs.length).toBe(2);
      expect(logs[0].action).toBe('update'); // Most recent first
      expect(logs[0].userEmail).toBe('user2@example.com');
      expect(logs[0].changes.config).toEqual({ region: 'us-west1' });
    });

    it('should include timestamp in audit log', () => {
      const beforeUpdate = new Date();
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');
      const afterUpdate = new Date();

      const logs = getAuditLog('gcp', 10);
      const timestamp = new Date(logs[0].timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    });
  });

  describe('toggleEnabled - Input Validation', () => {
    it('should reject invalid source name', () => {
      expect(() => {
        toggleEnabled('invalid@source', true, 'test@example.com');
      }).toThrow(/invalid source name/i);
    });

    it('should reject non-boolean enabled value', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');
      expect(() => {
        toggleEnabled('gcp', 'true', 'test@example.com');
      }).toThrow(/invalid enabled value.*boolean/i);
    });

    it('should reject non-boolean number as enabled value', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');
      expect(() => {
        toggleEnabled('gcp', 1, 'test@example.com');
      }).toThrow(/invalid enabled value.*boolean/i);
    });
  });

  describe('toggleEnabled', () => {
    it('should enable a data source', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');
      toggleEnabled('gcp', false, 'admin@example.com');
      toggleEnabled('gcp', true, 'admin@example.com');

      const result = getConfig('gcp');
      expect(result.enabled).toBe(1);
    });

    it('should disable a data source', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');
      toggleEnabled('gcp', false, 'admin@example.com');

      const result = getConfig('gcp');
      expect(result.enabled).toBe(0);
    });

    it('should create audit log when enabling', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');
      toggleEnabled('gcp', false, 'admin@example.com');
      toggleEnabled('gcp', true, 'admin@example.com');

      const logs = getAuditLog('gcp', 10);
      const enableLog = logs.find(log => log.action === 'enable');
      expect(enableLog).toBeDefined();
      expect(enableLog.userEmail).toBe('admin@example.com');
    });

    it('should create audit log when disabling', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');
      toggleEnabled('gcp', false, 'admin@example.com');

      const logs = getAuditLog('gcp', 10);
      const disableLog = logs.find(log => log.action === 'disable');
      expect(disableLog).toBeDefined();
      expect(disableLog.userEmail).toBe('admin@example.com');
    });

    it('should update updatedAt timestamp', async () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');
      const config1 = getConfig('gcp');

      // Small delay to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      toggleEnabled('gcp', false, 'admin@example.com');
      const config2 = getConfig('gcp');

      expect(config2.updatedAt).not.toBe(config1.updatedAt);
    });

    it('should update updatedBy', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');
      toggleEnabled('gcp', false, 'admin@example.com');

      const result = getConfig('gcp');
      expect(result.updatedBy).toBe('admin@example.com');
    });

    it('should throw error for non-existent source', () => {
      expect(() => {
        toggleEnabled('non-existent', true, 'test@example.com');
      }).toThrow();
    });
  });

  describe('getAuditLog - Input Validation', () => {
    it('should reject negative limit', () => {
      expect(() => {
        getAuditLog('gcp', -1);
      }).toThrow(/invalid limit.*positive integer/i);
    });

    it('should reject zero limit', () => {
      expect(() => {
        getAuditLog('gcp', 0);
      }).toThrow(/invalid limit.*positive integer/i);
    });

    it('should reject non-numeric limit', () => {
      expect(() => {
        getAuditLog('gcp', 'invalid');
      }).toThrow(/invalid limit.*positive integer/i);
    });

    it('should accept string numeric limit', () => {
      expect(() => {
        getAuditLog('gcp', '10');
      }).not.toThrow();
    });
  });

  describe('getAuditLog', () => {
    it('should return empty array for source with no history', () => {
      const logs = getAuditLog('non-existent', 10);
      expect(logs).toEqual([]);
    });

    it('should return audit logs in descending timestamp order', async () => {
      updateConfig('gcp', { region: 'us-east1' }, 'user1@example.com');
      await new Promise(resolve => setTimeout(resolve, 5));
      updateConfig('gcp', { region: 'us-west1' }, 'user2@example.com');
      await new Promise(resolve => setTimeout(resolve, 5));
      updateConfig('gcp', { region: 'eu-west1' }, 'user3@example.com');

      const logs = getAuditLog('gcp', 10);
      expect(logs.length).toBe(3);
      expect(logs[0].userEmail).toBe('user3@example.com');
      expect(logs[1].userEmail).toBe('user2@example.com');
      expect(logs[2].userEmail).toBe('user1@example.com');
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        updateConfig('gcp', { region: `region-${i}` }, `user${i}@example.com`);
      }

      const logs = getAuditLog('gcp', 5);
      expect(logs.length).toBe(5);
    });

    it('should default to 50 logs', () => {
      // Create 60 audit logs
      for (let i = 0; i < 60; i++) {
        updateConfig('gcp', { region: `region-${i}` }, `user${i}@example.com`);
      }

      const logs = getAuditLog('gcp');
      expect(logs.length).toBe(50);
    });

    it('should return logs only for specified source', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');
      updateConfig('aws', { region: 'us-west1' }, 'test@example.com');
      updateConfig('datadog', { site: 'datadoghq.com' }, 'test@example.com');

      const gcpLogs = getAuditLog('gcp', 10);
      expect(gcpLogs.length).toBe(1);
      expect(gcpLogs[0].sourceName).toBe('gcp');
    });

    it('should parse changes JSON correctly', () => {
      updateConfig('gcp', { region: 'us-east1', projectId: 'test' }, 'test@example.com');

      const logs = getAuditLog('gcp', 10);
      expect(logs[0].changes).toEqual({
        config: { region: 'us-east1', projectId: 'test' },
      });
    });

    it('should include all required fields', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');

      const logs = getAuditLog('gcp', 10);
      expect(logs[0]).toHaveProperty('id');
      expect(logs[0]).toHaveProperty('sourceName');
      expect(logs[0]).toHaveProperty('action');
      expect(logs[0]).toHaveProperty('changes');
      expect(logs[0]).toHaveProperty('userEmail');
      expect(logs[0]).toHaveProperty('timestamp');
    });
  });

  describe('exportConfigs', () => {
    it('should return empty object when no configs exist', () => {
      const result = exportConfigs();
      expect(result).toEqual({});
    });

    it('should export single config', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');

      const result = exportConfigs();
      expect(result).toHaveProperty('gcp');
      expect(result.gcp.config).toEqual({ region: 'us-east1' });
      expect(result.gcp.enabled).toBe(1);
    });

    it('should export multiple configs', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');
      updateConfig('aws', { region: 'us-west1' }, 'test@example.com');
      updateConfig('datadog', { site: 'datadoghq.com' }, 'test@example.com');

      const result = exportConfigs();
      expect(Object.keys(result)).toHaveLength(3);
      expect(result).toHaveProperty('gcp');
      expect(result).toHaveProperty('aws');
      expect(result).toHaveProperty('datadog');
    });

    it('should include enabled status', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');
      toggleEnabled('gcp', false, 'admin@example.com');

      const result = exportConfigs();
      expect(result.gcp.enabled).toBe(0);
    });

    it('should include updatedAt and updatedBy', () => {
      updateConfig('gcp', { region: 'us-east1' }, 'test@example.com');

      const result = exportConfigs();
      expect(result.gcp.updatedAt).toBeDefined();
      expect(result.gcp.updatedBy).toBe('test@example.com');
    });

    it('should parse config JSON correctly', () => {
      updateConfig('gcp', {
        region: 'us-east1',
        projectId: 'test-project',
        options: { timeout: 5000 },
      }, 'test@example.com');

      const result = exportConfigs();
      expect(result.gcp.config).toEqual({
        region: 'us-east1',
        projectId: 'test-project',
        options: { timeout: 5000 },
      });
    });
  });
});
