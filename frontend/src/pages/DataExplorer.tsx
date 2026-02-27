import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Query, QueryResult } from '@/types/dashboard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function DataExplorer() {
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<QueryResult | null>(null);
  const [search, setSearch] = useState('');

  // Load all saved queries
  useEffect(() => {
    const loadQueries = async () => {
      try {
        setLoading(true);
        const allQueries = await api.getQueries();
        setQueries(allQueries);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load queries');
      } finally {
        setLoading(false);
      }
    };

    loadQueries();
  }, []);

  const handleRunQuery = async (query: Query) => {
    if (!query.sql) return;

    try {
      setExecuting(true);
      setResults(null);
      setSelectedQuery(query);

      const result = await api.executeQuery(query.dataSource, query.sql);
      setResults(result);
    } catch (err) {
      alert(`Query failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExecuting(false);
    }
  };

  const filteredQueries = queries.filter((q) =>
    search
      ? q.name.toLowerCase().includes(search.toLowerCase()) ||
        q.description?.toLowerCase().includes(search.toLowerCase())
      : true
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-madhive-purple-deepest via-madhive-purple-deep to-madhive-purple-dark flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-madhive-pink border-t-transparent"></div>
          <div className="mt-6 text-tv-xl text-madhive-chalk">
            Loading data sources...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-madhive-purple-deepest via-madhive-purple-deep to-madhive-purple-dark flex items-center justify-center">
        <div className="max-w-2xl p-12 bg-red-900/20 border-2 border-red-500/50 rounded-lg">
          <h2 className="text-tv-2xl font-semibold text-red-400 mb-4">
            Error Loading Data
          </h2>
          <p className="text-tv-lg text-madhive-chalk">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-8 px-8 py-4 bg-madhive-pink text-madhive-purple-deepest text-tv-lg rounded-lg hover:bg-madhive-pink/80 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-madhive-purple-deepest via-madhive-purple-deep to-madhive-purple-dark">
      <div className="container mx-auto px-12 py-12 max-w-7xl">
        {/* Header */}
        <div className="mb-12">
          <a
            href="/app"
            className="inline-block mb-6 text-tv-lg text-madhive-pink hover:text-madhive-pink/80 transition-colors"
          >
            ← Back to Home
          </a>
          <h1 className="text-tv-huge font-display font-bold text-madhive-pink mb-4">
            Data Explorer
          </h1>
          <p className="text-tv-xl text-madhive-chalk/80">
            Browse and visualize available data sources
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Left: Query List */}
          <Card className="p-8">
            <h2 className="text-tv-2xl font-semibold text-madhive-pink mb-6">
              Available Data Sources
            </h2>

            {/* Search */}
            <input
              type="text"
              placeholder="Search data sources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-6 py-4 mb-6 bg-madhive-purple-dark border-2 border-madhive-purple-medium rounded-lg text-tv-lg text-madhive-chalk placeholder-madhive-chalk/40 focus:outline-none focus:ring-2 focus:ring-madhive-pink"
            />

            {/* Query List */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredQueries.map((query) => (
                <button
                  key={query.id}
                  onClick={() => handleRunQuery(query)}
                  disabled={executing}
                  className={`w-full px-6 py-5 border rounded-lg text-left transition-colors disabled:opacity-50 ${
                    selectedQuery?.id === query.id
                      ? 'bg-madhive-pink border-madhive-pink text-madhive-purple-deepest'
                      : 'bg-madhive-purple-dark hover:bg-madhive-purple-medium border-madhive-purple-medium text-madhive-chalk'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-tv-lg font-semibold mb-1">
                        {query.name}
                      </div>
                      {query.description && (
                        <div className={`text-tv-sm ${
                          selectedQuery?.id === query.id
                            ? 'text-madhive-purple-deepest/70'
                            : 'text-madhive-chalk/60'
                        }`}>
                          {query.description}
                        </div>
                      )}
                    </div>
                    <Badge
                      variant="default"
                      className={selectedQuery?.id === query.id ? 'bg-madhive-purple-deepest text-madhive-pink border-madhive-pink' : ''}
                    >
                      {query.dataSource}
                    </Badge>
                  </div>
                </button>
              ))}

              {filteredQueries.length === 0 && (
                <div className="text-center py-12 text-madhive-chalk/60 text-tv-lg">
                  {search ? 'No data sources found' : 'No saved queries available'}
                </div>
              )}
            </div>

            {queries.length === 0 && (
              <div className="mt-8 p-6 bg-madhive-purple-dark/50 border border-madhive-purple-medium rounded-lg">
                <p className="text-tv-base text-madhive-chalk/80">
                  No saved queries found. Queries are stored in <code className="text-madhive-pink">config/queries.yaml</code>
                </p>
              </div>
            )}
          </Card>

          {/* Right: Results */}
          <Card className="p-8">
            <h2 className="text-tv-2xl font-semibold text-madhive-pink mb-6">
              {selectedQuery ? selectedQuery.name : 'Preview'}
            </h2>

            {!selectedQuery && !executing && !results && (
              <div className="flex items-center justify-center h-[600px] text-madhive-chalk/60 text-tv-lg">
                Select a data source to preview
              </div>
            )}

            {executing && (
              <div className="flex flex-col items-center justify-center h-[600px]">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-madhive-pink border-t-transparent"></div>
                <div className="mt-6 text-tv-lg text-madhive-chalk">
                  Running query...
                </div>
              </div>
            )}

            {results && selectedQuery && (
              <div className="space-y-6">
                {/* Result Summary */}
                <div className="p-6 bg-madhive-purple-dark/50 border border-madhive-purple-medium rounded-lg">
                  <div className="text-tv-xl font-semibold text-madhive-pink mb-2">
                    {results.rowCount} rows returned
                  </div>
                  <div className="text-tv-base text-madhive-chalk/80">
                    Query executed successfully
                  </div>
                </div>

                {/* Data Table Preview */}
                {results.rows && results.rows.length > 0 && (
                  <div className="overflow-x-auto">
                    <div className="max-h-[450px] overflow-y-auto border border-madhive-purple-medium rounded-lg">
                      <table className="w-full text-tv-sm">
                        <thead className="bg-madhive-purple-dark sticky top-0">
                          <tr>
                            {results.columns.map((col) => (
                              <th
                                key={col}
                                className="px-4 py-3 text-left text-tv-base font-semibold text-madhive-pink border-b border-madhive-purple-medium"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {results.rows.slice(0, 20).map((row, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-madhive-purple-medium/50 hover:bg-madhive-purple-dark/30"
                            >
                              {results.columns.map((col) => (
                                <td
                                  key={col}
                                  className="px-4 py-3 text-madhive-chalk/90"
                                >
                                  {row[col] !== null && row[col] !== undefined
                                    ? String(row[col])
                                    : <span className="text-madhive-chalk/40">null</span>
                                  }
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {results.rows.length > 20 && (
                      <div className="mt-3 text-tv-sm text-madhive-chalk/60 text-center">
                        Showing first 20 of {results.rowCount} rows
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-4">
                  <button
                    onClick={() => handleRunQuery(selectedQuery)}
                    disabled={executing}
                    className="px-6 py-3 bg-madhive-pink text-madhive-purple-deepest text-tv-lg font-semibold rounded-lg hover:bg-madhive-pink/80 transition-colors disabled:opacity-50"
                  >
                    Run Again
                  </button>
                  <button
                    className="px-6 py-3 bg-madhive-purple-dark border-2 border-madhive-purple-medium text-madhive-chalk text-tv-lg rounded-lg hover:bg-madhive-purple-medium transition-colors"
                    title="Coming soon: Add to dashboard"
                    disabled
                  >
                    Add to Dashboard
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
