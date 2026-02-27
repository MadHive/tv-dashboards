import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { useWidgetData } from '@/hooks/useApi';
import type { WidgetConfig } from '@/types/dashboard';

interface StackedBarData {
  labels: string[];
  datasets: { label: string; data: number[]; backgroundColor?: string }[];
  orientation?: 'horizontal' | 'vertical';
  timestamp: string;
}

interface StackedBarChartWidgetProps {
  config: WidgetConfig;
}

// MadHive color palette for stacked bars
const COLORS = [
  '#FF9BD3', // madhive-pink
  '#FFB8E6', // madhive-pink-soft
  '#8B5CF6', // madhive-purple
  '#A78BFA', // madhive-purple-light
  '#6366F1', // indigo
  '#60A5FA', // blue
  '#34D399', // success
  '#FBBF24', // warning
];

export function StackedBarChartWidget({ config }: StackedBarChartWidgetProps) {
  const { data, isLoading, error } = useWidgetData(config.id);

  // Type assertion for StackedBarData
  const stackedBarData = data as StackedBarData | undefined;

  // Loading state
  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="animate-pulse w-full h-full">
          <div className="h-full bg-madhive-purple-medium/50 rounded" />
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

  // Transform data for Recharts
  const chartData =
    stackedBarData?.labels.map((label, index) => {
      const dataPoint: Record<string, any> = { name: label };
      stackedBarData.datasets.forEach((dataset) => {
        dataPoint[dataset.label] = dataset.data[index] ?? 0;
      });
      return dataPoint;
    }) ?? [];

  const orientation = stackedBarData?.orientation ?? 'vertical';
  const isHorizontal = orientation === 'horizontal';

  // Custom tooltip
  interface TooltipProps {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum, entry) => sum + entry.value, 0);
      return (
        <div className="bg-madhive-purple-deep/95 border border-madhive-purple-light px-4 py-3 rounded shadow-lg">
          <p className="text-tv-sm font-bold text-madhive-chalk mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-tv-xs">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-madhive-chalk/80">{entry.name}:</span>
              <span className="font-medium text-madhive-chalk">{entry.value}</span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-madhive-purple-medium/30">
            <span className="text-tv-xs font-bold text-madhive-pink">
              Total: {total}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card variant="gradient" className="flex flex-col h-full overflow-hidden">
      {/* Title */}
      {config.title && (
        <div className="mb-4">
          <h3 className="text-tv-lg font-display text-madhive-chalk/80 truncate">
            {config.title}
          </h3>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout={isHorizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 10, right: 30, left: 20, bottom: 40 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#4C3A6D"
              opacity={0.3}
            />
            {isHorizontal ? (
              <>
                <XAxis
                  type="number"
                  stroke="#EAEAEA"
                  tick={{ fill: '#EAEAEA', fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#EAEAEA"
                  tick={{ fill: '#EAEAEA', fontSize: 12 }}
                  width={100}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="name"
                  stroke="#EAEAEA"
                  tick={{ fill: '#EAEAEA', fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  stroke="#EAEAEA"
                  tick={{ fill: '#EAEAEA', fontSize: 12 }}
                />
              </>
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="square"
              formatter={(value) => (
                <span className="text-tv-sm text-madhive-chalk">{value}</span>
              )}
            />
            {stackedBarData?.datasets.map((dataset, i) => (
              <Bar
                key={i}
                dataKey={dataset.label}
                stackId="stack"
                fill={dataset.backgroundColor ?? COLORS[i % COLORS.length]}
                isAnimationActive={true}
                animationDuration={500}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Timestamp footer */}
      {stackedBarData?.timestamp && (
        <div className="mt-4 pt-4 border-t border-madhive-purple-medium/30">
          <p className="text-tv-xs text-madhive-chalk/40 text-center">
            Updated: {new Date(stackedBarData.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </Card>
  );
}
