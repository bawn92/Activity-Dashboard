import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { RoutePath } from "../components/RoutePath";
import type { LatLng } from "../utils/normalizeRoute";

interface RouteSceneProps {
  routePoints: LatLng[];
  durationFrames: number;
}

export const RouteScene: React.FC<RouteSceneProps> = ({
  routePoints,
  durationFrames,
}) => {
  const frame = useCurrentFrame();

  // Fade the entire scene in/out so the transitions feel smooth
  const opacity = interpolate(
    frame,
    [0, 10, durationFrames - 14, durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Reserve frames at the end for the route to "settle" before exit
  const drawDurationFrames = Math.max(30, durationFrames - 30);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#08090a",
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 60,
      }}
    >
      {/* Subtle gradient accent in the corner */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(113,112,255,0.10), transparent 60%), radial-gradient(ellipse 60% 40% at 50% 90%, rgba(74,222,128,0.06), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)",
          marginBottom: 32,
          zIndex: 1,
        }}
      >
        The Route
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <RoutePath
          points={routePoints}
          width={960}
          height={1280}
          padding={60}
          startFrame={0}
          drawDurationFrames={drawDurationFrames}
          stroke="#ffffff"
          glow="rgba(113,112,255,0.6)"
          startDot="#4ade80"
          headDot="#ffffff"
        />
      </div>
    </AbsoluteFill>
  );
};
