import { useState, useEffect } from 'react';
import { DataSource, SelectedMetric } from '@/lib/wizardState';
import { discoverGCPMetrics, GCPMetric } from '@/lib/dataSourceConnectors/gcpMonitoring';
import { MetricCard } from '@/components/ui/MetricCard';

interface Step3MetricPickerProps {
  dataSources: DataSource[];
  selectedMetrics: SelectedMetric[];
  onUpdate: (metrics: SelectedMetric[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step3MetricPicker({
  dataSources,
  selectedMetrics,
  onUpdate,
  onNext,
  onBack
}: Step3MetricPickerProps) {
  const [availableMetrics, setAvailableMetrics] = useState<GCPMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('performance');

  useEffect(() => {
    const loadMetrics = async () => {
      setLoading(true);

      // For now, only load GCP metrics
      if (dataSources.includes('gcp')) {
        const gcpMetrics = await discoverGCPMetrics();
        const allMetrics = [
          ...gcpMetrics.performance,
          ...gcpMetrics.errors,
          ...gcpMetrics.resources,
          ...gcpMetrics.deployments
        ];
        setAvailableMetrics(allMetrics);
      }

      setLoading(false);
    };

    loadMetrics();
  }, [dataSources]);

  const categories = [
    { id: 'performance', icon: '🎯', label: 'Performance' },
    { id: 'errors', icon: '⚠️', label: 'Errors' },
    { id: 'resources', icon: '💻', label: 'Resources' },
    { id: 'deployments', icon: '🚀', label: 'Deployments' }
  ];

  const filteredMetrics = availableMetrics.filter(m => m.category === activeCategory);
  const selectedMetricIds = new Set(selectedMetrics.map(m => m.id));

  const handleSelectMetric = (metric: GCPMetric) => {
    const newMetric: SelectedMetric = {
      id: metric.id,
      source: 'gcp',
      name: metric.name,
      category: metric.category,
      suggestedWidget: metric.suggestedWidget,
      order: selectedMetrics.length
    };
    onUpdate([...selectedMetrics, newMetric]);
  };

  const handleRemoveMetric = (metricId: string) => {
    const updated = selectedMetrics
      .filter(m => m.id !== metricId)
      .map((m, idx) => ({ ...m, order: idx })); // Reorder
    onUpdate(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-madhive-pink border-t-transparent mb-4"></div>
          <div className="text-tv-lg text-madhive-chalk">Discovering metrics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-tv-2xl font-semibold text-madhive-pink mb-4">
          Pick Your Metrics
        </h2>
        <p className="text-tv-lg text-madhive-chalk/80">
          Select the metrics that matter most to your team
        </p>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Left: Categories */}
        <div className="space-y-3">
          <h3 className="text-tv-lg font-semibold text-madhive-chalk mb-4">Categories</h3>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`
                w-full p-4 rounded-lg text-left transition-all flex items-center gap-3
                ${
                  activeCategory === cat.id
                    ? 'bg-madhive-pink text-madhive-purple-deepest'
                    : 'bg-madhive-purple-dark text-madhive-chalk hover:bg-madhive-purple-medium'
                }
              `}
            >
              <span className="text-tv-xl">{cat.icon}</span>
              <span className="text-tv-base font-medium">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Middle: Available Metrics */}
        <div className="space-y-3">
          <h3 className="text-tv-lg font-semibold text-madhive-chalk mb-4">
            Available Metrics ({filteredMetrics.length})
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {filteredMetrics.map((metric) => {
              if (selectedMetricIds.has(metric.id)) return null;

              return (
                <MetricCard
                  key={metric.id}
                  metric={metric}
                  onSelect={() => handleSelectMetric(metric)}
                />
              );
            })}
            {filteredMetrics.filter(m => !selectedMetricIds.has(m.id)).length === 0 && (
              <div className="text-center py-12 text-madhive-chalk/60">
                All metrics from this category are selected
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected Metrics */}
        <div className="space-y-3">
          <h3 className="text-tv-lg font-semibold text-madhive-chalk mb-4">
            Selected ({selectedMetrics.length})
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {selectedMetrics.map((metric, idx) => {
              const fullMetric = availableMetrics.find(m => m.id === metric.id);
              if (!fullMetric) return null;

              return (
                <MetricCard
                  key={metric.id}
                  metric={fullMetric}
                  isSelected
                  showOrder={idx}
                  onRemove={() => handleRemoveMetric(metric.id)}
                />
              );
            })}
            {selectedMetrics.length === 0 && (
              <div className="text-center py-12 text-madhive-chalk/60 text-tv-sm">
                Select metrics from the list →
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-8 py-4 bg-madhive-purple-dark border-2 border-madhive-purple-medium text-madhive-chalk rounded-lg text-tv-lg font-semibold hover:bg-madhive-purple-medium transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={selectedMetrics.length === 0}
          className={`
            px-8 py-4 rounded-lg text-tv-lg font-semibold transition-all
            ${
              selectedMetrics.length > 0
                ? 'bg-madhive-pink text-madhive-purple-deepest hover:bg-madhive-pink/80'
                : 'bg-madhive-purple-medium text-madhive-chalk/50 cursor-not-allowed'
            }
          `}
        >
          Continue to Visual Style →
        </button>
      </div>
    </div>
  );
}
