# Dashboard Management Admin Interface - Design Document

**Date:** 2026-02-27
**Project:** MadHive TV Dashboards
**Feature:** Dashboard/Page Management System

## Overview

This document outlines the design for a comprehensive dashboard management interface that enables both technical and business users to create, edit, delete, and manage TV dashboard pages (currently 11 pages like "Platform Overview", "Services Health", etc.) through a dedicated admin interface.

## Problem Statement

Currently, dashboard pages must be managed by directly editing `config/dashboards.yaml`. While a WYSIWYG editor exists for managing widgets within dashboards, there is no user-friendly interface for managing the dashboards/pages themselves. Staff members (both technical and non-technical) need the ability to:

- Create new dashboard pages
- Edit existing dashboard properties (name, subtitle, icon, grid configuration)
- Delete dashboard pages
- Reorder dashboards in rotation
- Duplicate dashboards as templates
- Import/export dashboards
- View version history and restore previous versions
- Perform bulk operations on multiple dashboards

## User Requirements

**Target Users:**
- **Technical Users** (developers/ops): Comfortable with configuration, need access to all features
- **Business Users** (managers/analysts): Need simple, guided interface with minimal technical concepts

**Key Requirement:** Support both user types through progressive disclosure - simple by default, advanced features available when needed.

## Design Decisions

### 1. Architecture: Hybrid Admin Interface

**Approach:** Create a dedicated admin page at `/admin` that's separate from the widget editor, but shares backend APIs and common utility modules.

**Why this approach:**
- Widget editing is spatial (drag, resize, position)
- Dashboard management is organizational (list, create, configure, bulk actions)
- Fundamentally different interactions require different UIs
- Allows optimization for each use case while sharing infrastructure

**Architecture Layers:**

```
Frontend Layer:
├── /admin (new admin SPA)
├── Vanilla JavaScript (consistent with codebase)
├── Progressive disclosure UI
└── Responsive layout

Backend Layer:
├── Extended Elysia.js server
├── New API endpoints for dashboard CRUD
├── Reuse config-manager, template-manager, backups
└── Add dashboard versioning/history

Shared Modules:
├── Common validation utilities
├── Shared API client
├── Common CSS variables
└── Shared error handling
```

**File Structure:**

```
public/
├── admin.html                 # Admin interface entry point
├── css/
│   └── admin.css             # Admin-specific styles
└── js/
    ├── admin-app.js          # Main admin application
    ├── admin-api.js          # API client (shared utilities)
    └── admin-components.js   # Reusable UI components

server/
├── dashboard-manager.js      # New: Dashboard CRUD operations
└── dashboard-history.js      # New: Version tracking
```

### 2. User Interface Design

**Main Dashboard List View:**

- **Layout:** Table/card hybrid showing all dashboards
- **Columns:** Name, Subtitle, Icon, Widget Count, Last Modified, Actions
- **Quick Actions:** Edit, Duplicate, Delete, Export (per row)
- **Bulk Selection:** Checkboxes for multi-dashboard operations
- **Search/Filter:** Filter by name, icon, date range
- **Sort Controls:** By name, date, widget count
- **Primary Action:** "Create Dashboard" button (top right)

**Progressive Disclosure:**

*Simple View (Default):*
- Essential fields: Name, Subtitle, Icon selector
- Grid size dropdown: Small (2x2), Medium (3x2), Large (4x3), Custom
- Basic actions: Save, Cancel, Delete

*Advanced Options (Expandable):*
- Custom grid configuration (columns, rows, gap)
- Rotation settings (include in rotation, custom interval)
- Metadata (ID override, tags, description)
- Raw YAML view
- Dashboard-specific refresh intervals

**Create/Edit Dashboard Form:**

- Modal overlay or side panel
- Live preview thumbnail showing grid layout
- Template selection: New from scratch, Copy existing, Use template
- Optional step-by-step wizard for business users
- One-click "Edit Widgets" button → opens dashboard in WYSIWYG editor

**Bulk Operations:**

- Multi-select via checkboxes
- Bulk actions: Delete, Export (ZIP), Duplicate, Reorder
- Confirmation dialogs with preview of affected items

### 3. Data Flow & API Design

