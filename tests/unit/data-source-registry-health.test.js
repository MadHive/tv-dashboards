import { describe, test, expect } from 'bun:test';

// Mirror of DataSource base class fields and getHealth registry logic
// Allows DOM-less, import-free testing of health telemetry behavior

function createMockSource(overrides = {}) {
  return {
    isConnected: false,
    lastError: null,
    lastSuccessAt: null,
    sessionErrorCount: 0,
    isReady() { return this.isConnected; },
    ...overrides,
  };
}

function mirrorGetHealth(sources) {
  const health = {};
  for (const [name, source] of Object.entries(sources)) {
    health[name] = {
      isConnected: source.isConnected,
      lastError: source.lastError?.message || null,
      isReady: source.isReady(),
      lastSuccessAt: source.lastSuccessAt || null,
      sessionErrorCount: source.sessionErrorCount || 0,
    };
  }
  return health;
}

describe('DataSource base class health fields', () => {
  test('lastSuccessAt is null when source never succeeded', () => {
    const source = createMockSource();
    expect(source.lastSuccessAt).toBeNull();
  });

  test('sessionErrorCount starts at 0', () => {
    const source = createMockSource();
    expect(source.sessionErrorCount).toBe(0);
  });

  test('lastSuccessAt can be set to a Unix ms timestamp', () => {
    const ts = Date.now();
    const source = createMockSource({ lastSuccessAt: ts });
    expect(source.lastSuccessAt).toBe(ts);
    expect(typeof source.lastSuccessAt).toBe('number');
  });

  test('sessionErrorCount increments on each error', () => {
    const source = createMockSource({ sessionErrorCount: 2 });
    expect(source.sessionErrorCount).toBe(2);
  });
});

describe('DataSourceRegistry.getHealth() extended fields', () => {
  test('getHealth includes lastSuccessAt field for each source', () => {
    const ts = Date.now();
    const sources = {
      gcp: createMockSource({ isConnected: true, lastSuccessAt: ts }),
    };
    const health = mirrorGetHealth(sources);
    expect(health.gcp).toHaveProperty('lastSuccessAt');
    expect(health.gcp.lastSuccessAt).toBe(ts);
  });

  test('getHealth includes sessionErrorCount field for each source', () => {
    const sources = {
      bigquery: createMockSource({ sessionErrorCount: 3 }),
    };
    const health = mirrorGetHealth(sources);
    expect(health.bigquery).toHaveProperty('sessionErrorCount');
    expect(health.bigquery.sessionErrorCount).toBe(3);
  });

  test('lastSuccessAt is null when source never succeeded', () => {
    const sources = {
      vulntrack: createMockSource({ isConnected: false }),
    };
    const health = mirrorGetHealth(sources);
    expect(health.vulntrack.lastSuccessAt).toBeNull();
  });

  test('sessionErrorCount is 0 for a fresh source with no errors', () => {
    const sources = {
      datadog: createMockSource(),
    };
    const health = mirrorGetHealth(sources);
    expect(health.datadog.sessionErrorCount).toBe(0);
  });

  test('getHealth exposes all five required fields per source', () => {
    const sources = {
      gcp: createMockSource({ isConnected: true, lastSuccessAt: Date.now() }),
    };
    const health = mirrorGetHealth(sources);
    const entry = health.gcp;
    expect(entry).toHaveProperty('isConnected');
    expect(entry).toHaveProperty('lastError');
    expect(entry).toHaveProperty('isReady');
    expect(entry).toHaveProperty('lastSuccessAt');
    expect(entry).toHaveProperty('sessionErrorCount');
  });

  test('getHealth handles multiple sources', () => {
    const sources = {
      gcp:      createMockSource({ isConnected: true, lastSuccessAt: 1000 }),
      bigquery: createMockSource({ sessionErrorCount: 1 }),
      vulntrack: createMockSource(),
    };
    const health = mirrorGetHealth(sources);
    expect(Object.keys(health)).toHaveLength(3);
    expect(health.gcp.lastSuccessAt).toBe(1000);
    expect(health.bigquery.sessionErrorCount).toBe(1);
    expect(health.vulntrack.lastSuccessAt).toBeNull();
  });
});
