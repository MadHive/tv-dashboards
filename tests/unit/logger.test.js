// ===========================================================================
// Logger Tests — Verify structured logging functionality
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import logger, {
  generateRequestId,
  createLogger,
  createDataSourceLogger,
  createWidgetLogger,
  createDashboardLogger,
  createRequestLogger,
  logQueryExecution,
  logDashboardLoad,
  logConfigChange,
  logAuth
} from '../../server/logger.js';

describe('Logger', () => {
  describe('generateRequestId', () => {
    it('should generate a valid UUID v4', () => {
      const requestId = generateRequestId();
      expect(requestId).toBeDefined();
      expect(typeof requestId).toBe('string');
      expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('createLogger', () => {
    it('should create a child logger with bindings', () => {
      const childLogger = createLogger({ userId: '123', operation: 'test' });
      expect(childLogger).toBeDefined();
      expect(childLogger.info).toBeDefined();
      expect(childLogger.error).toBeDefined();
      expect(childLogger.warn).toBeDefined();
      expect(childLogger.debug).toBeDefined();
    });

    it('should create logger without bindings', () => {
      const childLogger = createLogger();
      expect(childLogger).toBeDefined();
    });
  });

  describe('createDataSourceLogger', () => {
    it('should create a logger with data source context', () => {
      const dsLogger = createDataSourceLogger('bigquery');
      expect(dsLogger).toBeDefined();
      // Logger should have bindings property with dataSource
    });
  });

  describe('createWidgetLogger', () => {
    it('should create a logger with widget context', () => {
      const widgetLogger = createWidgetLogger('widget-123', 'dashboard-456');
      expect(widgetLogger).toBeDefined();
    });

    it('should create a logger with widget context without dashboard', () => {
      const widgetLogger = createWidgetLogger('widget-123');
      expect(widgetLogger).toBeDefined();
    });
  });

  describe('createDashboardLogger', () => {
    it('should create a logger with dashboard context', () => {
      const dashLogger = createDashboardLogger('dashboard-789');
      expect(dashLogger).toBeDefined();
    });
  });

  describe('createRequestLogger', () => {
    it('should create a logger with request ID', () => {
      const reqLogger = createRequestLogger();
      expect(reqLogger).toBeDefined();
    });

    it('should create a logger with request object', () => {
      const mockRequest = {
        method: 'GET',
        url: 'http://example.com/api/test'
      };
      const reqLogger = createRequestLogger(mockRequest);
      expect(reqLogger).toBeDefined();
    });
  });

  describe('logQueryExecution', () => {
    it('should log successful query execution', () => {
      expect(() => {
        logQueryExecution({
          source: 'bigquery',
          queryId: 'test-query',
          duration: 150,
          success: true
        });
      }).not.toThrow();
    });

    it('should log failed query execution', () => {
      expect(() => {
        logQueryExecution({
          source: 'bigquery',
          queryId: 'test-query',
          duration: 50,
          success: false,
          error: 'Connection timeout'
        });
      }).not.toThrow();
    });
  });

  describe('logDashboardLoad', () => {
    it('should log dashboard load event', () => {
      expect(() => {
        logDashboardLoad('dashboard-123', 8, 234);
      }).not.toThrow();
    });
  });

  describe('logConfigChange', () => {
    it('should log configuration changes', () => {
      expect(() => {
        logConfigChange('create', 'dashboard', 'dashboard-new');
        logConfigChange('update', 'widget', 'widget-456');
        logConfigChange('delete', 'query', 'query-789');
      }).not.toThrow();
    });
  });

  describe('logAuth', () => {
    it('should log successful authentication', () => {
      expect(() => {
        logAuth('user@example.com', true, 'oauth');
      }).not.toThrow();
    });

    it('should log failed authentication', () => {
      expect(() => {
        logAuth('user@example.com', false, 'oauth');
      }).not.toThrow();
    });
  });

  describe('base logger', () => {
    it('should have all standard log methods', () => {
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.fatal).toBeDefined();
      expect(logger.trace).toBeDefined();
    });

    it('should support child logger creation', () => {
      const child = logger.child({ test: true });
      expect(child).toBeDefined();
      expect(child.info).toBeDefined();
    });
  });
});
