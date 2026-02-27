export interface WidgetPosition {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  position: WidgetPosition;
  dataSource?: string;
  queryId?: string;
  config?: Record<string, any>;
}

export interface DashboardPage {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  widgets: WidgetConfig[];
}

export interface DashboardConfig {
  id: string;
  title: string;
  pages: DashboardPage[];
  rotation?: {
    enabled: boolean;
    interval: number;
  };
  grid?: {
    rows: number;
    cols: number;
  };
}

export interface WidgetData {
  value?: number | string;
  values?: Record<string, any>;
  data?: any[];
  timestamp: string;
  error?: string;
}

export interface Query {
  id: string;
  name: string;
  description?: string;
  dataSource: string;
  sql?: string;
  config?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Schema {
  datasets: Dataset[];
}

export interface Dataset {
  id: string;
  name: string;
  tables: Table[];
}

export interface Table {
  id: string;
  name: string;
  columns: Column[];
}

export interface Column {
  name: string;
  type: string;
  description?: string;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
}
