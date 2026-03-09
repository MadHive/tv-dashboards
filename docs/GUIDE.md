# MadHive TV Dashboards — Admin & User Guide

## Table of Contents

1. [Overview](#overview)
2. [URLs & Access](#urls--access)
3. [TV Display — User Guide](#tv-display--user-guide)
4. [Studio — Admin Guide](#studio--admin-guide)
   - [Dashboard Management](#dashboard-management)
   - [Widget Editor](#widget-editor)
   - [Query Management](#query-management)
   - [Query Explorer](#query-explorer)
   - [Data Sources](#data-sources)
   - [Import from GCP](#import-from-gcp)
   - [Themes & Settings](#themes--settings)
5. [Widget Types Reference](#widget-types-reference)
6. [Data Sources Reference](#data-sources-reference)
7. [Server Administration](#server-administration)

---

## Overview

MadHive TV Dashboards is a real-time monitoring system consisting of two surfaces:

- **TV Display** (`/`) — A read-only, full-screen slideshow that rotates through dashboards on a TV or kiosk. No editing tools are exposed.
- **MadHive Studio** (`/admin`) — A WYSIWYG editor for building, configuring, and arranging dashboards and widgets.

Data is pulled live from GCP Cloud Monitoring, BigQuery, and VulnTrack. All configuration is stored in `config/dashboards.yaml` and `config/queries.yaml`.

---

## URLs & Access

| Surface | URL | Purpose |
|---|---|---|
| TV Display | `http://tv.madhive.local/` | Read-only kiosk view |
| Studio | `http://tv.madhive.local/admin` | Dashboard editor |
| GCP Import | `http://tv.madhive.local/admin/import` | Import charts from GCP |
| Data Sources | `http://tv.madhive.local/data-sources.html` | Manage data source credentials |
| API Docs | `http://tv.madhive.local:3000/openapi` | Full API reference (Scalar UI) |

---

## TV Display — User Guide

The TV Display is the read-only view intended for wall-mounted screens and kiosks. It rotates through all configured dashboards automatically.

### Layout

- **Top bar** — Shows the MadHive logo, the current dashboard name/subtitle, active data source, last refresh time, and clock.
- **Main area** — Renders the current dashboard's widget grid.
- **Bottom bar** — Navigation dots (one per dashboard) and a pause button. A progress bar shows time remaining before advancing.

### Controls

| Action | How |
|---|---|
| Pause / resume rotation | Click the pause button (bottom-right), or press `Space` |
| Go to next dashboard | Press the right arrow key |
| Go to previous dashboard | Press the left arrow key |
| Jump to a specific dashboard | Click the corresponding dot in the bottom bar |

### Automatic Behavior

- Dashboards rotate on a configurable interval (default: 30 seconds per dashboard).
- Widget data refreshes automatically on a separate interval (default: 60 seconds).
- A pulsing green dot next to "last refresh" confirms data is live.
- Map dashboards (Campaign Delivery) display animated particle flows over a dark USA map using Mapbox GL JS with GPU acceleration.

---

## Studio — Admin Guide

The Studio (`/admin`) is a three-panel WYSIWYG editor:

```
[ Sidebar ] | [ Canvas ] | [ Properties ]
```

- **Sidebar** (left) — Three tabs: Dashboards, Queries, Sources.
- **Canvas** (center) — Live preview of the selected dashboard. Drag, resize, and arrange widgets here.
- **Properties** (right) — Edit the selected widget or dashboard's settings.

### Top Bar Actions

| Button | Action |
|---|---|
| **Import from GCP** | Open the GCP import wizard |
| **Unsaved** indicator | Appears when you have uncommitted changes |
| **Discard** | Revert all unsaved changes |
| **Save** | Write changes to `dashboards.yaml` |
| **View on TV** | Open the TV display in a new tab |

---

### Dashboard Management

#### Viewing Dashboards

The **Dashboards** tab in the sidebar lists all dashboards in TV rotation order. Each entry shows a thumbnail canvas preview. Click a dashboard to load it into the canvas for editing.

#### Creating a Dashboard

1. Click the **+** button next to the "DASHBOARDS" section header.
2. Fill in:
   - **Name** — Display name shown on the TV top bar.
   - **Subtitle** — Secondary label (e.g., "Real-Time Activity").
   - **Cols / Rows** — Grid dimensions (1–12 each).
   - **Icon** — Choose from Bolt, Grid, Server, Flow, Data, Shield, Map.
3. Click **Create**.

#### Reordering Dashboards

Drag dashboard cards in the sidebar to change the TV rotation order. The order is saved when you click **Save**.

#### Editing Dashboard Properties

Click an empty area of the canvas (not a widget) to show dashboard-level properties in the right panel:

- **Name** and **Subtitle**
- **Columns** and **Rows** — Resize the grid.
- **Gap (px)** — Spacing between widget cells.

#### Global Settings (Rotation & Refresh)

Expand the **SETTINGS** section in the sidebar:

- **Rotation (s)** — Seconds each dashboard stays on screen before advancing.
- **Refresh (s)** — How often widget data is re-fetched from data sources.

---

### Widget Editor

#### Selecting a Widget

Click any widget on the canvas. It gets a pink outline and its properties appear in the right panel.

#### Dragging a Widget

Click and drag a selected widget to reposition it. A grid overlay appears; the cell snaps to the nearest grid position. If a cell is occupied, the target turns red and the drop is blocked.

#### Resizing a Widget

Grab the resize handle (bottom-right corner of a selected widget) and drag to change its column span and/or row span. A live badge shows the current W x H while dragging.

#### Widget Properties Panel

The right panel has the following sections when a widget is selected:

**Basic**
- **Title** — Label shown at the top of the widget.
- **Type** — Widget rendering type (see Widget Types Reference below).

**Data**
- **Data Summary** — Shows the current source and query powering the widget.
- **Change Source** — Switch between GCP Cloud Monitoring, BigQuery, VulnTrack, or Mock.
- **Browse GCP Metrics** — Opens the GCP Metric Browser modal (GCP source only).
- **Change Query** — Select a saved query to assign to this widget.
- **+ New Query** — Create a new query inline and assign it.

**Position** (read-only display; drag is the canonical way to move)
- Col, Row, Col Span, Row Span — Can be edited directly as a fallback.

**Display**
- **Unit** — Suffix label (e.g., `ms`, `%`, `req/s`).
- **Min / Max** — Scale range for gauges and progress bars.
- **Warn / Crit** — Threshold values that trigger yellow/red coloring.

**Map Config** (usa-map widgets only)
- Time Window, Min Impressions, Primary Metric, Zoom Cycle.

**Map GL Config** (usa-map-gl widgets only)
- Color Scheme (Brand, Cool, Warm), Particle density, Animation speed, Leaderboard visibility, Base style, Zip visualization mode.

#### Adding a Widget

1. Click **+ Add Widget** in the canvas footer (requires a dashboard to be selected).
2. Choose a widget type from the palette grid.
3. Fill in title, source, and query.
4. Click **Add to Dashboard**.

#### Deleting a Widget

Select the widget and click **Delete Widget** at the bottom of the Properties panel.

---

### Query Management

The **Queries** tab in the sidebar lists all 46+ saved queries, grouped by data source (GCP, BigQuery, Computed). Each entry shows the query name and metric type.

#### Viewing a Query

Click any query in the list. The **Query Editor** panel opens on the right, showing:
- Query name and source badge.
- Metric type or SQL.
- Time window and aggregation settings (GCP) or SQL text (BigQuery).
- A **Run** button to execute and preview results.
- Preview rendered as any widget type.

#### Editing a Query

1. Open the query from the Queries tab.
2. Modify the metric type, time window, aggregation, or SQL.
3. Click **Run** to verify results.
4. Click **Save Query** to persist changes.

#### Creating a New Query

- From the Queries tab: click the **Explorer** button to open the Query Explorer.
- From the widget Properties panel: click **+ New Query**.

#### Assigning a Query to a Widget

After viewing or editing a query, click **Assign to Widget** to apply it to the currently selected canvas widget.

---

### Query Explorer

The Query Explorer is a full-featured query builder and tester. Open it via the **Explorer** button in the Queries tab toolbar.

The Explorer has three columns:

**Left — Builder**
- **Source** — GCP Metrics, BigQuery, or Computed Functions.
- GCP fields: Metric Type, Project, Time Window, Aligner, Reducer, Period, Filters.
- BigQuery fields: SQL textarea + Schema browser (pick dataset and table to browse columns).
- Computed fields: select a built-in function and pass optional JSON params.
- Click **Run Query** to execute.

**Center — Raw Results**
- Displays the raw JSON response or error message from the query.

**Right — Widget Preview**
- Choose a widget type and see a live rendered preview of the data.
- Set Unit and Max for display tuning.

**Bottom Action Bar**
- **Export CSV** — Download raw results as a CSV file.
- **Save as Query** — Persist the current query to `queries.yaml`.
- **Assign to Widget** — Apply to the currently selected canvas widget.

#### GCP Metric Browser (within Explorer and Studio)

Click **Browse** in the Explorer's metric type field, or **Browse GCP Metrics** in the widget Properties panel.

The browser shows:
- Left: 9,000+ GCP metrics grouped by service (Cloud Run, BigQuery, Pub/Sub, Kubernetes, Bigtable, etc.).
- Right: Metric list for the selected service. Click a metric to select it.
- Bottom config strip: Time Window, Aggregation, and **Apply to Widget** button.
- Top search bar: Free-text search across metric names, types, and descriptions.

---

### Data Sources

The **Sources** tab lists all connected data sources with a status dot:

- Green dot — Connected and ready.
- Red dot — Disconnected or credential error.
- Grey dot — Not configured.

#### Editing Credentials

Click any data source. The Data Source Editor opens on the right:

1. **Query list view** (default) — Shows all queries assigned to this source.
2. Click **Edit Credentials** to switch to the credential form.
3. Fill in the required API keys or tokens.
4. Click **Save Credentials** — writes to `.env` and hot-reloads without a server restart.
5. Click **Test Connection** to verify connectivity.

Supported configurable sources: Datadog, AWS, VulnTrack, Elasticsearch, Salesforce, Checkly, Hotjar, FullStory, Zendesk, Looker, Rollbar, Rootly, Segment, Chromatic, BigQuery.

---

### Import from GCP

Access via the **Import from GCP** button in the Studio top bar, or navigate directly to `/admin/import`.

This 3-panel tool lets you pull existing GCP Cloud Monitoring dashboards into the TV system:

1. **Left panel** — Lists all GCP dashboards in the selected project. Use the search box to filter. Switch projects with the selector in the top bar.
2. **Center panel** — Shows all chart tiles within the selected GCP dashboard. Check boxes to select which charts to import.
3. **Right panel** — Live preview of the selected tile rendered as a TV widget.

After selecting tiles, confirm the import. The charts are mapped to TV widget types and saved to `dashboards.yaml`.

---

### Themes & Settings

Expand the **THEMES** section in the sidebar (Dashboards tab) to browse and apply color themes to the current dashboard. Themes control background, text, accent, and border colors.

The **SETTINGS** section controls global TV rotation timing:

| Setting | Description |
|---|---|
| Title | Dashboard title override (rarely needed) |
| Rotation (s) | Seconds per dashboard in the slideshow |
| Refresh (s) | Data fetch interval for all widgets |

---

## Widget Types Reference

| Type | Best For | Notes |
|---|---|---|
| `big-number` | Single KPI values | Large font, optional sparkline |
| `stat-card` | KPI with trend arrow | Shows delta vs previous period |
| `gauge` | Percentage or bounded value | Circular arc gauge |
| `gauge-row` | Multiple gauges in a row | Good for comparing services |
| `bar-chart` | Distribution or comparison | Horizontal or vertical bars |
| `progress-bar` | Percentage completion | Linear bar with threshold coloring |
| `status-grid` | Many services at a glance | Color-coded health grid |
| `alert-list` | Active alerts / incidents | Scrollable list with severity |
| `service-heatmap` | Activity over time per service | Color intensity by value |
| `pipeline-flow` | End-to-end data pipeline | Animated flow diagram |
| `usa-map` | Geographic impression delivery | Canvas-based, zoom-cycle support |
| `usa-map-gl` | Geographic delivery (GPU) | Mapbox GL JS, animated particles |
| `security-scorecard` | Vulnerability / security posture | VulnTrack data source |
| `line-chart` | Time series trends | Multiple series support |
| `table` | Tabular data | Scrollable, sortable |
| `multi-metric-card` | Multiple KPIs in one card | 2–4 metrics with labels |
| `stacked-bar-chart` | Proportional breakdown | Stacked segments by category |

---

## Data Sources Reference

| Source Key | System | Authentication |
|---|---|---|
| `gcp` | GCP Cloud Monitoring | Service account JSON (`GOOGLE_APPLICATION_CREDENTIALS`) |
| `bigquery` | BigQuery | Same service account, `mad-data` project |
| `vulntrack` | VulnTrack API | `VULNTRACK_API_KEY` |
| `datadog` | Datadog | `DATADOG_API_KEY` + `DATADOG_APP_KEY` |
| `mock` | Local mock data | No credentials needed |
| `computed` | Server-side functions | Internal (campaign delivery maps) |

GCP projects available: `mad-master`, `mad-data`, `mad-audit`, `mad-looker-enterprise`.

---

## Server Administration

The TV dashboard system runs as a systemd service on the display machine.

### Service Management

```bash
# Restart after code changes
sudo systemctl restart tv-dashboards

# Check status and recent logs
sudo systemctl status tv-dashboards
journalctl -u tv-dashboards -n 50

# Follow logs live
journalctl -u tv-dashboards -f
```

### When to Restart

| Change | Restart needed? |
|---|---|
| Edit `server/index.js` or server JS | Yes |
| Edit `public/js/*.js` or HTML | Yes (cache bust via `?v=N` query string) |
| Edit `config/dashboards.yaml` via Studio Save | No — hot-reloaded |
| Edit `config/queries.yaml` via Studio Save | No — hot-reloaded |
| Save credentials via Studio Sources tab | No — hot-reloaded |
| Change `.env` manually | Yes |

### Config Files

| File | Purpose |
|---|---|
| `config/dashboards.yaml` | All dashboards and widget definitions |
| `config/queries.yaml` | All named saved queries |
| `.env` | API keys, GCP credentials, feature flags |
| `data/tv-dashboards.db` | SQLite DB — data source configs and audit log |

### Database

```bash
# Open Drizzle Studio web UI
bun run db:studio
# Opens at http://tv:4983
```

### Backups

The Studio automatically creates timestamped backups before any save:

```
config/dashboards.yaml.backup.YYYY-MM-DDTHH-MM-SS
config/queries.yaml.backup.YYYY-MM-DDTHH-MM-SS
```

Backup files are gitignored and local-only. To restore:

```bash
cp config/dashboards.yaml.backup.2026-03-09T12-00-00 config/dashboards.yaml
sudo systemctl restart tv-dashboards
```
