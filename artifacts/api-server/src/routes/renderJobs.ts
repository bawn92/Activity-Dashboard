import {
  Router,
  type IRouter,
  type Request,
  type Response,
} from "express";
import {
  db,
  activitiesTable,
  renderJobsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { enqueueRender } from "../lib/renderQueue";
import type { RenderJob } from "@workspace/db";

const router: IRouter = Router();

const VALID_STYLES = new Set(["cinematic", "map"]);

/**
 * Convert a DB row into the API response shape, augmenting with the public
 * URL the browser uses to fetch the rendered MP4.
 */
function serialize(job: RenderJob): Record<string, unknown> {
  const videoUrl = job.videoObjectPath
    ? // /objects/uploads/<id> ⇒ /api/storage/objects/uploads/<id>
      `/api/storage${job.videoObjectPath}`
    : null;
  return {
    id: job.id,
    activityId: job.activityId,
    status: job.status,
    progress: job.progress,
    videoObjectPath: job.videoObjectPath,
    videoUrl,
    errorMessage: job.errorMessage,
    style: job.style,
    centerLat: job.centerLat,
    centerLng: job.centerLng,
    zoom: job.zoom,
    bearing: job.bearing,
    pitch: job.pitch,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

router.post(
  "/activities/:id/render-video",
  async (req: Request, res: Response) => {
    const activityId = Number(req.params.id);
    if (!Number.isFinite(activityId) || activityId <= 0) {
      res.status(400).json({ error: "Invalid activity id" });
      return;
    }

    // Body is optional. Defaults to a "cinematic" render with no camera.
    const body = (req.body ?? {}) as {
      style?: string;
      centerLat?: number;
      centerLng?: number;
      zoom?: number;
      bearing?: number;
      pitch?: number;
    };

    const style = body.style ?? "cinematic";
    if (!VALID_STYLES.has(style)) {
      res
        .status(400)
        .json({ error: `Invalid style: must be "cinematic" or "map"` });
      return;
    }

    // Validate camera params when present. They're only meaningful for "map"
    // but we still accept (and persist) them for "cinematic" if provided —
    // the renderer simply ignores them.
    const cameraNumberOrNull = (
      v: unknown,
      name: string,
    ): number | null => {
      if (v == null) return null;
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new Error(`Invalid ${name}: must be a finite number`);
      }
      return v;
    };

    let centerLat: number | null;
    let centerLng: number | null;
    let zoom: number | null;
    let bearing: number | null;
    let pitch: number | null;
    try {
      centerLat = cameraNumberOrNull(body.centerLat, "centerLat");
      centerLng = cameraNumberOrNull(body.centerLng, "centerLng");
      zoom = cameraNumberOrNull(body.zoom, "zoom");
      bearing = cameraNumberOrNull(body.bearing, "bearing");
      pitch = cameraNumberOrNull(body.pitch, "pitch");
    } catch (err) {
      res
        .status(400)
        .json({ error: err instanceof Error ? err.message : String(err) });
      return;
    }

    if (style === "map") {
      if (centerLat == null || centerLng == null || zoom == null) {
        res.status(400).json({
          error:
            'Map style requires "centerLat", "centerLng", and "zoom" in the request body',
        });
        return;
      }
    }

    const [activity] = await db
      .select({ id: activitiesTable.id })
      .from(activitiesTable)
      .where(eq(activitiesTable.id, activityId))
      .limit(1);
    if (!activity) {
      res.status(404).json({ error: "Activity not found" });
      return;
    }

    const [job] = await db
      .insert(renderJobsTable)
      .values({
        activityId,
        status: "queued",
        progress: 0,
        style,
        centerLat,
        centerLng,
        zoom,
        bearing,
        pitch,
      })
      .returning();

    enqueueRender(job.id, activityId);

    res.status(201).json(serialize(job));
  },
);

router.get(
  "/activities/:id/render-jobs",
  async (req: Request, res: Response) => {
    const activityId = Number(req.params.id);
    if (!Number.isFinite(activityId) || activityId <= 0) {
      res.status(400).json({ error: "Invalid activity id" });
      return;
    }
    const jobs = await db
      .select()
      .from(renderJobsTable)
      .where(eq(renderJobsTable.activityId, activityId))
      .orderBy(desc(renderJobsTable.createdAt));
    res.json(jobs.map(serialize));
  },
);

router.get("/render-jobs/:jobId", async (req: Request, res: Response) => {
  const jobId = Number(req.params.jobId);
  if (!Number.isFinite(jobId) || jobId <= 0) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const [job] = await db
    .select()
    .from(renderJobsTable)
    .where(eq(renderJobsTable.id, jobId))
    .limit(1);
  if (!job) {
    res.status(404).json({ error: "Render job not found" });
    return;
  }
  res.json(serialize(job));
});

export default router;
