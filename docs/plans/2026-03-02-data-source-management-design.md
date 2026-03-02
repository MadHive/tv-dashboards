# Data Source Management UI Design

**Date:** 2026-03-02
**Status:** Approved
**Goal:** Create a web-based UI to configure, test, and manage all 17+ data source integrations

---

## Problem Statement

MadHive TV Dashboards currently supports 17 data source integrations (GCP, BigQuery, AWS, Salesforce, DataDog, Elasticsearch, HotJar, FullStory, Zendesk, Checkly, Chromatic, Looker, Rollbar, Rootly, Segment, VulnTrack, Mock). All configuration is done via `.env` environment variables, requiring:

- Manual editing of `.env` file on the server
- Server restarts to apply changes
- No visibility into connection status
- No audit trail of configuration changes
- No way to test connections before deployment

**User Request:** "I need a way to manage and maintain all of these data sources. Can we setup a UI interface that does this"

---

## Architecture Overview

### Storage Pattern: Hybrid Approach

**Sensitive Credentials** (stored in `.env`):
- API keys, access tokens, passwords, secrets
- Managed manually on server filesystem
- Loaded via `process.env` at runtime

**Non-Sensitive Configuration** (stored in SQLite):
- Regions, project IDs, timeouts, retry limits
- Enabled/disabled status
- User preferences, display settings

### Technology Stack

- **Database**: SQLite3 via Bun's native `bun:sqlite` module
- **Backend**: Elysia.js REST API + WebSocket for real-time updates
- **Frontend**: Vanilla JavaScript (matching existing codebase patterns)
- **Authentication**: Existing Google OAuth + admin role check

### Data Flow

```
User → OAuth Auth → Admin Role Check → Data Sources UI
                                              ↓
                        Fetch: schemas (API) + config (SQLite) + status (registry)
                                              ↓
                        Edit Non-Sensitive Config → Validate → Save SQLite
                                              ↓
                        Log Audit Entry → Reload Data Source → Broadcast Status
                                              ↓
                        WebSocket → Update All Connected Clients
```

---

## Database Schema

### Table: `data_source_configs`

```sql
CREATE TABLE data_source_configs (
  source_name TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  config_json TEXT,
  updated_at TEXT,
  updated_by TEXT
);
```

### Table: `config_audit_log`

```sql
CREATE TABLE config_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT,
  action TEXT,
  changes_json TEXT,
  user_email TEXT,
  timestamp TEXT
);

CREATE INDEX idx_audit_timestamp ON config_audit_log(timestamp);
CREATE INDEX idx_audit_source ON config_audit_log(source_name);
```

---

## Backend Components

### 1. Database Module (`server/db.js`)
- Initialize SQLite with `bun:sqlite`
- Create schema on startup
- Enable WAL mode for concurrency

### 2. Config Manager (`server/data-source-config.js`)
- `getConfig(sourceName)` - Merge .env + SQLite
- `updateConfig(sourceName, config, userEmail)` - Validate, save, audit
- `toggleEnabled(sourceName, enabled, userEmail)` - Enable/disable
- `getAuditLog(sourceName, limit)` - Retrieve history

### 3. API Endpoints
- `GET /api/data-sources/:name/config` - Get merged config
- `PUT /api/data-sources/:name/config` - Update non-sensitive config
- `POST /api/data-sources/:name/toggle` - Enable/disable
- `GET /api/data-sources/:name/history` - Audit log

### 4. Middleware
- `requireAdmin` - OAuth + role check

### 5. WebSocket
- `/ws/data-sources` - Real-time status updates

---

## Frontend Components

### 1. Main UI (`public/data-sources.html`)
- Card-based grid layout
- Each card shows: name, status badge, config summary
- Enable/disable toggle
- Configure and Test buttons

### 2. Configuration Modal
- Auto-generated form from schema
- Sensitive fields show "Configured via .env"
- Non-sensitive fields editable
- Test connection button

### 3. Admin Integration
- Add "Data Sources" tab to `/admin.html`
- Links to standalone page

### 4. JavaScript (`public/js/data-sources-app.js`)
- Fetch and render data sources
- Handle config updates
- Test connections
- WebSocket for real-time updates

### 5. Styling (`public/css/data-sources.css`)
- Responsive grid (3/2/1 columns)
- Status badges (green/red/gray)
- Toast notifications

---

## Security

1. **Credential Protection**: Never store sensitive fields in database
2. **Access Control**: Admin-only via OAuth
3. **Input Validation**: Schema-based validation, type checking
4. **Audit Trail**: Immutable log of all changes

---

## Implementation Timeline

- **Phase 1**: Database & Backend (2 days)
- **Phase 2**: Frontend UI (2 days)
- **Phase 3**: Real-Time & Polish (1 day)

**Total:** 5 days

---

## Success Criteria

- ✅ All 17 data sources visible with status
- ✅ Config changes apply without restart
- ✅ Complete audit trail
- ✅ Sensitive credentials never in database
- ✅ Admin-only access enforced
- ✅ Real-time status updates
