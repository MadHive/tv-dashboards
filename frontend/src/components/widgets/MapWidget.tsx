import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Card } from '@/components/ui/Card';
import { useWidgetData } from '@/hooks/useApi';
import type { WidgetConfig } from '@/types/dashboard';
import 'leaflet/dist/leaflet.css';

interface MapData {
  center?: [number, number]; // [lat, lng], default: [40.7128, -74.0060] (NYC)
  zoom?: number; // default: 10
  markers?: {
    position: [number, number];
    label: string;
    color?: string;
  }[];
  timestamp: string;
}

interface MapWidgetProps {
  config: WidgetConfig;
}

// Fix Leaflet default marker icons
const fixLeafletIcons = () => {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
};

// Create custom colored marker icons
const createColoredIcon = (color?: string) => {
  const svgIcon = `
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12.5 0C5.596 0 0 5.596 0 12.5c0 9.375 12.5 28.5 12.5 28.5S25 21.875 25 12.5C25 5.596 19.404 0 12.5 0z"
        fill="${color || '#FF9BD3'}"
        stroke="#fff"
        stroke-width="2"
      />
      <circle cx="12.5" cy="12.5" r="5" fill="#fff" />
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    className: 'custom-marker-icon',
  });
};

export function MapWidget({ config }: MapWidgetProps) {
  const { data, isLoading, error } = useWidgetData(config.id);

  // Type assertion for MapData
  const mapData = data as MapData | undefined;

  // Fix Leaflet icons on mount
  useEffect(() => {
    fixLeafletIcons();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="animate-pulse space-y-4 text-center">
          <div className="h-96 w-full bg-madhive-purple-medium/50 rounded" />
          <div className="h-4 w-32 bg-madhive-purple-medium/50 rounded mx-auto" />
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-error text-tv-base">Error loading data</p>
          <p className="text-madhive-chalk/60 text-tv-sm mt-2">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </Card>
    );
  }

  // Default values
  const center: [number, number] = mapData?.center || [40.7128, -74.006]; // NYC
  const zoom = mapData?.zoom || 10;
  const markers = mapData?.markers || [];

  return (
    <Card variant="gradient" className="flex flex-col h-full overflow-hidden">
      {/* Title */}
      {config.title && (
        <div className="mb-4">
          <h3 className="text-tv-lg font-display text-madhive-chalk/80 truncate">
            {config.title}
          </h3>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {markers.map((marker, index) => (
            <Marker
              key={index}
              position={marker.position}
              icon={createColoredIcon(marker.color)}
            >
              <Popup
                className="custom-popup"
                // Apply MadHive styling to popup
              >
                <div className="bg-madhive-purple-dark text-madhive-chalk p-2 rounded">
                  <p className="text-tv-sm font-semibold text-madhive-pink">
                    {marker.label}
                  </p>
                  <p className="text-tv-xs text-madhive-chalk/60 mt-1">
                    {marker.position[0].toFixed(4)}, {marker.position[1].toFixed(4)}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Timestamp footer */}
      {mapData?.timestamp && (
        <div className="mt-4 pt-4 border-t border-madhive-purple-medium/30">
          <p className="text-tv-xs text-madhive-chalk/40 text-center">
            Updated: {new Date(mapData.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* Custom CSS for Leaflet popup styling */}
      <style>{`
        .leaflet-popup-content-wrapper {
          background: transparent;
          box-shadow: none;
          padding: 0;
        }
        .leaflet-popup-content {
          margin: 0;
        }
        .leaflet-popup-tip {
          background: #1e1734;
        }
        .custom-marker-icon {
          background: transparent;
          border: none;
        }
      `}</style>
    </Card>
  );
}
