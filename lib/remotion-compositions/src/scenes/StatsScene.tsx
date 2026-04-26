import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { AnimatedStat } from "../components/AnimatedStat";

interface StatsSceneProps {
  durationSeconds: number;
  distanceMeters: number;
  avgPaceSecPerKm: number | null;
  totalElevGainMeters: number | null;
  durationFrames: number;
}

export const StatsScene: React.FC<StatsSceneProps> = ({
  durationSeconds,
  distanceMeters,
  avgPaceSecPerKm,
  totalElevGainMeters,
  durationFrames,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [0, 10, durationFrames - 12, durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const formatKm = (n: number) => `${(n / 1000).toFixed(2)} km`;
  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0)
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };
  const formatPace = (secPerKm: number) => {
    if (secPerKm <= 0) return "—";
    const m = Math.floor(secPerKm / 60);
    const s = Math.floor(secPerKm % 60);
    return `${m}:${s.toString().padStart(2, "0")} /km`;
  };
  const formatElev = (m: number) => `${Math.round(m)} m`;

  const countDur = Math.min(60, durationFrames - 24);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#08090a",
        opacity,
        padding: "120px 90px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 80,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(113,112,255,0.08), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <AnimatedStat
          label="Distance"
          target={distanceMeters}
          format={formatKm}
          startFrame={0}
          durationFrames={countDur}
        />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <AnimatedStat
          label="Time"
          target={durationSeconds}
          format={formatTime}
          startFrame={0}
          appearDelayFrames={6}
          durationFrames={countDur}
        />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <AnimatedStat
          label="Pace"
          target={avgPaceSecPerKm ?? 0}
          format={(n) =>
            avgPaceSecPerKm == null ? "—" : formatPace(n)
          }
          startFrame={0}
          appearDelayFrames={12}
          durationFrames={countDur}
        />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <AnimatedStat
          label="Elevation"
          target={totalElevGainMeters ?? 0}
          format={(n) =>
            totalElevGainMeters == null ? "—" : formatElev(n)
          }
          startFrame={0}
          appearDelayFrames={18}
          durationFrames={countDur}
        />
      </div>
    </AbsoluteFill>
  );
};
