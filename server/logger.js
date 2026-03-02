// ---------------------------------------------------------------------------
// Structured Logger — Pino-based logging system
// ---------------------------------------------------------------------------

import pino from 'pino';
import { randomUUID } from 'crypto';

// Determine log level from environment variable (default: 'info')
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

// Create base logger instance
const logger = pino({
  level: LOG_LEVEL,
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }
    : undefined, // In production, output raw JSON
  base: {
    service: 'tv-dashboards',
  },
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

/**
 * Generate a unique request ID
 * @returns {string} UUID v4
 */
export function generateRequestId() {
  return randomUUID();
}

/**
 * Create a child logger with additional context
 * @param {Object} bindings - Context to bind to the logger
 * @returns {Object} Child logger instance
 */
export function createLogger(bindings = {}) {
  return logger.child(bindings);
}

/**
 * Create a logger for a specific data source
 * @param {string} sourceName - Name of the data source
 * @returns {Object} Logger with data source context
 */
export function createDataSourceLogger(sourceName) {
  return createLogger({ dataSource: sourceName });
}

/**
 * Create a logger for a specific widget
 * @param {string} widgetId - ID of the widget
 * @param {string} dashboardId - ID of the dashboard (optional)
 * @returns {Object} Logger with widget context
 */
export function createWidgetLogger(widgetId, dashboardId = null) {
  const bindings = { widgetId };
  if (dashboardId) {
    bindings.dashboardId = dashboardId;
  }
  return createLogger(bindings);
}

/**
 * Create a logger for a specific dashboard
 * @param {string} dashboardId - ID of the dashboard
 * @returns {Object} Logger with dashboard context
 */
export function createDashboardLogger(dashboardId) {
  return createLogger({ dashboardId });
}

/**
 * Create a request logger with request ID
 * @param {Object} request - Elysia request object (optional)
 * @returns {Object} Logger with request context
 */
export function createRequestLogger(request = null) {
  const requestId = generateRequestId();
  const bindings = { requestId };

  if (request) {
    bindings.method = request.method;
    bindings.url = request.url;
  }

  return createLogger(bindings);
}

/**
 * Log a query execution
 * @param {Object} options - Query execution details
 * @param {string} options.source - Data source name
 * @param {string} options.queryId - Query ID
 * @param {number} options.duration - Execution duration in ms
 * @param {boolean} options.success - Whether query succeeded
 * @param {string} options.error - Error message if failed
 */
export function logQueryExecution({ source, queryId, duration, success, error = null }) {
  const queryLogger = createLogger({
    dataSource: source,
    queryId,
    duration,
    success
  });

  if (success) {
    queryLogger.info('Query executed successfully');
  } else {
    queryLogger.error({ error }, 'Query execution failed');
  }
}

/**
 * Log a dashboard load event
 * @param {string} dashboardId - Dashboard ID
 * @param {number} widgetCount - Number of widgets
 * @param {number} duration - Load duration in ms
 */
export function logDashboardLoad(dashboardId, widgetCount, duration) {
  createDashboardLogger(dashboardId).info(
    { widgetCount, duration },
    'Dashboard loaded'
  );
}

/**
 * Log a configuration change
 * @param {string} operation - Type of operation (create, update, delete)
 * @param {string} entityType - Type of entity (dashboard, widget, query)
 * @param {string} entityId - Entity ID
 */
export function logConfigChange(operation, entityType, entityId) {
  logger.info(
    { operation, entityType, entityId },
    `Configuration ${operation}: ${entityType}`
  );
}

/**
 * Log an authentication event
 * @param {string} userId - User ID or email
 * @param {boolean} success - Whether authentication succeeded
 * @param {string} method - Authentication method (oauth, api_key, etc.)
 */
export function logAuth(userId, success, method = 'oauth') {
  logger.info(
    { userId, success, method },
    success ? 'Authentication successful' : 'Authentication failed'
  );
}

// Export the base logger as default
export default logger;
