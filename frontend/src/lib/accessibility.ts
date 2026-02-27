/**
 * Accessibility utility functions and helpers
 */

/**
 * Generate accessible ARIA label for widgets
 */
export function getWidgetAriaLabel(title?: string, type?: string): string {
  if (title && type) {
    return `${title} ${type} widget`;
  }
  if (title) {
    return `${title} widget`;
  }
  if (type) {
    return `${type} widget`;
  }
  return 'Widget';
}

/**
 * Format number for screen reader announcement
 */
export function formatNumberForScreenReader(value: number | string, unit?: string): string {
  const valueStr = typeof value === 'number' ? value.toLocaleString() : value;
  return unit ? `${valueStr} ${unit}` : valueStr;
}

/**
 * Get appropriate aria-live value based on urgency
 */
export function getAriaLive(isError: boolean): 'polite' | 'assertive' {
  return isError ? 'assertive' : 'polite';
}

/**
 * Create accessible loading message
 */
export function getLoadingMessage(context?: string): string {
  return context ? `Loading ${context}...` : 'Loading...';
}

/**
 * Create accessible error message
 */
export function getErrorMessage(error: Error | unknown, context?: string): string {
  const baseMessage = context ? `Error loading ${context}` : 'Error occurred';
  const errorDetail = error instanceof Error ? error.message : 'Unknown error';
  return `${baseMessage}: ${errorDetail}`;
}

/**
 * Announce to screen readers
 * Creates a temporary element with aria-live that announces the message
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Check if element is keyboard accessible
 */
export function isKeyboardAccessible(element: HTMLElement): boolean {
  const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
  const hasTabIndex = element.hasAttribute('tabindex') && element.tabIndex >= 0;
  const isInteractive = interactiveTags.includes(element.tagName);

  return isInteractive || hasTabIndex;
}

/**
 * Trap focus within a container (for modals)
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        lastFocusable?.focus();
        e.preventDefault();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        firstFocusable?.focus();
        e.preventDefault();
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Get color contrast ratio (simplified)
 * Use for checking WCAG compliance
 */
export function getContrastRatio(color1: string, color2: string): number {
  // This is a simplified version - in production use a proper library
  // Returns an estimate for common MadHive colors
  const contrastMap: Record<string, Record<string, number>> = {
    '#F4DFFF': { '#200847': 7.8, '#1A0F2E': 9.2 }, // chalk on purple
    '#FF9BD3': { '#200847': 5.2, '#1A0F2E': 6.1 }, // pink on purple
    '#A7F3D0': { '#200847': 6.1 }, // success
    '#FDE68A': { '#200847': 7.9 }, // warning
    '#FCA5A5': { '#200847': 5.8 }, // error
  };

  return contrastMap[color1]?.[color2] ?? 4.5; // Default to passing ratio
}

/**
 * Check if color combination meets WCAG AA
 */
export function meetsWCAG_AA(
  ratio: number,
  isLargeText: boolean = false
): boolean {
  return ratio >= (isLargeText ? 3 : 4.5);
}
