import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MultiMetricCardWidget from './MultiMetricCardWidget';
import * as api from '@lib/api';
import type { Widget } from '@lib/api';

describe('MultiMetricCardWidget', () => {
  const mockWidget: Widget = {
    id: 'test-multi-metric',
    type: 'multi-metric-card',
    title: 'Test Multi Metric Card',
    source: 'mock',
    position: { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
  };

  it('renders loading state initially', () => {
    vi.spyOn(api, 'fetchWidgetData').mockImplementation(() => new Promise(() => {}));
    render(<MultiMetricCardWidget widget={mockWidget} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders multiple metrics in grid layout', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      metrics: [
        { label: 'Revenue', value: 125000, unit: 'USD', trend: { value: 12.5, direction: 'up' } },
        { label: 'Users', value: 45000, trend: { value: 8.3, direction: 'up' } },
        { label: 'Conversion', value: '3.2%' },
      ],
      timestamp: new Date().toISOString(),
    });

    render(<MultiMetricCardWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('Test Multi Metric Card')).toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Conversion')).toBeInTheDocument();
      expect(screen.getByText('USD')).toBeInTheDocument();
    });
  });

  it('renders error state on fetch failure', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockRejectedValue(
      new Error('Failed to fetch')
    );

    render(<MultiMetricCardWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText(/Error/i)).toBeInTheDocument();
    });
  });

  it('renders trend indicators correctly', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      metrics: [
        { label: 'Up Metric', value: 100, trend: { value: 10, direction: 'up' } },
        { label: 'Down Metric', value: 50, trend: { value: 5, direction: 'down' } },
      ],
      timestamp: new Date().toISOString(),
    });

    render(<MultiMetricCardWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('10%')).toBeInTheDocument();
      expect(screen.getByText('5%')).toBeInTheDocument();
    });
  });
});
