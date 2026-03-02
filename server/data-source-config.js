// ---------------------------------------------------------------------------
// Data Source Configuration Module — Config management with security
// ---------------------------------------------------------------------------

import { getDatabase } from './db.js';
import logger from './logger.js';

/**
 * Default limit for audit log queries
 */
const DEFAULT_AUDIT_LOG_LIMIT = 50;

/**
 * Valid source name pattern for validation
 * Allows alphanumeric characters, hyphens, and underscores (1-64 characters)
 */
const SOURCE_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Sensitive field patterns to reject (security validation)
 * These patterns match common field names that should not be stored in plain text
 */
const SENSITIVE_PATTERNS = [
  /key$/i,          // apiKey, accessKey, authKey
  /token$/i,        // apiToken, accessToken, authToken
  /password$/i,     // password, dbPassword, userPassword
  /secret$/i,       // secret, clientSecret, appSecret
  /credential/i,    // credentials, serviceCredential
  /apikey/i,        // apikey (compound word)
  /accesskey/i,     // accesskey (compound word)
];

/**
 * Validate source name format
 * @param {string} sourceName - Data source name to validate
 * @throws {Error} If source name is invalid
 */
function validateSourceName(sourceName) {
  if (!sourceName || typeof sourceName !== 'string') {
    throw new Error(
      'Invalid source name: must be a non-empty string. ' +
      'Example: GCP_PROJECT_ID=your-project or AWS_REGION=us-east-1'
    );
  }

  if (!SOURCE_NAME_PATTERN.test(sourceName)) {
    throw new Error(
      `Invalid source name: "${sourceName}". ` +
      'Must be 1-64 characters (alphanumeric, hyphens, underscores only). ' +
      'Example: "gcp", "aws", "datadog-prod"'
    );
  }
}

/**
 * Recursively validate config object for sensitive fields
 * @param {Object} config - Configuration object to validate
 * @param {string} path - Current path in object (for error messages)
 * @throws {Error} If sensitive field is detected
 */
function validateNoSensitiveFields(config, path = '') {
  if (!config || typeof config !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(config)) {
    const currentPath = path ? `${path}.${key}` : key;

    // Check if field name matches sensitive patterns
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(key)) {
        throw new Error(
          `Sensitive field detected: "${currentPath}". ` +
          `Fields matching ${pattern} are not allowed in configuration. ` +
          `Sensitive values must be stored in environment variables or secret management systems. ` +
          `Example: GCP_API_KEY=your-key or AWS_SECRET_ACCESS_KEY=your-secret`
        );
      }
    }

    // Recursively check nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      validateNoSensitiveFields(value, currentPath);
    }
  }
}

/**
 * Log audit entry for configuration changes
 * @param {string} sourceName - Data source name
 * @param {string} action - Action performed (create, update, enable, disable)
 * @param {Object} changes - Changes made
 * @param {string} userEmail - User who made the change
 */
function logAudit(sourceName, action, changes, userEmail) {
  try {
    const db = getDatabase();
    const timestamp = new Date().toISOString();

    db.query(
      'INSERT INTO config_audit_log (source_name, action, changes_json, user_email, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).run(
      sourceName,
      action,
      JSON.stringify(changes),
      userEmail,
      timestamp
    );

    logger.info({
      dataSource: sourceName,
      action,
      userEmail,
    }, 'Configuration audit log created');
  } catch (error) {
    logger.error({
      error: error.message,
      dataSource: sourceName,
      action,
    }, 'Failed to create audit log');
    // Don't throw - audit logging failure shouldn't block the operation
  }
}

/**
 * Get configuration for a data source
 *
 * Note: Uses parameterized queries via Bun's db.query() which automatically
 * escapes parameters to prevent SQL injection attacks.
 *
 * @param {string} sourceName - Data source name
 * @returns {Object|null} Configuration object with { enabled, config, updatedAt, updatedBy } or null if not found
 */
export function getConfig(sourceName) {
  try {
    const db = getDatabase();
    const row = db.query(
      'SELECT enabled, config_json, updated_at, updated_by FROM data_source_configs WHERE source_name = ?'
    ).get(sourceName);

    if (!row) {
      return null;
    }

    return {
      enabled: row.enabled,
      config: row.config_json ? JSON.parse(row.config_json) : null,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    };
  } catch (error) {
    logger.error({
      error: error.message,
      dataSource: sourceName,
    }, 'Failed to get configuration');
    throw error;
  }
}

/**
 * Update configuration for a data source
 *
 * Uses UPSERT pattern (INSERT ... ON CONFLICT ... DO UPDATE) to eliminate race
 * conditions between SELECT-then-INSERT/UPDATE operations. All operations are
 * wrapped in a transaction to ensure atomicity with audit logging.
 *
 * Note: Uses parameterized queries via Bun's db.query() which automatically
 * escapes parameters to prevent SQL injection attacks.
 *
 * @param {string} sourceName - Data source name
 * @param {Object} config - Configuration object (must not contain sensitive fields)
 * @param {string} userEmail - Email of user making the change
 * @returns {void}
 * @throws {Error} If config contains sensitive fields or validation fails
 */
