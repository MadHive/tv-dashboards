# Dashboard Creation Wizard - Design Document

**Date:** 2026-02-27
**Goal:** Build a wizard-driven dashboard creation system that pulls from monitoring tools (GCP, DataDog, GitHub, Jira) with stunning visuals optimized for TV office displays

---

## Vision

Create a **beautiful TV dashboard platform** that:
- Makes data visually stunning (this is BRAND)
- Pulls metrics from existing monitoring tools (not query building)
- Optimized for at-a-glance office TV displays
- Wizard guides users through dashboard creation
- First-time experience prioritized over power-user features

### What This Is NOT

- ❌ Not a SQL query builder
- ❌ Not a complex data exploration tool
- ❌ Not focused on data analysis

### What This IS

- ✅ Beautiful visual dashboard platform
- ✅ Office TV display optimized
- ✅ Brand showcase with stunning animations
- ✅ Guided dashboard creation
- ✅ Connects to existing monitoring tools

---

## User Context

**Primary Data Sources:**
- **GCP Monitoring** - Infrastructure metrics (Cloud Run, Compute Engine, BigQuery, Pub/Sub)
- **DataDog** - AWS service monitoring (EC2, Lambda, RDS, S3)
- **GitHub Actions** - CI/CD pipeline metrics
- **Jira/Confluence** - Ticket and knowledge management

**Primary Use Case:**
- Display dashboards on office TVs
- Show system health at-a-glance
- Make data beautiful and understandable
- Reflect MadHive brand visually

---

## Design Decisions

### Architecture Approach: Wizard-First, Templates Later

**Phase 1: Wizard (This Implementation)**
- Guided dashboard creation for first-time users
- Helps discover what looks good on TVs
- Educational - shows what's possible
- Builds foundation for templates

**Phase 2: Templates (Future)**
- Created from successful wizard-built dashboards
- Fast dashboard creation for repeat use cases
- Power-user workflow

**Rationale:** Wizard first because this is a new platform where users need to discover what makes their data look stunning. Templates will emerge from successful patterns.

---

## Wizard Flow Design

### Step 1: Dashboard Purpose

**Question:** "What are you monitoring?"

**Options:**
- 🏗️ **Infrastructure** - System health, performance, uptime
- 🚀 **Application** - Deployments, errors, user activity
- 📊 **Business Metrics** - Tickets, sprints, capacity
- 🎯 **Mixed** - Combination of above

**UI:**
- Large icon cards with descriptions
- Hover shows example dashboards
- Single-select with visual highlight

**Why this step:** Sets context for metric suggestions in next steps

---

### Step 2: Select Data Sources

**Question:** "Which systems do you want to monitor?"

**Options (multi-select):**
- ☁️ **GCP Monitoring** - Cloud infrastructure metrics
- 📈 **DataDog** - AWS service monitoring
- 🔄 **GitHub Actions** - CI/CD pipelines
- 📝 **Jira** - Ticket management

**UI:**
- Checkbox cards with status indicators
- Shows connection status (connected/not configured)
- Auto-discovers available metrics on selection
- Loading animation while discovering metrics

**Technical:**
- Caches metric discovery (5 min TTL)
- Parallel API calls to all selected sources
- Error handling for unavailable sources
- Shows preview of available metric count

---

### Step 3: Pick Your Metrics

**Question:** "What specific metrics matter most?"

**Layout:**
- Left panel: Browsable metric tree by category
- Right panel: Selected metrics (drag to reorder)
- Preview pane: Shows suggested visualization for each metric

**Categories:**
- 🎯 **Performance** (latency, response times, throughput)
- ⚠️ **Errors** (error rates, failed requests, exceptions)
- 🚀 **Deployments** (CI/CD success, build times, frequency)
- 🎫 **Tickets** (open issues, sprint progress, aging)
- 💻 **Resources** (CPU, memory, disk, network)

**Smart Suggestions:**
- System recommends best widget type for each metric
- "Users typically pair this with..." suggestions
- Shows example visualization preview

**UI Interactions:**
- Search/filter metrics
- Drag to reorder priority
- Remove metrics easily
- Suggested metric bundles (e.g., "Complete GCP Health")

---

### Step 4: Choose Visual Style

