# TV Dashboards: Visual Transformation Design

**Date:** 2026-02-26
**Scope:** Comprehensive visual enhancement of all widgets + 6 new widget types
**Timeline:** 2-3 days
**Approach:** Progressive Enhancement (Approach A)

---

## Overview

Transform the TV dashboard system with enhanced visualizations, MadHive dark aesthetic, and expanded widget library. Two-wave implementation:

- **Wave 1:** Polish existing 8 widgets (1-2 days)
- **Wave 2:** Add 6 new widget types (1 day)

**Total Result:** 14 production-ready widget types optimized for 10-foot TV viewing

---

## Architecture

### Technology Stack

**Primary Visualization:** Chart.js 4.5.1
- Used for: bar-chart, line-chart, sparklines, stacked-bars, heatmaps
- Already integrated, proven, lightweight
- Covers 12 of 14 widget types

**Specialized Visualization:** D3.js v7
- Used for: Sankey diagrams, Treemaps
- Only where Chart.js limitations exist
- Minimal bundle impact (2 widgets only)

**Component Framework:** React 19 + TypeScript
**Styling:** Tailwind CSS + Enhanced global.css with MadHive design tokens
**State:** Nanostores (existing pattern)

### File Structure

```
src/components/widgets/
├── BigNumberWidget.tsx          (enhance)
├── StatCardWidget.tsx           (enhance)
├── GaugeWidget.tsx              (enhance)
├── BarChartWidget.tsx           (enhance)
├── LineChartWidget.tsx          (enhance)
├── TableWidget.tsx              (enhance)
├── ListWidget.tsx               (enhance)
├── MapWidget.tsx                (enhance)
├── SparklineWidget.tsx          (new - Chart.js)
├── HeatmapWidget.tsx            (new - Chart.js)
├── MultiMetricCardWidget.tsx    (new - CSS Grid)
├── StackedBarChartWidget.tsx    (new - Chart.js)
├── SankeyWidget.tsx             (new - D3.js)
└── TreemapWidget.tsx            (new - D3.js)

src/styles/
└── global.css                   (expand design tokens)
```

---

## Visual Design System

### MadHive Dark Theme

**Extended Color Palette:**

```css
:root {
  /* Core brand colors */
  --madhive-purple-dark: #200847;
  --madhive-purple: #291036;
  --madhive-pink: #FF9BD3;
  --madhive-pink-soft: #FDA4D4;
  --madhive-chalk: #F4DFFF;

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
}
```

### Design Principles

1. **Depth & Elevation**
   - Subtle shadows for card separation
   - Gradient borders for visual hierarchy
   - Layered backgrounds (purple deepest → deep → medium)

2. **Animation & Motion**
   - Smooth value transitions (500ms ease)
   - Subtle pulse effects on data updates
   - Count-up animations for big numbers
   - Arc fill animations for gauges

3. **Density Control**
   - **Compact mode:** Title + primary value only
   - **Standard mode:** Title + value + subtitle/metadata
   - **Dense mode:** Multiple metrics per card

4. **Typography Scale** (at TV base font-size: 20px)
   - Widget titles: 1.25rem → 25px
   - Big numbers: 4.5-5rem → 90-100px
   - Secondary text: 0.875rem → 17.5px
   - Small labels: 0.75rem → 15px

5. **Color Usage Strategy**
   - **Backgrounds:** Purple gradients (dark → medium)
   - **Primary data:** Pink for key metrics
   - **Labels:** Chalk for readability
   - **Status:** Emerald (success), yellow (warning), red (error)
   - **Charts:** Pink → Purple → Chalk rotation

6. **Spacing** (at TV base: 20px)
   - Widget padding: 1.5rem → 30px
   - Internal gaps: 0.75-1rem → 15-20px
   - Grid gaps: 1rem → 20px between widgets

---

## Wave 1: Enhanced Existing Widgets

### Big Number Widget

**Enhancements:**
- Optional trend indicator (↑12% / ↓8% with color coding)
- Gradient background option (`--gradient-primary`)
- Animated counter on value changes (count-up from previous value)
- Optional mini sparkline below number (trend visualization)
- Better unit formatting (K, M, B suffixes)

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

