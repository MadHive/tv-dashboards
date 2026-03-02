// ===========================================================================
// Drizzle Schema Tests — Verify schema definitions match existing database
// ===========================================================================

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { dataSourceConfigs, configAuditLog } from '../../server/db/schema.js';
import { initDatabase, closeDatabase } from '../../server/db.js';
import { getDrizzle, resetDrizzle } from '../../server/db/index.js';
import { join } from 'path';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';

describe('Drizzle Schema Definitions', () => {
  describe('dataSourceConfigs table', () => {
    it('should map to the correct table name', () => {
      expect(getTableName(dataSourceConfigs)).toBe('data_source_configs');
    });

    it('should have sourceName as primary key column', () => {
      const columns = getTableColumns(dataSourceConfigs);
      expect(columns.sourceName).toBeDefined();
      expect(columns.sourceName.primary).toBe(true);
    });

    it('should have enabled column with boolean mode', () => {
      const columns = getTableColumns(dataSourceConfigs);
      expect(columns.enabled).toBeDefined();
      expect(columns.enabled.mode).toBe('boolean');
    });

    it('should have configJson, updatedAt, updatedBy text columns', () => {
      const columns = getTableColumns(dataSourceConfigs);
      expect(columns.configJson).toBeDefined();
      expect(columns.updatedAt).toBeDefined();
      expect(columns.updatedBy).toBeDefined();
    });
  });

  describe('configAuditLog table', () => {
    it('should map to the correct table name', () => {
      expect(getTableName(configAuditLog)).toBe('config_audit_log');
    });

    it('should have id as primary key with autoIncrement', () => {
      const columns = getTableColumns(configAuditLog);
      expect(columns.id).toBeDefined();
      expect(columns.id.primary).toBe(true);
      expect(columns.id.autoIncrement).toBe(true);
    });

    it('should have all required text columns', () => {
      const columns = getTableColumns(configAuditLog);
      expect(columns.sourceName).toBeDefined();
      expect(columns.action).toBeDefined();
      expect(columns.changesJson).toBeDefined();
      expect(columns.userEmail).toBeDefined();
      expect(columns.timestamp).toBeDefined();
    });
  });
});

const TEST_DB_PATH = join(process.cwd(), 'data', 'test-drizzle-instance.db');

describe('Drizzle Instance', () => {
  beforeAll(() => {
    resetDrizzle();
    initDatabase(TEST_DB_PATH);
  });

  afterAll(async () => {
    resetDrizzle();
    closeDatabase();
    for (const ext of ['', '-shm', '-wal']) {
      const p = TEST_DB_PATH + ext;
      if (existsSync(p)) await unlink(p);
    }
  });

  it('should return a Drizzle instance with select capability', () => {
    const db = getDrizzle();
    expect(db).toBeDefined();
    expect(typeof db.select).toBe('function');
  });

  it('should return a Drizzle instance with insert capability', () => {
    const db = getDrizzle();
    expect(typeof db.insert).toBe('function');
  });

  it('should return a Drizzle instance with transaction capability', () => {
    const db = getDrizzle();
    expect(typeof db.transaction).toBe('function');
  });

  it('should query the data_source_configs table without error', () => {
    const db = getDrizzle();
    const rows = db.select().from(dataSourceConfigs).all();
    expect(Array.isArray(rows)).toBe(true);
  });
});