**Question:** "How should your dashboard look?"

**Layout Options:**
```
┌─────────────────────────────┐
│ Option A: Grid Layout       │
│ ┌────┐ ┌────┐ ┌────┐       │
│ │ 1  │ │ 2  │ │ 3  │       │
│ └────┘ └────┘ └────┘       │
│ ┌──────────┐ ┌──────────┐  │
│ │    4     │ │    5     │  │
│ └──────────┘ └──────────┘  │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Option B: Hero + Grid       │
│ ┌─────────────────────────┐ │
│ │     Hero Metric         │ │
│ └─────────────────────────┘ │
│ ┌────┐ ┌────┐ ┌────┐       │
│ │ 1  │ │ 2  │ │ 3  │       │
│ └────┘ └────┘ └────┘       │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Option C: Sidebar + Main    │
│ ┌──┐ ┌─────────────────┐   │
│ │1 │ │                 │   │
│ ├──┤ │   Main Chart    │   │
│ │2 │ │                 │   │
│ ├──┤ └─────────────────┘   │
│ │3 │ ┌────┐ ┌────┐         │
│ └──┘ │ 4  │ │ 5  │         │
└─────────────────────────────┘
```

**Animation Intensity:**
- 🌙 **Subtle** - Minimal motion, fade transitions
- ⭐ **Moderate** - Smooth animations, data transitions (recommended)
- ✨ **Bold** - Eye-catching effects, glows, pulses

**Color Schemes:**
- 🎨 **MadHive Brand** - Pink/purple gradients (default)
- 🌃 **Dark Minimal** - High contrast, less color
- 🌈 **Vibrant** - Full color spectrum for categories

**Preview:**
- Live preview with selected metrics
- Toggle between layout options
- Adjust animation speed
- See how it looks on different screen sizes

---

### Step 5: Preview & Refine

**Full Dashboard Preview:**
- Renders complete dashboard with real data
- Full-screen preview mode (simulates TV display)
- Adjustable widget sizes (drag corners)
- Reposition widgets (drag to move)
- Test animations (play/pause)

**Quick Edits:**
- Change widget types for any metric
- Swap metric assignments
- Adjust refresh intervals per widget
- Toggle widget visibility

**Validation:**
- Ensures all data sources are connected
- Shows which metrics have no data
- Warns about slow-loading metrics
- Confirms TV display compatibility

---

### Step 6: Deploy to TV

**Configuration:**
- **Dashboard Name** - Required, shown in dashboard list
- **Refresh Interval** - 30s, 1m, 5m, 15m (default: 1m)
- **Display URL** - Auto-generated shareable URL
- **Auto-start** - Launch full-screen on page load

**Output:**
```
✅ Dashboard Created!

📺 Display URL: http://tv.madhive.dev/dashboard/infrastructure-health
📋 Edit URL: http://tv.madhive.dev/app/dashboard/edit/infrastructure-health

Next Steps:
1. Open Display URL on your office TV
2. Press F11 for full-screen
3. Dashboard will auto-refresh every 1 minute
```

**Additional Options:**
- Save as template for future use
- Clone dashboard
- Schedule display times (business hours only)
- Set up alerts (future feature)

---

## Data Source Integration

### GCP Monitoring

**Connection:**
- Uses existing GCP credentials from backend
- Auto-discovers active GCP services
- Real-time metric streaming

**Available Metrics:**
- **Cloud Run:** request_count, request_latencies, instance_count
- **Compute Engine:** cpu_utilization, network_traffic, disk_io
- **BigQuery:** query_count, bytes_processed, slot_utilization
- **Pub/Sub:** message_count, oldest_unacked_message_age

**API Strategy:**
- Use Cloud Monitoring API v3
- 1-minute aggregation windows
- Exponential backoff on rate limits
- Cache recent values (30s TTL)

---

### DataDog

**Connection:**
- DataDog API key + App key from config
- Auto-discovers AWS integrations
- Fetch existing DataDog monitors

**Available Metrics:**
- **EC2:** CPU, memory, network, disk
- **Lambda:** invocations, errors, duration, throttles
- **RDS:** connections, CPU, IOPS, latency
- **S3:** bucket size, request count

