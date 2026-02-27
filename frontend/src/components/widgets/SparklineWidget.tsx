import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/Card';
import { useWidgetData } from '@/hooks/useApi';
import type { WidgetConfig } from '@/types/dashboard';

interface SparklineData {
  values: number[];
  trend?: 'up' | 'down' | 'flat';
  timestamp: string;
}

interface SparklineWidgetProps {
  config: WidgetConfig;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-madhive-purple-deep/95 border border-madhive-purple-light px-3 py-2 rounded shadow-lg">
        <p className="text-tv-sm text-madhive-chalk">{payload[0].value.toFixed(2)}</p>
      </div>
    );
  }
  return null;
}

export function SparklineWidget({ config }: SparklineWidgetProps) {
  const { data, isLoading, error } = useWidgetData(config.id);

  // Type assertion for SparklineData
  const sparklineData = data as SparklineData | undefined;

  // Loading state
  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="animate-pulse w-full">
          <div className="h-[60px] bg-madhive-purple-medium/50 rounded" />
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

  // Prepare chart data
  const chartData = sparklineData?.values?.map((value, index) => ({
    index,
    value,
  })) ?? [];

  // Determine trend color
  const getTrendColor = (trend?: 'up' | 'down' | 'flat'): string => {
    switch (trend) {
      case 'up':
        return '#FF9BD3'; // madhive-pink
      case 'down':
        return '#FF4D4D'; // error red
      case 'flat':
      default:
        return '#9CA3AF'; // gray
    }
  };

  const trendColor = getTrendColor(sparklineData?.trend);

  return (
    <Card variant="gradient" className="flex flex-col h-full overflow-hidden">
      {/* Title */}
      {config.title && (
        <div className="mb-3">
          <h3 className="text-tv-base font-display text-madhive-chalk/80 truncate">
            {config.title}
          </h3>
        </div>
      )}

      {/* Sparkline chart */}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height={60}>
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={trendColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={true}
              animationDuration={500}
              animationEasing="ease-in-out"
            />
            <Tooltip content={<CustomTooltip />} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Trend indicator */}
      {sparklineData?.trend && (
        <div className="mt-3">
          <p className="text-tv-xs text-madhive-chalk/60 text-center">
            Trend: <span className="capitalize">{sparklineData.trend}</span>
          </p>
        </div>
      )}

      {/* Timestamp footer */}
      {sparklineData?.timestamp && (
        <div className="mt-3 pt-3 border-t border-madhive-purple-medium/30">
          <p className="text-tv-xs text-madhive-chalk/40 text-center">
            Updated: {new Date(sparklineData.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </Card>
  );
}
