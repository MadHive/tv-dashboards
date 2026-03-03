// tests/unit/data-source-env-map.test.js
import { describe, it, expect } from 'bun:test';
import { ENV_MAP, getAllowedKeys, isSecure } from '../../server/data-source-env-map.js';

describe('ENV_MAP', () => {
  it('has entries for all major data sources', () => {
    const sources = ['datadog', 'aws', 'vulntrack', 'elasticsearch', 'salesforce'];
    for (const src of sources) {
      expect(ENV_MAP[src]).toBeDefined();
    }
  });

  it('getAllowedKeys returns the env var names for a source', () => {
    const keys = getAllowedKeys('datadog');
    expect(keys).toContain('DATADOG_API_KEY');
    expect(keys).toContain('DATADOG_APP_KEY');
    expect(keys).not.toContain('SESSION_SECRET');
    expect(keys).not.toContain('GOOGLE_CLIENT_SECRET');
  });

  it('getAllowedKeys returns null for unknown source', () => {
    expect(getAllowedKeys('nonexistent')).toBeNull();
  });

  it('isSecure returns true for api key fields', () => {
    expect(isSecure('datadog', 'DATADOG_API_KEY')).toBe(true);
    expect(isSecure('aws', 'AWS_REGION')).toBe(false);
  });
});
