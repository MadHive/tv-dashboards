import { Elysia, t } from 'elysia';

const ThemeColors = t.Object({
  background: t.Optional(t.String()),
  primary:    t.Optional(t.String()),
  secondary:  t.Optional(t.String()),
  text:       t.Optional(t.String()),
  accent:     t.Optional(t.String()),
});

const ThemeShape = t.Object({
  id:          t.Optional(t.String()),
  name:        t.String(),
  description: t.Optional(t.String()),
  category:    t.Optional(t.String()),
  colors:      t.Optional(ThemeColors),
});

export const themeModels = new Elysia({ name: 'theme.models' })
  .model({
    'theme.create':   ThemeShape,
    'theme.update':   t.Partial(ThemeShape),
    'theme.item':     ThemeShape,
    'theme.response': t.Object({
      success: t.Optional(t.Boolean()),
      theme:   t.Optional(ThemeShape),
    }),
    'theme.list': t.Array(ThemeShape),
  });
