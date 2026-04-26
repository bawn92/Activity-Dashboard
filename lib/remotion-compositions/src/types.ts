import type { LatLng } from "./utils/normalizeRoute";

export interface WorkoutVideoProps {
  title: string;
  sport: string;
  date: string;
  durationSeconds: number;
  distanceMeters: number;
  avgPaceSecPerKm: number | null;
  totalElevGainMeters: number | null;
  routePoints: LatLng[];
  brandName: string;
}

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
