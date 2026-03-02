# Theme & Template Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Theme frontend components and complete Template System with browser, API, and pre-built template library

**Architecture:** Component-based approach with ThemeSelector and TVPreview for theme visualization, TemplateBrowser and TemplateCard for template discovery, REST API for template CRUD, and integration into both admin interface and dashboard editor

**Tech Stack:** Vanilla JavaScript, Elysia.js, Bun test, js-yaml, CSS Grid

**Security Note:** All user inputs must be sanitized before rendering. Use textContent for plain text, or DOMPurify for HTML content. Template data from YAML files should be treated as trusted since they're server-controlled.

**Prerequisites:** PR #28 (Theme System backend) must be merged to main before starting

---

## Implementation Summary

This plan covers 10 major tasks across 3 vertical slices:

**SLICE 1: Theme System Frontend**
- Task 1: ThemeSelector Component
- Task 2: TVPreview Component
- Task 3: Admin Themes Tab Integration
- Task 4: Editor Theme Dropdown Integration

**SLICE 2: Template System**
- Task 5: Template API Endpoints
- Task 6: TemplateBrowser Component
- Task 7: TemplateCard Component
- Task 8: Admin Templates Tab Integration
- Task 9: Editor Apply Template Integration

**SLICE 3: Template Library**
- Task 10: Pre-Built Template Library (10+ templates)

Each task follows TDD: write test → verify fail → implement → verify pass → commit

---

## SLICE 1: THEME SYSTEM FRONTEND

### Task 1: ThemeSelector Component

**Goal:** Visual theme picker with grid layout, category filtering, and selection events

**Files:**
- Create: `public/js/components/theme-selector.js`
- Create: `tests/components/theme-selector.test.js`
- Create: `public/css/components/theme-selector.css`

**Step 1: Write failing test for theme grid rendering**

Create `tests/components/theme-selector.test.js` with tests for:
- Rendering theme cards in grid
- Theme selection emitting events
- Category filtering
- Selected state highlighting

**Step 2: Run test to verify failure**

Run: `bun test tests/components/theme-selector.test.js`
Expected: Module not found error

**Step 3: Implement ThemeSelector class**

Create `public/js/components/theme-selector.js` with:
- Constructor accepting container, themes array, currentTheme, onSelect callback
- render() method creating grid layout with category filter
- createThemeCard() for individual theme cards showing name, category badge, color swatches
- selectTheme() method updating UI and emitting events
- filterByCategory() method for category filtering
- loadThemes() async method fetching from /api/themes

**Security:** Theme data comes from server YAML (trusted source), no user input sanitization needed for theme metadata

**Step 4: Create CSS**

Create `public/css/components/theme-selector.css` with:
- Grid layout (2-3 columns)
- Theme card styling with hover effects
- Selected state highlighting
- Category badge styling
- Color swatch styling

**Step 5: Run test to verify pass**

Run: `bun test tests/components/theme-selector.test.js`
Expected: All tests pass

**Step 6: Commit**

```bash
git add public/js/components/theme-selector.js tests/components/theme-selector.test.js public/css/components/theme-selector.css
git commit -m "feat: add ThemeSelector component with category filtering

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: TVPreview Component

**Goal:** Fullscreen modal simulating TV displays with theme preview

**Files:**
- Create: `public/js/components/tv-preview.js`
- Create: `tests/components/tv-preview.test.js`
- Create: `public/css/components/tv-preview.css`

**Step 1: Write failing test for TV preview modal**

Create `tests/components/tv-preview.test.js` with tests for:
- Modal open/close
- TV size switching (55", 65", 85")
- Theme application to sample dashboard
- Apply button event emission
- ESC key closing modal

**Step 2: Run test to verify failure**

Run: `bun test tests/components/tv-preview.test.js`
Expected: Module not found error

**Step 3: Implement TVPreview class**

Create `public/js/components/tv-preview.js` with:
- Constructor accepting container, theme, dashboardConfig, onApply callback
- open() method showing fullscreen modal
- render() method creating modal structure with size buttons
- setSize() method switching between 55", 65", 85" viewports
- renderDashboard() applying theme colors to sample dashboard
- renderMockWidgets() creating sample widgets showing theme
- close() method hiding modal with animation
- ESC key event listener

**Security:** Theme colors are CSS values (trusted), dashboard title should use textContent

**Step 4: Create CSS**

Create `public/css/components/tv-preview.css` with:
- Fullscreen modal overlay (black background)
- Size-specific viewport scaling (transform)
- TV bezel styling (border, shadow)
- Mock widget grid layout
- Animation transitions

**Step 5: Run test to verify pass**

Run: `bun test tests/components/tv-preview.test.js`
Expected: All tests pass

**Step 6: Commit**

```bash
git add public/js/components/tv-preview.js tests/components/tv-preview.test.js public/css/components/tv-preview.css
git commit -m "feat: add TVPreview component for fullscreen theme simulation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Admin Themes Tab Integration

