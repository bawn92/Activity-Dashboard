import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { createHash } from "node:crypto";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";

const gunzipAsync = promisify(gunzip);
// Cap on decompressed .fit size: a Garmin .fit usually < 5MB, so 50MB is
// more than safe and prevents an accidental gzip bomb from blowing memory.
const MAX_DECOMPRESSED_SIZE = 50 * 1024 * 1024;
import { db, activitiesTable, activityDataPointsTable } from "@workspace/db";
import {
  GetActivityParams,
  DeleteActivityParams,
  GetActivityResponse,
  GetActivityStatsResponse,
  ListActivitiesResponse,
  UploadActivityBatchResponse,
} from "@workspace/api-zod";
import { parseFitBuffer, type ParsedFitData } from "../lib/fitParser";
import { parseTcxBuffer } from "../lib/tcxParser";
import { ObjectStorageService } from "../lib/objectStorage";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const objectStorageService = new ObjectStorageService();

const BATCH_SIZE = 10;

/**
 * Persist a single activity file end-to-end: dedupe by SHA-256 of raw bytes,
 * parse via the supplied parser, store the blob in object storage, and insert
 * the activity + data points. Accepts any parser that returns ParsedFitData,
 * so it works for both .fit and .tcx uploads.
 */
async function persistActivity(
  rawBuffer: Buffer,
  parseBuffer: (buf: Buffer) => Promise<ParsedFitData>,
): Promise<
  | { status: "duplicate"; activityId: number }
  | { status: "created"; activityId: number }
> {
  const fileHash = createHash("sha256").update(rawBuffer).digest("hex");

  const [existing] = await db
    .select({ id: activitiesTable.id })
    .from(activitiesTable)
    .where(eq(activitiesTable.fileHash, fileHash))
    .limit(1);

  if (existing) {
    return { status: "duplicate", activityId: existing.id };
  }

  const parsed = await parseBuffer(rawBuffer);

  const uploadURL = await objectStorageService.getObjectEntityUploadURL();
  const fileObjectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
  const putResponse = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: rawBuffer,
  });
  if (!putResponse.ok) {
    throw new Error(`Storage upload failed: ${putResponse.status}`);
  }

  let newActivity: { id: number } | undefined;
  try {
    [newActivity] = await db
      .insert(activitiesTable)
      .values({ ...parsed.activity, fileObjectPath, fileHash })
      .returning({ id: activitiesTable.id });
  } catch (err) {
    // Race-safe dedup: another concurrent upload won the unique-index race.
    // Postgres reports unique-violation as SQLSTATE 23505. Re-fetch the
    // winner row and report this upload as a duplicate. Best-effort delete
    // the orphan blob we just uploaded.
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") {
      await objectStorageService.deleteObjectEntity(fileObjectPath).catch(() => {});
      const [winner] = await db
        .select({ id: activitiesTable.id })
        .from(activitiesTable)
        .where(eq(activitiesTable.fileHash, fileHash))
        .limit(1);
      if (winner) {
        return { status: "duplicate", activityId: winner.id };
      }
    }
    throw err;
  }

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

  return { status: "created", activityId: newActivity.id };
}

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
      totalElevDescMeters: a.totalElevDescMeters,
      maxSpeedMps: a.maxSpeedMps,
      avgHeartRate: a.avgHeartRate,
      maxHeartRate: a.maxHeartRate,
      totalCalories: a.totalCalories,
      avgCadence: a.avgCadence,
      avgPower: a.avgPower,
      normalizedPower: a.normalizedPower,
      avgVerticalOscillationMm: a.avgVerticalOscillationMm,
      avgStanceTimeMs: a.avgStanceTimeMs,
      avgVerticalRatio: a.avgVerticalRatio,
      avgStepLengthMm: a.avgStepLengthMm,
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

    const lowerName = req.file.originalname.toLowerCase();
    const isFit = lowerName.endsWith(".fit");
    const isTcx = lowerName.endsWith(".tcx");
    if (!isFit && !isTcx) {
      res.status(400).json({ error: "Only .fit and .tcx files are accepted" });
      return;
    }
    const parseBuffer = isTcx ? parseTcxBuffer : parseFitBuffer;

    // Compute SHA-256 of the raw bytes before doing any expensive work.
    // If this exact file was already uploaded we short-circuit and return the
    // existing activity so the user doesn't get duplicates.
    const fileHash = createHash("sha256").update(req.file.buffer).digest("hex");

    const [existing] = await db
      .select()
      .from(activitiesTable)
      .where(eq(activitiesTable.fileHash, fileHash))
      .limit(1);

    if (existing) {
      req.log.info({ activityId: existing.id }, "Duplicate upload detected, returning existing activity");
      const dataPoints = await db
        .select()
        .from(activityDataPointsTable)
        .where(eq(activityDataPointsTable.activityId, existing.id))
        .orderBy(activityDataPointsTable.timestamp);

      const result = GetActivityResponse.parse({
        id: existing.id,
        sport: existing.sport,
        startTime: existing.startTime,
        durationSeconds: existing.durationSeconds,
        distanceMeters: existing.distanceMeters,
        avgSpeedMps: existing.avgSpeedMps,
        avgPaceSecPerKm: existing.avgPaceSecPerKm,
        totalElevGainMeters: existing.totalElevGainMeters,
        totalElevDescMeters: existing.totalElevDescMeters,
        maxSpeedMps: existing.maxSpeedMps,
        avgHeartRate: existing.avgHeartRate,
        maxHeartRate: existing.maxHeartRate,
        totalCalories: existing.totalCalories,
        avgCadence: existing.avgCadence,
        avgPower: existing.avgPower,
        normalizedPower: existing.normalizedPower,
        avgVerticalOscillationMm: existing.avgVerticalOscillationMm,
        avgStanceTimeMs: existing.avgStanceTimeMs,
        avgVerticalRatio: existing.avgVerticalRatio,
        avgStepLengthMm: existing.avgStepLengthMm,
        fileObjectPath: existing.fileObjectPath,
        createdAt: existing.createdAt,
        dataPoints: dataPoints.map((p) => ({
          timestamp: p.timestamp,
          heartRate: p.heartRate,
          cadence: p.cadence,
          altitude: p.altitude,
          lat: p.lat,
          lng: p.lng,
          speed: p.speed,
          distance: p.distance,
          power: p.power,
        })),
      });

      res.status(200).json({ ...result, duplicate: true });
      return;
    }

    let parsed;
    try {
      parsed = await parseBuffer(req.file.buffer);
    } catch (parseErr) {
      req.log.error({ err: parseErr }, "Failed to parse activity file");
      const msg = parseErr instanceof Error ? parseErr.message : "Failed to parse file";
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
      res.status(500).json({ error: "Failed to store the file. Please try again." });
      return;
    }

    const [newActivity] = await db
      .insert(activitiesTable)
      .values({ ...parsed.activity, fileObjectPath, fileHash })
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
      totalElevDescMeters: newActivity.totalElevDescMeters,
      maxSpeedMps: newActivity.maxSpeedMps,
      avgHeartRate: newActivity.avgHeartRate,
      maxHeartRate: newActivity.maxHeartRate,
      totalCalories: newActivity.totalCalories,
      avgCadence: newActivity.avgCadence,
      avgPower: newActivity.avgPower,
      normalizedPower: newActivity.normalizedPower,
      avgVerticalOscillationMm: newActivity.avgVerticalOscillationMm,
      avgStanceTimeMs: newActivity.avgStanceTimeMs,
      avgVerticalRatio: newActivity.avgVerticalRatio,
      avgStepLengthMm: newActivity.avgStepLengthMm,
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
        distance: p.distance,
        power: p.power,
      })),
    });

    res.status(201).json(result);
  },
);

