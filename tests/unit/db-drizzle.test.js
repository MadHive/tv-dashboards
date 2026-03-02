// ===========================================================================
// Drizzle Schema Tests — Verify schema definitions match existing database
// ===========================================================================

import { describe, it, expect } from 'bun:test';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { dataSourceConfigs, configAuditLog } from '../../server/db/schema.js';

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
