# Admin Studio Design
**Date:** 2026-03-02
**Status:** Approved
**Scope:** Redesign `/admin` as a unified WYSIWYG dashboard studio

---

## Problem

The current admin experience is fragmented and broken:
- `/admin` handles dashboard CRUD but the edit button navigates to `/` with `?edit=true` which is never read
- The visual editor at `/` is gated behind Google OAuth which is disabled — making it permanently inaccessible
- `Ctrl+E` is intercepted by the browser before reaching the page
- No visible affordance to enter edit mode
- pm2 and systemd were both running the server simultaneously (fixed)
- Chromium kiosk was loading extensions (1Password) causing 150 processes (fixed)

## Goals

- One place (`/admin`) for all dashboard management and editing
- WYSIWYG live canvas — no separate navigation to edit widgets
- Working widget editing: add/remove, rearrange, resize, change data source/query
- No auth gate — small trusted team of engineers
- The TV display at `/` remains clean and read-only

## Non-Goals

- New data source integrations (GCP, BigQuery, VulnTrack are sufficient for now)
- User authentication or role-based access control
- Mobile/responsive admin layout

---

## Layout

Three-panel studio layout:

```
┌─────────────────────────────────────────────────────────────────┐
│  ◈ MadHive Studio        [Unsaved ●]   [Discard] [Save] [TV ↗] │
├──────────────┬──────────────────────────────────┬───────────────┤
│  DASHBOARDS  │                                  │  PROPERTIES   │
│  ──────────  │                                  │  ───────────  │
│  ◉ Platform  │      Live Canvas                 │  (dashboard   │
│  ○ Security  │   (scaled WYSIWYG preview,       │   or widget   │
│  ○ BigQuery  │    click=select, drag=move,      │   properties) │
│  ○ VulnTrack │    handles=resize)               │               │
│              │                                  │               │
│  + New       │                                  │               │
│  ──────────  │                                  │               │
│  🎨 Themes   │                                  │               │
│  ⚙ Settings  │                                  │               │
└──────────────┴──────────────────────────────────┴───────────────┘
                         [+ Add Widget]
```

---

## Components

### Top Bar
- Studio logo/name
- Unsaved changes indicator (`●` dot when dirty)
- Discard button — reverts in-memory config to last saved state
- Save button — writes to `dashboards.yaml` via `PUT /api/dashboards/:id`
- "View on TV" link — opens `/` in a new tab

### Left Sidebar

**Dashboards section**
- Lists all dashboards from `/api/config` as clickable rows (name + widget count)
- Active dashboard highlighted
- Hover reveals delete button (with confirmation)
- `+ New Dashboard` — inline form: name, subtitle, icon picker, grid columns/rows

**Themes section**
- Compact color swatch grid for all available themes
- Click to apply live to canvas
- One-click save via `PUT /api/themes/active`

**Settings section**
- Global config form: rotation interval, refresh interval, dashboard title
- Save button writes global section to `dashboards.yaml`

### Center Canvas

- Renders the active dashboard using the same `widgets.js` / `charts.js` / `charts.js` code as the TV view
- Scaled with CSS `transform: scale()` to fit the available pane — always true WYSIWYG
- Edit overlay layer sits above the rendered widgets:
  - Click → selects widget (blue highlight border)
  - Drag → repositions widget in grid (reuses `editor-drag.js` logic)
  - Edge handles → resize colSpan/rowSpan (reuses `editor-resize.js` logic)
- `+ Add Widget` button in the canvas footer opens a widget palette:
  - Pick widget type (all 12 types with icons)
  - Set title, data source, query
  - Drops widget onto the grid at the next available position

### Right Properties Panel

Context-sensitive — updates based on selection:

**No selection → Dashboard properties**
- Name, subtitle, icon picker
- Grid: columns, rows, gap

**Widget selected → four collapsible sections**
1. **Basic** — Title, Widget Type dropdown. Changing type re-renders widget live.
2. **Data** — Source dropdown (GCP, BigQuery, VulnTrack, Mock), Query dropdown from `queries.yaml`. `+ New Query` opens query editor modal.
3. **Position** — Col, Row, ColSpan, RowSpan as number inputs. Canvas updates live.
4. **Display** — Unit, Min, Max, warning threshold, critical threshold (shown only for applicable widget types: gauge, progress-bar, big-number).

Delete Widget button (red, confirmation) at panel bottom.

---

## Data Flow

```
User edit in panel/canvas
        ↓
In-memory config clone (modifiedConfig) — no file writes
        ↓
Canvas re-renders affected widget immediately
        ↓
[Save] clicked → PUT /api/dashboards/:id
        ↓
dashboards.yaml updated (with auto-backup)
        ↓
TV at / picks up changes on next data refresh (8s interval)
```

Unsaved changes are never visible on the TV. The TV always reads from the saved YAML.

---

## Auth

Remove the `isAuthenticated` gate entirely. The editor toggle button and all editor controls are always visible and accessible. The studio at `/admin` is open — security is handled at the network level (internal network only).

---

## Reused Code

| Existing file | Reuse |
|---|---|
| `widgets.js` | Canvas widget rendering |
| `charts.js` | Chart rendering in canvas |
| `editor-drag.js` | Widget drag-to-reposition |
| `editor-resize.js` | Widget resize handles |
| `editor-panel.js` | Properties panel logic (adapted) |
| `query-editor.js` | Inline query creation |
| `admin-api.js` | Dashboard CRUD API calls |
| `theme-selector.js` | Theme swatches in sidebar |

---

## New Files

| File | Purpose |
|---|---|
| `public/studio.html` | Studio shell (replaces `admin.html`) |
| `public/js/studio.js` | Studio controller (layout, state, sidebar) |
| `public/js/studio-canvas.js` | Canvas rendering + edit overlay |
| `public/css/studio.css` | Studio layout and styling |

The old `admin.html` / `admin-app.js` / `admin-components.js` are replaced by the studio.

---

## Success Criteria

- Can create a new dashboard from scratch in the studio
- Can add, remove, move, and resize widgets without leaving `/admin`
- Can change a widget's data source and query and see it update in the canvas
- Save persists to `dashboards.yaml` and the TV picks it up within 8 seconds
- No auth prompts — studio is always accessible
- Chromium kiosk process count stays under 20 (extensions disabled)
