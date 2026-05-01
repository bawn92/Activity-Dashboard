import { XMLParser } from "fast-xml-parser";
import type { ParsedFitData } from "./fitParser";

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function normalizeSport(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/[_\s-]/g, "_");
  if (s === "running") return "running";
  if (s === "biking" || s === "cycling") return "cycling";
  if (s === "swimming") return "swimming";
  if (s === "hiking" || s === "walking") return "hiking";
  return s || "other";
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export async function parseTcxBuffer(buffer: Buffer): Promise<ParsedFitData> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) =>
      ["Activity", "Lap", "Track", "Trackpoint"].includes(name),
  });

  const doc = parser.parse(buffer.toString("utf-8"));

  // Root element may be namespaced (e.g. "ns2:TrainingCenterDatabase")
  const rootKey =
    Object.keys(doc).find((k) => k.includes("TrainingCenterDatabase")) ?? "";
  const root = doc[rootKey] ?? doc;

  const activities: unknown[] = toArray(root?.["Activities"]?.["Activity"]);
  if (activities.length === 0) {
    throw new Error("TCX file contains no activities");
  }

  const activity = activities[0] as Record<string, unknown>;
  const sport = normalizeSport(String(activity["@_Sport"] ?? ""));
  const laps = toArray(activity["Lap"] as Record<string, unknown>[] | undefined);

  if (laps.length === 0) {
    throw new Error("TCX activity contains no laps");
  }

  const rawStartTime =
    (laps[0] as Record<string, unknown>)["@_StartTime"] ?? activity["Id"];
  if (!rawStartTime) throw new Error("TCX file is missing a start time");

  const startTime = new Date(String(rawStartTime));
  if (isNaN(startTime.getTime()))
    throw new Error("TCX file contains an invalid start time");

  // ── Aggregate lap-level metrics ─────────────────────────────────────────────
  let totalDuration = 0;
  let totalDistance = 0;
  let totalCalories = 0;
  let maxSpeed: number | null = null;
  let maxHr: number | null = null;
  let sumHrDur = 0;
  let sumCadDur = 0;

  for (const lap of laps) {
    const l = lap as Record<string, unknown>;
    const dur = num(l["TotalTimeSeconds"]) ?? 0;
    totalDuration += dur;
    totalDistance += num(l["DistanceMeters"]) ?? 0;
    totalCalories += num(l["Calories"]) ?? 0;

    const ms = num(l["MaximumSpeed"]);
    if (ms != null && (maxSpeed == null || ms > maxSpeed)) maxSpeed = ms;

    const avgHrVal = num(
      (l["AverageHeartRateBpm"] as Record<string, unknown> | undefined)?.[
        "Value"
      ],
    );
    if (avgHrVal != null) sumHrDur += avgHrVal * dur;

    const maxHrVal = num(
      (l["MaximumHeartRateBpm"] as Record<string, unknown> | undefined)?.[
        "Value"
      ],
    );
    if (maxHrVal != null && (maxHr == null || maxHrVal > maxHr))
      maxHr = maxHrVal;

    const cad = num(l["Cadence"]);
    if (cad != null) sumCadDur += cad * dur;
  }

  const avgHr =
    totalDuration > 0 && sumHrDur > 0
      ? Math.round(sumHrDur / totalDuration)
      : null;
  const avgCadence =
    totalDuration > 0 && sumCadDur > 0
      ? Math.round(sumCadDur / totalDuration)
      : null;
  const avgSpeedMps =
    totalDuration > 0 && totalDistance > 0
      ? totalDistance / totalDuration
      : null;
  const avgPaceSecPerKm =
    avgSpeedMps != null && avgSpeedMps > 0 ? 1000 / avgSpeedMps : null;

  // ── Collect trackpoints ─────────────────────────────────────────────────────
  const dataPoints: ParsedFitData["dataPoints"] = [];
  let elevGain = 0;
  let elevDesc = 0;
  let prevAlt: number | null = null;

  for (const lap of laps) {
    const l = lap as Record<string, unknown>;
    for (const track of toArray(
      l["Track"] as Record<string, unknown>[] | undefined,
    )) {
      const t = track as Record<string, unknown>;
      for (const tp of toArray(
        t["Trackpoint"] as Record<string, unknown>[] | undefined,
      )) {
        const p = tp as Record<string, unknown>;
        const rawTime = p["Time"];
        if (!rawTime) continue;
        const ts = new Date(String(rawTime));
        if (isNaN(ts.getTime())) continue;

        const pos = p["Position"] as Record<string, unknown> | undefined;
        const lat = num(pos?.["LatitudeDegrees"]);
        const lng = num(pos?.["LongitudeDegrees"]);
        const alt = num(p["AltitudeMeters"]);
        const dist = num(p["DistanceMeters"]);
        const hr = num(
          (p["HeartRateBpm"] as Record<string, unknown> | undefined)?.[
            "Value"
          ],
        );
        const cadence = num(p["Cadence"]);

        // Speed from Extensions/TPX (namespace-agnostic key search)
        let speed: number | null = null;
        const ext = p["Extensions"] as Record<string, unknown> | undefined;
        if (ext) {
          const tpx = Object.values(ext).find(
            (v) =>
              v != null &&
              typeof v === "object" &&
              "Speed" in (v as Record<string, unknown>),
          ) as Record<string, unknown> | undefined;
          if (tpx) speed = num(tpx["Speed"]);
        }

        if (alt != null) {
          if (prevAlt != null) {
            const diff = alt - prevAlt;
            if (diff > 0) elevGain += diff;
            else elevDesc += -diff;
          }
          prevAlt = alt;
        }

        dataPoints.push({
          timestamp: ts,
          heartRate: hr,
          cadence,
          altitude: alt,
          lat,
          lng,
          speed,
          distance: dist,
          power: null,
        });
      }
    }
  }

  return {
    activity: {
      sport,
      startTime,
      durationSeconds: totalDuration > 0 ? totalDuration : null,
      distanceMeters: totalDistance > 0 ? totalDistance : null,
      avgSpeedMps,
      avgPaceSecPerKm,
      totalElevGainMeters: elevGain > 0 ? elevGain : null,
      totalElevDescMeters: elevDesc > 0 ? elevDesc : null,
      maxSpeedMps: maxSpeed,
      avgHeartRate: avgHr,
      maxHeartRate: maxHr,
      totalCalories: totalCalories > 0 ? totalCalories : null,
      avgCadence,
      avgPower: null,
      normalizedPower: null,
      avgVerticalOscillationMm: null,
      avgStanceTimeMs: null,
      avgVerticalRatio: null,
      avgStepLengthMm: null,
      fileObjectPath: null,
    },
    dataPoints,
  };
}
