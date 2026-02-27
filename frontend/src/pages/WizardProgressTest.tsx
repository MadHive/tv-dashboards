import { useState } from 'react';
import { WizardProgress } from '@/components/ui/WizardProgress';
import { Button } from '@/components/ui/Button';

export function WizardProgressTest() {
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-madhive-purple-deepest via-madhive-purple-deep to-madhive-purple-dark">
      <div className="container mx-auto px-8 py-16">
        <h1 className="text-tv-2xl font-display font-bold text-madhive-pink mb-8 text-center">
          Wizard Progress Component Test
        </h1>

        <WizardProgress currentStep={currentStep} />

        <div className="max-w-2xl mx-auto mt-12 space-y-6">
          <div className="bg-madhive-purple-dark/50 backdrop-blur-sm rounded-lg border border-madhive-purple-medium p-6">
            <h2 className="text-tv-lg font-semibold text-madhive-pink mb-4">
              Current Step: {currentStep}
            </h2>
            <p className="text-madhive-chalk/80 mb-6">
              Use the buttons below to navigate through the wizard steps and see the progress indicator update.
            </p>

            <div className="flex gap-4 justify-center">
              <Button
                variant="secondary"
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1}
              >
                Previous
              </Button>
              <Button
                variant="primary"
                onClick={() => setCurrentStep(Math.min(6, currentStep + 1))}
                disabled={currentStep === 6}
              >
                Next
              </Button>
            </div>

            <div className="mt-6 pt-6 border-t border-madhive-purple-medium">
              <p className="text-tv-sm text-madhive-chalk/60 mb-3">Quick jump to step:</p>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4, 5, 6].map((step) => (
                  <Button
                    key={step}
                    variant={currentStep === step ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentStep(step)}
                  >
                    {step}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-madhive-purple-dark/50 backdrop-blur-sm rounded-lg border border-madhive-purple-medium p-6">
            <h3 className="text-tv-base font-semibold text-madhive-pink mb-3">
              Visual States
            </h3>
            <ul className="space-y-2 text-tv-sm text-madhive-chalk/80">
              <li className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-madhive-pink"></div>
                <span>Completed steps: Pink background with checkmark</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-madhive-pink ring-2 ring-madhive-pink/30"></div>
                <span>Current step: Pink background with number and ring</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-madhive-purple-dark border-2 border-madhive-purple-medium"></div>
                <span>Future steps: Dark background with border</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
