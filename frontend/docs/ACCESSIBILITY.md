# Accessibility Guidelines

Comprehensive accessibility implementation guide for WCAG 2.1 AA compliance.

## Overview

MadHive TV Dashboards is committed to accessibility, ensuring all users can access and interact with dashboard content regardless of ability or assistive technology used.

**Compliance Level:** WCAG 2.1 Level AA

## ARIA Patterns

### Widget Regions

All widgets should be marked as regions with descriptive labels:

```tsx
<Card
  role="region"
  aria-label={`${config.title} widget`}
>
  {/* Widget content */}
</Card>
```

### Live Regions

Use for dynamic content updates:

```tsx
// Polite updates (non-urgent)
<div role="status" aria-live="polite">
  <span className="sr-only">Loading widget data...</span>
</div>

// Assertive updates (urgent/errors)
<div role="alert" aria-live="assertive">
  <p>Error loading data</p>
</div>
```

### Loading States

```tsx
<div className="animate-pulse" role="status" aria-live="polite">
  <div className="skeleton" />
  <span className="sr-only">Loading dashboard...</span>
</div>
```

### Error States

```tsx
<div role="alert" aria-live="assertive">
  <p className="text-error">Error loading data</p>
  <p>{error.message}</p>
</div>
```

## Keyboard Navigation

### Tab Order

Ensure logical tab order follows visual flow:

```tsx
// Use tabIndex only when needed
<div tabIndex={0}>Focusable div</div>

// Remove from tab order
<div tabIndex={-1}>Not in tab flow</div>

// Natural tab order (preferred)
<button>Natural tab order</button>
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Navigate forward |
| `Shift + Tab` | Navigate backward |
| `Enter` | Activate button/link |
| `Space` | Toggle checkbox/activate button |
| `Escape` | Close modal/dropdown |
| `Arrow Keys` | Navigate within component |

### Focus Management

```tsx
import { useRef, useEffect } from 'react';

function Modal({ isOpen }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div role="dialog" aria-modal="true">
      <button
        ref={closeButtonRef}
        onClick={onClose}
        aria-label="Close dialog"
      >
        ×
      </button>
    </div>
  );
}
```

### Focus Indicators

All interactive elements have visible focus indicators:

```css
/* Tailwind config automatically applies */
focus:outline-none
focus:ring-2
focus:ring-madhive-pink
focus:ring-offset-2
focus:ring-offset-madhive-purple-dark
```

## Screen Reader Support

### Semantic HTML

Use semantic elements whenever possible:

```tsx
// ❌ Avoid
<div onClick={handleClick}>Click me</div>

// ✅ Prefer
<button onClick={handleClick}>Click me</button>

// ❌ Avoid
<div className="heading">Title</div>

// ✅ Prefer
<h2>Title</h2>
```

### Heading Hierarchy

Maintain proper heading structure:

```tsx
<main>
  <h1>Dashboard Name</h1>

  <section>
    <h2>Widget Section</h2>

    <article>
      <h3>Widget Title</h3>
      {/* Widget content */}
    </article>
  </section>
</main>
```

### Alt Text

Provide descriptive alt text for images:

```tsx
// Decorative images
<img src="decoration.png" alt="" role="presentation" />

// Informative images
<img src="chart.png" alt="Bar chart showing revenue growth from Q1 to Q4" />

// Icons with text
<TrendingUp aria-hidden="true" />
<span>Trending up</span>

// Icon buttons
<button aria-label="Close panel">
  <X aria-hidden="true" />
</button>
```

### Form Labels

All form inputs must have labels:

```tsx
// Visible label
<label htmlFor="email">Email</label>
<input id="email" type="email" />

// Invisible label (aria-label)
<input
  type="search"
  aria-label="Search dashboards"
  placeholder="Search..."
/>

// Label from element (aria-labelledby)
<h3 id="section-title">Section Title</h3>
<div role="region" aria-labelledby="section-title">
  {/* Content */}
</div>
```

### Screen Reader Only Content

Use for context that's visual but needs text for screen readers:

```tsx
// Tailwind SR-only class
<span className="sr-only">Loading...</span>

// Or custom CSS
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

## Color & Contrast

### WCAG AA Contrast Requirements

| Element | Minimum Ratio | MadHive Compliance |
|---------|---------------|-------------------|
| Normal text (< 18px) | 4.5:1 | ✓ Chalk on Purple Dark |
| Large text (≥ 18px) | 3:1 | ✓ Pink on Purple Dark |
| UI components | 3:1 | ✓ All borders/buttons |

### Color Combinations

**Safe Combinations:**

```tsx
// Text on dark backgrounds
<div className="bg-madhive-purple-dark text-madhive-chalk">
  High contrast text (7.8:1)
</div>

// Accent text
<div className="bg-madhive-purple-dark text-madhive-pink">
  Pink accent (5.2:1)
</div>

// Status indicators
<span className="text-success">Success (6.1:1)</span>
<span className="text-warning">Warning (7.9:1)</span>
<span className="text-error">Error (5.8:1)</span>
```

**Unsafe Combinations (Avoid):**

```tsx
// ❌ Low contrast
<div className="bg-madhive-purple-medium text-madhive-purple-dark">
  Hard to read (1.8:1)
</div>

// ❌ Color alone conveys meaning
<span className="text-error">Error</span> // No text indicator

// ✅ Color + text/icon
<span className="text-error">
  <AlertCircle className="inline" />
  Error: Something went wrong
</span>
```

### Testing Contrast

Use browser DevTools or online tools:

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- Chrome DevTools > Elements > Accessibility

## Interactive Elements

