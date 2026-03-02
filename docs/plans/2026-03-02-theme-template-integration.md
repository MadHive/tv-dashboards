# Theme & Template Integration Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to implement this design.

**Date:** 2026-03-02
**Status:** Approved
**Goal:** Implement Theme frontend components and complete Template System with browser, API, and pre-built library

---

## Vision

Enable staff to easily apply TV-optimized themes and discover pre-built templates for rapid dashboard creation - accessible from both admin interface and dashboard editor.

---

## Context

**Already Complete:**
- ✅ Component Library Foundation - wizard-framework.js, form-builder.js, live-preview.js, data-source-connector.js (merged to main)
- ✅ Theme Manager backend - CRUD operations for themes (PR #28, awaiting merge)
- ✅ Theme API endpoints - REST API for themes (PR #28, awaiting merge)
- ✅ Template Manager backend - saveTemplate, listTemplates, loadTemplate, deleteTemplate functions (partial)

**This Design Implements:**
- Theme frontend components (theme-selector, tv-preview)
- Template API endpoints (REST CRUD operations)
- Template frontend components (template-browser, template-card, widget-library)
- Pre-built template library (10+ production templates)
- Integration into admin interface and dashboard editor

**Implementation Sequencing:**
- Wait for PR #28 (Theme System backend) to merge to main
- Build Theme frontend + Template System on main branch
- Deliver in 3 vertical slices for incremental value

---

## Architecture Overview

### Three-Tier System

**Backend Layer:**
- **Theme Manager** (exists in PR #28) - CRUD operations for themes
- **Template Manager** (partially exists) - Add REST API endpoints for CRUD
- **Template Library** - YAML files in `config/templates/` with metadata

**Component Layer:**
- **Theme Components:**
  - `theme-selector.js` - Grid of theme cards with live previews
  - `tv-preview.js` - Simulates 55", 65", 85" TV displays with sample dashboard
  - `color-picker.js` - Custom theme builder (optional, future phase)

- **Template Components:**
  - `template-browser.js` - Searchable gallery with category filters
  - `template-card.js` - Template preview card with thumbnail, metadata
  - `widget-library.js` - Drag-and-drop widget catalog

**Integration Layer:**
- Admin interface (`admin.html`) - Add "Themes" and "Templates" tabs
- Dashboard editor (`index.html`) - Add theme dropdown + "Apply Template" button
- Editor property panel - Theme selector in dashboard properties

### File Structure

```
public/js/components/
  ├── theme-selector.js        (new)
  ├── tv-preview.js            (new)
  ├── color-picker.js          (new, optional/future)
  ├── template-browser.js      (new)
  ├── template-card.js         (new)
  └── widget-library.js        (new)

server/
  ├── theme-manager.js         (exists in PR #28)
  └── template-manager.js      (exists, needs API routes)

config/
  ├── themes.yaml              (exists in PR #28)
  └── templates/               (exists empty, needs templates)
      ├── devops-monitoring.yaml
      ├── sales-pipeline.yaml
      ├── security-dashboard.yaml
      ├── marketing-analytics.yaml
      ├── infrastructure-health.yaml
      ├── incident-response.yaml
      ├── customer-success.yaml
      ├── revenue-tracking.yaml
      ├── vulnerability-dashboard.yaml
      └── executive-summary.yaml
```

---

## Component Specifications

### Theme Components

#### ThemeSelector (`theme-selector.js`)

**Purpose:** Visual theme picker with live previews

**Features:**
- Grid layout (2-3 columns on desktop, 1 column on mobile)
- Theme cards showing:
  - Theme name
  - Category badge (TV-Optimized, Professional, Operations, Custom)
  - Color swatches (background, primary, secondary)
  - Mini preview on hover
- Category filter dropdown
- Selected state with checkmark and border highlight
- Emits `theme-selected` event with theme object

**Props:**
- `currentTheme` (string) - Currently selected theme ID
- `onSelect` (callback) - Called when user selects theme

**Example Usage:**
```javascript
const selector = new ThemeSelector({
  currentTheme: 'dark-high-contrast',
  onSelect: (theme) => {
    applyTheme(theme.id);
  }
});
```

#### TVPreview (`tv-preview.js`)

**Purpose:** Full-screen TV display simulator

**Features:**
- Full-screen modal
- Three TV size presets:
  - 55" (1920×1080)
  - 65" (3840×2160)
  - 85" (3840×2160)
- Size selector buttons at top
- Loads sample dashboard with selected theme
- Real widgets with mock data (not screenshots)
- Viewing distance simulation (10 feet away effect)
- "Close" and "Apply Theme" buttons

**Props:**
- `themeId` (string) - Theme to preview
- `dashboardConfig` (object) - Dashboard to simulate

**Example Usage:**
```javascript
const preview = new TVPreview({
  themeId: 'neon-cyberpunk',
  dashboardConfig: sampleDashboard
});
preview.open();
```

#### ColorPicker (`color-picker.js`)

**Purpose:** Custom theme builder for power users

**Status:** Optional - defer to future phase if time constrained

---

### Template Components

#### TemplateBrowser (`template-browser.js`)

**Purpose:** Searchable template gallery

**Layout:**
- Two-column: filters sidebar (left) + template grid (right)
- Responsive: stacks on mobile

**Filters Sidebar:**
- Search box (filters by name, description, tags)
- Category checkboxes:
  - DevOps
  - Sales
  - Security
  - Marketing
  - Custom
- Data source filter (show only templates with available sources)

**Template Grid:**
- 3-column responsive grid (2 on tablet, 1 on mobile)
- Contains TemplateCard components
- Empty state: "No templates match your filters"

**Events:**
- Emits `template-selected` event with template object

**Props:**
- `availableDataSources` (array) - List of configured data sources
- `onSelect` (callback) - Called when user selects template

**Example Usage:**
```javascript
const browser = new TemplateBrowser({
  availableDataSources: ['gcp', 'datadog', 'vulntrack'],
  onSelect: (template) => {
    createDashboardFromTemplate(template);
  }
});
```

#### TemplateCard (`template-card.js`)

**Purpose:** Individual template preview card

**Display:**
- Thumbnail image (or placeholder if not available)
- Title
- Category badge
- Description (truncated to 2 lines)
- Required data sources as pills:
  - Green pill if data source available
  - Red pill if data source missing
- "Preview" button
- "Use Template" button

**Visual:**
- Hover effect: subtle shadow and scale
- Card border highlight when focused

**Props:**
- `template` (object) - Template data
- `availableDataSources` (array) - List of configured sources
- `onPreview` (callback) - Called when "Preview" clicked
- `onUse` (callback) - Called when "Use Template" clicked

**Example Usage:**
```javascript
const card = new TemplateCard({
  template: devOpsTemplate,
  availableDataSources: ['gcp', 'datadog'],
  onPreview: (template) => showPreview(template),
  onUse: (template) => createDashboard(template)
});
```

#### WidgetLibrary (`widget-library.js`)

**Purpose:** Categorized widget catalog for drag-and-drop

**Categories:**
- Metrics (big numbers, stat cards, gauges)
- Charts (bar, line, heatmaps)
- Status (alert lists, service grids, progress bars)
- Flows (pipeline diagrams, sankey charts)
- Maps (USA maps, geographic heatmaps)
- Security (scorecards, vulnerability tables)

**Layout:**
- Accordion or tabbed interface for categories
- Each widget shows:
  - Icon
  - Name
  - Description
  - Sample preview image

**Interactions:**
- Drag-and-drop support (drag widget into dashboard grid)
- "Add to Dashboard" quick button
- Hover preview shows larger image

**Props:**
- `onWidgetAdd` (callback) - Called with widget config when added

**Example Usage:**
```javascript
const library = new WidgetLibrary({
  onWidgetAdd: (widgetConfig) => {
    addWidgetToDashboard(widgetConfig);
  }
});
```

---

## Data Flow & Integration

### Theme System Data Flow

**Loading Themes:**
```
Admin/Editor → GET /api/themes → ThemeSelector component → User selects → theme-selected event
```

**Applying Theme to Dashboard:**
```
User selects theme → themeId stored in dashboard config → Server applies theme colors/fonts when rendering → Dashboard displays with theme
```

**TV Preview Flow:**
```
User clicks "Preview" → TVPreview component loads → GET /api/themes/:id → Apply to sample dashboard → Render in fullscreen modal
```

### Template System Data Flow

**Loading Templates:**
```
Admin/Editor → GET /api/templates → TemplateBrowser component → Filter/search → Display filtered TemplateCards
```

**Using Template:**
```
User clicks "Use Template" → POST /api/dashboards with template.dashboard → New dashboard created → Redirect to editor
```

**Template Preview:**
```
User clicks "Preview" → Load template.dashboard config → Apply current theme → Render in modal with mock data
```

### Integration Points

#### Admin Interface (`admin.html`)

**Add Tabbed Navigation:**
- Dashboards (existing)
- Templates (new)
- Themes (new)
- Settings (existing/placeholder)

**Templates Tab:**
- Full-screen TemplateBrowser component
- "Create Custom Template" button (saves current dashboard as template)

**Themes Tab:**
- ThemeSelector component
- "Preview on TV" button → opens TVPreview modal
- "Create Custom Theme" button (future: opens ColorPicker)

**Existing Dashboards Tab:**
- Unchanged - keep current dashboard list and CRUD operations

#### Dashboard Editor (`index.html` / Visual Editor)

**Top Toolbar Additions:**
- **Theme Dropdown** - Shows current theme, clicking opens ThemeSelector modal
- **"Apply Template" Button** - Opens TemplateBrowser modal with warning about overwriting

**Property Panel:**
- Add "Theme" section in dashboard properties
- Dropdown shows current theme
- Change triggers theme application to dashboard

**User Flow:**
1. User editing dashboard clicks "Theme" dropdown
2. ThemeSelector modal opens
3. User selects theme, clicks "Apply"
4. Dashboard re-renders with new theme
5. Theme ID saved to dashboard config

### REST API Endpoints

**Theme Endpoints (already exist in PR #28):**
```
GET    /api/themes              - List all themes
GET    /api/themes/categories   - Get unique categories
GET    /api/themes/default      - Get default theme
GET    /api/themes/:id          - Get specific theme
POST   /api/themes              - Create new theme
PUT    /api/themes/:id          - Update theme
DELETE /api/themes/:id          - Delete theme
```

**Template Endpoints (NEW - to implement):**
```
GET    /api/templates              - List all templates (optional ?category= filter)
GET    /api/templates/:id          - Get specific template by ID
POST   /api/templates              - Create new template
PUT    /api/templates/:id          - Update template
DELETE /api/templates/:id          - Delete template
POST   /api/templates/:id/preview  - Generate preview screenshot (optional/future)
```

**Template Endpoint Details:**

**GET /api/templates**
- Query params: `?category=DevOps` (optional)
- Response: Array of template metadata (name, description, category, author, requiredSources, createdAt)
- Does NOT include full dashboard config (too heavy)

**GET /api/templates/:id**
- Param: `id` (sanitized filename without .yaml extension)
- Response: Full template object including dashboard config
- 404 if not found

**POST /api/templates**
- Body: `{ name, description, category, dashboard, metadata }`
- Validates required fields
- Sanitizes name for filename
- Saves to `config/templates/<sanitized-name>.yaml`
- Returns created template

**PUT /api/templates/:id**
- Param: `id` (existing template ID)
- Body: Template object (partial updates allowed)
- Validates and saves
- Returns updated template
- 404 if not found

**DELETE /api/templates/:id**
- Param: `id` (template to delete)
- Deletes file from `config/templates/`
- Returns success status
- 404 if not found

---

## Error Handling

### Theme System Error Scenarios

**Failed to load themes:**
- Display error message in ThemeSelector: "Unable to load themes. Please refresh the page."
- Fallback: Use default theme (dark-high-contrast)
- Log error to console with context

**Theme not found:**
- If selected theme ID doesn't exist, fall back to default theme
- Show warning toast: "Selected theme not found, using default"
- Update dashboard config to use default theme ID

**TV Preview fails to render:**
- Show error message in modal: "Preview unavailable"
- Provide "Close" button to dismiss
- Don't block user from selecting theme

### Template System Error Scenarios

**Failed to load templates:**
- Display error message in TemplateBrowser: "Unable to load templates"
- Provide "Retry" button
- Show empty state if no templates available after successful load

**Missing required data sources:**
- Highlight missing sources in red pills on TemplateCard
- Show warning modal when user clicks "Use Template":
  - "This template requires [DataSource1, DataSource2]. Configure these data sources first?"
  - "Configure Data Sources" button → redirect to data source setup
  - "Use Anyway" button → create dashboard with placeholder widgets

**Template has invalid structure:**
- Validate template schema before displaying in browser
- Skip invalid templates silently
- Log warning to console with details
- Show admin notification: "X templates failed to load"

**Applying template fails:**
- Show error toast: "Failed to create dashboard from template"
- Keep user in template browser
- Log detailed error for debugging
- Suggest retry or contact support

### General Error Principles

**Graceful Degradation:**
- Never block entire UI
- Isolate failures to component level
- Provide fallbacks where possible

**User-Friendly Messages:**
- No technical jargon
- Clear next steps
- Actionable suggestions

**Retry Mechanisms:**
- Provide "Retry" buttons for network failures
- Auto-retry with exponential backoff (optional)

**Logging:**
- Console.error with context for debugging
- Include relevant IDs, states, and error details

**Loading States:**
- Show spinners during API calls
- Disable buttons to prevent double-submission
- Provide cancel option for long operations

---

## Testing Strategy

### Component Unit Tests

**Theme Components:**

`tests/components/theme-selector.test.js`
- Test rendering with valid themes array
- Test category filtering
- Test selection events emit correct theme object
- Test empty state when no themes available
- Test error state when API call fails
- Test keyboard navigation
- Test accessibility (ARIA attributes)

`tests/components/tv-preview.test.js`
- Test modal open/close
- Test size switching (55", 65", 85")
- Test theme application to sample dashboard
- Test "Apply" button event
- Test error handling when theme not found
- Test escape key closes modal

`tests/components/color-picker.test.js`
- Defer to future phase

**Template Components:**

`tests/components/template-browser.test.js`
- Test rendering with template list
- Test search filtering (name, description, tags)
- Test category filtering
- Test data source filtering
- Test empty state
- Test error state
- Test template selection event

`tests/components/template-card.test.js`
- Test rendering with complete template data
- Test rendering with missing thumbnail
- Test required data sources display (green/red pills)
- Test "Preview" button click
- Test "Use Template" button click
- Test hover effects

`tests/components/widget-library.test.js`
- Test category display
- Test widget selection
- Test "Add to Dashboard" button
- Test drag-and-drop (if implemented)
- Test search/filter within library

### API Endpoint Tests

`tests/unit/routes/template-routes.test.js`

**Success Cases:**
- GET /api/templates - returns array of templates
- GET /api/templates?category=DevOps - returns filtered templates
- GET /api/templates/:id - returns full template object
- POST /api/templates - creates new template, returns 201
- PUT /api/templates/:id - updates template, returns updated object
- DELETE /api/templates/:id - deletes template, returns 204

**Error Cases:**
- GET /api/templates/:id - returns 404 for missing template
- POST /api/templates - returns 400 for missing required fields
- POST /api/templates - returns 400 for invalid data
- PUT /api/templates/:id - returns 404 for missing template
- DELETE /api/templates/:id - returns 404 for missing template

**Validation:**
- POST validates required fields (name, dashboard)
- POST sanitizes filename (no special characters, path traversal)
- POST validates category is from allowed list
- PUT validates partial updates

**Edge Cases:**
- Empty template list returns []
- Malformed YAML files are skipped gracefully
- Special characters in names are sanitized
- Duplicate names generate unique filenames

### Integration Tests

**End-to-End Theme Workflow:**

`tests/integration/theme-workflow.test.js`
1. Load admin page
2. Verify "Themes" tab exists
3. Click "Themes" tab
4. Verify ThemeSelector renders with themes
5. Select theme
6. Verify selection state updates
7. Click "Preview on TV"
8. Verify TVPreview modal opens
9. Verify theme applied to sample dashboard
10. Click "Apply"
11. Verify theme-selected event fires
12. Apply theme to dashboard
13. Verify dashboard config updated with theme ID

**End-to-End Template Workflow:**

`tests/integration/template-workflow.test.js`
1. Load admin page
2. Verify "Templates" tab exists
3. Click "Templates" tab
4. Verify TemplateBrowser renders
5. Verify templates display as cards
6. Search for template by name
7. Verify filtered results
8. Click "Use Template"
9. Verify warning modal if data sources missing
10. Proceed with template usage
11. Verify new dashboard created
12. Open dashboard in editor
13. Verify widgets match template

### Test Coverage Goals

- **Components:** 80%+ coverage (all user interactions tested)
- **API Routes:** 100% coverage (all endpoints, all status codes)
- **Integration:** Critical user paths covered

### Testing Tools

- **Bun Test** - Unit tests (already in use)
- **DOM Testing** - Use existing helpers from `tests/helpers/browser.js`
- **Mocking** - Mock fetch calls for API endpoints
- **Fixtures** - Sample themes/templates in `tests/fixtures/`

---

## Implementation Approach: Vertical Slices

### Slice 1: Complete Theme System Frontend

**Deliverables:**
- ThemeSelector component
- TVPreview component
- Admin "Themes" tab integration
- Editor theme dropdown integration
- Component tests
- Integration tests

**Value:** Users can browse, preview, and apply themes to dashboards

---

### Slice 2: Complete Template System

**Deliverables:**
- Template API endpoints (GET, POST, PUT, DELETE)
- TemplateBrowser component
- TemplateCard component
- Admin "Templates" tab integration
- Editor "Apply Template" button integration
- API route tests
- Component tests
- Integration tests

**Value:** Users can browse and apply templates to create dashboards

---

### Slice 3: Pre-Built Template Library & Widget Catalog

**Deliverables:**
- 10+ production templates in `config/templates/`:
  - devops-monitoring.yaml
  - sales-pipeline.yaml
  - security-dashboard.yaml
  - marketing-analytics.yaml
  - infrastructure-health.yaml
  - incident-response.yaml
  - customer-success.yaml
  - revenue-tracking.yaml
  - vulnerability-dashboard.yaml
  - executive-summary.yaml
- WidgetLibrary component
- Widget catalog integration into editor
- Template documentation

**Value:** Rich template library for instant dashboard creation

---

## Pre-Built Template Structure

Each template YAML file follows this structure:

```yaml
name: DevOps Monitoring
description: Real-time service health and performance metrics
category: DevOps
tags:
  - gcp
  - cloud-run
  - performance
requiredSources:
  - gcp
  - datadog
recommendedTheme: dark-high-contrast
author: MadHive
createdAt: '2026-03-02'
dashboard:
  title: DevOps Monitoring
  icon: bolt
  refreshInterval: 30
  widgets:
    - id: cpu-usage
      type: gauge
      title: CPU Usage
      source: gcp
      position: { col: 1, row: 1, colSpan: 2, rowSpan: 2 }
      config:
        queryId: gcp-cpu-usage
        min: 0
        max: 100
        unit: '%'
        thresholds:
          - { value: 80, color: 'warning' }
          - { value: 90, color: 'error' }
    # ... more widgets
```

**Template Categories:**
- **DevOps:** Service health, performance monitoring, infrastructure
- **Sales:** Pipeline metrics, revenue tracking, CRM dashboards
- **Security:** Vulnerability tracking, incident monitoring, compliance
- **Marketing:** Campaign metrics, web analytics, social media
- **Custom:** User-created templates

---

## Success Criteria

**Functionality:**
- Users can browse and apply themes from admin and editor ✅
- Users can preview themes on simulated TV displays ✅
- Users can browse and apply templates ✅
- Users can filter templates by category and data sources ✅
- Missing data sources are clearly indicated ✅
- All API endpoints work correctly ✅

**Quality:**
- 80%+ component test coverage ✅
- 100% API route test coverage ✅
- Critical user paths tested end-to-end ✅
- Error handling graceful and user-friendly ✅
- Loading states prevent double-submission ✅

**User Experience:**
- Theme selection is intuitive and visual ✅
- TV preview accurately simulates display ✅
- Template browser is easy to search and filter ✅
- Missing data sources don't block usage (with warning) ✅
- Integration into admin and editor feels seamless ✅

---

## Future Enhancements

**Not in this design (defer to later):**
- ColorPicker component for custom theme creation
- Template preview screenshot generation
- Template thumbnail auto-generation
- Template versioning
- Template sharing/import/export
- Widget drag-and-drop in WidgetLibrary
- Theme customization (color tweaking)
- Template recommendations based on data sources

---

**Design Status:** ✅ Approved - Ready for Implementation Planning
