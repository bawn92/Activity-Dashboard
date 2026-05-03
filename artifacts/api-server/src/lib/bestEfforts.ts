import { eq, and, sql } from "drizzle-orm";
import {
  db,
  activitiesTable,
  activityDataPointsTable,
  bestEffortsTable,
} from "@workspace/db";

export interface Benchmark {
  label: string;
  meters: number;
}

export const BENCHMARK_DISTANCES: Record<string, Benchmark[]> = {
  running: [
    { label: "400m", meters: 400 },
    { label: "1K", meters: 1000 },
    { label: "1 mile", meters: 1609 },
    { label: "2 mile", meters: 3218 },
    { label: "5K", meters: 5000 },
    { label: "10K", meters: 10000 },
    { label: "15K", meters: 15000 },
    { label: "10 mile", meters: 16093 },
    { label: "20K", meters: 20000 },
    { label: "Half Marathon", meters: 21097 },
    { label: "30K", meters: 30000 },
  ],
  cycling: [
    { label: "5 mile", meters: 8047 },
    { label: "10K", meters: 10000 },
    { label: "10 mile", meters: 16093 },
    { label: "20K", meters: 20000 },
    { label: "30K", meters: 30000 },
    { label: "40K", meters: 40000 },
    { label: "50K", meters: 50000 },
    { label: "80K", meters: 80000 },
    { label: "50 mile", meters: 80467 },
    { label: "100K", meters: 100000 },
    { label: "100 mile", meters: 160934 },
    { label: "180K", meters: 180000 },
  ],
};

export function getBenchmarksForSport(sport: string): Benchmark[] {
  return BENCHMARK_DISTANCES[sport.toLowerCase()] ?? [];
}

interface DataPoint {
  timestamp: Date;
  distance: number | null;
}

const MAX_REASONABLE_DISTANCE_M = 1_000_000_000;
const MAX_REASONABLE_SPEED_MPS = 30;

function isPlausibleDistance(d: number | null): d is number {
  return (
    d != null &&
    Number.isFinite(d) &&
    d >= 0 &&
    d <= MAX_REASONABLE_DISTANCE_M
  );
}

/**
 * Per-sport minimum plausible elapsed time for a benchmark distance. Anything
 * faster is treated as a corrupt-data artefact and rejected from best efforts.
 *
 * Tuned for a strong amateur ("99th percentile, not a record-breaker"):
 *
 * Running:
 *   - Sub-1km (the 400 m benchmark): floor at 60 s — comfortably faster than
 *     any non-elite amateur 400 m, but slower than world-class so genuine
 *     PRs aren't trimmed.
 *   - 1 km and longer: floor at 2:50 / km (170 s/km) avg pace. Anything
 *     faster than that over a kilometre or more is dropped.
 *
 * Other sports fall back to a generic 30 m/s ceiling (≈ 108 km/h), which
 * still catches the corrupt-distance class of bug without imposing
 * sport-specific caps the user hasn't asked for.
 */
function minPlausibleSeconds(sport: string, distanceM: number): number {
  const s = sport.toLowerCase();
  const isRunning = s === "running" || s.includes("run");
  if (isRunning) {
    if (distanceM < 1000) {
      return 60;
    }
    return (distanceM / 1000) * 170;
  }
  return distanceM / MAX_REASONABLE_SPEED_MPS;
}

function isPlausibleEffort(
  sport: string,
  distanceM: number,
  elapsedSec: number,
): boolean {
  if (elapsedSec <= 0) return false;
  return elapsedSec >= minPlausibleSeconds(sport, distanceM);
}

/**
 * Compute the best (minimum) elapsed time the activity achieved for each
 * benchmark distance, using a sliding-window scan over its data points.
 * Returns a Map keyed by benchmark distance (meters). Distances not reached
 * are absent from the map.
 */
export function computeBestTimesForPoints(
  rawPoints: DataPoint[],
  benchmarks: Benchmark[],
  sport: string,
): Map<number, number> {
  const result = new Map<number, number>();
  // Drop any points whose distance is corrupt before scanning so a single
  // garbage reading can't seed an impossibly-fast best effort.
  const points = rawPoints.filter((p) => isPlausibleDistance(p.distance));
  if (points.length < 2 || benchmarks.length === 0) return result;

  for (const { meters: targetDist } of benchmarks) {
    let best = Infinity;
    let i = 0;
    for (let j = 0; j < points.length; j++) {
      const dj = points[j].distance!;
      while (i < j) {
        const nextDi = points[i + 1]?.distance;
        if (nextDi == null) break;
        if (dj - nextDi >= targetDist) {
          i++;
        } else {
          break;
        }
      }
      const di = points[i].distance!;
      if (dj - di >= targetDist) {
        const elapsed =
          (points[j].timestamp.getTime() - points[i].timestamp.getTime()) /
          1000;
        if (
          elapsed > 0 &&
          elapsed < best &&
          isPlausibleEffort(sport, dj - di, elapsed)
        ) {
          best = elapsed;
        }
      }
    }
    if (isFinite(best)) {
      result.set(targetDist, best);
    }
  }
  return result;
}

/**
 * Recompute the best_efforts cache for a sport by scanning every activity of
 * that sport. Used for initial population and for invalidation events
 * (e.g., activity deletion) where a new bound may need to be discovered.
 */
