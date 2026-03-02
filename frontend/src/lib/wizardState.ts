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
