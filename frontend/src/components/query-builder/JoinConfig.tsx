import type { Table } from '@/types/dashboard';
import type { Join, JoinType } from '@/types/query-builder';
import { Card } from '@/components/ui/Card';

interface JoinConfigProps {
  tables: Table[];
  joins: Join[];
  onJoinsChange: (joins: Join[]) => void;
}

const JOIN_TYPES: JoinType[] = ['INNER', 'LEFT', 'RIGHT', 'FULL OUTER'];

export function JoinConfig({ tables, joins, onJoinsChange }: JoinConfigProps) {
  const addJoin = () => {
    if (tables.length < 2) return;

    const newJoin: Join = {
      id: `join-${Date.now()}`,
      type: 'INNER',
      table: tables[1],
      leftColumn: '',
      rightColumn: '',
    };
    onJoinsChange([...joins, newJoin]);
  };

  const removeJoin = (joinId: string) => {
    onJoinsChange(joins.filter((j) => j.id !== joinId));
  };

  const updateJoin = (joinId: string, updates: Partial<Join>) => {
    onJoinsChange(joins.map((j) => (j.id === joinId ? { ...j, ...updates } : j)));
  };

  const getAvailableColumnsForTable = (table: Table) => {
    return table.columns.map((col) => ({
      value: `${table.name}.${col.name}`,
      label: `${table.name}.${col.name}`,
    }));
  };

  const getAllColumns = () => {
    return tables.flatMap((table) =>
      table.columns.map((col) => ({
        value: `${table.name}.${col.name}`,
        label: `${table.name}.${col.name}`,
        tableName: table.name,
      }))
    );
  };

  if (tables.length < 2) {
    return (
      <Card className="p-6">
        <h3 className="text-tv-lg font-semibold text-madhive-pink mb-4">
          Configure Joins
        </h3>
        <div className="text-center text-madhive-chalk/60">
          Please select at least 2 tables to configure joins
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-tv-lg font-semibold text-madhive-pink">
          Configure Joins
        </h3>
        <button
          onClick={addJoin}
          className="px-3 py-1 bg-madhive-pink text-madhive-purple-deepest rounded hover:bg-madhive-pink/80 transition-colors text-tv-sm font-medium"
        >
          + Add Join
        </button>
      </div>

      <div className="mb-4 p-3 bg-madhive-purple-deepest rounded border border-madhive-purple-medium">
        <div className="text-tv-sm text-madhive-chalk/80">
          <span className="font-semibold">Base Table:</span> {tables[0].name}
        </div>
        <div className="text-tv-xs text-madhive-chalk/60 mt-1">
          Additional tables will be joined to this base table or other joined tables
        </div>
      </div>

      {joins.length === 0 ? (
        <div className="text-center text-madhive-chalk/60 py-8">
          No joins configured. Tables will be queried with implicit joins (cross
          join).
        </div>
      ) : (
        <div className="space-y-3">
          {joins.map((join) => {
            const allColumns = getAllColumns();

            return (
              <div
                key={join.id}
                className="bg-madhive-purple-deepest p-4 rounded border border-madhive-purple-medium"
              >
                <div className="grid grid-cols-12 gap-3 items-end">
                  {/* Join Type */}
                  <div className="col-span-2">
                    <label className="block text-tv-xs text-madhive-chalk/60 mb-1">
                      Join Type
                    </label>
                    <select
                      value={join.type}
                      onChange={(e) =>
                        updateJoin(join.id, { type: e.target.value as JoinType })
                      }
                      className="w-full px-2 py-1 text-tv-sm bg-madhive-purple-dark border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-1 focus:ring-madhive-pink"
                    >
                      {JOIN_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Join Table */}
                  <div className="col-span-3">
                    <label className="block text-tv-xs text-madhive-chalk/60 mb-1">
                      Join Table
                    </label>
                    <select
                      value={join.table.id}
                      onChange={(e) => {
                        const table = tables.find((t) => t.id === e.target.value);
                        if (table) {
                          updateJoin(join.id, { table });
                        }
                      }}
                      className="w-full px-2 py-1 text-tv-sm bg-madhive-purple-dark border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-1 focus:ring-madhive-pink"
                    >
                      {tables.slice(1).map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Left Column */}
                  <div className="col-span-3">
                    <label className="block text-tv-xs text-madhive-chalk/60 mb-1">
                      Left Column
                    </label>
                    <select
                      value={join.leftColumn}
                      onChange={(e) =>
                        updateJoin(join.id, { leftColumn: e.target.value })
                      }
                      className="w-full px-2 py-1 text-tv-sm bg-madhive-purple-dark border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-1 focus:ring-madhive-pink"
                    >
                      <option value="">Select column...</option>
                      {allColumns.map((col) => (
                        <option key={col.value} value={col.value}>
                          {col.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Equals Sign */}
                  <div className="col-span-1 text-center text-madhive-chalk text-tv-base font-bold">
                    =
                  </div>

                  {/* Right Column */}
                  <div className="col-span-3">
                    <label className="block text-tv-xs text-madhive-chalk/60 mb-1">
                      Right Column
                    </label>
                    <select
                      value={join.rightColumn}
                      onChange={(e) =>
                        updateJoin(join.id, { rightColumn: e.target.value })
                      }
                      className="w-full px-2 py-1 text-tv-sm bg-madhive-purple-dark border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-1 focus:ring-madhive-pink"
                    >
                      <option value="">Select column...</option>
                      {getAvailableColumnsForTable(join.table).map((col) => (
                        <option key={col.value} value={col.value}>
                          {col.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Remove Button */}
                  <div className="col-span-1">
                    <button
                      onClick={() => removeJoin(join.id)}
                      className="w-full px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-tv-sm"
                      title="Remove join"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Join Preview */}
                {join.leftColumn && join.rightColumn && (
                  <div className="mt-2 p-2 bg-madhive-purple-dark/50 rounded text-tv-xs text-madhive-chalk/80 font-mono">
                    {join.type} JOIN {join.table.name} ON {join.leftColumn} ={' '}
                    {join.rightColumn}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
