import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatNumber } from '@/lib/utils';
import { useWidgetData } from '@/hooks/useApi';
import type { WidgetConfig } from '@/types/dashboard';
import * as Icons from 'lucide-react';

interface StatCardData {
  value: number | string;
  label: string;
  icon?: string; // lucide-react icon name (e.g., "TrendingUp", "Users", "DollarSign")
  comparison?: { value: number; label: string }; // e.g., { value: 12, label: "vs last week" }
  badge?: { text: string; variant: 'success' | 'warning' | 'error' };
  timestamp: string;
}

interface StatCardWidgetProps {
  config: WidgetConfig;
}

export function StatCardWidget({ config }: StatCardWidgetProps) {
  const { data, isLoading, error } = useWidgetData(config.id);

  // Type assertion for StatCardData
  const statCardData = data as StatCardData | undefined;

  // Loading state
  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="animate-pulse space-y-4 text-center w-full">
          <div className="h-10 w-10 bg-madhive-purple-medium/50 rounded-full mx-auto" />
          <div className="h-12 w-32 bg-madhive-purple-medium/50 rounded mx-auto" />
          <div className="h-4 w-24 bg-madhive-purple-medium/50 rounded mx-auto" />
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

  // Get the icon component dynamically
  const iconName = statCardData?.icon || 'Activity';
  const Icon = Icons[iconName as keyof typeof Icons] as Icons.LucideIcon;

  // Format the value
  const formattedValue =
    typeof statCardData?.value === 'number'
      ? formatNumber(statCardData.value, config.config?.decimals ?? 0)
      : statCardData?.value ?? '—';

  // Determine comparison color
  const comparisonColor = statCardData?.comparison
    ? statCardData.comparison.value >= 0
      ? 'text-success'
      : 'text-error'
    : '';

  return (
    <Card
      variant="default"
      className="flex flex-col h-full transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,155,211,0.3)] hover:border-madhive-pink/50"
    >
      {/* Icon at top */}
      {Icon && (
        <div className="mb-4">
          <Icon className="w-10 h-10 text-madhive-pink" />
        </div>
      )}

      {/* Value display */}
      <div className="mb-2">
        <div className="text-tv-xl font-display font-bold text-madhive-chalk leading-tight">
          {formattedValue}
        </div>
      </div>

      {/* Label */}
      <div className="mb-3">
        <p className="text-tv-sm text-madhive-chalk/60">{statCardData?.label || config.title}</p>
      </div>

      {/* Comparison */}
      {statCardData?.comparison && (
        <div className="mb-3">
          <p className={`text-tv-sm font-medium ${comparisonColor}`}>
            {statCardData.comparison.value >= 0 ? '+' : ''}
            {statCardData.comparison.value}% {statCardData.comparison.label}
          </p>
        </div>
      )}

      {/* Badge */}
      {statCardData?.badge && (
        <div className="mt-auto">
          <Badge variant={statCardData.badge.variant}>{statCardData.badge.text}</Badge>
        </div>
      )}

      {/* Timestamp footer */}
      {statCardData?.timestamp && (
        <div className="mt-4 pt-4 border-t border-madhive-purple-medium/30">
          <p className="text-tv-xs text-madhive-chalk/40">
            Updated: {new Date(statCardData.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </Card>
  );
}
