import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import {
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import {
  db,
  activitiesTable,
  activityDataPointsTable,
  renderJobsTable,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { ObjectStorageService } from "../objectStorage";
import { getRemotionServeUrl } from "./bundle";
import { logger } from "../logger";

const CINEMATIC_COMPOSITION_ID = "WorkoutRouteShareable";
const MAP_COMPOSITION_ID = "WorkoutRouteMap";
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
 * Build the inputProps object the Remotion compositions expect.
 *
 * The cinematic composition uses the full activity summary; the map composition
 * uses the same data plus camera params (center/zoom/bearing/pitch) that the
 * frontend captures from the user's interactive maplibre preview.
 */
async function buildInputProps(
  activityId: number,
  style: "cinematic" | "map",
  camera: {
    centerLat: number | null;
    centerLng: number | null;
    zoom: number | null;
    bearing: number | null;
    pitch: number | null;
  },
  cameraMode: "static" | "follow",
) {
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

  const baseProps = {
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

  if (style === "map") {
    if (
      camera.centerLat == null ||
      camera.centerLng == null ||
      camera.zoom == null
    ) {
      throw new Error(
        "Map render requires centerLat, centerLng, and zoom on the job row",
      );
    }
    return {
      ...baseProps,
      camera: {
        centerLat: camera.centerLat,
        centerLng: camera.centerLng,
        zoom: camera.zoom,
        bearing: camera.bearing ?? 0,
        pitch: camera.pitch ?? 0,
      },
      cameraMode,
    };
  }

  return baseProps;
}

/**
 * Renders a Remotion composition to an MP4 file on disk, then uploads the
 * MP4 to Replit Object Storage. Returns the object path the client uses to
 * fetch the video via /api/storage/objects/*.
 *
 * `jobId` controls the deterministic object key — the rendered MP4 is
 * stored at `videos/<jobId>.mp4` so it can be looked up directly from the
 * render-job row. The `style` and optional camera params are read from the
 * job row, so a single signature handles both cinematic and map renders.
 */
export async function renderActivityVideo(
  jobId: number,
  onProgress: (u: RenderProgressUpdate) => void,
): Promise<RenderResult> {
  const [job] = await db
    .select()
    .from(renderJobsTable)
    .where(eq(renderJobsTable.id, jobId))
    .limit(1);
  if (!job) {
    throw new Error(`Render job ${jobId} not found`);
  }

  const style: "cinematic" | "map" =
    job.style === "map" ? "map" : "cinematic";
  const compositionId =
    style === "map" ? MAP_COMPOSITION_ID : CINEMATIC_COMPOSITION_ID;

  onProgress({ progress: 0, stage: "bundling" });
  const serveUrl = await getRemotionServeUrl();

  const cameraMode: "static" | "follow" =
    job.cameraMode === "follow" ? "follow" : "static";

  const inputProps = await buildInputProps(
    job.activityId,
    style,
    {
      centerLat: job.centerLat,
      centerLng: job.centerLng,
      zoom: job.zoom,
      bearing: job.bearing,
      pitch: job.pitch,
    },
    cameraMode,
  );

  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps,
  });

  const tmpDir = path.join(os.tmpdir(), "fitness-renders");
  await mkdir(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, `${randomUUID()}.mp4`);

  logger.info(
    {
      activityId: job.activityId,
      style,
      durationInFrames: composition.durationInFrames,
    },
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
        // Forward Chromium console output (warn/error always, [map-frame]
        // tracing always) to our server logs so we can diagnose per-frame
        // slowdowns and failures from production logs alone. We filter info
        // logs to just our tagged traces to avoid drowning the log stream.
        onBrowserLog: (log) => {
          const text = log.text ?? "";
          if (
            log.type === "error" ||
            log.type === "warning" ||
            text.startsWith("[map-frame]") ||
            text.startsWith("maplibre")
          ) {
            logger.info(
              { browserLogType: log.type, jobId },
              `[browser:${log.type}] ${text}`,
            );
          }
        },
        // Pixel format that Instagram/Reels expects
        pixelFormat: "yuv420p",
        // Overwrite the temp file if it somehow already exists
        overwrite: true,
        // Maplibre-gl is a large WebGL bundle — give the bundle/page a bigger
        // timeout so its initial setup doesn't trip Remotion's default.
        timeoutInMilliseconds: 60_000,
      });
    } catch (err) {
      logger.error(
        { err, activityId: job.activityId, style },
        "Remotion render failed",
      );
      throw err;
    }

    onProgress({ progress: 1, stage: "uploading" });

    // Upload the rendered MP4 to Replit Object Storage and return its path.
    const buf = await readFile(tmpFile);
    const objectPath = await objectStorage.uploadBufferToObjectEntity(
      buf,
      "video/mp4",
      `videos/${jobId}.mp4`,
    );

    return { objectPath };
  } finally {
    // Always clean up the temp file, even if render or upload threw.
    unlink(tmpFile).catch(() => undefined);
  }
}
