import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { fetchWidgetData } from '@lib/api';
import type { Widget } from '@lib/api';
import { CHART_ANIMATION_CONFIG } from '@lib/animationUtils';
import { hexToRgba } from '@lib/colorUtils';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface LineChartWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface ChartDataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string;
  fill?: boolean;
}

interface LineChartData {
  labels: string[];
  datasets: ChartDataset[];
  timestamp: string;
}

export default function LineChartWidget({
  widget,
  refreshInterval = 10000,
}: LineChartWidgetProps) {
  const [data, setData] = useState<LineChartData | null>(null);
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

  // Validate data structure
  if (!data.datasets || !Array.isArray(data.datasets) || data.datasets.length === 0) {
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

  // Default colors for multiple datasets
  // MadHive brand colors for charts
  const defaultColors = [
    'rgb(255, 155, 211)', // MadHive hot pink (#FF9BD3)
    'rgb(253, 164, 212)', // MadHive soft pink (#FDA4D4)
    'rgb(244, 223, 255)', // MadHive chalk (#F4DFFF)
    'rgb(200, 100, 255)', // Purple accent
    'rgb(255, 120, 200)', // Pink variant
  ];

  // Prepare chart data with colors
  const chartData = {
    labels: data.labels || [],
    datasets: data.datasets.map((dataset, index) => {
      const borderColor = dataset.borderColor || defaultColors[index % defaultColors.length];

      // Create gradient background from border color
      const bgColor = borderColor.startsWith('rgb')
        ? borderColor.replace('rgb', 'rgba').replace(')', ', 0.1)')
        : hexToRgba(borderColor, 0.1);

      return {
        ...dataset,
        borderColor,
        backgroundColor: dataset.backgroundColor || bgColor,
        fill: dataset.fill !== undefined ? dataset.fill : true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: borderColor,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        borderWidth: 3,
      };
    }),
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
        displayColors: true,
        intersect: false,
        mode: 'index' as const,
        titleFont: {
          size: 14,
          weight: 'bold' as const,
        },
        bodyFont: {
          size: 13,
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(61, 31, 92, 0.3)',
          drawBorder: false,
          borderDash: [4, 4],
        },
        ticks: {
          color: 'rgb(244, 223, 255)',
          font: {
            size: 11,
          },
          maxRotation: 0,
        },
      },
      y: {
        grid: {
          color: 'rgba(61, 31, 92, 0.5)',
          drawBorder: false,
          borderDash: [4, 4],
        },
        ticks: {
          color: 'rgb(244, 223, 255)',
          font: {
            size: 11,
          },
        },
      },
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
      <h3 className="text-sm font-medium text-slate-400 mb-3">{widget.title}</h3>

      <div className="flex-1 min-h-0">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