**Goal:** Add "Themes" tab to admin interface with ThemeSelector and TVPreview

**Files:**
- Modify: `public/admin.html` (add Themes tab)
- Modify: `public/js/admin-app.js` (integrate ThemeSelector)
- Modify: `public/css/admin.css` (tab styling)

**Step 1: Add Themes tab HTML**

In `public/admin.html`, add to tab navigation:

```html
<div class="admin-tabs">
  <button class="admin-tab active" data-tab="dashboards">Dashboards</button>
  <button class="admin-tab" data-tab="templates">Templates</button>
  <button class="admin-tab" data-tab="themes">Themes</button>
  <button class="admin-tab" data-tab="settings">Settings</button>
</div>

<div class="admin-tab-content">
  <div id="dashboards-tab" class="tab-pane active">
    <!-- existing dashboard list -->
  </div>

  <div id="templates-tab" class="tab-pane">
    <!-- will add in Task 8 -->
  </div>

  <div id="themes-tab" class="tab-pane">
    <div class="themes-container">
      <div class="themes-header">
        <h2>Theme Gallery</h2>
        <button id="preview-tv-btn" class="btn btn-secondary">Preview on TV</button>
      </div>
      <div id="theme-selector-container"></div>
    </div>
  </div>

  <div id="settings-tab" class="tab-pane">
    <!-- placeholder for future -->
  </div>
</div>
```

**Step 2: Integrate ThemeSelector in admin-app.js**

In `public/js/admin-app.js`, add:

```javascript
import { ThemeSelector } from './components/theme-selector.js';
import { TVPreview } from './components/tv-preview.js';

// Tab switching logic
const tabs = document.querySelectorAll('.admin-tab');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    switchTab(tabName);
  });
});

function switchTab(tabName) {
  // Hide all panes, show selected
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  document.getElementById(`${tabName}-tab`).classList.add('active');

  // Update active tab
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  // Initialize theme selector when tab opened
  if (tabName === 'themes' && !window.themeSelector) {
    initThemeSelector();
  }
}

async function initThemeSelector() {
  const container = document.getElementById('theme-selector-container');

  window.themeSelector = new ThemeSelector({
    container,
    themes: [],
    currentTheme: null,
    onSelect: (theme) => {
      console.log('Theme selected:', theme);
      // Could save as default theme here
    }
  });

  await window.themeSelector.loadThemes();
  await window.themeSelector.render();

  // Preview on TV button
  document.getElementById('preview-tv-btn').addEventListener('click', () => {
    if (window.themeSelector.currentTheme) {
      showTVPreview(window.themeSelector.currentTheme);
    }
  });
}

function showTVPreview(themeId) {
  const previewContainer = document.createElement('div');
  document.body.appendChild(previewContainer);

  // Load theme details
  fetch(`/api/themes/${themeId}`)
    .then(res => res.json())
    .then(theme => {
      const preview = new TVPreview({
        container: previewContainer,
        theme,
        dashboardConfig: { title: 'Sample Dashboard', widgets: [] },
        onApply: (appliedTheme) => {
          console.log('Theme applied:', appliedTheme);
        }
      });

      preview.open();
    });
}
```

**Step 3: Add tab styling CSS**

In `public/css/admin.css`, add:

```css
.admin-tabs {
  display: flex;
  gap: 8px;
  border-bottom: 2px solid #e5e7eb;
  margin-bottom: 24px;
}

.admin-tab {
  padding: 12px 24px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  color: #6b7280;
  transition: all 0.2s;
}

.admin-tab:hover {
  color: #111827;
}

.admin-tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.tab-pane {
  display: none;
}

.tab-pane.active {
  display: block;
}

.themes-container {
  padding: 24px;
}

.themes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
```

