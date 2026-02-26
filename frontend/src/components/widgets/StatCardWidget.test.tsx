import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import StatCardWidget from './StatCardWidget';
import * as api from '@lib/api';

const mockWidget = {
  id: 'stat-widget',
  type: 'stat-card',
  title: 'Success Rate',
  source: 'gcp',
  position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
};

describe('StatCardWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    vi.spyOn(api, 'fetchWidgetData').mockImplementation(
      () => new Promise(() => {})
    );

    render(<StatCardWidget widget={mockWidget} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should display the stat value', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      value: 99.5,
      unit: '%',
      timestamp: new Date().toISOString(),
    });

    render(<StatCardWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('99.5')).toBeInTheDocument();
    });
  });

  it('should display unit suffix', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      value: 99.5,
      unit: '%',
      timestamp: new Date().toISOString(),
    });

    render(<StatCardWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('%')).toBeInTheDocument();
    });
  });

  it('should show label when provided', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      value: 150,
      label: 'Active Sessions',
      timestamp: new Date().toISOString(),
    });

    render(<StatCardWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('Active Sessions')).toBeInTheDocument();
    });
  });

  it('should show trend when provided', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      value: 100,
      trend: 'up',
      timestamp: new Date().toISOString(),
    });

    render(<StatCardWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('↗')).toBeInTheDocument();
    });
  });

  it('should show error state when fetch fails', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockRejectedValue(
      new Error('Failed to fetch')
    );

    render(<StatCardWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