**API Strategy:**
- Use Metrics API v1
- Query last 1 hour of data
- Aggregate to 1-minute resolution
- Handle API rate limits gracefully

---

### GitHub Actions

**Connection:**
- GitHub Personal Access Token (read-only)
- Organization + repo scope
- Webhook support for real-time updates (future)

**Available Metrics:**
- **Workflow Status:** success/failure counts by workflow
- **Build Times:** average/p95 duration
- **Deployment Frequency:** deployments per day/week
- **Active PRs:** count by status

**API Strategy:**
- Use GitHub REST API v3
- Cache workflow runs (5 min TTL)
- Poll every 1-2 minutes for updates
- Show recent 50 runs

---

### Jira/Confluence

**Connection:**
- Jira Cloud API with API token
- Filter by project or team

**Available Metrics:**
- **Open Tickets:** by priority (Blocker, Critical, Major, Minor)
- **Sprint Velocity:** story points completed
- **Ticket Aging:** tickets open > 30 days
- **Team Capacity:** assigned vs capacity

**API Strategy:**
- Use Jira REST API v3
- JQL queries for custom filters
- Cache results (5 min TTL)
- Support for custom fields

---

## Visual Design System

### MadHive Brand Colors

**Primary Palette:**
```javascript
{
  pink: '#FDA4D4',        // Primary brand color
  purple: {
    deepest: '#1a0b2e',   // Backgrounds
    deep: '#2d1b4e',      // Cards
    medium: '#4a2c6d',    // Borders
    light: '#6b4a8d'      // Accents
  },
  chalk: '#e8e8e8',       // Text
  accent: {
    cyan: '#00d9ff',      // Success/Info
    green: '#00ff9f',     // Positive trends
    amber: '#ffb800',     // Warnings
    red: '#ff4757'        // Errors/Critical
  }
}
```

### Typography for TV Displays

**Hierarchy:**
```css
/* Big Numbers - visible from 10+ feet */
.metric-value {
  font-size: 4rem;        /* 64px */
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

/* Labels - visible from 6+ feet */
.metric-label {
  font-size: 1.5rem;      /* 24px */
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Trends - supporting info */
.metric-trend {
  font-size: 1.25rem;     /* 20px */
  font-weight: 500;
}

/* Secondary text */
.metric-secondary {
  font-size: 1rem;        /* 16px */
  opacity: 0.7;
}
```

**Font Stack:**
```css
font-family: 'Inter', system-ui, -apple-system, sans-serif;
```

### Animation Standards

**Principles:**
- **60 FPS minimum** - Smooth on all displays
- **Purposeful** - Animations communicate data changes
- **Subtle by default** - Can be bold when selected
- **Accessible** - Respects prefers-reduced-motion

**Animation Types:**

**1. Value Changes:**
```javascript
// Number counting up/down
duration: 800ms
easing: ease-out
interpolate: previous → new value
```

**2. New Data Arrival:**
```javascript
// Pulse effect on widget border
duration: 400ms
easing: ease-in-out
glow: 0 0 20px rgba(pink, 0.6)
```

**3. Error States:**
```javascript
// Subtle shake
duration: 500ms
transform: translateX(±10px) × 3
color: fade to red
```

**4. Loading States:**
```javascript
// Shimmer skeleton
duration: 1500ms
gradient: moving highlight
easing: linear, infinite
```

**5. Trend Indicators:**
```javascript
// Arrow slide in/out
duration: 300ms
easing: cubic-bezier(0.4, 0, 0.2, 1)
color: green (up) / red (down)
```

### Widget Visual Styles

**1. Big Number Counter**
```
┌────────────────────────┐
│  REQUESTS/SEC          │
│                        │
│      12,453  ↑ 5%     │
│      ━━━━━━━━━━━       │
│  vs last hour          │
└────────────────────────┘
```
- Large animated number
- Trend indicator with percentage
- Sparkline showing recent trend
- Gradient border glow when updating

**2. Radial Gauge**
```
┌────────────────────────┐
│    CPU USAGE           │
│                        │
│      ◉ 78%            │
│     ╱   ╲             │
│                        │
│  Target: < 80%         │
└────────────────────────┘
```
- Circular progress with glow
- Color shifts: green → amber → red
- Animated fill on data change
- Threshold indicator line

