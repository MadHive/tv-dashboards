// ---------------------------------------------------------------------------
// Database Module — SQLite initialization and schema management
// ---------------------------------------------------------------------------

import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import logger from './logger.js';

let db = null;

/**
 * Initialize the SQLite database with schema and indexes
 * @param {string} dbPath - Path to the database file (default: data/tv-dashboards.db)
 * @returns {Database} The initialized database instance
 */
export function initDatabase(dbPath = 'data/tv-dashboards.db') {
  try {
    // Create data directory if it doesn't exist
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
      logger.info({ path: dbDir }, 'Created database directory');
    }

    // Open database connection
    db = new Database(dbPath, { create: true });
    logger.info({ path: dbPath }, 'Database connection opened');

    // Enable WAL mode for better concurrency
    db.exec('PRAGMA journal_mode = WAL');
    logger.debug('Enabled WAL mode');

    // Create data_source_configs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS data_source_configs (
        source_name TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 1,
        config_json TEXT,
        updated_at TEXT,
        updated_by TEXT
      )
    `);
    logger.debug('Created data_source_configs table');

    // Create config_audit_log table
    db.exec(`
      CREATE TABLE IF NOT EXISTS config_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_name TEXT,
        action TEXT,
        changes_json TEXT,
        user_email TEXT,
        timestamp TEXT
      )
    `);
    logger.debug('Created config_audit_log table');

    // Create indexes for audit log queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp
      ON config_audit_log(timestamp DESC)
    `);
    logger.debug('Created idx_audit_timestamp index');

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_source
      ON config_audit_log(source_name)
    `);
    logger.debug('Created idx_audit_source index');

    logger.info('Database initialization complete');
    return db;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to initialize database');
    throw error;
  }
}

/**
 * Get the current database instance
 * @returns {Database} The database instance
 * @throws {Error} If database has not been initialized
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}
