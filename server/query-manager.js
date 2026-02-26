// ===========================================================================
// Query Manager — Save/load/validate saved queries for data sources
// ===========================================================================

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load, dump } from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUERIES_PATH = join(__dirname, '..', 'config', 'queries.yaml');
const CONFIG_DIR = join(__dirname, '..', 'config');
const MAX_BACKUPS = 10;

/**
 * Load queries from YAML file
 * Returns object grouped by data source: { bigquery: [...], gcp: [...], ... }
 */
export function loadQueries() {
  try {
    if (!existsSync(QUERIES_PATH)) {
      console.log('[query-manager] No queries.yaml found, initializing empty');
      return {};
    }

    const raw = readFileSync(QUERIES_PATH, 'utf8');
    const queries = load(raw) || {};

    console.log('[query-manager] Loaded queries from', QUERIES_PATH);
    return queries;
  } catch (error) {
    console.error('[query-manager] Failed to load queries:', error.message);
    // Return empty object on error - don't crash the server
    return {};
  }
}

/**
 * Save queries to YAML file
 */
export async function saveQueries(queries) {
  try {
    // Create backup before saving
    await createBackup();

    // Convert to YAML
    const yamlContent = dump(queries, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false
    });

    // Write to file
    writeFileSync(QUERIES_PATH, yamlContent, 'utf8');

    console.log('[query-manager] Queries saved successfully');
    return { success: true };
  } catch (error) {
    console.error('[query-manager] Failed to save queries:', error.message);
    throw error;
  }
}

/**
 * Get a specific query by source and ID
 */
export async function getQuery(source, queryId) {
  try {
    const queries = loadQueries();

    if (!queries[source]) {
      return null;
    }

    const query = queries[source].find(q => q.id === queryId);
    return query || null;
  } catch (error) {
    console.error('[query-manager] Failed to get query:', error.message);
    return null;
  }
}

/**
 * List all queries for a specific data source
 */
export async function listQueries(source) {
  try {
    const queries = loadQueries();
    return queries[source] || [];
  } catch (error) {
    console.error('[query-manager] Failed to list queries:', error.message);
    return [];
  }
}

/**
 * List all queries grouped by source
 */
export async function listAllQueries() {
  try {
    return loadQueries();
  } catch (error) {
    console.error('[query-manager] Failed to list all queries:', error.message);
    return {};
  }
}

/**
 * Save or update a query
 */
export async function saveQuery(source, queryDef) {
  try {
    // Validate required fields
    if (!queryDef.id) {
      throw new Error('Query ID is required');
    }
    if (!queryDef.name) {
      throw new Error('Query name is required');
    }

    // Load current queries
    const queries = loadQueries();

    // Initialize source array if needed
    if (!queries[source]) {
      queries[source] = [];
    }

    // Check if query exists
    const existingIndex = queries[source].findIndex(q => q.id === queryDef.id);

    // Add timestamps
    const now = new Date().toISOString();
    const queryData = {
      ...queryDef,
      updatedAt: now
    };

    if (existingIndex >= 0) {
      // Update existing query
      queryData.createdAt = queries[source][existingIndex].createdAt || now;
      queries[source][existingIndex] = queryData;
      console.log('[query-manager] Updated query:', source, queryDef.id);
    } else {
      // Create new query
      queryData.createdAt = now;
      queries[source].push(queryData);
      console.log('[query-manager] Created query:', source, queryDef.id);
    }

    // Save to file
    await saveQueries(queries);

    return { success: true, query: queryData };
  } catch (error) {
    console.error('[query-manager] Failed to save query:', error.message);
    throw error;
  }
}

/**
 * Delete a query
 */
export async function deleteQuery(source, queryId) {
  try {
    // Load current queries
    const queries = loadQueries();

    if (!queries[source]) {
      throw new Error(`No queries found for source: ${source}`);
    }

    // Find query index
    const index = queries[source].findIndex(q => q.id === queryId);

    if (index === -1) {
      throw new Error(`Query not found: ${queryId}`);
    }

    // Remove query
    const deleted = queries[source].splice(index, 1)[0];

    // Save updated queries
    await saveQueries(queries);

    console.log('[query-manager] Deleted query:', source, queryId);
    return { success: true, deleted };
  } catch (error) {
    console.error('[query-manager] Failed to delete query:', error.message);
    throw error;
  }
}

/**
 * Create a timestamped backup of the current queries
 */
export async function createBackup() {
  try {
    if (!existsSync(QUERIES_PATH)) {
      console.warn('[query-manager] No queries file to backup');
      return null;
    }

    // Read current queries
    const content = readFileSync(QUERIES_PATH, 'utf8');

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = join(CONFIG_DIR, `queries.yaml.backup.${timestamp}`);

    // Write backup
    writeFileSync(backupPath, content, 'utf8');

    console.log('[query-manager] Backup created:', backupPath);

    // Clean up old backups
    await cleanupOldBackups();

    return backupPath;
  } catch (error) {
    console.error('[query-manager] Failed to create backup:', error.message);
    // Don't throw - backups are best-effort
    return null;
  }
}

/**
 * Delete old backups, keeping only the most recent MAX_BACKUPS
 */
async function cleanupOldBackups() {
  try {
    // List all backup files
    const files = readdirSync(CONFIG_DIR);
    const backups = files
      .filter(f => f.startsWith('queries.yaml.backup.'))
      .map(f => ({
        name: f,
        path: join(CONFIG_DIR, f),
        time: f.replace('queries.yaml.backup.', '')
      }))
      .sort((a, b) => b.time.localeCompare(a.time)); // Sort by timestamp, newest first

    // Delete old backups
    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      toDelete.forEach(backup => {
        unlinkSync(backup.path);
        console.log('[query-manager] Deleted old backup:', backup.name);
      });
    }
  } catch (error) {
    console.error('[query-manager] Failed to cleanup backups:', error.message);
    // Don't throw - cleanup is best-effort
  }
}

/**
 * List available backups
 */
export function listBackups() {
  try {
    const files = readdirSync(CONFIG_DIR);
    const backups = files
      .filter(f => f.startsWith('queries.yaml.backup.'))
      .map(f => ({
        filename: f,
        timestamp: f.replace('queries.yaml.backup.', ''),
        path: join(CONFIG_DIR, f)
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return backups;
  } catch (error) {
    console.error('[query-manager] Failed to list backups:', error.message);
    return [];
  }
}

/**
 * Restore from a backup file
 */
export async function restoreBackup(backupFilename) {
  try {
    const backupPath = join(CONFIG_DIR, backupFilename);

    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupFilename}`);
    }

    // Read backup content
    const content = readFileSync(backupPath, 'utf8');
    const queries = load(content);

    // Create backup of current state before restoring
    await createBackup();

    // Restore backup
    writeFileSync(QUERIES_PATH, content, 'utf8');

    console.log('[query-manager] Restored from backup:', backupFilename);
    return { success: true, backup: backupFilename };
  } catch (error) {
    console.error('[query-manager] Failed to restore backup:', error.message);
    throw error;
  }
}
