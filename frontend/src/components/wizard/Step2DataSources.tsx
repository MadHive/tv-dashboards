import { useState, useEffect } from 'react';
import { DataSource } from '@/lib/wizardState';
import { testGCPConnection } from '@/lib/dataSourceConnectors/gcpMonitoring';

interface DataSourceOption {
  value: DataSource;
  icon: string;
  name: string;
  description: string;
  status: 'connected' | 'not-configured' | 'testing';
  metricsCount?: number;
}

interface Step2DataSourcesProps {
  value: DataSource[];
  onUpdate: (sources: DataSource[]) => void;
  onNext: () => void;
}

export function Step2DataSources({ value, onUpdate, onNext }: Step2DataSourcesProps) {
  const [sources, setSources] = useState<DataSourceOption[]>([
    {
      value: 'gcp',
      icon: '☁️',
      name: 'GCP Monitoring',
      description: 'Cloud infrastructure metrics',
      status: 'testing'
    },
    {
      value: 'datadog',
      icon: '📈',
      name: 'DataDog',
      description: 'AWS service monitoring',
      status: 'not-configured'
    },
    {
      value: 'github',
      icon: '🔄',
      name: 'GitHub Actions',
      description: 'CI/CD pipelines',
      status: 'not-configured'
    },
    {
      value: 'jira',
      icon: '📝',
      name: 'Jira',
      description: 'Ticket management',
      status: 'not-configured'
    }
  ]);

  // Test GCP connection on mount
  useEffect(() => {
    const testGCP = async () => {
      const result = await testGCPConnection();
      setSources(prev => prev.map(s =>
        s.value === 'gcp'
          ? { ...s, status: result.connected ? 'connected' : 'not-configured', metricsCount: result.metricsCount }
          : s
      ));
    };
    testGCP();
  }, []);

  const toggleSource = (source: DataSource) => {
    if (value.includes(source)) {
      onUpdate(value.filter(s => s !== source));
    } else {
      onUpdate([...value, source]);
    }
  };

  const canProceed = value.length > 0;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-tv-2xl font-semibold text-madhive-pink mb-4">
          Which systems do you want to monitor?
        </h2>
        <p className="text-tv-lg text-madhive-chalk/80">
          Select one or more data sources (you can add more later)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {sources.map((source) => {
          const isSelected = value.includes(source.value);
          const isAvailable = source.status === 'connected';

          return (
            <button
              key={source.value}
              onClick={() => toggleSource(source.value)}
              disabled={!isAvailable}
              className={`
                p-8 rounded-lg border-2 text-left transition-all duration-200
                ${!isAvailable && 'opacity-50 cursor-not-allowed'}
                ${isAvailable && 'hover:scale-105 hover:shadow-xl hover:shadow-madhive-pink/20'}
                ${
                  isSelected
                    ? 'bg-madhive-pink border-madhive-pink text-madhive-purple-deepest'
                    : 'bg-madhive-purple-dark border-madhive-purple-medium text-madhive-chalk'
                }
              `}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-5xl">{source.icon}</div>
                {isSelected && (
                  <div className="bg-madhive-purple-deepest text-madhive-pink rounded-full p-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>

              <h3 className={`text-tv-xl font-semibold mb-2 ${isSelected ? 'text-madhive-purple-deepest' : 'text-madhive-pink'}`}>
                {source.name}
              </h3>

              <p className={`text-tv-base mb-4 ${isSelected ? 'text-madhive-purple-deepest/80' : 'text-madhive-chalk/70'}`}>
                {source.description}
              </p>

              <div className="flex items-center gap-2">
                <div
                  className={`
                    w-2 h-2 rounded-full
                    ${source.status === 'connected' ? 'bg-green-500' : ''}
                    ${source.status === 'not-configured' ? 'bg-amber-500' : ''}
                    ${source.status === 'testing' ? 'bg-blue-500 animate-pulse' : ''}
                  `}
                />
                <span className={`text-tv-sm ${isSelected ? 'text-madhive-purple-deepest/70' : 'text-madhive-chalk/60'}`}>
                  {source.status === 'connected' && `${source.metricsCount} metrics available`}
                  {source.status === 'not-configured' && 'Not configured'}
                  {source.status === 'testing' && 'Testing connection...'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`
            px-8 py-4 rounded-lg text-tv-lg font-semibold transition-all
            ${
              canProceed
                ? 'bg-madhive-pink text-madhive-purple-deepest hover:bg-madhive-pink/80'
                : 'bg-madhive-purple-medium text-madhive-chalk/50 cursor-not-allowed'
            }
          `}
        >
          Continue to Metrics →
        </button>
      </div>
    </div>
  );
}
