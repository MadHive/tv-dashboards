import { describe, it, expect, beforeEach } from 'vitest';
import {
  $config,
  $currentPage,
  $isEditMode,
  $currentDashboard,
  setConfig,
  nextPage,
  prevPage,
  toggleEditMode,
  updateWidget,
} from './dashboard';
import type { DashboardConfig } from '@lib/api';

const mockConfig: DashboardConfig = {
  dashboards: [
    {
      id: 'main',
      name: 'Main Dashboard',
      grid: { columns: 4, rows: 2, gap: 14 },
      widgets: [
        {
          id: 'widget-1',
          type: 'big-number',
          title: 'Test Widget',
          source: 'mock',
          position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 },
        },
      ],
    },
    {
      id: 'secondary',
      name: 'Secondary Dashboard',
      grid: { columns: 6, rows: 3, gap: 12 },
      widgets: [
        {
          id: 'widget-2',
          type: 'gauge',
          title: 'Test Gauge',
          source: 'mock',
          position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
        },
      ],
    },
  ],
  global: {
    title: 'Test Platform',
    rotation_interval: 30,
  },
};

describe('Dashboard Store', () => {
  beforeEach(() => {
    // Reset store state
    $config.set(null);
    $currentPage.set(0);
    $isEditMode.set(false);
  });

  describe('setConfig', () => {
    it('should set dashboard config', () => {
      setConfig(mockConfig);
      expect($config.get()).toEqual(mockConfig);
    });
  });

  describe('$currentDashboard', () => {
    it('should return current dashboard based on page index', () => {
      setConfig(mockConfig);
      expect($currentDashboard.get()).toEqual(mockConfig.dashboards[0]);
    });

    it('should return null when config is not loaded', () => {
      expect($currentDashboard.get()).toBeNull();
    });

    it('should update when page changes', () => {
      setConfig(mockConfig);
      $currentPage.set(1);
      expect($currentDashboard.get()).toEqual(mockConfig.dashboards[1]);
    });
  });

  describe('nextPage', () => {
    it('should increment page index', () => {
      setConfig(mockConfig);
      nextPage();
      expect($currentPage.get()).toBe(1);
    });

    it('should wrap to first page when at end', () => {
      setConfig(mockConfig);
      $currentPage.set(1);
      nextPage();
      expect($currentPage.get()).toBe(0);
    });
  });

  describe('prevPage', () => {
    it('should decrement page index', () => {
      setConfig(mockConfig);
      $currentPage.set(1);
      prevPage();
      expect($currentPage.get()).toBe(0);
    });

    it('should wrap to last page when at beginning', () => {
      setConfig(mockConfig);
      prevPage();
      expect($currentPage.get()).toBe(1);
    });
  });

  describe('toggleEditMode', () => {
    it('should toggle edit mode on', () => {
      toggleEditMode();
      expect($isEditMode.get()).toBe(true);
    });

    it('should toggle edit mode off', () => {
      $isEditMode.set(true);
      toggleEditMode();
      expect($isEditMode.get()).toBe(false);
    });
  });

  describe('updateWidget', () => {
    it('should update widget in current dashboard', () => {
      setConfig(mockConfig);

      updateWidget('widget-1', {
        title: 'Updated Widget',
        position: { col: 2, row: 1, colSpan: 3, rowSpan: 1 },
      });

      const config = $config.get();
      const widget = config?.dashboards[0].widgets[0];

      expect(widget?.title).toBe('Updated Widget');
      expect(widget?.position.col).toBe(2);
      expect(widget?.position.colSpan).toBe(3);
    });

    it('should not update if widget not found', () => {
      setConfig(mockConfig);
      const originalConfig = JSON.parse(JSON.stringify(mockConfig));

      updateWidget('non-existent', { title: 'Updated' });

      expect($config.get()).toEqual(originalConfig);
    });
  });
});
