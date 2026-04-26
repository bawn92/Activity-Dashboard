import React, { useMemo } from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
import {
  normalizeRoute,
  pointsToPath,
  pointAtProgress,
  type LatLng,
} from "../utils/normalizeRoute";

interface RoutePathProps {
  points: LatLng[];
  width: number;
  height: number;
  padding?: number;
  /** Frame at which the route starts drawing. */
  startFrame: number;
  /** Frames the draw animation takes. */
  drawDurationFrames: number;
  /** Hex/rgba color of the route stroke. */
  stroke?: string;
  /** Color of the soft glow behind the stroke. */
  glow?: string;
  /** Color of the start dot. */
  startDot?: string;
  /** Color of the traveling head dot. */
  headDot?: string;
}

export const RoutePath: React.FC<RoutePathProps> = ({
  points,
  width,
  height,
  padding = 80,
  startFrame,
  drawDurationFrames,
  stroke = "#7170ff",
  glow = "rgba(113,112,255,0.55)",
  startDot = "#4ade80",
  headDot = "#ffffff",
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  // Memoize the projection — it's pure and frame-independent.
  const route = useMemo(
    () => normalizeRoute(points, width, height, padding),
    [points, width, height, padding],
  );

  if (route.points.length < 2 || route.pathLength === 0) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.4)",
          fontSize: 28,
        }}
      >
        No GPS data
      </div>
    );
  }

  // Draw progress: 0 at startFrame → 1 at startFrame + drawDurationFrames
  const drawProgress = interpolate(
    localFrame,
    [0, drawDurationFrames],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );

  // Subtle "alive" zoom while the route draws
  const zoom = interpolate(localFrame, [0, drawDurationFrames + 30], [1.04, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const dashOffset = route.pathLength * (1 - drawProgress);
  const head = pointAtProgress(route, drawProgress);
  const startPt = route.points[0];
  const path = pointsToPath(route.points);

  // Show the head dot only while the route is actively drawing.
  const showHead = drawProgress > 0.001 && drawProgress < 0.999;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        display: "block",
        transform: `scale(${zoom})`,
        transformOrigin: "50% 50%",
      }}
    >
      <defs>
        <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* Soft glow underlay */}
      <path
        d={path}
        fill="none"
        stroke={glow}
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={route.pathLength}
        strokeDashoffset={dashOffset}
        filter="url(#route-glow)"
        opacity={0.7}
      />

      {/* Main stroke */}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={route.pathLength}
        strokeDashoffset={dashOffset}
      />

      {/* Start dot — fades in with the draw */}
      <circle
        cx={startPt.x}
        cy={startPt.y}
        r={11}
        fill={startDot}
        opacity={Math.min(1, drawProgress * 6)}
      />
      <circle
        cx={startPt.x}
        cy={startPt.y}
        r={20}
        fill={startDot}
        opacity={Math.min(0.35, drawProgress * 2)}
        filter="url(#route-glow)"
      />

      {/* Traveling head dot */}
      {showHead && head && (
        <>
          <circle cx={head.x} cy={head.y} r={26} fill={headDot} opacity={0.35} filter="url(#route-glow)" />
          <circle cx={head.x} cy={head.y} r={10} fill={headDot} />
        </>
      )}
    </svg>
  );
};