**New API Endpoints:**

```
# Dashboard Management
GET    /api/dashboards              # List all dashboards with metadata
GET    /api/dashboards/:id          # Get single dashboard
POST   /api/dashboards              # Create new dashboard
PUT    /api/dashboards/:id          # Update dashboard
DELETE /api/dashboards/:id          # Delete dashboard
POST   /api/dashboards/:id/duplicate # Duplicate dashboard
POST   /api/dashboards/reorder      # Update dashboard order
POST   /api/dashboards/bulk-delete  # Delete multiple dashboards
POST   /api/dashboards/bulk-export  # Export multiple as ZIP

# Dashboard History/Versioning
GET    /api/dashboards/:id/history  # Get version history
POST   /api/dashboards/:id/restore  # Restore to specific version
GET    /api/dashboards/:id/diff     # Compare versions

# Dashboard Templates
GET    /api/dashboard-templates     # List available templates
POST   /api/dashboards/from-template # Create from template
```

**Data Flow:**

1. **Load Admin Page** → Fetch all dashboards → Display in table/grid
2. **Create Dashboard** → Show form → Validate → POST to API → Update YAML → Refresh list
3. **Edit Dashboard** → Load config → Show form → Save → Update YAML → Backup old version
4. **Delete Dashboard** → Confirm → DELETE API → Update YAML → Create backup → Refresh
5. **Bulk Operations** → Collect IDs → Confirm → Batch API calls → Update YAML → Refresh

**State Management:**

- Admin app maintains local state of dashboard list
- Optimistic updates for better UX (update UI immediately, rollback on error)
- Optional auto-refresh on changes from other users (polling or WebSocket)
- Undo/redo stack for bulk operations

**Backup Strategy:**

- Reuse existing backup system (keeps last 10 backups)
- Create backup before destructive operations (delete, bulk-delete)
- Version history per dashboard (last 5 versions)
- Automatic backup on save (timestamped)

### 4. Error Handling & Validation

**Validation Rules:**

*Dashboard Creation/Editing:*
- **ID:** Unique, lowercase, alphanumeric + hyphens only (auto-generated from name if not provided)
- **Name:** Required, 1-50 characters
- **Subtitle:** Optional, max 100 characters
- **Icon:** Must be one of: bolt, grid, map, data, flow, shield, palette
- **Grid:** Columns (1-6), Rows (1-6), Gap (0-30px)
- **Widgets:** Must be valid array (can be empty for new dashboards)

*Business Rules:*
- Cannot delete a dashboard if it's the only one remaining
- Cannot create duplicate IDs (even if one is soft-deleted)
- Grid size must accommodate all existing widgets when editing
- Dashboard order must be sequential (1, 2, 3... no gaps)

**Error Handling:**

*User-Facing Errors:*
- Inline validation (red borders, error messages below fields)
- Toast notifications for success/error (top-right, auto-dismiss)
- Confirmation dialogs for destructive actions
- Detailed error messages (e.g., "Dashboard 'Platform Overview' cannot be deleted: it contains 7 widgets")

*Technical Errors:*
- API failures: Retry with exponential backoff (max 3 attempts)
- Network errors: Show "offline" banner, queue operations
- YAML parsing errors: Prevent save, show detailed error with line number
- Validation errors: Block submit, highlight problematic fields

*Edge Cases:*
- Concurrent edits: Last write wins (with warning to user)
- Large operations: Show progress indicator for bulk operations
- Backup restoration: Warn if restoring will overwrite current changes
- Import conflicts: Offer options (replace, merge, skip)

### 5. Testing Strategy

**Backend Tests:**
- Dashboard Manager: CRUD operations, validation, error cases
- Dashboard History: Version tracking, restore operations, diff generation
- API Endpoints: Request/response validation, error codes
- Backup System: Automatic backups, restoration, cleanup
- YAML Integrity: Config parsing, writing, format preservation

**Frontend Tests:**
- Form Validation: Field validation, inline errors, submit prevention
- API Integration: Mock API responses, error handling, retry logic
- Bulk Operations: Multi-select, bulk actions, progress tracking
- Progressive Disclosure: Show/hide advanced options, state persistence
- Search/Filter: Filter logic, sort operations, pagination