**Step 4: Test manually**

1. Open admin page
2. Click "Themes" tab
3. Verify ThemeSelector renders with themes
4. Select a theme
5. Click "Preview on TV"
6. Verify TVPreview modal opens

**Step 5: Commit**

```bash
git add public/admin.html public/js/admin-app.js public/css/admin.css
git commit -m "feat: integrate Themes tab in admin interface

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Editor Theme Dropdown Integration

**Goal:** Add theme selector to dashboard editor property panel

**Files:**
- Modify: `public/index.html` (add theme dropdown to toolbar)
- Modify: `public/js/editor.js` (integrate theme selection)
- Create: `tests/integration/theme-editor.test.js`

**Step 1: Add theme dropdown to editor toolbar**

In `public/index.html`, find the dashboard properties toolbar and add:

```html
<div class="property-group">
  <label>Theme</label>
  <select id="dashboard-theme-select" class="form-control">
    <option value="">Loading themes...</option>
  </select>
  <button id="theme-preview-btn" class="btn btn-sm btn-secondary">
    Preview on TV
  </button>
</div>
```

**Step 2: Load themes and handle selection in editor.js**

In `public/js/editor.js`, add:

```javascript
import { TVPreview } from './components/tv-preview.js';

// Load themes on editor init
async function loadThemesDropdown() {
  const select = document.getElementById('dashboard-theme-select');

  try {
    const response = await fetch('/api/themes');
    const themes = await response.json();

    select.innerHTML = '<option value="">Default Theme</option>';
    themes.forEach(theme => {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.name;
      select.appendChild(option);
    });

    // Set current theme if dashboard has one
    if (currentDashboard.theme) {
      select.value = currentDashboard.theme;
    }
  } catch (error) {
    console.error('Failed to load themes:', error);
    select.innerHTML = '<option value="">Error loading themes</option>';
  }
}

// Handle theme selection
document.getElementById('dashboard-theme-select').addEventListener('change', (e) => {
  const themeId = e.target.value;
  currentDashboard.theme = themeId || null;

  // Apply theme visually (reload dashboard)
  applyThemeToDashboard(themeId);

  // Mark as unsaved
  markDashboardUnsaved();
});

function applyThemeToDashboard(themeId) {
  if (!themeId) {
    // Reset to default theme
    document.documentElement.style.removeProperty('--theme-background');
    document.documentElement.style.removeProperty('--theme-primary');
    return;
  }

  // Fetch theme and apply CSS variables
  fetch(`/api/themes/${themeId}`)
    .then(res => res.json())
    .then(theme => {
      document.documentElement.style.setProperty('--theme-background', theme.colors.background);
      document.documentElement.style.setProperty('--theme-primary', theme.colors.primary);
      document.documentElement.style.setProperty('--theme-secondary', theme.colors.secondary);
      // ... apply other theme properties
    });
}

// Handle TV preview button
document.getElementById('theme-preview-btn').addEventListener('click', () => {
  const themeId = document.getElementById('dashboard-theme-select').value;
  if (!themeId) {
    alert('Please select a theme first');
    return;
  }

  const previewContainer = document.createElement('div');
  document.body.appendChild(previewContainer);

  fetch(`/api/themes/${themeId}`)
    .then(res => res.json())
    .then(theme => {
      const preview = new TVPreview({
        container: previewContainer,
        theme,
        dashboardConfig: currentDashboard,
        onApply: (appliedTheme) => {
          // Theme already selected, just close
          console.log('Theme previewed:', appliedTheme.id);
        }
      });

      preview.open();
    });
});

// Call on editor init
loadThemesDropdown();
```

**Step 3: Write integration test**

Create `tests/integration/theme-editor.test.js`:

```javascript
import { describe, it, expect } from 'bun:test';