/**
 * Batch upload endpoint. Accepts up to BATCH_SIZE multipart files at once,
 * processes them sequentially (no concurrency), and returns per-file results
 * plus aggregate counts. Errors per file are caught so one bad file never
 * aborts the whole batch.
 */
router.post(
  "/activities/upload-batch",
  upload.array("files", BATCH_SIZE),
  async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "No files provided" });
      return;
    }

    const results: Array<{
      filename: string;
      status: "created" | "duplicate" | "failed";
      activityId?: number;
      error?: string;
    }> = [];
    let success = 0;
    let duplicate = 0;
    let failed = 0;

    for (const file of files) {
      const name = file.originalname;
      const lower = name.toLowerCase();
      const isGz = lower.endsWith(".fit.gz");
      const isFit = lower.endsWith(".fit");
      const isTcx = lower.endsWith(".tcx");

      if (!isGz && !isFit && !isTcx) {
        failed++;
        results.push({
          filename: name,
          status: "failed",
          error: "Only .fit, .fit.gz, and .tcx files are accepted",
        });
        continue;
      }

      try {
        if (file.size === 0 || file.buffer.length === 0) {
          throw new Error("File is empty");
        }

        // For .fit.gz: decompress first. Hash & store decompressed bytes so
        // a .fit and its .fit.gz dedupe to the same key. Cap decompressed size
        // to prevent a gzip bomb from blowing out memory.
        let rawBuffer: Buffer;
        if (isGz) {
          try {
            rawBuffer = await gunzipAsync(file.buffer, {
              maxOutputLength: MAX_DECOMPRESSED_SIZE,
            });
          } catch (gzErr) {
            const msg = gzErr instanceof Error ? gzErr.message : "gunzip failed";
            throw new Error(`Failed to decompress: ${msg}`);
          }
        } else {
          rawBuffer = file.buffer;
        }

        const parser = isTcx ? parseTcxBuffer : parseFitBuffer;
        const result = await persistActivity(rawBuffer, parser);
        if (result.status === "created") {
          success++;
          results.push({
            filename: name,
            status: "created",
            activityId: result.activityId,
          });
        } else {
          duplicate++;
          results.push({
            filename: name,
            status: "duplicate",
            activityId: result.activityId,
          });
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : "Unknown error";
        req.log.error({ err, filename: name }, "Batch upload: file failed");
        results.push({ filename: name, status: "failed", error: msg });
      }
    }

    const body = UploadActivityBatchResponse.parse({
      success,
      duplicate,
      failed,
      results,
    });
    res.status(200).json(body);
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
    totalElevDescMeters: activity.totalElevDescMeters,
    maxSpeedMps: activity.maxSpeedMps,
    avgHeartRate: activity.avgHeartRate,
    maxHeartRate: activity.maxHeartRate,
    totalCalories: activity.totalCalories,
    avgCadence: activity.avgCadence,
    avgPower: activity.avgPower,
    normalizedPower: activity.normalizedPower,
    avgVerticalOscillationMm: activity.avgVerticalOscillationMm,
    avgStanceTimeMs: activity.avgStanceTimeMs,
    avgVerticalRatio: activity.avgVerticalRatio,
    avgStepLengthMm: activity.avgStepLengthMm,
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
      distance: p.distance,
      power: p.power,
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
