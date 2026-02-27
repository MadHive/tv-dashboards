import { useEffect, useState } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatNumber } from '@/lib/utils';
import { useWidgetData } from '@/hooks/useApi';
import type { WidgetConfig } from '@/types/dashboard';

interface BigNumberData {
  value: number | string;
  unit?: string;
  trend?: { value: number; direction: 'up' | 'down' };
  sparkline?: number[];
  timestamp: string;
}

interface BigNumberWidgetProps {
  config: WidgetConfig;
}

export function BigNumberWidget({ config }: BigNumberWidgetProps) {
  const { data, isLoading, error } = useWidgetData(config.id);
  const [displayValue, setDisplayValue] = useState<number>(0);
  const [prevValue, setPrevValue] = useState<number>(0);

  // Parse the actual value from the data
  const currentValue = typeof data?.value === 'number'
    ? data.value
    : typeof data?.value === 'string'
    ? parseFloat(data.value)
    : 0;

  // Type assertion for BigNumberData
  const bigNumberData = data as BigNumberData | undefined;

  // Animated counter effect
  useEffect(() => {
    if (currentValue === prevValue) return;

    const duration = 500; // Animation duration in ms
    const steps = 30;
    const stepDuration = duration / steps;
    const increment = (currentValue - prevValue) / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(currentValue);
        setPrevValue(currentValue);
        clearInterval(timer);
      } else {
        setDisplayValue(prevValue + increment * currentStep);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [currentValue, prevValue]);

  // Loading state
  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="animate-pulse space-y-4 text-center">
          <div className="h-20 w-48 bg-madhive-purple-medium/50 rounded mx-auto" />
          <div className="h-4 w-32 bg-madhive-purple-medium/50 rounded mx-auto" />
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

  // Format the display value
  const formattedValue = typeof displayValue === 'number'
    ? formatNumber(displayValue, config.config?.decimals ?? 0)
    : displayValue;

  // Prepare sparkline data
  const sparklineData = bigNumberData?.sparkline?.map((value, index) => ({
    index,
    value,
  })) ?? [];

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

      {/* Main content area */}
      <div className="flex-1 flex flex-col justify-center">
        {/* Big number with animation */}
        <div className="text-center mb-2">
          <div className="animate-count-up">
            <span className="text-tv-huge font-display font-bold text-madhive-pink leading-none">
              {formattedValue}
            </span>
            {bigNumberData?.unit && (
              <span className="text-tv-2xl font-display text-madhive-pink-soft ml-2">
                {bigNumberData.unit}
              </span>
            )}
          </div>
        </div>

        {/* Trend indicator */}
        {bigNumberData?.trend && (
          <div className="flex items-center justify-center gap-2 mb-4">
            {bigNumberData.trend.direction === 'up' ? (
              <TrendingUp className="w-6 h-6 text-success" />
            ) : (
              <TrendingDown className="w-6 h-6 text-error" />
            )}
            <span
              className={`text-tv-lg font-medium ${
                bigNumberData.trend.direction === 'up'
                  ? 'text-success'
                  : 'text-error'
              }`}
            >
              {bigNumberData.trend.direction === 'up' ? '↑' : '↓'}
              {Math.abs(bigNumberData.trend.value)}%
            </span>
          </div>
        )}

        {/* Sparkline */}
        {sparklineData.length > 0 && (
          <div className="h-20 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#FF9BD3"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={500}
                  animationEasing="ease-in-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Timestamp footer */}
      {bigNumberData?.timestamp && (
        <div className="mt-4 pt-4 border-t border-madhive-purple-medium/30">
          <p className="text-tv-xs text-madhive-chalk/40 text-center">
            Updated: {new Date(bigNumberData.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </Card>
  );
}
