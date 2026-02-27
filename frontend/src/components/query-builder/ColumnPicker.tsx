import { useState } from 'react';
import type { Table } from '@/types/dashboard';
import type { SelectedColumn, AggregationFunction } from '@/types/query-builder';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface ColumnPickerProps {
  tables: Table[];
  selectedColumns: SelectedColumn[];
  onColumnsChange: (columns: SelectedColumn[]) => void;
}

const AGGREGATIONS: AggregationFunction[] = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];

export function ColumnPicker({
  tables,
  selectedColumns,
  onColumnsChange,
}: ColumnPickerProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(
    new Set(tables.map((t) => t.id))
  );

  const toggleTable = (tableId: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  const isColumnSelected = (tableName: string, columnName: string) =>
    selectedColumns.some(
      (col) => col.table === tableName && col.column.name === columnName
    );

  const toggleColumn = (table: Table, columnName: string) => {
    const column = table.columns.find((c) => c.name === columnName);
    if (!column) return;

    const isSelected = isColumnSelected(table.name, columnName);

    if (isSelected) {
      onColumnsChange(
        selectedColumns.filter(
          (col) => !(col.table === table.name && col.column.name === columnName)
        )
      );
    } else {
      onColumnsChange([
        ...selectedColumns,
        { table: table.name, column },
      ]);
    }
  };

  const updateColumnAlias = (
    tableName: string,
    columnName: string,
    alias: string
  ) => {
    onColumnsChange(
      selectedColumns.map((col) =>
        col.table === tableName && col.column.name === columnName
          ? { ...col, alias: alias || undefined }
          : col
      )
    );
  };

  const updateColumnAggregation = (
    tableName: string,
    columnName: string,
    aggregation: AggregationFunction | ''
  ) => {
    onColumnsChange(
      selectedColumns.map((col) =>
        col.table === tableName && col.column.name === columnName
          ? { ...col, aggregation: aggregation || undefined }
          : col
      )
    );
  };

  const moveColumn = (fromIndex: number, toIndex: number) => {
    const newColumns = [...selectedColumns];
    const [removed] = newColumns.splice(fromIndex, 1);
    newColumns.splice(toIndex, 0, removed);
    onColumnsChange(newColumns);
  };

  if (tables.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-tv-lg font-semibold text-madhive-pink mb-4">
          Select Columns
        </h3>
        <div className="text-center text-madhive-chalk/60">
          Please select at least one table first
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-tv-lg font-semibold text-madhive-pink mb-4">
        Select Columns
      </h3>

      <div className="mb-2 text-tv-sm text-madhive-chalk/60">
        {selectedColumns.length} columns selected
      </div>

      {/* Available Columns */}
      <div className="mb-6 max-h-64 overflow-y-auto space-y-2">
        {tables.map((table) => (
          <div
            key={table.id}
            className="border border-madhive-purple-medium rounded"
          >
            <button
              onClick={() => toggleTable(table.id)}
              className="w-full px-3 py-2 flex items-center justify-between bg-madhive-purple-dark hover:bg-madhive-purple-medium transition-colors"
            >
              <span className="text-madhive-chalk font-medium">
                {table.name}
              </span>
              <span className="text-madhive-chalk/60">
                {expandedTables.has(table.id) ? '▼' : '▶'}
              </span>
            </button>

            {expandedTables.has(table.id) && (
              <div className="p-2 space-y-1">
                {table.columns.map((column) => {
                  const selected = isColumnSelected(table.name, column.name);
                  return (
                    <button
                      key={column.name}
                      onClick={() => toggleColumn(table, column.name)}
                      className={`w-full px-3 py-2 flex items-center justify-between rounded transition-colors text-left ${
                        selected
                          ? 'bg-madhive-pink/20 border border-madhive-pink'
                          : 'bg-madhive-purple-deepest hover:bg-madhive-purple-deep'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {}}
                          className="pointer-events-none flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-tv-sm text-madhive-chalk truncate">
                            {column.name}
                          </div>
                          {column.description && (
                            <div className="text-tv-xs text-madhive-chalk/60 truncate">
                              {column.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge variant="default" className="ml-2 flex-shrink-0">
                        {column.type}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Selected Columns Configuration */}
      {selectedColumns.length > 0 && (
        <div className="border-t border-madhive-purple-medium pt-4">
          <h4 className="text-tv-base font-semibold text-madhive-chalk mb-3">
            Column Configuration
          </h4>
          <div className="space-y-2">
            {selectedColumns.map((col, index) => (
              <div
                key={`${col.table}.${col.column.name}`}
                className="bg-madhive-purple-deepest p-3 rounded border border-madhive-purple-medium"
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-tv-sm text-madhive-chalk font-medium truncate">
                      {col.table}.{col.column.name}
                    </div>
                    <div className="text-tv-xs text-madhive-chalk/60">
                      {col.column.type}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => moveColumn(index, Math.max(0, index - 1))}
                      disabled={index === 0}
                      className="px-2 py-1 text-tv-xs bg-madhive-purple-dark hover:bg-madhive-purple-medium disabled:opacity-30 disabled:cursor-not-allowed rounded"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() =>
                        moveColumn(index, Math.min(selectedColumns.length - 1, index + 1))
                      }
                      disabled={index === selectedColumns.length - 1}
                      className="px-2 py-1 text-tv-xs bg-madhive-purple-dark hover:bg-madhive-purple-medium disabled:opacity-30 disabled:cursor-not-allowed rounded"
                      title="Move down"
                    >
                      ↓
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-tv-xs text-madhive-chalk/60 mb-1">
                      Alias
                    </label>
                    <input
                      type="text"
                      value={col.alias || ''}
                      onChange={(e) =>
                        updateColumnAlias(col.table, col.column.name, e.target.value)
                      }
                      placeholder="Optional alias"
                      className="w-full px-2 py-1 text-tv-sm bg-madhive-purple-dark border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-1 focus:ring-madhive-pink"
                    />
                  </div>
                  <div>
                    <label className="block text-tv-xs text-madhive-chalk/60 mb-1">
                      Aggregation
                    </label>
                    <select
                      value={col.aggregation || ''}
                      onChange={(e) =>
                        updateColumnAggregation(
                          col.table,
                          col.column.name,
                          e.target.value as AggregationFunction | ''
                        )
                      }
                      className="w-full px-2 py-1 text-tv-sm bg-madhive-purple-dark border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-1 focus:ring-madhive-pink"
                    >
                      <option value="">None</option>
                      {AGGREGATIONS.map((agg) => (
                        <option key={agg} value={agg}>
                          {agg}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
