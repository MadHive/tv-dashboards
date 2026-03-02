// ===========================================================================
// Database Tests — Verify SQLite initialization and schema
// ===========================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// Import the database module (will be created)
import { initDatabase, getDatabase, closeDatabase } from '../../server/db.js';

const TEST_DB_PATH = join(process.cwd(), 'data', 'test-tv-dashboards.db');

describe('Database Initialization', () => {
  beforeEach(async () => {
    // Clean up test database before each test
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

  describe('initDatabase', () => {
    it('should create data directory if it does not exist', () => {
      const dataDir = join(process.cwd(), 'data');
      initDatabase(TEST_DB_PATH);
      expect(existsSync(dataDir)).toBe(true);
    });

    it('should create database file', () => {
      initDatabase(TEST_DB_PATH);
      expect(existsSync(TEST_DB_PATH)).toBe(true);
    });

    it('should enable WAL mode', () => {
      const db = initDatabase(TEST_DB_PATH);
      const result = db.query('PRAGMA journal_mode').get();
      expect(result.journal_mode).toBe('wal');
    });

    it('should create data_source_configs table', () => {
      const db = initDatabase(TEST_DB_PATH);
      const tables = db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='data_source_configs'"
      ).all();
      expect(tables.length).toBe(1);
      expect(tables[0].name).toBe('data_source_configs');
    });

    it('should create config_audit_log table', () => {
      const db = initDatabase(TEST_DB_PATH);
      const tables = db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='config_audit_log'"
      ).all();
      expect(tables.length).toBe(1);
      expect(tables[0].name).toBe('config_audit_log');
    });

    it('should create idx_audit_timestamp index', () => {
      const db = initDatabase(TEST_DB_PATH);
      const indexes = db.query(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_audit_timestamp'"
      ).all();
      expect(indexes.length).toBe(1);
      expect(indexes[0].name).toBe('idx_audit_timestamp');
    });

    it('should create idx_audit_source index', () => {
      const db = initDatabase(TEST_DB_PATH);
      const indexes = db.query(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_audit_source'"
      ).all();
      expect(indexes.length).toBe(1);
      expect(indexes[0].name).toBe('idx_audit_source');
    });
  });

  describe('data_source_configs table schema', () => {
    it('should have correct columns', () => {
      const db = initDatabase(TEST_DB_PATH);
      const columns = db.query('PRAGMA table_info(data_source_configs)').all();

      const columnNames = columns.map(col => col.name);
      expect(columnNames).toContain('source_name');
      expect(columnNames).toContain('enabled');
      expect(columnNames).toContain('config_json');
      expect(columnNames).toContain('updated_at');
      expect(columnNames).toContain('updated_by');
    });

    it('should have source_name as primary key', () => {
      const db = initDatabase(TEST_DB_PATH);
      const columns = db.query('PRAGMA table_info(data_source_configs)').all();

      const pkColumn = columns.find(col => col.name === 'source_name');
      expect(pkColumn.pk).toBe(1);
    });

    it('should have enabled with default value 1', () => {
      const db = initDatabase(TEST_DB_PATH);
      const columns = db.query('PRAGMA table_info(data_source_configs)').all();

      const enabledColumn = columns.find(col => col.name === 'enabled');
      expect(enabledColumn.dflt_value).toBe('1');
    });

    it('should have enabled as INTEGER type', () => {
      const db = initDatabase(TEST_DB_PATH);
      const columns = db.query('PRAGMA table_info(data_source_configs)').all();

      const enabledColumn = columns.find(col => col.name === 'enabled');
      expect(enabledColumn.type).toBe('INTEGER');
    });

    it('should have config_json as TEXT type', () => {
      const db = initDatabase(TEST_DB_PATH);
      const columns = db.query('PRAGMA table_info(data_source_configs)').all();

      const configColumn = columns.find(col => col.name === 'config_json');
      expect(configColumn.type).toBe('TEXT');
    });
  });

  describe('config_audit_log table schema', () => {
    it('should have correct columns', () => {
      const db = initDatabase(TEST_DB_PATH);
      const columns = db.query('PRAGMA table_info(config_audit_log)').all();

      const columnNames = columns.map(col => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('source_name');
      expect(columnNames).toContain('action');
      expect(columnNames).toContain('changes_json');
      expect(columnNames).toContain('user_email');
      expect(columnNames).toContain('timestamp');
    });

    it('should have id as primary key with autoincrement', () => {
      const db = initDatabase(TEST_DB_PATH);
      const columns = db.query('PRAGMA table_info(config_audit_log)').all();

      const idColumn = columns.find(col => col.name === 'id');
      expect(idColumn.pk).toBe(1);
      expect(idColumn.type).toBe('INTEGER');
    });

    it('should have changes_json as TEXT type', () => {
      const db = initDatabase(TEST_DB_PATH);
      const columns = db.query('PRAGMA table_info(config_audit_log)').all();

      const changesColumn = columns.find(col => col.name === 'changes_json');
      expect(changesColumn.type).toBe('TEXT');
    });
  });

  describe('getDatabase', () => {
    it('should return the database instance', () => {
      initDatabase(TEST_DB_PATH);
      const db = getDatabase();
      expect(db).toBeDefined();
      expect(db.query).toBeDefined();
    });

    it('should throw error if database not initialized', () => {
      closeDatabase();
      expect(() => getDatabase()).toThrow();
    });
  });

  describe('closeDatabase', () => {
    it('should close the database connection', () => {
      initDatabase(TEST_DB_PATH);
      expect(() => closeDatabase()).not.toThrow();
    });

    it('should allow reinitialization after close', () => {
      initDatabase(TEST_DB_PATH);
      closeDatabase();
      expect(() => initDatabase(TEST_DB_PATH)).not.toThrow();
    });
  });

  describe('Data operations', () => {
    beforeEach(() => {
      initDatabase(TEST_DB_PATH);
    });

    it('should insert data into data_source_configs', () => {
      const db = getDatabase();
      const stmt = db.prepare(
        'INSERT INTO data_source_configs (source_name, config_json, updated_at, updated_by) VALUES (?, ?, ?, ?)'
      );

      const result = stmt.run(
        'test-source',
        '{"key": "value"}',
        new Date().toISOString(),
        'test@example.com'
      );

      expect(result.changes).toBe(1);
    });

    it('should apply default value for enabled column', () => {
      const db = getDatabase();
      const stmt = db.prepare(
        'INSERT INTO data_source_configs (source_name, config_json, updated_at, updated_by) VALUES (?, ?, ?, ?)'
      );

      stmt.run(
        'test-source',
        '{"key": "value"}',
        new Date().toISOString(),
        'test@example.com'
      );

      const row = db.query('SELECT enabled FROM data_source_configs WHERE source_name = ?').get('test-source');
      expect(row.enabled).toBe(1);
    });

    it('should insert data into config_audit_log', () => {
      const db = getDatabase();
      const stmt = db.prepare(
        'INSERT INTO config_audit_log (source_name, action, changes_json, user_email, timestamp) VALUES (?, ?, ?, ?, ?)'
      );

      const result = stmt.run(
        'test-source',
        'create',
        '{"changes": "initial"}',
        'test@example.com',
        new Date().toISOString()
      );

      expect(result.changes).toBe(1);
    });

    it('should retrieve audit logs in descending timestamp order using index', () => {
      const db = getDatabase();
      const stmt = db.prepare(
        'INSERT INTO config_audit_log (source_name, action, changes_json, user_email, timestamp) VALUES (?, ?, ?, ?, ?)'
      );

      // Insert multiple records with different timestamps
      stmt.run('source1', 'create', '{}', 'user@test.com', '2026-01-01T10:00:00Z');
      stmt.run('source2', 'update', '{}', 'user@test.com', '2026-01-02T10:00:00Z');
      stmt.run('source3', 'delete', '{}', 'user@test.com', '2026-01-03T10:00:00Z');

      const logs = db.query(
        'SELECT source_name FROM config_audit_log ORDER BY timestamp DESC'
      ).all();

      expect(logs[0].source_name).toBe('source3');
      expect(logs[1].source_name).toBe('source2');
      expect(logs[2].source_name).toBe('source1');
    });

    it('should retrieve audit logs by source_name using index', () => {
      const db = getDatabase();
      const stmt = db.prepare(
        'INSERT INTO config_audit_log (source_name, action, changes_json, user_email, timestamp) VALUES (?, ?, ?, ?, ?)'
      );

      // Insert multiple records
      stmt.run('source1', 'create', '{}', 'user@test.com', '2026-01-01T10:00:00Z');
      stmt.run('source1', 'update', '{}', 'user@test.com', '2026-01-02T10:00:00Z');
      stmt.run('source2', 'create', '{}', 'user@test.com', '2026-01-03T10:00:00Z');

      const logs = db.query(
        'SELECT action FROM config_audit_log WHERE source_name = ? ORDER BY timestamp'
      ).all('source1');

      expect(logs.length).toBe(2);
      expect(logs[0].action).toBe('create');
      expect(logs[1].action).toBe('update');
    });
  });
});
