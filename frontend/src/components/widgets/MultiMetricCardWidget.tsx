import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatNumber } from '@/lib/utils';
import { useWidgetData } from '@/hooks/useApi';
import type { WidgetConfig } from '@/types/dashboard';

interface MultiMetricData {
  metrics: {
    label: string;
    value: number | string;
    unit?: string;
    trend?: { value: number; direction: 'up' | 'down' };
  }[];
  timestamp: string;
}

interface MultiMetricCardWidgetProps {
  config: WidgetConfig;
}

interface TrendIndicatorProps {
  trend: { value: number; direction: 'up' | 'down' };
}

function TrendIndicator({ trend }: TrendIndicatorProps) {
  const isPositive = trend.direction === 'up';
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const colorClass = isPositive ? 'text-success' : 'text-error';

  return (
    <div className={`flex items-center gap-1 mt-1 ${colorClass}`}>
      <Icon className="w-4 h-4" />
      <span className="text-tv-xs font-medium">
        {isPositive ? '+' : '-'}
        {Math.abs(trend.value)}%
      </span>
    </div>
  );
}

export function MultiMetricCardWidget({ config }: MultiMetricCardWidgetProps) {
  const { data, isLoading, error } = useWidgetData(config.id);

  // Type assertion for MultiMetricData
  const multiMetricData = data as MultiMetricData | undefined;

  // Loading state
  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="animate-pulse space-y-4 w-full">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-madhive-purple-medium/50 rounded" />
                <div className="h-8 w-32 bg-madhive-purple-medium/50 rounded" />
              </div>
            ))}
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

  const metrics = multiMetricData?.metrics ?? [];

  // Format metric value
  const formatValue = (value: number | string, unit?: string): string => {
    const formattedValue =
      typeof value === 'number'
        ? formatNumber(value, config.config?.decimals ?? 0)
        : value;
    return unit ? `${formattedValue} ${unit}` : formattedValue;
  };

  return (
    <Card variant="gradient" className="flex flex-col h-full overflow-hidden">
      {/* Title */}
      {config.title && (
        <div className="mb-6">
          <h3 className="text-tv-lg font-display text-madhive-chalk/80 truncate">
            {config.title}
          </h3>
        </div>
      )}

      {/* Metrics grid */}
      <div className="flex-1">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
          {metrics.map((metric, i) => (
            <div key={i} className="space-y-1">
              {/* Label */}
              <div className="text-tv-sm text-madhive-chalk/60">
                {metric.label}
              </div>

              {/* Value */}
              <div className="text-tv-xl font-bold text-madhive-pink">
                {formatValue(metric.value, metric.unit)}
              </div>

              {/* Trend */}
              {metric.trend && <TrendIndicator trend={metric.trend} />}
            </div>
          ))}
        </div>
      </div>

      {/* Timestamp footer */}
      {multiMetricData?.timestamp && (
        <div className="mt-6 pt-4 border-t border-madhive-purple-medium/30">
          <p className="text-tv-xs text-madhive-chalk/40 text-center">
            Updated: {new Date(multiMetricData.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </Card>
  );
}
