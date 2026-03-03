import { Elysia, t } from 'elysia';

const TemplateShape = t.Object({
  name:        t.String(),
  description: t.Optional(t.String()),
  category:    t.Optional(t.String()),
  author:      t.Optional(t.String()),
  dashboard:   t.Any(),
});

export const templateModels = new Elysia({ name: 'template.models' })
  .model({
    'template.create':   TemplateShape,
    'template.update':   t.Partial(TemplateShape),
    'template.item':     TemplateShape,
    'template.response': t.Object({
      success:  t.Boolean(),
      filename: t.Optional(t.String()),
      template: t.Optional(TemplateShape),
    }),
    'template.list': t.Object({
      success:   t.Boolean(),
      templates: t.Array(TemplateShape),
      count:     t.Optional(t.Number()),
    }),
  });
