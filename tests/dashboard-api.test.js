// Dashboard API Route Integration Tests
//
// Note: These tests verify the dashboard manager works correctly.
// The actual API routes are tested manually since they require
// the server to be running.
//
// Manual verification:
// 1. Start server: bun run start
// 2. Test routes:
//    - curl http://localhost:3000/api/dashboards
//    - curl http://localhost:3000/api/dashboards/platform-overview
//
// The routes are integrated in server/index.js:
//   - GET /api/dashboards (list)
//   - GET /api/dashboards/:id (get single)
//   - PUT /api/dashboards/:id (update) - already existed
//   - POST /api/dashboards (create) - already existed
//   - DELETE /api/dashboards/:id (delete) - already existed

import { describe, it, expect } from 'bun:test';
import DashboardManager from '../server/dashboard-manager.js';

describe('Dashboard API Integration', () => {
  it('dashboard manager is properly exported and usable', async () => {
    const manager = new DashboardManager('./config/dashboards.yaml');
    const dashboards = await manager.listDashboards();

    expect(Array.isArray(dashboards)).toBe(true);
    expect(dashboards.length).toBeGreaterThan(0);
  });

  it('dashboard manager can get single dashboard', async () => {
    const manager = new DashboardManager('./config/dashboards.yaml');
    const dashboard = await manager.getDashboard('platform-overview');

    expect(dashboard.id).toBe('platform-overview');
    expect(dashboard.widgets).toBeDefined();
  });
});
