import { useState, useMemo } from 'react';
import type { Schema, Table } from '@/types/dashboard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface TableSelectorProps {
  schema: Schema | null;
  selectedTables: Table[];
  onTableToggle: (table: Table) => void;
  maxTables?: number;
}

export function TableSelector({
  schema,
  selectedTables,
  onTableToggle,
  maxTables = 5,
}: TableSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDatasets, setExpandedDatasets] = useState<Set<string>>(
    new Set()
  );

  const filteredSchema = useMemo(() => {
    if (!schema) return null;
    if (!searchTerm) return schema;

    const term = searchTerm.toLowerCase();
    return {
      ...schema,
      datasets: schema.datasets
        .map((dataset) => ({
          ...dataset,
          tables: dataset.tables.filter((table) =>
            table.name.toLowerCase().includes(term)
          ),
        }))
        .filter((dataset) => dataset.tables.length > 0),
    };
  }, [schema, searchTerm]);

  const toggleDataset = (datasetId: string) => {
    setExpandedDatasets((prev) => {
      const next = new Set(prev);
      if (next.has(datasetId)) {
        next.delete(datasetId);
      } else {
        next.add(datasetId);
      }
      return next;
    });
  };

  const isTableSelected = (table: Table) =>
    selectedTables.some((t) => t.id === table.id);

  const canSelectMore = selectedTables.length < maxTables;

  if (!filteredSchema) {
    return (
      <Card className="p-6">
        <div className="text-center text-madhive-chalk/60">
          Loading schema...
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-tv-lg font-semibold text-madhive-pink mb-4">
        Select Tables
      </h3>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search tables..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 bg-madhive-purple-dark border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-2 focus:ring-madhive-pink"
        />
      </div>

      <div className="mb-2 text-tv-sm text-madhive-chalk/60">
        {selectedTables.length} of {maxTables} tables selected
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredSchema.datasets.map((dataset) => (
          <div key={dataset.id} className="border border-madhive-purple-medium rounded">
            <button
              onClick={() => toggleDataset(dataset.id)}
              className="w-full px-3 py-2 flex items-center justify-between bg-madhive-purple-dark hover:bg-madhive-purple-medium transition-colors"
            >
              <span className="text-madhive-chalk font-medium">
                {dataset.name}
              </span>
              <span className="text-madhive-chalk/60">
                {expandedDatasets.has(dataset.id) ? '▼' : '▶'}
              </span>
            </button>

            {expandedDatasets.has(dataset.id) && (
              <div className="p-2 space-y-1">
                {dataset.tables.map((table) => {
                  const selected = isTableSelected(table);
                  const disabled = !selected && !canSelectMore;

                  return (
                    <button
                      key={table.id}
                      onClick={() => !disabled && onTableToggle(table)}
                      disabled={disabled}
                      className={`w-full px-3 py-2 flex items-center justify-between rounded transition-colors ${
                        selected
                          ? 'bg-madhive-pink text-madhive-purple-deepest'
                          : disabled
                            ? 'bg-madhive-purple-deepest/50 text-madhive-chalk/30 cursor-not-allowed'
                            : 'bg-madhive-purple-deepest hover:bg-madhive-purple-deep text-madhive-chalk'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={disabled}
                          onChange={() => {}}
                          className="pointer-events-none"
                        />
                        <span className="text-tv-sm">{table.name}</span>
                      </div>
                      <Badge variant="default">
                        {table.columns.length} cols
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredSchema.datasets.length === 0 && (
        <div className="text-center text-madhive-chalk/60 py-8">
          No tables found matching "{searchTerm}"
        </div>
      )}
    </Card>
  );
}
