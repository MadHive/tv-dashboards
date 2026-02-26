import { useState, useEffect } from 'react';
import { fetchWidgetData } from '@lib/api';
import type { Widget } from '@lib/api';

interface TableWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface TableHeader {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'status';
}

interface TableData {
  headers: TableHeader[];
  rows: Record<string, any>[];
  // Legacy support
  columns?: string[];
  timestamp: string;
}

export default function TableWidget({
  widget,
  refreshInterval = 10000,
}: TableWidgetProps) {
  const [data, setData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const result = await fetchWidgetData(widget.id);
      setData(result);
      setLoading(false);
    } catch (err) {
      console.error(`Failed to load data for widget ${widget.id}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [widget.id, refreshInterval]);

  if (loading) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-red-900 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <div className="text-red-500 text-2xl mb-2">⚠️</div>
            <div className="text-red-400 text-sm">Error loading table</div>
            <div className="text-slate-500 text-xs mt-1">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Support both new headers format and legacy columns format
  const headers = data.headers || data.columns?.map((col) => ({
    key: col,
    label: col,
    type: 'text' as const,
  })) || [];

  // Convert legacy array rows to object rows if needed
  const rows = Array.isArray(data.rows[0])
    ? data.rows.map((row) =>
        headers.reduce((obj, header, idx) => {
          obj[header.key] = (row as any)[idx];
          return obj;
        }, {} as Record<string, any>)
      )
    : data.rows;

  return (
    <div
      data-widget-id={widget.id}
      style={{
        gridColumn: `span ${widget.position.colSpan}`,
        gridRow: `span ${widget.position.rowSpan}`,
      }}
      className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col hover:border-slate-600 transition-colors"
    >
      <h3 className="text-sm font-medium text-slate-400 mb-3">{widget.title}</h3>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm">
            <tr className="border-b border-slate-700">
              {headers.map((header) => (
                <th
                  key={header.key}
                  className="text-left py-3 px-4 font-semibold text-slate-300 uppercase tracking-wider text-xs"
                >
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-slate-800 last:border-0 hover:bg-slate-700/50 transition-colors"
              >
                {headers.map((header) => (
                  <td
                    key={header.key}
                    className="py-3 px-4 text-slate-200"
                  >
                    {header.type === 'status' && (
                      <span className={`inline-flex items-center gap-2 ${
                        row[header.key] === 'success' ? 'text-emerald-400' :
                        row[header.key] === 'warning' ? 'text-yellow-400' :
                        row[header.key] === 'error' ? 'text-red-400' :
                        'text-slate-400'
                      }`}>
                        <span className="w-2 h-2 rounded-full bg-current" />
                        {row[header.key]}
                      </span>
                    )}
                    {header.type === 'number' && (
                      <span className="tabular-nums">
                        {typeof row[header.key] === 'number'
                          ? row[header.key].toLocaleString()
                          : row[header.key]
                        }
                      </span>
                    )}
                    {(!header.type || header.type === 'text') && row[header.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            No data available
          </div>
        )}
      </div>
    </div>
  );
}