export async function recomputeBestEffortsForSport(sport: string): Promise<void> {
  const benchmarks = getBenchmarksForSport(sport);
  if (benchmarks.length === 0) return;

  const activities = await db
    .select({ id: activitiesTable.id })
    .from(activitiesTable)
    .where(
      and(
        eq(activitiesTable.sport, sport),
        eq(activitiesTable.excludedFromStats, false),
      ),
    );

  // Track best time + activity id per distance.
  const best = new Map<number, { duration: number; activityId: number }>();

  for (const activity of activities) {
    const points = await db
      .select({
        timestamp: activityDataPointsTable.timestamp,
        distance: activityDataPointsTable.distance,
      })
      .from(activityDataPointsTable)
      .where(eq(activityDataPointsTable.activityId, activity.id))
      .orderBy(activityDataPointsTable.timestamp);

    const times = computeBestTimesForPoints(points, benchmarks, sport);
    for (const [dist, t] of times) {
      const cur = best.get(dist);
      if (!cur || t < cur.duration) {
        best.set(dist, { duration: t, activityId: activity.id });
      }
    }
  }

  // Replace the cache for this sport atomically: delete then insert one row
  // per benchmark (durationSeconds null when no activity reached that distance).
  await db.transaction(async (tx) => {
    await tx.delete(bestEffortsTable).where(eq(bestEffortsTable.sport, sport));
    await tx.insert(bestEffortsTable).values(
      benchmarks.map((b) => {
        const winner = best.get(b.meters);
        return {
          sport,
          distanceMeters: b.meters,
          label: b.label,
          durationSeconds: winner?.duration ?? null,
          activityId: winner?.activityId ?? null,
        };
      }),
    );
  });
}

/**
 * Update the best_efforts cache after a single activity is uploaded. Computes
 * just that activity's best times and updates the cache rows where the new
 * value beats (or replaces a missing) cached value. Falls back to a full
 * recompute if cache rows for this sport haven't been seeded yet.
 */
export async function updateBestEffortsForActivity(
  activityId: number,
  sport: string,
): Promise<void> {
  const benchmarks = getBenchmarksForSport(sport);
  if (benchmarks.length === 0) return;

  const existing = await db
    .select()
    .from(bestEffortsTable)
    .where(eq(bestEffortsTable.sport, sport));

  // Cache not yet seeded for this sport — do a full recompute (which also
  // accounts for this newly-inserted activity).
  if (existing.length === 0) {
    await recomputeBestEffortsForSport(sport);
    return;
  }

  const points = await db
    .select({
      timestamp: activityDataPointsTable.timestamp,
      distance: activityDataPointsTable.distance,
    })
    .from(activityDataPointsTable)
    .where(eq(activityDataPointsTable.activityId, activityId))
    .orderBy(activityDataPointsTable.timestamp);

  const times = computeBestTimesForPoints(points, benchmarks, sport);
  const byDist = new Map(existing.map((r) => [r.distanceMeters, r]));

  for (const b of benchmarks) {
    const newTime = times.get(b.meters);
    if (newTime == null) continue;
    const row = byDist.get(b.meters);
    if (!row) continue;
    if (row.durationSeconds == null || newTime < row.durationSeconds) {
      // Conditional update: only overwrite if our new time is still better
      // than whatever is currently in the row. Protects against concurrent
      // uploads racing and a slower time clobbering a faster one.
      await db
        .update(bestEffortsTable)
        .set({
          durationSeconds: newTime,
          activityId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bestEffortsTable.sport, sport),
            eq(bestEffortsTable.distanceMeters, b.meters),
            sql`(${bestEffortsTable.durationSeconds} IS NULL OR ${bestEffortsTable.durationSeconds} > ${newTime})`,
          ),
        );
    }
  }
}

/**
 * Read the best_efforts cache for a sport, populating it on first access if
 * it hasn't been seeded yet.
 */
export async function getBestEffortsForSport(
  sport: string,
): Promise<Array<{ distanceMeters: number; label: string; durationSeconds: number | null; activityId: number | null }>> {
  const benchmarks = getBenchmarksForSport(sport);
  if (benchmarks.length === 0) return [];

  let rows = await db
    .select()
    .from(bestEffortsTable)
    .where(eq(bestEffortsTable.sport, sport));

  // Self-heal a poisoned cache: if any cached row claims a time below the
  // sport's per-distance plausibility floor (e.g. running sub-2:50/km over
  // 1km+, or sub-60s for 400m), the cache was seeded from corrupt data
  // points or with looser limits, and must be rebuilt with the current
  // algorithm.
  const poisoned = rows.some(
    (r) =>
      r.durationSeconds != null &&
      !isPlausibleEffort(sport, r.distanceMeters, r.durationSeconds),
  );

  if (rows.length === 0 || poisoned) {
    await recomputeBestEffortsForSport(sport);
    rows = await db
      .select()
      .from(bestEffortsTable)
      .where(eq(bestEffortsTable.sport, sport));
  }

  const byDist = new Map(rows.map((r) => [r.distanceMeters, r]));
  return benchmarks.map((b) => {
    const row = byDist.get(b.meters);
    return {
      distanceMeters: b.meters,
      label: b.label,
      durationSeconds: row?.durationSeconds ?? null,
      activityId: row?.activityId ?? null,
    };
  });
}
