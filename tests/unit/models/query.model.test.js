import { describe, it, expect } from 'bun:test';
import { t } from 'elysia';
import { Value } from '@sinclair/typebox/value';

const GcpQuery = t.Object({
  id: t.String(), name: t.String(),
  description: t.Optional(t.String()),
  metricType: t.String(),
  project: t.Optional(t.String()),
  timeWindow: t.Optional(t.Number()),
  aggregation: t.Optional(t.Any()),
  widgetTypes: t.Optional(t.Array(t.String())),
});

const BigQueryQuery = t.Object({
  id: t.String(), name: t.String(),
  description: t.Optional(t.String()),
  sql: t.String(),
  params: t.Optional(t.Any()),
  transform: t.Optional(t.Any()),
  widgetTypes: t.Optional(t.Array(t.String())),
});

describe('query models', () => {
  it('query.gcp accepts valid GCP query', () => {
    expect(Value.Check(GcpQuery, {
      id: 'q1', name: 'Request Count',
      metricType: 'run.googleapis.com/request_count',
    })).toBe(true);
  });
  it('query.gcp rejects missing metricType', () => {
    expect(Value.Check(GcpQuery, { id: 'q1', name: 'Bad' })).toBe(false);
  });
  it('query.bigquery accepts valid SQL query', () => {
    expect(Value.Check(BigQueryQuery, {
      id: 'bq1', name: 'Orders', sql: 'SELECT COUNT(*) FROM orders',
    })).toBe(true);
  });
  it('query.bigquery rejects missing sql', () => {
    expect(Value.Check(BigQueryQuery, { id: 'bq1', name: 'Bad' })).toBe(false);
  });
});
