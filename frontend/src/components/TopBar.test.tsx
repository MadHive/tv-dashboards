import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TopBar from './TopBar';
import { setConfig, $currentPage } from '@stores/dashboard';
import type { DashboardConfig } from '@lib/api';

const mockConfig: DashboardConfig = {
  dashboards: [
    {
      id: 'main',
      name: 'Platform Overview',
      icon: '⚡',
      grid: { columns: 4, rows: 2, gap: 14 },
      widgets: [],
    },
  ],
  global: {
    title: 'MadHive Platform',
    rotation_interval: 30,
  },
};

describe('TopBar', () => {
  beforeEach(() => {
    setConfig(mockConfig);
    $currentPage.set(0);
  });

  it('should render platform title', () => {
    render(<TopBar />);
    expect(screen.getByText('MADHIVE')).toBeInTheDocument();
    expect(screen.getByText('PLATFORM')).toBeInTheDocument();
  });

  it('should render current dashboard icon and name', () => {
    render(<TopBar />);
    expect(screen.getByText('⚡')).toBeInTheDocument();
    expect(screen.getByText('Platform Overview')).toBeInTheDocument();
  });

  it('should render data source indicator', () => {
    render(<TopBar />);
    expect(screen.getByText(/data source/i)).toBeInTheDocument();
  });

  it('should render clock', () => {
    render(<TopBar />);
    // Clock should be present (actual time will vary)
    const clock = screen.getByTestId('clock');
    expect(clock).toBeInTheDocument();
  });

  it('should render last refresh indicator', () => {
    render(<TopBar />);
    expect(screen.getByTestId('last-refresh')).toBeInTheDocument();
  });
});
