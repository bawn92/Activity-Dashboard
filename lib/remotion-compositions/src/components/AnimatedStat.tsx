import React from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";

interface AnimatedStatProps {
  label: string;
  /** Numeric target value (e.g. 8.42 km, 312 bpm). Used for the count-up. */
  target: number;
  /** Function that turns the current animated number into the displayed string. */
  format: (n: number) => string;
  /** Frame at which the count starts. */
  startFrame: number;
  /** How many frames the count takes. */
  durationFrames: number;
  /** Stagger delay for "appear" so multiple stats reveal in sequence. */
  appearDelayFrames?: number;
  size?: "lg" | "md";
}

export const AnimatedStat: React.FC<AnimatedStatProps> = ({
  label,
  target,
  format,
  startFrame,
  durationFrames,
  appearDelayFrames = 0,
  size = "lg",
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame - appearDelayFrames;

  // Count-up: frame 0 → target, eased so the last few digits feel like they "settle"
  const value = interpolate(
    localFrame,
    [0, durationFrames],
    [0, target],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  // Slide-up + fade on appearance
  const opacity = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(localFrame, [0, 16], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const valueSize = size === "lg" ? 110 : 76;
  const labelSize = size === "lg" ? 26 : 22;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: labelSize,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: valueSize,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "#ffffff",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {format(value)}
      </div>
    </div>
  );
};
