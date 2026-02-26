import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ListWidget from './ListWidget';
import * as api from '@lib/api';

const mockWidget = {
  id: 'test-list',
  type: 'list',
  title: 'Active Alerts',
  source: 'gcp',
  position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
};

describe('ListWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    vi.spyOn(api, 'fetchWidgetData').mockImplementation(
      () => new Promise(() => {})
    );

    render(<ListWidget widget={mockWidget} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should fetch widget data on mount', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      items: [
        { text: 'Alert 1', status: 'warning' },
        { text: 'Alert 2', status: 'error' },
      ],
      timestamp: new Date().toISOString(),
    });

    render(<ListWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('test-list');
    });
  });

  it('should render list items', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      items: [
        { text: 'Item 1' },
        { text: 'Item 2' },
        { text: 'Item 3' },
      ],
      timestamp: new Date().toISOString(),
    });

    render(<ListWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });
  });

  it('should display widget title', () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      items: [{ text: 'Test' }],
      timestamp: new Date().toISOString(),
    });

    render(<ListWidget widget={mockWidget} />);
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
  });

  it('should show error state when fetch fails', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockRejectedValue(
      new Error('Failed to fetch')
    );

    render(<ListWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('should show empty state when no items', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      items: [],
      timestamp: new Date().toISOString(),
    });

    render(<ListWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText(/no items/i)).toBeInTheDocument();
    });
  });
});
