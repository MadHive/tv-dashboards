import { useState, useEffect } from 'react';
import { fetchWidgetData } from '@lib/api';
import type { Widget } from '@lib/api';

interface StatCardWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface StatCardData {
  value: number | string;
  label?: string;
  icon?: string;
  comparison?: {
    value: number;
    label: string;
  };
  badge?: {
    text: string;
    variant: 'success' | 'warning' | 'error' | 'info';
  };
  // Legacy support
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  timestamp: string;
}

export default function StatCardWidget({
  widget,
  refreshInterval = 10000,
}: StatCardWidgetProps) {
  const [data, setData] = useState<StatCardData | null>(null);
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
        <h3 className="text-xs font-medium text-slate-400 mb-2">{widget.title}</h3>
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
        <h3 className="text-xs font-medium text-slate-400 mb-2">{widget.title}</h3>
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
      className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col hover:border-slate-600 transition-colors hover:shadow-lg hover:shadow-pink-500/10"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-400">{widget.title}</h3>
        {data.badge && (
          <span className={`px-2 py-0.5 text-xs rounded-full border ${badgeColors[data.badge.variant]}`}>
            {data.badge.text}
          </span>
        )}
      </div>

      <div className="flex-1 flex items-center gap-4">
        {data.icon && (
          <div className="text-4xl">{data.icon}</div>
        )}

        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tabular-nums">
              {data.value}
            </span>
            {(data.label || data.unit) && (
              <span className="text-sm text-slate-400">{data.label || data.unit}</span>
            )}
          </div>

          {data.comparison && (
            <div className="text-sm text-slate-500 mt-1">
              {data.comparison.label}:
              <span className={data.comparison.value >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {' '}{data.comparison.value >= 0 ? '+' : ''}{data.comparison.value}%
              </span>
            </div>
          )}
        </div>

        {/* Legacy support for trend */}
        {!data.icon && data.trend && (
          <div className={`text-lg ${
            data.trend === 'up' ? 'text-emerald-400' :
            data.trend === 'down' ? 'text-red-400' :
            'text-slate-400'
          }`}>
            {data.trend === 'up' ? '↗' : data.trend === 'down' ? '↘' : '→'}
          </div>
        )}
      </div>
    </div>
  );
}
