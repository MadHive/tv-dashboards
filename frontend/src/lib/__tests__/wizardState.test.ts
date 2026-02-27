// frontend/src/lib/__tests__/wizardState.test.ts
import { describe, it, expect } from 'vitest';
import { createInitialState, updateWizardStep } from '../wizardState';

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
    const updated = updateWizardStep(state, 1, { dashboardPurpose: 'infrastructure' });

    expect(updated.dashboardPurpose).toBe('infrastructure');
    expect(updated.currentStep).toBe(2);
  });

  it('should update selected data sources', () => {
    const state = { ...createInitialState(), currentStep: 2 };
    const updated = updateWizardStep(state, 2, { selectedDataSources: ['gcp', 'datadog'] });

    expect(updated.selectedDataSources).toEqual(['gcp', 'datadog']);
    expect(updated.currentStep).toBe(3);
  });
});
