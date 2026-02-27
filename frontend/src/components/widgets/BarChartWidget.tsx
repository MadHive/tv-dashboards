import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { formatNumber } from '@/lib/utils';
import { useWidgetData } from '@/hooks/useApi';
import type { WidgetConfig } from '@/types/dashboard';

interface BarChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
  }[];
  timestamp: string;
}

interface BarChartWidgetProps {
  config: WidgetConfig;
}

// MadHive color palette for datasets
const COLORS = ['#FF9BD3', '#FFC8E8', '#E4E0EB', '#9673C3'];

// Custom tooltip component with enhanced formatting
function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="bg-madhive-purple-dark/95 border border-madhive-purple-medium/50 rounded-lg p-3 shadow-lg">
      <p className="text-madhive-chalk text-tv-sm font-medium mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-madhive-chalk/80 text-tv-xs">{entry.name}</span>
            </div>
            <span className="text-madhive-chalk font-medium text-tv-xs">
              {formatNumber(entry.value ?? 0, 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarChartWidget({ config }: BarChartWidgetProps) {
  const { data, isLoading, error } = useWidgetData(config.id);

  // Type assertion for BarChartData
  const barChartData = data as BarChartData | undefined;

  // Loading state
  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="animate-pulse space-y-4 w-full p-6">
          <div className="h-6 w-48 bg-madhive-purple-medium/50 rounded" />
          <div className="space-y-3">
            <div className="h-40 bg-madhive-purple-medium/50 rounded" />
            <div className="h-4 w-32 bg-madhive-purple-medium/50 rounded" />
          </div>
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-error text-tv-base">Error loading data</p>
          <p className="text-madhive-chalk/60 text-tv-sm mt-2">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </Card>
    );
  }

  // Empty data state
  if (!barChartData || !barChartData.labels || barChartData.labels.length === 0) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-madhive-chalk/60 text-tv-base">No data available</p>
        </div>
      </Card>
    );
  }

  // Transform data for Recharts format
  // From: { labels: ['A', 'B'], datasets: [{ label: 'Sales', data: [10, 20] }] }
  // To: [{ name: 'A', Sales: 10 }, { name: 'B', Sales: 20 }]
  const chartData = barChartData.labels.map((label, index) => {
    const dataPoint: Record<string, any> = { name: label };
    barChartData.datasets.forEach((dataset) => {
      dataPoint[dataset.label] = dataset.data[index] ?? 0;
    });
    return dataPoint;
  });

  // Determine if we should show legend (only if multiple datasets)
  const showLegend = barChartData.datasets.length > 1;

  return (
    <Card variant="default" className="flex flex-col h-full overflow-hidden">
      {/* Title */}
      {config.title && (
        <div className="mb-4">
          <h3 className="text-tv-lg font-display text-madhive-chalk/80 truncate">
            {config.title}
          </h3>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1" style={{ minHeight: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            {/* Dashed purple grid lines */}
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(61, 31, 92, 0.4)"
              vertical={false}
            />

            {/* X-Axis */}
            <XAxis
              dataKey="name"
              tick={{ fill: 'rgba(228, 224, 235, 0.6)', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(61, 31, 92, 0.4)' }}
              tickLine={false}
            />

            {/* Y-Axis */}
            <YAxis
              tick={{ fill: 'rgba(228, 224, 235, 0.6)', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(61, 31, 92, 0.4)' }}
              tickLine={false}
              tickFormatter={(value) => formatNumber(value, 0)}
            />

            {/* Enhanced Tooltip */}
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(61, 31, 92, 0.2)' }} />

            {/* Legend - only show if multiple datasets */}
            {showLegend && (
              <Legend
                wrapperStyle={{
                  paddingTop: '20px',
                  fontSize: '12px',
                }}
                iconType="rect"
                iconSize={12}
              />
            )}

            {/* Bars - one for each dataset */}
            {barChartData.datasets.map((dataset, index) => (
              <Bar
                key={dataset.label}
                dataKey={dataset.label}
                fill={dataset.backgroundColor ?? COLORS[index % COLORS.length]}
                radius={[8, 8, 0, 0]}
                isAnimationActive={true}
                animationDuration={800}
                animationEasing="ease-in-out"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Timestamp footer */}
      {barChartData.timestamp && (
        <div className="mt-4 pt-4 border-t border-madhive-purple-medium/30">
          <p className="text-tv-xs text-madhive-chalk/40 text-center">
            Updated: {new Date(barChartData.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </Card>
  );
}
