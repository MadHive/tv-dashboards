import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import DashboardManager from '../server/dashboard-manager.js';
import { writeFile, readFile } from 'fs/promises';

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
});
