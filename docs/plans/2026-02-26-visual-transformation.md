# TV Dashboard Visual Transformation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform TV dashboard with enhanced visualizations for all 8 existing widgets + add 6 new widget types using MadHive dark aesthetic

**Architecture:** Progressive enhancement approach - enhance existing Chart.js widgets first (Wave 1), then add 6 new widget types with Chart.js (4 widgets) and D3.js (2 widgets) (Wave 2). All changes backward compatible.

**Tech Stack:** React 19, TypeScript, Chart.js 4.5.1, D3.js v7, Tailwind CSS, Bun

---

## Phase 1: Foundation (Tasks 1-5)

### Task 1: Expand Design Tokens in global.css

**Files:**
- Modify: `src/styles/global.css:8-19`

**Step 1: Add extended MadHive color palette**

Add after line 19 in `global.css`:

```css
:root {
  --madhive-purple-dark: #200847;
  --madhive-purple: #291036;
  --madhive-pink: #FF9BD3;
  --madhive-pink-soft: #FDA4D4;
  --madhive-chalk: #F4DFFF;
  --madhive-cream: #F3F2EB;
  --madhive-bg: #0F0820;
  --madhive-card: #1A0F2E;
  --madhive-border: #3D1F5C;

  /* Extended palette */
  --madhive-purple-deepest: #0F0820;
  --madhive-purple-deep: #1A0F2E;
  --madhive-purple-medium: #3D1F5C;
  --madhive-pink-bright: #FF7AC6;
  --madhive-pink-pale: #FFD4EC;
  --madhive-chalk-bright: #FFFFFF;

  /* Gradients */
  --gradient-primary: linear-gradient(135deg, #FF9BD3 0%, #FDA4D4 100%);
  --gradient-accent: linear-gradient(135deg, #291036 0%, #3D1F5C 100%);
  --gradient-glow: radial-gradient(circle, rgba(255,155,211,0.2) 0%, transparent 70%);

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(32, 8, 71, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(32, 8, 71, 0.4);
  --shadow-lg: 0 10px 15px -3px rgba(32, 8, 71, 0.5);
  --shadow-glow: 0 0 20px rgba(255, 155, 211, 0.3);
}
```

**Step 2: Verify CSS loads**

Run: `bun run dev` and check browser console for CSS errors
Expected: No CSS parsing errors

**Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "feat: expand MadHive design tokens with gradients and shadows"
```

---

### Task 2: Install D3.js Dependencies

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`

**Step 1: Install D3 packages**

Run:
```bash
cd /home/tech/dev-dashboards/frontend
bun add d3-sankey d3-hierarchy d3-scale d3-shape d3-selection
```

Expected: Packages added to package.json dependencies

**Step 2: Verify installation**

Run: `bun install`
Expected: All dependencies resolved

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "feat: add D3.js dependencies for Sankey and Treemap widgets"
```

---

### Task 3: Create Number Formatting Utility

**Files:**
- Create: `src/lib/formatUtils.ts`
- Create: `src/lib/formatUtils.test.ts`

**Step 1: Write failing tests**

Create `src/lib/formatUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatNumber, formatCurrency, formatPercentage } from './formatUtils';

describe('formatNumber', () => {
  it('formats numbers with K suffix', () => {
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(25000)).toBe('25K');
  });

  it('formats numbers with M suffix', () => {
    expect(formatNumber(1500000)).toBe('1.5M');
    expect(formatNumber(25000000)).toBe('25M');
  });

  it('formats numbers with B suffix', () => {
    expect(formatNumber(1500000000)).toBe('1.5B');
  });

  it('formats small numbers without suffix', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(42)).toBe('42');
  });

  it('formats with custom decimals', () => {
    expect(formatNumber(1234, 2)).toBe('1.23K');
  });
});

describe('formatCurrency', () => {
  it('formats currency with dollar sign', () => {
    expect(formatCurrency(1234.56)).toBe('$1.23K');
    expect(formatCurrency(42)).toBe('$42');
  });

  it('supports custom currency symbol', () => {
    expect(formatCurrency(1234, '€')).toBe('€1.23K');
  });
});

