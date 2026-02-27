# Component Usage Guide

Comprehensive guide to all UI components and widgets in the MadHive TV Dashboards system.

## Table of Contents

- [UI Components](#ui-components)
  - [Button](#button)
  - [Card](#card)
  - [Badge](#badge)
  - [LoadingState](#loadingstate)
  - [ErrorBoundary](#errorboundary)
- [Widget Components](#widget-components)
  - [BigNumberWidget](#bignumberwidget)
  - [StatCardWidget](#statcardwidget)
  - [GaugeWidget](#gaugewidget)
  - [BarChartWidget](#barchartwidget)
  - [LineChartWidget](#linechartwidget)
  - [TableWidget](#tablewidget)
  - [SparklineWidget](#sparklinewidget)
  - [MultiMetricCardWidget](#multimetriccardwidget)
  - [StackedBarChartWidget](#stackedbarchartwidget)
  - [ListWidget](#listwidget)
  - [HeatmapWidget](#heatmapwidget)
  - [MapWidget](#mapwidget)
  - [SankeyWidget](#sankeywidget)
  - [TreemapWidget](#treemapwidget)

---

## UI Components

### Button

Accessible button component with multiple variants and sizes.

**Props:**

```typescript
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}
```

**Usage:**

```tsx
import { Button } from '@/components/ui/Button';

// Primary button
<Button onClick={handleClick}>Click Me</Button>

// Loading state
<Button isLoading>Saving...</Button>

// Danger variant
<Button variant="danger" size="lg">Delete</Button>

// Disabled state
<Button disabled>Disabled</Button>
```

**Variants:**
- `primary`: Pink background, high contrast (default)
- `secondary`: Purple background with border
- `danger`: Red background for destructive actions
- `ghost`: Transparent background

**Accessibility:**
- Includes focus ring indicators
- Loading state shows spinner with `aria-busy`
- Disabled state properly communicated to screen readers

**Do's:**
✓ Use `primary` for main actions
✓ Use `danger` for destructive actions
✓ Show loading state during async operations
✓ Add descriptive `aria-label` when button text isn't clear

**Don'ts:**
✗ Don't use multiple primary buttons in the same context
✗ Don't omit text for icon-only buttons (add `aria-label`)
✗ Don't use danger variant for non-destructive actions

---

### Card

Container component with multiple visual variants.

**Props:**

```typescript
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'gradient' | 'glass';
}
```

**Usage:**

```tsx
import { Card } from '@/components/ui/Card';

// Default card
<Card>
  <h2>Title</h2>
  <p>Content</p>
</Card>

// Gradient variant
<Card variant="gradient" className="p-8">
  Enhanced visual appeal
</Card>

// Glass morphism
<Card variant="glass">
  Semi-transparent overlay
</Card>
```

**Variants:**
- `default`: Solid purple background, standard border
- `gradient`: Purple gradient for visual depth
- `glass`: Semi-transparent with backdrop blur

**Accessibility:**
- Semantic `<div>` element
- Can accept `role` prop for specific use cases
- Supports all standard HTML attributes

**Do's:**
✓ Use for grouping related content
✓ Use gradient variant for emphasis
✓ Use glass variant for overlays
✓ Maintain consistent padding

**Don'ts:**
✗ Don't nest cards too deeply
✗ Don't use without padding
✗ Don't use glass variant on glass variant

---

### Badge

Compact label component for status indicators.

**Props:**

```typescript
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error';
}
```

**Usage:**

```tsx
import { Badge } from '@/components/ui/Badge';

<Badge>Default</Badge>
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Failed</Badge>
```

**Variants:**
- `default`: Purple background
- `success`: Green background
- `warning`: Yellow background
- `error`: Red background

**Accessibility:**
- Uses semantic `<span>` element
- Color is not the only indicator (text included)

**Do's:**
✓ Use for status indicators
✓ Keep text short (1-2 words)
✓ Use appropriate variant for status

**Don'ts:**
✗ Don't use for long text
✗ Don't rely solely on color
✗ Don't use as buttons (not interactive)

---

### LoadingState

Standardized loading state components.

**Components:**

```typescript
// Loading skeleton
function LoadingState({ message?: string }): JSX.Element

// Error display
function ErrorState({ message?: string, error?: Error | unknown }): JSX.Element

// Empty state
function EmptyState({ message?: string }): JSX.Element
```

**Usage:**

```tsx
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/LoadingState';

// Loading
<LoadingState message="Loading dashboard..." />

// Error
<ErrorState error={error} message="Failed to load data" />

// Empty
<EmptyState message="No results found" />
```

**Accessibility:**
- `LoadingState`: Uses `role="status"` and `aria-live="polite"`
- `ErrorState`: Uses `role="alert"` and `aria-live="assertive"`
- `EmptyState`: Uses `role="status"`
- Screen reader announcements for all states

**Do's:**
✓ Use during async operations
✓ Provide descriptive messages
✓ Use ErrorState for all error conditions

**Don'ts:**
✗ Don't show loading state indefinitely
✗ Don't omit error messages
✗ Don't use for very quick operations (<100ms)

---

### ErrorBoundary

React error boundary for graceful error handling.

**Props:**

```typescript
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}
```

**Usage:**

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Wrap components that might error
<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>

// Custom fallback
<ErrorBoundary fallback={<CustomErrorUI />}>
  <MyComponent />
</ErrorBoundary>
```

**Features:**
- Catches JavaScript errors in child component tree
- Logs error information to console
- Displays user-friendly error message
- Provides reload button
- Prevents entire app crash

**Accessibility:**
- Error UI uses `role="alert"` and `aria-live="assertive"`
- Reload button is keyboard accessible
- Clear error messaging

**Do's:**
✓ Wrap route components
✓ Wrap third-party components
✓ Use at logical boundaries
✓ Provide custom fallback for critical sections

**Don'ts:**
✗ Don't wrap entire app (too broad)
✗ Don't use for expected errors (use try/catch)
✗ Don't catch errors in event handlers (use try/catch)
✗ Don't skip logging

---

## Widget Components

All widgets follow a consistent pattern:

```typescript
interface WidgetProps {
  config: WidgetConfig;
}

interface WidgetConfig {
  id: string;
  type: string;
  title?: string;
  config?: Record<string, any>;
}
```

All widgets include:
- Loading states with skeletons
- Error states with messages
- Empty states for no data
- Accessibility attributes
- Timestamps (when available)

### BigNumberWidget

Display large numbers with optional trend indicators and sparklines.

**Data Format:**

```typescript
interface BigNumberData {
  value: number | string;
  unit?: string;
  trend?: { value: number; direction: 'up' | 'down' };
  sparkline?: number[];
  timestamp: string;
}
```

**Example:**

```tsx
<BigNumberWidget config={{
  id: 'unique-id',
  type: 'big-number',
  title: 'Total Revenue',
  config: { decimals: 2 }
}} />
```

**Features:**
- Animated counter effect
- Trend indicators with icons
- Optional sparkline chart
- Unit labels
- Responsive scaling

**Accessibility:**
- Widget labeled with `role="region"`
- Value announced with `aria-label`
- Live updates with `aria-live="polite"`

---

### StatCardWidget

Compact card showing a statistic with optional comparison.

**Data Format:**

```typescript
interface StatCardData {
  value: number | string;
  label: string;
  change?: number;
  changeType?: 'increase' | 'decrease';
  icon?: string;
  timestamp: string;
}
```

**Features:**
- Compact design
- Change percentage
- Icon support
- Color-coded trends

---

### GaugeWidget

Circular gauge for percentage-based metrics.

**Data Format:**

```typescript
interface GaugeData {
  value: number; // 0-100
  label?: string;
  min?: number;
  max?: number;
  thresholds?: { value: number; color: string; }[];
  timestamp: string;
}
```

**Features:**
- Circular progress indicator
- Customizable thresholds
- Color zones
- Center value display

---

### TableWidget

Sortable data table with pagination.

**Data Format:**

```typescript
interface TableData {
  columns: { key: string; label: string; sortable?: boolean; }[];
  rows: Record<string, any>[];
  timestamp: string;
}
```

**Features:**
- Sortable columns
- Pagination
- Row highlighting
- Responsive design

**Accessibility:**
- Proper table semantics
- Column headers with `role="columnheader"`
- Sort state announced with `aria-sort`

---

### LineChartWidget

Time-series line chart using Recharts.

**Data Format:**

```typescript
interface LineChartData {
  data: { x: string | number; [key: string]: any }[];
  lines: { key: string; color: string; label: string; }[];
  xAxisKey: string;
  timestamp: string;
}
```

**Features:**
- Multiple lines
- Interactive tooltips
- Responsive sizing
- Smooth animations

---

### BarChartWidget

Vertical bar chart for categorical data.

**Data Format:**

```typescript
interface BarChartData {
  data: { name: string; value: number; }[];
  timestamp: string;
}
```

**Features:**
- Vertical bars
- Tooltips
- Responsive
- Color gradients

---

### MapWidget (Lazy Loaded)

Interactive map with markers using Leaflet.

**Data Format:**

```typescript
interface MapData {
  center?: [number, number];
  zoom?: number;
  markers?: {
    position: [number, number];
    label: string;
    color?: string;
  }[];
  timestamp: string;
}
```

**Features:**
- Interactive pan/zoom
- Custom markers
- Popups
- OpenStreetMap tiles

**Note:** Lazy loaded for performance.

---

### SankeyWidget (Lazy Loaded)

Flow diagram using D3-Sankey.

**Data Format:**

```typescript
interface SankeyData {
  nodes: { id: string; label: string; }[];
  links: { source: string; target: string; value: number; }[];
  timestamp: string;
}
```

**Features:**
- Flow visualization
- Hover interactions
- Node/link highlighting
- SVG rendering

**Note:** Lazy loaded for performance.

---

### TreemapWidget (Lazy Loaded)

Hierarchical treemap using D3.

**Data Format:**

```typescript
interface TreemapData {
  name: string;
  children: TreemapNode[];
  timestamp: string;
}

interface TreemapNode {
  name: string;
  value?: number;
  children?: TreemapNode[];
}
```

**Features:**
- Hierarchical visualization
- Nested rectangles
- Value-based sizing
- Color gradients

**Note:** Lazy loaded for performance.

---

## General Widget Guidelines

### Do's ✓

- Always provide a title for context
- Handle loading states gracefully
- Show meaningful error messages
- Include timestamps when available
- Use appropriate widget type for data
- Test with real data
- Consider TV viewing distance

### Don'ts ✗

- Don't show raw errors to users
- Don't omit loading states
- Don't use tiny fonts
- Don't overload single widget with too much data
- Don't forget mobile responsiveness
- Don't skip accessibility attributes

## Query Builder Components

See Query Builder documentation for specialized components:
- `TableSelector`: Choose BigQuery tables
- `ColumnPicker`: Select and configure columns
- `FilterBuilder`: Build WHERE clauses
- `JoinConfig`: Configure table joins
- `SQLPreview`: Preview generated SQL

---

## Testing Components

### Unit Testing Example

```typescript
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

test('button renders with text', () => {
  render(<Button>Click Me</Button>);
  expect(screen.getByText('Click Me')).toBeInTheDocument();
});

test('button shows loading state', () => {
  render(<Button isLoading>Save</Button>);
  expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
});
```

### Accessibility Testing

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('component has no accessibility violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## Version History

- **v1.0.0** (2024-02-27): Initial component guide
