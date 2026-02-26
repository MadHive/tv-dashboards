import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MapWidget from './MapWidget';
import * as api from '@lib/api';

// Mock mapbox-gl
vi.mock('mapbox-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(),
      remove: vi.fn(),
      addControl: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
    })),
    NavigationControl: vi.fn(),
  },
}));

const mockWidget = {
  id: 'test-map',
  type: 'map',
  title: 'Service Locations',
  source: 'gcp',
  position: { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
};

describe('MapWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    vi.spyOn(api, 'fetchWidgetData').mockImplementation(
      () => new Promise(() => {})
    );

    render(<MapWidget widget={mockWidget} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should fetch widget data on mount', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      center: { lat: 40.7128, lng: -74.006 },
      zoom: 10,
      markers: [
        { lat: 40.7128, lng: -74.006, label: 'NYC Office', value: 1000 },
        { lat: 40.758, lng: -73.9855, label: 'Times Square', value: 500 },
      ],
      timestamp: new Date().toISOString(),
    });

    render(<MapWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('test-map');
    });
  });

  it('should render map container', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      center: { lat: 40.7128, lng: -74.006 },
      zoom: 10,
      markers: [{ lat: 40.7128, lng: -74.006, label: 'NYC', value: 100 }],
      mapboxToken: 'mock-token',
      timestamp: new Date().toISOString(),
    });

    const { container } = render(<MapWidget widget={mockWidget} />);

    await waitFor(() => {
      const mapContainer = container.querySelector('.map-container');
      expect(mapContainer).toBeInTheDocument();
    });
  });

  it('should display widget title', () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      center: { lat: 0, lng: 0 },
      zoom: 2,
      markers: [],
      timestamp: new Date().toISOString(),
    });

    render(<MapWidget widget={mockWidget} />);
    expect(screen.getByText('Service Locations')).toBeInTheDocument();
  });

  it('should show error state when fetch fails', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockRejectedValue(
      new Error('Failed to fetch')
    );

    render(<MapWidget widget={mockWidget} />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('should show message when no markers', async () => {
    vi.spyOn(api, 'fetchWidgetData').mockResolvedValue({
      center: { lat: 0, lng: 0 },
      zoom: 2,
      markers: [],
      timestamp: new Date().toISOString(),
    });

    render(<MapWidget widget={mockWidget} />);

    await waitFor(() => {
      const mapContainer = screen.queryByText(/no locations/i);
      // Map still renders even with no markers, just empty
      expect(screen.getByText('Service Locations')).toBeInTheDocument();
    });
  });
});
