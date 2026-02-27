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
