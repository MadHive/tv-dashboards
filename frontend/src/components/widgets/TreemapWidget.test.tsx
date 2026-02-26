import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TreemapWidget from './TreemapWidget';
import * as api from '@lib/api';
import type { Widget } from '@lib/api';

describe('TreemapWidget', () => {
  const mockWidget: Widget = {
    id: 'test-treemap',
    type: 'treemap',
    title: 'Test Treemap',
    source: 'mock',
    position: { col: 0, row: 0, colSpan: 3, rowSpan: 2 },
  };

  it('renders loading state initially', () => {
    vi.spyOn(api, 'fetchWidgetData').mockImplementation(() => new Promise(() => {}));
    render(<TreemapWidget widget={mockWidget} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders treemap with hierarchical data', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      name: 'root',
      children: [
        { name: 'Category A', value: 100 },
        { name: 'Category B', value: 80 },
        { name: 'Category C', value: 60 },
      ],
      timestamp: new Date().toISOString(),
    });

    render(<TreemapWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('Test Treemap')).toBeInTheDocument();
    });
  });

  it('renders error state on fetch failure', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockRejectedValue(
      new Error('Failed to fetch')
    );

    render(<TreemapWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText(/Error/i)).toBeInTheDocument();
    });
  });

  it('handles nested hierarchical data', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      name: 'root',
      children: [
        {
          name: 'Group 1',
          value: 0,
          children: [
            { name: 'Item 1.1', value: 50 },
            { name: 'Item 1.2', value: 30 },
          ],
        },
        { name: 'Item 2', value: 70 },
      ],
      timestamp: new Date().toISOString(),
    });

    render(<TreemapWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('Test Treemap')).toBeInTheDocument();
    });
  });
});
