// frontend/src/components/wizard/Step1Purpose.tsx
import { DashboardPurpose } from '@/lib/wizardState';

interface PurposeOption {
  value: DashboardPurpose;
  icon: string;
  title: string;
  description: string;
  examples: string[];
}

const PURPOSE_OPTIONS: PurposeOption[] = [
  {
    value: 'infrastructure',
    icon: '🏗️',
    title: 'Infrastructure',
    description: 'Monitor system health, performance, and uptime',
    examples: ['Server CPU/Memory', 'Network Traffic', 'Database Performance']
  },
  {
    value: 'application',
    icon: '🚀',
    title: 'Application',
    description: 'Track deployments, errors, and user activity',
    examples: ['API Response Times', 'Error Rates', 'Deployment Status']
  },
  {
    value: 'business',
    icon: '📊',
    title: 'Business Metrics',
    description: 'View tickets, sprints, and team capacity',
    examples: ['Open Tickets', 'Sprint Velocity', 'Team Workload']
  },
  {
    value: 'mixed',
    icon: '🎯',
    title: 'Mixed',
    description: 'Combination of infrastructure, app, and business metrics',
    examples: ['Custom Dashboard', 'Executive Overview', 'Team Health']
  }
];

interface Step1PurposeProps {
  value: DashboardPurpose | null;
  onSelect: (purpose: DashboardPurpose) => void;
}

export function Step1Purpose({ value, onSelect }: Step1PurposeProps) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-tv-2xl font-semibold text-madhive-pink mb-4">
          What are you monitoring?
        </h2>
        <p className="text-tv-lg text-madhive-chalk/80">
          This helps us suggest the right metrics and layouts
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {PURPOSE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onSelect(option.value)}
            className={`
              p-8 rounded-lg border-2 text-left transition-all duration-200
              hover:scale-105 hover:shadow-xl hover:shadow-madhive-pink/20
              ${
                value === option.value
                  ? 'bg-madhive-pink border-madhive-pink text-madhive-purple-deepest'
                  : 'bg-madhive-purple-dark border-madhive-purple-medium text-madhive-chalk hover:border-madhive-pink'
              }
            `}
          >
            <div className="text-6xl mb-4">{option.icon}</div>
            <h3 className={`text-tv-xl font-semibold mb-2 ${value === option.value ? 'text-madhive-purple-deepest' : 'text-madhive-pink'}`}>
              {option.title}
            </h3>
            <p className={`text-tv-base mb-4 ${value === option.value ? 'text-madhive-purple-deepest/80' : 'text-madhive-chalk/70'}`}>
              {option.description}
            </p>
            <div className="space-y-1">
              {option.examples.map((example, idx) => (
                <div
                  key={idx}
                  className={`text-tv-sm ${value === option.value ? 'text-madhive-purple-deepest/70' : 'text-madhive-chalk/60'}`}
                >
                  • {example}
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