**Integration Tests:**
- Create dashboard → Edit widgets in WYSIWYG → Save → Verify in admin
- Import dashboard → Validate → Add to list
- Delete dashboard → Verify backup created → Restore from backup
- Bulk export → Download ZIP → Import elsewhere

**Manual Testing:**
- Business user flow: Create simple dashboard with wizard
- Technical user flow: Use advanced options, custom grid, raw YAML
- Edge cases: Network failures, concurrent edits, large bulk operations
- Browser compatibility: Chrome, Firefox, Safari (desktop)
- Accessibility: Keyboard navigation, screen reader support (basic)

**Test Implementation:**
- Reuse patterns from existing `test-phase*.js` files
- Create `test-dashboard-admin.js` for backend tests
- Browser-based testing for frontend
- Test data: Pre-built dashboards with various configurations

### 6. Implementation Phases

**Phase 1: Core Infrastructure (Foundation)**
- Create `dashboard-manager.js` backend module
- Extract shared utilities from editor (`admin-api.js`)
- Implement basic dashboard CRUD APIs
- Set up admin page routing and HTML structure
- Basic list view with read-only display

**Phase 2: Dashboard Management (Core Features)**
- Create/Edit dashboard forms with validation
- Delete operations with confirmation
- Dashboard duplication
- Reorder functionality (drag-drop or up/down buttons)
- Template selection for new dashboards

**Phase 3: Advanced Features (Power Users)**
- Progressive disclosure implementation
- Advanced grid configuration
- Raw YAML editor view
- Custom metadata fields
- Integration with WYSIWYG editor (seamless transition)

**Phase 4: Bulk Operations & Import/Export**
- Multi-select and bulk delete
- Bulk export (individual files or ZIP)
- Import dashboard(s) from JSON/YAML
- Conflict resolution UI

**Phase 5: History & Versioning**
- Dashboard history tracking
- Version comparison (diff view)
- Restore from history
- Backup management UI

## Deployment & Rollout

**Deployment Considerations:**
- **No breaking changes:** All existing dashboards continue to work
- **Backward compatibility:** New features are additive
- **Migration:** None needed, existing YAML works as-is
- **Rollout:** Can deploy incrementally (phase by phase)
- **Access:** Initially accessible to all users at `/admin`, add auth later if needed

**Success Criteria:**
- Business users can create/edit dashboards without touching YAML
- Technical users can access all advanced features when needed
- All operations complete in < 2 seconds (excluding large bulk exports)
- Zero data loss (backups for all destructive operations)
- Works in Chrome, Firefox, Safari (desktop)

## Future Enhancements

*(Not in initial scope - can be added later based on feedback)*

- Authentication/authorization (OAuth)
- Real-time collaboration (multiple users editing)
- Dashboard analytics (view counts, popular widgets)
- Scheduled dashboard rotation (different schedules for different times)
- Dashboard sharing/publishing (public URLs)
- Audit logs (who changed what when)
- Role-based access control
- Dashboard categories/folders

## Technical Constraints

- Must maintain vanilla JavaScript approach (no frameworks)
- Must preserve existing YAML format and structure
- Must reuse existing backup/restore infrastructure
- Must work on remote server environment (SSH access)
- Must support both business and technical users equally

## Dependencies

**Existing Systems:**
- `config-manager.js` - YAML configuration management
- `template-manager.js` - Template system
- Backup system (keeps last 10 backups)
- Widget editor integration

**New Dependencies:**
- None - using vanilla JavaScript and existing Elysia.js patterns

## Open Questions

*(To be resolved during implementation)*

- Exact visual design for admin interface (colors, spacing, layout)
- Specific icons for dashboard types
- Default grid sizes for templates
- Auto-save vs manual save for edits
- Notification strategy (toast position, duration)

## Approval & Next Steps

**Design Status:** ✅ Approved
**Next Step:** Create implementation plan using writing-plans skill

**Stakeholders:**
- User: Approved design
- Development: Ready to implement

---

*This design document serves as the blueprint for implementing the Dashboard Management Admin Interface. Implementation details will be further refined in the implementation plan.*
