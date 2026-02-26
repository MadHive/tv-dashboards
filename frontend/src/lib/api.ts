// Type definitions matching backend schema
export interface DashboardConfig {
  dashboards: Dashboard[];
  global: GlobalConfig;
}

export interface GlobalConfig {
  title: string;
  rotation_interval: number;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  grid: GridConfig;
  widgets: Widget[];
}

export interface GridConfig {
  columns: number;
  rows: number;
  gap: number;
}

export type WidgetType =
  | 'big-number'
  | 'stat-card'
  | 'gauge'
  | 'bar-chart'
  | 'line-chart'
  | 'table'
  | 'list'
  | 'map'
  | 'sparkline'
  | 'heatmap'
  | 'multi-metric-card'
  | 'stacked-bar-chart'
  | 'sankey'
  | 'treemap';

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  source: string;
  position: WidgetPosition;
  [key: string]: any; // Allow additional properties
}

export interface WidgetPosition {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

/**
 * Fetch dashboard configuration from API
 */
export const fetchDashboardConfig = async (): Promise<DashboardConfig> => {
  const res = await fetch('/api/config');
  if (!res.ok) {
    throw new Error('Failed to fetch config');
  }
  return res.json();
};

/**
 * Update a dashboard
 */
export const updateDashboard = async (
  id: string,
  dashboard: Dashboard
): Promise<void> => {
  const res = await fetch(`/api/dashboards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dashboard),
  });

  if (!res.ok) {
    throw new Error('Failed to update dashboard');
  }
};

/**
 * Fetch widget data from data source
 */
export const fetchWidgetData = async (widgetId: string): Promise<any> => {
  const res = await fetch(`/api/data/${widgetId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch data for widget ${widgetId}`);
  }
  return res.json();
};
