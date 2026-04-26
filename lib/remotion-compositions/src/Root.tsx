import React from "react";
import { Composition } from "remotion";
import {
  WorkoutRouteShareable,
  WORKOUT_VIDEO_TOTAL_FRAMES,
} from "./WorkoutRouteShareable";
import { DEFAULT_WORKOUT_PROPS } from "./types";

export const COMPOSITION_ID = "WorkoutRouteShareable";
export const COMPOSITION_WIDTH = 1080;
export const COMPOSITION_HEIGHT = 1920;
export const COMPOSITION_FPS = 30;

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id={COMPOSITION_ID}
        component={WorkoutRouteShareable}
        durationInFrames={WORKOUT_VIDEO_TOTAL_FRAMES}
        fps={COMPOSITION_FPS}
        width={COMPOSITION_WIDTH}
        height={COMPOSITION_HEIGHT}
        defaultProps={DEFAULT_WORKOUT_PROPS}
      />
    </>
  );
};