describe('formatPercentage', () => {
  it('formats percentage with % sign', () => {
    expect(formatPercentage(0.1234)).toBe('12.3%');
    expect(formatPercentage(1.5)).toBe('150%');
  });

  it('formats with custom decimals', () => {
    expect(formatPercentage(0.1234, 1)).toBe('12.3%');
    expect(formatPercentage(0.1234, 2)).toBe('12.34%');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/lib/formatUtils.test.ts`
Expected: FAIL - "Cannot find module './formatUtils'"

**Step 3: Implement utility functions**

Create `src/lib/formatUtils.ts`:

```typescript
/**
 * Format large numbers with K/M/B suffixes
 */
export function formatNumber(value: number, decimals: number = 1): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1e9) {
    return `${sign}${(abs / 1e9).toFixed(decimals)}B`;
  }
  if (abs >= 1e6) {
    return `${sign}${(abs / 1e6).toFixed(decimals)}M`;
  }
  if (abs >= 1e3) {
    return `${sign}${(abs / 1e3).toFixed(decimals)}K`;
  }
  return `${sign}${abs.toFixed(0)}`;
}

/**
 * Format currency with symbol and K/M/B suffixes
 */
export function formatCurrency(value: number, symbol: string = '$', decimals: number = 2): string {
  const formatted = formatNumber(value, decimals);
  return `${symbol}${formatted}`;
}

/**
 * Format percentage (0.1234 -> 12.34%)
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format number with commas (1234567 -> 1,234,567)
 */
export function formatWithCommas(value: number): string {
  return value.toLocaleString('en-US');
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/lib/formatUtils.test.ts`
Expected: PASS - All tests passing

**Step 5: Commit**

```bash
git add src/lib/formatUtils.ts src/lib/formatUtils.test.ts
git commit -m "feat: add number formatting utilities (K/M/B suffixes)"
```

---

### Task 4: Create Color Scale Utility

**Files:**
- Create: `src/lib/colorUtils.ts`
- Create: `src/lib/colorUtils.test.ts`

**Step 1: Write failing tests**

Create `src/lib/colorUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getColorScale, getMadHiveChartColors, hexToRgba } from './colorUtils';

describe('getColorScale', () => {
  it('returns purple for low values', () => {
    const color = getColorScale(10, 0, 100);
    expect(color).toBe('#3D1F5C'); // madhive-purple-medium
  });

  it('returns pink for high values', () => {
    const color = getColorScale(90, 0, 100);
    expect(color).toBe('#FF9BD3'); // madhive-pink
  });

  it('interpolates for mid values', () => {
    const color = getColorScale(50, 0, 100);
    expect(color).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe('getMadHiveChartColors', () => {
  it('returns array of MadHive colors', () => {
    const colors = getMadHiveChartColors();
    expect(colors).toHaveLength(6);
    expect(colors[0]).toBe('rgb(255, 155, 211)'); // hot pink
  });

  it('returns specific count of colors', () => {
    const colors = getMadHiveChartColors(3);
    expect(colors).toHaveLength(3);
  });
});

describe('hexToRgba', () => {
  it('converts hex to rgba', () => {
    expect(hexToRgba('#FF9BD3', 0.5)).toBe('rgba(255, 155, 211, 0.5)');
  });

  it('handles 3-char hex', () => {
    expect(hexToRgba('#F00', 1)).toBe('rgba(255, 0, 0, 1)');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/lib/colorUtils.test.ts`
Expected: FAIL - "Cannot find module './colorUtils'"

**Step 3: Implement color utilities**

Create `src/lib/colorUtils.ts`:

```typescript
/**
 * MadHive color constants
 */
export const MADHIVE_COLORS = {
  purpleDark: '#200847',
  purple: '#291036',
  purpleMedium: '#3D1F5C',
  pink: '#FF9BD3',
  pinkSoft: '#FDA4D4',
  pinkBright: '#FF7AC6',
  chalk: '#F4DFFF',
} as const;

/**
 * Get color from gradient scale based on value position
 */
export function getColorScale(value: number, min: number, max: number): string {
  const normalized = (value - min) / (max - min);

  if (normalized <= 0.33) return MADHIVE_COLORS.purpleMedium;
  if (normalized <= 0.66) return MADHIVE_COLORS.pinkSoft;
  return MADHIVE_COLORS.pink;
}

/**
 * Get MadHive chart color palette (for Chart.js datasets)
 */
export function getMadHiveChartColors(count?: number): string[] {
  const colors = [
    'rgb(255, 155, 211)', // hot pink
    'rgb(253, 164, 212)', // soft pink
    'rgb(244, 223, 255)', // chalk
    'rgb(200, 100, 255)', // purple accent
    'rgb(255, 120, 200)', // pink variant
    'rgb(220, 140, 255)', // light purple
  ];

  return count ? colors.slice(0, count) : colors;
}

/**
 * Convert hex color to rgba with alpha
 */
export function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  hex = hex.replace('#', '');

  // Handle 3-char hex
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Create gradient background CSS string
 */
export function createGradient(color1: string, color2: string, angle: number = 135): string {
  return `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`;
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/lib/colorUtils.test.ts`
Expected: PASS - All tests passing

**Step 5: Commit**

```bash
git add src/lib/colorUtils.ts src/lib/colorUtils.test.ts
git commit -m "feat: add color scale and gradient utilities"
```

---

### Task 5: Create Animation Utility

**Files:**
- Create: `src/lib/animationUtils.ts`

**Step 1: Create animation helper (no test needed - visual utility)**

Create `src/lib/animationUtils.ts`:

```typescript
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
```

**Step 2: Verify file is valid TypeScript**

Run: `bun run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/lib/animationUtils.ts
git commit -m "feat: add animation utilities for count-up effects"
```

---

## Phase 2: Wave 1 - Enhance Existing Widgets (Tasks 6-21)

### Task 6: Enhance BigNumberWidget - Add Trend Support

**Files:**
- Modify: `src/components/widgets/BigNumberWidget.tsx`

**Step 1: Update BigNumberWidget data interface**

Add to `BigNumberWidget.tsx` after line 5:

```typescript
interface BigNumberData {
  value: number | string;
  unit?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  timestamp: string;
}
```

**Step 2: Add trend indicator rendering**

Replace the return statement (around line 60) with:

```typescript
return (
  <div
    data-widget-id={widget.id}
    style={{
      gridColumn: `span ${widget.position.colSpan}`,
      gridRow: `span ${widget.position.rowSpan}`,
    }}
    className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col hover:border-slate-600 transition-colors"
  >
    <h3 className="text-sm font-medium text-slate-400 mb-3">{widget.title}</h3>

    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="flex items-baseline gap-2">
        <span className="text-5xl font-bold text-white tabular-nums">
          {typeof data.value === 'string' ? data.value : Math.round(data.value)}
        </span>
        {data.unit && (
          <span className="text-2xl text-slate-400">{data.unit}</span>
        )}
      </div>

      {data.trend && (
        <div className={`flex items-center gap-1 mt-2 text-lg ${
          data.trend.direction === 'up' ? 'text-emerald-400' : 'text-red-400'
        }`}>
          <span className="text-2xl">
            {data.trend.direction === 'up' ? '↑' : '↓'}
          </span>
          <span className="font-semibold">
            {Math.abs(data.trend.value)}%
          </span>
        </div>
      )}
    </div>
  </div>
);
```

**Step 3: Test visually**

Run: `bun run dev`
Open: http://localhost:4321
Navigate to dashboard with big-number widget
Expected: Widget displays with trend indicator if data includes trend

**Step 4: Commit**

```bash
git add src/components/widgets/BigNumberWidget.tsx
git commit -m "feat(BigNumber): add trend indicator with up/down arrows"
```

---

### Task 7: Enhance BigNumberWidget - Add Gradient Background

**Files:**
- Modify: `src/components/widgets/BigNumberWidget.tsx`

**Step 1: Add gradient background option**

Update the widget container className (around line 66):

```typescript
className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col hover:border-slate-600 transition-colors relative overflow-hidden"
style={{
  gridColumn: `span ${widget.position.colSpan}`,
  gridRow: `span ${widget.position.rowSpan}`,
  background: widget.gradient
    ? 'linear-gradient(135deg, rgba(255, 155, 211, 0.1) 0%, rgba(253, 164, 212, 0.05) 100%), var(--madhive-card)'
    : undefined,
}}
```

**Step 2: Add subtle glow effect**

Add before the closing div tag:

```typescript
{widget.gradient && (
  <div
    className="absolute inset-0 opacity-30 pointer-events-none"
    style={{ background: 'var(--gradient-glow)' }}
  />
)}
```

**Step 3: Test visually**

Run: `bun run dev`
Expected: Gradient background shows if widget config has `gradient: true`

**Step 4: Commit**

```bash
git add src/components/widgets/BigNumberWidget.tsx
git commit -m "feat(BigNumber): add gradient background option"
```

---

### Task 8: Enhance StatCardWidget - Add Icons and Badges

**Files:**
- Modify: `src/components/widgets/StatCardWidget.tsx`

**Step 1: Update StatCardWidget data interface**

Update interface (around line 5):

```typescript
interface StatCardData {
  value: number | string;
  label: string;
  icon?: string;
  comparison?: {
    value: number;
    label: string;
  };
  badge?: {
    text: string;
    variant: 'success' | 'warning' | 'error' | 'info';
  };
  timestamp: string;
}
```

**Step 2: Add icon and badge rendering**

Replace return statement with:

```typescript
const badgeColors = {
  success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

return (
  <div
    data-widget-id={widget.id}
    style={{
      gridColumn: `span ${widget.position.colSpan}`,
      gridRow: `span ${widget.position.rowSpan}`,
    }}
    className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col hover:border-slate-600 transition-colors hover:shadow-lg hover:shadow-pink-500/10"
  >
    <div className="flex items-start justify-between mb-3">
      <h3 className="text-sm font-medium text-slate-400">{widget.title}</h3>
      {data.badge && (
        <span className={`px-2 py-0.5 text-xs rounded-full border ${badgeColors[data.badge.variant]}`}>
          {data.badge.text}
        </span>
      )}
    </div>

    <div className="flex-1 flex items-center gap-4">
      {data.icon && (
        <div className="text-4xl">{data.icon}</div>
      )}

      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-white tabular-nums">
            {data.value}
          </span>
          {data.label && (
            <span className="text-sm text-slate-400">{data.label}</span>
          )}
        </div>

        {data.comparison && (
          <div className="text-sm text-slate-500 mt-1">
            {data.comparison.label}:
            <span className={data.comparison.value >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {' '}{data.comparison.value >= 0 ? '+' : ''}{data.comparison.value}%
            </span>
          </div>
        )}
      </div>
    </div>
  </div>
);
```

**Step 3: Test visually**

Run: `bun run dev`
Expected: StatCard shows icons and badges when data includes them

**Step 4: Commit**

```bash
git add src/components/widgets/StatCardWidget.tsx
git commit -m "feat(StatCard): add icon and badge support with comparison values"
```

---

### Task 9: Enhance GaugeWidget - Add Animated Arc Fill

**Files:**
- Modify: `src/components/widgets/GaugeWidget.tsx:100-146`

**Step 1: Add animation state**

Add after line 24 in GaugeWidget.tsx:

```typescript
const [animatedOffset, setAnimatedOffset] = useState(circumference);
```

**Step 2: Add useEffect for animation**

Add after the existing useEffect (around line 44):

```typescript
// Animate arc fill when data changes
useEffect(() => {
  if (!data) return;

  const numericValue = typeof data.value === 'string'
    ? parseFloat(data.value.replace(/[^0-9.]/g, ''))
    : data.value;

  const min = data.min ?? widget.min ?? 0;
  const max = data.max ?? widget.max ?? 100;
  const percentage = ((numericValue - min) / (max - min)) * 100;
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  const radius = 45;
  const circumference = Math.PI * radius;
  const targetOffset = circumference - (clampedPercentage / 100) * circumference;

  // Animate from current to target
  const startOffset = animatedOffset;
  const duration = 800;
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

    const current = startOffset + (targetOffset - startOffset) * eased;
    setAnimatedOffset(current);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
}, [data]);
```

**Step 3: Use animated offset in SVG**

Update the value arc path (around line 136):

```typescript
<path
  d={`M 10 70 A ${radius} ${radius} 0 0 1 110 70`}
  fill="none"
  stroke={color}
  strokeWidth={strokeWidth}
  strokeLinecap="round"
  strokeDasharray={circumference}
  strokeDashoffset={animatedOffset}
  style={{ transition: 'stroke 0.3s ease' }}
/>
```

**Step 4: Test visually**

Run: `bun run dev`
Expected: Gauge arc animates smoothly when data updates

**Step 5: Commit**

```bash
git add src/components/widgets/GaugeWidget.tsx
git commit -m "feat(Gauge): add animated arc fill with easing"
```

---

### Task 10: Enhance BarChartWidget - Improve Styling

**Files:**
- Modify: `src/components/widgets/BarChartWidget.tsx:177-230`

**Step 1: Import animation config**

Add to imports at top of file:

```typescript
import { CHART_ANIMATION_CONFIG } from '@lib/animationUtils';
```

**Step 2: Update chart options**

Replace the `options` object (around line 177) with:

```typescript
const options = {
  responsive: true,
  maintainAspectRatio: false,
  animation: CHART_ANIMATION_CONFIG,
  plugins: {
    legend: {
      display: data.datasets.length > 1,
      position: 'top' as const,
      labels: {
        color: 'rgb(244, 223, 255)', // madhive-chalk
        font: {
          size: 12,
          weight: '500' as const,
        },
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 16,
      },
    },
    tooltip: {
      backgroundColor: 'rgb(26, 15, 46)', // madhive-purple-deep
      titleColor: 'rgb(244, 223, 255)',
      bodyColor: 'rgb(244, 223, 255)',
      borderColor: 'rgb(255, 155, 211)', // madhive-pink
      borderWidth: 2,
      padding: 16,
      displayColors: true,
      titleFont: {
        size: 14,
        weight: 'bold' as const,
      },
      bodyFont: {
        size: 13,
      },
      callbacks: {
        label: function(context: any) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed.y !== null) {
            label += context.parsed.y.toLocaleString();
          }
          return label;
        }
      }
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
        drawBorder: false,
      },
      ticks: {
        color: 'rgb(244, 223, 255)',
        font: {
          size: 11,
        },
      },
    },
    y: {
      grid: {
        color: 'rgba(61, 31, 92, 0.5)', // madhive-purple-medium with transparency
        drawBorder: false,
        borderDash: [4, 4],
      },
      ticks: {
        color: 'rgb(244, 223, 255)',
        font: {
          size: 11,
        },
      },
      beginAtZero: true,
    },
  },
};
```

**Step 3: Update bar styling in chartData**

Update the datasets mapping (around line 163):

```typescript
datasets: chartDataFormat.datasets.map((dataset, index) => ({
  ...dataset,
  backgroundColor: dataset.backgroundColor ||
    (chartDataFormat.labels.length === 1
      ? defaultColors[index % defaultColors.length]
      : chartDataFormat.labels.map((_, i) => defaultColors[i % defaultColors.length])),
  borderColor: 'transparent',
  borderWidth: 0,
  borderRadius: 8,
  hoverBackgroundColor: dataset.backgroundColor ||
    (chartDataFormat.labels.length === 1
      ? defaultColors[index % defaultColors.length].replace(')', ', 0.8)').replace('rgb', 'rgba')
      : chartDataFormat.labels.map((_, i) =>
          defaultColors[i % defaultColors.length].replace(')', ', 0.8)').replace('rgb', 'rgba')
        )),
})),
```

**Step 4: Test visually**

Run: `bun run dev`
Expected: Bar charts have improved tooltips, animations, and styling

**Step 5: Commit**

```bash
git add src/components/widgets/BarChartWidget.tsx
git commit -m "feat(BarChart): enhance styling with better tooltips and animations"
```

---

### Task 11: Enhance LineChartWidget - Add Gradient Fills

**Files:**
- Modify: `src/components/widgets/LineChartWidget.tsx:150-165`

**Step 1: Import utilities**

Add to imports:

```typescript
import { CHART_ANIMATION_CONFIG } from '@lib/animationUtils';
import { hexToRgba } from '@lib/colorUtils';
```

**Step 2: Create gradient backgrounds for datasets**

Replace the chartData preparation (around line 150) with:

```typescript
const chartData = {
  labels: data.labels || [],
  datasets: data.datasets.map((dataset, index) => {
    const borderColor = dataset.borderColor || defaultColors[index % defaultColors.length];

    // Create gradient background from border color
    const bgColor = borderColor.startsWith('rgb')
      ? borderColor.replace('rgb', 'rgba').replace(')', ', 0.1)')
      : hexToRgba(borderColor, 0.1);

    return {
      ...dataset,
      borderColor,
      backgroundColor: dataset.backgroundColor || bgColor,
      fill: dataset.fill !== undefined ? dataset.fill : true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: borderColor,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
      borderWidth: 3,
    };
  }),
};
```

**Step 3: Update chart options**

Replace options object (around line 166) with:

```typescript
const options = {
  responsive: true,
  maintainAspectRatio: false,
  animation: CHART_ANIMATION_CONFIG,
  plugins: {
    legend: {
      display: data.datasets.length > 1,
      position: 'top' as const,
      labels: {
        color: 'rgb(244, 223, 255)',
        font: {
          size: 12,
          weight: '500' as const,
        },
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 16,
      },
    },
    tooltip: {
      backgroundColor: 'rgb(26, 15, 46)',
      titleColor: 'rgb(244, 223, 255)',
      bodyColor: 'rgb(244, 223, 255)',
      borderColor: 'rgb(255, 155, 211)',
      borderWidth: 2,
      padding: 16,
      displayColors: true,
      intersect: false,
      mode: 'index' as const,
      titleFont: {
        size: 14,
        weight: 'bold' as const,
      },
      bodyFont: {
        size: 13,
      },
    },
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(61, 31, 92, 0.3)',
        drawBorder: false,
        borderDash: [4, 4],
      },
      ticks: {
        color: 'rgb(244, 223, 255)',
        font: {
          size: 11,
        },
        maxRotation: 0,
      },
    },
    y: {
      grid: {
        color: 'rgba(61, 31, 92, 0.5)',
        drawBorder: false,
        borderDash: [4, 4],
      },
      ticks: {
        color: 'rgb(244, 223, 255)',
        font: {
          size: 11,
        },
      },
    },
  },
  interaction: {
    mode: 'nearest' as const,
    axis: 'x' as const,
    intersect: false,
  },
};
```

**Step 4: Test visually**

Run: `bun run dev`
Expected: Line charts show gradient area fills and improved styling

**Step 5: Commit**

```bash
git add src/components/widgets/LineChartWidget.tsx
git commit -m "feat(LineChart): add gradient fills and enhanced styling"
```

---

### Task 12: Enhance TableWidget - Add Sticky Headers and Hover Effects

**Files:**
- Modify: `src/components/widgets/TableWidget.tsx`

**Step 1: Read current TableWidget**

Run: `cat src/components/widgets/TableWidget.tsx`
Expected: See current table implementation

**Step 2: Add sticky header styling**

Update the table structure (replace entire return statement):

```typescript
return (
  <div
    data-widget-id={widget.id}
    style={{
      gridColumn: `span ${widget.position.colSpan}`,
      gridRow: `span ${widget.position.rowSpan}`,
    }}
    className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col hover:border-slate-600 transition-colors"
  >
    <h3 className="text-sm font-medium text-slate-400 mb-3">{widget.title}</h3>

    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm">
          <tr className="border-b border-slate-700">
            {data.headers.map((header) => (
              <th
                key={header.key}
                className="text-left py-3 px-4 font-semibold text-slate-300 uppercase tracking-wider text-xs"
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, idx) => (
            <tr
              key={idx}
              className="border-b border-slate-800 last:border-0 hover:bg-slate-700/50 transition-colors"
            >
              {data.headers.map((header) => (
                <td
                  key={header.key}
                  className="py-3 px-4 text-slate-200"
                >
                  {header.type === 'status' && (
                    <span className={`inline-flex items-center gap-2 ${
                      row[header.key] === 'success' ? 'text-emerald-400' :
                      row[header.key] === 'warning' ? 'text-yellow-400' :
                      row[header.key] === 'error' ? 'text-red-400' :
                      'text-slate-400'
                    }`}>
                      <span className="w-2 h-2 rounded-full bg-current" />
                      {row[header.key]}
                    </span>
                  )}
                  {header.type === 'number' && (
                    <span className="tabular-nums">
                      {typeof row[header.key] === 'number'
                        ? row[header.key].toLocaleString()
                        : row[header.key]
                      }
                    </span>
                  )}
                  {(!header.type || header.type === 'text') && row[header.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
```

**Step 3: Update data interface**

Add interface at top of file:

```typescript
interface TableHeader {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'status';
}

interface TableData {
  headers: TableHeader[];
  rows: Record<string, any>[];
  timestamp: string;
}
```

**Step 4: Test visually**

Run: `bun run dev`
Expected: Table has sticky header, hover effects, and type-aware cell rendering

**Step 5: Commit**

```bash
git add src/components/widgets/TableWidget.tsx
git commit -m "feat(Table): add sticky headers, hover effects, and cell type formatting"
```

---

### Task 13: Enhance ListWidget - Add Two-Line Items and Icons

**Files:**
- Modify: `src/components/widgets/ListWidget.tsx`

**Step 1: Update data interface**

Add at top of file:

```typescript
interface ListItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  badge?: {
    text: string;
    variant: 'success' | 'warning' | 'error' | 'info';
  };
  status?: 'success' | 'warning' | 'error' | 'info';
}

interface ListData {
  items: ListItem[];
  timestamp: string;
}
```

**Step 2: Enhance list item rendering**

Replace the return statement with:

```typescript
const statusColors = {
  success: 'border-emerald-500',
  warning: 'border-yellow-500',
  error: 'border-red-500',
  info: 'border-blue-500',
};

const badgeColors = {
  success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

return (
  <div
    data-widget-id={widget.id}
    style={{
      gridColumn: `span ${widget.position.colSpan}`,
      gridRow: `span ${widget.position.rowSpan}`,
    }}
    className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col hover:border-slate-600 transition-colors"
  >
    <h3 className="text-sm font-medium text-slate-400 mb-3">{widget.title}</h3>

    <div className="flex-1 overflow-auto space-y-2">
      {data.items.map((item) => (
        <div
          key={item.id}
          className={`
            flex items-center gap-3 p-3 rounded-lg
            bg-slate-900/50
            border-l-4 ${item.status ? statusColors[item.status] : 'border-transparent'}
            hover:bg-slate-700/50
            transition-all duration-200
            group
          `}
        >
          {item.icon && (
            <div className="text-2xl flex-shrink-0">
              {item.icon}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-medium text-slate-200 truncate">
                {item.title}
              </div>
              {item.badge && (
                <span className={`
                  px-2 py-0.5 text-xs rounded-full border flex-shrink-0
                  ${badgeColors[item.badge.variant]}
                `}>
                  {item.badge.text}
                </span>
              )}
            </div>

            {item.subtitle && (
              <div className="text-sm text-slate-400 truncate mt-0.5">
                {item.subtitle}
              </div>
            )}
          </div>

          <div className="text-slate-600 group-hover:text-slate-400 transition-colors">
            →
          </div>
        </div>
      ))}
    </div>
  </div>
);
```

**Step 3: Test visually**

Run: `bun run dev`
Expected: List items show two lines, icons, badges, and status indicators

**Step 4: Commit**

```bash
git add src/components/widgets/ListWidget.tsx
git commit -m "feat(List): add two-line items, icons, badges, and status indicators"
```

---

### Task 14: Enhance MapWidget - Add Marker Clustering

**Files:**
- Modify: `src/components/widgets/MapWidget.tsx`

**Step 1: Install supercluster for clustering**

Run:
```bash
cd /home/tech/dev-dashboards/frontend
bun add supercluster
```

**Step 2: Import supercluster**

Add to imports in MapWidget.tsx:

```typescript
import Supercluster from 'supercluster';
import { useMemo } from 'react';
```

**Step 3: Add clustering logic**

Add before the return statement (around line 70):

```typescript
// Create clusters for markers when there are 10+
const clusters = useMemo(() => {
  if (!data || !data.markers || data.markers.length < 10) {
    return data?.markers || [];
  }

  const index = new Supercluster({
    radius: 60,
    maxZoom: 16,
  });

  const points = data.markers.map((marker, idx) => ({
    type: 'Feature' as const,
    properties: { ...marker, originalIndex: idx },
    geometry: {
      type: 'Point' as const,
      coordinates: [marker.lng, marker.lat],
    },
  }));

  index.load(points);

  const bounds = [
    data.center.lng - 2,
    data.center.lat - 2,
    data.center.lng + 2,
    data.center.lat + 2,
  ];

  return index.getClusters(bounds, Math.floor(data.zoom));
}, [data]);
```

**Step 4: Update marker rendering to handle clusters**

Replace the markers rendering section with:

```typescript
{clusters.map((cluster, index) => {
  const [longitude, latitude] = cluster.geometry.coordinates;
  const { cluster: isCluster, point_count: pointCount } = cluster.properties;

  if (isCluster) {
    return (
      <Marker
        key={`cluster-${index}`}
        longitude={longitude}
        latitude={latitude}
        anchor="center"
      >
        <div className="relative">
          <div
            className="flex items-center justify-center rounded-full bg-pink-500 text-white font-bold border-4 border-pink-300"
            style={{
              width: `${30 + (pointCount / clusters.length) * 20}px`,
              height: `${30 + (pointCount / clusters.length) * 20}px`,
            }}
          >
            {pointCount}
          </div>
        </div>
      </Marker>
    );
  }

  const marker = cluster.properties;
  return (
    <Marker
      key={marker.originalIndex}
      longitude={longitude}
      latitude={latitude}
      anchor="bottom"
    >
      <div className="relative group">
        {/* Pulse animation */}
        <div
          className="absolute inset-0 rounded-full opacity-75 group-hover:opacity-100 animate-ping"
          style={{
            backgroundColor: marker.color || '#FF9BD3',
            animationDuration: '2s',
          }}
        />

        {/* Marker pin */}
        <div
          className="relative w-8 h-8 rounded-full border-3 border-white shadow-lg flex items-center justify-center text-white font-bold text-sm transition-transform group-hover:scale-110"
          style={{ backgroundColor: marker.color || '#FF9BD3' }}
        >
          {marker.value !== undefined ? Math.round(marker.value) : '●'}
        </div>

        {marker.label && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {marker.label}
            {marker.value !== undefined && `: ${marker.value}`}
          </div>
        )}
      </div>
    </Marker>
  );
})}
```

**Step 5: Test visually**

Run: `bun run dev`
Expected: Map clusters markers when 10+ are close together

**Step 6: Commit**

```bash
git add src/components/widgets/MapWidget.tsx package.json bun.lock
git commit -m "feat(Map): add marker clustering for dense data"
```

---

## Phase 3: Wave 2 - New Widget Types (Tasks 15-20)

### Task 15: Create SparklineWidget

**Files:**
- Create: `src/components/widgets/SparklineWidget.tsx`
- Create: `src/components/widgets/SparklineWidget.test.tsx`

**Step 1: Write failing test**

Create `src/components/widgets/SparklineWidget.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SparklineWidget from './SparklineWidget';
import type { Widget } from '@lib/api';

describe('SparklineWidget', () => {
  const mockWidget: Widget = {
    id: 'test-sparkline',
    type: 'sparkline',
    title: 'Test Sparkline',
    position: { colSpan: 1, rowSpan: 1 },
  };

  it('renders loading state initially', () => {
    render(<SparklineWidget widget={mockWidget} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders error state on fetch failure', async () => {
    // Mock fetchWidgetData to fail
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Failed to fetch'))
    );

    render(<SparklineWidget widget={mockWidget} />);
    expect(await screen.findByText(/Error/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/components/widgets/SparklineWidget.test.tsx`
Expected: FAIL - "Cannot find module './SparklineWidget'"

**Step 3: Create SparklineWidget component**

Create `src/components/widgets/SparklineWidget.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { fetchWidgetData } from '@lib/api';
import type { Widget } from '@lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

interface SparklineWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface SparklineData {
  values: number[];
  trend?: 'up' | 'down' | 'flat';
  timestamp: string;
}

export default function SparklineWidget({
  widget,
  refreshInterval = 10000,
}: SparklineWidgetProps) {
  const [data, setData] = useState<SparklineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const result = await fetchWidgetData(widget.id);
      setData(result);
      setLoading(false);
    } catch (err) {
      console.error(`Failed to load data for widget ${widget.id}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [widget.id, refreshInterval]);

  if (loading) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-slate-400 text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-red-900 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="text-red-400 text-xs">Error loading sparkline</div>
        </div>
      </div>
    );
  }

  if (!data || !data.values || data.values.length === 0) {
    return null;
  }

  // Determine trend color
  const trendColor = data.trend === 'up'
    ? 'rgb(255, 155, 211)' // pink
    : data.trend === 'down'
    ? 'rgb(252, 165, 165)' // red
    : 'rgb(148, 163, 184)'; // gray

  const chartData = {
    labels: data.values.map((_, i) => i.toString()),
    datasets: [{
      data: data.values,
      borderColor: trendColor,
      backgroundColor: trendColor.replace(')', ', 0.1)').replace('rgb', 'rgba'),
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: trendColor,
      borderWidth: 2,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgb(26, 15, 46)',
        titleColor: 'rgb(244, 223, 255)',
        bodyColor: 'rgb(244, 223, 255)',
        borderColor: trendColor,
        borderWidth: 1,
        padding: 8,
        displayColors: false,
        callbacks: {
          title: () => '',
          label: (context: any) => `Value: ${context.parsed.y}`,
        },
      },
    },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  };

  return (
    <div
      data-widget-id={widget.id}
      style={{
        gridColumn: `span ${widget.position.colSpan}`,
        gridRow: `span ${widget.position.rowSpan}`,
      }}
      className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col hover:border-slate-600 transition-colors"
    >
      <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>

      <div className="flex-1 min-h-0" style={{ height: '60px' }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/components/widgets/SparklineWidget.test.tsx`
Expected: PASS - Tests passing

**Step 5: Commit**

```bash
git add src/components/widgets/SparklineWidget.tsx src/components/widgets/SparklineWidget.test.tsx
git commit -m "feat: add SparklineWidget with trend-based coloring"
```

---

### Task 16: Create HeatmapWidget

**Files:**
- Create: `src/components/widgets/HeatmapWidget.tsx`

**Step 1: Install Chart.js matrix controller**

Run:
```bash
cd /home/tech/dev-dashboards/frontend
bun add chartjs-chart-matrix
```

**Step 2: Create HeatmapWidget component**

Create `src/components/widgets/HeatmapWidget.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
import { fetchWidgetData } from '@lib/api';
import type { Widget } from '@lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  MatrixController,
  MatrixElement
);

interface HeatmapWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface HeatmapData {
  rows: string[];
  cols: string[];
  values: number[][];
  colorScale?: { min: string; max: string };
  timestamp: string;
}

export default function HeatmapWidget({
  widget,
  refreshInterval = 10000,
}: HeatmapWidgetProps) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const result = await fetchWidgetData(widget.id);
      setData(result);
      setLoading(false);
    } catch (err) {
      console.error(`Failed to load data for widget ${widget.id}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [widget.id, refreshInterval]);

  if (loading) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-red-900 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="text-red-400 text-sm">Error loading heatmap</div>
        </div>
      </div>
    );
  }

  if (!data || !data.values || data.values.length === 0) {
    return null;
  }

  // Transform matrix data to Chart.js format
  const chartData: any = {
    datasets: [{
      label: widget.title,
      data: data.values.flatMap((row, y) =>
        row.map((value, x) => ({
          x: data.cols[x],
          y: data.rows[y],
          v: value,
        }))
      ),
      backgroundColor(context: any) {
        const value = context.dataset.data[context.dataIndex]?.v;
        if (value === undefined) return 'transparent';

        const allValues = context.dataset.data.map((d: any) => d.v);
        const min = Math.min(...allValues);
        const max = Math.max(...allValues);
        const normalized = (value - min) / (max - min);

        // Color scale: purple (low) -> pink (high)
        const r = Math.round(61 + normalized * (255 - 61));
        const g = Math.round(31 + normalized * (155 - 31));
        const b = Math.round(92 + normalized * (211 - 92));

        return `rgb(${r}, ${g}, ${b})`;
      },
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      width: ({ chart }: any) => (chart.chartArea || {}).width / data.cols.length - 1,
      height: ({ chart }: any) => (chart.chartArea || {}).height / data.rows.length - 1,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgb(26, 15, 46)',
        titleColor: 'rgb(244, 223, 255)',
        bodyColor: 'rgb(244, 223, 255)',
        borderColor: 'rgb(255, 155, 211)',
        borderWidth: 2,
        padding: 12,
        callbacks: {
          title(context: any) {
            const item = context[0];
            return `${item.raw.y} / ${item.raw.x}`;
          },
          label(context: any) {
            return `Value: ${context.raw.v}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'category' as const,
        labels: data.cols,
        ticks: {
          color: 'rgb(244, 223, 255)',
          font: { size: 10 },
        },
        grid: { display: false },
      },
      y: {
        type: 'category' as const,
        labels: data.rows,
        ticks: {
          color: 'rgb(244, 223, 255)',
          font: { size: 10 },
        },
        grid: { display: false },
      },
    },
  };

  return (
    <div
      data-widget-id={widget.id}
      style={{
        gridColumn: `span ${widget.position.colSpan}`,
        gridRow: `span ${widget.position.rowSpan}`,
      }}
      className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col hover:border-slate-600 transition-colors"
    >
      <h3 className="text-sm font-medium text-slate-400 mb-3">{widget.title}</h3>

      <div className="flex-1 min-h-0">
        <Chart type="matrix" data={chartData} options={options} />
      </div>
    </div>
  );
}
```

**Step 3: Test visually**

Run: `bun run dev`
Expected: Heatmap widget renders with color gradient

**Step 4: Commit**

```bash
git add src/components/widgets/HeatmapWidget.tsx package.json bun.lock
git commit -m "feat: add HeatmapWidget with purple-to-pink color scale"
```

---

### Task 17: Create MultiMetricCardWidget

**Files:**
- Create: `src/components/widgets/MultiMetricCardWidget.tsx`

**Step 1: Create MultiMetricCardWidget component**

Create `src/components/widgets/MultiMetricCardWidget.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { fetchWidgetData } from '@lib/api';
import type { Widget } from '@lib/api';

interface MultiMetricCardWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface MetricData {
  label: string;
  value: number | string;
  unit?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

interface MultiMetricData {
  metrics: MetricData[];
  timestamp: string;
}

export default function MultiMetricCardWidget({
  widget,
  refreshInterval = 10000,
}: MultiMetricCardWidgetProps) {
  const [data, setData] = useState<MultiMetricData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const result = await fetchWidgetData(widget.id);
      setData(result);
      setLoading(false);
    } catch (err) {
      console.error(`Failed to load data for widget ${widget.id}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [widget.id, refreshInterval]);

  if (loading) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-red-900 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="text-red-400 text-sm">Error loading metrics</div>
        </div>
      </div>
    );
  }

  if (!data || !data.metrics || data.metrics.length === 0) {
    return null;
  }

  return (
    <div
      data-widget-id={widget.id}
      style={{
        gridColumn: `span ${widget.position.colSpan}`,
        gridRow: `span ${widget.position.rowSpan}`,
      }}
      className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col hover:border-slate-600 transition-colors"
    >
      <h3 className="text-sm font-medium text-slate-400 mb-4">{widget.title}</h3>

      <div
        className="flex-1 grid gap-4"
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`,
        }}
      >
        {data.metrics.map((metric, index) => (
          <div
            key={index}
            className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 hover:border-pink-500/30 transition-colors"
          >
            <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">
              {metric.label}
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white tabular-nums">
                {typeof metric.value === 'string'
                  ? metric.value
                  : Math.round(metric.value).toLocaleString()
                }
              </span>
              {metric.unit && (
                <span className="text-sm text-slate-400">{metric.unit}</span>
              )}
            </div>

            {metric.trend && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${
                metric.trend.direction === 'up' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                <span className="text-lg">
                  {metric.trend.direction === 'up' ? '↑' : '↓'}
                </span>
                <span className="font-semibold">
                  {Math.abs(metric.trend.value)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Test visually**

Run: `bun run dev`
Expected: Multi-metric card displays 2-6 metrics in responsive grid

**Step 3: Commit**

```bash
git add src/components/widgets/MultiMetricCardWidget.tsx
git commit -m "feat: add MultiMetricCardWidget with responsive grid layout"
```

---

### Task 18: Create StackedBarChartWidget

**Files:**
- Create: `src/components/widgets/StackedBarChartWidget.tsx`

**Step 1: Create StackedBarChartWidget component**

Create `src/components/widgets/StackedBarChartWidget.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { fetchWidgetData } from '@lib/api';
import { CHART_ANIMATION_CONFIG } from '@lib/animationUtils';
import { getMadHiveChartColors } from '@lib/colorUtils';
import type { Widget } from '@lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface StackedBarChartWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface StackedBarData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
  }[];
  orientation?: 'horizontal' | 'vertical';
  timestamp: string;
}

export default function StackedBarChartWidget({
  widget,
  refreshInterval = 10000,
}: StackedBarChartWidgetProps) {
  const [data, setData] = useState<StackedBarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const result = await fetchWidgetData(widget.id);
      setData(result);
      setLoading(false);
    } catch (err) {
      console.error(`Failed to load data for widget ${widget.id}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [widget.id, refreshInterval]);

  if (loading) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-red-900 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="text-red-400 text-sm">Error loading chart</div>
        </div>
      </div>
    );
  }

  if (!data || !data.datasets || data.datasets.length === 0) {
    return null;
  }

  const defaultColors = getMadHiveChartColors();

  const chartData = {
    labels: data.labels || [],
    datasets: data.datasets.map((dataset, index) => ({
      ...dataset,
      backgroundColor: dataset.backgroundColor || defaultColors[index % defaultColors.length],
      borderColor: 'transparent',
      borderRadius: 8,
    })),
  };

  const isHorizontal = data.orientation === 'horizontal';

  const options = {
    indexAxis: isHorizontal ? ('y' as const) : ('x' as const),
    responsive: true,
    maintainAspectRatio: false,
    animation: CHART_ANIMATION_CONFIG,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: 'rgb(244, 223, 255)',
          font: {
            size: 12,
            weight: '500' as const,
          },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgb(26, 15, 46)',
        titleColor: 'rgb(244, 223, 255)',
        bodyColor: 'rgb(244, 223, 255)',
        borderColor: 'rgb(255, 155, 211)',
        borderWidth: 2,
        padding: 16,
        callbacks: {
          footer: (tooltipItems: any) => {
            const total = tooltipItems.reduce((sum: number, item: any) => sum + item.parsed[isHorizontal ? 'x' : 'y'], 0);
            return `Total: ${total.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          color: 'rgba(61, 31, 92, 0.5)',
          drawBorder: false,
          borderDash: [4, 4],
        },
        ticks: {
          color: 'rgb(244, 223, 255)',
          font: { size: 11 },
        },
      },
      y: {
        stacked: true,
        grid: {
          color: isHorizontal ? 'rgba(61, 31, 92, 0.5)' : 'transparent',
          drawBorder: false,
          borderDash: [4, 4],
        },
        ticks: {
          color: 'rgb(244, 223, 255)',
          font: { size: 11 },
        },
        beginAtZero: true,
      },
    },
  };

  return (
    <div
      data-widget-id={widget.id}
      style={{
        gridColumn: `span ${widget.position.colSpan}`,
        gridRow: `span ${widget.position.rowSpan}`,
      }}
      className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col hover:border-slate-600 transition-colors"
    >
      <h3 className="text-sm font-medium text-slate-400 mb-3">{widget.title}</h3>

      <div className="flex-1 min-h-0">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
```

**Step 2: Test visually**

Run: `bun run dev`
Expected: Stacked bar chart displays with total in tooltip

**Step 3: Commit**

```bash
git add src/components/widgets/StackedBarChartWidget.tsx
git commit -m "feat: add StackedBarChartWidget with horizontal/vertical support"
```

---

### Task 19: Create SankeyWidget with D3

**Files:**
- Create: `src/components/widgets/SankeyWidget.tsx`

**Step 1: Create SankeyWidget component**

Create `src/components/widgets/SankeyWidget.tsx`:

```typescript
import { useState, useEffect, useRef } from 'react';
import { fetchWidgetData } from '@lib/api';
import type { Widget } from '@lib/api';
import * as d3 from 'd3-selection';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { scaleOrdinal } from 'd3-scale';

interface SankeyWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface SankeyNode {
  id: string;
  label: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  timestamp: string;
}

export default function SankeyWidget({
  widget,
  refreshInterval = 10000,
}: SankeyWidgetProps) {
  const [data, setData] = useState<SankeyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      setError(null);
      const result = await fetchWidgetData(widget.id);
      setData(result);
      setLoading(false);
    } catch (err) {
      console.error(`Failed to load data for widget ${widget.id}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [widget.id, refreshInterval]);

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };

    // Create sankey generator
    const sankeyGenerator = sankey()
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);

    // Transform data for d3-sankey
    const graph = {
      nodes: data.nodes.map(d => ({ ...d })),
      links: data.links.map(d => ({ ...d })),
    };

    // Generate sankey layout
    const { nodes, links } = sankeyGenerator(graph as any);

    // Color scale
    const color = scaleOrdinal<string>()
      .range(['#FF9BD3', '#FDA4D4', '#F4DFFF', '#3D1F5C', '#FF7AC6', '#FFD4EC']);

    // Draw links
    svg.append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('d', sankeyLinkHorizontal() as any)
      .attr('stroke', (d: any) => color(d.source.id))
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', (d: any) => Math.max(1, d.width))
      .on('mouseenter', function() {
        d3.select(this).attr('stroke-opacity', 0.7);
      })
      .on('mouseleave', function() {
        d3.select(this).attr('stroke-opacity', 0.4);
      })
      .append('title')
      .text((d: any) => `${d.source.label} → ${d.target.label}\n${d.value}`);

    // Draw nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g');

    node.append('rect')
      .attr('x', (d: any) => d.x0)
      .attr('y', (d: any) => d.y0)
      .attr('height', (d: any) => d.y1 - d.y0)
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('fill', (d: any) => color(d.id))
      .attr('opacity', 0.8)
      .on('mouseenter', function() {
        d3.select(this).attr('opacity', 1);
      })
      .on('mouseleave', function() {
        d3.select(this).attr('opacity', 0.8);
      })
      .append('title')
      .text((d: any) => `${d.label}\n${d.value}`);

    // Add labels
    node.append('text')
      .attr('x', (d: any) => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
      .attr('y', (d: any) => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d: any) => (d.x0 < width / 2 ? 'start' : 'end'))
      .attr('fill', '#F4DFFF')
      .attr('font-size', '11px')
      .text((d: any) => d.label);

  }, [data]);

  if (loading) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-red-900 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="text-red-400 text-sm">Error loading diagram</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div
      data-widget-id={widget.id}
      style={{
        gridColumn: `span ${widget.position.colSpan}`,
        gridRow: `span ${widget.position.rowSpan}`,
      }}
      className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col hover:border-slate-600 transition-colors"
    >
      <h3 className="text-sm font-medium text-slate-400 mb-3">{widget.title}</h3>

      <div ref={containerRef} className="flex-1 min-h-0">
        <svg ref={svgRef} width="100%" height="100%" />
      </div>
    </div>
  );
}
```

**Step 2: Test visually**

Run: `bun run dev`
Expected: Sankey diagram renders with flow visualization

**Step 3: Commit**

```bash
git add src/components/widgets/SankeyWidget.tsx
git commit -m "feat: add SankeyWidget with D3.js flow visualization"
```

---

### Task 20: Create TreemapWidget with D3

**Files:**
- Create: `src/components/widgets/TreemapWidget.tsx`

**Step 1: Create TreemapWidget component**

Create `src/components/widgets/TreemapWidget.tsx`:

```typescript
import { useState, useEffect, useRef } from 'react';
import { fetchWidgetData } from '@lib/api';
import type { Widget } from '@lib/api';
import * as d3 from 'd3-selection';
import { hierarchy, treemap, treemapBinary } from 'd3-hierarchy';
import { scaleLinear } from 'd3-scale';

interface TreemapWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface TreemapChild {
  name: string;
  value: number;
  children?: TreemapChild[];
}

interface TreemapData {
  name: string;
  children: TreemapChild[];
  timestamp: string;
}

export default function TreemapWidget({
  widget,
  refreshInterval = 10000,
}: TreemapWidgetProps) {
  const [data, setData] = useState<TreemapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      setError(null);
      const result = await fetchWidgetData(widget.id);
      setData(result);
      setLoading(false);
    } catch (err) {
      console.error(`Failed to load data for widget ${widget.id}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [widget.id, refreshInterval]);

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Create hierarchy
    const root = hierarchy(data)
      .sum((d: any) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create treemap layout
    treemap()
      .size([width, height])
      .padding(2)
      .tile(treemapBinary)
      (root as any);

    // Color scale based on value
    const maxValue = Math.max(...root.leaves().map((d: any) => d.value || 0));
    const colorScale = scaleLinear<string>()
      .domain([0, maxValue / 2, maxValue])
      .range(['#3D1F5C', '#FF9BD3', '#FFD4EC']);

    // Draw rectangles
    const leaf = svg.selectAll('g')
      .data(root.leaves())
      .join('g')
      .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

    leaf.append('rect')
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('height', (d: any) => d.y1 - d.y0)
      .attr('fill', (d: any) => colorScale(d.value || 0))
      .attr('opacity', 0.8)
      .attr('stroke', '#1A0F2E')
      .attr('stroke-width', 2)
      .on('mouseenter', function() {
        d3.select(this).attr('opacity', 1);
      })
      .on('mouseleave', function() {
        d3.select(this).attr('opacity', 0.8);
      })
      .append('title')
      .text((d: any) => `${d.data.name}\n${d.value}`);

    // Add labels (only if rectangle is large enough)
    leaf.append('text')
      .attr('x', 4)
      .attr('y', 16)
      .attr('fill', '#F4DFFF')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text((d: any) => {
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
        // Only show text if rectangle is large enough
        return (width > 50 && height > 30) ? d.data.name : '';
      });

    leaf.append('text')
      .attr('x', 4)
      .attr('y', 32)
      .attr('fill', '#F4DFFF')
      .attr('font-size', '10px')
      .attr('opacity', 0.8)
      .text((d: any) => {
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
        return (width > 50 && height > 45) ? `${d.value}` : '';
      });

  }, [data]);

  if (loading) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-red-900 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="text-red-400 text-sm">Error loading treemap</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div
      data-widget-id={widget.id}
      style={{
        gridColumn: `span ${widget.position.colSpan}`,
        gridRow: `span ${widget.position.rowSpan}`,
      }}
      className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col hover:border-slate-600 transition-colors"
    >
      <h3 className="text-sm font-medium text-slate-400 mb-3">{widget.title}</h3>

      <div ref={containerRef} className="flex-1 min-h-0">
        <svg ref={svgRef} width="100%" height="100%" />
      </div>
    </div>
  );
}
```

**Step 2: Test visually**

Run: `bun run dev`
Expected: Treemap renders hierarchical data as rectangles

**Step 3: Commit**

```bash
git add src/components/widgets/TreemapWidget.tsx
git commit -m "feat: add TreemapWidget with D3.js hierarchical visualization"
```

---

## Phase 4: Integration & Testing (Tasks 21-23)

### Task 21: Register New Widget Types in Layout

**Files:**
- Modify: `src/components/Layout.tsx`
- Modify: `src/stores/dashboard.ts`

**Step 1: Import new widgets in Layout.tsx**

Add to imports section (around line 10):

```typescript
import SparklineWidget from '@components/widgets/SparklineWidget';
import HeatmapWidget from '@components/widgets/HeatmapWidget';
import MultiMetricCardWidget from '@components/widgets/MultiMetricCardWidget';
import StackedBarChartWidget from '@components/widgets/StackedBarChartWidget';
import SankeyWidget from '@components/widgets/SankeyWidget';
import TreemapWidget from '@components/widgets/TreemapWidget';
```

**Step 2: Add to widget type mapping**

Update the renderWidget function (find existing switch/case or mapping object):

```typescript
const widgetComponents: Record<string, any> = {
  'big-number': BigNumberWidget,
  'stat-card': StatCardWidget,
  'gauge': GaugeWidget,
  'bar-chart': BarChartWidget,
  'line-chart': LineChartWidget,
  'table': TableWidget,
  'list': ListWidget,
  'map': MapWidget,
  // New widget types
  'sparkline': SparklineWidget,
  'heatmap': HeatmapWidget,
  'multi-metric': MultiMetricCardWidget,
  'stacked-bar': StackedBarChartWidget,
  'sankey': SankeyWidget,
  'treemap': TreemapWidget,
};
```

**Step 3: Update IMPLEMENTED_WIDGET_TYPES in dashboard.ts**

Update the set (around line 10):

```typescript
const IMPLEMENTED_WIDGET_TYPES = new Set([
  'big-number',
  'stat-card',
  'gauge',
  'bar-chart',
  'line-chart',
  'table',
  'list',
  'map',
  'sparkline',
  'heatmap',
  'multi-metric',
  'stacked-bar',
  'sankey',
  'treemap',
]);
```

**Step 4: Test build**

Run: `bun run build`
Expected: No TypeScript or build errors

**Step 5: Commit**

```bash
git add src/components/Layout.tsx src/stores/dashboard.ts
git commit -m "feat: register all 6 new widget types in layout"
```

---

### Task 22: Update Widget Type Definitions

**Files:**
- Modify: `src/lib/api.ts` (or wherever Widget type is defined)

**Step 1: Add new widget types to type definition**

Update the Widget type (find the type definition):

```typescript
export type WidgetType =
  | 'big-number'
  | 'stat-card'
  | 'gauge'
  | 'bar-chart'
  | 'line-chart'
  | 'table'
  | 'list'
  | 'map'
  | 'sparkline'
  | 'heatmap'
  | 'multi-metric'
  | 'stacked-bar'
  | 'sankey'
  | 'treemap';
```

**Step 2: Verify TypeScript compilation**

Run: `bun run build`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add new widget types to TypeScript definitions"
```

---

### Task 23: Create Visual Test Dashboard

**Files:**
- Modify: `config/dashboards.yaml` (or create test dashboard)

**Step 1: Add test dashboard with all widget types**

Add to dashboards.yaml:

```yaml
- id: visual-showcase
  name: "Visual Showcase"
  gridCols: 4
  gridRows: 4
  widgets:
    - id: big-num-enhanced
      type: big-number
      title: "Total Users"
      position: { colSpan: 1, rowSpan: 1 }
      gradient: true

    - id: stat-card-enhanced
      type: stat-card
      title: "Active Sessions"
      position: { colSpan: 1, rowSpan: 1 }

    - id: gauge-enhanced
      type: gauge
      title: "System Health"
      position: { colSpan: 1, rowSpan: 1 }

    - id: sparkline-test
      type: sparkline
      title: "Quick Trend"
      position: { colSpan: 1, rowSpan: 1 }

    - id: multi-metric-test
      type: multi-metric
      title: "Key Metrics"
      position: { colSpan: 2, rowSpan: 1 }

    - id: bar-enhanced
      type: bar-chart
      title: "Revenue by Region"
      position: { colSpan: 2, rowSpan: 1 }

    - id: line-enhanced
      type: line-chart
      title: "Traffic Over Time"
      position: { colSpan: 2, rowSpan: 2 }

    - id: heatmap-test
      type: heatmap
      title: "Activity Heatmap"
      position: { colSpan: 2, rowSpan: 2 }

    - id: stacked-bar-test
      type: stacked-bar
      title: "Conversion Funnel"
      position: { colSpan: 2, rowSpan: 1 }

    - id: sankey-test
      type: sankey
      title: "User Flow"
      position: { colSpan: 2, rowSpan: 1 }

    - id: table-enhanced
      type: table
      title: "Recent Transactions"
      position: { colSpan: 2, rowSpan: 2 }

    - id: treemap-test
      type: treemap
      title: "Resource Usage"
      position: { colSpan: 2, rowSpan: 2 }
```

**Step 2: Test visual showcase**

Run: `bun run dev`
Navigate to visual-showcase dashboard
Expected: All 14 widget types render without errors

**Step 3: Commit**

```bash
git add config/dashboards.yaml
git commit -m "feat: add visual showcase dashboard with all widget types"
```

---

## Final Verification

### Task 24: Run Full Test Suite

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests passing (including new utility tests)

**Step 2: Run build**

Run: `bun run build`
Expected: No errors, successful build

**Step 3: Visual testing on TV**

1. Start server: `bun run server/index.js`
2. Open on TV: `http://158.106.212.230:3000`
3. Navigate through all dashboards
4. Verify:
   - All widgets render correctly
   - Colors match MadHive brand
   - Text is readable from 10 feet
   - Animations are smooth
   - Auto-rotation works (30 seconds)
   - Progress bar shows timing

**Step 4: Check bundle size**

Run: `ls -lh dist/_astro/*.js`
Expected: Total bundle increase < 200KB from D3

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete visual transformation with 14 widget types"
```

---

## Success Criteria Checklist

- ✅ All 8 existing widgets enhanced with MadHive aesthetic
- ✅ 6 new widget types implemented (sparkline, heatmap, multi-metric, stacked-bar, sankey, treemap)
- ✅ Design tokens expanded in global.css
- ✅ Utility functions created (format, color, animation)
- ✅ All widgets use consistent MadHive color palette
- ✅ Typography optimized for TV viewing (10-foot distance)
- ✅ Animations smooth and performant
- ✅ Tests passing
- ✅ Build successful
- ✅ Bundle size within target (< 200KB increase)
- ✅ Visual showcase dashboard created

---

## Next Steps (Post-Implementation)

1. Create mock data generators for all widget types
2. Update backend data sources to return appropriate formats
3. Add widget type documentation/gallery
4. Implement drag-and-drop editor (separate project)
5. Performance profiling on actual TV hardware
