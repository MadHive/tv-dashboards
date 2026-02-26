import { useState, useEffect } from 'react';
import { fetchWidgetData } from '@lib/api';
import type { Widget } from '@lib/api';

interface GaugeWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface GaugeData {
  value: number | string; // Can be number or pre-formatted string
  unit?: string;
  min?: number;
  max?: number;
  timestamp: string;
}

export default function GaugeWidget({
  widget,
  refreshInterval = 10000,
}: GaugeWidgetProps) {
  const [data, setData] = useState<GaugeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [animatedOffset, setAnimatedOffset] = useState(Math.PI * 45); // Initialize to full circumference

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

  // Animate arc fill when data changes
  useEffect(() => {
    if (!data) return;

    const numericValue = typeof data.value === 'string'
      ? parseFloat(data.value.replace(/[^0-9.]/g, ''))
      : data.value;

    const min = data.min ?? widget.min ?? 0;
    const max = data.max ?? widget.max ?? 100;
    const percentage = ((numericValue - min) / (max - min)) * 100;
    const clampedPercentage = Math.max(0, Math.min(100, percentage));

    const radius = 45;
    const circumference = Math.PI * radius;
    const targetOffset = circumference - (clampedPercentage / 100) * circumference;

    // Animate from current to target
    const startOffset = animatedOffset;
    const duration = 800;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      const current = startOffset + (targetOffset - startOffset) * eased;
      setAnimatedOffset(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [data, widget.min, widget.max, animatedOffset]);

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

  // Parse numeric value from string if needed
  const numericValue = typeof data.value === 'string'
    ? parseFloat(data.value.replace(/[^0-9.]/g, ''))
    : data.value;

  const min = data.min ?? widget.min ?? 0;
  const max = data.max ?? widget.max ?? 100;
  const percentage = ((numericValue - min) / (max - min)) * 100;
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  // SVG arc calculation for semi-circle gauge
  const radius = 45;
  const strokeWidth = 8;
  const circumference = Math.PI * radius;
  const offset = circumference - (clampedPercentage / 100) * circumference;

  // MadHive colors based on percentage
  let color = 'rgb(255, 155, 211)'; // MadHive hot pink (good)
  if (clampedPercentage > 80) {
    color = 'rgb(253, 164, 212)'; // MadHive soft pink (high)
  } else if (clampedPercentage > 60) {
    color = 'rgb(244, 223, 255)'; // MadHive chalk (medium)
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
      <h3 className="text-xs font-medium text-slate-400 mb-2">{widget.title}</h3>

      <div className="flex-1 flex flex-col items-center justify-center">
        <svg width="100%" height="200" viewBox="0 0 120 80" className="max-w-md">
          {/* Background arc */}
          <path
            d={`M 10 70 A ${radius} ${radius} 0 0 1 110 70`}
            fill="none"
            stroke="rgb(51, 65, 85)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Value arc */}
          <path
            d={`M 10 70 A ${radius} ${radius} 0 0 1 110 70`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animatedOffset}
            style={{ transition: 'stroke 0.3s ease' }}
          />
        </svg>

        <div className="text-center -mt-4">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-2xl font-bold text-white tabular-nums">
              {typeof data.value === 'string' ? data.value : Math.round(data.value)}
            </span>
            {data.unit && (
              <span className="text-sm text-slate-400">{data.unit}</span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {min} - {max}
          </div>
        </div>
      </div>
    </div>
  );
}
