import { useState, useEffect, useRef, useMemo } from 'react';
import { fetchWidgetData } from '@lib/api';
import type { Widget } from '@lib/api';
import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import Supercluster from 'supercluster';

interface MapWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  value?: number;
  status?: 'success' | 'warning' | 'error' | 'info';
  color?: string;
}

interface MapData {
  center: { lat: number; lng: number };
  zoom: number;
  markers: MapMarker[];
  timestamp: string;
  mapboxToken?: string;
}

export default function MapWidget({
  widget,
  refreshInterval = 30000, // 30 second default for maps
}: MapWidgetProps) {
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      setError(null);
      const result = await fetchWidgetData(widget.id);
      setData(result);
      setLoading(false);
    } catch (err) {
      console.error(`Failed to load data for widget ${widget.id}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [widget.id, refreshInterval]);

  if (loading) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-slate-400">Loading map...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-red-900 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <div className="text-red-500 text-2xl mb-2">⚠️</div>
            <div className="text-red-400 text-sm">Error loading map</div>
            <div className="text-slate-500 text-xs mt-1">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const statusColors = {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  };

  // Use provided token or default (will need to be configured)
  const mapboxToken = data.mapboxToken || import.meta.env.PUBLIC_MAPBOX_TOKEN || '';

  if (!mapboxToken) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-yellow-900 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <div className="text-yellow-500 text-2xl mb-2">⚙️</div>
            <div className="text-yellow-400 text-sm">Mapbox token required</div>
            <div className="text-slate-500 text-xs mt-1">
              Set PUBLIC_MAPBOX_TOKEN environment variable
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Create clusters for markers when there are 10+
  const clusters = useMemo(() => {
    if (!data || !data.markers) {
      return [];
    }

    if (data.markers.length < 10) {
      return data.markers.map((marker, idx) => ({
        type: 'Feature' as const,
        properties: { ...marker, originalIndex: idx, cluster: false },
        geometry: {
          type: 'Point' as const,
          coordinates: [marker.lng, marker.lat],
        },
      }));
    }

    const index = new Supercluster({
      radius: 60,
      maxZoom: 16,
    });

    const points = data.markers.map((marker, idx) => ({
      type: 'Feature' as const,
      properties: { ...marker, originalIndex: idx },
      geometry: {
        type: 'Point' as const,
        coordinates: [marker.lng, marker.lat],
      },
    }));

    index.load(points);

    const bounds = [
      data.center.lng - 2,
      data.center.lat - 2,
      data.center.lng + 2,
      data.center.lat + 2,
    ];

    return index.getClusters(bounds as [number, number, number, number], Math.floor(data.zoom));
  }, [data]);

  return (
    <div
      data-widget-id={widget.id}
      style={{
        gridColumn: `span ${widget.position.colSpan}`,
        gridRow: `span ${widget.position.rowSpan}`,
      }}
      className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col hover:border-slate-600 transition-colors"
    >
      <h3 className="text-sm font-medium text-slate-400 mb-3">{widget.title}</h3>

      <div className="flex-1 overflow-hidden rounded-lg map-container" ref={mapContainerRef}>
        <Map
          initialViewState={{
            latitude: data.center.lat,
            longitude: data.center.lng,
            zoom: data.zoom,
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={mapboxToken}
        >
          <NavigationControl position="top-right" />

          {clusters.map((cluster, index) => {
            const [longitude, latitude] = cluster.geometry.coordinates;
            const { cluster: isCluster, point_count: pointCount } = cluster.properties;

            if (isCluster) {
              return (
                <Marker
                  key={`cluster-${index}`}
                  longitude={longitude}
                  latitude={latitude}
                  anchor="center"
                >
                  <div className="relative">
                    <div
                      className="flex items-center justify-center rounded-full bg-pink-500 text-white font-bold border-4 border-pink-300"
                      style={{
                        width: `${30 + (pointCount / clusters.length) * 20}px`,
                        height: `${30 + (pointCount / clusters.length) * 20}px`,
                      }}
                    >
                      {pointCount}
                    </div>
                  </div>
                </Marker>
              );
            }

            const marker = cluster.properties as MapMarker;
            return (
              <Marker
                key={cluster.properties.originalIndex || index}
                longitude={longitude}
                latitude={latitude}
                anchor="bottom"
              >
                <div className="flex flex-col items-center animate-fade-in">
                  {/* Marker pin with pulse effect */}
                  <div className="relative">
                    {/* Pulse ring */}
                    <div
                      className="absolute inset-0 rounded-full animate-ping opacity-30"
                      style={{
                        backgroundColor:
                          marker.color ||
                          (marker.status ? statusColors[marker.status] : '#3b82f6'),
                        width: '24px',
                        height: '24px',
                        top: '-6px',
                        left: '-6px',
                      }}
                    />
                    {/* Main marker */}
                    <div
                      className="w-6 h-6 rounded-full border-3 border-white shadow-2xl cursor-pointer hover:scale-110 transition-transform"
                      style={{
                        backgroundColor:
                          marker.color ||
                          (marker.status ? statusColors[marker.status] : '#3b82f6'),
                        boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
                      }}
                      title={`${marker.label}${marker.value !== undefined ? `: ${marker.value}` : ''}`}
                    />
                  </div>
                  {/* Label with value */}
                  <div className="bg-slate-900/95 backdrop-blur-sm px-3 py-2 rounded-lg mt-2 shadow-2xl border border-slate-700 min-w-max">
                    <div className="text-sm font-semibold text-white whitespace-nowrap">
                      {marker.label}
                    </div>
                    {marker.value !== undefined && (
                      <div className="text-lg font-bold text-blue-400 mt-0.5 tabular-nums">
                        {marker.value.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </Marker>
            );
          })}
        </Map>

        {data.markers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-4xl mb-2">📍</div>
              <div className="text-slate-400 text-sm">No locations to display</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
