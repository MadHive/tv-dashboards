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

  it('should prevent infinite loop when all remaining steps are skipped', () => {
    const w = new WizardFramework({
      steps: [
        { id: 'step1', title: 'Step 1', validate: () => true },
        { id: 'step2', title: 'Step 2', skip: () => true, validate: () => true },
        { id: 'step3', title: 'Step 3', skip: () => true, validate: () => true }
      ]
    });

    w.next(); // Try to move from step1 to step2 (which should be skipped)
    // Should end up at the last step instead of looping infinitely
    expect(w.currentStepIndex).toBe(2);
    expect(w.currentStep.id).toBe('step3');
  });

  it('should throw error when no steps provided', () => {
    expect(() => {
      new WizardFramework({ steps: [] });
    }).toThrow('Wizard requires at least one step');
  });

  it('should handle validation errors gracefully', () => {
    const w = new WizardFramework({
      steps: [
        {
          id: 'step1',
          title: 'Step 1',
          validate: () => { throw new Error('Validation failed'); }
        },
        { id: 'step2', title: 'Step 2' }
      ]
    });

    // Should return false when validation throws
    expect(w.canGoNext()).toBe(false);
    expect(w.next()).toBe(false);
    expect(w.currentStepIndex).toBe(0);
  });

  it('should handle onComplete callback errors', () => {
    const w = new WizardFramework({
      steps: [
        { id: 'step1', title: 'Step 1', validate: () => true }
      ],
      onComplete: () => { throw new Error('Complete error'); }
    });

    // Should not throw when complete callback errors
    expect(() => w.complete()).not.toThrow();
  });

  it('should have a destroy method for cleanup', () => {
    // Set up some data to verify cleanup
    wizard.data.test = 'value';
    wizard.container = { textContent: '' }; // Mock container
    wizard.contentElement = {}; // Mock element

    expect(wizard.container).not.toBeNull();
    expect(wizard.contentElement).not.toBeNull();

    wizard.destroy();

    expect(wizard.container).toBeNull();
    expect(wizard.contentElement).toBeNull();
    expect(Object.keys(wizard.data).length).toBe(0);
  });
});
