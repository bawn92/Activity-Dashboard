/**
 * "Around the World from Galway" globe payload.
 *
 * The visualization concept: every kilometre logged in any activity extends a
 * virtual journey eastward along the equator, starting at Galway's longitude.
 * Activities are returned in chronological order so the frontend can colour
 * each segment by sport.
 */

const EQUATORIAL_RADIUS_KM = 6378.137;
const GALWAY = { name: "Galway", lat: 53.2707, lon: -9.0568 };

export type GlobeActivitySegment = {
  sport: string;
  distanceMeters: number;
};

export type GlobeJourneyResponse = {
  start: { name: string; lat: number; lon: number };
  totalDistanceMeters: number;
  goalDistanceMeters: number;
  activities: GlobeActivitySegment[];
};

/** Full equatorial circumference in metres. */
export function equatorialCircumferenceMeters(): number {
  return 2 * Math.PI * EQUATORIAL_RADIUS_KM * 1000;
}

export function buildJourneyResponse(
  totalDistanceMeters: number,
  activities: GlobeActivitySegment[],
): GlobeJourneyResponse {
  const safeTotal =
    Number.isFinite(totalDistanceMeters) && totalDistanceMeters > 0
      ? totalDistanceMeters
      : 0;
  return {
    start: GALWAY,
    totalDistanceMeters: safeTotal,
    goalDistanceMeters: equatorialCircumferenceMeters(),
    activities,
  };
}

export const GALWAY_START = GALWAY;
