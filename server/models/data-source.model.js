import { Elysia, t } from 'elysia';
import { createInsertSchema, createSelectSchema } from 'drizzle-typebox';
import { dataSourceConfigs } from '../db/schema.js';

export const dataSourceModels = new Elysia({ name: 'datasource.models' })
  .model({
    'datasource.config': createInsertSchema(dataSourceConfigs),
    'datasource.select': createSelectSchema(dataSourceConfigs),
    'datasource.list':   t.Object({
      success: t.Boolean(),
      sources: t.Array(t.Object({
        name:        t.String(),
        isConnected: t.Boolean(),
        isReady:     t.Boolean(),
        lastError:   t.Optional(t.Nullable(t.String())),
      })),
    }),
    'datasource.test-response': t.Object({
      success:   t.Boolean(),
      connected: t.Boolean(),
      message:   t.Optional(t.String()),
    }),
    'datasource.health': t.Object({
      success: t.Boolean(),
      health: t.Record(t.String(), t.Object({
        isConnected:       t.Boolean(),
        lastError:         t.Optional(t.Nullable(t.String())),
        isReady:           t.Boolean(),
        lastSuccessAt:     t.Optional(t.Nullable(t.Number())),
        sessionErrorCount: t.Optional(t.Nullable(t.Number())),
      })),
    }),
  });
