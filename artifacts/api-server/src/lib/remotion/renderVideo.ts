import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import {
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import { db, activitiesTable, activityDataPointsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { ObjectStorageService } from "../objectStorage";
import { getRemotionServeUrl } from "./bundle";
import { logger } from "../logger";

const COMPOSITION_ID = "WorkoutRouteShareable";
const objectStorage = new ObjectStorageService();

export interface RenderProgressUpdate {
  /** Progress in [0, 1]. Combined bundle + render progress. */
  progress: number;
  stage: "bundling" | "rendering" | "uploading";
}

export interface RenderResult {
  /** Object path inside Replit Object Storage, e.g. /objects/uploads/<id> */
  objectPath: string;
}

/**
 * Build the inputProps object the Remotion composition expects.
 * Pulled from this file (instead of the composition package) so the API
 * server fully owns the data shape it sends in.
 */
async function buildInputProps(activityId: number) {
  const [activity] = await db
    .select()
    .from(activitiesTable)
    .where(eq(activitiesTable.id, activityId))
    .limit(1);
  if (!activity) {
    throw new Error(`Activity ${activityId} not found`);
  }

  const points = await db
    .select({
      lat: activityDataPointsTable.lat,
      lng: activityDataPointsTable.lng,
    })
    .from(activityDataPointsTable)
    .where(eq(activityDataPointsTable.activityId, activityId))
    .orderBy(asc(activityDataPointsTable.timestamp));

  // Downsample very long routes — Remotion renders the SVG every frame and
  // huge polylines are wasteful. ~600 points is plenty for 1080×1920.
  const filtered = points.filter(
    (p) => p.lat != null && p.lng != null,
  ) as { lat: number; lng: number }[];
  const MAX_POINTS = 600;
  const stride = Math.max(1, Math.floor(filtered.length / MAX_POINTS));
  const routePoints =
    filtered.length > MAX_POINTS
      ? filtered.filter((_, i) => i % stride === 0)
      : filtered;

  return {
    title: `${activity.sport} on ${new Date(activity.startTime).toDateString()}`,
    sport: activity.sport,
    date: activity.startTime.toISOString(),
    durationSeconds: activity.durationSeconds ?? 0,
    distanceMeters: activity.distanceMeters ?? 0,
    avgPaceSecPerKm: activity.avgPaceSecPerKm ?? null,
    totalElevGainMeters: activity.totalElevGainMeters ?? null,
    routePoints,
    brandName: "Fitness Logbook",
  };
}

/**
 * Renders a Remotion composition to an MP4 file on disk, then uploads the
 * MP4 to Replit Object Storage. Returns the object path the client uses to
 * fetch the video via /api/storage/objects/*.
 */
export async function renderActivityVideo(
  activityId: number,
  onProgress: (u: RenderProgressUpdate) => void,
): Promise<RenderResult> {
  onProgress({ progress: 0, stage: "bundling" });
  const serveUrl = await getRemotionServeUrl();

  const inputProps = await buildInputProps(activityId);

  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
  });

  const tmpDir = path.join(os.tmpdir(), "fitness-renders");
  await mkdir(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, `${randomUUID()}.mp4`);

  logger.info(
    { activityId, durationInFrames: composition.durationInFrames },
    "Starting Remotion render",
  );

  try {
    try {
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: tmpFile,
        inputProps,
        // Higher concurrency = faster render but more RAM. 1-2 is safe on Replit.
        concurrency: 2,
        onProgress: ({ progress }) => {
          onProgress({ progress, stage: "rendering" });
        },
        // Pixel format that Instagram/Reels expects
        pixelFormat: "yuv420p",
        // Overwrite the temp file if it somehow already exists
        overwrite: true,
      });
    } catch (err) {
      logger.error({ err, activityId }, "Remotion render failed");
      throw err;
    }

    onProgress({ progress: 1, stage: "uploading" });

    // Upload the rendered MP4 to Replit Object Storage and return its path.
    const buf = await readFile(tmpFile);
    const objectPath = await objectStorage.uploadBufferToObjectEntity(
      buf,
      "video/mp4",
    );

    return { objectPath };
  } finally {
    // Always clean up the temp file, even if render or upload threw.
    unlink(tmpFile).catch(() => undefined);
  }
}
