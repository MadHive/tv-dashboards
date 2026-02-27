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
