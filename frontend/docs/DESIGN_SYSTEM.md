# MadHive TV Dashboards - Design System

## Overview

The MadHive TV Dashboards design system is optimized for large-screen displays (TVs, monitors) with high contrast, bold typography, and a purple-pink color scheme inspired by the MadHive brand.

## Color Palette

### Primary Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Purple Deepest** | `#0F0820` | Darkest backgrounds, deepest contrast |
| **Purple Deep** | `#1A0F2E` | Background gradients |
| **Purple Dark** | `#200847` | Primary backgrounds, cards |
| **Purple** | `#291036` | Secondary backgrounds |
| **Purple Medium** | `#3D1F5C` | Borders, hover states |
| **Purple Light** | `#5C3B7A` | Lighter borders, accents |

### Accent Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Pink Bright** | `#FF7AC6` | Hover states, active elements |
| **Pink** | `#FF9BD3` | Primary accent, CTA, highlights |
| **Pink Soft** | `#FDA4D4` | Secondary accents, softer highlights |
| **Pink Pale** | `#FFD4EC` | Subtle backgrounds, very light accents |

### Text Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Chalk** | `#F4DFFF` | Primary text color |
| **Chalk Bright** | `#FFFFFF` | Brightest text, headings |

### Status Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Success** | `#A7F3D0` | Success states, positive trends |
| **Warning** | `#FDE68A` | Warning states, caution indicators |
| **Error** | `#FCA5A5` | Error states, negative trends |
| **Info** | `#93C5FD` | Informational states, neutral indicators |

## Typography

### Font Families

```css
font-display: 'Space Grotesk', sans-serif;  /* Headings, numbers, display text */
font-body: 'DM Sans', sans-serif;            /* Body text, paragraphs */
font-mono: 'IBM Plex Mono', monospace;       /* Code, technical content */
```

### TV-Optimized Font Sizes

Optimized for viewing from 8-15 feet away:

| Name | Size | Usage |
|------|------|-------|
| `tv-xs` | 0.75rem (12px) | Timestamps, footnotes |
| `tv-sm` | 0.875rem (14px) | Small labels, secondary text |
| `tv-base` | 1rem (16px) | Body text, default |
| `tv-lg` | 1.25rem (20px) | Widget titles, section headings |
| `tv-xl` | 1.5rem (24px) | Page titles, large headings |
| `tv-2xl` | 2rem (32px) | Major numbers, unit labels |
| `tv-huge` | 4.5rem (72px) | Big numbers, hero displays |

### Font Weight Scale

- **Normal:** 400 (body text)
- **Medium:** 500 (emphasis)
- **Semibold:** 600 (labels, buttons)
- **Bold:** 700 (headings, important numbers)

## Spacing System

Based on Tailwind's default 4px scale:

```
1 = 0.25rem (4px)
2 = 0.5rem (8px)
3 = 0.75rem (12px)
4 = 1rem (16px)
6 = 1.5rem (24px)
8 = 2rem (32px)
12 = 3rem (48px)
16 = 4rem (64px)
```

### Common Spacing Patterns

- **Card padding:** `p-6` (24px)
- **Section margins:** `mb-4` (16px)
- **Component gaps:** `gap-2` to `gap-4` (8-16px)
- **Page padding:** `px-8 py-16` (32px horizontal, 64px vertical)

## Animations

### Built-in Animations

```css
/* Slow pulse for loading states */
animate-pulse-slow: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;

/* Shimmer effect for skeletons */
animate-shimmer: shimmer 2s linear infinite;

/* Count-up animation for numbers */
animate-count-up: count-up 0.5s ease-out;
```

### Animation Guidelines

- **Duration:** Keep animations under 500ms for UI responsiveness
- **Easing:** Use `ease-out` for entrances, `ease-in` for exits
- **Motion:** Prefer subtle animations; avoid jarring movements on TV displays
- **Loading states:** Use pulse or shimmer animations
- **Data updates:** Use fade or scale transitions

## Component Patterns

### Card Variants

```typescript
variant?: 'default' | 'gradient' | 'glass'
```

- **default:** Solid purple background, standard border
- **gradient:** Gradient from dark to medium purple
- **glass:** Semi-transparent with backdrop blur (glassmorphism)

### Button Variants

```typescript
variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
size?: 'sm' | 'md' | 'lg'
```

- **primary:** Pink background, high contrast
- **secondary:** Purple background with border
- **danger:** Error color background
- **ghost:** Transparent background, subtle hover

### Badge Variants

```typescript
variant?: 'default' | 'success' | 'warning' | 'error'
```

Compact labels with color-coded status indicators.

## Accessibility

### WCAG 2.1 AA Compliance

All color combinations meet WCAG AA contrast requirements:

- **Text on dark purple:** 4.5:1 minimum
- **Large text on dark purple:** 3:1 minimum
- **UI components:** 3:1 minimum

### Accessibility Features

- **Focus indicators:** 2px pink ring with offset
- **ARIA labels:** All interactive elements
- **Screen reader support:** Proper semantic HTML
- **Keyboard navigation:** Full keyboard support
- **Loading states:** `aria-live="polite"`
- **Error states:** `aria-live="assertive"`
- **Status updates:** `role="status"`

## Icons

Using **Lucide React** icon library:

```typescript
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
```

### Icon Guidelines

- **Size:** 16px (sm), 24px (md), 32px (lg)
- **Color:** Match text color or use accent colors
- **Stroke width:** 2px for consistency
- **Accessibility:** Include `aria-hidden="true"` for decorative icons

## Responsive Breakpoints

```css
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Laptops */
xl: 1280px  /* Desktops */
2xl: 1536px /* Large displays */
```

### TV Display Optimization

Primary targets:
- **1080p:** 1920x1080 (Full HD)
- **4K:** 3840x2160 (Ultra HD)

Use relative units (rem, %) and test on large displays.

## Best Practices

### Do's ✓

- Use high contrast colors for readability from distance
- Keep typography scale consistent (use TV-optimized sizes)
- Provide loading states for all async operations
- Add ARIA labels to all interactive elements
- Test on actual TV displays when possible
- Use semantic HTML elements
- Implement keyboard navigation
- Add focus indicators to all focusable elements

### Don'ts ✗

- Don't use font sizes smaller than `tv-xs` (12px)
- Don't use low-contrast color combinations
- Don't animate rapidly (can cause discomfort on large screens)
- Don't rely on hover states alone (may not work on TV interfaces)
- Don't use fine details that won't be visible from distance
- Don't forget loading/error states
- Don't skip ARIA labels

## Component Styling

### Using the Design System

```typescript
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

// Combine Tailwind classes with utility
<Card variant="gradient" className={cn('p-8', isActive && 'border-madhive-pink')}>
  <h2 className="text-tv-xl font-display text-madhive-pink">Title</h2>
  <Badge variant="success">Active</Badge>
</Card>
```

### Custom Variants

Use the `cn()` utility to merge class names safely:

```typescript
import { cn } from '@/lib/utils';

const customClass = cn(
  'base-classes',
  condition && 'conditional-classes',
  className // Allow override
);
```

## File Organization

```
src/
├── components/
│   ├── ui/              # Reusable UI components
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   └── LoadingState.tsx
│   ├── widgets/         # Dashboard widgets
│   └── query-builder/   # Query builder components
├── lib/
│   └── utils.ts         # cn() and utility functions
└── types/
    └── dashboard.ts     # TypeScript types
```

## Version History

- **v1.0.0** (2024-02-27): Initial design system documentation
