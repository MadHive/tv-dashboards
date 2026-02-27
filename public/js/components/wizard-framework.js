// public/js/components/wizard-framework.js

/**
 * WizardFramework - Reusable multi-step wizard orchestrator
 */
export class WizardFramework {
  constructor(config) {
    this.steps = config.steps || [];
    this.onComplete = config.onComplete || (() => {});
    this.onCancel = config.onCancel || (() => {});
    this.currentStepIndex = 0;
    this.data = {};
    this.container = null;
  }

  get currentStep() {
    return this.steps[this.currentStepIndex];
  }

  get isFirstStep() {
    return this.currentStepIndex === 0;
  }

  get isLastStep() {
    return this.currentStepIndex === this.steps.length - 1;
  }

  canGoNext() {
    if (!this.currentStep) return false;
    if (!this.currentStep.validate) return true;
    return this.currentStep.validate(this.data);
  }

  next() {
    if (!this.canGoNext()) return false;
    if (this.isLastStep) {
      this.complete();
      return true;
    }

    this.currentStepIndex++;

    // Skip steps if skip function returns true
    while (this.currentStepIndex < this.steps.length &&
           this.currentStep.skip &&
           this.currentStep.skip(this.data)) {
      this.currentStepIndex++;
    }

    return true;
  }

  previous() {
    if (this.isFirstStep) return false;

    this.currentStepIndex--;

    // Skip steps backwards
    while (this.currentStepIndex > 0 &&
           this.currentStep.skip &&
           this.currentStep.skip(this.data)) {
      this.currentStepIndex--;
    }

    return true;
  }

  complete() {
    this.onComplete(this.data);
  }

  cancel() {
    this.onCancel();
  }

  // UI Rendering
  render(container) {
    this.container = container;
    container.textContent = '';
    container.className = 'wizard-container';

    const progress = this.createProgressIndicator();
    container.appendChild(progress);

    const content = document.createElement('div');
    content.className = 'wizard-content';
    content.id = 'wizard-content';
    container.appendChild(content);

    const nav = this.createNavigationButtons();
    container.appendChild(nav);

    this.renderStep();
  }

  createProgressIndicator() {
    const progress = document.createElement('div');
    progress.className = 'wizard-progress';

    this.steps.forEach((step, index) => {
      const stepEl = document.createElement('div');
      stepEl.className = 'wizard-progress-step';

      if (index < this.currentStepIndex) {
        stepEl.classList.add('completed');
      } else if (index === this.currentStepIndex) {
        stepEl.classList.add('active');
      }

      const number = document.createElement('span');
      number.className = 'step-number';
      number.textContent = index + 1;
      stepEl.appendChild(number);

      const title = document.createElement('span');
      title.className = 'step-title';
      title.textContent = step.title;
      stepEl.appendChild(title);

      progress.appendChild(stepEl);
    });

    return progress;
  }

  createNavigationButtons() {
    const nav = document.createElement('div');
    nav.className = 'wizard-navigation';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-secondary';
    prevBtn.textContent = 'Previous';
    prevBtn.disabled = this.isFirstStep;
    prevBtn.onclick = () => {
      if (this.previous()) {
        this.render(this.container);
      }
    };
    nav.appendChild(prevBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => this.cancel();
    nav.appendChild(cancelBtn);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-primary';
    nextBtn.textContent = this.isLastStep ? 'Complete' : 'Next';
    nextBtn.disabled = !this.canGoNext();
    nextBtn.onclick = () => {
      if (this.next()) {
        if (!this.isLastStep || this.currentStepIndex < this.steps.length) {
          this.render(this.container);
        }
      }
    };
    nav.appendChild(nextBtn);

    return nav;
  }

  renderStep() {
    const content = document.getElementById('wizard-content');
    if (!content) return;

    content.textContent = '';

    const step = this.currentStep;
    if (!step) return;

    if (step.component) {
      const component = new step.component(this.data);
      component.render(content);
    } else {
      const title = document.createElement('h2');
      title.textContent = step.title;
      content.appendChild(title);
    }
  }
}
