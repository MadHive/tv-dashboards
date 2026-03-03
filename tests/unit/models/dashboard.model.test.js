import { describe, it, expect } from 'bun:test';
import { t } from 'elysia';
import { Value } from '@sinclair/typebox/value';

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
});
const DashboardCreate = t.Object({
  id: t.String(), name: t.String(),
  subtitle: t.Optional(t.String()), icon: t.Optional(t.String()),
  grid: GridSchema, widgets: t.Array(WidgetConfig),
});

describe('dashboard models', () => {
  it('dashboard.create accepts minimal valid dashboard', () => {
    expect(Value.Check(DashboardCreate, {
      id: 'test', name: 'Test', grid: { columns: 4, rows: 3 }, widgets: [],
    })).toBe(true);
  });
  it('dashboard.create rejects missing required fields', () => {
    expect(Value.Check(DashboardCreate, { id: 'test', grid: { columns: 4, rows: 3 }, widgets: [] })).toBe(false);
  });
  it('widget config validates position', () => {
    expect(Value.Check(WidgetConfig, {
      id: 'w1', type: 'big-number', title: 'Bids', position: { col: 1, row: 1 },
    })).toBe(true);
  });
  it('widget config accepts optional thresholds', () => {
    expect(Value.Check(WidgetConfig, {
      id: 'w1', type: 'gauge', title: 'Uptime',
      position: { col: 1, row: 1 },
      thresholds: { warning: 80, critical: 95 },
    })).toBe(true);
  });
});
