// ---------------------------------------------------------------------------
// Drizzle ORM Instance — Wraps the existing bun:sqlite Database connection
//
// IMPORTANT: initDatabase() from server/db.js must be called before getDrizzle().
// server/index.js already calls initDatabase() at startup, so this is safe.
// ---------------------------------------------------------------------------

import { drizzle } from 'drizzle-orm/bun-sqlite';
import { getDatabase } from '../db.js';
import * as schema from './schema.js';

/**
 * Get the Drizzle ORM instance wrapping the existing database connection.
 * Call initDatabase() (from server/db.js) before using this.
 * @returns {import('drizzle-orm/bun-sqlite').BunSQLiteDatabase} Drizzle instance
 */
export function getDrizzle() {
  return drizzle(getDatabase(), { schema });
}

// Re-export tables for convenient imports in other modules
export { dataSourceConfigs, configAuditLog } from './schema.js';
