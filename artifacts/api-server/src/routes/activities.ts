import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { db, activitiesTable, activityDataPointsTable } from "@workspace/db";
import {
  GetActivityParams,
  DeleteActivityParams,
  GetActivityResponse,
  GetActivityStatsResponse,
  ListActivitiesResponse,
} from "@workspace/api-zod";
import { parseFitBuffer } from "../lib/fitParser";
import { ObjectStorageService } from "../lib/objectStorage";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const objectStorageService = new ObjectStorageService();

router.get("/activities", async (req: Request, res: Response) => {
  const activities = await db
    .select()
    .from(activitiesTable)
    .orderBy(desc(activitiesTable.startTime));

  const parsed = ListActivitiesResponse.safeParse(
    activities.map((a) => ({
      id: a.id,
      sport: a.sport,
      startTime: a.startTime,
      durationSeconds: a.durationSeconds,
      distanceMeters: a.distanceMeters,
      avgSpeedMps: a.avgSpeedMps,
      avgPaceSecPerKm: a.avgPaceSecPerKm,
      totalElevGainMeters: a.totalElevGainMeters,
      avgHeartRate: a.avgHeartRate,
      maxHeartRate: a.maxHeartRate,
      totalCalories: a.totalCalories,
      avgCadence: a.avgCadence,
      createdAt: a.createdAt,
    })),
  );

  if (!parsed.success) {
    req.log.error({ err: parsed.error }, "Failed to serialize activities");
    res.status(500).json({ error: "Serialization error" });
    return;
  }

  res.json(parsed.data);
});

router.post(
  "/activities/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    if (
      !req.file.originalname.toLowerCase().endsWith(".fit") &&
      req.file.mimetype !== "application/octet-stream"
    ) {
      res.status(400).json({ error: "Only .fit files are accepted" });
      return;
    }

    let parsed;
    try {
      parsed = await parseFitBuffer(req.file.buffer);
    } catch (parseErr) {
      req.log.error({ err: parseErr }, "Failed to parse FIT file");
      const msg = parseErr instanceof Error ? parseErr.message : "Failed to parse .fit file";
      res.status(422).json({ error: msg });
      return;
    }

    let fileObjectPath: string | null = null;
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      fileObjectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      const putResponse = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: req.file.buffer,
      });

      if (!putResponse.ok) {
        throw new Error(`Storage upload failed: ${putResponse.status}`);
      }
    } catch (storageErr) {
      req.log.error({ err: storageErr }, "Object storage upload failed");
      res.status(500).json({ error: "Failed to store the .fit file. Please try again." });
      return;
    }

    const [newActivity] = await db
      .insert(activitiesTable)
      .values({ ...parsed.activity, fileObjectPath })
      .returning();

    if (parsed.dataPoints.length > 0) {
      const points = parsed.dataPoints.map((p) => ({
        ...p,
        activityId: newActivity.id,
      }));
      const BATCH = 500;
      for (let i = 0; i < points.length; i += BATCH) {
        await db
          .insert(activityDataPointsTable)
          .values(points.slice(i, i + BATCH));
      }
    }

    const insertedDataPoints = parsed.dataPoints.map((p, idx) => ({
      id: idx,
      activityId: newActivity.id,
      ...p,
    }));

    const result = GetActivityResponse.parse({
      id: newActivity.id,
      sport: newActivity.sport,
      startTime: newActivity.startTime,
      durationSeconds: newActivity.durationSeconds,
      distanceMeters: newActivity.distanceMeters,
      avgSpeedMps: newActivity.avgSpeedMps,
      avgPaceSecPerKm: newActivity.avgPaceSecPerKm,
      totalElevGainMeters: newActivity.totalElevGainMeters,
      avgHeartRate: newActivity.avgHeartRate,
      maxHeartRate: newActivity.maxHeartRate,
      totalCalories: newActivity.totalCalories,
      avgCadence: newActivity.avgCadence,
      fileObjectPath: newActivity.fileObjectPath,
      createdAt: newActivity.createdAt,
      dataPoints: insertedDataPoints.map((p) => ({
        timestamp: p.timestamp,
        heartRate: p.heartRate,
        cadence: p.cadence,
        altitude: p.altitude,
        lat: p.lat,
        lng: p.lng,
        speed: p.speed,
      })),
    });

    res.status(201).json(result);
  },
);

router.get("/activities/stats", async (req: Request, res: Response) => {
  const activities = await db.select().from(activitiesTable);

  const totalActivities = activities.length;
  const totalDistanceMeters = activities.reduce(
    (sum, a) => sum + (a.distanceMeters ?? 0),
    0,
  );
  const totalDurationSeconds = activities.reduce(
    (sum, a) => sum + (a.durationSeconds ?? 0),
    0,
  );

  const sportCounts: Record<string, number> = {};
  for (const a of activities) {
    sportCounts[a.sport] = (sportCounts[a.sport] ?? 0) + 1;
  }
  const sportBreakdown = Object.entries(sportCounts).map(([sport, count]) => ({
    sport,
    count,
  }));

  const avgDistanceMeters =
    totalActivities > 0 ? totalDistanceMeters / totalActivities : 0;
  const avgDurationSeconds =
    totalActivities > 0 ? totalDurationSeconds / totalActivities : 0;

  const result = GetActivityStatsResponse.parse({
    totalActivities,
    totalDistanceMeters,
    totalDurationSeconds,
    avgDistanceMeters,
    avgDurationSeconds,
    sportBreakdown,
  });

  res.json(result);
});

router.get("/activities/:id", async (req: Request, res: Response) => {
  const params = GetActivityParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid activity ID" });
    return;
  }

  const [activity] = await db
    .select()
    .from(activitiesTable)
    .where(eq(activitiesTable.id, params.data.id));

  if (!activity) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  const dataPoints = await db
    .select()
    .from(activityDataPointsTable)
    .where(eq(activityDataPointsTable.activityId, params.data.id))
    .orderBy(activityDataPointsTable.timestamp);

  const result = GetActivityResponse.parse({
    id: activity.id,
    sport: activity.sport,
    startTime: activity.startTime,
    durationSeconds: activity.durationSeconds,
    distanceMeters: activity.distanceMeters,
    avgSpeedMps: activity.avgSpeedMps,
    avgPaceSecPerKm: activity.avgPaceSecPerKm,
    totalElevGainMeters: activity.totalElevGainMeters,
    avgHeartRate: activity.avgHeartRate,
    maxHeartRate: activity.maxHeartRate,
    totalCalories: activity.totalCalories,
    avgCadence: activity.avgCadence,
    fileObjectPath: activity.fileObjectPath,
    createdAt: activity.createdAt,
    dataPoints: dataPoints.map((p) => ({
      timestamp: p.timestamp,
      heartRate: p.heartRate,
      cadence: p.cadence,
      altitude: p.altitude,
      lat: p.lat,
      lng: p.lng,
      speed: p.speed,
    })),
  });

  res.json(result);
});

router.delete("/activities/:id", async (req: Request, res: Response) => {
  const params = DeleteActivityParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid activity ID" });
    return;
  }

  const [deleted] = await db
    .delete(activitiesTable)
    .where(eq(activitiesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  res.status(204).send();
});

export default router;