### Stat Card Widget

**Enhancements:**
- Icon support (pass icon name/emoji, consistent sizing)
- Better metric/label hierarchy (larger value, smaller label)
- Subtle border glow on hover (`box-shadow` with pink)
- Comparison value ("vs last week: +12%")
- Optional badge (status, count)

**Data Contract:**
```typescript
interface StatCardData {
  value: number | string;
  label: string;
  icon?: string;
  comparison?: { value: number; label: string };
  badge?: { text: string; variant: 'success' | 'warning' | 'error' };
  timestamp: string;
}
```

### Gauge Widget

**Enhancements:**
- Multi-arc option (show multiple value ranges)
- Animated arc fill (transition stroke-dashoffset on update)
- Better center value display with formatted units
- Optional threshold markers on arc (warning/critical lines)
- Color gradient along arc (purple → pink progression)

**Data Contract:**
```typescript
interface GaugeData {
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  thresholds?: { value: number; label: string; color: string }[];
  timestamp: string;
}
```

### Bar Chart Widget

**Enhancements:**
- Enhanced tooltips with custom number formatting
- Grid line styling (dashed lines, subtle purple)
- Legend improvements (auto-hide when single dataset)
- Responsive axis label font sizes
- Data point animations on load (stagger effect)
- Rounded bar corners (borderRadius: 8)

**Styling:**
```typescript
const options = {
  animation: {
    duration: 800,
    easing: 'easeInOutQuart'
  },
  scales: {
    x: { grid: { color: 'var(--madhive-purple-medium)', borderDash: [4, 4] } },
    y: { grid: { color: 'var(--madhive-purple-medium)', borderDash: [4, 4] } }
  }
};
```

### Line Chart Widget

**Enhancements:**
- Area fills with gradient (pink → transparent)
- Gradient line colors (pink → purple)
- Improved grid styling (dashed, themed)
- Better tooltip positioning
- Data point hover effects (larger radius on hover)
- Smooth animations (tension: 0.4)

### Table Widget

**Enhancements:**
- Sticky headers for scrolling tables
- Row hover effects (subtle purple-deep background)
- Cell value formatting (numbers with commas, currency, percentages)
- Optional compact mode (reduced padding for dense data)
- Status indicator column support (colored dots, badges)
- Zebra striping (alternating row backgrounds)
- Optional sortable columns (↑/↓ indicators)

**Data Contract:**
```typescript
interface TableData {
  headers: { key: string; label: string; type?: 'text' | 'number' | 'currency' | 'status' }[];
  rows: Record<string, any>[];
  compact?: boolean;
  timestamp: string;
}
```

### List Widget

**Enhancements:**
- Icon library integration (status icons, category icons)
- Badge support (count badges, status badges)
- Two-line items (title + subtitle with different font sizes)
- Action indicators on hover (subtle arrow/chevron)
- Better spacing between items
- Status color coding (left border accent)

**Data Contract:**
```typescript
interface ListData {
  items: {
    id: string;
    title: string;
    subtitle?: string;
    icon?: string;
    badge?: { text: string; variant: string };
    status?: 'success' | 'warning' | 'error' | 'info';
  }[];
  timestamp: string;
}
```

### Map Widget

**Enhancements:**
- Marker clustering (when 10+ markers within close proximity)
- Custom marker colors per data point (status-based)
- Better popup styling (MadHive themed, purple background)
- Optional heatmap layer for density visualization
- Smoother zoom/pan animations
- Custom marker icons (SVG-based)

---

## Wave 2: New Widget Types

### Sparkline Widget

**Purpose:** Inline trend visualization, minimal chrome

**Implementation:**
- Chart.js line chart with minimal configuration
- Height: 40-60px (compact)
- No axes, no grid, no labels
- Trend color: up = pink, down/flat = red/gray
- Tooltip on hover with current value
- Often paired with big numbers or stat cards

**Data Contract:**
```typescript
interface SparklineData {
  values: number[];
  trend?: 'up' | 'down' | 'flat';
  timestamp: string;
}
```

