import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SparklineWidget from './SparklineWidget';
import * as api from '@lib/api';
import type { Widget } from '@lib/api';

describe('SparklineWidget', () => {
  const mockWidget: Widget = {
    id: 'test-sparkline',
    type: 'sparkline',
    title: 'Test Sparkline',
    source: 'mock',
    position: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
  };

  it('renders loading state initially', () => {
    vi.spyOn(api, 'fetchWidgetData').mockImplementation(() => new Promise(() => {}));
    render(<SparklineWidget widget={mockWidget} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders sparkline data', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      values: [10, 20, 15, 25, 30],
      trend: 'up',
      timestamp: new Date().toISOString(),
    });

    render(<SparklineWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('Test Sparkline')).toBeInTheDocument();
    });
  });

  it('renders error state on fetch failure', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockRejectedValue(
      new Error('Failed to fetch')
    );

    render(<SparklineWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText(/Error/i)).toBeInTheDocument();
    });
  });
});
