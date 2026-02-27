import { describe, it, expect, beforeEach } from 'bun:test';
import DashboardManager from '../server/dashboard-manager.js';

describe('DashboardManager', () => {
  let manager;

  beforeEach(() => {
    manager = new DashboardManager('./config/dashboards.yaml');
  });

  it('should initialize with config path', () => {
    expect(manager).toBeDefined();
    expect(manager.configPath).toBe('./config/dashboards.yaml');
  });

  it('should load all dashboards', async () => {
    const dashboards = await manager.listDashboards();
    expect(Array.isArray(dashboards)).toBe(true);
    expect(dashboards.length).toBeGreaterThan(0);
  });
});