**Chart Config:**
```typescript
options = {
  plugins: { legend: { display: false }, tooltip: { enabled: true } },
  scales: { x: { display: false }, y: { display: false } },
  elements: { point: { radius: 0 } }
};
```

### Heatmap Widget

**Purpose:** Matrix data visualization with color intensity

**Implementation:**
- Chart.js matrix chart type
- Color scale: purple (low) → pink (medium) → white (high)
- Cell labels showing values (hide if too dense)
- Row/column labels on axes
- Tooltip with row/col/value details

**Data Contract:**
```typescript
interface HeatmapData {
  rows: string[];
  cols: string[];
  values: number[][];
  colorScale?: { min: string; max: string };
  timestamp: string;
}
```

### Multi-Metric Card Widget

**Purpose:** Single card displaying 2-6 related metrics

**Implementation:**
- CSS Grid layout (no chart library)
- Each metric: label + value + optional trend indicator
- Responsive grid (2 cols on small widgets, 3 cols on large)
- Unified card background with gradient
- Consistent spacing and alignment

**Data Contract:**
```typescript
interface MultiMetricData {
  metrics: {
    label: string;
    value: number | string;
    unit?: string;
    trend?: { value: number; direction: 'up' | 'down' };
  }[];
  timestamp: string;
}
```

**Layout:**
```css
.multi-metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1.5rem;
}
```

### Stacked Bar Chart Widget

**Purpose:** Show part-to-whole relationships in bars

**Implementation:**
- Chart.js with `stacked: true` configuration
- Legend showing all segments (color-coded)
- Tooltips showing segment value + total
- Color rotation through MadHive palette
- Horizontal or vertical orientation

**Data Contract:**
```typescript
interface StackedBarData {
  labels: string[];
  datasets: { label: string; data: number[]; backgroundColor?: string }[];
  orientation?: 'horizontal' | 'vertical';
  timestamp: string;
}
```

### Sankey Diagram Widget

**Purpose:** Flow visualization (sources → targets)

**Implementation:**
- D3.js sankey layout (`d3-sankey` package)
- Flow from left sources → right targets
- Link width proportional to value magnitude
- Interactive hover (highlight connected paths)
- MadHive pink for links, purple nodes
- Custom SVG rendering

**Data Contract:**
```typescript
interface SankeyData {
  nodes: { id: string; label: string }[];
  links: { source: string; target: string; value: number }[];
  timestamp: string;
}
```

**Dependencies:**
- `npm install d3-sankey d3-scale d3-shape`

### Treemap Widget

**Purpose:** Hierarchical data as nested rectangles

**Implementation:**
- D3.js treemap layout (`d3-hierarchy`)
- Rectangles sized by value (area proportional)
- Nested hierarchies (parent contains children)
- Color intensity by value (purple → pink gradient)
- Labels on rectangles (hide if too small)
- Interactive hover (highlight + tooltip)

**Data Contract:**
```typescript
interface TreemapData {
  name: string;
  children: {
    name: string;
    value: number;
    children?: { name: string; value: number }[];
  }[];
  timestamp: string;
}
```

**Dependencies:**
- `npm install d3-hierarchy d3-scale`

---

## Implementation Strategy

### Phase 1: Foundation (0.5 day)

1. Expand `global.css` with new design tokens
2. Install D3 dependencies (`d3-sankey`, `d3-hierarchy`, `d3-scale`)
3. Create shared utility functions:
   - `formatNumber(value, type)` - currency, percentage, K/M/B
   - `getColorScale(value, min, max)` - gradient color selection
   - `animateValue(from, to, duration)` - count-up animation

### Phase 2: Wave 1 - Enhance Existing (1-1.5 days)

**Order of enhancement:**
1. Big Number Widget (trend, sparkline, animations)
2. Stat Card Widget (icons, comparisons, badges)
3. Gauge Widget (multi-arc, animations, thresholds)
4. Bar Chart Widget (styling, tooltips, animations)
5. Line Chart Widget (gradients, area fills)
6. Table Widget (sticky headers, formatting, hover)
7. List Widget (icons, badges, two-line items)
8. Map Widget (clustering, custom markers, heatmap)

