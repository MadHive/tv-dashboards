import { GCPMetric } from '@/lib/dataSourceConnectors/gcpMonitoring';

interface MetricCardProps {
  metric: GCPMetric;
  isSelected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  showOrder?: number;
}

export function MetricCard({ metric, isSelected, onSelect, onRemove, showOrder }: MetricCardProps) {
  const widgetIcons: Record<string, string> = {
    'big-number': '🔢',
    'gauge': '⚡',
    'trend': '📈',
    'status': '🟢'
  };

  if (isSelected && onRemove) {
    // Selected metric - compact view with remove button
    return (
      <div className="flex items-center gap-3 p-4 bg-madhive-purple-dark border-2 border-madhive-pink rounded-lg">
        <div className="text-tv-xl">{widgetIcons[metric.suggestedWidget] || '📊'}</div>
        <div className="flex-1 min-w-0">
          <div className="text-tv-base font-semibold text-madhive-pink truncate">
            {metric.name}
          </div>
          <div className="text-tv-sm text-madhive-chalk/60 truncate">
            {metric.service}
          </div>
        </div>
        {showOrder !== undefined && (
          <div className="text-tv-sm text-madhive-chalk/40 font-mono">
            #{showOrder + 1}
          </div>
        )}
        <button
          onClick={onRemove}
          className="p-2 text-madhive-chalk/60 hover:text-red-400 transition-colors"
          aria-label="Remove metric"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  // Available metric - full view with select button
  return (
    <button
      onClick={onSelect}
      className="w-full p-4 bg-madhive-purple-dark border-2 border-madhive-purple-medium rounded-lg text-left hover:border-madhive-pink hover:bg-madhive-purple-medium transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="text-tv-2xl">{widgetIcons[metric.suggestedWidget] || '📊'}</div>
        <div className="flex-1 min-w-0">
          <div className="text-tv-base font-semibold text-madhive-pink mb-1">
            {metric.name}
          </div>
          <div className="text-tv-sm text-madhive-chalk/70 mb-2">
            {metric.description}
          </div>
          <div className="flex items-center gap-3 text-tv-xs">
            <span className="text-madhive-chalk/50">{metric.service}</span>
            <span className="text-madhive-pink/60">{metric.suggestedWidget}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
