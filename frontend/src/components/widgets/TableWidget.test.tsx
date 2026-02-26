import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TableWidget from './TableWidget';
import * as api from '@lib/api';

const mockWidget = {
  id: 'test-table',
  type: 'table',
  title: 'Top Services',
  source: 'gcp',
  position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 },
};

describe('TableWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    vi.spyOn(api, 'fetchWidgetData').mockImplementation(
      () => new Promise(() => {})
    );

    render(<TableWidget widget={mockWidget} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should fetch widget data on mount', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      columns: ['Service', 'Requests', 'Errors'],
      rows: [
        ['API', '1000', '5'],
        ['Web', '2000', '10'],
      ],
      timestamp: new Date().toISOString(),
    });

    render(<TableWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('test-table');
    });
  });

  it('should render table headers', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      columns: ['Service', 'Requests', 'Errors'],
      rows: [['API', '1000', '5']],
      timestamp: new Date().toISOString(),
    });

    render(<TableWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Requests')).toBeInTheDocument();
      expect(screen.getByText('Errors')).toBeInTheDocument();
    });
  });

  it('should render table rows', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      columns: ['Service', 'Count'],
      rows: [
        ['API', '1000'],
        ['Web', '2000'],
      ],
      timestamp: new Date().toISOString(),
    });

    render(<TableWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('API')).toBeInTheDocument();
      expect(screen.getByText('1000')).toBeInTheDocument();
      expect(screen.getByText('Web')).toBeInTheDocument();
      expect(screen.getByText('2000')).toBeInTheDocument();
    });
  });

  it('should display widget title', () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      columns: ['Name'],
      rows: [['Test']],
      timestamp: new Date().toISOString(),
    });

    render(<TableWidget widget={mockWidget} />);
    expect(screen.getByText('Top Services')).toBeInTheDocument();
  });

  it('should show error state when fetch fails', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockRejectedValue(
      new Error('Failed to fetch')
    );

    render(<TableWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
