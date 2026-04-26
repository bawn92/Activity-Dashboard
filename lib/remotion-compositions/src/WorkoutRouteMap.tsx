import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { WorkoutMapVideoProps } from "./types";
import { StatsScene } from "./scenes/StatsScene";

// Free public maplibre demo style (OpenMapTiles via CARTO basemaps,
// no auth/token required). This matches what the interactive Share-page
// preview uses so the rendered video looks the same.
export const MAP_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const FPS = 30;
// Scene timing (30fps):
//   Map draw:  0..240   (8.0s)  — slow, scenic route reveal
//   Stats:     240..330 (3.0s)
export const MAP_SCENE_FRAMES = Math.round(8.0 * FPS); // 240
export const STATS_SCENE_FRAMES = Math.round(3.0 * FPS); // 90
export const MAP_VIDEO_TOTAL_FRAMES =
  MAP_SCENE_FRAMES + STATS_SCENE_FRAMES; // 330

const ROUTE_SOURCE_ID = "activity-route";
const ROUTE_LAYER_ID = "activity-route-line";
const ROUTE_LAYER_GLOW_ID = "activity-route-line-glow";
const START_SOURCE_ID = "start-point";
const START_LAYER_GLOW_ID = "start-point-glow";
const START_LAYER_ID = "start-point-dot";
const CURRENT_SOURCE_ID = "current-point";
const CURRENT_LAYER_GLOW_ID = "current-point-glow";
const CURRENT_LAYER_ID = "current-point-dot";

interface MapSceneProps extends WorkoutMapVideoProps {
  durationFrames: number;
}

/**
 * Map scene: renders the activity route on a maplibre map at the user's chosen
 * camera, animating the polyline being drawn from start to finish, with a
 * persistent start-point marker and a moving "current location" marker that
 * tracks the head of the drawn route.
 */