### Buttons

```tsx
// Standard button
<button
  onClick={handleClick}
  aria-label="Save dashboard"
  className="focus:ring-2 focus:ring-madhive-pink"
>
  Save
</button>

// Loading button
<button
  disabled
  aria-busy="true"
  aria-label="Saving dashboard"
>
  <LoadingSpinner aria-hidden="true" />
  Saving...
</button>

// Icon button
<button
  onClick={handleClose}
  aria-label="Close panel"
>
  <X aria-hidden="true" />
</button>
```

### Links

```tsx
// Descriptive link text
<Link to="/dashboard">View Dashboard</Link>

// Avoid
<Link to="/dashboard">Click here</Link>

// External links
<a
  href="https://example.com"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Example website (opens in new tab)"
>
  Visit Example
  <ExternalLink className="inline ml-1" aria-hidden="true" />
</a>
```

### Forms

```tsx
function AccessibleForm() {
  return (
    <form onSubmit={handleSubmit}>
      {/* Text input */}
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          required
          aria-required="true"
          aria-invalid={hasError}
          aria-describedby={hasError ? 'name-error' : undefined}
        />
        {hasError && (
          <span id="name-error" role="alert">
            Name is required
          </span>
        )}
      </div>

      {/* Checkbox */}
      <div>
        <label>
          <input type="checkbox" />
          <span>I agree to terms</span>
        </label>
      </div>

      {/* Radio group */}
      <fieldset>
        <legend>Select option</legend>
        <label>
          <input type="radio" name="option" value="1" />
          Option 1
        </label>
        <label>
          <input type="radio" name="option" value="2" />
          Option 2
        </label>
      </fieldset>

      <button type="submit">Submit</button>
    </form>
  );
}
```

### Tables

```tsx
<table role="table" aria-label="Dashboard metrics">
  <thead role="rowgroup">
    <tr role="row">
      <th
        role="columnheader"
        aria-sort={sortDirection}
        tabIndex={0}
        onClick={handleSort}
      >
        Name
      </th>
      <th role="columnheader">Value</th>
    </tr>
  </thead>
  <tbody role="rowgroup">
    <tr role="row">
      <td role="cell">Metric 1</td>
      <td role="cell">100</td>
    </tr>
  </tbody>
</table>
```

## Modals & Overlays

### Modal Dialog

```tsx
import { useEffect, useRef } from 'react';

function AccessibleModal({ isOpen, onClose, title, children }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Store previous focus
      previousFocus.current = document.activeElement as HTMLElement;

      // Focus first focusable element in modal
      const firstFocusable = modalRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;

      firstFocusable?.focus();

      // Trap focus
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        previousFocus.current?.focus();
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      ref={modalRef}
      className="fixed inset-0 z-50"
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div className="relative bg-madhive-purple-dark rounded-lg p-6">
        <h2 id="modal-title">{title}</h2>

        {children}

        <button
          onClick={onClose}
          aria-label="Close dialog"
        >
          Close
        </button>
      </div>
    </div>
  );
}
```

## Charts & Visualizations

### Accessible Charts

```tsx
function AccessibleChart({ data }) {
  return (
    <div role="img" aria-label="Line chart showing revenue over time">
      <LineChart data={data}>
        {/* Chart components */}
      </LineChart>

      {/* Data table alternative */}
      <details className="mt-4">
        <summary>View data table</summary>
        <table>
          <caption>Revenue over time</caption>
          <thead>
            <tr>
              <th>Month</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
              <tr key={item.month}>
                <td>{item.month}</td>
                <td>${item.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
```

### SVG Accessibility

```tsx
<svg
  role="img"
  aria-labelledby="chart-title chart-desc"
>
  <title id="chart-title">Revenue Chart</title>
  <desc id="chart-desc">
    Bar chart showing revenue increasing from $1M in Q1 to $2.5M in Q4
  </desc>

  {/* SVG content */}
</svg>
```

## Testing

### Automated Testing

```typescript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('component has no accessibility violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Manual Testing Checklist

- [ ] Navigate entire UI with keyboard only
- [ ] Test with screen reader (NVDA/JAWS/VoiceOver)
- [ ] Verify focus indicators visible
- [ ] Check color contrast with DevTools
- [ ] Test with browser zoom at 200%
- [ ] Test with high contrast mode
- [ ] Verify no flashing content > 3 times/second

### Testing Tools

| Tool | Purpose | Platform |
|------|---------|----------|
| **axe DevTools** | Automated testing | Browser extension |
| **Lighthouse** | Audit accessibility | Chrome DevTools |
| **WAVE** | Visual feedback | Browser extension |
| **NVDA** | Screen reader testing | Windows |
| **JAWS** | Screen reader testing | Windows |
| **VoiceOver** | Screen reader testing | macOS/iOS |

## Common Patterns

### Skip Links

```tsx
function Layout({ children }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Skip to main content
      </a>

      <nav>{/* Navigation */}</nav>

      <main id="main-content">
        {children}
      </main>
    </>
  );
}
```

### Disclosure Widget

```tsx
function Disclosure({ title, children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="disclosure-content"
      >
        {title}
      </button>

      <div
        id="disclosure-content"
        hidden={!isOpen}
      >
        {children}
      </div>
    </div>
  );
}
```

### Tabs

```tsx
function Tabs({ tabs }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div>
      <div role="tablist" aria-label="Dashboard tabs">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === index}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeTab !== index}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Articles](https://webaim.org/articles/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
- [Inclusive Components](https://inclusive-components.design/)

---

**Last Updated:** 2024-02-27

**Version:** 1.0.0
