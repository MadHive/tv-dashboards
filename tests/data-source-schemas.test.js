// tests/data-source-schemas.test.js
import { describe, it, expect } from 'bun:test';
import { getSchema, getAllSchemas, validateConnection } from '../server/data-source-schemas.js';

describe('Data Source Schemas', () => {
  it('should get schema for bigquery', () => {
    const schema = getSchema('bigquery');

    expect(schema).toBeDefined();
    expect(schema.id).toBe('bigquery');
    expect(schema.name).toBe('Google BigQuery');
    expect(schema.fields.length).toBeGreaterThan(0);
  });

  it('should get all schemas', () => {
    const schemas = getAllSchemas();

    expect(schemas.length).toBe(3);
    expect(schemas.map(s => s.id)).toContain('bigquery');
    expect(schemas.map(s => s.id)).toContain('gcp-monitoring');
    expect(schemas.map(s => s.id)).toContain('mock');
  });

  it('should validate BigQuery connection', () => {
    // Invalid: missing required fields
    const invalid = validateConnection('bigquery', {});
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.name).toBeDefined();
    expect(invalid.errors.projectId).toBeDefined();

    // Valid: all required fields present
    const valid = validateConnection('bigquery', {
      name: 'My Connection',
      projectId: 'my-project-123'
    });
    expect(valid.valid).toBe(true);
    expect(Object.keys(valid.errors).length).toBe(0);
  });

  it('should validate GCP project ID format', () => {
    const invalid = validateConnection('bigquery', {
      name: 'Test',
      projectId: 'INVALID_PROJECT'  // uppercase not allowed
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.projectId).toContain('Invalid GCP project ID');

    const valid = validateConnection('bigquery', {
      name: 'Test',
      projectId: 'valid-project-123'
    });
    expect(valid.valid).toBe(true);
  });

  it('should validate number ranges', () => {
    const tooLow = validateConnection('mock', {
      name: 'Test',
      delay: -10
    });
    expect(tooLow.valid).toBe(false);
    expect(tooLow.errors.delay).toContain('at least 0');

    const tooHigh = validateConnection('mock', {
      name: 'Test',
      errorRate: 150
    });
    expect(tooHigh.valid).toBe(false);
    expect(tooHigh.errors.errorRate).toContain('at most 100');
  });
});