**Testing:** Visual regression testing - capture screenshots before/after each widget

### Phase 3: Wave 2 - New Widgets (1 day)

**Order of implementation:**
1. Sparkline Widget (simplest - Chart.js line with minimal config)
2. Multi-Metric Card Widget (CSS Grid, no library)
3. Stacked Bar Chart Widget (Chart.js config variation)
4. Heatmap Widget (Chart.js matrix chart)
5. Sankey Diagram Widget (D3.js integration)
6. Treemap Widget (D3.js integration)

**Testing:** Create example data for each widget type, verify rendering on TV

### Phase 4: Polish & Integration (0.5 day)

1. Update widget registry in Layout.tsx
2. Create mock data examples for all widget types
3. Add widget type to dashboards.yaml schema
4. Update documentation with widget gallery
5. Performance testing (bundle size, render time)

---

## Data Flow

**Unchanged from current system:**

1. Widget config in `dashboards.yaml` specifies widget type
2. `Layout.tsx` renders appropriate widget component
3. Widget component calls `fetchWidgetData(widgetId)`
4. Backend returns JSON matching widget's data contract
5. Widget transforms data if needed, renders visualization

**New widget types integrate seamlessly:**
- Add type to widget registry
- Backend returns appropriate data format
- No changes to core data fetching logic

---

## Success Criteria

### Visual Quality
- ✅ All widgets use MadHive color palette consistently
- ✅ Typography scales appropriately for 10-foot viewing
- ✅ Animations are smooth (60fps) without jank
- ✅ Hover states provide clear interaction feedback

### Functionality
- ✅ All 14 widget types render without errors
- ✅ Data updates trigger smooth transitions
- ✅ Responsive to different widget sizes (colSpan/rowSpan)
- ✅ Tooltips/interactions work correctly

### Performance
- ✅ Bundle size increase < 200KB (D3 tree-shaking)
- ✅ Initial render < 100ms per widget
- ✅ Page rotation maintains 30-second cycle

### Code Quality
- ✅ TypeScript types for all data contracts
- ✅ Consistent component patterns
- ✅ Reusable utility functions
- ✅ No console errors or warnings

---

## Risk Mitigation

**Risk:** D3 integration complexity
- **Mitigation:** Limit to 2 widgets only, keep Chart.js for rest

**Risk:** Bundle size bloat
- **Mitigation:** Tree-shake D3 imports, only import needed modules

**Risk:** Breaking existing dashboards
- **Mitigation:** All changes backward compatible, enhanced widgets work with current data

**Risk:** Performance regression on TV
- **Mitigation:** Test on actual TV hardware, profile rendering performance

**Risk:** Inconsistent styling across widgets
- **Mitigation:** Centralized design tokens in global.css, shared utility functions

---

## Future Enhancements (Post-MVP)

- Drag-and-drop widget repositioning (separate admin interface)
- Real-time data streaming with WebSocket updates
- Widget configuration UI (edit thresholds, colors, etc.)
- Export widget as image/PDF
- Drill-down interactions (click widget → detailed view)
- Responsive layouts for different TV sizes

---

## Appendix: Color Palette Reference

**MadHive Brand Colors:**
- Purple Dark: `#200847`
- Purple Deep: `#1A0F2E`
- Purple Medium: `#3D1F5C`
- Hot Pink: `#FF9BD3`
- Soft Pink: `#FDA4D4`
- Blue Chalk: `#F4DFFF`

**Chart Color Rotation:**
1. Hot Pink (`#FF9BD3`)
2. Soft Pink (`#FDA4D4`)
3. Blue Chalk (`#F4DFFF`)
4. Purple Medium (`#3D1F5C`)
5. Pink Bright (`#FF7AC6`)
6. Pink Pale (`#FFD4EC`)

**Status Colors:**
- Success: `#A7F3D0` (emerald)
- Warning: `#FDE68A` (yellow)
- Error: `#FCA5A5` (red)
- Info: `#93C5FD` (blue)
