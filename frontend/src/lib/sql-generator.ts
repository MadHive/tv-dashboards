import type {
  QueryBuilderState,
  Filter,
} from '@/types/query-builder';

function escapeIdentifier(identifier: string): string {
  // BigQuery uses backticks for identifiers with special characters
  if (identifier.includes('.') || identifier.includes(' ')) {
    return `\`${identifier}\``;
  }
  return identifier;
}

function escapeValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "\\'")}'`;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (Array.isArray(value)) {
    return `(${value.map(escapeValue).join(', ')})`;
  }
  return String(value);
}

function buildFilterCondition(filter: Filter): string {
  const column = escapeIdentifier(filter.column);
  const operator = filter.operator;

  switch (operator) {
    case 'IS NULL':
    case 'IS NOT NULL':
      return `${column} ${operator}`;

    case 'BETWEEN':
      return `${column} BETWEEN ${escapeValue(filter.value)} AND ${escapeValue(filter.value2)}`;

    case 'IN':
    case 'NOT IN':
      if (Array.isArray(filter.value)) {
        return `${column} ${operator} ${escapeValue(filter.value)}`;
      }
      return `${column} ${operator} (${escapeValue(filter.value)})`;

    case 'LIKE':
    case 'NOT LIKE':
      return `${column} ${operator} ${escapeValue(filter.value)}`;

    default:
      return `${column} ${operator} ${escapeValue(filter.value)}`;
  }
}

function buildWhereClause(filters: Filter[]): string {
  if (filters.length === 0) return '';

  const conditions = filters.map((filter, index) => {
    const condition = buildFilterCondition(filter);
    if (index === 0) return condition;
    const logicalOp = filter.logicalOp || 'AND';
    return `${logicalOp} ${condition}`;
  });

  return `WHERE ${conditions.join('\n  ')}`;
}

export function generateSQL(state: QueryBuilderState): string {
  const {
    selectedTables,
    selectedColumns,
    filters,
    joins,
    groupBy,
    orderBy,
    limit,
  } = state;

  if (selectedTables.length === 0) {
    return '-- Please select at least one table';
  }

  if (selectedColumns.length === 0) {
    return '-- Please select at least one column';
  }

  // SELECT clause
  const selectItems = selectedColumns.map((col) => {
    const fullColumn = `${escapeIdentifier(col.table)}.${escapeIdentifier(col.column.name)}`;

    if (col.aggregation) {
      const aggregated = `${col.aggregation}(${fullColumn})`;
      return col.alias ? `${aggregated} AS ${escapeIdentifier(col.alias)}` : aggregated;
    }

    return col.alias ? `${fullColumn} AS ${escapeIdentifier(col.alias)}` : fullColumn;
  });

  const selectClause = `SELECT\n  ${selectItems.join(',\n  ')}`;

  // FROM clause
  const fromClause = `FROM ${escapeIdentifier(selectedTables[0].id)}`;

  // JOIN clauses
  const joinClauses = joins
    .map(
      (join) =>
        `${join.type} JOIN ${escapeIdentifier(join.table.id)} ON ${escapeIdentifier(join.leftColumn)} = ${escapeIdentifier(join.rightColumn)}`
    )
    .join('\n');

  // WHERE clause
  const whereClause = buildWhereClause(filters);

  // GROUP BY clause
  const groupByClause =
    groupBy.length > 0
      ? `GROUP BY ${groupBy.map(escapeIdentifier).join(', ')}`
      : '';

  // ORDER BY clause
  const orderByClause =
    orderBy.length > 0
      ? `ORDER BY ${orderBy.map((o) => `${escapeIdentifier(o.column)} ${o.direction}`).join(', ')}`
      : '';

  // LIMIT clause
  const limitClause = limit ? `LIMIT ${limit}` : '';

  // Combine all clauses
  const parts = [
    selectClause,
    fromClause,
    joinClauses,
    whereClause,
    groupByClause,
    orderByClause,
    limitClause,
  ].filter(Boolean);

  return parts.join('\n');
}

export function validateSQL(sql: string): { valid: boolean; error?: string } {
  // Basic validation
  if (!sql || sql.trim().length === 0) {
    return { valid: false, error: 'SQL query is empty' };
  }

  if (!sql.trim().toUpperCase().startsWith('SELECT')) {
    return { valid: false, error: 'Query must start with SELECT' };
  }

  // Check for common SQL injection patterns (basic)
  const dangerousPatterns = [
    /;\s*DROP/i,
    /;\s*DELETE/i,
    /;\s*TRUNCATE/i,
    /;\s*ALTER/i,
    /;\s*CREATE/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sql)) {
      return { valid: false, error: 'Query contains potentially dangerous operations' };
    }
  }

  return { valid: true };
}
