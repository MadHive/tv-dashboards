// tests/unit/data-source-env-map.test.js
import { describe, it, expect } from 'bun:test';
import { ENV_MAP, getAllowedKeys, isSecure } from '../../server/data-source-env-map.js';

describe('ENV_MAP', () => {
  it('has entries for all major data sources', () => {
    const sources = ['datadog', 'aws', 'vulntrack', 'elasticsearch', 'salesforce', 'rollbar', 'segment', 'bigquery'];
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

  it('elasticsearch keys match schema envVar names', () => {
    const keys = getAllowedKeys('elasticsearch');
    expect(keys).toContain('ELASTICSEARCH_HOST');
    expect(keys).toContain('ELASTICSEARCH_API_KEY');
    expect(keys).toContain('ELASTICSEARCH_USERNAME');
    expect(keys).toContain('ELASTICSEARCH_PASSWORD');
    // Old wrong key must not be present
    expect(keys).not.toContain('ELASTICSEARCH_URL');
    expect(isSecure('elasticsearch', 'ELASTICSEARCH_HOST')).toBe(false);
    expect(isSecure('elasticsearch', 'ELASTICSEARCH_API_KEY')).toBe(true);
    expect(isSecure('elasticsearch', 'ELASTICSEARCH_PASSWORD')).toBe(true);
  });

  it('salesforce keys match schema envVar names', () => {
    const keys = getAllowedKeys('salesforce');
    expect(keys).toContain('SALESFORCE_INSTANCE_URL');
    expect(keys).toContain('SALESFORCE_SANDBOX');
    expect(keys).toContain('SALESFORCE_ACCESS_TOKEN');
    expect(keys).toContain('SALESFORCE_CLIENT_ID');
    expect(keys).toContain('SALESFORCE_CLIENT_SECRET');
    expect(keys).toContain('SALESFORCE_USERNAME');
    expect(keys).toContain('SALESFORCE_PASSWORD');
    expect(keys).toContain('SALESFORCE_SECURITY_TOKEN');
    expect(isSecure('salesforce', 'SALESFORCE_ACCESS_TOKEN')).toBe(true);
    expect(isSecure('salesforce', 'SALESFORCE_INSTANCE_URL')).toBe(false);
  });

  it('rollbar keys match schema envVar names', () => {
    const keys = getAllowedKeys('rollbar');
    expect(keys).toContain('ROLLBAR_ACCESS_TOKEN');
    expect(keys).toContain('ROLLBAR_PROJECT_ID');
    // Old wrong key must not be present
    expect(keys).not.toContain('ROLLBAR_ACCOUNT_TOKEN');
    expect(isSecure('rollbar', 'ROLLBAR_ACCESS_TOKEN')).toBe(true);
    expect(isSecure('rollbar', 'ROLLBAR_PROJECT_ID')).toBe(false);
  });

  it('segment keys match schema envVar names', () => {
    const keys = getAllowedKeys('segment');
    expect(keys).toContain('SEGMENT_ACCESS_TOKEN');
    expect(keys).toContain('SEGMENT_WORKSPACE_ID');
    // Old wrong key must not be present
    expect(keys).not.toContain('SEGMENT_WRITE_KEY');
    expect(isSecure('segment', 'SEGMENT_ACCESS_TOKEN')).toBe(true);
    expect(isSecure('segment', 'SEGMENT_WORKSPACE_ID')).toBe(false);
  });

  it('bigquery entry covers the credentials envVar from schema', () => {
    const keys = getAllowedKeys('bigquery');
    expect(keys).toContain('GOOGLE_APPLICATION_CREDENTIALS');
    expect(isSecure('bigquery', 'GOOGLE_APPLICATION_CREDENTIALS')).toBe(true);
  });
});
