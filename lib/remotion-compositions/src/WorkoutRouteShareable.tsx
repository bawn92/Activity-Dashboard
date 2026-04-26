import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import type { WorkoutVideoProps } from "./types";
import { IntroScene } from "./scenes/IntroScene";
import { RouteScene } from "./scenes/RouteScene";
import { StatsScene } from "./scenes/StatsScene";
import { FinalCardScene } from "./scenes/FinalCardScene";

// 12s @ 30fps → 360 frames split into four scenes:
// Intro:    0..45    (1.5s)
// Route:    45..210  (5.5s)
// Stats:    210..300 (3.0s)
// Final:    300..360 (2.0s)
const FPS = 30;
const INTRO_FRAMES = Math.round(1.5 * FPS); // 45
const ROUTE_FRAMES = Math.round(5.5 * FPS); // 165
const STATS_FRAMES = Math.round(3.0 * FPS); // 90
const FINAL_FRAMES = Math.round(2.0 * FPS); // 60

export const WORKOUT_VIDEO_TOTAL_FRAMES =
  INTRO_FRAMES + ROUTE_FRAMES + STATS_FRAMES + FINAL_FRAMES;

export const WorkoutRouteShareable: React.FC<WorkoutVideoProps> = (props) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#08090a", fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <Sequence from={0} durationInFrames={INTRO_FRAMES}>
        <IntroScene
          brandName={props.brandName}
          sport={props.sport}
          date={props.date}
          durationFrames={INTRO_FRAMES}
        />
      </Sequence>

      <Sequence from={INTRO_FRAMES} durationInFrames={ROUTE_FRAMES}>
        <RouteScene
          routePoints={props.routePoints}
          durationFrames={ROUTE_FRAMES}
        />
      </Sequence>

      <Sequence
        from={INTRO_FRAMES + ROUTE_FRAMES}
        durationInFrames={STATS_FRAMES}
      >
        <StatsScene
          durationSeconds={props.durationSeconds}
          distanceMeters={props.distanceMeters}
          avgPaceSecPerKm={props.avgPaceSecPerKm}
          totalElevGainMeters={props.totalElevGainMeters}
          durationFrames={STATS_FRAMES}
        />
      </Sequence>

      <Sequence
        from={INTRO_FRAMES + ROUTE_FRAMES + STATS_FRAMES}
        durationInFrames={FINAL_FRAMES}
      >
        <FinalCardScene
          brandName={props.brandName}
          sport={props.sport}
          date={props.date}
          durationSeconds={props.durationSeconds}
          distanceMeters={props.distanceMeters}
          avgPaceSecPerKm={props.avgPaceSecPerKm}
          totalElevGainMeters={props.totalElevGainMeters}
          routePoints={props.routePoints}
          durationFrames={FINAL_FRAMES}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
