# TV Dashboards Frontend (React)

Modern React + TypeScript frontend for MadHive TV Dashboards.

## Tech Stack

- **React 18** - UI framework
- **TypeScript 5** - Type safety
- **Vite 5** - Build tool and dev server
- **Tailwind CSS 3** - Styling with MadHive theme
- **TanStack Query v5** - Data fetching and caching
- **Recharts 2** - Chart visualizations
- **React Router 6** - Routing
- **Bun** - Package manager and runtime

## Getting Started

### Install Dependencies

```bash
cd frontend
bun install
```

### Development

Start the dev server:

```bash
bun run dev
```

The app will be available at `http://localhost:5173`

API calls are proxied to `http://localhost:3000/api`

### Build

Build for production:

```bash
bun run build
```

Output will be in `frontend/dist/`

### Type Checking

Run TypeScript type checking:

```bash
bun run typecheck
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/           # Base UI components (Card, Button, etc.)
│   │   └── widgets/      # Dashboard widgets (BigNumber, Chart, etc.)
│   ├── hooks/            # React hooks (useApi, useWidgetData, etc.)
│   ├── lib/              # Utilities (api client, formatters, etc.)
│   ├── types/            # TypeScript type definitions
│   ├── App.tsx           # Main app component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── index.html            # HTML template
├── vite.config.ts        # Vite configuration
├── tailwind.config.ts    # Tailwind configuration
└── tsconfig.json         # TypeScript configuration
```

## Components

### Widgets

#### BigNumberWidget

Displays a large number with optional features:

- **Animated counter** - Smooth count-up animation on value changes
- **K/M/B formatting** - Automatic number abbreviation
- **Trend indicator** - Up/down arrows with percentage
- **Sparkline** - Mini line chart using Recharts
- **Units** - Optional unit suffix (%, ms, etc.)

**Example Usage:**

```typescript
import { BigNumberWidget } from '@/components/widgets';

<BigNumberWidget
  config={{
    id: 'widget-1',
    type: 'big-number',
    title: 'Total Revenue',
    position: { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
    config: { decimals: 2 }
  }}
/>
```

**Data Contract:**

```typescript
interface BigNumberData {
  value: number | string;
  unit?: string;
  trend?: { value: number; direction: 'up' | 'down' };
  sparkline?: number[];
  timestamp: string;
}
```

### UI Components

- **Card** - Container with variants: default, gradient, glass
- More components coming in Slice 1

## MadHive Theme

The Tailwind config includes the complete MadHive design system:

### Colors

- **Purple gradients** - `madhive-purple-deepest` through `madhive-purple-medium`
- **Pink accents** - `madhive-pink-bright`, `madhive-pink`, `madhive-pink-soft`, `madhive-pink-pale`
- **Neutral** - `madhive-chalk`, `madhive-chalk-bright`
- **Status** - `success`, `warning`, `error`, `info`

### Typography

- **Display font** - Space Grotesk (headings, numbers)
- **Body font** - DM Sans (text)
- **Mono font** - IBM Plex Mono (code)

### TV-Optimized Font Sizes

- `text-tv-xs` - 0.75rem
- `text-tv-sm` - 0.875rem
- `text-tv-base` - 1rem
- `text-tv-lg` - 1.25rem
- `text-tv-xl` - 1.5rem
- `text-tv-2xl` - 2rem
- `text-tv-huge` - 4.5rem (90px)

### Animations

- `animate-pulse-slow` - Slow pulse for loading states
- `animate-shimmer` - Shimmer effect for skeletons
- `animate-count-up` - Count-up animation for numbers

## Development Status

### Completed

✅ **Slice 1: Foundation**
- Vite + React + TypeScript setup
- Tailwind CSS with MadHive theme
- UI components (Card, Button, Badge, LoadingState)
- Utils library (formatNumber, formatPercentage, cn)
- API client with TypeScript types
- Error boundary for graceful error handling

✅ **Slice 2: All 14 Widgets**
- BigNumberWidget, StatCardWidget, GaugeWidget
- BarChartWidget, LineChartWidget, StackedBarChartWidget
- TableWidget, ListWidget, SparklineWidget
- MultiMetricCardWidget, HeatmapWidget
- MapWidget (lazy loaded), SankeyWidget (lazy loaded), TreemapWidget (lazy loaded)

✅ **Slice 3: WYSIWYG Editor**
- Complete vanilla JS implementation in `/public/visual-editor.js`

✅ **Slice 4: Visual Query Builder**
- Table selector, column picker, filter builder
- JOIN configuration, SQL preview
- Query execution and results display

✅ **Slice 5: Polish, Accessibility, Performance**
- WCAG 2.1 AA accessibility compliance
- ARIA labels and keyboard navigation
- Lazy loading for heavy components
- Performance monitoring utilities
- Comprehensive documentation

## API Integration

All widgets use the `useWidgetData` hook to fetch data from `/api/widgets/:id/data`

```typescript
const { data, isLoading, error } = useWidgetData(widgetId);
```

Data is automatically refetched every 30 seconds (configurable).

## Documentation

Comprehensive documentation available in `/docs/`:

- **[DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md)** - Complete design system guide
- **[COMPONENT_GUIDE.md](./docs/COMPONENT_GUIDE.md)** - Component usage and examples
- **[ACCESSIBILITY.md](./docs/ACCESSIBILITY.md)** - Accessibility guidelines (WCAG 2.1 AA)
- **[PERFORMANCE.md](./docs/PERFORMANCE.md)** - Performance optimization guide
- **[PRODUCTION_CHECKLIST.md](./docs/PRODUCTION_CHECKLIST.md)** - Production deployment checklist

## Accessibility

✅ WCAG 2.1 Level AA compliant:
- Full keyboard navigation
- Screen reader support (ARIA labels, live regions)
- High contrast colors (4.5:1+ ratio)
- Focus indicators on all interactive elements
- Loading and error announcements

Test with:
- axe DevTools browser extension
- Lighthouse accessibility audit
- NVDA/JAWS screen readers

## Performance

Optimizations:
- Code splitting and lazy loading
- React.memo for expensive components
- Bundle size < 500KB gzipped
- Virtual scrolling for large lists
- Web Vitals monitoring

Check performance:
```bash
bun run build
ls -lh dist/assets/*.js
lighthouse http://localhost:5173 --view
```

## Contributing

This is part of the MadHive TV Dashboards project. See the main README for contribution guidelines.

---

**Version:** 1.0.0 (Production Ready)

**Last Updated:** 2024-02-27