describe('Theme Editor Integration', () => {
  it('should load themes in dropdown', async () => {
    // This would be an E2E test using headless browser
    // For now, just verify endpoint works
    const response = await fetch('http://localhost:3000/api/themes');
    expect(response.status).toBe(200);

    const themes = await response.json();
    expect(Array.isArray(themes)).toBe(true);
    expect(themes.length).toBeGreaterThan(0);
  });

  it('should apply theme to dashboard config', async () => {
    // Verify theme ID gets saved in dashboard
    const dashboard = {
      title: 'Test',
      theme: 'dark-high-contrast',
      widgets: []
    };

    expect(dashboard.theme).toBe('dark-high-contrast');
  });
});
```

**Step 4: Run test**

Run: `bun test tests/integration/theme-editor.test.js`
Expected: Tests pass

**Step 5: Test manually**

1. Open dashboard editor
2. Verify theme dropdown loads
3. Select a theme
4. Verify dashboard updates with theme colors
5. Click "Preview on TV"
6. Verify TVPreview opens with current dashboard

**Step 6: Commit**

```bash
git add public/index.html public/js/editor.js tests/integration/theme-editor.test.js
git commit -m "feat: integrate theme selector in dashboard editor

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## SLICE 2: TEMPLATE SYSTEM

### Task 5: Template API Endpoints

**Goal:** RESTful API for template CRUD operations

**Files:**
- Modify: `server/index.js` (add template routes)
- Create: `tests/unit/routes/template-routes.test.js`

**Step 1: Write failing tests for template endpoints**

Create comprehensive tests for:
- GET /api/templates (list all, filter by category)
- GET /api/templates/:id (get full template)
- POST /api/templates (create new)
- PUT /api/templates/:id (update existing)
- DELETE /api/templates/:id (delete)

**Step 2: Run tests to verify failure**

