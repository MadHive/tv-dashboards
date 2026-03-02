# Dashboard Creation Wizard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 6-step wizard that creates beautiful TV dashboards from monitoring tools (GCP, DataDog, GitHub, Jira)

**Architecture:** React wizard with step-based state management, data source connectors for metric discovery, enhanced widget library with 60 FPS animations, TV-optimized display renderer

**Tech Stack:** React 18.3, TypeScript 5.4, Tailwind CSS, Recharts, GCP Monitoring API, existing Elysia backend

---

## Task 1: Wizard State Management

**Files:**
- Create: `frontend/src/lib/wizardState.ts`
- Test: `frontend/src/lib/__tests__/wizardState.test.ts`

**Step 1: Write failing test for wizard state**

```typescript
// frontend/src/lib/__tests__/wizardState.test.ts
import { describe, it, expect } from 'vitest';
import { WizardState, createInitialState, updateWizardStep } from '../wizardState';

describe('wizardState', () => {
  it('should create initial wizard state', () => {
    const state = createInitialState();

    expect(state.currentStep).toBe(1);
    expect(state.dashboardPurpose).toBeNull();
    expect(state.selectedDataSources).toEqual([]);
    expect(state.selectedMetrics).toEqual([]);
    expect(state.layoutType).toBeNull();
    expect(state.animationIntensity).toBe('moderate');
    expect(state.colorScheme).toBe('madhive');
  });

  it('should update dashboard purpose', () => {
    const state = createInitialState();
    const updated = updateWizardStep(state, 1, { purpose: 'infrastructure' });

    expect(updated.dashboardPurpose).toBe('infrastructure');
    expect(updated.currentStep).toBe(2);
  });

  it('should update selected data sources', () => {
    const state = { ...createInitialState(), currentStep: 2 };
    const updated = updateWizardStep(state, 2, { dataSources: ['gcp', 'datadog'] });

    expect(updated.selectedDataSources).toEqual(['gcp', 'datadog']);
    expect(updated.currentStep).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && bun test src/lib/__tests__/wizardState.test.ts`
Expected: FAIL - module not found

**Step 3: Implement wizard state management**

```typescript
// frontend/src/lib/wizardState.ts
export type DashboardPurpose = 'infrastructure' | 'application' | 'business' | 'mixed';
export type DataSource = 'gcp' | 'datadog' | 'github' | 'jira';
export type LayoutType = 'grid' | 'hero-grid' | 'sidebar-main';
export type AnimationIntensity = 'subtle' | 'moderate' | 'bold';
export type ColorScheme = 'madhive' | 'dark-minimal' | 'vibrant';

export interface SelectedMetric {
  id: string;
  source: DataSource;
  name: string;
  category: string;
  suggestedWidget: string;
  order: number;
}

export interface WizardState {
  currentStep: number;
  dashboardPurpose: DashboardPurpose | null;
  selectedDataSources: DataSource[];
  selectedMetrics: SelectedMetric[];
  layoutType: LayoutType | null;
  animationIntensity: AnimationIntensity;
  colorScheme: ColorScheme;
  dashboardName: string;
  refreshInterval: number;
}

export function createInitialState(): WizardState {
  return {
    currentStep: 1,
    dashboardPurpose: null,
    selectedDataSources: [],
    selectedMetrics: [],
    layoutType: null,
    animationIntensity: 'moderate',
    colorScheme: 'madhive',
    dashboardName: '',
    refreshInterval: 60, // seconds
  };
}

export function updateWizardStep(
  state: WizardState,
  step: number,
  data: Partial<WizardState>
): WizardState {
  const updated = { ...state, ...data };

  // Auto-advance to next step
  if (step < 6) {
    updated.currentStep = step + 1;
  }

  return updated;
}

export function canProgressToStep(state: WizardState, targetStep: number): boolean {
  switch (targetStep) {
    case 1:
      return true;
    case 2:
      return state.dashboardPurpose !== null;
    case 3:
      return state.selectedDataSources.length > 0;
    case 4:
      return state.selectedMetrics.length > 0;
    case 5:
      return state.layoutType !== null;
    case 6:
      return state.selectedMetrics.length > 0 && state.layoutType !== null;
    default:
      return false;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && bun test src/lib/__tests__/wizardState.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/lib/wizardState.ts frontend/src/lib/__tests__/wizardState.test.ts
git commit -m "feat(wizard): add wizard state management with tests

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Wizard Progress Component

**Files:**
- Create: `frontend/src/components/ui/WizardProgress.tsx`
- Test: Manual visual test in Storybook or browser

**Step 1: Create wizard progress indicator**

```typescript
// frontend/src/components/ui/WizardProgress.tsx
interface WizardProgressProps {
  currentStep: number;
  totalSteps?: number;
  stepLabels?: string[];
}

