import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import StackedBarChartWidget from './StackedBarChartWidget';
import * as api from '@lib/api';
import type { Widget } from '@lib/api';

describe('StackedBarChartWidget', () => {
  const mockWidget: Widget = {
    id: 'test-stacked-bar',
    type: 'stacked-bar',
    title: 'Test Stacked Bar Chart',
    source: 'mock',
    position: { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
  };

  it('renders loading state initially', () => {
    vi.spyOn(api, 'fetchWidgetData').mockImplementation(() => new Promise(() => {}));
    render(<StackedBarChartWidget widget={mockWidget} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders stacked bar chart with multiple datasets', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      datasets: [
        { label: 'Product A', data: [100, 150, 120, 180] },
        { label: 'Product B', data: [80, 90, 110, 140] },
        { label: 'Product C', data: [60, 70, 80, 90] },
      ],
      orientation: 'vertical',
      timestamp: new Date().toISOString(),
    });

    render(<StackedBarChartWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('Test Stacked Bar Chart')).toBeInTheDocument();
    });
  });

  it('renders error state on fetch failure', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockRejectedValue(
      new Error('Failed to fetch')
    );

    render(<StackedBarChartWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText(/Error/i)).toBeInTheDocument();
    });
  });

  it('supports horizontal orientation', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      labels: ['A', 'B', 'C'],
      datasets: [
        { label: 'Series 1', data: [10, 20, 30] },
        { label: 'Series 2', data: [15, 25, 35] },
      ],
      orientation: 'horizontal',
      timestamp: new Date().toISOString(),
    });

    render(<StackedBarChartWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('Test Stacked Bar Chart')).toBeInTheDocument();
    });
  });
});