const MapScene: React.FC<MapSceneProps> = ({
  routePoints,
  camera,
  cameraMode,
  distanceMeters,
  durationSeconds,
  sport,
  date,
  durationFrames,
}) => {
  const mode: "static" | "follow" = cameraMode === "follow" ? "follow" : "static";
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [handle] = useState(() =>
    delayRender("Loading maplibre map", { timeoutInMilliseconds: 60_000 }),
  );
  // Guard against double-release. The map's `load` / `idle` / our hard
  // safety timeout / cleanup can each try to release the same handle and
  // Remotion treats double-continueRender as an error.
  const releasedRef = useRef(false);
  const safelyContinue = () => {
    if (releasedRef.current) return;
    releasedRef.current = true;
    continueRender(handle);
  };

  // Filtered list of valid [lng, lat] coords used by every layer.
  const coords = useMemo<Array<[number, number]>>(() => {
    return routePoints
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => [p.lng, p.lat] as [number, number]);
  }, [routePoints]);

  // Initial empty route — we grow this in the per-frame effect so the line
  // and the moving marker advance together.
  const emptyRouteGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(() => {
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [] },
    };
  }, []);

  const startGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.Point>>(() => {
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Point",
        coordinates: coords[0] ?? [0, 0],
      },
    };
  }, [coords]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [camera.centerLng, camera.centerLat],
      zoom: camera.zoom,
      bearing: camera.bearing,
      pitch: camera.pitch,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      preserveDrawingBuffer: true,
    });
    mapRef.current = map;

    // Force the map to use the full composition canvas, not whatever the
    // container measured at construction time.
    map.resize();

    // Tile load failures (CARTO/OSM rate-limiting, transient network errors
    // from the deployed Replit Chromium) must not hang the render. Log and
    // keep going — the map will still draw whatever tiles did succeed.
    map.on("error", (e) => {
      // eslint-disable-next-line no-console
      console.warn("maplibre error (ignored, render continues):", e?.error);
    });

    map.on("load", () => {
      map.resize();

      // Route line + glow — starts empty, grown per-frame in lockstep with
      // the moving marker so they always stay together.
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: emptyRouteGeoJSON,
      });
      map.addLayer({
        id: ROUTE_LAYER_GLOW_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        paint: {
          "line-color": "#7170ff",
          "line-width": 12,
          "line-opacity": 0.35,
          "line-blur": 8,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        paint: {
          "line-color": "#ffffff",
          "line-width": 5,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      // Start point marker (green) — fixed at the first GPS coord
      map.addSource(START_SOURCE_ID, {
        type: "geojson",
        data: startGeoJSON,
      });
      map.addLayer({
        id: START_LAYER_GLOW_ID,
        type: "circle",
        source: START_SOURCE_ID,
        paint: {
          "circle-radius": 22,
          "circle-color": "#22c55e",
          "circle-opacity": 0.35,
          "circle-blur": 0.8,
        },
      });
      map.addLayer({
        id: START_LAYER_ID,
        type: "circle",
        source: START_SOURCE_ID,
        paint: {
          "circle-radius": 9,
          "circle-color": "#22c55e",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3,
        },
      });

      // Current position marker — updated each frame to ride the head of the
      // drawn route. Initialised at the start so it's never null.
      map.addSource(CURRENT_SOURCE_ID, {
        type: "geojson",
        data: startGeoJSON,
      });
      map.addLayer({
        id: CURRENT_LAYER_GLOW_ID,
        type: "circle",
        source: CURRENT_SOURCE_ID,
        paint: {
          "circle-radius": 28,
          "circle-color": "#ffffff",
          "circle-opacity": 0.4,
          "circle-blur": 1,
        },
      });
      map.addLayer({
        id: CURRENT_LAYER_ID,
        type: "circle",
        source: CURRENT_SOURCE_ID,
        paint: {
          "circle-radius": 11,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#7170ff",
          "circle-stroke-width": 4,
        },
      });
    });

    // Release the render as soon as the style is loaded + a short paint
    // grace, OR when the map goes idle, OR after a hard 20s safety timeout
    // — whichever happens first. Waiting for `idle` alone is unreliable in
    // headless Chromium because tile fetches from external CDNs (CARTO)
    // can stall indefinitely.
    let paintTimer: ReturnType<typeof setTimeout> | null = null;
    map.on("load", () => {
      // Give maplibre ~1.5s after `load` to paint the visible tiles, then
      // release the handle. Per-frame draws don't need new tiles in most
      // cases — we're at one camera position for the whole scene (or
      // smoothly panning along it in follow mode).
      paintTimer = setTimeout(() => safelyContinue(), 1500);
    });
    map.once("idle", () => {
      map.resize();
      safelyContinue();
    });
    const safetyTimer = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn(
        "maplibre safety timeout fired — releasing render with whatever tiles loaded.",
      );
      safelyContinue();
    }, 20_000);

    return () => {
      if (paintTimer) clearTimeout(paintTimer);
      clearTimeout(safetyTimer);
      // If we tear down before either event fires (e.g. component unmount
      // during dev hot-reload), still release so we don't leak handles.
      safelyContinue();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-frame: grow the route polyline AND move the "current location" marker
  // from the same index, so the head of the line and the marker are always
  // at the exact same coordinate. When `mode === "follow"`, also pan the
  // camera each frame so the marker stays roughly centered.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(ROUTE_LAYER_ID)) return;
    if (coords.length === 0) return;

    // Draw progress: starts a beat after fade-in, finishes shortly before
    // the scene ends.
    const drawProgress = interpolate(
      frame,
      [15, durationFrames - 25],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

    const idx = Math.min(
      coords.length - 1,
      Math.max(0, Math.round((coords.length - 1) * drawProgress)),
    );

    // Slice through idx (inclusive). Always include at least one point so
    // line-cap "round" gives us a tiny dot at the very start.
    const drawnCoords = coords.slice(0, idx + 1);

    const routeSrc = map.getSource(ROUTE_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (routeSrc) {
      routeSrc.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: drawnCoords },
      });
    }

    const currentSrc = map.getSource(CURRENT_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (currentSrc) {
      currentSrc.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: coords[idx] },
      });
    }

    // Follow-camera: move the camera each frame so the runner marker stays
    // centered. We start from the user's framed camera (so the very first
    // frame matches the static preview), then ease into a tighter follow
    // zoom that flies along with the marker. Bearing/pitch are preserved
    // from the framed camera so the user's chosen "look" is respected.
    if (mode === "follow") {
      // Linear ease into the follow zoom over the first ~half-second of the
      // draw. Avoids a jarring instant zoom on frame 1.
      const zoomEaseProgress = interpolate(
        frame,
        [0, 18],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
      // 1.5 zoom levels tighter than the framed camera by default — enough
      // to feel like a fly-along without losing context. Capped at 17 so
      // we never punch through the basemap's max detail.
      const followZoom = Math.min(17, camera.zoom + 1.5);
      const targetZoom =
        camera.zoom + (followZoom - camera.zoom) * zoomEaseProgress;

      const [lng, lat] = coords[idx];
      map.jumpTo({
        center: [lng, lat],
        zoom: targetZoom,
        bearing: camera.bearing,
        pitch: camera.pitch,
      });
    }
  }, [frame, durationFrames, coords, mode, camera]);

  const titleOpacity = interpolate(
    frame,
    [0, 20, durationFrames - 25, durationFrames - 5],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const distanceKm = (distanceMeters / 1000).toFixed(2);
  const minutes = Math.round(durationSeconds / 60);
  const formattedDate = new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#08090a" }}>
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          padding: 60,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          opacity: titleOpacity,
          color: "#ffffff",
          fontFamily:
            "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 500,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
              textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            }}
          >
            {sport}
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              marginTop: 12,
              textShadow: "0 4px 18px rgba(0,0,0,0.7)",
            }}
          >
            {formattedDate}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 48,
            fontSize: 30,
            fontWeight: 600,
            textShadow: "0 4px 18px rgba(0,0,0,0.7)",
          }}
        >
          <span>{distanceKm} km</span>
          <span>{minutes} min</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Top-level Map composition: a maplibre map scene followed by an animated
 * stats card (matches the cinematic style's stats outro).
 */
export const WorkoutRouteMap: React.FC<WorkoutMapVideoProps> = (props) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#08090a" }}>
      <Sequence from={0} durationInFrames={MAP_SCENE_FRAMES}>
        <MapScene {...props} durationFrames={MAP_SCENE_FRAMES} />
      </Sequence>
      <Sequence
        from={MAP_SCENE_FRAMES}
        durationInFrames={STATS_SCENE_FRAMES}
      >
        <StatsScene
          durationSeconds={props.durationSeconds}
          distanceMeters={props.distanceMeters}
          avgPaceSecPerKm={props.avgPaceSecPerKm}
          totalElevGainMeters={props.totalElevGainMeters}
          durationFrames={STATS_SCENE_FRAMES}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
