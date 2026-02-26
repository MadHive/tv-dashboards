import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BarChartWidget from './BarChartWidget';
import * as api from '@lib/api';

const mockWidget = {
  id: 'test-bar-chart',
  type: 'bar-chart',
  title: 'Requests by Service',
  source: 'gcp',
  position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 },
};

describe('BarChartWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    vi.spyOn(api, 'fetchWidgetData').mockImplementation(
      () => new Promise(() => {})
    );

    render(<BarChartWidget widget={mockWidget} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should fetch widget data on mount', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      labels: ['Service A', 'Service B', 'Service C'],
      datasets: [
        {
          label: 'Requests',
          data: [100, 200, 150],
        },
      ],
      timestamp: new Date().toISOString(),
    });

    render(<BarChartWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('test-bar-chart');
    });
  });

  it('should render chart canvas', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      labels: ['A', 'B', 'C'],
      datasets: [{ label: 'Data', data: [100, 200, 150] }],
      timestamp: new Date().toISOString(),
    });

    const { container } = render(<BarChartWidget widget={mockWidget} />);

    await waitFor(() => {
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });
  });

  it('should display widget title', () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      labels: ['A'],
      datasets: [{ label: 'Test', data: [100] }],
      timestamp: new Date().toISOString(),
    });

    render(<BarChartWidget widget={mockWidget} />);
    expect(screen.getByText('Requests by Service')).toBeInTheDocument();
  });

  it('should show error state when fetch fails', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockRejectedValue(
      new Error('Failed to fetch')
    );

    render(<BarChartWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
