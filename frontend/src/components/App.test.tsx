import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import * as api from '@lib/api';
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
          title: 'Test Widget',
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

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    vi.spyOn(api, 'fetchDashboardConfig').mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<App />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should load dashboard config on mount', async () => {
    const fetchSpy = vi
      .spyOn(api, 'fetchDashboardConfig')
      .mockResolvedValue(mockConfig);

    render(<App />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('should render Layout after config loads', async () => {
    vi.spyOn(api, 'fetchDashboardConfig').mockResolvedValue(mockConfig);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('MADHIVE')).toBeInTheDocument();
    });
  });

  it('should show error state when config fetch fails', async () => {
    vi.spyOn(api, 'fetchDashboardConfig').mockRejectedValue(
      new Error('Failed to fetch config')
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('should show retry button on error', async () => {
    vi.spyOn(api, 'fetchDashboardConfig').mockRejectedValue(
      new Error('Network error')
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/retry/i)).toBeInTheDocument();
    });
  });

  it('should retry loading config when retry button clicked', async () => {
    const fetchSpy = vi
      .spyOn(api, 'fetchDashboardConfig')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockConfig);

    render(<App />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText(/retry/i)).toBeInTheDocument();
    });

    // Click retry
    const retryButton = screen.getByText(/retry/i);
    retryButton.click();

    // Should load successfully
    await waitFor(() => {
      expect(screen.getByText('MADHIVE')).toBeInTheDocument();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
