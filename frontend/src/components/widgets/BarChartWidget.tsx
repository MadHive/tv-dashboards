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
import type { Widget } from '@lib/api';
import { CHART_ANIMATION_CONFIG } from '@lib/animationUtils';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface BarChartWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
}

interface BarChartData {
  labels: string[];
  datasets: ChartDataset[];
  timestamp: string;
}

export default function BarChartWidget({
  widget,
  refreshInterval = 10000,
}: BarChartWidgetProps) {
  const [data, setData] = useState<BarChartData | null>(null);
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
            <div className="text-red-400 text-sm">Error loading chart</div>
            <div className="text-slate-500 text-xs mt-1">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Transform backend format to Chart.js format if needed
  let chartDataFormat = data;
  if (data.bars && Array.isArray(data.bars)) {
    // Backend returns {bars: [{label, value, color}]} format
    // Transform to Chart.js format
    chartDataFormat = {
      labels: data.bars.map((bar: any) => bar.label),
      datasets: [{
        label: widget.title,
        data: data.bars.map((bar: any) => bar.value),
        backgroundColor: data.bars.map((bar: any) => bar.color || 'rgb(255, 155, 211)'),
      }]
    };
  }

  // Validate data structure
  if (!chartDataFormat.datasets || !Array.isArray(chartDataFormat.datasets) || chartDataFormat.datasets.length === 0) {
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
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
          No chart data available
        </div>
      </div>
    );
  }

  // MadHive brand colors for bars
  const defaultColors = [
    'rgb(255, 155, 211)', // MadHive hot pink (#FF9BD3)
    'rgb(253, 164, 212)', // MadHive soft pink (#FDA4D4)
    'rgb(244, 223, 255)', // MadHive chalk (#F4DFFF)
    'rgb(200, 100, 255)', // Purple accent
    'rgb(255, 120, 200)', // Pink variant
    'rgb(220, 140, 255)', // Light purple
    'rgb(255, 180, 220)', // Pale pink
    'rgb(190, 80, 240)',  // Deep purple
  ];

  // Prepare chart data with colors
  const chartData = {
    labels: chartDataFormat.labels || [],
    datasets: chartDataFormat.datasets.map((dataset, index) => ({
      ...dataset,
      backgroundColor: dataset.backgroundColor ||
        (chartDataFormat.labels.length === 1
          ? defaultColors[index % defaultColors.length]
          : chartDataFormat.labels.map((_, i) => defaultColors[i % defaultColors.length])),
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 8,
      hoverBackgroundColor: dataset.backgroundColor ||
        (chartDataFormat.labels.length === 1
          ? defaultColors[index % defaultColors.length].replace(')', ', 0.8)').replace('rgb', 'rgba')
          : chartDataFormat.labels.map((_, i) =>
              defaultColors[i % defaultColors.length].replace(')', ', 0.8)').replace('rgb', 'rgba')
            )),
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: CHART_ANIMATION_CONFIG,
    plugins: {
      legend: {
        display: data.datasets.length > 1,
        position: 'top' as const,
        labels: {
          color: 'rgb(244, 223, 255)', // madhive-chalk
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
        backgroundColor: 'rgb(26, 15, 46)', // madhive-purple-deep
        titleColor: 'rgb(244, 223, 255)',
        bodyColor: 'rgb(244, 223, 255)',
        borderColor: 'rgb(255, 155, 211)', // madhive-pink
        borderWidth: 2,
        padding: 16,
        displayColors: true,
        titleFont: {
          size: 14,
          weight: 'bold' as const,
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toLocaleString();
            }
            return label;
          }
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: 'rgb(244, 223, 255)',
          font: {
            size: 11,
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(61, 31, 92, 0.5)', // madhive-purple-medium with transparency
          drawBorder: false,
          borderDash: [4, 4],
        },
        ticks: {
          color: 'rgb(244, 223, 255)',
          font: {
            size: 11,
          },
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
