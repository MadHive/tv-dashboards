import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SankeyWidget from './SankeyWidget';
import * as api from '@lib/api';
import type { Widget } from '@lib/api';

describe('SankeyWidget', () => {
  const mockWidget: Widget = {
    id: 'test-sankey',
    type: 'sankey',
    title: 'Test Sankey Diagram',
    source: 'mock',
    position: { col: 0, row: 0, colSpan: 3, rowSpan: 2 },
  };

  it('renders loading state initially', () => {
    vi.spyOn(api, 'fetchWidgetData').mockImplementation(() => new Promise(() => {}));
    render(<SankeyWidget widget={mockWidget} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders sankey diagram with nodes and links', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      nodes: [
        { id: 'a', label: 'Node A' },
        { id: 'b', label: 'Node B' },
        { id: 'c', label: 'Node C' },
      ],
      links: [
        { source: 'a', target: 'b', value: 100 },
        { source: 'b', target: 'c', value: 80 },
      ],
      timestamp: new Date().toISOString(),
    });

    render(<SankeyWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('Test Sankey Diagram')).toBeInTheDocument();
    });
  });

  it('renders error state on fetch failure', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockRejectedValue(
      new Error('Failed to fetch')
    );

    render(<SankeyWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText(/Error/i)).toBeInTheDocument();
    });
  });
});
