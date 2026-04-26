import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export const MAP_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const FPS = 30;
// Scene timing (30fps):
//   Map draw:  0..240   (8.0s)
//   Stats:     240..330 (3.0s)
export const MAP_SCENE_FRAMES = Math.round(8.0 * FPS); // 240
export const STATS_SCENE_FRAMES = Math.round(3.0 * FPS); // 90
export const MAP_VIDEO_TOTAL_FRAMES = MAP_SCENE_FRAMES + STATS_SCENE_FRAMES; // 330

interface PixelCoord {
  x: number;
  y: number;
}

interface MapSceneProps extends WorkoutMapVideoProps {
  durationFrames: number;
}

/**
 * MapScene — snapshot strategy:
 *
 * 1. A hidden maplibre instance loads the basemap tiles and renders them to a
 *    WebGL canvas (GPU/software, doesn't matter — happens only once).
 * 2. After the map fires `load` (+ a short paint grace), `idle`, or a 20 s
 *    safety timeout (whichever fires first), we:
 *      a. Capture the canvas as a PNG data-URL (the basemap snapshot).
 *      b. Project every GPS coordinate to pixel space with `map.project()`.
 *      c. Store both in React state and release the `delayRender` handle.
 * 3. Every subsequent frame renders a plain <img> (the snapshot) with an SVG
 *    polyline + circle markers drawn on top — zero WebGL per frame.
 * 4. Follow-camera mode uses a CSS `translate + scale` transform on the
 *    basemap+SVG container to simulate the camera panning along the route,
 *    no tile fetches or GPU work required.
 *
 * This eliminates the per-frame `ReadPixels` GPU stall that caused production
 * timeout failures when Chromium fell back to software WebGL.
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
  const mode: "static" | "follow" =
    cameraMode === "follow" ? "follow" : "static";
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // delayRender is released only once the basemap snapshot is in React state.
  const [handle] = useState(() =>
    delayRender("Taking basemap snapshot", { timeoutInMilliseconds: 60_000 }),
  );
  const releasedRef = useRef(false);
  const snapshotTakenRef = useRef(false);

  // Basemap PNG data-URL captured from the maplibre canvas after load.
  const [basemapUrl, setBasemapUrl] = useState<string | null>(null);
  // All GPS coords projected to canvas pixel space at the initial camera.
  const [pixelCoords, setPixelCoords] = useState<PixelCoord[]>([]);

  // Filtered list of valid [lng, lat] tuples.
  const coords = useMemo<Array<[number, number]>>(
    () =>
      routePoints
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map((p) => [p.lng, p.lat] as [number, number]),
    [routePoints],
  );

  // Release the delayRender handle only after React has committed the snapshot
  // state, so Remotion sees the <img> on frame 0 instead of a blank canvas.
  useEffect(() => {
    if (!basemapUrl || pixelCoords.length === 0) return;
    if (releasedRef.current) return;
    releasedRef.current = true;
    continueRender(handle);
  }, [basemapUrl, pixelCoords, handle]);

  // Snapshot helper — called at most once (guarded by snapshotTakenRef).
  const trySnapshot = useCallback(() => {
    if (snapshotTakenRef.current) return;
    snapshotTakenRef.current = true;

    const map = mapRef.current;
    if (!map) {
      if (!releasedRef.current) {
        releasedRef.current = true;
        continueRender(handle);
      }
      return;
    }

    try {
      const url = map.getCanvas().toDataURL("image/png");
      const projected = coords.map(([lng, lat]) => {
        const pt = map.project([lng, lat] as maplibregl.LngLatLike);
        return { x: pt.x, y: pt.y };
      });
      setBasemapUrl(url);
      setPixelCoords(projected);
      // continueRender is deferred to the useEffect above so it fires after
      // the state update is committed.
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[map-snapshot] canvas capture failed, releasing render", err);
      if (!releasedRef.current) {
        releasedRef.current = true;
        continueRender(handle);
      }
    }
  }, [coords, handle]);

  // Initialise the hidden maplibre instance, wait for tiles, then snapshot.
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
      preserveDrawingBuffer: true, // required for toDataURL()
    });
    mapRef.current = map;
    map.resize();

    map.on("error", (e) => {
      // Tile failures must not abort the snapshot.
      // eslint-disable-next-line no-console
      console.warn("[map-snapshot] tile error (ignored):", e?.error?.message);
    });

    let paintTimer: ReturnType<typeof setTimeout> | null = null;

    map.on("load", () => {
      map.resize();
      // Give maplibre ~1.5 s after `load` to paint visible tiles, then
      // snapshot regardless. Waiting only for `idle` is unreliable in
      // headless Chromium because tile CDN fetches can stall indefinitely.
      paintTimer = setTimeout(() => trySnapshot(), 1500);
    });

    map.once("idle", () => {
      map.resize();
      if (paintTimer) {
        clearTimeout(paintTimer);
        paintTimer = null;
      }
      trySnapshot();
    });

    // Hard fallback: if neither load nor idle fires within 20 s, snapshot
    // whatever is on the canvas and continue.
    const safetyTimer = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn(
        "[map-snapshot] safety timeout — snapshotting with partial tiles",
      );
      trySnapshot();
    }, 20_000);

    return () => {
      if (paintTimer) clearTimeout(paintTimer);
      clearTimeout(safetyTimer);
      // Ensure the render handle is always released on cleanup.
      if (!releasedRef.current) {
        releasedRef.current = true;
        continueRender(handle);
      }
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Per-frame computation ──────────────────────────────────────────────────

  const drawProgress = interpolate(
    frame,
    [15, durationFrames - 25],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const totalPts = pixelCoords.length;
  const idx =
    totalPts === 0
      ? 0
      : Math.min(totalPts - 1, Math.max(0, Math.round((totalPts - 1) * drawProgress)));

  const drawnPixels = pixelCoords.slice(0, idx + 1);
  const currentPx: PixelCoord = pixelCoords[idx] ?? { x: 0, y: 0 };
  const startPx: PixelCoord = pixelCoords[0] ?? { x: 0, y: 0 };

  // Follow-camera: compute a CSS transform that pans + zooms the basemap+SVG
  // container so the current position marker stays centred on screen.
  // This is pure arithmetic — no GPU work, no tile fetches.
  let followTransform = "";
  if (mode === "follow" && totalPts > 0) {
    const zoomEase = interpolate(frame, [0, 18], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const followZoom = Math.min(17, camera.zoom + 1.5);
    const targetZoom = camera.zoom + (followZoom - camera.zoom) * zoomEase;
    const scale = Math.pow(2, targetZoom - camera.zoom);
    // translate so the current pixel maps to the screen centre.
    const tx = width / 2 - currentPx.x * scale;
    const ty = height / 2 - currentPx.y * scale;
    followTransform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  // Build SVG polyline point string from pixel coords.
  const polylinePoints = drawnPixels.map((p) => `${p.x},${p.y}`).join(" ");

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
      {/* Hidden maplibre container — only used for the one-time snapshot.
          Must remain in the DOM until the snapshot is taken; invisible to
          the final render output. */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          opacity: basemapUrl ? 0 : 1,
          pointerEvents: "none",
        }}
      />

      {/* Basemap snapshot + SVG route overlay — rendered every frame with no
          WebGL. For follow mode the whole layer is CSS-transformed to simulate
          the camera panning along the route. */}
      {basemapUrl && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              transformOrigin: "0 0",
              transform: followTransform || undefined,
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img
              src={basemapUrl}
              width={width}
              height={height}
              style={{ display: "block" }}
            />
            <svg
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                overflow: "visible",
              }}
              width={width}
              height={height}
            >
              <defs>
                <filter
                  id="line-glow"
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur
                    in="SourceGraphic"
                    stdDeviation="5"
                    result="blur"
                  />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter
                  id="dot-glow"
                  x="-200%"
                  y="-200%"
                  width="500%"
                  height="500%"
                >
                  <feGaussianBlur
                    in="SourceGraphic"
                    stdDeviation="7"
                    result="blur"
                  />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Route glow */}
              {drawnPixels.length > 1 && (
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="#7170ff"
                  strokeWidth={14}
                  strokeOpacity={0.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#line-glow)"
                />
              )}

              {/* Route line */}
              {drawnPixels.length > 1 && (
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Start marker — glow halo + solid dot */}
              <circle
                cx={startPx.x}
                cy={startPx.y}
                r={20}
                fill="#22c55e"
                fillOpacity={0.4}
                filter="url(#dot-glow)"
              />
              <circle
                cx={startPx.x}
                cy={startPx.y}
                r={9}
                fill="#22c55e"
                stroke="#ffffff"
                strokeWidth={3}
              />

              {/* Current position marker */}
              {idx > 0 && (
                <>
                  <circle
                    cx={currentPx.x}
                    cy={currentPx.y}
                    r={22}
                    fill="#ffffff"
                    fillOpacity={0.35}
                    filter="url(#dot-glow)"
                  />
                  <circle
                    cx={currentPx.x}
                    cy={currentPx.y}
                    r={11}
                    fill="#ffffff"
                    stroke="#7170ff"
                    strokeWidth={4}
                  />
                </>
              )}
            </svg>
          </div>
        </div>
      )}

      {/* Vignette gradient */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Title / stats overlay */}
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
    </AbsoluteFill>
  );
};

/**
 * Top-level Map composition: a maplibre snapshot scene followed by an
 * animated stats card (matches the cinematic style's stats outro).
 */
export const WorkoutRouteMap: React.FC<WorkoutMapVideoProps> = (props) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#08090a" }}>
      <Sequence from={0} durationInFrames={MAP_SCENE_FRAMES}>
        <MapScene {...props} durationFrames={MAP_SCENE_FRAMES} />
      </Sequence>
      <Sequence from={MAP_SCENE_FRAMES} durationInFrames={STATS_SCENE_FRAMES}>
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
