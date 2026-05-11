import { db, activitiesTable, activityDataPointsTable } from "@workspace/db";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

const MAX_LIST = 100;
const MAX_DATA_POINTS = 500;

export const TRAINING_TOOLS = [
  {
    name: "list_activities",
    description:
      "List fitness activities with optional sport filter and date range on start_time (UTC).",
    inputSchema: {
      type: "object" as const,
      properties: {
        sport: { type: "string", description: "Filter by sport label" },
        limit: {
          type: "number",
          description: "Max rows (default 25, max 100)",
        },
        from: {
          type: "string",
          description: "ISO 8601 lower bound for start_time (inclusive)",
        },
        to: {
          type: "string",
          description: "ISO 8601 upper bound for start_time (inclusive)",
        },
      },
    },
  },
  {
    name: "get_training_stats",
    description:
      "Aggregate training volume: counts, total distance and duration; optional groupBy sport, week, or month (UTC buckets).",
    inputSchema: {
      type: "object" as const,
      properties: {
        from: { type: "string", description: "ISO 8601 start of range" },
        to: { type: "string", description: "ISO 8601 end of range" },
        groupBy: {
          type: "string",
          enum: ["none", "sport", "week", "month"],
          description: "Aggregation dimension",
        },
      },
    },
  },
  {
    name: "get_activity_detail",
    description:
      "Fetch one activity by id; optionally include recent GPS/HR data points (capped).",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "Activity primary key" },
        includeDataPoints: {
          type: "boolean",
          description: "Whether to include activity_data_points",
        },
        dataPointsLimit: {
          type: "number",
          description:
            "Max points when includeDataPoints (default 200, max 500)",
        },
      },
      required: ["id"],
    },
  },
];

export type TrainingToolName = (typeof TRAINING_TOOLS)[number]["name"];

export type TrainingToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

