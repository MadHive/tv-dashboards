import { Elysia, t } from 'elysia';

export const queryModels = new Elysia({ name: 'query.models' })
  .model({
    'query.gcp': t.Object({
      id: t.String(), name: t.String(),
      description:  t.Optional(t.String()),
      metricType:   t.String(),
      project:      t.Optional(t.String()),
      timeWindow:   t.Optional(t.Number()),
      aggregation:  t.Optional(t.Any()),
      filters:      t.Optional(t.String()),
      widgetTypes:  t.Optional(t.Array(t.String())),
    }),
    'query.bigquery': t.Object({
      id: t.String(), name: t.String(),
      description:  t.Optional(t.String()),
      sql:          t.String(),
      params:       t.Optional(t.Any()),
      transform:    t.Optional(t.Any()),
      widgetTypes:  t.Optional(t.Array(t.String())),
    }),
    'query.response': t.Object({ success: t.Boolean(), query: t.Any() }),
    'query.list':     t.Object({
      success: t.Boolean(), source: t.Optional(t.String()), queries: t.Array(t.Any()),
    }),
    'query.test-response': t.Object({
      success:       t.Boolean(),
      source:        t.String(),
      message:       t.Optional(t.String()),
      rowCount:      t.Optional(t.Number()),
      results:       t.Optional(t.Array(t.Any())),
      executionTime: t.Optional(t.Number()),
      error:         t.Optional(t.String()),
    }),
  });
