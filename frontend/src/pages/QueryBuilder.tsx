import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { generateSQL, validateSQL } from '@/lib/sql-generator';
import type { Schema, Table, QueryResult } from '@/types/dashboard';
import type { QueryBuilderState, SelectedColumn, Filter, Join } from '@/types/query-builder';

import { TableSelector } from '@/components/query-builder/TableSelector';
import { ColumnPicker } from '@/components/query-builder/ColumnPicker';
import { FilterBuilder } from '@/components/query-builder/FilterBuilder';
import { JoinConfig } from '@/components/query-builder/JoinConfig';
import { SQLPreview } from '@/components/query-builder/SQLPreview';
import { QueryResults } from '@/components/query-builder/QueryResults';

export function QueryBuilder() {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Query builder state
  const [selectedTables, setSelectedTables] = useState<Table[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<SelectedColumn[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [joins, setJoins] = useState<Join[]>([]);
  const [limit, setLimit] = useState<number>(100);
  const [customSql, setCustomSql] = useState<string | null>(null);

  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [queryId, setQueryId] = useState('');
  const [queryName, setQueryName] = useState('');
  const [queryDescription, setQueryDescription] = useState('');

  // Load schema on mount
  useEffect(() => {
    const loadSchema = async () => {
      try {
        setLoading(true);
        const schemaData = await api.getSchema('bigquery');
        setSchema(schemaData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load schema');
      } finally {
        setLoading(false);
      }
    };

    loadSchema();
  }, []);

  // Generate SQL from visual state
  const generatedSql = useMemo(() => {
    if (customSql) return customSql;

    const state: QueryBuilderState = {
      selectedTables,
      selectedColumns,
      filters,
      joins,
      groupBy: [],
      orderBy: [],
      limit,
    };

    return generateSQL(state);
  }, [selectedTables, selectedColumns, filters, joins, limit, customSql]);

  // Handle table selection
  const handleTableToggle = (table: Table) => {
    const isSelected = selectedTables.some((t) => t.id === table.id);

    if (isSelected) {
      // Remove table and its columns
      setSelectedTables((prev) => prev.filter((t) => t.id !== table.id));
      setSelectedColumns((prev) =>
        prev.filter((col) => col.table !== table.name)
      );
      // Remove joins involving this table
      setJoins((prev) =>
        prev.filter((join) => join.table.id !== table.id)
      );
    } else {
      setSelectedTables((prev) => [...prev, table]);
    }

    // Clear custom SQL when changing tables
    setCustomSql(null);
  };

  // Execute query
  const handleExecuteQuery = async (sql: string): Promise<QueryResult> => {
    const validation = validateSQL(sql);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return api.executeQuery('bigquery', sql);
  };

  // Save query
  const handleSaveQuery = async () => {
    if (!queryId || !queryName) {
      alert('Please provide both Query ID and Query Name');
      return;
    }

    const validation = validateSQL(generatedSql);
    if (!validation.valid) {
      alert(`Invalid SQL: ${validation.error}`);
      return;
    }

    try {
      await api.createQuery('bigquery', {
        name: queryName,
        description: queryDescription,
        dataSource: 'bigquery',
        sql: generatedSql,
      });

      alert('Query saved successfully!');
      setShowSaveDialog(false);

      // Reset form
      setQueryId('');
      setQueryName('');
      setQueryDescription('');
    } catch (err) {
      alert(`Failed to save query: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset the query builder?')) {
      setSelectedTables([]);
      setSelectedColumns([]);
      setFilters([]);
      setJoins([]);
      setLimit(100);
      setCustomSql(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-madhive-purple-deepest via-madhive-purple-deep to-madhive-purple-dark flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-madhive-pink border-t-transparent"></div>
          <div className="mt-4 text-tv-lg text-madhive-chalk">
            Loading schema...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-madhive-purple-deepest via-madhive-purple-deep to-madhive-purple-dark flex items-center justify-center">
        <div className="max-w-lg p-8 bg-red-900/20 border border-red-500/50 rounded-lg">
          <h2 className="text-tv-xl font-semibold text-red-400 mb-2">
            Error Loading Schema
          </h2>
          <p className="text-madhive-chalk">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-madhive-pink text-madhive-purple-deepest rounded hover:bg-madhive-pink/80"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-madhive-purple-deepest via-madhive-purple-deep to-madhive-purple-dark">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-tv-huge font-display font-bold text-madhive-pink mb-2">
            Visual Query Builder
          </h1>
          <p className="text-tv-lg text-madhive-chalk/80">
            Build BigQuery queries visually without writing SQL
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-madhive-purple-dark hover:bg-madhive-purple-medium text-madhive-chalk rounded transition-colors"
            >
              Reset
            </button>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-madhive-chalk text-tv-sm">
              Limit:
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 100))}
                min="1"
                max="10000"
                className="ml-2 w-24 px-2 py-1 bg-madhive-purple-dark border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-1 focus:ring-madhive-pink"
              />
            </label>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Table & Column Selection */}
          <div className="space-y-6">
            <TableSelector
              schema={schema}
              selectedTables={selectedTables}
              onTableToggle={handleTableToggle}
            />

            <ColumnPicker
              tables={selectedTables}
              selectedColumns={selectedColumns}
              onColumnsChange={setSelectedColumns}
            />
          </div>

          {/* Middle Column - Filters & Joins */}
          <div className="space-y-6">
            <FilterBuilder
              tables={selectedTables}
              filters={filters}
              onFiltersChange={setFilters}
            />

            <JoinConfig
              tables={selectedTables}
              joins={joins}
              onJoinsChange={setJoins}
            />
          </div>

          {/* Right Column - SQL & Results */}
          <div className="space-y-6">
            <SQLPreview
              sql={generatedSql}
              onSqlChange={setCustomSql}
              editable={true}
            />

            <QueryResults
              sql={generatedSql}
              onExecute={handleExecuteQuery}
              onSave={() => setShowSaveDialog(true)}
            />
          </div>
        </div>
      </div>

      {/* Save Query Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-madhive-purple-dark border border-madhive-purple-medium rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-tv-xl font-semibold text-madhive-pink mb-4">
              Save Query
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-tv-sm text-madhive-chalk mb-1">
                  Query ID *
                </label>
                <input
                  type="text"
                  value={queryId}
                  onChange={(e) => setQueryId(e.target.value)}
                  placeholder="my-query-id"
                  className="w-full px-3 py-2 bg-madhive-purple-deepest border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-2 focus:ring-madhive-pink"
                />
              </div>

              <div>
                <label className="block text-tv-sm text-madhive-chalk mb-1">
                  Query Name *
                </label>
                <input
                  type="text"
                  value={queryName}
                  onChange={(e) => setQueryName(e.target.value)}
                  placeholder="My Query"
                  className="w-full px-3 py-2 bg-madhive-purple-deepest border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-2 focus:ring-madhive-pink"
                />
              </div>

              <div>
                <label className="block text-tv-sm text-madhive-chalk mb-1">
                  Description
                </label>
                <textarea
                  value={queryDescription}
                  onChange={(e) => setQueryDescription(e.target.value)}
                  placeholder="What does this query do?"
                  rows={3}
                  className="w-full px-3 py-2 bg-madhive-purple-deepest border border-madhive-purple-medium rounded text-madhive-chalk focus:outline-none focus:ring-2 focus:ring-madhive-pink resize-y"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 bg-madhive-purple-deepest hover:bg-madhive-purple-medium text-madhive-chalk rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuery}
                className="px-4 py-2 bg-madhive-pink text-madhive-purple-deepest rounded hover:bg-madhive-pink/80 transition-colors font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
