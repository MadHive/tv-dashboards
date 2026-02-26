import { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { fetchWidgetData } from '@lib/api';
import { CHART_ANIMATION_CONFIG } from '@lib/animationUtils';
import { getMadHiveChartColors } from '@lib/colorUtils';
import type { Widget } from '@lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface StackedBarChartWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface StackedBarData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
  }[];
  orientation?: 'horizontal' | 'vertical';
  timestamp: string;
}

export default function StackedBarChartWidget({
  widget,
  refreshInterval = 10000,
}: StackedBarChartWidgetProps) {
  const [data, setData] = useState<StackedBarData | null>(null);
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
          <div className="text-red-400 text-sm">Error loading chart</div>
        </div>
      </div>
    );
  }

  if (!data || !data.datasets || data.datasets.length === 0) {
    return null;
  }

  const defaultColors = getMadHiveChartColors();

  const chartData = {
    labels: data.labels || [],
    datasets: data.datasets.map((dataset, index) => ({
      ...dataset,
      backgroundColor: dataset.backgroundColor || defaultColors[index % defaultColors.length],
      borderColor: 'transparent',
      borderRadius: 8,
    })),
  };

  const isHorizontal = data.orientation === 'horizontal';

  const options = {
    indexAxis: isHorizontal ? ('y' as const) : ('x' as const),
    responsive: true,
    maintainAspectRatio: false,
    animation: CHART_ANIMATION_CONFIG,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: 'rgb(244, 223, 255)',
          font: {
            size: 12,
            weight: '500' as const,
          },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgb(26, 15, 46)',
        titleColor: 'rgb(244, 223, 255)',
        bodyColor: 'rgb(244, 223, 255)',
        borderColor: 'rgb(255, 155, 211)',
        borderWidth: 2,
        padding: 16,
        callbacks: {
          footer: (tooltipItems: any) => {
            const total = tooltipItems.reduce((sum: number, item: any) => sum + item.parsed[isHorizontal ? 'x' : 'y'], 0);
            return `Total: ${total.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          color: 'rgba(61, 31, 92, 0.5)',
          drawBorder: false,
          borderDash: [4, 4],
        },
        ticks: {
          color: 'rgb(244, 223, 255)',
          font: { size: 11 },
        },
      },
      y: {
        stacked: true,
        grid: {
          color: isHorizontal ? 'rgba(61, 31, 92, 0.5)' : 'transparent',
          drawBorder: false,
          borderDash: [4, 4],
        },
        ticks: {
          color: 'rgb(244, 223, 255)',
          font: { size: 11 },
        },
        beginAtZero: true,
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
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
