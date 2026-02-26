import { useState, useEffect } from 'react';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
import { fetchWidgetData } from '@lib/api';
import type { Widget } from '@lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  MatrixController,
  MatrixElement
);

interface HeatmapWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface HeatmapData {
  rows: string[];
  cols: string[];
  values: number[][];
  colorScale?: { min: string; max: string };
  timestamp: string;
}

export default function HeatmapWidget({
  widget,
  refreshInterval = 10000,
}: HeatmapWidgetProps) {
  const [data, setData] = useState<HeatmapData | null>(null);
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
          <div className="text-red-400 text-sm">Error loading heatmap</div>
        </div>
      </div>
    );
  }

  if (!data || !data.values || data.values.length === 0) {
    return null;
  }

  // Transform matrix data to Chart.js format
  const chartData: any = {
    datasets: [{
      label: widget.title,
      data: data.values.flatMap((row, y) =>
        row.map((value, x) => ({
          x: data.cols[x],
          y: data.rows[y],
          v: value,
        }))
      ),
      backgroundColor(context: any) {
        const value = context.dataset.data[context.dataIndex]?.v;
        if (value === undefined) return 'transparent';

        const allValues = context.dataset.data.map((d: any) => d.v);
        const min = Math.min(...allValues);
        const max = Math.max(...allValues);
        const normalized = (value - min) / (max - min);

        // Color scale: purple (low) -> pink (high)
        const r = Math.round(61 + normalized * (255 - 61));
        const g = Math.round(31 + normalized * (155 - 31));
        const b = Math.round(92 + normalized * (211 - 92));

        return `rgb(${r}, ${g}, ${b})`;
      },
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      width: ({ chart }: any) => (chart.chartArea || {}).width / data.cols.length - 1,
      height: ({ chart }: any) => (chart.chartArea || {}).height / data.rows.length - 1,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgb(26, 15, 46)',
        titleColor: 'rgb(244, 223, 255)',
        bodyColor: 'rgb(244, 223, 255)',
        borderColor: 'rgb(255, 155, 211)',
        borderWidth: 2,
        padding: 12,
        callbacks: {
          title(context: any) {
            const item = context[0];
            return `${item.raw.y} / ${item.raw.x}`;
          },
          label(context: any) {
            return `Value: ${context.raw.v}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'category' as const,
        labels: data.cols,
        ticks: {
          color: 'rgb(244, 223, 255)',
          font: { size: 10 },
        },
        grid: { display: false },
      },
      y: {
        type: 'category' as const,
        labels: data.rows,
        ticks: {
          color: 'rgb(244, 223, 255)',
          font: { size: 10 },
        },
        grid: { display: false },
      },
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
      <h3 className="text-sm font-medium text-slate-400 mb-3">{widget.title}</h3>

      <div className="flex-1 min-h-0">
        <Chart type="matrix" data={chartData} options={options} />
      </div>
    </div>
  );
}
