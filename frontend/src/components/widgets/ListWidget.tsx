import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useWidgetData } from '@/hooks/useApi';
import type { WidgetConfig } from '@/types/dashboard';
import * as Icons from 'lucide-react';

interface ListData {
  items: {
    id: string;
    title: string;
    subtitle?: string;
    icon?: string; // lucide-react icon name
    badge?: { text: string; variant: 'success' | 'warning' | 'error' | 'default' };
    status?: 'success' | 'warning' | 'error' | 'info';
  }[];
  timestamp: string;
}

interface ListWidgetProps {
  config: WidgetConfig;
}

export function ListWidget({ config }: ListWidgetProps) {
  const { data, isLoading, error } = useWidgetData(config.id);

  // Type assertion for ListData
  const listData = data as ListData | undefined;

  // Loading state
  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="animate-pulse space-y-3 w-full">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="w-6 h-6 bg-madhive-purple-medium/50 rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-madhive-purple-medium/50 rounded" />
                <div className="h-3 w-1/2 bg-madhive-purple-medium/50 rounded" />
              </div>
            </div>
          ))}
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

  const items = listData?.items ?? [];

  // Get status border color
  const getStatusColor = (status?: 'success' | 'warning' | 'error' | 'info'): string => {
    switch (status) {
      case 'success':
        return 'border-success';
      case 'warning':
        return 'border-warning';
      case 'error':
        return 'border-error';
      case 'info':
        return 'border-madhive-purple-light';
      default:
        return 'border-transparent';
    }
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

      {/* List items */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {items.map((item) => {
          // Get icon component dynamically
          const iconName = item.icon || 'Circle';
          const Icon = Icons[iconName as keyof typeof Icons] as Icons.LucideIcon;
          const statusColor = getStatusColor(item.status);

          return (
            <div
              key={item.id}
              className={`
                border-l-4 ${statusColor}
                bg-madhive-purple-deep/50
                hover:bg-madhive-purple-medium/50
                transition-colors
                duration-200
                rounded-r
              `}
            >
              <div className="flex items-center gap-4 p-4">
                {/* Icon */}
                {Icon && (
                  <div className="flex-shrink-0">
                    <Icon className="w-6 h-6 text-madhive-pink" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-tv-base text-madhive-chalk truncate">
                    {item.title}
                  </div>
                  {item.subtitle && (
                    <div className="text-tv-sm text-madhive-chalk/60 truncate mt-1">
                      {item.subtitle}
                    </div>
                  )}
                </div>

                {/* Badge */}
                {item.badge && (
                  <div className="flex-shrink-0">
                    <Badge variant={item.badge.variant}>
                      {item.badge.text}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {items.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-madhive-chalk/60 text-tv-sm">No items to display</p>
          </div>
        )}
      </div>

      {/* Timestamp footer */}
      {listData?.timestamp && (
        <div className="mt-4 pt-4 border-t border-madhive-purple-medium/30">
          <p className="text-tv-xs text-madhive-chalk/40 text-center">
            Updated: {new Date(listData.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </Card>
  );
}