export function updateConfig(sourceName, config, userEmail) {
  // Validate inputs BEFORE starting transaction
  validateSourceName(sourceName);
  validateNoSensitiveFields(config);

  const db = getDatabase();
  const timestamp = new Date().toISOString();
  const configJson = JSON.stringify(config);

  try {
    // Begin transaction for atomicity
    db.exec('BEGIN IMMEDIATE');

    // Check if this is create or update (for audit logging)
    const existing = db.query(
      'SELECT source_name FROM data_source_configs WHERE source_name = ?'
    ).get(sourceName);
    const action = existing ? 'update' : 'create';

    // UPSERT: Insert or update atomically (eliminates race condition)
    db.query(`
      INSERT INTO data_source_configs (source_name, enabled, config_json, updated_at, updated_by)
      VALUES (?, 1, ?, ?, ?)
      ON CONFLICT(source_name) DO UPDATE SET
        config_json = excluded.config_json,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `).run(sourceName, configJson, timestamp, userEmail);

    // Log audit trail (part of transaction)
    logAudit(sourceName, action, { config }, userEmail);

    // Commit transaction
    db.exec('COMMIT');

    logger.info({
      dataSource: sourceName,
      action,
      userEmail,
    }, 'Configuration updated successfully');
  } catch (error) {
    // Rollback transaction on error
    try {
      db.exec('ROLLBACK');
    } catch (rollbackError) {
      logger.error({
        error: rollbackError.message,
      }, 'Failed to rollback transaction');
    }

    logger.error({
      error: error.message,
      dataSource: sourceName,
    }, 'Failed to update configuration');
    throw error;
  }
}

/**
 * Toggle enabled status for a data source
 *
 * All operations are wrapped in a transaction to ensure atomicity with audit logging.
 *
 * Note: Uses parameterized queries via Bun's db.query() which automatically
 * escapes parameters to prevent SQL injection attacks.
 *
 * @param {string} sourceName - Data source name
 * @param {boolean} enabled - Whether to enable or disable
 * @param {string} userEmail - Email of user making the change
 * @returns {void}
 * @throws {Error} If data source does not exist or validation fails
 */
export function toggleEnabled(sourceName, enabled, userEmail) {
  // Validate inputs BEFORE starting transaction
  validateSourceName(sourceName);

  if (typeof enabled !== 'boolean') {
    throw new Error(
      `Invalid enabled value: must be boolean (true/false), got ${typeof enabled}`
    );
  }

  const db = getDatabase();

  try {
    // Begin transaction for atomicity
    db.exec('BEGIN IMMEDIATE');

    // Check if config exists
    const existing = db.query(
      'SELECT source_name FROM data_source_configs WHERE source_name = ?'
    ).get(sourceName);

    if (!existing) {
      throw new Error(
        `Data source "${sourceName}" does not exist. ` +
        'Create a configuration first using updateConfig()'
      );
    }

    const timestamp = new Date().toISOString();
    const enabledValue = enabled ? 1 : 0;
    const action = enabled ? 'enable' : 'disable';

    // Update enabled status
    db.query(
      'UPDATE data_source_configs SET enabled = ?, updated_at = ?, updated_by = ? WHERE source_name = ?'
    ).run(enabledValue, timestamp, userEmail, sourceName);

    // Log audit trail (part of transaction)
    logAudit(sourceName, action, { enabled }, userEmail);

    // Commit transaction
    db.exec('COMMIT');

    logger.info({
      dataSource: sourceName,
      enabled,
      userEmail,
    }, `Data source ${action}d successfully`);
  } catch (error) {
    // Rollback transaction on error
    try {
      db.exec('ROLLBACK');
    } catch (rollbackError) {
      logger.error({
        error: rollbackError.message,
      }, 'Failed to rollback transaction');
    }

    logger.error({
      error: error.message,
      dataSource: sourceName,
    }, 'Failed to toggle enabled status');
    throw error;
  }
}

/**
 * Get audit log for a data source
 *
 * Note: Uses parameterized queries via Bun's db.query() which automatically
 * escapes parameters to prevent SQL injection attacks.
 *
 * @param {string} sourceName - Data source name
 * @param {number} limit - Maximum number of entries to return (default: 50)
 * @returns {Array} Audit log entries in descending timestamp order
 */
export function getAuditLog(sourceName, limit = DEFAULT_AUDIT_LOG_LIMIT) {
  try {
    // Validate limit is positive integer
    const validatedLimit = parseInt(limit, 10);
    if (isNaN(validatedLimit) || validatedLimit <= 0) {
      throw new Error(
        `Invalid limit: must be a positive integer, got ${limit}`
      );
    }

    const db = getDatabase();
    const rows = db.query(
      'SELECT id, source_name, action, changes_json, user_email, timestamp FROM config_audit_log WHERE source_name = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(sourceName, validatedLimit);

    return rows.map(row => ({
      id: row.id,
      sourceName: row.source_name,
      action: row.action,
      changes: JSON.parse(row.changes_json),
      userEmail: row.user_email,
      timestamp: row.timestamp,
    }));
  } catch (error) {
    logger.error({
      error: error.message,
      dataSource: sourceName,
    }, 'Failed to get audit log');
    throw error;
  }
}

/**
 * Export all data source configurations
 *
 * Note: Uses parameterized queries via Bun's db.query() which automatically
 * escapes parameters to prevent SQL injection attacks.
 *
 * @returns {Object} Object with source names as keys and config objects as values
 */
export function exportConfigs() {
  try {
    const db = getDatabase();
    const rows = db.query(
      'SELECT source_name, enabled, config_json, updated_at, updated_by FROM data_source_configs'
    ).all();

    const configs = {};
    for (const row of rows) {
      configs[row.source_name] = {
        enabled: row.enabled,
        config: row.config_json ? JSON.parse(row.config_json) : null,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
      };
    }

    logger.info({
      count: Object.keys(configs).length,
    }, 'Exported all configurations');

    return configs;
  } catch (error) {
    logger.error({
      error: error.message,
    }, 'Failed to export configurations');
    throw error;
  }
}
