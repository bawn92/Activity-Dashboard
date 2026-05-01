/**
 * "Around the World from Galway" globe payload.
 *
 * The visualization concept: starting in Galway, every kilometre you log in a
 * real activity extends a virtual journey eastward at Galway's latitude.
 * `journey` is the path you've travelled so far; `goalDistanceMeters` is the
 * full circumnavigation distance at that latitude (back to Galway).
 */

const EARTH_RADIUS_KM = 6371;
const GALWAY = { name: "Galway", lat: 53.2707, lon: -9.0568 };

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export type GlobeJourneyResponse = {
  start: { name: string; lat: number; lon: number };
  totalDistanceMeters: number;
  goalDistanceMeters: number;
  journey: [number, number][];
};

/** Length in metres of one degree of longitude at a given latitude. */
function metresPerDegreeLon(latDeg: number): number {
  return 2 * Math.PI * EARTH_RADIUS_KM * 1000 * Math.cos(latDeg * DEG2RAD) / 360;
}

/**
 * Build a path of [lon, lat] points starting at `start`, heading due east at
 * constant latitude, covering exactly `distanceMeters`. Wraps around the date
 * line as needed so the line keeps going east instead of jumping.
 */
export function buildEastwardJourney(
  start: { lat: number; lon: number },
  distanceMeters: number,
  stepKm = 50,
): [number, number][] {
  if (distanceMeters <= 0) return [[start.lon, start.lat]];

  const mPerDeg = metresPerDegreeLon(start.lat);
  const totalDeltaLonDeg = distanceMeters / mPerDeg;
  const stepDeg = (stepKm * 1000) / mPerDeg;
  const points: [number, number][] = [[start.lon, start.lat]];

  let coveredDeg = 0;
  while (coveredDeg < totalDeltaLonDeg) {
    coveredDeg = Math.min(coveredDeg + stepDeg, totalDeltaLonDeg);
    let lon = start.lon + coveredDeg;
    // Wrap into [-180, 180]; consumers can re-unwrap if needed for rendering.
    lon = ((((lon + 180) % 360) + 360) % 360) - 180;
    points.push([lon, start.lat]);
  }

  return points;
}

/** Full circumnavigation ring (back to start) at the start latitude. */
export function buildGoalRing(
  start: { lat: number; lon: number },
  segments = 180,
): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const dLon = (i / segments) * 360;
    let lon = start.lon + dLon;
    lon = ((((lon + 180) % 360) + 360) % 360) - 180;
    ring.push([lon, start.lat]);
  }
  return ring;
}

export function buildJourneyResponse(
  totalDistanceMeters: number,
): GlobeJourneyResponse {
  const safeTotal =
    Number.isFinite(totalDistanceMeters) && totalDistanceMeters > 0
      ? totalDistanceMeters
      : 0;
  const goalDistanceMeters = metresPerDegreeLon(GALWAY.lat) * 360;
  return {
    start: GALWAY,
    totalDistanceMeters: safeTotal,
    goalDistanceMeters,
    journey: buildEastwardJourney(GALWAY, safeTotal),
  };
}

export const GALWAY_START = GALWAY;
export { RAD2DEG };
