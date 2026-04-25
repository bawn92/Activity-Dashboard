import FitParser from "fit-file-parser";
import type { InsertActivity, InsertActivityDataPoint } from "@workspace/db";

const SEMICIRCLES_TO_DEGREES = 180 / Math.pow(2, 31);

export interface ParsedFitData {
  activity: InsertActivity;
  dataPoints: Omit<InsertActivityDataPoint, "activityId">[];
}

interface FitRecord {
  timestamp?: Date | string | number;
  position_lat?: number;
  position_long?: number;
  heart_rate?: number;
  cadence?: number;
  altitude?: number;
  speed?: number;
}

interface FitSession {
  sport?: string;
  start_time?: Date | string | number;
  total_elapsed_time?: number;
  total_timer_time?: number;
  total_distance?: number;
  avg_speed?: number;
  total_ascent?: number;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  total_calories?: number;
  avg_cadence?: number;
}

interface FitActivity {
  sessions?: FitSession[];
  records?: FitRecord[];
}

interface FitData {
  activity?: FitActivity;
}

export async function parseFitBuffer(buffer: Buffer): Promise<ParsedFitData> {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({
      speedUnit: "m/s",
      lengthUnit: "m",
      temperatureUnit: "celsius",
      elapsedRecordField: true,
      mode: "both",
    });

    parser.parse(buffer as unknown as ArrayBuffer, (error: string | undefined, data: FitData | undefined) => {
      if (error) {
        reject(new Error(`FIT parse error: ${error}`));
        return;
      }

      try {
        const session = data?.activity?.sessions?.[0];

        if (!session) {
          reject(new Error("FIT file contains no session data"));
          return;
        }

        const rawStartTime = session.start_time;
        if (!rawStartTime) {
          reject(new Error("FIT file session is missing a start time"));
          return;
        }

        const startTime: Date =
          rawStartTime instanceof Date ? rawStartTime : new Date(rawStartTime);

        if (isNaN(startTime.getTime())) {
          reject(new Error("FIT file contains an invalid start time"));
          return;
        }

        const rawSport = session.sport;
        if (!rawSport) {
          reject(new Error("FIT file session is missing sport type"));
          return;
        }

        const sport = String(rawSport);

        const records: FitRecord[] = data?.activity?.records ?? [];

        const durationSeconds: number | null =
          session.total_elapsed_time ?? session.total_timer_time ?? null;
        const distanceMeters: number | null = session.total_distance ?? null;
        const avgSpeedMps: number | null = session.avg_speed ?? null;
        const avgPaceSecPerKm: number | null =
          avgSpeedMps != null && avgSpeedMps > 0
            ? 1000 / avgSpeedMps
            : null;
        const totalElevGainMeters: number | null = session.total_ascent ?? null;
        const avgHeartRate: number | null = session.avg_heart_rate ?? null;
        const maxHeartRate: number | null = session.max_heart_rate ?? null;
        const totalCalories: number | null = session.total_calories ?? null;
        const avgCadence: number | null = session.avg_cadence ?? null;

        const dataPoints: Omit<InsertActivityDataPoint, "activityId">[] = records
          .filter((r) => r.timestamp != null)
          .map((r) => {
            const rawTs = r.timestamp as Date | string | number;
            const ts: Date = rawTs instanceof Date ? rawTs : new Date(rawTs);

            let lat: number | null = null;
            let lng: number | null = null;
            if (r.position_lat != null && r.position_long != null) {
              lat = r.position_lat * SEMICIRCLES_TO_DEGREES;
              lng = r.position_long * SEMICIRCLES_TO_DEGREES;
            }

            return {
              timestamp: ts,
              heartRate: r.heart_rate != null ? Number(r.heart_rate) : null,
              cadence: r.cadence != null ? Number(r.cadence) : null,
              altitude: r.altitude != null ? Number(r.altitude) : null,
              lat,
              lng,
              speed: r.speed != null ? Number(r.speed) : null,
            };
          });

        resolve({
          activity: {
            sport,
            startTime,
            durationSeconds,
            distanceMeters,
            avgSpeedMps,
            avgPaceSecPerKm,
            totalElevGainMeters,
            avgHeartRate,
            maxHeartRate,
            totalCalories,
            avgCadence,
            fileObjectPath: null,
          },
          dataPoints,
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}
