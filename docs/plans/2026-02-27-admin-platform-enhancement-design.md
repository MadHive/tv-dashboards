# Admin Platform Enhancement Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to implement this design.

**Date:** 2026-02-27
**Status:** Approved
**Goal:** Transform admin interface into comprehensive platform for data source onboarding, template management, and TV-optimized dashboard creation

---

## Vision

Enable staff to easily onboard data sources, discover and apply pre-built templates, and create dashboards with TV-optimized visuals that "really pop off the screen" - all without developer intervention.

## Design Approach

**Component Library + Orchestration**

Build reusable UI components, then compose them into integrated workflows that guide users through complex tasks. This enables both modularity (test components independently) and cohesion (seamless end-to-end workflows).

---

## Architecture

### Three-Layer System

#### 1. Component Library Layer (`public/js/components/`)

**Reusable UI components that work anywhere:**

- **Wizard Framework** (`wizard-framework.js`)
  - Multi-step wizard with progress indicators
  - Validation engine with visual feedback
  - Context preservation (pause/resume)
  - Branching logic (skip steps conditionally)
  - Summary screen before save

- **Data Source Components**
  - `data-source-connector.js` - Visual wizard for connecting sources
  - `data-source-tester.js` - Connection testing with live feedback
  - `connection-preview.js` - Sample data preview panel

- **Template Components**
  - `template-card.js` - Template preview cards
  - `template-browser.js` - Searchable template gallery
  - `widget-library.js` - Drag-and-drop widget templates