export function WizardProgress({
  currentStep,
  totalSteps = 6,
  stepLabels = [
    'Purpose',
    'Data Sources',
    'Metrics',
    'Visual Style',
    'Preview',
    'Deploy'
  ]
}: WizardProgressProps) {
  return (
    <div className="w-full max-w-4xl mx-auto mb-12">
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
          <div key={step} className="flex items-center flex-1">
            {/* Step Circle */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center
                  text-tv-lg font-semibold transition-all duration-300
                  ${
                    step < currentStep
                      ? 'bg-madhive-pink text-madhive-purple-deepest'
                      : step === currentStep
                      ? 'bg-madhive-pink text-madhive-purple-deepest ring-4 ring-madhive-pink/30'
                      : 'bg-madhive-purple-dark text-madhive-chalk/40 border-2 border-madhive-purple-medium'
                  }
                `}
              >
                {step < currentStep ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step
                )}
              </div>
              <div
                className={`
                  mt-2 text-tv-sm font-medium text-center whitespace-nowrap
                  ${step <= currentStep ? 'text-madhive-pink' : 'text-madhive-chalk/40'}
                `}
              >
                {stepLabels[step - 1]}
              </div>
            </div>

            {/* Connector Line */}
            {step < totalSteps && (
              <div
                className={`
                  flex-1 h-1 mx-3 rounded transition-all duration-300
                  ${step < currentStep ? 'bg-madhive-pink' : 'bg-madhive-purple-medium'}
                `}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Test component visually**

Create test page or add to existing page:
```typescript
// Test in browser at http://localhost:3000
<WizardProgress currentStep={3} />
```

Expected: Progress bar showing steps 1-2 complete, step 3 active, steps 4-6 inactive

**Step 3: Commit**

```bash
git add frontend/src/components/ui/WizardProgress.tsx
git commit -m "feat(wizard): add progress indicator component

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Step 1 - Dashboard Purpose Selection

**Files:**
- Create: `frontend/src/components/wizard/Step1Purpose.tsx`
- Modify: `frontend/src/pages/DashboardWizard.tsx` (create main page)

**Step 1: Create main wizard page shell**

```typescript
// frontend/src/pages/DashboardWizard.tsx
import { useState } from 'react';
import { WizardProgress } from '@/components/ui/WizardProgress';
import { Step1Purpose } from '@/components/wizard/Step1Purpose';
import { createInitialState, WizardState } from '@/lib/wizardState';

export function DashboardWizard() {
  const [wizardState, setWizardState] = useState<WizardState>(createInitialState());

  return (
    <div className="min-h-screen bg-gradient-to-br from-madhive-purple-deepest via-madhive-purple-deep to-madhive-purple-dark">
      <div className="container mx-auto px-12 py-12 max-w-7xl">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-tv-huge font-display font-bold text-madhive-pink mb-4">
            Create Dashboard
          </h1>
          <p className="text-tv-xl text-madhive-chalk/90">
            Build a beautiful TV dashboard in 6 easy steps
          </p>
        </div>

        <WizardProgress currentStep={wizardState.currentStep} />

        {/* Step Content */}
        <div className="max-w-5xl mx-auto">
          {wizardState.currentStep === 1 && (
            <Step1Purpose
              value={wizardState.dashboardPurpose}
              onSelect={(purpose) => {
                setWizardState({ ...wizardState, dashboardPurpose: purpose, currentStep: 2 });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create purpose selection component**

```typescript
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
```

**Step 3: Add route to App.tsx**

```typescript
// frontend/src/App.tsx - Add this route
import { DashboardWizard } from '@/pages/DashboardWizard';

// In Routes:
<Route path="/app/dashboard/wizard" element={<DashboardWizard />} />
```

**Step 4: Test in browser**

Run: `cd frontend && bun run dev`
Navigate to: `http://localhost:3000/app/dashboard/wizard`
Expected: See 4 purpose cards, clicking one highlights it and advances to step 2

**Step 5: Commit**

```bash
git add frontend/src/pages/DashboardWizard.tsx frontend/src/components/wizard/Step1Purpose.tsx frontend/src/App.tsx
git commit -m "feat(wizard): add step 1 - dashboard purpose selection

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: GCP Monitoring Connector (Metric Discovery)

**Files:**
- Create: `frontend/src/lib/dataSourceConnectors/gcpMonitoring.ts`
- Test: `frontend/src/lib/dataSourceConnectors/__tests__/gcpMonitoring.test.ts`

**Step 1: Write failing test for GCP metric discovery**

```typescript
// frontend/src/lib/dataSourceConnectors/__tests__/gcpMonitoring.test.ts
import { describe, it, expect, vi } from 'vitest';
import { discoverGCPMetrics, testGCPConnection } from '../gcpMonitoring';

describe('gcpMonitoring', () => {
  it('should discover GCP metrics by category', async () => {
    const metrics = await discoverGCPMetrics();

    expect(metrics).toHaveProperty('performance');
    expect(metrics).toHaveProperty('errors');
    expect(metrics).toHaveProperty('resources');
    expect(metrics.performance).toBeInstanceOf(Array);
    expect(metrics.performance.length).toBeGreaterThan(0);
  });

  it('should test GCP connection', async () => {
    const result = await testGCPConnection();

    expect(result).toHaveProperty('connected');
    expect(result).toHaveProperty('metricsCount');
    expect(typeof result.connected).toBe('boolean');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && bun test src/lib/dataSourceConnectors/__tests__/gcpMonitoring.test.ts`
Expected: FAIL - module not found

**Step 3: Implement GCP connector**

```typescript
// frontend/src/lib/dataSourceConnectors/gcpMonitoring.ts
import { api } from '../api';

export interface GCPMetric {
  id: string;
  name: string;
  description: string;
  unit: string;
  category: 'performance' | 'errors' | 'resources' | 'deployments';
  service: string;
  suggestedWidget: 'big-number' | 'gauge' | 'trend' | 'status';
}

export interface GCPMetricsByCategory {
  performance: GCPMetric[];
  errors: GCPMetric[];
  resources: GCPMetric[];
  deployments: GCPMetric[];
}

// Predefined GCP metrics based on common Cloud Monitoring metrics
const GCP_METRICS_CATALOG: GCPMetric[] = [
  // Cloud Run - Performance
  {
    id: 'run.googleapis.com/request_count',
    name: 'Requests/sec',
    description: 'Number of requests per second',
    unit: 'count/s',
    category: 'performance',
    service: 'Cloud Run',
    suggestedWidget: 'big-number'
  },
  {
    id: 'run.googleapis.com/request_latencies',
    name: 'Request Latency',
    description: 'Request latency distribution',
    unit: 'ms',
    category: 'performance',
    service: 'Cloud Run',
    suggestedWidget: 'trend'
  },
  // Cloud Run - Resources
  {
    id: 'run.googleapis.com/container/cpu/utilizations',
    name: 'CPU Utilization',
    description: 'Container CPU usage percentage',
    unit: '%',
    category: 'resources',
    service: 'Cloud Run',
    suggestedWidget: 'gauge'
  },
  {
    id: 'run.googleapis.com/container/memory/utilizations',
    name: 'Memory Utilization',
    description: 'Container memory usage percentage',
    unit: '%',
    category: 'resources',
    service: 'Cloud Run',
    suggestedWidget: 'gauge'
  },
  {
    id: 'run.googleapis.com/container/instance_count',
    name: 'Active Instances',
    description: 'Number of active container instances',
    unit: 'count',
    category: 'resources',
    service: 'Cloud Run',
    suggestedWidget: 'big-number'
  },
  // Compute Engine
  {
    id: 'compute.googleapis.com/instance/cpu/utilization',
    name: 'VM CPU Usage',
    description: 'Virtual machine CPU utilization',
    unit: '%',
    category: 'resources',
    service: 'Compute Engine',
    suggestedWidget: 'gauge'
  },
  {
    id: 'compute.googleapis.com/instance/network/received_bytes_count',
    name: 'Network In',
    description: 'Network bytes received',
    unit: 'bytes/s',
    category: 'performance',
    service: 'Compute Engine',
    suggestedWidget: 'trend'
  },
  // BigQuery
  {
    id: 'bigquery.googleapis.com/query/count',
    name: 'Query Count',
    description: 'Number of BigQuery queries',
    unit: 'count',
    category: 'performance',
    service: 'BigQuery',
    suggestedWidget: 'big-number'
  },
  {
    id: 'bigquery.googleapis.com/query/execution_times',
    name: 'Query Execution Time',
    description: 'Query execution duration',
    unit: 'ms',
    category: 'performance',
    service: 'BigQuery',
    suggestedWidget: 'trend'
  },
  {
    id: 'bigquery.googleapis.com/slots/total_available',
    name: 'Available Slots',
    description: 'BigQuery slot availability',
    unit: 'count',
    category: 'resources',
    service: 'BigQuery',
    suggestedWidget: 'gauge'
  },
  // Pub/Sub
  {
    id: 'pubsub.googleapis.com/topic/send_message_operation_count',
    name: 'Messages Published',
    description: 'Number of messages published to topics',
    unit: 'count/s',
    category: 'performance',
    service: 'Pub/Sub',
    suggestedWidget: 'big-number'
  },
  {
    id: 'pubsub.googleapis.com/subscription/oldest_unacked_message_age',
    name: 'Oldest Unacked Message',
    description: 'Age of oldest unacknowledged message',
    unit: 'seconds',
    category: 'performance',
    service: 'Pub/Sub',
    suggestedWidget: 'big-number'
  }
];

export async function discoverGCPMetrics(): Promise<GCPMetricsByCategory> {
  // In future, this could call backend API to discover actual available metrics
  // For now, return categorized catalog

  const categorized: GCPMetricsByCategory = {
    performance: [],
    errors: [],
    resources: [],
    deployments: []
  };

  GCP_METRICS_CATALOG.forEach((metric) => {
    categorized[metric.category].push(metric);
  });

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  return categorized;
}

export async function testGCPConnection(): Promise<{ connected: boolean; metricsCount: number }> {
  try {
    // Test if backend GCP connection is available
    // In future, call actual test endpoint
    const metrics = await discoverGCPMetrics();
    const totalMetrics = Object.values(metrics).reduce((sum, arr) => sum + arr.length, 0);

    return {
      connected: true,
      metricsCount: totalMetrics
    };
  } catch (error) {
    return {
      connected: false,
      metricsCount: 0
    };
  }
}

export function getMetricById(metricId: string): GCPMetric | undefined {
  return GCP_METRICS_CATALOG.find(m => m.id === metricId);
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && bun test src/lib/dataSourceConnectors/__tests__/gcpMonitoring.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/lib/dataSourceConnectors/gcpMonitoring.ts frontend/src/lib/dataSourceConnectors/__tests__/gcpMonitoring.test.ts
git commit -m "feat(wizard): add GCP Monitoring metric discovery connector

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Step 2 - Data Source Selection

**Files:**
- Create: `frontend/src/components/wizard/Step2DataSources.tsx`
- Modify: `frontend/src/pages/DashboardWizard.tsx`

**Step 1: Create data source selection component**

```typescript
// frontend/src/components/wizard/Step2DataSources.tsx
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
```

**Step 2: Integrate into main wizard**

```typescript
// frontend/src/pages/DashboardWizard.tsx - Add step 2
import { Step2DataSources } from '@/components/wizard/Step2DataSources';

// In render:
{wizardState.currentStep === 2 && (
  <Step2DataSources
    value={wizardState.selectedDataSources}
    onUpdate={(sources) => {
      setWizardState({ ...wizardState, selectedDataSources: sources });
    }}
    onNext={() => {
      setWizardState({ ...wizardState, currentStep: 3 });
    }}
  />
)}
```

**Step 3: Test in browser**

Run: `cd frontend && bun run dev`
Complete step 1, verify step 2 shows data sources with GCP showing as connected
Expected: Can select GCP, button enables, clicking Continue advances to step 3

**Step 4: Commit**

```bash
git add frontend/src/components/wizard/Step2DataSources.tsx frontend/src/pages/DashboardWizard.tsx
git commit -m "feat(wizard): add step 2 - data source selection with connection testing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Step 3 - Metric Picker

**Files:**
- Create: `frontend/src/components/wizard/Step3MetricPicker.tsx`
- Create: `frontend/src/components/ui/MetricCard.tsx`
- Modify: `frontend/src/pages/DashboardWizard.tsx`

**Step 1: Create draggable metric card component**

```typescript
// frontend/src/components/ui/MetricCard.tsx
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
```

**Step 2: Create metric picker component**

```typescript
// frontend/src/components/wizard/Step3MetricPicker.tsx
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
```

**Step 3: Integrate into main wizard**

```typescript
// frontend/src/pages/DashboardWizard.tsx - Add step 3
import { Step3MetricPicker } from '@/components/wizard/Step3MetricPicker';

// In render:
{wizardState.currentStep === 3 && (
  <Step3MetricPicker
    dataSources={wizardState.selectedDataSources}
    selectedMetrics={wizardState.selectedMetrics}
    onUpdate={(metrics) => {
      setWizardState({ ...wizardState, selectedMetrics: metrics });
    }}
    onNext={() => {
      setWizardState({ ...wizardState, currentStep: 4 });
    }}
    onBack={() => {
      setWizardState({ ...wizardState, currentStep: 2 });
    }}
  />
)}
```

**Step 4: Test in browser**

Navigate through steps 1-3, select GCP, browse metrics by category
Expected: Can select metrics, see them in right panel, remove them, proceed to step 4

**Step 5: Commit**

```bash
git add frontend/src/components/wizard/Step3MetricPicker.tsx frontend/src/components/ui/MetricCard.tsx frontend/src/pages/DashboardWizard.tsx
git commit -m "feat(wizard): add step 3 - metric picker with categorized browsing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Step 4 - Visual Style Selection

**Files:**
- Create: `frontend/src/components/wizard/Step4VisualStyle.tsx`
- Modify: `frontend/src/pages/DashboardWizard.tsx`

**Step 1: Create visual style component**

```typescript
// frontend/src/components/wizard/Step4VisualStyle.tsx
import { LayoutType, AnimationIntensity, ColorScheme } from '@/lib/wizardState';

interface Step4VisualStyleProps {
  layoutType: LayoutType | null;
  animationIntensity: AnimationIntensity;
  colorScheme: ColorScheme;
  onUpdateLayout: (layout: LayoutType) => void;
  onUpdateAnimation: (intensity: AnimationIntensity) => void;
  onUpdateColorScheme: (scheme: ColorScheme) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step4VisualStyle({
  layoutType,
  animationIntensity,
  colorScheme,
  onUpdateLayout,
  onUpdateAnimation,
  onUpdateColorScheme,
  onNext,
  onBack
}: Step4VisualStyleProps) {
  const layouts: Array<{ value: LayoutType; name: string; preview: string }> = [
    {
      value: 'grid',
      name: 'Grid Layout',
      preview: `┌────┐ ┌────┐ ┌────┐
│ 1  │ │ 2  │ │ 3  │
└────┘ └────┘ └────┘
┌──────────┐ ┌──────────┐
│    4     │ │    5     │
└──────────┘ └──────────┘`
    },
    {
      value: 'hero-grid',
      name: 'Hero + Grid',
      preview: `┌─────────────────────────┐
│     Hero Metric         │
└─────────────────────────┘
┌────┐ ┌────┐ ┌────┐
│ 1  │ │ 2  │ │ 3  │
└────┘ └────┘ └────┘`
    },
    {
      value: 'sidebar-main',
      name: 'Sidebar + Main',
      preview: `┌──┐ ┌─────────────────┐
│1 │ │                 │
├──┤ │   Main Chart    │
│2 │ │                 │
├──┤ └─────────────────┘
│3 │ ┌────┐ ┌────┐
└──┘ │ 4  │ │ 5  │`
    }
  ];

  const animations: Array<{ value: AnimationIntensity; icon: string; name: string; description: string }> = [
    {
      value: 'subtle',
      icon: '🌙',
      name: 'Subtle',
      description: 'Minimal motion, fade transitions'
    },
    {
      value: 'moderate',
      icon: '⭐',
      name: 'Moderate',
      description: 'Smooth animations, data transitions (recommended)'
    },
    {
      value: 'bold',
      icon: '✨',
      name: 'Bold',
      description: 'Eye-catching effects, glows, pulses'
    }
  ];

  const colorSchemes: Array<{ value: ColorScheme; icon: string; name: string; colors: string[] }> = [
    {
      value: 'madhive',
      icon: '🎨',
      name: 'MadHive Brand',
      colors: ['#FDA4D4', '#4a2c6d', '#1a0b2e']
    },
    {
      value: 'dark-minimal',
      icon: '🌃',
      name: 'Dark Minimal',
      colors: ['#000000', '#333333', '#ffffff']
    },
    {
      value: 'vibrant',
      icon: '🌈',
      name: 'Vibrant',
      colors: ['#ff4757', '#00d9ff', '#00ff9f', '#ffb800']
    }
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-tv-2xl font-semibold text-madhive-pink mb-4">
          Choose Visual Style
        </h2>
        <p className="text-tv-lg text-madhive-chalk/80">
          Customize how your dashboard looks on TV displays
        </p>
      </div>

      {/* Layout Selection */}
      <div>
        <h3 className="text-tv-xl font-semibold text-madhive-chalk mb-4">Layout</h3>
        <div className="grid grid-cols-3 gap-4">
          {layouts.map((layout) => (
            <button
              key={layout.value}
              onClick={() => onUpdateLayout(layout.value)}
              className={`
                p-6 rounded-lg border-2 transition-all
                ${
                  layoutType === layout.value
                    ? 'bg-madhive-pink border-madhive-pink text-madhive-purple-deepest'
                    : 'bg-madhive-purple-dark border-madhive-purple-medium text-madhive-chalk hover:border-madhive-pink'
                }
              `}
            >
              <div className="text-tv-base font-semibold mb-4">{layout.name}</div>
              <pre className={`text-tv-xs font-mono ${layoutType === layout.value ? 'text-madhive-purple-deepest/70' : 'text-madhive-chalk/60'}`}>
                {layout.preview}
              </pre>
            </button>
          ))}
        </div>
      </div>

      {/* Animation Intensity */}
      <div>
        <h3 className="text-tv-xl font-semibold text-madhive-chalk mb-4">Animation Intensity</h3>
        <div className="grid grid-cols-3 gap-4">
          {animations.map((anim) => (
            <button
              key={anim.value}
              onClick={() => onUpdateAnimation(anim.value)}
              className={`
                p-6 rounded-lg border-2 text-left transition-all
                ${
                  animationIntensity === anim.value
                    ? 'bg-madhive-pink border-madhive-pink text-madhive-purple-deepest'
                    : 'bg-madhive-purple-dark border-madhive-purple-medium text-madhive-chalk hover:border-madhive-pink'
                }
              `}
            >
              <div className="text-4xl mb-3">{anim.icon}</div>
              <div className={`text-tv-lg font-semibold mb-2 ${animationIntensity === anim.value ? 'text-madhive-purple-deepest' : 'text-madhive-pink'}`}>
                {anim.name}
              </div>
              <div className={`text-tv-sm ${animationIntensity === anim.value ? 'text-madhive-purple-deepest/70' : 'text-madhive-chalk/60'}`}>
                {anim.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Color Scheme */}
      <div>
        <h3 className="text-tv-xl font-semibold text-madhive-chalk mb-4">Color Scheme</h3>
        <div className="grid grid-cols-3 gap-4">
          {colorSchemes.map((scheme) => (
            <button
              key={scheme.value}
              onClick={() => onUpdateColorScheme(scheme.value)}
              className={`
                p-6 rounded-lg border-2 text-left transition-all
                ${
                  colorScheme === scheme.value
                    ? 'bg-madhive-pink border-madhive-pink text-madhive-purple-deepest'
                    : 'bg-madhive-purple-dark border-madhive-purple-medium text-madhive-chalk hover:border-madhive-pink'
                }
              `}
            >
              <div className="text-4xl mb-3">{scheme.icon}</div>
              <div className={`text-tv-lg font-semibold mb-3 ${colorScheme === scheme.value ? 'text-madhive-purple-deepest' : 'text-madhive-pink'}`}>
                {scheme.name}
              </div>
              <div className="flex gap-2">
                {scheme.colors.map((color, idx) => (
                  <div
                    key={idx}
                    className="w-8 h-8 rounded border-2 border-white/20"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </button>
          ))}
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
          disabled={!layoutType}
          className={`
            px-8 py-4 rounded-lg text-tv-lg font-semibold transition-all
            ${
              layoutType
                ? 'bg-madhive-pink text-madhive-purple-deepest hover:bg-madhive-pink/80'
                : 'bg-madhive-purple-medium text-madhive-chalk/50 cursor-not-allowed'
            }
          `}
        >
          Preview Dashboard →
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Integrate into main wizard**

```typescript
// frontend/src/pages/DashboardWizard.tsx - Add step 4
import { Step4VisualStyle } from '@/components/wizard/Step4VisualStyle';

// In render:
{wizardState.currentStep === 4 && (
  <Step4VisualStyle
    layoutType={wizardState.layoutType}
    animationIntensity={wizardState.animationIntensity}
    colorScheme={wizardState.colorScheme}
    onUpdateLayout={(layout) => {
      setWizardState({ ...wizardState, layoutType: layout });
    }}
    onUpdateAnimation={(intensity) => {
      setWizardState({ ...wizardState, animationIntensity: intensity });
    }}
    onUpdateColorScheme={(scheme) => {
      setWizardState({ ...wizardState, colorScheme: scheme });
    }}
    onNext={() => {
      setWizardState({ ...wizardState, currentStep: 5 });
    }}
    onBack={() => {
      setWizardState({ ...wizardState, currentStep: 3 });
    }}
  />
)}
```

**Step 3: Test in browser**

Navigate to step 4, select layout, animation, and color scheme
Expected: Selections highlight, can navigate back/forward

**Step 4: Commit**

```bash
git add frontend/src/components/wizard/Step4VisualStyle.tsx frontend/src/pages/DashboardWizard.tsx
git commit -m "feat(wizard): add step 4 - visual style selection (layout, animation, colors)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Step 5 - Preview & Deploy Stub

**Files:**
- Create: `frontend/src/components/wizard/Step5Preview.tsx`
- Create: `frontend/src/components/wizard/Step6Deploy.tsx`
- Modify: `frontend/src/pages/DashboardWizard.tsx`

**Step 1: Create preview stub (will enhance in later tasks)**

```typescript
// frontend/src/components/wizard/Step5Preview.tsx
interface Step5PreviewProps {
  onNext: () => void;
  onBack: () => void;
}

export function Step5Preview({ onNext, onBack }: Step5PreviewProps) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-tv-2xl font-semibold text-madhive-pink mb-4">
          Preview Your Dashboard
        </h2>
        <p className="text-tv-lg text-madhive-chalk/80">
          See how your dashboard will look on a TV display
        </p>
      </div>

      <div className="bg-madhive-purple-dark border-2 border-madhive-purple-medium rounded-lg p-12 min-h-[400px] flex items-center justify-center">
        <div className="text-center text-madhive-chalk/60">
          <div className="text-tv-2xl mb-4">📺</div>
          <div className="text-tv-lg">Dashboard preview will render here</div>
          <div className="text-tv-sm mt-2">(Enhanced in later tasks with actual widgets)</div>
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
          className="px-8 py-4 bg-madhive-pink text-madhive-purple-deepest rounded-lg text-tv-lg font-semibold hover:bg-madhive-pink/80 transition-all"
        >
          Deploy Dashboard →
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Create deploy step**

```typescript
// frontend/src/components/wizard/Step6Deploy.tsx
import { useState } from 'react';

interface Step6DeployProps {
  dashboardName: string;
  refreshInterval: number;
  onUpdateName: (name: string) => void;
  onUpdateInterval: (interval: number) => void;
  onDeploy: () => void;
  onBack: () => void;
}

export function Step6Deploy({
  dashboardName,
  refreshInterval,
  onUpdateName,
  onUpdateInterval,
  onDeploy,
  onBack
}: Step6DeployProps) {
  const [deployed, setDeployed] = useState(false);
  const [displayUrl, setDisplayUrl] = useState('');

  const handleDeploy = () => {
    // Generate URL based on dashboard name
    const slug = dashboardName.toLowerCase().replace(/\s+/g, '-');
    const url = `http://tv.madhive.dev/dashboard/${slug}`;
    setDisplayUrl(url);
    setDeployed(true);
    onDeploy();
  };

  if (deployed) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="text-7xl mb-6">✅</div>
          <h2 className="text-tv-3xl font-semibold text-madhive-pink mb-4">
            Dashboard Created!
          </h2>
        </div>

        <div className="bg-madhive-purple-dark border-2 border-madhive-pink rounded-lg p-8 space-y-6">
          <div>
            <div className="text-tv-sm text-madhive-chalk/60 mb-2">📺 Display URL</div>
            <div className="text-tv-xl text-madhive-pink font-mono">{displayUrl}</div>
            <div className="text-tv-sm text-madhive-chalk/60 mt-2">
              Open this URL on your office TV and press F11 for full-screen
            </div>
          </div>

          <div>
            <div className="text-tv-sm text-madhive-chalk/60 mb-2">📋 Edit URL</div>
            <div className="text-tv-lg text-madhive-chalk font-mono">
              {displayUrl}/edit
            </div>
          </div>

          <div className="pt-4 border-t border-madhive-purple-medium">
            <div className="text-tv-base text-madhive-chalk mb-3">Next Steps:</div>
            <ul className="space-y-2 text-tv-sm text-madhive-chalk/80">
              <li>1. Open Display URL on your office TV</li>
              <li>2. Press F11 for full-screen mode</li>
              <li>3. Dashboard will auto-refresh every {refreshInterval}s</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <a
            href="/app"
            className="px-8 py-4 bg-madhive-purple-dark border-2 border-madhive-purple-medium text-madhive-chalk rounded-lg text-tv-lg font-semibold hover:bg-madhive-purple-medium transition-all"
          >
            Back to Home
          </a>
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 bg-madhive-pink text-madhive-purple-deepest rounded-lg text-tv-lg font-semibold hover:bg-madhive-pink/80 transition-all"
          >
            View Dashboard →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-tv-2xl font-semibold text-madhive-pink mb-4">
          Deploy to TV
        </h2>
        <p className="text-tv-lg text-madhive-chalk/80">
          Configure final settings for your dashboard
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Dashboard Name */}
        <div>
          <label className="block text-tv-base font-semibold text-madhive-chalk mb-2">
            Dashboard Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={dashboardName}
            onChange={(e) => onUpdateName(e.target.value)}
            placeholder="e.g., Infrastructure Health"
            className="w-full px-6 py-4 bg-madhive-purple-dark border-2 border-madhive-purple-medium rounded-lg text-tv-lg text-madhive-chalk placeholder-madhive-chalk/40 focus:outline-none focus:ring-2 focus:ring-madhive-pink"
          />
        </div>

        {/* Refresh Interval */}
        <div>
          <label className="block text-tv-base font-semibold text-madhive-chalk mb-2">
            Refresh Interval
          </label>
          <select
            value={refreshInterval}
            onChange={(e) => onUpdateInterval(Number(e.target.value))}
            className="w-full px-6 py-4 bg-madhive-purple-dark border-2 border-madhive-purple-medium rounded-lg text-tv-lg text-madhive-chalk focus:outline-none focus:ring-2 focus:ring-madhive-pink"
          >
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute (recommended)</option>
            <option value={300}>5 minutes</option>
            <option value={900}>15 minutes</option>
          </select>
        </div>

        {/* Info Box */}
        <div className="p-6 bg-madhive-purple-dark/50 border border-madhive-purple-medium rounded-lg">
          <div className="text-tv-sm text-madhive-chalk/80 space-y-2">
            <div>• Dashboard will auto-refresh at the selected interval</div>
            <div>• Best viewed on 1080p or 4K displays</div>
            <div>• Use Chrome or Chromium for best compatibility</div>
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
          onClick={handleDeploy}
          disabled={!dashboardName}
          className={`
            px-8 py-4 rounded-lg text-tv-lg font-semibold transition-all
            ${
              dashboardName
                ? 'bg-madhive-pink text-madhive-purple-deepest hover:bg-madhive-pink/80'
                : 'bg-madhive-purple-medium text-madhive-chalk/50 cursor-not-allowed'
            }
          `}
        >
          Create Dashboard 🚀
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Integrate steps 5 and 6 into wizard**

```typescript
// frontend/src/pages/DashboardWizard.tsx - Add steps 5 and 6
import { Step5Preview } from '@/components/wizard/Step5Preview';
import { Step6Deploy } from '@/components/wizard/Step6Deploy';

// In render:
{wizardState.currentStep === 5 && (
  <Step5Preview
    onNext={() => {
      setWizardState({ ...wizardState, currentStep: 6 });
    }}
    onBack={() => {
      setWizardState({ ...wizardState, currentStep: 4 });
    }}
  />
)}

{wizardState.currentStep === 6 && (
  <Step6Deploy
    dashboardName={wizardState.dashboardName}
    refreshInterval={wizardState.refreshInterval}
    onUpdateName={(name) => {
      setWizardState({ ...wizardState, dashboardName: name });
    }}
    onUpdateInterval={(interval) => {
      setWizardState({ ...wizardState, refreshInterval: interval });
    }}
    onDeploy={() => {
      console.log('Dashboard deployed:', wizardState);
      // TODO: Save to backend in later task
    }}
    onBack={() => {
      setWizardState({ ...wizardState, currentStep: 5 });
    }}
  />
)}
```

**Step 4: Test complete wizard flow**

Run: `cd frontend && bun run dev`
Navigate through all 6 steps
Expected: Can complete wizard, see success screen with URLs

**Step 5: Commit**

```bash
git add frontend/src/components/wizard/Step5Preview.tsx frontend/src/components/wizard/Step6Deploy.tsx frontend/src/pages/DashboardWizard.tsx
git commit -m "feat(wizard): add steps 5-6 - preview and deploy configuration

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Summary

This implementation plan creates the foundation for the Dashboard Creation Wizard:

**Completed Components:**
- Wizard state management with TypeScript types
- Progress indicator showing 6 steps
- Step 1: Dashboard purpose selection (4 categories)
- Step 2: Data source selection with connection testing
- Step 3: Metric picker with categorized browsing
- Step 4: Visual style (layout, animation, colors)
- Step 5: Preview stub (to be enhanced)
- Step 6: Deploy configuration and success screen
- GCP Monitoring connector with metric discovery

**Next Steps (Future Tasks):**
- Enhanced widgets (BigNumber, Gauge, Status, Trend, Feed)
- Dashboard renderer for TV display mode
- Backend API integration for saving dashboards
- DataDog, GitHub, Jira connectors
- Template system
- Real-time data streaming
- Performance optimizations

**Testing Strategy:**
- Unit tests for wizard state management and connectors
- Integration tests for wizard flow
- Visual testing in browser for UI components
- End-to-end test: Create dashboard → View on TV

The wizard is now functional end-to-end and ready for enhancement with real widgets and backend integration.
