import { Elysia, t } from 'elysia';

const WidgetPosition = t.Object({
  col: t.Number(), row: t.Number(),
  colSpan: t.Optional(t.Number()), rowSpan: t.Optional(t.Number()),
});

const GridSchema = t.Object({
  columns: t.Number(), rows: t.Number(), gap: t.Optional(t.Number()),
});

const WidgetConfig = t.Object({
  id: t.String(), type: t.String(), title: t.String(),
  source: t.Optional(t.String()), queryId: t.Optional(t.String()),
  position: WidgetPosition,
  unit: t.Optional(t.String()), min: t.Optional(t.Number()), max: t.Optional(t.Number()),
  thresholds: t.Optional(t.Object({
    warning: t.Optional(t.Number()), critical: t.Optional(t.Number()),
  })),
  mglConfig:  t.Optional(t.Any()),
  mapConfig:  t.Optional(t.Any()),
});

const DashboardShape = t.Object({
  id: t.String(), name: t.String(),
  subtitle: t.Optional(t.String()), icon: t.Optional(t.String()),
  grid: GridSchema, widgets: t.Array(WidgetConfig),
  clientBranding: t.Optional(t.Any()),
  excluded:       t.Optional(t.Boolean()),
});

export const dashboardModels = new Elysia({ name: 'dashboard.models' })
  .model({
    'dashboard.create':   DashboardShape,
    'dashboard.update':   t.Partial(DashboardShape),
    'dashboard.item':     DashboardShape,
    'dashboard.response': t.Object({ success: t.Boolean(), dashboard: DashboardShape }),
    'dashboard.list':     t.Object({
      dashboards: t.Array(DashboardShape),
      dataMode:   t.Optional(t.String()),
      global:     t.Optional(t.Any()),
    }),
    'dashboard.reorder':  t.Object({ order: t.Array(t.String()) }),
    'dashboard.import':   t.Object({ json: t.Any() }),
    'dashboard.export':   t.Object({ dashboard: t.Any() }),
  });
