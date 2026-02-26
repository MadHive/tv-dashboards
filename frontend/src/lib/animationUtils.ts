/**
 * Animate a number value from start to end over duration
 * Useful for count-up effects in big numbers
 */
export function animateValue(
  start: number,
  end: number,
  duration: number,
  onUpdate: (value: number) => void,
  onComplete?: () => void
): () => void {
  const startTime = Date.now();
  const difference = end - start;

  const step = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-out cubic easing
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + difference * eased;

    onUpdate(current);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else if (onComplete) {
      onComplete();
    }
  };

  const animationFrame = requestAnimationFrame(step);

  // Return cancel function
  return () => cancelAnimationFrame(animationFrame);
}

/**
 * Chart.js animation configuration for smooth transitions
 */
export const CHART_ANIMATION_CONFIG = {
  duration: 800,
  easing: 'easeInOutQuart' as const,
};

/**
 * CSS transition duration constant (matches Chart.js)
 */
export const TRANSITION_DURATION = '800ms';
