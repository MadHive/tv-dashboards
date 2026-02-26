import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import GaugeWidget from './GaugeWidget';
import * as api from '@lib/api';

const mockWidget = {
  id: 'gauge-widget',
  type: 'gauge',
  title: 'CPU Usage',
  source: 'gcp',
  position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
  min: 0,
  max: 100,
};

describe('GaugeWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    vi.spyOn(api, 'fetchWidgetData').mockImplementation(
      () => new Promise(() => {})
    );

    render(<GaugeWidget widget={mockWidget} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should display the gauge value', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      value: 75,
      timestamp: new Date().toISOString(),
    });

    render(<GaugeWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('75')).toBeInTheDocument();
    });
  });

  it('should display unit when provided', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      value: 75,
      unit: '%',
      timestamp: new Date().toISOString(),
    });

    render(<GaugeWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText('%')).toBeInTheDocument();
    });
  });

  it('should show error state when fetch fails', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockRejectedValue(
      new Error('Failed to fetch')
    );

    render(<GaugeWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('should display widget title', () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      value: 50,
      timestamp: new Date().toISOString(),
    });

    render(<GaugeWidget widget={mockWidget} />);
    expect(screen.getByText('CPU Usage')).toBeInTheDocument();
  });
});
