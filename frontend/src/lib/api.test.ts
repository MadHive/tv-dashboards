import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchDashboardConfig, updateDashboard } from './api';

describe('API Client', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    vi.restoreAllMocks();
  });

  describe('fetchDashboardConfig', () => {
    it('should fetch dashboard config from /api/config', async () => {
      const mockConfig = {
        dashboards: [
          {
            id: 'main',
            name: 'Main Dashboard',
            grid: { columns: 4, rows: 2, gap: 14 },
            widgets: [],
          },
        ],
        global: {
          title: 'MadHive Platform',
          rotation_interval: 30,
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockConfig,
      });

      const config = await fetchDashboardConfig();

      expect(fetch).toHaveBeenCalledWith('/api/config');
      expect(config).toEqual(mockConfig);
    });

    it('should throw error when fetch fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
      });

      await expect(fetchDashboardConfig()).rejects.toThrow('Failed to fetch config');
    });
  });

  describe('updateDashboard', () => {
    it('should update dashboard via PUT request', async () => {
      const dashboard = {
        id: 'main',
        name: 'Updated Dashboard',
        grid: { columns: 4, rows: 2, gap: 14 },
        widgets: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      await updateDashboard('main', dashboard);

      expect(fetch).toHaveBeenCalledWith('/api/dashboards/main', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dashboard),
      });
    });

    it('should throw error when update fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      });

      const dashboard = {
        id: 'main',
        name: 'Test',
        grid: { columns: 4, rows: 2, gap: 14 },
        widgets: [],
      };

      await expect(updateDashboard('main', dashboard)).rejects.toThrow(
        'Failed to update dashboard'
      );
    });
  });
});
