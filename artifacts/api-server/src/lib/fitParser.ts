import FitParser from "fit-file-parser";
import type { InsertActivity, InsertActivityDataPoint } from "@workspace/db";

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
  enhanced_altitude?: number;
  speed?: number;
  enhanced_speed?: number;
  distance?: number;
  power?: number;
}

interface FitLap {
  records?: FitRecord[];
}

interface FitSession {
  sport?: string;
  start_time?: Date | string | number;
  total_elapsed_time?: number;
  total_timer_time?: number;
  total_distance?: number;
  avg_speed?: number;
  enhanced_avg_speed?: number;
  max_speed?: number;
  enhanced_max_speed?: number;
  total_ascent?: number;
  total_descent?: number;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  total_calories?: number;
  avg_cadence?: number;
  avg_power?: number;
  normalized_power?: number;
  avg_vertical_oscillation?: number;
  avg_stance_time?: number;
  avg_vertical_ratio?: number;
  avg_step_length?: number;
  laps?: FitLap[];
}

interface FitActivity {
  sessions?: FitSession[];
  records?: FitRecord[];
}

interface FitData {
  activity?: FitActivity;
}

function flattenRecords(data: FitData): FitRecord[] {
  const flatRecords = data.activity?.records;
  if (flatRecords && flatRecords.length > 0) return flatRecords;

  const records: FitRecord[] = [];
  for (const session of data.activity?.sessions ?? []) {
    for (const lap of session.laps ?? []) {
      for (const rec of lap.records ?? []) {
        records.push(rec);
      }
    }
  }
  return records;
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

        const records = flattenRecords(data!);

        const durationSeconds: number | null =
          session.total_elapsed_time ?? session.total_timer_time ?? null;
        const distanceMeters: number | null = session.total_distance ?? null;
        const avgSpeedMps: number | null =
          session.enhanced_avg_speed ?? session.avg_speed ?? null;
        const avgPaceSecPerKm: number | null =
          avgSpeedMps != null && avgSpeedMps > 0
            ? 1000 / avgSpeedMps
            : null;
        const totalElevGainMeters: number | null = session.total_ascent ?? null;
        const totalElevDescMeters: number | null = session.total_descent ?? null;
        const maxSpeedMps: number | null =
          session.enhanced_max_speed ?? session.max_speed ?? null;
        const avgHeartRate: number | null = session.avg_heart_rate ?? null;
        const maxHeartRate: number | null = session.max_heart_rate ?? null;
        const totalCalories: number | null = session.total_calories ?? null;
        const avgCadence: number | null = session.avg_cadence ?? null;
        const avgPower: number | null = session.avg_power ?? null;
        const normalizedPower: number | null = session.normalized_power ?? null;
        const avgVerticalOscillationMm: number | null =
          session.avg_vertical_oscillation ?? null;
        const avgStanceTimeMs: number | null = session.avg_stance_time ?? null;
        const avgVerticalRatio: number | null = session.avg_vertical_ratio ?? null;
        const avgStepLengthMm: number | null = session.avg_step_length ?? null;

        const dataPoints: Omit<InsertActivityDataPoint, "activityId">[] = records
          .filter((r) => r.timestamp != null)
          .map((r) => {
            const rawTs = r.timestamp as Date | string | number;
            const ts: Date = rawTs instanceof Date ? rawTs : new Date(rawTs);

            const lat: number | null =
              r.position_lat != null ? Number(r.position_lat) : null;
            const lng: number | null =
              r.position_long != null ? Number(r.position_long) : null;

            const altitudeRaw = r.enhanced_altitude ?? r.altitude;
            const speedRaw = r.enhanced_speed ?? r.speed;

            return {
              timestamp: ts,
              heartRate: r.heart_rate != null ? Number(r.heart_rate) : null,
              cadence: r.cadence != null ? Number(r.cadence) : null,
              altitude: altitudeRaw != null ? Number(altitudeRaw) : null,
              lat,
              lng,
              speed: speedRaw != null ? Number(speedRaw) : null,
              distance: (() => {
                if (r.distance == null) return null;
                const d = Number(r.distance);
                if (!Number.isFinite(d) || d < 0 || d > 1_000_000_000) return null;
                return d;
              })(),
              power: r.power != null ? Number(r.power) : null,
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
            totalElevDescMeters,
            maxSpeedMps,
            avgHeartRate,
            maxHeartRate,
            totalCalories,
            avgCadence,
            avgPower,
            normalizedPower,
            avgVerticalOscillationMm,
            avgStanceTimeMs,
            avgVerticalRatio,
            avgStepLengthMm,
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
