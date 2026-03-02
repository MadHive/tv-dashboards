# Data Source Management UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build web-based UI to configure, test, and manage 17 data source integrations with SQLite storage and real-time updates.

**Architecture:** Hybrid storage (credentials in .env, config in SQLite), Elysia.js REST API, admin-only OAuth access, vanilla JavaScript frontend.

**Tech Stack:** Bun SQLite, Elysia.js, Vanilla JS, OAuth

---

## Implementation Plan

This implementation is divided into 10 tasks across 4 phases. Each task includes exact file paths, complete code, test commands, and commit messages.

**Estimated Time:** 5 days (2 days backend, 2 days frontend, 1 day testing)

---

## Phase 1: Database Foundation (Day 1-2)

### Task 1: Database Module
- Create `server/db.js` with SQLite initialization
- Create tables: `data_source_configs`, `config_audit_log`
- Enable WAL mode for concurrency
- Write unit tests for schema creation

### Task 2: Config Manager
- Create `server/data-source-config.js` with CRUD functions
- Implement sensitive field validation
- Add audit logging
- Write tests for config operations

---

## Phase 2: Backend API (Day 2-3)

### Task 3: API Endpoints
- Add routes to `server/index.js`:
  - GET `/api/data-sources/:name/config`
  - PUT `/api/data-sources/:name/config`
  - POST `/api/data-sources/:name/toggle`
  - GET `/api/data-sources/:name/history`
  - GET `/api/data-sources/export`
- Write integration tests

---

## Phase 3: Frontend UI (Day 3-4)

### Task 4: HTML Page
- Create `public/data-sources.html`
- Header with search and navigation
- Grid container for cards
- Configuration modal

### Task 5: JavaScript App
- Create `public/js/data-sources-app.js`
- Load and render data sources
- Handle configuration updates
- Test connection functionality
- Toast notifications

### Task 6: CSS Styling
- Create `public/css/data-sources.css`
- Responsive card grid
- Status badges
- Modal and form styling
- Toast animations

### Task 7: Admin Integration
- Add "Data Sources" tab to `public/admin.html`

---

## Phase 4: Testing & Documentation (Day 5)

### Task 8: E2E Tests
- Create `tests/e2e/data-sources-ui.test.js`
- Test page load, cards, modal, search

### Task 9: Documentation
- Update `README.md` with usage instructions

### Task 10: System Verification
- Run full test suite
- Manual UI testing
- Create final commit

---

## Detailed Task Breakdown

See design document for complete code snippets and step-by-step instructions.

**Key Implementation Notes:**

1. **Security**: Reject any config fields matching patterns: /key$/i, /token$/i, /password$/i, /secret$/i
2. **Database**: Use Bun's native `bun:sqlite` - no external dependencies
3. **Testing**: TDD approach - write tests first, then implementation
4. **Commits**: Frequent commits after each task with descriptive messages

---

## Success Criteria

- ✅ All 17 data sources visible in UI
- ✅ Connection status accurate
- ✅ Config changes apply without restart
- ✅ Audit trail records all changes
- ✅ Sensitive credentials never in database
- ✅ Admin-only access enforced

---

## Execution Options

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints
