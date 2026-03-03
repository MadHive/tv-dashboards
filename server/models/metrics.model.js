import { Elysia, t } from 'elysia';

const GcpDescriptor = t.Object({
  type: t.String(), displayName: t.String(),
  description: t.String(), metricKind: t.String(),
  valueType: t.String(), unit: t.String(),
});

export const metricsModels = new Elysia({ name: 'metrics.models' })
  .model({
    'metrics.dashboard':        t.Record(t.String(), t.Any()),
    'metrics.descriptor-list':  t.Object({
      success:     t.Boolean(),
      project:     t.String(),
      projects:    t.Array(t.String()),
      count:       t.Number(),
      namespaces:  t.Array(t.String()),
      descriptors: t.Array(GcpDescriptor),
    }),
    'metrics.descriptor-error': t.Object({
      success: t.Boolean(),
      error:   t.String(),
      hint:    t.Optional(t.String()),
    }),
    'metrics.numerics-value':   t.Object({
      postfix: t.Optional(t.String()),
      color:   t.Optional(t.String()),
      data:    t.Any(),
    }),
  });
