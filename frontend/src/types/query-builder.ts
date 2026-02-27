import type { Table, Column } from './dashboard';

export type FilterOperator =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'LIKE'
  | 'NOT LIKE'
  | 'IN'
  | 'NOT IN'
  | 'BETWEEN'
  | 'IS NULL'
  | 'IS NOT NULL';

export type LogicalOperator = 'AND' | 'OR';

export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL OUTER';

export type AggregationFunction = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';

export interface SelectedColumn {
  table: string;
  column: Column;
  alias?: string;
  aggregation?: AggregationFunction;
}

export interface Filter {
  id: string;
  column: string;
  operator: FilterOperator;
  value: any;
  value2?: any; // For BETWEEN
  logicalOp?: LogicalOperator;
}

export interface Join {
  id: string;
  type: JoinType;
  table: Table;
  leftColumn: string;
  rightColumn: string;
}

export interface OrderBy {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface QueryBuilderState {
  selectedTables: Table[];
  selectedColumns: SelectedColumn[];
  filters: Filter[];
  joins: Join[];
  groupBy: string[];
  orderBy: OrderBy[];
  limit?: number;
}
