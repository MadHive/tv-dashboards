import type { Table } from '@/types/dashboard';
import type {
  Filter,
  FilterOperator,
  LogicalOperator,
} from '@/types/query-builder';
import { Card } from '@/components/ui/Card';

interface FilterBuilderProps {
  tables: Table[];
  filters: Filter[];
  onFiltersChange: (filters: Filter[]) => void;
}

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: '=', label: 'Equals (=)' },
  { value: '!=', label: 'Not Equals (!=)' },
  { value: '>', label: 'Greater Than (>)' },
  { value: '<', label: 'Less Than (<)' },
  { value: '>=', label: 'Greater or Equal (>=)' },
  { value: '<=', label: 'Less or Equal (<=)' },
  { value: 'LIKE', label: 'Like' },
  { value: 'NOT LIKE', label: 'Not Like' },
  { value: 'IN', label: 'In' },
  { value: 'NOT IN', label: 'Not In' },
  { value: 'BETWEEN', label: 'Between' },
  { value: 'IS NULL', label: 'Is Null' },
  { value: 'IS NOT NULL', label: 'Is Not Null' },
];

export function FilterBuilder({
  tables,
  filters,
  onFiltersChange,
}: FilterBuilderProps) {
  const addFilter = () => {
    const newFilter: Filter = {
      id: `filter-${Date.now()}`,
      column: '',
      operator: '=',
      value: '',
      logicalOp: filters.length > 0 ? 'AND' : undefined,
    };
    onFiltersChange([...filters, newFilter]);
  };

  const removeFilter = (filterId: string) => {
    onFiltersChange(filters.filter((f) => f.id !== filterId));
  };

  const updateFilter = (filterId: string, updates: Partial<Filter>) => {
    onFiltersChange(
      filters.map((f) => (f.id === filterId ? { ...f, ...updates } : f))
    );
  };

  const availableColumns = tables.flatMap((table) =>
    table.columns.map((col) => ({
      value: `${table.name}.${col.name}`,
      label: `${table.name}.${col.name}`,
      type: col.type,
    }))
  );

  const needsValue = (operator: FilterOperator) =>
    !['IS NULL', 'IS NOT NULL'].includes(operator);

  const needsSecondValue = (operator: FilterOperator) =>
    operator === 'BETWEEN';

  const isArrayValue = (operator: FilterOperator) =>
    ['IN', 'NOT IN'].includes(operator);

  if (tables.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-tv-lg font-semibold text-madhive-pink mb-4">
          Add Filters
        </h3>
        <div className="text-center text-madhive-chalk/60">
          Please select at least one table first
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-tv-lg font-semibold text-madhive-pink">
          Add Filters
        </h3>
        <button
          onClick={addFilter}
          className="px-3 py-1 bg-madhive-pink text-madhive-purple-deepest rounded hover:bg-madhive-pink/80 transition-colors text-tv-sm font-medium"
        >
          + Add Filter
        </button>
      </div>

      {filters.length === 0 ? (
        <div className="text-center text-madhive-chalk/60 py-8">
          No filters added. Click "Add Filter" to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {filters.map((filter, index) => (
            <div
              key={filter.id}
              className="bg-madhive-purple-deepest p-3 rounded border border-madhive-purple-medium"
            >
              {/* Logical Operator (for filters after the first) */}
              {index > 0 && (
                <div className="mb-2">
                  <select
                    value={filter.logicalOp || 'AND'}
                    onChange={(e) =>
                      updateFilter(filter.id, {
                        logicalOp: e.target.value as LogicalOperator,
                      })
                    }
                    className="px-2 py-1 text-tv-sm bg-madhive-purple-dark border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-1 focus:ring-madhive-pink"
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-12 gap-2">
                {/* Column */}
                <div className="col-span-4">
                  <label className="block text-tv-xs text-madhive-chalk/60 mb-1">
                    Column
                  </label>
                  <select
                    value={filter.column}
                    onChange={(e) =>
                      updateFilter(filter.id, { column: e.target.value })
                    }
                    className="w-full px-2 py-1 text-tv-sm bg-madhive-purple-dark border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-1 focus:ring-madhive-pink"
                  >
                    <option value="">Select column...</option>
                    {availableColumns.map((col) => (
                      <option key={col.value} value={col.value}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Operator */}
                <div className="col-span-3">
                  <label className="block text-tv-xs text-madhive-chalk/60 mb-1">
                    Operator
                  </label>
                  <select
                    value={filter.operator}
                    onChange={(e) =>
                      updateFilter(filter.id, {
                        operator: e.target.value as FilterOperator,
                      })
                    }
                    className="w-full px-2 py-1 text-tv-sm bg-madhive-purple-dark border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-1 focus:ring-madhive-pink"
                  >
                    {OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Value */}
                {needsValue(filter.operator) && (
                  <div
                    className={needsSecondValue(filter.operator) ? 'col-span-2' : 'col-span-4'}
                  >
                    <label className="block text-tv-xs text-madhive-chalk/60 mb-1">
                      Value
                    </label>
                    {isArrayValue(filter.operator) ? (
                      <input
                        type="text"
                        value={filter.value}
                        onChange={(e) =>
                          updateFilter(filter.id, { value: e.target.value })
                        }
                        placeholder="val1, val2, val3"
                        className="w-full px-2 py-1 text-tv-sm bg-madhive-purple-dark border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-1 focus:ring-madhive-pink"
                      />
                    ) : (
                      <input
                        type="text"
                        value={filter.value}
                        onChange={(e) =>
                          updateFilter(filter.id, { value: e.target.value })
                        }
                        placeholder="Enter value"
                        className="w-full px-2 py-1 text-tv-sm bg-madhive-purple-dark border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-1 focus:ring-madhive-pink"
                      />
                    )}
                  </div>
                )}

                {/* Second Value (for BETWEEN) */}
                {needsSecondValue(filter.operator) && (
                  <div className="col-span-2">
                    <label className="block text-tv-xs text-madhive-chalk/60 mb-1">
                      And
                    </label>
                    <input
                      type="text"
                      value={filter.value2 || ''}
                      onChange={(e) =>
                        updateFilter(filter.id, { value2: e.target.value })
                      }
                      placeholder="End value"
                      className="w-full px-2 py-1 text-tv-sm bg-madhive-purple-dark border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-1 focus:ring-madhive-pink"
                    />
                  </div>
                )}

                {/* Remove Button */}
                <div className="col-span-1 flex items-end">
                  <button
                    onClick={() => removeFilter(filter.id)}
                    className="w-full px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-tv-sm"
                    title="Remove filter"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
