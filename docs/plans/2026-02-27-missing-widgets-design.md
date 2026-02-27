# Missing Vanilla JS Widgets Implementation Design

**Date:** 2026-02-27
**Goal:** Implement 8 missing widget types for vanilla JS dashboard system
**Architecture:** Canvas-based rendering with MadHive brand aesthetic

---

## Context

The TV Dashboards project has two parallel systems:
- **Vanilla JS** (`/`) - Production dashboard system
- **React** (`/app`) - Modern rebuild with all widgets complete

The vanilla JS system is missing 8 widget types that are causing "unknown widget" errors on the visual-showcase page (page 12). Both systems need to work independently.

## Missing Widgets

1. **sparkline** - Mini line chart for quick trends
2. **multi-metric-card** - Card showing 3-4 related metrics
3. **line-chart** - Full time series chart with axes
4. **heatmap** - Grid-based heat visualization
5. **stacked-bar-chart** - Horizontal bars with segments
6. **sankey** - Flow diagram between stages
7. **table** - Data table with sorting
8. **treemap** - Hierarchical rectangles

## Architecture

### File Structure

```
public/
├── js/
│   ├── charts.js       # Add 8 canvas renderers
│   └── widgets.js      # Add 8 widget wrapper functions
server/
└── mock-data.js        # Add 8 mock data generators
```

### Rendering Pattern

Each widget follows existing pattern:

```javascript
function widgetName(container, config) {
  // Create DOM structure
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  return {
    update(data) {
      // Call chart renderer
      C.chartRenderer(canvas, data, config);
    }
  };
}
```

### Canvas Rendering Standards

- **DPI awareness:** Use existing `setup()` helper
- **Brand colors:** MadHive palette (pink, violet, cyan, green, amber, red)
- **Responsiveness:** Size based on container dimensions
- **Interactivity:** Hover effects, tooltips where appropriate
- **Performance:** Smooth animations via requestAnimationFrame

## Widget Specifications

### 1. Sparkline

**Type:** Canvas mini line chart
**Renderer:** `Charts.sparklineChart(canvas, data, config)`

**Features:**
- Minimal design (no axes/labels)
- Auto-scaled Y-axis
- MadHive pink line with glow
- Gradient fill to transparent
- Small footprint (fits in cards)

**Data Contract:**
```javascript
{
  values: [10, 15, 12, 18, 22, 20, 25]  // Array of numbers
}
```

**Visual Style:**
- Line width: 2px
- Line color: `#FDA4D4` (MadHive pink)
- Glow: `rgba(253, 164, 212, 0.3)` shadow
- Fill gradient: pink at top, transparent at bottom

---

### 2. Multi-Metric Card

**Type:** DOM-based grid of metrics
**Renderer:** DOM elements with CSS grid

**Features:**
- 2x2 or 1x4 grid layout (adapts to metric count)
- Each metric: label, value, trend arrow
- Compact number formatting (K/M/B)
- Color coding by status/trend

**Data Contract:**
```javascript
{
  metrics: [
    {
      label: 'CPU',
      value: 45,
      unit: '%',
      trend: 'up',      // 'up' | 'down' | 'stable'
      status: 'healthy' // optional: 'healthy' | 'warning' | 'error'
    },
    { label: 'Memory', value: 8.2, unit: 'GB', trend: 'stable' },
    { label: 'Disk', value: 120, unit: 'GB', trend: 'down' }
  ]
}
```

**Layout:**
- 1-2 metrics: 1x2 grid
- 3-4 metrics: 2x2 grid
- 5+ metrics: scrollable vertical list

---

### 3. Line Chart

**Type:** Canvas time series chart
**Renderer:** `Charts.lineChart(canvas, data, config)`

**Features:**
- Multi-line support (up to 5 series)
- X-axis: time labels (auto-formatted)
- Y-axis: value labels with gridlines
- Hover tooltip with values
- Smooth Bezier curves
- Legend with series colors/names

**Data Contract:**
```javascript
{
  series: [
    {
      name: 'Requests',
      color: '#FDA4D4',
      values: [100, 120, 115, 140, 130]
    },
    {
      name: 'Errors',
      color: '#FB7185',
      values: [5, 3, 8, 4, 6]
    }
  ],
  labels: ['00:00', '01:00', '02:00', '03:00', '04:00']
}
```

**Algorithm:**
- Bezier curve smoothing between points
- Auto Y-axis scaling with nice round numbers
- Gridline spacing: ~5-7 lines

---

### 4. Heatmap

**Type:** Canvas grid with color intensity
**Renderer:** `Charts.heatmap(canvas, data, config)`

**Features:**
- Grid layout: rows × columns
- Color scale: cool (blue) → hot (red)
- Cell values optionally displayed
- Row/column labels
- Color legend with scale

**Data Contract:**
```javascript
{
  rows: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  columns: ['00:00', '06:00', '12:00', '18:00'],
  values: [
    [5, 10, 30, 15],   // Monday
    [8, 12, 35, 18],   // Tuesday
    [6, 15, 40, 20]    // Wednesday
  ]
}
```

**Color Scale:**
- Min: `#67E8F9` (cyan - cool)
- Mid: `#FBBF24` (amber - warm)
- Max: `#FB7185` (red - hot)
- Linear interpolation between stops

---

### 5. Stacked Bar Chart

**Type:** Canvas horizontal bars
**Renderer:** `Charts.stackedBar(canvas, data, config)`

**Features:**
- Horizontal bars with stacked segments
- Each segment: different color, subcategory
- Y-axis: category labels
- X-axis: cumulative values with gridlines
- Legend showing segments
- Hover shows breakdown

