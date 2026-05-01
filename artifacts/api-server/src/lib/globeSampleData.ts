/**
 * Sample globe payload: start location + stylized activity paths [[lon, lat], ...].
 * Same contract as the former FastAPI `/data` response.
 */
export type GlobeActivity = {
  sport: "run" | "cycle" | "swim";
  path: [number, number][];
};

export type GlobeDataResponse = {
  start: { name: string; lat: number; lon: number };
  activities: GlobeActivity[];
};

export const globeSampleData: GlobeDataResponse = {
  start: { name: "Galway", lat: 53.2707, lon: -9.0568 },
  activities: [
    {
      sport: "run",
      path: [
        [-9.0568, 53.2707],
        [-9.045, 53.275],
        [-9.03, 53.268],
        [-9.04, 53.262],
        [-9.0568, 53.2707],
      ],
    },
    {
      sport: "cycle",
      path: [
        [-9.0568, 53.2707],
        [-8.5, 53.35],
        [-7.9, 53.4],
        [-6.25, 53.35],
      ],
    },
    {
      sport: "swim",
      path: [
        [-9.07, 53.26],
        [-9.065, 53.255],
        [-9.055, 53.258],
        [-9.05, 53.265],
        [-9.06, 53.268],
      ],
    },
    {
      sport: "run",
      path: [
        [-9.0568, 53.2707],
        [-15.0, 50.0],
        [-40.0, 35.0],
        [-74.0, 40.7],
      ],
    },
    {
      sport: "cycle",
      path: [
        [-9.0568, 53.2707],
        [2.35, 48.86],
        [139.69, 35.69],
        [151.2, -33.87],
      ],
    },
    {
      sport: "swim",
      path: [
        [-9.0568, 53.2707],
        [12.5, 41.9],
        [18.0, 42.5],
        [24.0, 37.5],
      ],
    },
  ],
};
