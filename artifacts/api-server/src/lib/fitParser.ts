import FitParser from "fit-file-parser";
import type { InsertActivity, InsertActivityDataPoint } from "@workspace/db";

const SEMICIRCLES_TO_DEGREES = 180 / Math.pow(2, 31);

export interface ParsedFitData {
  activity: InsertActivity;
  dataPoints: Omit<InsertActivityDataPoint, "activityId">[];
}

export async function parseFitBuffer(buffer: Buffer): Promise<ParsedFitData> {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({
      force: true,
      speedUnit: "m/s",
      lengthUnit: "m",
      temperatureUnit: "celsius",
      elapsedRecordField: true,
      mode: "both",
    });

    parser.parse(buffer as unknown as ArrayBuffer, (error: any, data: any) => {
      if (error) {
        reject(new Error(`FIT parse error: ${error}`));
        return;
      }

      try {
        const session = data?.activity?.sessions?.[0] ?? {};
        const records: any[] = data?.activity?.records ?? [];

        const sport = (session.sport ?? "unknown") as string;
        const startTime: Date =
          session.start_time instanceof Date
            ? session.start_time
            : new Date(session.start_time ?? Date.now());

        const durationSeconds: number | undefined =
          session.total_elapsed_time ?? session.total_timer_time;
        const distanceMeters: number | undefined = session.total_distance;
        const avgSpeedMps: number | undefined = session.avg_speed;
        const avgPaceSecPerKm: number | undefined =
          avgSpeedMps && avgSpeedMps > 0
            ? 1000 / avgSpeedMps
            : undefined;
        const totalElevGainMeters: number | undefined = session.total_ascent;

        const dataPoints: Omit<InsertActivityDataPoint, "activityId">[] =
          records
            .filter((r: any) => r.timestamp)
            .map((r: any) => {
              const ts: Date =
                r.timestamp instanceof Date
                  ? r.timestamp
                  : new Date(r.timestamp);

              let lat: number | undefined;
              let lng: number | undefined;
              if (r.position_lat != null && r.position_long != null) {
                lat = r.position_lat * SEMICIRCLES_TO_DEGREES;
                lng = r.position_long * SEMICIRCLES_TO_DEGREES;
              }

              return {
                timestamp: ts,
                heartRate: r.heart_rate != null ? Number(r.heart_rate) : null,
                cadence: r.cadence != null ? Number(r.cadence) : null,
                altitude: r.altitude != null ? Number(r.altitude) : null,
                lat: lat ?? null,
                lng: lng ?? null,
                speed: r.speed != null ? Number(r.speed) : null,
              };
            });

        resolve({
          activity: {
            sport,
            startTime,
            durationSeconds: durationSeconds ?? null,
            distanceMeters: distanceMeters ?? null,
            avgSpeedMps: avgSpeedMps ?? null,
            avgPaceSecPerKm: avgPaceSecPerKm ?? null,
            totalElevGainMeters: totalElevGainMeters ?? null,
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