**3. Status Cards**
```
┌────────────────────────┐
│ ● Services Up          │
│                        │
│   12 / 12              │
│   ✓ All Healthy        │
└────────────────────────┘
```
- Large status indicator dot
- Pulsing glow (green/red)
- Icon + count
- Status text

**4. Line Chart (Trend)**
```
┌────────────────────────┐
│ RESPONSE TIME          │
│     ╱╲                 │
│    ╱  ╲      ╱╲        │
│   ╱    ╲    ╱  ╲       │
│  ╱      ╲  ╱    ╲      │
│ ─────────────────────  │
│ 10:00  10:30  11:00    │
└────────────────────────┘
```
- Gradient fill below line
- Animated line drawing
- Minimal axes (TV readability)
- Hover shows exact values

**5. List/Feed**
```
┌────────────────────────┐
│ RECENT DEPLOYMENTS     │
│                        │
│ ✓ api-service  2m ago  │
│ ✓ web-app     15m ago  │
│ ✗ worker      1h ago   │
│                        │
└────────────────────────┘
```
- Auto-scrolling on overflow
- Status icons
- Relative timestamps
- Fade in/out for new items

---

## TV Display Optimization

### Screen Size Support

**Standard Resolutions:**
- 1080p (1920×1080) - Most common
- 4K (3840×2160) - Premium displays
- Portrait (1080×1920) - Vertical displays

**Responsive Strategy:**
- CSS Grid for automatic layout
- Scale typography with viewport units
- Maintain aspect ratios
- Test on actual TV hardware

### Contrast & Readability

**WCAG AAA Standards for TV:**
- Text contrast: 7:1 minimum
- Large text: 4.5:1 minimum
- Interactive elements: Clear focus states

**Dark Mode Optimization:**
- Default theme for reduced TV glare
- OLED-friendly (pure blacks)
- Prevents screen burn-in (rotating content)

### Performance Targets

**Frame Rates:**
- 60 FPS sustained for animations
- No layout thrashing on data updates
- GPU-accelerated transforms
- RequestAnimationFrame for smooth updates

**Data Refresh:**
- Stagger widget updates (prevent all-at-once)
- Batch API calls where possible
- Use WebSocket for real-time where available
- Graceful degradation on slow networks

---

## Technical Architecture

### Frontend Stack

**Framework:** React 18.3 + TypeScript 5.4
**Styling:** Tailwind CSS with MadHive design tokens
**Charts:** Recharts (existing) + custom Canvas animations
**State:** React hooks (useState, useReducer)
**Data Fetching:** Existing api.ts client + caching layer
**Routing:** React Router (existing)

### Component Structure

```
src/
├── pages/
│   └── DashboardWizard.tsx          (Main wizard orchestrator)
├── components/
│   ├── wizard/
│   │   ├── Step1Purpose.tsx         (Dashboard type selection)
│   │   ├── Step2DataSources.tsx     (Multi-select sources)
│   │   ├── Step3MetricPicker.tsx    (Metric selection & ordering)
│   │   ├── Step4VisualStyle.tsx     (Layout & animation options)
│   │   ├── Step5Preview.tsx         (Full preview + adjustments)
│   │   └── Step6Deploy.tsx          (Final config & URL)
│   ├── dashboard/
│   │   ├── DashboardRenderer.tsx    (TV display mode)
│   │   ├── WidgetGrid.tsx           (Layout engine)
│   │   └── widgets/
│   │       ├── BigNumberWidget.tsx  (Enhanced from existing)
│   │       ├── RadialGaugeWidget.tsx (New)
│   │       ├── StatusCardWidget.tsx  (New)
│   │       ├── TrendChartWidget.tsx  (Enhanced LineChart)
│   │       └── FeedWidget.tsx        (New - scrolling list)
│   └── ui/
│       ├── WizardProgress.tsx       (Step indicator)
│       ├── MetricCard.tsx           (Draggable metric selector)
│       ├── LayoutPreview.tsx        (Visual layout picker)
│       └── AnimationDemo.tsx        (Animation preview)
└── lib/
    ├── dataSourceConnectors/
    │   ├── gcpMonitoring.ts         (GCP API client)
    │   ├── datadog.ts               (DataDog API client)
    │   ├── github.ts                (GitHub API client)
    │   └── jira.ts                  (Jira API client)
    ├── wizardState.ts               (Wizard state management)
    ├── dashboardGenerator.ts        (Config generation from wizard)
    └── metricSuggestions.ts         (Smart metric recommendations)
```

