// ---------------------------------------------------------------------------
// Drizzle ORM Instance — Wraps the existing bun:sqlite Database connection
//
// IMPORTANT: initDatabase() from server/db.js must be called before getDrizzle().
// server/index.js already calls initDatabase() at startup, so this is safe.
// ---------------------------------------------------------------------------

import { drizzle } from 'drizzle-orm/bun-sqlite';
import { getDatabase } from '../db.js';
import * as schema from './schema.js';

/** Cached Drizzle instance — reset to null if closeDatabase() is called. */
let _drizzle = null;

/**
 * Get the Drizzle ORM instance wrapping the existing database connection.
 * Cached after first call. Call initDatabase() (from server/db.js) before using this.
 * @returns {import('drizzle-orm/bun-sqlite').BunSQLiteDatabase} Drizzle instance
 */
export function getDrizzle() {
  if (!_drizzle) {
    _drizzle = drizzle(getDatabase(), { schema });
  }
  return _drizzle;
}

/**
 * Reset the cached Drizzle instance. Call this after closeDatabase() in tests.
 */
export function resetDrizzle() {
  _drizzle = null;
}

// Re-export tables for convenient imports in other modules
export { dataSourceConfigs, configAuditLog } from './schema.js';
