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
      req.log.warn({ err: storageErr }, "Storage upload failed, continuing without file path");
    }

    let parsed;
    try {
      parsed = await parseFitBuffer(req.file.buffer);
    } catch (parseErr) {
      req.log.error({ err: parseErr }, "Failed to parse FIT file");
      res.status(422).json({ error: "Failed to parse .fit file" });
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

    res.status(201).json({
      id: newActivity.id,
      sport: newActivity.sport,
      startTime: newActivity.startTime.toISOString(),
      durationSeconds: newActivity.durationSeconds ?? undefined,
      distanceMeters: newActivity.distanceMeters ?? undefined,
      avgSpeedMps: newActivity.avgSpeedMps ?? undefined,
      avgPaceSecPerKm: newActivity.avgPaceSecPerKm ?? undefined,
      totalElevGainMeters: newActivity.totalElevGainMeters ?? undefined,
    });
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
