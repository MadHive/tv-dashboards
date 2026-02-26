import { useState, useEffect } from 'react';
import { fetchWidgetData } from '@lib/api';
import type { Widget } from '@lib/api';

interface ListWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface ListItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  badge?: {
    text: string;
    variant: 'success' | 'warning' | 'error' | 'info';
  };
  status?: 'success' | 'warning' | 'error' | 'info';
  // Legacy support
  text?: string;
}

interface ListData {
  items: ListItem[];
  timestamp: string;
}

export default function ListWidget({
  widget,
  refreshInterval = 10000,
}: ListWidgetProps) {
  const [data, setData] = useState<ListData | null>(null);
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
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-slate-400 text-sm">Loading...</span>
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
            <div className="text-red-500 text-xl">⚠️</div>
            <div className="text-red-400 text-xs mt-1">Error</div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const statusColors = {
    success: 'border-emerald-500',
    warning: 'border-yellow-500',
    error: 'border-red-500',
    info: 'border-blue-500',
  };

  const badgeColors = {
    success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

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

      <div className="flex-1 overflow-auto space-y-2">
        {data.items.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">
            No items to display
          </div>
        ) : (
          data.items.map((item) => (
          <div
            key={item.id || item.title}
            className={`
              flex items-center gap-3 p-3 rounded-lg
              bg-slate-900/50
              border-l-4 ${item.status ? statusColors[item.status] : 'border-transparent'}
              hover:bg-slate-700/50
              transition-all duration-200
              group
            `}
          >
            {item.icon && (
              <div className="text-2xl flex-shrink-0">
                {item.icon}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium text-slate-200 truncate">
                  {item.title || item.text}
                </div>
                {item.badge && (
                  <span className={`
                    px-2 py-0.5 text-xs rounded-full border flex-shrink-0
                    ${badgeColors[item.badge.variant]}
                  `}>
                    {item.badge.text}
                  </span>
                )}
              </div>

              {item.subtitle && (
                <div className="text-sm text-slate-400 truncate mt-0.5">
                  {item.subtitle}
                </div>
              )}
            </div>

            <div className="text-slate-600 group-hover:text-slate-400 transition-colors">
              →
            </div>
          </div>
          ))
        )}
      </div>
    </div>
  );
}