**Data Contract:**
```javascript
{
  categories: ['Product A', 'Product B', 'Product C'],
  segments: [
    {
      name: 'North',
      color: '#FDA4D4',
      values: [100, 150, 120]  // One value per category
    },
    {
      name: 'South',
      color: '#67E8F9',
      values: [80, 90, 100]
    },
    {
      name: 'West',
      color: '#4ADE80',
      values: [60, 70, 85]
    }
  ]
}
```

**Layout:**
- Bar height: proportional to category count
- Segment width: proportional to value
- Padding: 10% between bars

---

### 6. Sankey Diagram

**Type:** Canvas flow visualization
**Renderer:** `Charts.sankey(canvas, data, config)`

**Features:**
- Nodes: rectangular blocks
- Links: flowing ribbons (width = flow volume)
- Gradient colors along flow
- Layout algorithm: minimize crossings
- Hover shows flow details

**Data Contract:**
```javascript
{
  nodes: [
    { id: 'visits', label: 'Website Visits' },
    { id: 'signups', label: 'Sign Ups' },
    { id: 'purchases', label: 'Purchases' }
  ],
  links: [
    { source: 'visits', target: 'signups', value: 1000 },
    { source: 'signups', target: 'purchases', value: 300 }
  ]
}
```

**Algorithm:**
- Node positioning: force-directed layout with horizontal constraints
- Link width: proportional to flow value
- Minimize link crossings for readability

---

### 7. Table

**Type:** DOM data table
**Renderer:** DOM elements with CSS

**Features:**
- Sticky header row
- Alternating row colors
- Column sorting (click header)
- Number formatting
- Max height with scroll
- Status badges

**Data Contract:**
```javascript
{
  columns: [
    {
      key: 'name',
      label: 'Name',
      align: 'left'
    },
    {
      key: 'value',
      label: 'Value',
      align: 'right',
      format: 'number'  // 'number' | 'percent' | 'badge' | 'text'
    },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      format: 'badge'
    }
  ],
  rows: [
    { name: 'Service A', value: 1234, status: 'healthy' },
    { name: 'Service B', value: 567, status: 'warning' }
  ]
}
```

**Sorting:**
- Numeric columns: numerical sort
- Text columns: alphabetical sort
- Badge columns: custom order (healthy > warning > error)

---

### 8. Treemap

**Type:** Canvas hierarchical rectangles
**Renderer:** `Charts.treemap(canvas, data, config)`

**Features:**
- Recursive rectangle subdivision
- Size: area proportional to value
- Color: represents category/metric
- Labels: name + value
- Squarified algorithm (better aspect ratios)
- Hover shows hierarchy path

**Data Contract:**
```javascript
{
  name: 'Root',
  children: [
    {
      name: 'Category A',
      value: 100,
      color: '#FDA4D4'
    },
    {
      name: 'Category B',
      value: 80,
      color: '#67E8F9'
    },
    {
      name: 'Category C',
      value: 60,
      color: '#4ADE80',
      children: [  // Optional nested structure
        { name: 'Sub C1', value: 35, color: '#4ADE80' },
        { name: 'Sub C2', value: 25, color: '#4ADE80' }
      ]
    }
  ]
}
```

**Algorithm:**
- Squarified treemap (Bruls et al.)
- Minimize aspect ratio for readability
- Recursive layout for nested hierarchies

---

## Implementation Approach

### Canvas Renderers (charts.js)

All custom canvas implementations following existing patterns:
- DPI-aware setup via `setup()` helper
- MadHive brand color palette
- Smooth rendering with antialiasing
- Responsive sizing

### Widget Wrappers (widgets.js)

Standard widget pattern:
- Create container DOM structure
- Initialize canvas/elements
- Return `{ update(data) }` object
- Handle data updates efficiently

### Mock Data (mock-data.js)

Generate realistic mock data for each widget:
- Sparkline: trending numeric arrays
- Multi-metric: service health metrics
- Line chart: time series data
- Heatmap: activity grid
- Stacked bar: regional breakdown
- Sankey: conversion funnel
- Table: service status list
- Treemap: resource usage hierarchy

---

## Brand Consistency

### Colors
- Primary: `#FDA4D4` (MadHive pink)
- Accent: `#67E8F9` (cyan), `#4ADE80` (green), `#FBBF24` (amber)
- Status: `#4ADE80` (success), `#FBBF24` (warning), `#FB7185` (error)
- Background: transparent (inherit from widget container)
- Text: `#F3F2EB` (light), `#B8A8D0` (secondary)

### Typography
- Use existing font stack
- Labels: 12px
- Values: 14-18px (varies by widget)
- Headers: 16px bold

---

## Testing Strategy

### Manual Testing
1. Load visual-showcase page (page 12)
2. Verify all 8 widgets render without errors
3. Check data updates every 8 seconds
4. Verify hover interactions work
5. Test on different screen sizes

### Visual Regression
- Compare rendered widgets to design specs
- Verify colors match MadHive palette
- Check alignment and spacing

---

## Success Criteria

✅ All 8 widgets render on visual-showcase page
✅ No "unknown widget" errors in console
✅ Widgets match MadHive brand aesthetic
✅ Data updates work correctly
✅ Performance: smooth 60fps rendering
✅ Code follows existing patterns
✅ Mock data generators provide realistic data

---

## Next Steps

Create detailed implementation plan with:
- Step-by-step tasks for each widget
- Test-driven development approach
- Commit strategy
- Verification steps
