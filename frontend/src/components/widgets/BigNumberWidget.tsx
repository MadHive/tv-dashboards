import { useState, useEffect } from 'react';
import { fetchWidgetData } from '@lib/api';
import type { Widget } from '@lib/api';

interface BigNumberWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface BigNumberData {
  value: number | string;
  unit?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  // Legacy support
  delta?: number;
  deltaPercent?: number;
  timestamp: string;
}

export default function BigNumberWidget({
  widget,
  refreshInterval = 10000,
}: BigNumberWidgetProps) {
  const [data, setData] = useState<BigNumberData | null>(null);
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

  const formatNumber = (value: number | string): string => {
    // If value is already formatted as string, return as-is
    if (typeof value === 'string') {
      return value;
    }

    // Otherwise format the number
    if (value >= 1_000_000_000) {
      return (value / 1_000_000_000).toFixed(2) + 'B';
    }
    if (value >= 1_000_000) {
      return (value / 1_000_000).toFixed(2) + 'M';
    }
    if (value >= 1_000) {
      return (value / 1_000).toFixed(2) + 'K';
    }
    return value.toLocaleString();
  };

  if (loading) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-slate-700 rounded-lg p-6 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-4">{widget.title}</h3>
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
        className="bg-slate-800 border border-red-900 rounded-lg p-6 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-4">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <div className="text-red-500 text-2xl mb-2">⚠️</div>
            <div className="text-red-400 text-sm">Error loading data</div>
            <div className="text-slate-500 text-xs mt-1">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

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

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold text-white tabular-nums">
            {formatNumber(data.value)}
          </span>
          {data.unit && (
            <span className="text-2xl text-slate-400">{data.unit}</span>
          )}
        </div>

        {data.trend && (
          <div className={`flex items-center gap-1 mt-2 text-lg ${
            data.trend.direction === 'up' ? 'text-emerald-400' : 'text-red-400'
          }`}>
            <span className="text-2xl">
              {data.trend.direction === 'up' ? '↑' : '↓'}
            </span>
            <span className="font-semibold">
              {Math.abs(data.trend.value)}%
            </span>
          </div>
        )}

        {/* Legacy support for deltaPercent */}
        {!data.trend && data.deltaPercent !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-lg ${
            data.deltaPercent > 0 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            <span className="text-2xl">
              {data.deltaPercent > 0 ? '↑' : '↓'}
            </span>
            <span className="font-semibold">
              {data.deltaPercent > 0 ? '+' : ''}{data.deltaPercent}%
            </span>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500 mt-2">
        Updated {new Date(data.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
