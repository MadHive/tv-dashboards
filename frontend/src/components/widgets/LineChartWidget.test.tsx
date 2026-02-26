import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import LineChartWidget from './LineChartWidget';
import * as api from '@lib/api';

const mockWidget = {
  id: 'test-chart',
  type: 'line-chart',
  title: 'Requests Over Time',
  source: 'gcp',
  position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 },
};

describe('LineChartWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    vi.spyOn(api, 'fetchWidgetData').mockImplementation(
      () => new Promise(() => {})
    );

    render(<LineChartWidget widget={mockWidget} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should fetch widget data on mount', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      labels: ['00:00', '01:00', '02:00'],
      datasets: [
        {
          label: 'Requests',
          data: [100, 200, 150],
        },
      ],
      timestamp: new Date().toISOString(),
    });

    render(<LineChartWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('test-chart');
    });
  });

  it('should render chart canvas', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      labels: ['00:00', '01:00', '02:00'],
      datasets: [
        {
          label: 'Requests',
          data: [100, 200, 150],
        },
      ],
      timestamp: new Date().toISOString(),
    });

    const { container } = render(<LineChartWidget widget={mockWidget} />);

    await waitFor(() => {
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });
  });

  it('should display widget title', () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      labels: ['00:00'],
      datasets: [{ label: 'Test', data: [100] }],
      timestamp: new Date().toISOString(),
    });

    render(<LineChartWidget widget={mockWidget} />);
    expect(screen.getByText('Requests Over Time')).toBeInTheDocument();
  });

  it('should show error state when fetch fails', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockRejectedValue(
      new Error('Failed to fetch')
    );

    render(<LineChartWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('should handle multiple datasets', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      labels: ['00:00', '01:00'],
      datasets: [
        { label: 'Series 1', data: [100, 200] },
        { label: 'Series 2', data: [150, 250] },
      ],
      timestamp: new Date().toISOString(),
    });

    const { container } = render(<LineChartWidget widget={mockWidget} />);

    await waitFor(() => {
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });
  });
});
