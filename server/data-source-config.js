// ---------------------------------------------------------------------------
// Data Source Configuration Module — Config management with security
// ---------------------------------------------------------------------------

import { getDrizzle, dataSourceConfigs, configAuditLog } from './db/index.js';
import { eq, desc } from 'drizzle-orm';
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
 * @param {object} tx - Drizzle transaction (or db) instance
 * @param {string} sourceName - Data source name
 * @param {string} action - Action performed (create, update, enable, disable)
 * @param {Object} changes - Changes made
 * @param {string} userEmail - User who made the change
 */
function logAudit(tx, sourceName, action, changes, userEmail) {
  try {
    tx.insert(configAuditLog)
      .values({
        sourceName,
        action,
        changesJson: JSON.stringify(changes),
        userEmail,
        timestamp: new Date().toISOString(),
      })
      .run();

    logger.info({ dataSource: sourceName, action, userEmail }, 'Configuration audit log created');
  } catch (error) {
    logger.error({ error: error.message, dataSource: sourceName, action }, 'Failed to create audit log');
    // Don't throw — audit logging failure shouldn't block the operation
  }
}

/**
 * Get configuration for a data source
 *
 * @param {string} sourceName - Data source name
 * @returns {Object|null} Configuration object with { enabled, config, updatedAt, updatedBy } or null if not found
 */
export function getConfig(sourceName) {
  try {
    const db = getDrizzle();
    const row = db
      .select()
      .from(dataSourceConfigs)
      .where(eq(dataSourceConfigs.sourceName, sourceName))
      .get();

    if (!row) return null;

    return {
      enabled:   row.enabled ? 1 : 0,
      config:    row.configJson ? JSON.parse(row.configJson) : null,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  } catch (error) {
    logger.error({ error: error.message, dataSource: sourceName }, 'Failed to get configuration');
    throw error;
  }
}

/**
 * Update configuration for a data source
 *
 * Uses UPSERT pattern via Drizzle's onConflictDoUpdate. All operations are
 * wrapped in a transaction to ensure atomicity with audit logging.
 *
 * @param {string} sourceName - Data source name
 * @param {Object} config - Configuration object (must not contain sensitive fields)
 * @param {string} userEmail - Email of user making the change
 * @returns {void}
 * @throws {Error} If config contains sensitive fields or validation fails
 */
export function updateConfig(sourceName, config, userEmail) {
  validateSourceName(sourceName);
  validateNoSensitiveFields(config);

  const db        = getDrizzle();
  const timestamp = new Date().toISOString();
  const configJson = JSON.stringify(config);

  try {
    db.transaction((tx) => {
      const existing = tx
        .select({ sourceName: dataSourceConfigs.sourceName })
        .from(dataSourceConfigs)
        .where(eq(dataSourceConfigs.sourceName, sourceName))
        .get();
      const action = existing ? 'update' : 'create';

      tx.insert(dataSourceConfigs)
        .values({ sourceName, enabled: true, configJson, updatedAt: timestamp, updatedBy: userEmail })
        .onConflictDoUpdate({
          target: dataSourceConfigs.sourceName,
          set:    { configJson, updatedAt: timestamp, updatedBy: userEmail },
        })
        .run();

      logAudit(tx, sourceName, action, { config }, userEmail);

      logger.info({ dataSource: sourceName, action, userEmail }, 'Configuration updated successfully');
    });
  } catch (error) {
    logger.error({ error: error.message, dataSource: sourceName }, 'Failed to update configuration');
    throw error;
  }
}

/**
 * Toggle enabled status for a data source
 *
 * All operations are wrapped in a transaction to ensure atomicity with audit logging.
 *
 * @param {string} sourceName - Data source name
 * @param {boolean} enabled - Whether to enable or disable
 * @param {string} userEmail - Email of user making the change
 * @returns {void}
 * @throws {Error} If data source does not exist or validation fails
 */
export function toggleEnabled(sourceName, enabled, userEmail) {
  validateSourceName(sourceName);

  if (typeof enabled !== 'boolean') {
    throw new Error(`Invalid enabled value: must be boolean (true/false), got ${typeof enabled}`);
  }

  const db        = getDrizzle();
  const timestamp = new Date().toISOString();
  const action    = enabled ? 'enable' : 'disable';

  try {
    db.transaction((tx) => {
      const existing = tx
        .select({ sourceName: dataSourceConfigs.sourceName })
        .from(dataSourceConfigs)
        .where(eq(dataSourceConfigs.sourceName, sourceName))
        .get();

      if (!existing) {
        throw new Error(
          `Data source "${sourceName}" does not exist. ` +
          'Create a configuration first using updateConfig()'
        );
      }

      tx.update(dataSourceConfigs)
        .set({ enabled, updatedAt: timestamp, updatedBy: userEmail })
        .where(eq(dataSourceConfigs.sourceName, sourceName))
        .run();

      logAudit(tx, sourceName, action, { enabled }, userEmail);

      logger.info({ dataSource: sourceName, enabled, userEmail }, `Data source ${action}d successfully`);
    });
  } catch (error) {
    logger.error({ error: error.message, dataSource: sourceName }, 'Failed to toggle enabled status');
    throw error;
  }
}

/**
 * Get audit log for a data source
 *
 * @param {string} sourceName - Data source name
 * @param {number} limit - Maximum number of entries to return (default: 50)
 * @returns {Array} Audit log entries in descending timestamp order
 */
export function getAuditLog(sourceName, limit = DEFAULT_AUDIT_LOG_LIMIT) {
  try {
    const validatedLimit = parseInt(limit, 10);
    if (isNaN(validatedLimit) || validatedLimit <= 0) {
      throw new Error(`Invalid limit: must be a positive integer, got ${limit}`);
    }

    const db   = getDrizzle();
    const rows = db
      .select()
      .from(configAuditLog)
      .where(eq(configAuditLog.sourceName, sourceName))
      .orderBy(desc(configAuditLog.timestamp))
      .limit(validatedLimit)
      .all();

    return rows.map(row => ({
      id:         row.id,
      sourceName: row.sourceName,
      action:     row.action,
      changes:    JSON.parse(row.changesJson),
      userEmail:  row.userEmail,
      timestamp:  row.timestamp,
    }));
  } catch (error) {
    logger.error({ error: error.message, dataSource: sourceName }, 'Failed to get audit log');
    throw error;
  }
}

/**
 * Export all data source configurations
 *
 * @returns {Object} Object with source names as keys and config objects as values
 */
export function exportConfigs() {
  try {
    const db   = getDrizzle();
    const rows = db.select().from(dataSourceConfigs).all();

    const configs = {};
    for (const row of rows) {
      configs[row.sourceName] = {
        enabled:   row.enabled ? 1 : 0,
        config:    row.configJson ? JSON.parse(row.configJson) : null,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
      };
    }

    logger.info({ count: Object.keys(configs).length }, 'Exported all configurations');
    return configs;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to export configurations');
    throw error;
  }
}
