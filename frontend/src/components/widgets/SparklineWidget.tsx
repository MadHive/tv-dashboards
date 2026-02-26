import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { fetchWidgetData } from '@lib/api';
import type { Widget } from '@lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

interface SparklineWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface SparklineData {
  values: number[];
  trend?: 'up' | 'down' | 'flat';
  timestamp: string;
}

export default function SparklineWidget({
  widget,
  refreshInterval = 10000,
}: SparklineWidgetProps) {
  const [data, setData] = useState<SparklineData | null>(null);
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
          <div className="text-red-400 text-xs">Error loading sparkline</div>
        </div>
      </div>
    );
  }

  if (!data || !data.values || data.values.length === 0) {
    return null;
  }

  // Determine trend color
  const trendColor = data.trend === 'up'
    ? 'rgb(255, 155, 211)' // pink
    : data.trend === 'down'
    ? 'rgb(252, 165, 165)' // red
    : 'rgb(148, 163, 184)'; // gray

  const chartData = {
    labels: data.values.map((_, i) => i.toString()),
    datasets: [{
      data: data.values,
      borderColor: trendColor,
      backgroundColor: trendColor.replace(')', ', 0.1)').replace('rgb', 'rgba'),
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: trendColor,
      borderWidth: 2,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgb(26, 15, 46)',
        titleColor: 'rgb(244, 223, 255)',
        bodyColor: 'rgb(244, 223, 255)',
        borderColor: trendColor,
        borderWidth: 1,
        padding: 8,
        displayColors: false,
        callbacks: {
          title: () => '',
          label: (context: any) => `Value: ${context.parsed.y}`,
        },
      },
    },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
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
      <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>

      <div className="flex-1 min-h-0" style={{ height: '60px' }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
