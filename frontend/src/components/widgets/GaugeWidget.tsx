import { useEffect, useState } from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';
import { Card } from '@/components/ui/Card';
import { formatNumber } from '@/lib/utils';
import { useWidgetData } from '@/hooks/useApi';
import type { WidgetConfig } from '@/types/dashboard';

interface Threshold {
  value: number;
  label: string;
  color: string;
}

interface GaugeData {
  value: number;
  unit?: string;
  min?: number;    // Default: 0
  max?: number;    // Default: 100
  thresholds?: Threshold[];
  timestamp: string;
}

interface GaugeWidgetProps {
  config: WidgetConfig;
}

export function GaugeWidget({ config }: GaugeWidgetProps) {
  const { data, isLoading, error } = useWidgetData(config.id);
  const [displayValue, setDisplayValue] = useState<number>(0);
  const [prevValue, setPrevValue] = useState<number>(0);

  // Type assertion for GaugeData
  const gaugeData = data as GaugeData | undefined;

  // Extract values with defaults
  const currentValue = gaugeData?.value ?? 0;
  const min = gaugeData?.min ?? 0;
  const max = gaugeData?.max ?? 100;
  const unit = gaugeData?.unit;
  const thresholds = gaugeData?.thresholds ?? [];

  // Calculate percentage (0-100)
  const percentage = max > min
    ? ((currentValue - min) / (max - min)) * 100
    : 0;

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
          <div className="h-32 w-32 bg-madhive-purple-medium/50 rounded-full mx-auto" />
          <div className="h-8 w-24 bg-madhive-purple-medium/50 rounded mx-auto" />
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

  // Prepare data for RadialBarChart
  // RadialBarChart expects data in array format with fill property
  const chartData = [
    {
      name: 'value',
      value: Math.min(Math.max(percentage, 0), 100), // Clamp between 0-100
      fill: '#FF9BD3', // madhive-pink
    },
  ];

  // Format the display value
  const formattedValue = formatNumber(displayValue, config.config?.decimals ?? 0);

  // Determine threshold state
  const getThresholdState = () => {
    if (!thresholds.length) return null;

    // Find the highest threshold that the value exceeds
    const sortedThresholds = [...thresholds].sort((a, b) => b.value - a.value);
    for (const threshold of sortedThresholds) {
      if (currentValue >= threshold.value) {
        return threshold;
      }
    }
    return null;
  };

  const currentThreshold = getThresholdState();

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

      {/* Gauge container */}
      <div className="flex-1 flex flex-col justify-center items-center relative">
        {/* RadialBarChart - Semi-circle gauge */}
        <div className="w-full" style={{ height: '180px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="70%"
              innerRadius="70%"
              outerRadius="100%"
              startAngle={180}
              endAngle={0}
              data={chartData}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              {/* Background track */}
              <RadialBar
                background={{ fill: 'rgba(139, 92, 246, 0.3)' }}
                dataKey="value"
                cornerRadius={10}
                isAnimationActive={true}
                animationDuration={500}
                animationEasing="ease-in-out"
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        {/* Center value display - positioned absolutely */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/4 text-center">
          <div className="animate-count-up">
            <div className="text-tv-2xl font-display font-bold text-madhive-pink leading-none">
              {formattedValue}
            </div>
            {unit && (
              <div className="text-tv-lg font-display text-madhive-pink-soft mt-1">
                {unit}
              </div>
            )}
          </div>
        </div>

        {/* Min/Max labels */}
        <div className="w-full flex justify-between px-8 mt-2">
          <span className="text-tv-xs text-madhive-chalk/40">{min}</span>
          <span className="text-tv-xs text-madhive-chalk/40">{max}</span>
        </div>

        {/* Threshold indicators */}
        {thresholds.length > 0 && (
          <div className="w-full mt-4 space-y-1">
            {thresholds.map((threshold, index) => {
              const isActive = currentValue >= threshold.value;
              return (
                <div
                  key={index}
                  className="flex items-center justify-between text-tv-xs"
                >
                  <span className={isActive ? threshold.color : 'text-madhive-chalk/40'}>
                    {threshold.label}
                  </span>
                  <span className={isActive ? threshold.color : 'text-madhive-chalk/40'}>
                    {threshold.value}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Current threshold badge */}
        {currentThreshold && (
          <div className="mt-4">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-tv-xs font-medium ${currentThreshold.color} bg-opacity-10`}>
              {currentThreshold.label}
            </div>
          </div>
        )}
      </div>

      {/* Timestamp footer */}
      {gaugeData?.timestamp && (
        <div className="mt-4 pt-4 border-t border-madhive-purple-medium/30">
          <p className="text-tv-xs text-madhive-chalk/40 text-center">
            Updated: {new Date(gaugeData.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </Card>
  );
}
