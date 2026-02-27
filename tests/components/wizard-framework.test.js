// tests/components/wizard-framework.test.js
import { describe, it, expect, beforeEach } from 'bun:test';
import { WizardFramework } from '../../public/js/components/wizard-framework.js';

describe('WizardFramework', () => {
  let wizard;

  beforeEach(() => {

    wizard = new WizardFramework({
      steps: [
        { id: 'step1', title: 'Step 1', validate: () => true },
        { id: 'step2', title: 'Step 2', validate: () => true }
      ],
      onComplete: (data) => data
    });
  });

  it('should initialize with first step active', () => {
    expect(wizard.currentStepIndex).toBe(0);
    expect(wizard.currentStep.id).toBe('step1');
  });

  it('should navigate forward and backward', () => {
    wizard.data.test = 'value';

    // Move forward
    const next = wizard.next();
    expect(next).toBe(true);
    expect(wizard.currentStepIndex).toBe(1);

    // Move backward
    const prev = wizard.previous();
    expect(prev).toBe(true);
    expect(wizard.currentStepIndex).toBe(0);
  });

  it('should skip steps based on skip function', () => {
    const w = new WizardFramework({
      steps: [
        { id: 'step1', title: 'Step 1', validate: () => true },
        { id: 'step2', title: 'Step 2', skip: (data) => data.skipStep2, validate: () => true },
        { id: 'step3', title: 'Step 3', validate: () => true }
      ]
    });

    w.data.skipStep2 = true;
    w.next();
    expect(w.currentStepIndex).toBe(2);
    expect(w.currentStep.id).toBe('step3');
  });
});
