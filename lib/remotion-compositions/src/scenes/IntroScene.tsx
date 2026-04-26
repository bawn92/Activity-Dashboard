import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  Easing,
} from "remotion";
import { capitalize, formatDate } from "../utils/format";

interface IntroSceneProps {
  brandName: string;
  sport: string;
  date: string;
  durationFrames: number;
}

export const IntroScene: React.FC<IntroSceneProps> = ({
  brandName,
  sport,
  date,
  durationFrames,
}) => {
  const frame = useCurrentFrame();

  // Brand fades in 0–10, holds, then fades out near the end of the scene
  const brandOpacity = interpolate(
    frame,
    [0, 10, durationFrames - 12, durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Title slides up + fades in starting frame 8
  const titleProgress = interpolate(frame, [8, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const titleOpacity = interpolate(
    frame,
    [8, 22, durationFrames - 12, durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#08090a",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <div
        style={{
          opacity: brandOpacity,
          fontSize: 36,
          fontWeight: 500,
          letterSpacing: "0.4em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)",
          marginBottom: 64,
        }}
      >
        {brandName}
      </div>

      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${(1 - titleProgress) * 40}px)`,
          fontSize: 140,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "#ffffff",
          textAlign: "center",
          lineHeight: 1.05,
        }}
      >
        {capitalize(sport)}
      </div>

      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${(1 - titleProgress) * 24}px)`,
          marginTop: 24,
          fontSize: 38,
          fontWeight: 400,
          color: "rgba(255,255,255,0.55)",
        }}
      >
        {formatDate(date)}
      </div>

      {/* subtle accent bar */}
      <div
        style={{
          opacity: titleOpacity,
          marginTop: 56,
          width: 96,
          height: 4,
          background:
            "linear-gradient(90deg, rgba(113,112,255,0) 0%, #7170ff 50%, rgba(113,112,255,0) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
