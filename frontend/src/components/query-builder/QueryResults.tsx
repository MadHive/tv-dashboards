import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { QueryResult } from '@/types/dashboard';

interface QueryResultsProps {
  sql: string;
  onExecute: (sql: string) => Promise<QueryResult>;
  onSave?: (sql: string) => void;
}

export function QueryResults({ sql, onExecute, onSave }: QueryResultsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  const handleTest = async () => {
    if (!sql || sql.trim().length === 0) {
      setError('Please generate a valid SQL query first');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const queryResult = await onExecute(sql);
      setResult(queryResult);
      setCurrentPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute query');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (onSave && sql) {
      onSave(sql);
    }
  };

  const totalPages = result
    ? Math.ceil(result.rows.length / rowsPerPage)
    : 0;

  const paginatedRows = result
    ? result.rows.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
      )
    : [];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-tv-lg font-semibold text-madhive-pink">
          Query Results
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={loading || !sql}
            className="px-4 py-2 bg-madhive-purple-dark hover:bg-madhive-purple-medium disabled:opacity-50 disabled:cursor-not-allowed text-madhive-chalk rounded transition-colors text-tv-sm font-medium"
          >
            {loading ? 'Running...' : 'Test Query'}
          </button>
          {onSave && (
            <button
              onClick={handleSave}
              disabled={!sql || !!error}
              className="px-4 py-2 bg-madhive-pink text-madhive-purple-deepest rounded hover:bg-madhive-pink/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-tv-sm font-medium"
            >
              Save Query
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-madhive-pink border-t-transparent"></div>
          <div className="mt-4 text-madhive-chalk/60">
            Executing query...
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/50 rounded">
          <div className="flex items-start gap-2">
            <span className="text-red-400 font-bold">✕</span>
            <div className="flex-1">
              <div className="text-tv-base font-semibold text-red-400 mb-1">
                Query Error
              </div>
              <div className="text-tv-sm text-red-300">{error}</div>
            </div>
          </div>
        </div>
      )}

      {result && !loading && (
        <div>
          {/* Result Summary */}
          <div className="mb-4 flex items-center gap-4">
            <Badge variant="success">
              {result.rowCount} row{result.rowCount !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="default">
              {result.columns.length} column{result.columns.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Results Table */}
          {result.rows.length > 0 ? (
            <>
              <div className="overflow-x-auto border border-madhive-purple-medium rounded">
                <table className="w-full text-tv-sm">
                  <thead className="bg-madhive-purple-dark">
                    <tr>
                      {result.columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2 text-left text-madhive-pink font-semibold border-b border-madhive-purple-medium"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-madhive-purple-deepest">
                    {paginatedRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-madhive-purple-medium/50 hover:bg-madhive-purple-dark/30"
                      >
                        {result.columns.map((col) => (
                          <td
                            key={col}
                            className="px-3 py-2 text-madhive-chalk"
                          >
                            {row[col] === null || row[col] === undefined ? (
                              <span className="text-madhive-chalk/40 italic">
                                null
                              </span>
                            ) : typeof row[col] === 'object' ? (
                              JSON.stringify(row[col])
                            ) : (
                              String(row[col])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-tv-sm text-madhive-chalk/60">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-madhive-purple-dark hover:bg-madhive-purple-medium disabled:opacity-30 disabled:cursor-not-allowed text-madhive-chalk rounded transition-colors text-tv-sm"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-madhive-purple-dark hover:bg-madhive-purple-medium disabled:opacity-30 disabled:cursor-not-allowed text-madhive-chalk rounded transition-colors text-tv-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-madhive-chalk/60">
              Query executed successfully but returned no rows
            </div>
          )}
        </div>
      )}

      {!loading && !error && !result && (
        <div className="text-center py-12 text-madhive-chalk/60">
          Click "Test Query" to execute and view results
        </div>
      )}
    </Card>
  );
}
