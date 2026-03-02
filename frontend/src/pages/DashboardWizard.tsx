// frontend/src/pages/DashboardWizard.tsx
import { useState } from 'react';
import { WizardProgress } from '@/components/ui/WizardProgress';
import { Step1Purpose } from '@/components/wizard/Step1Purpose';
import { Step2DataSources } from '@/components/wizard/Step2DataSources';
import { Step3MetricPicker } from '@/components/wizard/Step3MetricPicker';
import { Step4VisualStyle } from '@/components/wizard/Step4VisualStyle';
import { Step5Preview } from '@/components/wizard/Step5Preview';
import { Step6Deploy } from '@/components/wizard/Step6Deploy';
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
        </div>
      </div>
    </div>
  );
}