- **Theme Components**
  - `theme-selector.js` - Theme gallery with previews
  - `tv-preview.js` - TV simulator (55", 65", 85" displays)
  - `color-picker.js` - Custom theme builder

- **Shared Components**
  - `form-builder.js` - Dynamic form generation
  - `live-preview.js` - Real-time dashboard preview
  - `validation-engine.js` - Reusable validation logic

#### 2. Orchestration Layer (`public/js/workflows/`)

**Workflow engine that composes components:**

- `workflow-engine.js` - Executes workflow definitions, manages state
- **Pre-built Workflows:**
  - `create-from-template.js` - Template → Data Source → Theme → Save
  - `data-source-onboarding.js` - Select Source → Configure → Test → Save
  - `quick-dashboard.js` - One-click dashboard with smart defaults

**Workflow Definition Example:**
```javascript
{
  id: 'create-from-template',
  steps: [
    { component: TemplateSelector, validate: (data) => data.template },
    { component: DataSourceCheck, skip: (data) => !data.missingSourcesDetected },
    { component: DataSourceWizard, skip: (data) => data.allSourcesPresent },
    { component: ThemeSelector },
    { component: DashboardPreview },
    { component: SaveConfirmation }
  ],
  onComplete: saveDashboard
}
```

#### 3. Enhanced Admin Shell

**Main interface hosting workflows:**

- `public/admin.html` - Updated layout with tabs
- `public/js/admin-app.js` - Enhanced with workflow launcher
- **Tabbed Navigation:**
  - Dashboards (existing CRUD)
  - Templates (new)
  - Data Sources (new)
  - Themes (new)
  - Settings (new)
- **TV Preview Mode:** Full-screen dashboard simulation
- **Global State Management:** Shared state across tabs

### Backend Enhancements (`server/`)

**New Services:**

- **Data Source Manager** (`data-source-manager.js`)
  - CRUD for data source configurations
  - Connection testing
  - Metric discovery
  - Sample data generation

- **Theme Manager** (`theme-manager.js`)
  - Theme storage and retrieval
  - TV-optimized presets
  - Custom theme builder
  - Accessibility validation

- **Preview Service** (`preview-service.js`)
  - Generate dashboard previews with sample data
  - Theme application
  - Screenshot generation for template thumbnails

**Enhanced Services:**

- `template-manager.js` - Add categories, tags, metadata, preview generation
- `data-source-registry.js` - Add schema export, connection testing

### Data Storage

**Configuration Files:**

- `config/data-sources.yaml` - Data source configurations (new)
- `config/templates/` - Template library (existing, enhanced)
- `config/themes.yaml` - Theme definitions (new)
- `config/admin-preferences.yaml` - User preferences (new)

**Example Data Source Config:**
```yaml
dataSources:
  - id: datadog-prod
    name: Datadog Production
    type: datadog
    config:
      apiKey: ${DATADOG_API_KEY}
      appKey: ${DATADOG_APP_KEY}
      site: datadoghq.com
    status: connected
    lastTested: 2026-02-27T10:30:00Z
```

**Example Theme Config:**
```yaml
themes:
  - id: dark-high-contrast
    name: Dark High Contrast
    category: TV-Optimized
    colors:
      background: "#000000"
      primary: "#FF006E"
      secondary: "#00F5FF"
      success: "#00FF41"
      warning: "#FFB627"
      error: "#FF0000"
    fonts:
      base: 24px
      title: 48px
      widget: 32px
    spacing:
      gap: 20px
      padding: 16px
```

---

## Component Design Details

### 1. Wizard Framework

**Reusable multi-step wizard orchestrator**

**Features:**
- Step progression with validation
- Visual progress indicator (breadcrumb trail)
- Context preservation (pause/resume workflows)
- Branching logic (conditional step skipping)
- Summary screen with review before save

**Usage:**
```javascript
const wizard = new Wizard({
  steps: [
    { id: 'select', component: TemplateSelector, validate: (data) => data.template },
    { id: 'configure', component: DataSourceConfig, skip: (data) => data.template.hasData },
    { id: 'theme', component: ThemeSelector },
    { id: 'preview', component: DashboardPreview },
    { id: 'save', component: SaveConfirmation }
  ],
  onComplete: (data) => saveDashboard(data),
  onCancel: () => returnToAdmin()
});
```

### 2. Data Source Connector

**Visual wizard for connecting new data sources**

**Flow:**
1. **Select Source Type** - Grid of source icons (Datadog, Salesforce, AWS, etc.)
2. **Configure Connection** - Dynamic form based on source schema
3. **Test Connection** - Live testing with spinner → success/error feedback
4. **Preview Data** - Shows available metrics with sample values
5. **Save & Name** - Name the connection, save configuration

**Features:**
- Dynamic form generation from data source schema
- Secure credential handling (environment variables recommended)
- Real-time connection testing
- Detailed error messages (invalid key vs. timeout vs. rate limit)
- Sample data preview before saving

### 3. Template Browser

**Visual library of pre-built dashboard templates**

**Template Card Structure:**
```javascript
{
  id: 'devops-monitoring',
  name: 'DevOps Monitoring',
  category: 'DevOps',
  tags: ['gcp', 'cloud-run', 'performance'],
  thumbnail: '/img/templates/devops-monitoring.png',
  description: 'Real-time service health and performance metrics',
  requiredSources: ['gcp', 'datadog'],
  widgets: [...],
  recommendedTheme: 'dark-high-contrast',
  author: 'MadHive',
  createdAt: '2026-02-15'
}
```

**Features:**
- **Category Filters:** DevOps, Sales, Security, Marketing, Custom
- **Search & Tags:** Quick filtering by name, tags, data sources
- **Compatibility Check:** Highlights missing required data sources
- **Preview Mode:** Full-screen preview before applying
- **Template Cards:** Thumbnail, title, description, requirements

**Categories:**
- **DevOps:** Service health, performance monitoring, infrastructure
- **Sales:** Pipeline metrics, revenue tracking, CRM dashboards
- **Security:** Vulnerability tracking, incident monitoring, compliance
- **Marketing:** Campaign metrics, web analytics, social media
- **Custom:** User-created templates

### 4. Widget Library

**Drag-and-drop widget template gallery**

**Widget Categories:**
- **Metrics:** Big numbers, stat cards, gauges
- **Charts:** Bar charts, line charts, heatmaps
- **Status:** Alert lists, service grids, progress bars
- **Flows:** Pipeline diagrams, sankey charts
- **Maps:** USA maps, geographic heatmaps
- **Security:** Security scorecards, vulnerability tables

**Features:**
- Instant preview on hover
- Pre-configured with smart defaults
- "Add to Dashboard" quick action
- Recent/favorites tracking
- Drag-and-drop to grid

**Widget Template Example:**
```javascript
{
  id: 'cpu-gauge',
  name: 'CPU Usage Gauge',
  icon: '⚙️',
  category: 'System Metrics',
  preview: { type: 'gauge', sampleValue: 65, max: 100, unit: '%' },
  config: {
    type: 'gauge',
    title: 'CPU Usage',
    source: 'gcp',
    position: { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
    min: 0,
    max: 100,
    unit: '%',
    thresholds: [
      { value: 80, color: 'warning' },
      { value: 90, color: 'error' }
    ]
  }
}
```

### 5. Theme Selector & TV Preview

**TV-optimized visual themes with live simulation**

**Pre-built TV Themes:**

1. **Dark High Contrast**
   - Background: Pure black (#000000)
   - Colors: Hot pink, cyan, green (vibrant, saturated)
   - Fonts: 2x normal size
   - Use case: High-visibility operations centers

2. **Light Clean**
   - Background: White (#FFFFFF)
   - Colors: Pastels, subtle gradients
   - Fonts: 1.5x normal size
   - Use case: Professional office displays

3. **Neon Cyberpunk**
   - Background: Dark gray (#1a1a1a)
   - Colors: Hot pink (#FF006E), cyan (#00F5FF), glow effects
   - Fonts: Bold, futuristic
   - Use case: Tech company lobbies, developer spaces

4. **Corporate Blue**
   - Background: Navy (#1e3a5f)
   - Colors: Blue/gray professional palette
   - Fonts: Clean, conservative
   - Use case: Executive dashboards, client-facing displays

5. **Alert Red**
   - Background: Dark red (#2b0000)
   - Colors: Red spectrum, high urgency
   - Fonts: Bold, large
   - Use case: Incident monitoring, critical alerts

**TV Preview Features:**
- **Size Simulation:** 55", 65", 85" displays
- **Distance Simulation:** Adjust preview size for viewing distance (8ft, 12ft, 15ft)
- **Color Blindness Preview:** Deuteranopia, protanopia, tritanopia
- **Contrast Checker:** WCAG AA compliance (4.5:1 minimum)
- **Side-by-Side Comparison:** Compare themes visually

**Custom Theme Builder:**
- Color picker for all theme colors
- Font size sliders (base, title, widget)
- Spacing controls (gap, padding)
- Live preview updates as you adjust
- Export/import theme configs

### 6. Live Preview Component

**Real-time dashboard preview with sample or live data**

**Features:**
- Toggle between sample data and live data
- TV mode (full-screen, simulated TV display)
- Responsive preview (desktop, tablet, 3 TV sizes)
- Loading states and error handling
- Export preview as PNG image

**Preview Modes:**
- **Edit Mode:** Shows grid, handles, widget controls
- **View Mode:** Clean dashboard view (what users see)
- **TV Mode:** Full-screen simulation with auto-rotate

---

## Data Flow

### Workflow 1: Create Dashboard from Template

**User Journey:**
```
Browse Templates → Select Template → Check Data Sources → Configure Missing Sources →
Choose Theme → Preview on TV → Customize (optional) → Save
```

**Detailed Flow:**

1. **Template Selection**
   - GET `/api/templates` → displays template browser
   - User selects template → GET `/api/templates/:id` (full config)

2. **Data Source Check**
   - Frontend checks `template.requiredSources` against GET `/api/data-sources`
   - If missing sources detected:
     - Show warning: "This template requires: Datadog, Salesforce"
     - Offer: "Set up now" (launches data source wizard inline) or "Continue anyway"
   - If all sources present → proceed to theme

3. **Theme Selection**
   - GET `/api/themes` → displays theme gallery
   - User selects theme → preview updates in real-time
   - Preview: GET `/api/preview/dashboard?template=:id&theme=:themeId` (sample data)

4. **Customization (Optional)**
   - User can adjust widgets, change positions, modify config
   - Live preview updates

5. **Save Dashboard**
   - POST `/api/dashboards` with merged config (template + theme + customizations)
   - Backend validates, saves to `dashboards.yaml`
   - Success toast, redirect to dashboard list or view new dashboard

### Workflow 2: Data Source Onboarding

**User Journey:**
```
Select Source Type → Enter Credentials → Test Connection →
Preview Data → Name Connection → Save
```

**Detailed Flow:**

1. **Source Selection**
   - GET `/api/data-sources/available` → shows 11 source types
   - Grid display with icons, names, descriptions
   - User selects → GET `/api/data-sources/schema/:sourceName`

2. **Configuration**
   - Frontend renders dynamic form from schema
   - Form fields: API keys, endpoints, credentials, options
   - Real-time validation (required fields, format checks)

3. **Test Connection**
   - POST `/api/data-sources/test` with config (doesn't save yet)
   - Backend attempts connection
   - Returns: `{ success: true/false, error?: string, metrics?: [...] }`
   - Visual feedback: Spinner → Green checkmark or Red X with error

4. **Preview Data**
   - If test succeeds → GET `/api/data-sources/preview/:sourceName` with config
   - Shows available metrics, sample values, last update times
   - User verifies expected data is available

5. **Save Configuration**
   - User names the connection (e.g., "Datadog Production")
   - POST `/api/data-sources` with final config
   - Backend saves to `config/data-sources.yaml`
   - Registers in data source registry
   - Success toast, return to data sources list

### Workflow 3: Widget Library → Dashboard

**User Journey:**
```
Open Widget Library → Browse/Search → Drag Widget → Position on Grid →
Configure Data Binding → Preview → Save
```

**Detailed Flow:**

1. **Browse Widgets**
   - GET `/api/widgets/templates` → loads widget library
   - Categories, search, filters applied client-side
   - Hover shows instant preview

2. **Add Widget**
   - User drags widget → grid shows placement preview (ghost outline)
   - Drop triggers widget config modal

3. **Configure Widget**
   - Modal shows:
     - Data source selector (dropdown of available sources)
     - Metric selector (filtered by selected source)
     - Widget-specific options (thresholds, colors, units)
   - Live preview panel updates as user types

4. **Save Widget**
   - Widget added to dashboard config (client-side state)
   - Grid re-renders with new widget
   - User saves dashboard → PUT `/api/dashboards/:id`

---

## API Endpoints

### Data Sources API

```
GET    /api/data-sources/available        List all source types
GET    /api/data-sources/schema/:source   Get config schema for source type
POST   /api/data-sources/test             Test connection (doesn't save)
POST   /api/data-sources                  Save new data source config
GET    /api/data-sources                  List all configured sources
GET    /api/data-sources/:id              Get single source config
PUT    /api/data-sources/:id              Update source config
DELETE /api/data-sources/:id              Delete source config
GET    /api/data-sources/preview/:source  Get sample data from source
```

### Templates API

```
GET    /api/templates                     List all templates (with ?category filter)
GET    /api/templates/:id                 Get full template config
POST   /api/templates                     Save new template
PUT    /api/templates/:id                 Update template
DELETE /api/templates/:id                 Delete template
GET    /api/templates/:id/preview         Generate preview thumbnail
```

### Themes API

```
GET    /api/themes                        List all themes
GET    /api/themes/:id                    Get theme config
POST   /api/themes                        Save custom theme
PUT    /api/themes/:id                    Update theme
DELETE /api/themes/:id                    Delete custom theme
GET    /api/preview/dashboard             Preview dashboard with theme
```

### Widgets API

```
GET    /api/widgets/templates             List all widget templates
GET    /api/widgets/categories            Get widget categories
```

---

## Error Handling

### Data Source Connection Failures

**Scenarios:**
- Invalid credentials (wrong API key, expired token)
- Network timeout (service unreachable)
- Partial data (connects but missing expected metrics)
- Rate limiting (too many test requests)

**Handling:**
- Visual feedback: Spinner → Success (green ✓) or Error (red ✗)
- Specific error messages: "API key invalid" vs. "Network timeout after 30s"
- Retry options: "Test Again" button
- Fallback: "Save Anyway" to save disconnected config
- Mock data mode: Offer to proceed with sample data

### Template Compatibility Issues

**Scenarios:**
- Missing data sources (template requires Datadog, user doesn't have it)
- Incompatible widget types (deprecated widgets)
- Grid size mismatch (template for 4×3, user has 2×2)

**Handling:**
- Pre-flight check: Detect missing sources, show warning
- Inline wizard: "Set up Datadog now?" → launches data source wizard
- Widget substitution: Replace deprecated widgets automatically
- Grid adaptation: Scale template to fit with preview
- Partial apply: "Apply available widgets, skip incompatible ones"

### Theme Rendering Issues

**Scenarios:**
- Color contrast failure (accessibility)
- Font size too small (unreadable on TV)
- Custom theme breaks layout

**Handling:**
- Accessibility validator: Warn if contrast < 4.5:1
- TV preview mode: Shows actual size with distance simulation
- Guardrails: Min/max limits on values
- Reset to defaults: One-click revert
- Preview before save: Always show result first

### Widget Configuration Errors

**Scenarios:**
- Invalid data binding (references non-existent metric)
- Threshold misconfiguration (min > max)
- Missing required fields

**Handling:**
- Real-time validation: Show errors as user types
- Visual indicators: Red borders, inline error messages
- Smart defaults: Pre-populate common configs
- Data source picker: Show only valid metrics
- Preview with errors: Show widget error state

### Performance & Scalability

**Edge Cases:**
- Large template library (100+ templates)
- Many data sources (50+ configured)
- Complex dashboards (30+ widgets)
- Slow connections (5+ second API calls)

**Handling:**
- Pagination: 20 templates at a time, infinite scroll
- Search/filter client-side: Load all, filter in browser
- Lazy loading: Widget previews load on-demand
- Loading states: Skeleton screens, spinners, progress bars
- Caching: Cache template previews, schemas (5-min TTL)
- Debouncing: Search inputs debounced to 300ms
- Background tasks: Large operations run async

### Data Persistence Failures

**Scenarios:**
- YAML write fails (permissions, disk full)
- Concurrent edits (two users edit same dashboard)
- Invalid configuration (manual YAML edit breaks schema)

**Handling:**
- Pre-save validation: Validate config before writing
- Backup on write: Existing backup system (10 backups)
- Lock mechanism: Optimistic locking, detect conflicts
- Rollback: "Restore from backup" in admin
- Schema validation: Reject invalid configs with clear errors
- Auto-save: Draft configs to localStorage every 30s

---

## Testing Strategy

### 1. Component Testing (Unit Tests)

**Framework:** Bun test

**Coverage:**
- Wizard Framework (navigation, validation, state, branching)
- Form Builder (dynamic forms, validation, errors)
- Data Source Connector (schema parsing, credentials, testing)
- Template Browser (filtering, search, sorting, preview)
- Theme Selector (theme application, TV preview, accessibility)
- Live Preview (widget rendering, sample data, responsive)

**Example:**
```javascript
describe('DataSourceConnector', () => {
  it('should validate credentials before testing', () => {
    const connector = new DataSourceConnector('datadog');
    expect(connector.validate({ apiKey: '' })).toBe(false);
    expect(connector.validate({ apiKey: 'abc123' })).toBe(true);
  });
});
```

### 2. Workflow Testing (Integration)

**Critical Workflows:**
- Create from Template (full end-to-end)
- Data Source Onboarding (select → config → test → save)
- Widget Library (browse → drag → configure → save)
- Theme Application (browse → preview → apply)

**Example:**
```javascript
describe('Create Dashboard from Template', () => {
  it('should complete full workflow', async () => {
    const template = await selectTemplate('devops-monitoring');
    const missing = checkRequiredSources(template);
    expect(missing).toContain('datadog');

    await configureDataSource('datadog', { apiKey: 'test-key' });
    await applyTheme('dark-high-contrast');

    const dashboard = await saveDashboard();
    expect(dashboard.id).toBeDefined();
  });
});
```

### 3. API Testing

**Framework:** Bun test with Elysia utilities

**Coverage:**
- Data Sources API (CRUD, testing, preview)
- Templates API (list, filter, load, save)
- Themes API (list, apply, custom)
- Widgets API (templates, categories)
- Preview API (dashboard rendering)

### 4. Visual Regression Testing

**Tools:** Playwright/Puppeteer for screenshots

**Coverage:**
- Template previews render correctly
- Theme gallery displays all themes
- TV preview mode (55", 65", 85")
- Widget library previews
- Responsive layouts

### 5. Performance Testing

**Metrics:**
- Template library load: < 2s for 100 templates
- Data source test: < 5s timeout
- Dashboard preview: < 3s
- Widget drag-drop: < 100ms
- Theme switching: < 500ms

**Load Testing:**
- 50+ data sources
- 100+ templates
- 30+ widgets per dashboard
- 5+ concurrent users

### 6. User Acceptance Testing

**Business User Scenarios:**
- "I want a sales dashboard" → < 5 minutes end-to-end
- "Add Salesforce data" → < 3 minutes

**Technical User Scenarios:**
- "Custom dashboard from scratch" → < 15 minutes
- "Debug data source connection" → < 5 minutes

**Accessibility:**
- Keyboard navigation for all workflows
- Screen reader announcements
- Color contrast WCAG AA (4.5:1)
- TV preview color blindness simulation

---

## Implementation Phases

### Phase 1: Component Library Foundation
- Wizard framework
- Form builder
- Live preview component
- Basic data source connector

### Phase 2: Data Source Onboarding
- Data source manager backend
- Connection testing
- Sample data preview
- All 11 sources configurable

### Phase 3: Template System
- Template browser UI
- Template metadata (categories, tags)
- Pre-built template library (10+ templates)
- Template preview generation

### Phase 4: Theme Engine
- Theme manager backend
- 5 TV-optimized themes
- Theme selector UI
- TV preview simulator
- Custom theme builder

### Phase 5: Workflow Integration
- Workflow engine
- Create from template workflow
- Data source onboarding workflow
- Widget library integration
- Enhanced admin shell

### Phase 6: Polish & Testing
- Visual regression tests
- Performance optimization
- Accessibility improvements
- Documentation
- User acceptance testing

---

## Success Metrics

**User Efficiency:**
- Dashboard creation time reduced by 75% (from 20 min → 5 min)
- Data source setup time < 3 minutes
- Template application time < 2 minutes

**Adoption:**
- 80% of new dashboards use templates
- All 11 data sources configured within 2 weeks
- 5+ custom themes created by users

**Quality:**
- Zero critical bugs in first month
- 100% of workflows have < 5s response time
- All themes pass WCAG AA accessibility

**TV Display:**
- Dashboards readable from 15 feet
- 100% uptime on TV rotation
- Positive feedback from office staff on visual impact

---

## Next Steps

1. Create implementation plan with writing-plans skill
2. Set up git worktree for isolated development
3. Build component library (Phase 1)
4. Implement workflows incrementally
5. Test and iterate with real users
6. Launch to production

---

**Design Status:** ✅ Approved - Ready for Implementation
