import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leafet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface ActivityMapProps {
  dataPoints: Array<{ lat?: number | null; lng?: number | null }>;
}

function MapBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, bounds]);
  return null;
}

export function ActivityMap({ dataPoints }: ActivityMapProps) {
  const positions = useMemo(() => {
    return dataPoints
      .filter((dp) => dp.lat != null && dp.lng != null)
      .map((dp) => [dp.lat!, dp.lng!] as [number, number]);
  }, [dataPoints]);

  if (positions.length === 0) return null;

  const bounds = L.latLngBounds(positions);

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden border border-border" data-testid="map-container">
      <MapContainer
        bounds={bounds}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />
        <Polyline positions={positions} color="#7170ff" weight={3} opacity={0.8} />
        <MapBounds bounds={bounds} />
      </MapContainer>
      <style>{`
        .map-tiles {
          filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
        }
      `}</style>
    </div>
  );
}
