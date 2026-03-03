import { Elysia, t } from 'elysia';

export const commonModels = new Elysia({ name: 'common.models' })
  .model({
    'common.error': t.Object({
      success: t.Literal(false),
      error:   t.String(),
    }),
    'common.success': t.Object({
      success: t.Literal(true),
    }),
  });