### Data Flow

```
User Input (Wizard Step)
    ↓
Update Wizard State (React state)
    ↓
Generate Dashboard Config (JSON)
    ↓
Save to Backend (/api/dashboards)
    ↓
Render Dashboard (TV Display URL)
    ↓
Fetch Data from Sources (periodic refresh)
    ↓
Update Widgets with Animations
```

### API Endpoints (New)

**Backend additions needed:**

```javascript
// Discover available metrics from data source
GET /api/data-sources/:source/discover
Response: { categories: [...], metrics: [...] }

// Test data source connection
POST /api/data-sources/:source/test
Response: { connected: true, metrics_count: 42 }

// Create dashboard from wizard config
POST /api/dashboards/wizard
Body: { wizardState: {...} }
Response: { dashboardId: '...', displayUrl: '...' }

// Get real-time metric data
GET /api/metrics/:source/:metricId
Response: { value: 123, timestamp: '...', trend: '+5%' }
```

---

## Success Criteria

### Phase 1: MVP (First Implementation)

**Must Have:**
- ✅ Complete 6-step wizard flow
- ✅ GCP Monitoring integration (primary data source)
- ✅ 3 layout templates
- ✅ 5 widget types (BigNumber, Gauge, Status, Trend, Feed)
- ✅ 60 FPS animations
- ✅ TV display mode (full-screen, auto-refresh)
- ✅ Real data preview in wizard

**Success Metrics:**
- User can create first dashboard in < 5 minutes
- Dashboard looks "stunning" on office TV
- Data updates smoothly without flicker
- Non-technical users can use wizard successfully

### Phase 2: Enhancements (Future)

**Nice to Have:**
- DataDog integration
- GitHub Actions integration
- Jira integration
- Template library (from successful dashboards)
- Dashboard cloning
- Scheduled display times
- Alert overlays
- Multi-dashboard rotation

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- Wizard component shell (6 steps)
- GCP Monitoring connector
- Basic widget library (3 widgets)
- Simple layout engine
- TV display renderer

### Phase 2: Polish (Week 2)
- Animation system
- Remaining widgets
- Layout templates
- Preview mode
- Deployment flow

### Phase 3: Integration (Week 3)
- DataDog connector
- GitHub connector
- Jira connector
- Enhanced metric suggestions
- Performance optimization

### Phase 4: Templates (Week 4)
- Template creation from dashboards
- Template library UI
- Quick-start templates
- Documentation

---

## Open Questions

1. **Authentication:** How should we handle API keys for DataDog, GitHub, Jira?
   - Option A: Admin configures once, all users share
   - Option B: Each user provides their own keys
   - **Recommendation:** Option A for MVP (simpler)

2. **Dashboard Permissions:** Who can create/edit/delete dashboards?
   - Option A: Anyone can create, only creator can edit
   - Option B: Role-based (admin, editor, viewer)
   - **Recommendation:** Option B (future-proof)

3. **TV Browser:** What browser will run on office TVs?
   - Chrome/Chromium (full feature support)
   - Embedded browser (may have limitations)
   - **Recommendation:** Test on Chrome first, ensure compatibility

4. **Offline Mode:** What happens if data sources are unavailable?
   - Show "No Data" state
   - Show last known values with timestamp
   - **Recommendation:** Show last known values + warning indicator

---

## Migration Path

**From Current System:**
- Existing vanilla JS dashboards remain functional
- Wizard creates NEW dashboards in parallel
- No breaking changes to existing configs
- Users can recreate favorite dashboards via wizard

**Future:**
- Import wizard to convert existing dashboards
- Side-by-side mode for gradual migration

---

## Non-Goals (What We're NOT Building)

❌ SQL query builder (too complex, wrong focus)
❌ Data analysis tools
❌ Custom chart builder
❌ Report generation
❌ Email/Slack notifications (future)
❌ Multi-user collaboration (future)
❌ Mobile app

**Focus:** Beautiful TV dashboards from existing monitoring tools via guided wizard.
