import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import Map, {
  Source,
  Layer,
  type MapRef,
  type LineLayer,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

function detectWebGL(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

// Free public maplibre style — CARTO Dark Matter via OpenMapTiles, no token
// required. Matches the Remotion `MAP_STYLE_URL` so the in-page preview and
// the rendered MP4 share the same visual baseline.
const MAP_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export interface MapCameraState {
  centerLat: number;
  centerLng: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface ActivityMapPreviewHandle {
  /** Read the current camera state from the underlying maplibre map. */
  getCamera: () => MapCameraState | null;
}

interface ActivityMapPreviewProps {
  dataPoints: Array<{ lat?: number | null; lng?: number | null }>;
  className?: string;
}

const routeGlowLayer: LineLayer = {
  id: "route-glow",
  type: "line",
  source: "route",
  paint: {
    "line-color": "#7170ff",
    "line-width": 12,
    "line-opacity": 0.35,
    "line-blur": 8,
  },
  layout: { "line-cap": "round", "line-join": "round" },
};

const routeLineLayer: LineLayer = {
  id: "route-line",
  type: "line",
  source: "route",
  paint: {
    "line-color": "#ffffff",
    "line-width": 4,
  },
  layout: { "line-cap": "round", "line-join": "round" },
};

/**
 * Interactive maplibre preview that renders the activity's GPS route as a
 * polyline and exposes pan/zoom/rotate/tilt controls. Matches the interaction
 * config from the react-map-gl maplibre interaction example exactly.
 *
 * The parent component reads the current camera off the imperative handle
 * when submitting a Map-style render job.
 */
export const ActivityMapPreview = forwardRef<
  ActivityMapPreviewHandle,
  ActivityMapPreviewProps
>(function ActivityMapPreview({ dataPoints, className }, ref) {
  const mapRef = useRef<MapRef>(null);

  const positions = useMemo(() => {
    return dataPoints
      .filter((dp) => dp.lat != null && dp.lng != null)
      .map((dp) => [dp.lng!, dp.lat!] as [number, number]);
  }, [dataPoints]);

  const routeGeoJSON = useMemo(
    () =>
      ({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: positions },
      }) as GeoJSON.Feature<GeoJSON.LineString>,
    [positions],
  );

  // Compute initial bounds + a sensible starting view. We pass `initialViewState`
  // (uncontrolled) so the user can pan/zoom freely after load.
  const initial = useMemo(() => {
    if (positions.length === 0) {
      return { longitude: 0, latitude: 0, zoom: 1, bearing: 0, pitch: 0 };
    }
    const lngs = positions.map((p) => p[0]);
    const lats = positions.map((p) => p[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    return {
      longitude: (minLng + maxLng) / 2,
      latitude: (minLat + maxLat) / 2,
      zoom: 12,
      bearing: 0,
      pitch: 0,
      // We re-fit bounds in onLoad below for tighter framing.
    };
  }, [positions]);

  useImperativeHandle(
    ref,
    () => ({
      getCamera: () => {
        const map = mapRef.current?.getMap();
        if (!map) return null;
        const c = map.getCenter();
        return {
          centerLat: c.lat,
          centerLng: c.lng,
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
        };
      },
    }),
    [],
  );

  if (positions.length === 0) return null;

  return (
    <div
      className={
        className ??
        "h-[500px] w-full rounded-lg overflow-hidden border border-border relative"
      }
      data-testid="map-preview-container"
    >
      <Map
        ref={mapRef}
        mapLib={maplibregl as unknown as never}
        mapStyle={MAP_STYLE_URL}
        initialViewState={initial}
        attributionControl={false}
        // Interaction config — mirrors
        // https://visgl.github.io/react-map-gl/examples/maplibre/interaction
        scrollZoom
        boxZoom
        dragRotate
        dragPan
        keyboard
        doubleClickZoom
        touchZoomRotate
        touchPitch
        minZoom={0}
        maxZoom={20}
        minPitch={0}
        maxPitch={85}
        onLoad={(e) => {
          const m = e.target;
          // Fit the route bounds on first load so the user always sees the
          // entire activity. After this, they're free to reframe.
          if (positions.length >= 2) {
            const lngs = positions.map((p) => p[0]);
            const lats = positions.map((p) => p[1]);
            const bounds: [[number, number], [number, number]] = [
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)],
            ];
            m.fitBounds(bounds, { padding: 60, duration: 0 });
          }
        }}
      >
        <Source id="route" type="geojson" data={routeGeoJSON}>
          <Layer {...routeGlowLayer} />
          <Layer {...routeLineLayer} />
        </Source>
      </Map>
      <div className="absolute bottom-2 right-2 text-[10px] text-white/60 bg-black/40 px-2 py-0.5 rounded pointer-events-none">
        © OpenStreetMap contributors © CARTO
      </div>
    </div>
  );
});
