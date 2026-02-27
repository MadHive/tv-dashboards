// ===========================================================================
// Mock Factories — Mock external services for testing
// Following Elysia.js best practices: mock external dependencies
// ===========================================================================

/**
 * Mock GCP Cloud Monitoring API
 * Returns mock monitoring client with common methods
 */
export function mockGCPMonitoring(customResponses = {}) {
  const defaultTimeSeries = {
    timeSeries: [
      {
        metric: { type: 'run.googleapis.com/request_count' },
        points: [
          {
            interval: { endTime: { seconds: Date.now() / 1000 } },
            value: { doubleValue: 1234.5 }
          }
        ]
      }
    ]
  };

  return {
    projectPath: (project) => `projects/${project}`,

    listTimeSeries: async (request) => {
      if (customResponses.listTimeSeries) {
        return customResponses.listTimeSeries(request);
      }
      return [defaultTimeSeries];
    },

    createTimeSeries: async (request) => {
      if (customResponses.createTimeSeries) {
        return customResponses.createTimeSeries(request);
      }
      return {};
    }
  };
}

/**
 * Mock BigQuery API
 * Returns mock BigQuery client
 */
export function mockBigQuery(customResponses = {}) {
  const defaultQueryResult = [
    [
      { value: 100, label: 'Test Data' },
      { value: 200, label: 'More Data' }
    ]
  ];

  return {
    query: async (options) => {
      if (customResponses.query) {
        return customResponses.query(options);
      }
      return defaultQueryResult;
    },

    dataset: (datasetId) => ({
      table: (tableId) => ({
        exists: async () => [true],
        get: async () => [{ id: tableId }]
      })
    })
  };
}

/**
 * Mock File System Operations
 * Returns mock fs functions with in-memory storage
 */
export function mockFileSystem() {
  const files = new Map();
  const directories = new Set();

  return {
    files, // Expose for test assertions
    directories, // Expose for test assertions

    readFileSync: (path, encoding) => {
      if (!files.has(path)) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      }
      return files.get(path);
    },

    writeFileSync: (path, content, encoding) => {
      files.set(path, content);
    },

    existsSync: (path) => {
      return files.has(path) || directories.has(path);
    },

    unlinkSync: (path) => {
      if (!files.has(path)) {
        throw new Error(`ENOENT: no such file or directory, unlink '${path}'`);
      }
      files.delete(path);
    },

    readdirSync: (path) => {
      const prefix = path.endsWith('/') ? path : `${path}/`;
      return Array.from(files.keys())
        .filter(f => f.startsWith(prefix))
        .map(f => f.replace(prefix, '').split('/')[0])
        .filter((v, i, a) => a.indexOf(v) === i); // unique
    },

    mkdirSync: (path, options) => {
      directories.add(path);
    }
  };
}

/**
 * Mock OAuth Client
 * Returns mock Google OAuth client
 */
export function mockOAuthClient(customResponses = {}) {
  return {
    getToken: async (code) => {
      if (customResponses.getToken) {
        return customResponses.getToken(code);
      }
      return {
        tokens: {
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token',
          expiry_date: Date.now() + 3600000
        }
      };
    },

    setCredentials: (tokens) => {
      // No-op for mock
    },

    request: async (options) => {
      if (customResponses.request) {
        return customResponses.request(options);
      }
      return {
        data: {
          email: 'test@example.com',
          name: 'Test User'
        }
      };
    }
  };
}

/**
 * Create mock data source
 * Generic mock for any data source plugin
 */
export function createMockDataSource(name, overrides = {}) {
  return {
    name,
    isConnected: false,

    async initialize() {
      this.isConnected = true;
    },

    isReady() {
      return this.isConnected;
    },

    async testConnection() {
      return this.isConnected;
    },

    async fetchMetrics(widget, dashboard) {
      if (overrides.fetchMetrics) {
        return overrides.fetchMetrics(widget, dashboard);
      }

      // Return mock data based on widget type
      return {
        value: Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString()
      };
    },

    getConfigSchema() {
      return overrides.schema || {
        type: 'object',
        properties: {
          apiKey: { type: 'string' }
        }
      };
    },

    getAvailableMetrics() {
      return overrides.metrics || [
        { id: 'metric1', name: 'Test Metric 1' },
        { id: 'metric2', name: 'Test Metric 2' }
      ];
    },

    ...overrides
  };
}

/**
 * Mock Data Source Registry
 * Returns mock registry for testing
 */
export function mockDataSourceRegistry(sources = []) {
  const sourcesMap = new Map();

  sources.forEach(source => {
    sourcesMap.set(source.name, source);
  });

  return {
    sources: sourcesMap,
    initialized: true,

    async initialize() {
      this.initialized = true;
    },

    register(source) {
      sourcesMap.set(source.name, source);
    },

    getSource(name) {
      const source = sourcesMap.get(name);
      if (!source) {
        throw new Error(`Data source not found: ${name}`);
      }
      return source;
    },

    getAllSources() {
      return Array.from(sourcesMap.values());
    },

    getSchemas() {
      const schemas = {};
      sourcesMap.forEach((source, name) => {
        schemas[name] = source.getConfigSchema();
      });
      return schemas;
    },

    getHealth() {
      const health = {};
      sourcesMap.forEach((source, name) => {
        health[name] = {
          connected: source.isConnected,
          ready: source.isReady()
        };
      });
      return health;
    },

    getAvailableMetrics(sourceName) {
      const source = this.getSource(sourceName);
      return source.getAvailableMetrics();
    },

    async testConnection(sourceName) {
      const source = this.getSource(sourceName);
      return source.testConnection();
    },

    async fetchDashboardMetrics(dashboardId, dashboard) {
      const metrics = {};

      for (const widget of dashboard.widgets) {
        const source = sourcesMap.get(widget.source);
        if (source) {
          metrics[widget.id] = await source.fetchMetrics(widget, dashboard);
        }
      }

      return metrics;
    }
  };
}
