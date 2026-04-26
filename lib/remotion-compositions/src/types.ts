import type { LatLng } from "./utils/normalizeRoute";

export interface MapCamera {
  centerLat: number;
  centerLng: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

export type WorkoutVideoProps = {
  title: string;
  sport: string;
  date: string;
  durationSeconds: number;
  distanceMeters: number;
  avgPaceSecPerKm: number | null;
  totalElevGainMeters: number | null;
  routePoints: LatLng[];
  brandName: string;
} & Record<string, unknown>;

export type WorkoutMapVideoProps = WorkoutVideoProps & {
  camera: MapCamera;
};

export const DEFAULT_WORKOUT_PROPS: WorkoutVideoProps = {
  title: "Morning Run",
  sport: "running",
  date: new Date().toISOString(),
  durationSeconds: 3000,
  distanceMeters: 8000,
  avgPaceSecPerKm: 375,
  totalElevGainMeters: 80,
  routePoints: [],
  brandName: "Fitness Logbook",
};

// Route through Golden Gate Park (SF) so the demo composition has something
// recognisable to render at the default camera.
export const DEFAULT_MAP_WORKOUT_PROPS: WorkoutMapVideoProps = {
  ...DEFAULT_WORKOUT_PROPS,
  routePoints: [
    { lat: 37.7694, lng: -122.4862 },
    { lat: 37.77, lng: -122.475 },
    { lat: 37.7705, lng: -122.46 },
    { lat: 37.771, lng: -122.45 },
  ],
  camera: {
    centerLat: 37.77,
    centerLng: -122.47,
    zoom: 13,
    bearing: 0,
    pitch: 45,
  },
};