function parseArgs(
  raw: string | Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw !== "string") return raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "string") {
      return parseArgs(parsed);
    }
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function callTrainingTool(
  name: string,
  rawArgs: string | Record<string, unknown> | null | undefined,
): Promise<TrainingToolResult> {
  const args = parseArgs(rawArgs);

  try {
    if (name === "list_activities") {
      const sport =
        typeof args.sport === "string" && args.sport.trim()
          ? args.sport.trim()
          : undefined;
      let limit =
        typeof args.limit === "number" && Number.isFinite(args.limit)
          ? Math.floor(args.limit)
          : 25;
      limit = Math.min(Math.max(limit, 1), MAX_LIST);

      const conditions = [];
      if (sport) {
        conditions.push(eq(activitiesTable.sport, sport));
      }
      if (typeof args.from === "string" && args.from) {
        conditions.push(gte(activitiesTable.startTime, new Date(args.from)));
      }
      if (typeof args.to === "string" && args.to) {
        conditions.push(lte(activitiesTable.startTime, new Date(args.to)));
      }

      const where =
        conditions.length === 0
          ? undefined
          : conditions.length === 1
            ? conditions[0]
            : and(...conditions);

      const listBase = db
        .select({
          id: activitiesTable.id,
          sport: activitiesTable.sport,
          startTime: activitiesTable.startTime,
          durationSeconds: activitiesTable.durationSeconds,
          distanceMeters: activitiesTable.distanceMeters,
          avgHeartRate: activitiesTable.avgHeartRate,
          avgPower: activitiesTable.avgPower,
          normalizedPower: activitiesTable.normalizedPower,
          totalElevGainMeters: activitiesTable.totalElevGainMeters,
        })
        .from(activitiesTable);

      const rows = await (where ? listBase.where(where) : listBase)
        .orderBy(desc(activitiesTable.startTime))
        .limit(limit);

      return { ok: true, data: { activities: rows } };
    }

    if (name === "get_training_stats") {
      const conditions = [];
      if (typeof args.from === "string" && args.from) {
        conditions.push(gte(activitiesTable.startTime, new Date(args.from)));
      }
      if (typeof args.to === "string" && args.to) {
        conditions.push(lte(activitiesTable.startTime, new Date(args.to)));
      }
      const where =
        conditions.length === 0
          ? undefined
          : conditions.length === 1
            ? conditions[0]
            : and(...conditions);

      const groupBy =
        typeof args.groupBy === "string" &&
        ["none", "sport", "week", "month"].includes(args.groupBy)
          ? args.groupBy
          : "none";

      if (groupBy === "none") {
        const noneBase = db
          .select({
            activityCount: sql<number>`count(*)::int`,
            totalDistanceMeters: sql<number>`coalesce(sum(${activitiesTable.distanceMeters}), 0)::float`,
            totalDurationSeconds: sql<number>`coalesce(sum(${activitiesTable.durationSeconds}), 0)::float`,
          })
          .from(activitiesTable);
        const [row] = await (where ? noneBase.where(where) : noneBase);

        return {
          ok: true,
          data: {
            groupBy: "none",
            activityCount: row?.activityCount ?? 0,
            totalDistanceMeters: row?.totalDistanceMeters ?? 0,
            totalDurationSeconds: row?.totalDurationSeconds ?? 0,
          },
        };
      }

      if (groupBy === "sport") {
        const sportBase = db
          .select({
            sport: activitiesTable.sport,
            activityCount: sql<number>`count(*)::int`,
            totalDistanceMeters: sql<number>`coalesce(sum(${activitiesTable.distanceMeters}), 0)::float`,
            totalDurationSeconds: sql<number>`coalesce(sum(${activitiesTable.durationSeconds}), 0)::float`,
          })
          .from(activitiesTable);
        const rows = await (where ? sportBase.where(where) : sportBase)
          .groupBy(activitiesTable.sport)
          .orderBy(activitiesTable.sport);

        return { ok: true, data: { groupBy: "sport", buckets: rows } };
      }

      const bucket =
        groupBy === "week"
          ? sql<string>`date_trunc('week', ${activitiesTable.startTime} AT TIME ZONE 'UTC')::text`
          : sql<string>`date_trunc('month', ${activitiesTable.startTime} AT TIME ZONE 'UTC')::text`;

      const timeBase = db
        .select({
          bucketStart: bucket,
          activityCount: sql<number>`count(*)::int`,
          totalDistanceMeters: sql<number>`coalesce(sum(${activitiesTable.distanceMeters}), 0)::float`,
          totalDurationSeconds: sql<number>`coalesce(sum(${activitiesTable.durationSeconds}), 0)::float`,
        })
        .from(activitiesTable);
      const rows = await (where ? timeBase.where(where) : timeBase)
        .groupBy(bucket)
        .orderBy(bucket);

      return { ok: true, data: { groupBy, buckets: rows } };
    }

    if (name === "get_activity_detail") {
      const idRaw = args.id;
      const id = typeof idRaw === "number" ? idRaw : Number(String(idRaw));
      if (!Number.isInteger(id) || id <= 0) {
        return { ok: false, error: "Invalid id" };
      }

      const [activity] = await db
        .select()
        .from(activitiesTable)
        .where(eq(activitiesTable.id, id))
        .limit(1);

      if (!activity) {
        return { ok: false, error: `Activity ${id} not found` };
      }

      const include = args.includeDataPoints === true;
      let dpLimit = 200;
      if (
        typeof args.dataPointsLimit === "number" &&
        Number.isFinite(args.dataPointsLimit)
      ) {
        dpLimit = Math.min(
          Math.max(Math.floor(args.dataPointsLimit), 1),
          MAX_DATA_POINTS,
        );
      }

      if (!include) {
        return { ok: true, data: { activity } };
      }

      const pointsDesc = await db
        .select()
        .from(activityDataPointsTable)
        .where(eq(activityDataPointsTable.activityId, id))
        .orderBy(desc(activityDataPointsTable.timestamp))
        .limit(dpLimit);

      const points = [...pointsDesc].reverse();

      return { ok: true, data: { activity, dataPoints: points } };
    }

    return { ok: false, error: `Unknown tool: ${name}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export function trainingToolResultText(result: TrainingToolResult): string {
  return JSON.stringify(
    result.ok ? result.data : { error: result.error },
    null,
    2,
  );
}