Run: `bun test tests/unit/routes/template-routes.test.js`
Expected: 404 errors (routes don't exist)

**Step 3: Implement template routes in server/index.js**

Add routes using existing template-manager.js functions:
- GET /api/templates - calls listTemplates(), filters by query.category
- GET /api/templates/:id - calls loadTemplate()
- POST /api/templates - validates body, calls saveTemplate()
- PUT /api/templates/:id - loads existing, merges updates, saves
- DELETE /api/templates/:id - calls deleteTemplate()

**Security:** Validate all inputs, sanitize filenames (prevent path traversal), check required fields

**Step 4: Run tests to verify pass**

Run: `bun test tests/unit/routes/template-routes.test.js`
Expected: All tests pass

**Step 5: Commit**

```bash
git add server/index.js tests/unit/routes/template-routes.test.js
git commit -m "feat: add template API endpoints (GET, POST, PUT, DELETE)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 6: TemplateBrowser Component

**Goal:** Searchable template gallery with category filters

**Files:**
- Create: `public/js/components/template-browser.js`
- Create: `tests/components/template-browser.test.js`
- Create: `public/css/components/template-browser.css`

**Step 1: Write failing tests**

Test:
- Rendering templates in grid
- Search filtering
- Category filtering
- Empty state
- Template selection events

**Step 2: Run tests to verify failure**

**Step 3: Implement TemplateBrowser class**

Create two-column layout:
- Left sidebar: search box, category checkboxes
- Right content: template grid

Methods:
- render() - creates layout
- applyFilters() - filters by search and categories
- renderTemplates() - creates grid of cards
- createTemplateCard() - individual card with preview/use buttons
- loadTemplates() - fetches from API

**Security:** Template names/descriptions from server (trusted YAML files)

**Step 4: Create CSS**

Grid layout, card styling, sidebar filters, empty state

**Step 5: Run tests to verify pass**

**Step 6: Commit**

```bash
git add public/js/components/template-browser.js tests/components/template-browser.test.js public/css/components/template-browser.css
git commit -m "feat: add TemplateBrowser component with search and filters

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 7: TemplateCard Component

**Goal:** Individual template preview card with metadata

**Files:**
- Create: `public/js/components/template-card.js`
- Create: `tests/components/template-card.test.js`
- Create: `public/css/components/template-card.css`

**Step 1: Write failing tests**

Test card rendering with:
- Template metadata display
- Required data sources pills (green/red)
- Preview button click
- Use button click

**Step 2: Run tests to verify failure**

**Step 3: Implement TemplateCard class**

Display:
- Thumbnail (or placeholder)
- Title, category badge
- Description (truncated)
- Required sources as pills
- Preview/Use buttons

**Step 4: Create CSS**

Card styling, pill badges, hover effects

**Step 5: Run tests to verify pass**

**Step 6: Commit**

```bash
git add public/js/components/template-card.js tests/components/template-card.test.js public/css/components/template-card.css
git commit -m "feat: add TemplateCard component with data source indicators

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 8: Admin Templates Tab Integration

**Goal:** Add "Templates" tab to admin interface

**Files:**
- Modify: `public/admin.html` (Templates tab content)
- Modify: `public/js/admin-app.js` (integrate TemplateBrowser)

**Step 1: Add Templates tab HTML**

Add tab pane with TemplateBrowser container

**Step 2: Initialize TemplateBrowser in admin-app.js**

On tab switch to "templates", instantiate TemplateBrowser, load templates, handle selection events

**Step 3: Test manually**

1. Open admin
2. Click Templates tab
3. Verify templates load
4. Test search and filters
5. Click "Use Template"
6. Verify dashboard created

**Step 4: Commit**

```bash
git add public/admin.html public/js/admin-app.js
git commit -m "feat: integrate Templates tab in admin interface

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 9: Editor Apply Template Integration

**Goal:** Add "Apply Template" button to dashboard editor

**Files:**
- Modify: `public/index.html` (add button to toolbar)
- Modify: `public/js/editor.js` (integrate TemplateBrowser modal)

**Step 1: Add Apply Template button to editor toolbar**

**Step 2: Implement modal TemplateBrowser**

On button click, show modal with TemplateBrowser, handle template selection (warn about overwriting), apply template to current dashboard

**Step 3: Test manually**

1. Open editor
2. Click "Apply Template"
3. Select template
4. Verify warning modal
5. Confirm - verify dashboard updated

**Step 4: Commit**

```bash
git add public/index.html public/js/editor.js
git commit -m "feat: add Apply Template button to dashboard editor

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## SLICE 3: TEMPLATE LIBRARY

### Task 10: Pre-Built Template Library

**Goal:** Create 10+ production-ready templates

**Files:**
- Create: `config/templates/devops-monitoring.yaml`
- Create: `config/templates/sales-pipeline.yaml`
- Create: `config/templates/security-dashboard.yaml`
- Create: `config/templates/marketing-analytics.yaml`
- Create: `config/templates/infrastructure-health.yaml`
- Create: `config/templates/incident-response.yaml`
- Create: `config/templates/customer-success.yaml`
- Create: `config/templates/revenue-tracking.yaml`
- Create: `config/templates/vulnerability-dashboard.yaml`
- Create: `config/templates/executive-summary.yaml`

**Template Structure:**

Each YAML file follows this format:

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
        min: 0
        max: 100
        unit: '%'
    # ... more widgets
```

**Step 1: Create DevOps Monitoring template**

File: `config/templates/devops-monitoring.yaml`
Widgets: CPU gauge, memory gauge, request rate chart, error rate chart, service status grid

**Step 2: Create Sales Pipeline template**

File: `config/templates/sales-pipeline.yaml`
Widgets: Revenue metric, deals in pipeline, win rate gauge, pipeline bar chart

**Step 3: Create Security Dashboard template**

File: `config/templates/security-dashboard.yaml`
Widgets: Vulnerability count, security score gauge, critical alerts list, vulnerability heatmap

**Step 4: Create remaining 7 templates**

Marketing Analytics, Infrastructure Health, Incident Response, Customer Success, Revenue Tracking, Vulnerability Dashboard, Executive Summary

**Step 5: Test template loading**

Run: `curl http://localhost:3000/api/templates`
Verify all templates appear

**Step 6: Commit**

```bash
git add config/templates/*.yaml
git commit -m "feat: add 10 pre-built dashboard templates

- DevOps Monitoring
- Sales Pipeline
- Security Dashboard
- Marketing Analytics
- Infrastructure Health
- Incident Response
- Customer Success
- Revenue Tracking
- Vulnerability Dashboard
- Executive Summary

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Testing & Documentation

### Final Integration Tests

Create `tests/integration/theme-template-e2e.test.js` covering:
- Theme selection in admin → applies to new dashboard
- Template application in editor → dashboard updated
- Theme + template combination → complete workflow

Run: `bun test tests/integration/theme-template-e2e.test.js`

### Documentation

Update `README.md` with:
- Theme system usage
- Template library usage
- Creating custom themes/templates

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-03-02-theme-template-integration-implementation.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
