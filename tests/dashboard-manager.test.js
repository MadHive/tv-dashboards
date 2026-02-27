import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import DashboardManager from '../server/dashboard-manager.js';
import { writeFile, readFile } from 'fs/promises';
import YAML from 'js-yaml';

describe('DashboardManager', () => {
  let manager;
  let originalConfig;

  beforeEach(async () => {
    // Backup original config
    originalConfig = await readFile('./config/dashboards.yaml', 'utf-8');
    manager = new DashboardManager('./config/dashboards.yaml');
  });

  afterEach(async () => {
    // Restore original config
    await writeFile('./config/dashboards.yaml', originalConfig);
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

  it('should get dashboard by ID', async () => {
    const dashboard = await manager.getDashboard('platform-overview');
    expect(dashboard).toBeDefined();
    expect(dashboard.id).toBe('platform-overview');
    expect(dashboard.name).toBe('Platform Overview');
    expect(dashboard.widgets).toBeDefined();
  });

  it('should throw error for non-existent dashboard', async () => {
    await expect(manager.getDashboard('non-existent')).rejects.toThrow('Dashboard not found');
  });

  it('should create new dashboard', async () => {
    const newDashboard = {
      name: 'Test Dashboard',
      subtitle: 'Test Subtitle',
      icon: 'bolt',
      grid: { columns: 3, rows: 2, gap: 14 }
    };

    const created = await manager.createDashboard(newDashboard);
    expect(created.id).toBe('test-dashboard');
    expect(created.name).toBe('Test Dashboard');
    expect(created.widgets).toEqual([]);

    const dashboards = await manager.listDashboards();
    expect(dashboards.some(d => d.id === 'test-dashboard')).toBe(true);
  });

  it('should auto-generate ID from name', async () => {
    const dashboard = { name: 'My New Dashboard', icon: 'grid', grid: { columns: 2, rows: 2, gap: 14 } };
    const created = await manager.createDashboard(dashboard);
    expect(created.id).toBe('my-new-dashboard');
  });

  it('should reject duplicate IDs', async () => {
    const dashboard = { id: 'platform-overview', name: 'Duplicate', icon: 'bolt', grid: { columns: 2, rows: 2, gap: 14 } };
    await expect(manager.createDashboard(dashboard)).rejects.toThrow('Dashboard ID already exists');
  });

  it('should update existing dashboard', async () => {
    const updates = {
      name: 'Updated Name',
      subtitle: 'Updated Subtitle'
    };

    const updated = await manager.updateDashboard('platform-overview', updates);
    expect(updated.name).toBe('Updated Name');
    expect(updated.subtitle).toBe('Updated Subtitle');

    const dashboard = await manager.getDashboard('platform-overview');
    expect(dashboard.name).toBe('Updated Name');
  });

  it('should throw error when updating non-existent dashboard', async () => {
    await expect(manager.updateDashboard('non-existent', { name: 'Test' })).rejects.toThrow('Dashboard not found');
  });

  it('should not allow changing ID to existing ID', async () => {
    const created = await manager.createDashboard({ name: 'Test 1', icon: 'bolt', grid: { columns: 2, rows: 2, gap: 14 } });
    await expect(manager.updateDashboard(created.id, { id: 'platform-overview' })).rejects.toThrow('Dashboard ID already exists');
  });

  it('should delete dashboard', async () => {
    const created = await manager.createDashboard({ name: 'To Delete', icon: 'bolt', grid: { columns: 2, rows: 2, gap: 14 } });

    await manager.deleteDashboard(created.id);

    const dashboards = await manager.listDashboards();
    expect(dashboards.some(d => d.id === created.id)).toBe(false);
  });

  it('should throw error when deleting non-existent dashboard', async () => {
    await expect(manager.deleteDashboard('non-existent')).rejects.toThrow('Dashboard not found');
  });

  it('should prevent deleting last dashboard', async () => {
    // First, create a test config with only one dashboard
    const testConfig = {
      global: { rotation_interval: 30, refresh_interval: 8, title: 'TEST' },
      dashboards: [{ id: 'only-one', name: 'Only One', icon: 'bolt', grid: { columns: 2, rows: 2, gap: 14 }, widgets: [] }]
    };
    await writeFile('./config/dashboards.yaml', YAML.dump(testConfig));
    manager = new DashboardManager('./config/dashboards.yaml');

    await expect(manager.deleteDashboard('only-one')).rejects.toThrow('Cannot delete the last dashboard');
  });

  it('should duplicate dashboard with new ID', async () => {
    const duplicated = await manager.duplicateDashboard('platform-overview');
    expect(duplicated.id).toBe('platform-overview-copy');
    expect(duplicated.name).toBe('Platform Overview (Copy)');
    expect(duplicated.widgets.length).toBeGreaterThan(0);

    const dashboards = await manager.listDashboards();
    expect(dashboards.some(d => d.id === duplicated.id)).toBe(true);
  });

  it('should handle duplicate of duplicate (copy-2)', async () => {
    await manager.duplicateDashboard('platform-overview');
    const duplicated2 = await manager.duplicateDashboard('platform-overview');
    expect(duplicated2.id).toBe('platform-overview-copy-2');
    expect(duplicated2.name).toBe('Platform Overview (Copy 2)');
  });
});
