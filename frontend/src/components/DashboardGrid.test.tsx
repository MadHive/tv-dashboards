import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardGrid from './DashboardGrid';
import { setConfig, $currentPage } from '@stores/dashboard';
import type { DashboardConfig } from '@lib/api';

const mockConfig: DashboardConfig = {
  dashboards: [
    {
      id: 'main',
      name: 'Platform Overview',
      icon: '⚡',
      grid: { columns: 4, rows: 2, gap: 14 },
      widgets: [
        {
          id: 'widget-1',
          type: 'big-number',
          title: 'Active Users',
          source: 'gcp',
          position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 },
        },
        {
          id: 'widget-2',
          type: 'stat-card',
          title: 'Response Time',
          source: 'gcp',
          position: { col: 3, row: 1, colSpan: 2, rowSpan: 1 },
        },
      ],
    },
    {
      id: 'empty',
      name: 'Empty Dashboard',
      icon: '📊',
      grid: { columns: 6, rows: 3, gap: 12 },
      widgets: [],
    },
  ],
  global: {
    title: 'MadHive Platform',
    rotation_interval: 30,
  },
};

describe('DashboardGrid', () => {
  beforeEach(() => {
    setConfig(mockConfig);
    $currentPage.set(0);
  });

  it('should render grid container', () => {
    const { container } = render(<DashboardGrid />);
    const gridElement = container.querySelector('[data-testid="dashboard-grid"]');
    expect(gridElement).toBeInTheDocument();
  });

  it('should apply correct grid columns from config', () => {
    const { container } = render(<DashboardGrid />);
    const gridElement = container.querySelector('[data-testid="dashboard-grid"]');

    // Should have 4 columns (from mockConfig)
    expect(gridElement).toHaveStyle({
      gridTemplateColumns: 'repeat(4, 1fr)',
    });
  });

  it('should apply correct grid rows from config', () => {
    const { container } = render(<DashboardGrid />);
    const gridElement = container.querySelector('[data-testid="dashboard-grid"]');

    // Should have 2 rows (from mockConfig)
    expect(gridElement).toHaveStyle({
      gridTemplateRows: 'repeat(2, 1fr)',
    });
  });

  it('should apply correct gap from config', () => {
    const { container } = render(<DashboardGrid />);
    const gridElement = container.querySelector('[data-testid="dashboard-grid"]');

    // Gap should be 14px (from mockConfig)
    expect(gridElement).toHaveStyle({
      gap: '14px',
    });
  });

  it('should render all widgets', () => {
    const { container } = render(<DashboardGrid />);

    // Should render 2 widgets
    const widgets = container.querySelectorAll('[data-widget-id]');
    expect(widgets.length).toBe(2);
  });

  it('should render widget with correct position', () => {
    const { container } = render(<DashboardGrid />);

    // First widget should be at col 1, row 1, span 2x1
    const widget1 = container.querySelector('[data-widget-id="widget-1"]');
    expect(widget1).toHaveStyle({
      gridColumn: 'span 2',
      gridRow: 'span 1',
    });
  });

  it('should pass widget title to widget component', () => {
    render(<DashboardGrid />);
    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('Response Time')).toBeInTheDocument();
  });

  it('should handle empty dashboard', () => {
    $currentPage.set(1); // Switch to empty dashboard
    const { container } = render(<DashboardGrid />);

    const widgets = container.querySelectorAll('[data-widget-id]');
    expect(widgets.length).toBe(0);
  });

  it('should show empty state message when no widgets', () => {
    $currentPage.set(1); // Switch to empty dashboard
    render(<DashboardGrid />);

    expect(screen.getByText(/no widgets configured/i)).toBeInTheDocument();
  });

  it('should update grid when dashboard changes', () => {
    const { container, rerender } = render(<DashboardGrid />);

    // Initial: 4 columns, 2 widgets
    let gridElement = container.querySelector('[data-testid="dashboard-grid"]');
    expect(gridElement).toHaveStyle({
      gridTemplateColumns: 'repeat(4, 1fr)',
    });
    expect(container.querySelectorAll('[data-widget-id]').length).toBe(2);

    // Switch to empty dashboard (no widgets, shows empty state)
    $currentPage.set(1);
    rerender(<DashboardGrid />);

    // Should show empty state instead of grid
    gridElement = container.querySelector('[data-testid="dashboard-grid"]');
    expect(gridElement).toBeNull();
    expect(screen.getByText(/no widgets configured/i)).toBeInTheDocument();
  });

  it('should return null when no config loaded', () => {
    setConfig(null as any);
    const { container } = render(<DashboardGrid />);

    const gridElement = container.querySelector('[data-testid="dashboard-grid"]');
    expect(gridElement).not.toBeInTheDocument();
  });

  it('should return null when no current dashboard', () => {
    $currentPage.set(999); // Invalid page index
    const { container } = render(<DashboardGrid />);

    const gridElement = container.querySelector('[data-testid="dashboard-grid"]');
    expect(gridElement).not.toBeInTheDocument();
  });
});
