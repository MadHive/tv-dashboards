// ===========================================================================
// Drizzle smoke tests — in-memory SQLite
// Verifies that the Drizzle schema definitions and drizzle-typebox integration
// work correctly for basic insert/select operations.
// ===========================================================================

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import * as schema from '../../../server/db/schema.js';

let db;
let sqlite;

beforeAll(() => {
  sqlite = new Database(':memory:');
  sqlite.run(`CREATE TABLE data_source_configs (
    source_name TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 1,
    config_json TEXT,
    updated_at TEXT,
    updated_by TEXT
  )`);
  sqlite.run(`CREATE TABLE config_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT,
    action TEXT,
    changes_json TEXT,
    user_email TEXT,
    timestamp TEXT
  )`);
  db = drizzle(sqlite, { schema });
});

afterAll(() => {
  sqlite.close();
});

describe('Drizzle smoke tests', () => {
  it('can insert and read back a data_source_configs row', () => {
    db.insert(schema.dataSourceConfigs).values({
      sourceName: 'gcp',
      enabled: true,
      configJson: '{"project":"mad-master"}',
      updatedAt: new Date().toISOString(),
      updatedBy: 'test',
    }).run();

    const row = db.select()
      .from(schema.dataSourceConfigs)
      .where(eq(schema.dataSourceConfigs.sourceName, 'gcp'))
      .get();

    expect(row).toBeDefined();
    expect(row.sourceName).toBe('gcp');
    expect(row.enabled).toBe(true);
    expect(JSON.parse(row.configJson)).toEqual({ project: 'mad-master' });
  });

  it('can insert and read back a config_audit_log row', () => {
    db.insert(schema.configAuditLog).values({
      sourceName: 'gcp',
      action: 'update',
      changesJson: '{}',
      userEmail: 'test@madhive.com',
      timestamp: new Date().toISOString(),
    }).run();

    const rows = db.select()
      .from(schema.configAuditLog)
      .where(eq(schema.configAuditLog.sourceName, 'gcp'))
      .all();

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].action).toBe('update');
    expect(rows[0].userEmail).toBe('test@madhive.com');
  });

  it('drizzle-typebox select schema validates a real row shape', async () => {
    const { createSelectSchema } = await import('drizzle-typebox');
    const { Value } = await import('@sinclair/typebox/value');

    const SelectSchema = createSelectSchema(schema.dataSourceConfigs);
    const row = db.select().from(schema.dataSourceConfigs).get();

    expect(Value.Check(SelectSchema, row)).toBe(true);
  });
});
