import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Layout from './Layout';
import { setConfig } from '@stores/dashboard';
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
      ],
    },
  ],
  global: {
    title: 'MadHive Platform',
    rotation_interval: 30,
  },
};

describe('Layout', () => {
  beforeEach(() => {
    setConfig(mockConfig);
  });

  it('should render TopBar', () => {
    render(<Layout />);
    expect(screen.getByText('MADHIVE')).toBeInTheDocument();
  });

  it('should render DashboardGrid', () => {
    const { container } = render(<Layout />);
    const gridElement = container.querySelector('[data-testid="dashboard-grid"]');
    expect(gridElement).toBeInTheDocument();
  });

  it('should render BottomNav', () => {
    render(<Layout />);
    expect(screen.getByLabelText('previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('next page')).toBeInTheDocument();
  });

  it('should render all three sections in correct order', () => {
    const { container } = render(<Layout />);

    // Get all main sections
    const header = container.querySelector('header');
    const main = container.querySelector('main');
    const footer = container.querySelector('footer');

    expect(header).toBeInTheDocument();
    expect(main).toBeInTheDocument();
    expect(footer).toBeInTheDocument();
  });

  it('should apply full-height layout', () => {
    const { container } = render(<Layout />);
    const layoutDiv = container.firstChild as HTMLElement;

    expect(layoutDiv).toHaveClass('min-h-screen');
  });
});
